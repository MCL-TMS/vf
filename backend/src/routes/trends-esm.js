const { dateBoundarySql, dateEndExclusiveSql, validateRequestDateRange } = require('../utils/dateRange');
/**
 * VF物流数据分析平台 - 趋势分析API路由 (ES6模块版本)
 * 
 * 提供时间序列数据、趋势预测、周期性分析等功能
 * 
 * API端点：
 * - GET /api/trends/orders - 订单趋势数据
 * - GET /api/trends/performance - 性能趋势数据
 * - GET /api/trends/carriers - 快递商趋势对比
 * - GET /api/trends/forecast - 趋势预测
 * - GET /api/trends/exceptions - 异常趋势数据
 */

const express = require('express');
const router = express.Router();
router.use(validateRequestDateRange);
const { getConnection } = require('../config/database-api');
const { getBrandMapping } = require('../utils/brandMapping');
const { buildScopedBrandFilter, getAuthorizedCustomerNos } = require('../utils/brandScope');
const { isValidDateTime } = require('../utils/dateRange');
const { buildOrderForecast } = require('../utils/orderForecast');
const forecastCalendarConfig = require('../config/forecast-calendar.json');
const { buildForecastCalendar, getUncoveredHolidayYears } = require('../utils/forecastCalendar');

/**
 * 日期辅助类
 */
class DateHelper {
  static isValidDateString(dateStr) {
    return isValidDateTime(dateStr);
  }
  
  static formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * 品牌代码映射
 */
const BRAND_MAPPING_FALLBACK = {
  'DICKIES': '18405',
  'TNF': '18405-1', 
  'ICEBREAKER': '18405-2',
  'VANS': '18405-3',
  'TIMBERLAND': '18405-4',
  'SMARTWOOL': '18405-5'
};

const PLATFORM_MAPPING = {
  tmall: '天猫',
  douyin: '抖音',
  jd: '京东',
  pdd: '拼多多',
  official: '官网/小程序',
  o2o: 'O2O',
  xiaohongshu: '小红书',
  wechat: '微信'
};

const TRENDS_CACHE_TTL_MS = 30000;
const TRENDS_CACHE_MAX_ENTRIES = 200;
const trendsResponseCache = new Map();
const NO_UPDATE_48H_EXCLUDED_STATUSES = "('40','90','93','94','95','99','100','105','110')";

function buildNoUpdate48hCondition(flagExpr, statusExpr) {
  return `(${flagExpr} = 'Y' AND ${statusExpr} NOT IN ${NO_UPDATE_48H_EXCLUDED_STATUSES})`;
}

function buildNoUpdate48hNegativeCondition(flagExpr, statusExpr) {
  return `(${flagExpr} IS NULL OR ${flagExpr} <> 'Y' OR ${statusExpr} IS NULL OR ${statusExpr} IN ${NO_UPDATE_48H_EXCLUDED_STATUSES})`;
}

function stableStringify(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const keys = Object.keys(value).sort();
  const pairs = keys.map((key) => `${key}:${stableStringify(value[key])}`);
  return `{${pairs.join(',')}}`;
}

function buildTrendsCacheKey(req, endpointName) {
  const userScope = {
    userId: req.user?.userId || 'anonymous',
    isAdmin: Boolean(req.user?.isAdmin),
    customerNo: req.user?.customerNo || '',
    customerNos: req.user?.customerNos || []
  };

  return `${endpointName}|${stableStringify(userScope)}|${stableStringify(req.query || {})}`;
}

function getTrendsCache(cacheKey, ttlMs = TRENDS_CACHE_TTL_MS) {
  const cached = trendsResponseCache.get(cacheKey);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > ttlMs) {
    trendsResponseCache.delete(cacheKey);
    return null;
  }

  return cached.payload;
}

function setTrendsCache(cacheKey, payload) {
  if (trendsResponseCache.size >= TRENDS_CACHE_MAX_ENTRIES) {
    const oldestKey = trendsResponseCache.keys().next().value;
    if (oldestKey) {
      trendsResponseCache.delete(oldestKey);
    }
  }

  trendsResponseCache.set(cacheKey, {
    timestamp: Date.now(),
    payload
  });
}

