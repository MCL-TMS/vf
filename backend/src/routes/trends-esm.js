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
const { getConnection } = require('../config/database-api');
const { getBrandMapping } = require('../utils/brandMapping');
const { buildScopedBrandFilter, getAuthorizedCustomerNos } = require('../utils/brandScope');

/**
 * 日期辅助类
 */
class DateHelper {
  static isValidDateString(dateStr) {
    if (!dateStr) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
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

const TRENDS_CACHE_TTL_MS = 30000;
const TRENDS_CACHE_MAX_ENTRIES = 200;
const trendsResponseCache = new Map();

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

function getTrendsCache(cacheKey) {
  const cached = trendsResponseCache.get(cacheKey);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > TRENDS_CACHE_TTL_MS) {
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
    const { dateFrom, dateTo, brand, granularity = 'day', selfFlag } = req.query;
    
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
    const trendsQuery = `
      SELECT 
        ${timeGroupBy} as time_period,
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS  in('95','93') THEN t.TSK_MERGE_NO END) as delivered_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('55', '70', '80') THEN t.TSK_MERGE_NO END) as in_transit_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '00' THEN t.TSK_MERGE_NO END) as pending_orders,
        COUNT(DISTINCT CASE WHEN t.IS48H_FLAG = 'Y' THEN t.TSK_MERGE_NO END) as timeout_48h_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS in ('100','105') THEN t.TSK_MERGE_NO END) as return_orders,
          COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('90', '110') THEN t.TSK_MERGE_NO END) as cancelled_orders,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_hours,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS in('95','93') THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as delivery_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.IS48H_FLAG = 'Y' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as timeout_rate
      FROM APP_CMS.TSK_LIST_TASK t
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.WMS_OUTBOUND_TIME >= TO_DATE(:dateFrom, 'YYYY-MM-DD')
        AND t.WMS_OUTBOUND_TIME < TO_DATE(:dateTo, 'YYYY-MM-DD') + INTERVAL '1' DAY
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
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
        granularity,
        selfFlag: selfFlag || 'Y'
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
    const { dateFrom, dateTo, brand, metric = 'delivery_rate', selfFlag } = req.query;
    
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
        ROUND(COUNT(DISTINCT CASE WHEN t.IS48H_FLAG = 'Y' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as timeout_rate,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_time,
        ROUND(
          COUNT(DISTINCT CASE WHEN t.DIS_STATUS in('95','93') AND t.IS48H_FLAG = 'N' THEN t.TSK_MERGE_NO END) * 100.0 / 
          NULLIF(COUNT(DISTINCT CASE WHEN t.DIS_STATUS in('95','93') THEN t.TSK_MERGE_NO END), 0),
          2
        ) as on_time_rate
      FROM APP_CMS.TSK_LIST_TASK t
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.WMS_OUTBOUND_TIME >= TO_DATE(:dateFrom, 'YYYY-MM-DD')
        AND t.WMS_OUTBOUND_TIME < TO_DATE(:dateTo, 'YYYY-MM-DD') + INTERVAL '1' DAY
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
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
    const { dateFrom, dateTo, brand, granularity = 'day', selfFlag } = req.query;
    
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
        ROUND(COUNT(DISTINCT CASE WHEN t.IS48H_FLAG = 'Y' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as timeout_rate,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_hours
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CARRIERID = bc.COMPANY_SYSID
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.WMS_OUTBOUND_TIME >= TO_DATE(:dateFrom, 'YYYY-MM-DD')
        AND t.WMS_OUTBOUND_TIME < TO_DATE(:dateTo, 'YYYY-MM-DD') + INTERVAL '1' DAY
        AND t.TSK_MERGE_NO IS NOT NULL
        AND t.CARRIERID IS NOT NULL
        ${brandFilter}
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
 * 获取趋势预测数据（基于历史数据的简单预测）
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
    const { dateFrom, dateTo, days = 7, brand, selfFlag } = req.query;
    
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

    const forecastDays = parseInt(days);
    if (isNaN(forecastDays) || forecastDays < 1 || forecastDays > 30) {
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

    connection = await getConnection();
    
    // 构建筛选条件
    let selfFlagFilter = '';
    const params = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };
    const { brandFilter } = await buildBrandFilterForTrends({ req, params, brand });
    
    if (selfFlag && selfFlag !== 'all') {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = selfFlag;
    } else if (selfFlag === 'all') {
      selfFlagFilter = '';
    } else {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = 'Y';
    }

    // 查询历史数据统计（用于简单的移动平均预测）
    const historicalQuery = `
      SELECT 
        to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD') as date_period,
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS in('95','93') THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as delivery_rate
      FROM APP_CMS.TSK_LIST_TASK t
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.WMS_OUTBOUND_TIME >= TO_DATE(:dateFrom, 'YYYY-MM-DD')
        AND t.WMS_OUTBOUND_TIME < TO_DATE(:dateTo, 'YYYY-MM-DD') + INTERVAL '1' DAY
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
        ${selfFlagFilter}
      GROUP BY to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD')
      ORDER BY to_char(t.WMS_OUTBOUND_TIME, 'YYYY-MM-DD') DESC
      FETCH FIRST 30 ROWS ONLY
    `;

    const result = await connection.execute(historicalQuery, params);
    
    const historicalData = result.rows.map(row => ({
      date: row[0],
      orders: row[1] || 0,
      deliveryRate: row[2] || 0
    }));

    // 基于真实历史数据计算基准值（空数据时兜底为0）
    const hasHistory = historicalData.length > 0;
    const avgOrders = hasHistory
      ? historicalData.reduce((sum, d) => sum + d.orders, 0) / historicalData.length
      : 0;
    const avgDeliveryRate = hasHistory
      ? historicalData.reduce((sum, d) => sum + d.deliveryRate, 0) / historicalData.length
      : 0;

    // 使用线性趋势（最小二乘斜率）替代随机波动，保证同参数结果可复现
    const chronological = [...historicalData].reverse();
    let slope = 0;
    if (chronological.length >= 2) {
      const n = chronological.length;
      const xMean = (n - 1) / 2;
      const yMean = chronological.reduce((sum, p) => sum + p.orders, 0) / n;
      let numerator = 0;
      let denominator = 0;
      chronological.forEach((point, idx) => {
        const xDelta = idx - xMean;
        numerator += xDelta * (point.orders - yMean);
        denominator += xDelta * xDelta;
      });
      slope = denominator === 0 ? 0 : numerator / denominator;
    }

    // 生成预测数据
    const forecastData = [];
    const lastDate = new Date(dateTo);
    
    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(lastDate.getDate() + i);
      
      forecastData.push({
        date: DateHelper.formatDate(forecastDate),
        predictedOrders: Math.round(Math.max(0, avgOrders + slope * i)),
        predictedDeliveryRate: Math.round(avgDeliveryRate * 100) / 100,
        confidence: Math.max(50, 90 - i * 3) // 置信度随天数递减
      });
    }

    const payload = {
      success: true,
      data: {
        historical: historicalData,
        forecast: forecastData,
        summary: {
          avgDailyOrders: Math.round(avgOrders),
          avgDeliveryRate: Math.round(avgDeliveryRate * 100) / 100,
          forecastPeriod: `${forecastDays} days`
        }
      },
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        forecastDays,
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
    const { dateFrom, dateTo, brand, granularity = 'day', selfFlag } = req.query;
    
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
    // 注意：需要根据实际数据库中的异常标识字段调整
    const exceptionsQuery = `
      SELECT 
        ${timeGroupBy} as time_period,
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        
        -- 揽收延迟（假设：DIS_STATUS='00' 且超过24小时未发货）
        COUNT(DISTINCT CASE 
          WHEN t.DIS_STATUS = '00' 
          AND t.WMS_OUTBOUND_TIME IS NOT NULL 
          AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 24 
          THEN t.TSK_MERGE_NO 
        END) as pickup_delay,
        
        -- 发运延迟（假设：IS48H_FLAG='Y'表示超时48小时）
        COUNT(DISTINCT CASE 
          WHEN t.IS48H_FLAG = 'Y' 
          AND t.DIS_STATUS IN ('55', '70', '80')
          THEN t.TSK_MERGE_NO 
        END) as ship_delay,
        
        -- 签收延迟（假设：已签收但超时）
        COUNT(DISTINCT CASE 
          WHEN t.DIS_STATUS IN ('95', '93') 
          AND t.IS48H_FLAG = 'Y'
          THEN t.TSK_MERGE_NO 
        END) as delivery_delay,
        
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
        
        -- 总异常数（超时48小时的订单）
        COUNT(DISTINCT CASE 
          WHEN t.IS48H_FLAG = 'Y'
          THEN t.TSK_MERGE_NO 
        END) as total_exceptions,
        
        -- 异常率
        ROUND(
          COUNT(DISTINCT CASE WHEN t.IS48H_FLAG = 'Y' THEN t.TSK_MERGE_NO END) * 100.0 / 
          NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 
          2
        ) as exception_rate
        
      FROM APP_CMS.TSK_LIST_TASK t
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.WMS_OUTBOUND_TIME >= TO_DATE(:dateFrom, 'YYYY-MM-DD')
        AND t.WMS_OUTBOUND_TIME < TO_DATE(:dateTo, 'YYYY-MM-DD') + INTERVAL '1' DAY
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
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
      returnExceptions: row[5] || 0,
      cancelExceptions: row[6] || 0,
      totalExceptions: row[7] || 0,
      exceptionRate: row[8] || 0
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
      deliveryDelayTotal: exceptionsData.reduce((sum, d) => sum + d.deliveryDelay, 0)
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