async function buildBrandFilterForTrends({ req, params, brand, fieldName = 't.CUSTOMERNO', paramPrefix = 'brand' }) {
  const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
  const shouldLoadBrandMapping = (brand && brand !== 'all') || Array.isArray(authorizedCustomerNos);
  let brandMapping = {};

  if (shouldLoadBrandMapping) {
    try {
      brandMapping = await getBrandMapping();
    } catch (error) {
      // 品牌映射加载失败时回退到本地映射，避免影响接口可用性
      console.warn('趋势路由品牌映射加载失败，使用本地回退映射:', error.message);
      brandMapping = BRAND_MAPPING_FALLBACK;
    }
  }

  const brandFilter = buildScopedBrandFilter({
    queryParams: params,
    requestedBrands: brand,
    authorizedCustomerNos,
    brandMapping,
    fieldName,
    paramPrefix
  });

  return { brandFilter, authorizedCustomerNos };
}

function normalizePlatformList(platform) {
  if (platform === undefined || platform === null) return [];

  const rawValues = Array.isArray(platform)
    ? platform
    : String(platform)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

  const normalized = rawValues
    .map((value) => {
      const mapped = PLATFORM_MAPPING[String(value).toLowerCase()] || value;
      return String(mapped).replace(/／/g, '/').trim();
    })
    .filter((value) => value && value.toLowerCase() !== 'all');

  return Array.from(new Set(normalized));
}

function buildPlatformFilterForTrends({ params, platform, fieldExpr = 'v.PLATFORM_CLASS', paramPrefix = 'platform' }) {
  const normalizedPlatforms = normalizePlatformList(platform);
  if (!normalizedPlatforms.length) return '';

  if (normalizedPlatforms.length === 1) {
    const key = `${paramPrefix}_0`;
    params[key] = normalizedPlatforms[0];
    return ` AND REPLACE(TRIM(${fieldExpr}), '／', '/') = :${key}`;
  }

  const placeholders = normalizedPlatforms.map((_, index) => `:${paramPrefix}_${index}`).join(', ');
  normalizedPlatforms.forEach((value, index) => {
    params[`${paramPrefix}_${index}`] = value;
  });
  return ` AND REPLACE(TRIM(${fieldExpr}), '／', '/') IN (${placeholders})`;
}

function buildPlatformFilterForTrendsByCode({ params, platform, platformCodeExpr = 't.PLATFORM', paramPrefix = 'platform' }) {
  const normalizedPlatforms = normalizePlatformList(platform);
  if (!normalizedPlatforms.length) return '';

  const placeholders = normalizedPlatforms.map((_, index) => `:${paramPrefix}_${index}`).join(', ');
  normalizedPlatforms.forEach((value, index) => {
    params[`${paramPrefix}_${index}`] = value;
  });

  return `
    AND EXISTS (
      SELECT 1
      FROM APP_CMS.BAS_CODES bc
      WHERE bc.CODEID = 'PLATFORM_CLASS'
        AND bc.CODE = ${platformCodeExpr}
        AND REPLACE(TRIM(bc.UDF1), '／', '/') IN (${placeholders})
    )
  `;
}

/**
 * 获取订单趋势数据
 * GET /api/trends/orders
 * 
 * 查询参数：
 * - dateFrom: 开始日期 (YYYY-MM-DD)
 * - dateTo: 结束日期 (YYYY-MM-DD)
 * - brand: 品牌代码 (可选，默认all)
 * - granularity: 时间粒度 (day/week/month，默认day)
 * - selfFlag: 自管标识 (Y/N/all，默认Y)
 */
router.get('/orders', async (req, res) => {
  let connection;
  const cacheKey = buildTrendsCacheKey(req, 'orders');
  
  try {
    const { dateFrom, dateTo, brand, platform, granularity = 'day', selfFlag, lite } = req.query;
    const liteMode = String(lite || '').toLowerCase() === '1' || String(lite || '').toLowerCase() === 'true';
    
    // 参数验证
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        error: '缺少必需的日期参数',
        message: '请提供dateFrom和dateTo参数'
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        success: false,
        error: '日期格式无效',
        message: '请提供有效的YYYY-MM-DD格式日期'
      });
    }

    // 验证granularity参数
    const validGranularities = ['day', 'week', 'month'];
    if (!validGranularities.includes(granularity)) {
      return res.status(400).json({
        success: false,
        error: '时间粒度参数无效',
        message: 'granularity参数必须是day、week或month之一'
      });
    }

    const cacheTtlMs = granularity === 'month' ? 180000 : TRENDS_CACHE_TTL_MS;
    const cached = getTrendsCache(cacheKey, cacheTtlMs);
    if (cached) {
      return res.json(cached);
    }

    connection = await getConnection();
    
    // 构建筛选条件
    let selfFlagFilter = '';
    const params = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };
    const { brandFilter } = await buildBrandFilterForTrends({ req, params, brand });
    const platformFilter = liteMode
      ? buildPlatformFilterForTrendsByCode({ params, platform })
      : buildPlatformFilterForTrends({ params, platform });
    
    // 自管筛选
    if (selfFlag && selfFlag !== 'all') {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = selfFlag;
    } else if (selfFlag === 'all') {
      selfFlagFilter = '';
    } else {
      // 默认只查询自管订单
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = 'Y';
    }

    // 根据粒度构建时间分组
    let timeGroupBy;
    switch (granularity) {
      case 'day':
        timeGroupBy = "to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD')";
        break;
      case 'week':
        timeGroupBy = "to_char(t.WMS_OUTBOUND_TIME, 'YYYY-\"W\"IW')";
        break;
      case 'month':
        timeGroupBy = "to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM')";
        break;
    }

    // 订单趋势查询
    const trendsQuery = liteMode ? `
      SELECT 
        ${timeGroupBy} as time_period,
        COUNT(*) as total_orders,
        SUM(CASE WHEN t.DIS_STATUS  in('95','93') THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN t.DIS_STATUS IN ('55', '70', '80','85','92') THEN 1 ELSE 0 END) as in_transit_orders,
        SUM(CASE WHEN t.DIS_STATUS = '00' THEN 1 ELSE 0 END) as pending_orders,
        0 as timeout_48h_orders,
        SUM(CASE WHEN t.DIS_STATUS in ('100','105') THEN 1 ELSE 0 END) as return_orders,
        SUM(CASE WHEN t.DIS_STATUS IN ('90', '110') THEN 1 ELSE 0 END) as cancelled_orders,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_hours,
        ROUND(SUM(CASE WHEN t.DIS_STATUS in('95','93') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate,
        0 as timeout_rate
      FROM APP_CMS.TSK_LIST_TASK t
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.WMS_OUTBOUND_TIME >= ${dateBoundarySql('dateFrom')}
        AND t.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('dateTo')}
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY ${timeGroupBy}
      ORDER BY ${timeGroupBy}
    ` : `
      SELECT 
        ${timeGroupBy} as time_period,
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS  in('95','93') THEN t.TSK_MERGE_NO END) as delivered_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('55', '70', '80','85','92') THEN t.TSK_MERGE_NO END) as in_transit_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '00' THEN t.TSK_MERGE_NO END) as pending_orders,
        COUNT(DISTINCT CASE WHEN ${buildNoUpdate48hCondition('v.IS_48H', 'v.DIS_STATUS')} THEN t.TSK_MERGE_NO END) as timeout_48h_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS in ('100','105') THEN t.TSK_MERGE_NO END) as return_orders,
          COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('90', '110') THEN t.TSK_MERGE_NO END) as cancelled_orders,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_hours,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS in('95','93') THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as delivery_rate,
        ROUND(COUNT(DISTINCT CASE WHEN ${buildNoUpdate48hCondition('v.IS_48H', 'v.DIS_STATUS')} THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as timeout_rate
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.WMS_OUTBOUND_TIME >= ${dateBoundarySql('dateFrom')}
        AND t.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('dateTo')}
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY ${timeGroupBy}
      ORDER BY ${timeGroupBy}
    `;

    const result = await connection.execute(trendsQuery, params);
    
    const trendsData = result.rows.map(row => ({
      timePeriod: row[0],
      totalOrders: row[1] || 0,
      deliveredOrders: row[2] || 0,
      inTransitOrders: row[3] || 0,
      pendingOrders: row[4] || 0,
      timeout48hOrders: row[5] || 0,
      returnOrders: row[6] || 0,
      cancelledOrders: row[7] || 0,
      avgDeliveryHours: row[8] || 0,
      deliveryRate: row[9] || 0,
      timeoutRate: row[10] || 0
    }));

    const payload = {
      success: true,
      data: trendsData,
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        platform: platform || 'all',
        granularity,
        selfFlag: selfFlag || 'Y',
        liteMode
      }
    };

    setTrendsCache(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error('订单趋势查询失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: '获取订单趋势数据失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('关闭数据库连接失败:', err);
      }
    }
  }
});

/**
 * 获取性能趋势数据
 * GET /api/trends/performance
 * 
 * 查询参数：
 * - dateFrom: 开始日期
 * - dateTo: 结束日期
 * - brand: 品牌代码 (可选)
 * - metric: 性能指标 (可选，默认delivery_rate)
 * - selfFlag: 自管标识 (可选)
 */
router.get('/performance', async (req, res) => {
  let connection;
  const cacheKey = buildTrendsCacheKey(req, 'performance');
  
  try {
    const { dateFrom, dateTo, brand, platform, metric = 'delivery_rate', selfFlag } = req.query;
    
    // 参数验证
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        error: '缺少必需的日期参数'
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        success: false,
        error: '日期格式无效',
        message: '请提供有效的YYYY-MM-DD格式日期'
      });
    }

    // 验证metric参数
    const validMetrics = ['delivery_rate', 'timeout_rate', 'avg_delivery_time', 'on_time_rate'];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        success: false,
        error: '性能指标参数无效',
        message: 'metric参数必须是delivery_rate、timeout_rate、avg_delivery_time或on_time_rate之一'
      });
    }

    const cached = getTrendsCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    connection = await getConnection();
    
    // 构建筛选条件
    let selfFlagFilter = '';
    const params = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };
    const { brandFilter } = await buildBrandFilterForTrends({ req, params, brand });
    const platformFilter = buildPlatformFilterForTrends({ params, platform });
    
    if (selfFlag && selfFlag !== 'all') {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = selfFlag;
    } else if (selfFlag === 'all') {
      selfFlagFilter = '';
    } else {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = 'Y';
    }

    const performanceQuery = `
      SELECT 
        to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD') as date_period,
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS in('95','93') THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as delivery_rate,
        ROUND(COUNT(DISTINCT CASE WHEN ${buildNoUpdate48hCondition('v.IS_48H', 'v.DIS_STATUS')} THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as timeout_rate,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_time,
        ROUND(
          COUNT(DISTINCT CASE WHEN t.DIS_STATUS in('95','93') AND ${buildNoUpdate48hNegativeCondition('v.IS_48H', 'v.DIS_STATUS')} THEN t.TSK_MERGE_NO END) * 100.0 / 
          NULLIF(COUNT(DISTINCT CASE WHEN t.DIS_STATUS in('95','93') THEN t.TSK_MERGE_NO END), 0),
          2
        ) as on_time_rate
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.WMS_OUTBOUND_TIME >= ${dateBoundarySql('dateFrom')}
        AND t.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('dateTo')}
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD')
      ORDER BY to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD')
    `;

    const result = await connection.execute(performanceQuery, params);
    
    const performanceData = result.rows.map(row => ({
      datePeriod: row[0],
      totalOrders: row[1] || 0,
      deliveryRate: row[2] || 0,
      timeoutRate: row[3] || 0,
      avgDeliveryTime: row[4] || 0,
      onTimeRate: row[5] || 0
    }));

    const payload = {
      success: true,
      data: performanceData,
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        platform: platform || 'all',
        metric,
        selfFlag: selfFlag || 'Y'
      }
    };

    setTrendsCache(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error('性能趋势查询失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: '获取性能趋势数据失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('关闭数据库连接失败:', err);
      }
    }
  }
});

/**
 * 获取快递商趋势对比
 * GET /api/trends/carriers
 * 
 * 查询参数：
 * - dateFrom: 开始日期
 * - dateTo: 结束日期
 * - brand: 品牌代码 (可选)
 * - granularity: 时间粒度 (可选，默认day)
 * - selfFlag: 自管标识 (可选)
 */
router.get('/carriers', async (req, res) => {
  let connection;
  const cacheKey = buildTrendsCacheKey(req, 'carriers');
  
  try {
    const { dateFrom, dateTo, brand, platform, granularity = 'day', selfFlag } = req.query;
    
    // 参数验证
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        error: '缺少必需的日期参数'
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        success: false,
        error: '日期格式无效'
      });
    }

    const cached = getTrendsCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    connection = await getConnection();
    
    // 构建筛选条件
    let selfFlagFilter = '';
    const params = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };
    const { brandFilter } = await buildBrandFilterForTrends({ req, params, brand });
    const platformFilter = buildPlatformFilterForTrends({ params, platform });
    
    if (selfFlag && selfFlag !== 'all') {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = selfFlag;
    } else if (selfFlag === 'all') {
      selfFlagFilter = '';
    } else {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = 'Y';
    }

    // 根据粒度构建时间分组
    let timeGroupBy;
    switch (granularity) {
      case 'day':
        timeGroupBy = "to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD')";
        break;
      case 'week':
        timeGroupBy = "to_char(t.WMS_OUTBOUND_TIME, 'YYYY-\"W\"IW')";
        break;
      case 'month':
        timeGroupBy = "to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM')";
        break;
    }

    const carriersQuery = `
      SELECT 
        ${timeGroupBy} as time_period,
        t.CARRIERID as carrier_id,
        bc.COMPANY_ABNAME as carrier_name,
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS in('95','93') THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as delivery_rate,
        ROUND(COUNT(DISTINCT CASE WHEN ${buildNoUpdate48hCondition('v.IS_48H', 'v.DIS_STATUS')} THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as timeout_rate,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_hours
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CARRIERID = bc.COMPANY_SYSID
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.WMS_OUTBOUND_TIME >= ${dateBoundarySql('dateFrom')}
        AND t.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('dateTo')}
        AND t.TSK_MERGE_NO IS NOT NULL
        AND t.CARRIERID IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY ${timeGroupBy}, t.CARRIERID, bc.COMPANY_ABNAME
      ORDER BY ${timeGroupBy}, t.CARRIERID
    `;

    const result = await connection.execute(carriersQuery, params);
    
    const carriersData = result.rows.map(row => ({
      timePeriod: row[0],
      carrierId: row[1],
      carrierName: row[2] || row[1],
      totalOrders: row[3] || 0,
      deliveryRate: row[4] || 0,
      timeoutRate: row[5] || 0,
      avgDeliveryHours: row[6] || 0
    }));

    const payload = {
      success: true,
      data: carriersData,
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        platform: platform || 'all',
        granularity,
        selfFlag: selfFlag || 'Y'
      }
    };

    setTrendsCache(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error('快递商趋势查询失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: '获取快递商趋势数据失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('关闭数据库连接失败:', err);
      }
    }
  }
});

/**
 * 获取趋势预测数据（完整日历史、滚动回测选模）
 * GET /api/trends/forecast
 * 
 * 查询参数：
 * - dateFrom: 开始日期
 * - dateTo: 结束日期
 * - days: 预测天数 (默认7天)
 * - brand: 品牌代码 (可选)
 */
router.get('/forecast', async (req, res) => {
  let connection;
  const cacheKey = buildTrendsCacheKey(req, 'forecast');
  
  try {
    const { dateFrom, dateTo, days = 7, brand, platform, selfFlag } = req.query;
    
    // 参���验证
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        error: '缺少必需的日期参数'
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        success: false,
        error: '日期格式无效'
      });
    }

    const forecastDays = Number(days);
    if (!Number.isInteger(forecastDays) || forecastDays < 1 || forecastDays > 30) {
      return res.status(400).json({
        success: false,
        error: '预测天数无效',
        message: '预测天数必须在1-30之间'
      });
    }

    const cached = getTrendsCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const chinaToday = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.parse(`${chinaToday}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    const historyTo = dateTo.slice(0, 10) < yesterday ? dateTo.slice(0, 10) : yesterday;
    const earliestFrom = new Date(Date.parse(`${historyTo}T00:00:00Z`) - 799 * 86400000).toISOString().slice(0, 10);
    const historyFrom = dateFrom.slice(0, 10) > earliestFrom ? dateFrom.slice(0, 10) : earliestFrom;
    if (historyFrom > historyTo) {
      return res.status(400).json({ success: false, message: '筛选范围内没有已结束的自然日，请选择历史日期。' });
    }
    connection = await getConnection();

    // 构建筛选条件
    let selfFlagFilter = '';
    const params = {
      dateFrom: historyFrom,
      dateTo: historyTo
    };
    const { brandFilter } = await buildBrandFilterForTrends({ req, params, brand });
    const platformFilter = buildPlatformFilterForTrends({ params, platform });
    
    if (selfFlag && selfFlag !== 'all') {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = selfFlag;
    } else if (selfFlag === 'all') {
      selfFlagFilter = '';
    } else {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = 'Y';
    }

    const historicalQuery = `
      SELECT 
        to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD') as date_period,
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS in('95','93') THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as delivery_rate
      FROM APP_CMS.TSK_LIST_TASK t
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.WMS_OUTBOUND_TIME >= ${dateBoundarySql('dateFrom')}
        AND t.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('dateTo')}
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD')
      ORDER BY to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD') ASC
    `;

    const result = await connection.execute(historicalQuery, params);
    
    const historicalData = result.rows.map(row => ({
      date: row.DATE_PERIOD ?? row[0],
      orders: row.TOTAL_ORDERS ?? row[1] ?? 0,
      deliveryRate: row.DELIVERY_RATE ?? row[2] ?? 0
    }));

    const forecastTo = new Date(Date.parse(`${historyTo}T00:00:00Z`) + forecastDays * 86400000).toISOString().slice(0, 10);
    const calendar = buildForecastCalendar(historyFrom, forecastTo, forecastCalendarConfig);
    const uncoveredHolidayYears = getUncoveredHolidayYears(historyFrom, forecastTo, forecastCalendarConfig);
    const prediction = buildOrderForecast(historicalData, { dateFrom: historyFrom, dateTo: historyTo, days: forecastDays, calendar, uncoveredHolidayYears });
    const payload = {
      success: true,
      data: prediction,
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        platform: platform || 'all',
        forecastDays,
        historyFrom,
        historyTo,
        selfFlag: selfFlag || 'Y'
      }
    };

    setTrendsCache(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error('趋势预测查询失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: '获取趋势预测数据失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('关闭数据库连接失败:', err);
      }
    }
  }
});

/**
 * 获取异常趋势数据
 * GET /api/trends/exceptions
 * 
 * 查询参数：
 * - dateFrom: 开始日期
 * - dateTo: 结束日期
 * - brand: 品牌代码 (可选)
 * - granularity: 时间粒度 (day/week/month，默认day)
 * - selfFlag: 自管标识 (可选)
 */
router.get('/exceptions', async (req, res) => {
  let connection;
  const cacheKey = buildTrendsCacheKey(req, 'exceptions');
  
  try {
    const { dateFrom, dateTo, brand, platform, granularity = 'day', selfFlag } = req.query;
    
    // 参数验证
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        error: '缺少必需的日期参数',
        message: '请提供dateFrom和dateTo参数'
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        success: false,
        error: '日期格式无效',
        message: '请提供有效的YYYY-MM-DD格式日期'
      });
    }

    // 验证granularity参数
    const validGranularities = ['day', 'week', 'month'];
    if (!validGranularities.includes(granularity)) {
      return res.status(400).json({
        success: false,
        error: '时间粒度参数无效',
        message: 'granularity参数必须是day、week或month之一'
      });
    }

    const cached = getTrendsCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    connection = await getConnection();
    
    // 构建筛选条件
    let selfFlagFilter = '';
    const params = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };
    const { brandFilter } = await buildBrandFilterForTrends({ req, params, brand });
    const platformFilter = buildPlatformFilterForTrends({ params, platform });
    
    // 自管筛选
    if (selfFlag && selfFlag !== 'all') {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = selfFlag;
    } else if (selfFlag === 'all') {
      selfFlagFilter = '';
    } else {
      // 默认只查询自管订单
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = 'Y';
    }

    // 根据粒度构建时间分组
    let timeGroupBy;
    switch (granularity) {
      case 'day':
        timeGroupBy = "to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD')";
        break;
      case 'week':
        timeGroupBy = "to_char(t.WMS_OUTBOUND_TIME, 'YYYY-\"W\"IW')";
        break;
      case 'month':
        timeGroupBy = "to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM')";
        break;
    }

    // 异常趋势查询
    const exceptionsQuery = `
      SELECT 
        ${timeGroupBy} as time_period,
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        
        -- 揽收超时：出库后2小时仍为已出库状态
        COUNT(DISTINCT CASE 
          WHEN t.DIS_STATUS = '00' 
          AND t.WMS_OUTBOUND_TIME IS NOT NULL 
          AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2
          THEN t.TSK_MERGE_NO 
        END) as pickup_delay,
        
        -- 发运超时：出库后12小时仍为已揽收状态
        COUNT(DISTINCT CASE 
          WHEN t.DIS_STATUS = '55'
          AND t.WMS_OUTBOUND_TIME IS NOT NULL
          AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12
          THEN t.TSK_MERGE_NO 
        END) as ship_delay,
        
        -- 签收超时：视图 IF_DELAY='Y'
        COUNT(DISTINCT CASE 
          WHEN v.IF_DELAY = 'Y'
          THEN t.TSK_MERGE_NO 
        END) as delivery_delay,

        -- 路由延迟：视图 IS_48H='Y' 且视图状态不属于已结束状态
        COUNT(DISTINCT CASE
          WHEN ${buildNoUpdate48hCondition('v.IS_48H', 'v.DIS_STATUS')}
          THEN t.TSK_MERGE_NO
        END) as route_delay,
        
        -- 退货异常
        COUNT(DISTINCT CASE 
          WHEN t.DIS_STATUS IN ('100', '105')
          THEN t.TSK_MERGE_NO 
        END) as return_exceptions,
        
        -- 取消异常
        COUNT(DISTINCT CASE 
          WHEN t.DIS_STATUS IN ('90', '110')
          THEN t.TSK_MERGE_NO 
        END) as cancel_exceptions,
        
        -- 总异常数：四类异常计数之和，与总览异常口径一致
        (
          COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '00' AND t.WMS_OUTBOUND_TIME IS NOT NULL AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2 THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' AND t.WMS_OUTBOUND_TIME IS NOT NULL AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12 THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN v.IF_DELAY = 'Y' THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${buildNoUpdate48hCondition('v.IS_48H', 'v.DIS_STATUS')} THEN t.TSK_MERGE_NO END)
        ) as total_exceptions,
        
        -- 异常率：四类异常计数之和占订单数的比例
        ROUND(
          (
            COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '00' AND t.WMS_OUTBOUND_TIME IS NOT NULL AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2 THEN t.TSK_MERGE_NO END) +
            COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' AND t.WMS_OUTBOUND_TIME IS NOT NULL AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12 THEN t.TSK_MERGE_NO END) +
            COUNT(DISTINCT CASE WHEN v.IF_DELAY = 'Y' THEN t.TSK_MERGE_NO END) +
            COUNT(DISTINCT CASE WHEN ${buildNoUpdate48hCondition('v.IS_48H', 'v.DIS_STATUS')} THEN t.TSK_MERGE_NO END)
          ) * 100.0 / 
          NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 
          2
        ) as exception_rate
        
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.WMS_OUTBOUND_TIME >= ${dateBoundarySql('dateFrom')}
        AND t.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('dateTo')}
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY ${timeGroupBy}
      ORDER BY ${timeGroupBy}
    `;

    const result = await connection.execute(exceptionsQuery, params);
    
    const exceptionsData = result.rows.map(row => ({
      timePeriod: row[0],
      totalOrders: row[1] || 0,
      pickupDelay: row[2] || 0,
      shipDelay: row[3] || 0,
      deliveryDelay: row[4] || 0,
      routeDelay: row[5] || 0,
      returnExceptions: row[6] || 0,
      cancelExceptions: row[7] || 0,
      totalExceptions: row[8] || 0,
      exceptionRate: row[9] || 0
    }));

    // 计算汇总统计
    const summary = {
      totalOrders: exceptionsData.reduce((sum, d) => sum + d.totalOrders, 0),
      totalExceptions: exceptionsData.reduce((sum, d) => sum + d.totalExceptions, 0),
      avgExceptionRate: exceptionsData.length > 0 
        ? Math.round(exceptionsData.reduce((sum, d) => sum + d.exceptionRate, 0) / exceptionsData.length * 100) / 100
        : 0,
      pickupDelayTotal: exceptionsData.reduce((sum, d) => sum + d.pickupDelay, 0),
      shipDelayTotal: exceptionsData.reduce((sum, d) => sum + d.shipDelay, 0),
      deliveryDelayTotal: exceptionsData.reduce((sum, d) => sum + d.deliveryDelay, 0),
      routeDelayTotal: exceptionsData.reduce((sum, d) => sum + d.routeDelay, 0)
    };

    const payload = {
      success: true,
      data: exceptionsData,
      summary: summary,
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        platform: platform || 'all',
        granularity,
        selfFlag: selfFlag || 'Y'
      }
    };

    setTrendsCache(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error('异常趋势查询失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: '获取异常趋势数据失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('关闭数据库连接失败:', err);
      }
    }
  }
});

module.exports = router;