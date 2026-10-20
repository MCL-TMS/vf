const { dateBoundarySql, dateEndExclusiveSql, validateRequestDateRange } = require('../utils/dateRange');
/**
 * VF物流数据分析平台 - 物流监控API路由（参数绑定修复版）
 * 
 * 提供快递商性能分析、重量分布分析、物流节点监控等功能
 * ✅ 修复与overview.js的数据一致性差异
 * ✅ 修复参数绑定不匹配问题
 */

const express = require('express');
const router = express.Router();
router.use(validateRequestDateRange);
const { getConnection, DateHelper } = require('../config/database-api');
const { getBrandMapping } = require('../utils/brandMapping'); // ✅ 导入动态品牌映射
const { buildScopedBrandFilter, getAuthorizedCustomerNos } = require('../utils/brandScope');
const { ERROR_CODES, sendError, sendRouteError } = require('../utils/apiError');

const NO_UPDATE_48H_EXCLUDED_STATUSES = "('40','90','93','94','95','99','100','105','110')";
const LOGISTICS_CACHE_TTL_MS = 30000;
const LOGISTICS_CACHE_MAX_ENTRIES = 300;
const logisticsResponseCache = new Map();

function buildNoUpdate48hCondition(flagExpr, statusExpr) {
  return `(${flagExpr} = 'Y' AND ${statusExpr} NOT IN ${NO_UPDATE_48H_EXCLUDED_STATUSES})`;
}

function stableStringify(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const keys = Object.keys(value).sort();
  const pairs = keys.map((key) => `${key}:${stableStringify(value[key])}`);
  return `{${pairs.join(',')}}`;
}

function buildLogisticsCacheKey(req, endpointName) {
  const userScope = {
    userId: req.user?.userId || 'anonymous',
    isAdmin: Boolean(req.user?.isAdmin),
    customerNo: req.user?.customerNo || '',
    customerNos: req.user?.customerNos || []
  };

  return `${endpointName}|${stableStringify(userScope)}|${stableStringify(req.query || {})}`;
}

function getLogisticsCache(cacheKey, ttlMs = LOGISTICS_CACHE_TTL_MS) {
  const cached = logisticsResponseCache.get(cacheKey);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > ttlMs) {
    logisticsResponseCache.delete(cacheKey);
    return null;
  }

  return cached.payload;
}

function setLogisticsCache(cacheKey, payload) {
  if (logisticsResponseCache.size >= LOGISTICS_CACHE_MAX_ENTRIES) {
    const oldestKey = logisticsResponseCache.keys().next().value;
    if (oldestKey) {
      logisticsResponseCache.delete(oldestKey);
    }
  }

  logisticsResponseCache.set(cacheKey, {
    timestamp: Date.now(),
    payload
  });
}

// 🔧 共享工具函数 - 与overview.js保持一致
const QueryUtils = {
  // ✅ 品牌映射配置 - 保留作为回退映射
  BRAND_MAPPING_FALLBACK: {
    'DICKIES': '18405',
    'TNF': '18405-1', 
    'ICEBREAKER': '18405-2',
    'VANS': '18405-3',
    'TIMBERLAND': '18405-4',
    'SMARTWOOL': '18405-5'
  },

  // 基础WHERE条件 - 与overview.js完全一致
  BASE_WHERE_CONDITIONS: `
    WHERE (
      t.WMS_OUTBOUND_TIME IS NOT NULL
      AND t.WMS_OUTBOUND_TIME >= ${dateBoundarySql('dateFrom')}
      AND t.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('dateTo')}
      AND t.TSK_MERGE_NO IS NOT NULL
    )`,

  // 平台映射配置 - 与overview.js完全一致
  PLATFORM_MAPPING: {
    'tmall': '天猫',
    'douyin': '抖音',
    'jd': '京东',
    'pdd': '拼多多',
    'official': '官网/小程序',
    'o2o': 'O2O',
    'xiaohongshu': '小红书',
    'wechat': '微信'
  },

  // ✅ 四种核心异常类型的SQL片段 - 更新版本
  EXCEPTION_SQL_FRAGMENTS: {
    // 超时未揽收: 出库时间后2小时，订单状态仍为'00'(已出库)
    PICKUP_TIMEOUT: `(
      t.WMS_OUTBOUND_TIME IS NOT NULL 
      AND t.DIS_STATUS = '00' 
      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2
    )`,
    
    // 超时未发运: 出库时间后12小时，订单状态仍为'55'(已揽收)
    SHIPPING_TIMEOUT: `(
      t.WMS_OUTBOUND_TIME IS NOT NULL 
      AND t.DIS_STATUS = '55' 
      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12
    )`,
    
    // 超时未签收: IF_DELAY字段值存在且为'Y'的订单（从VIEW视图获取）
    DELIVERY_TIMEOUT: `(v.IF_DELAY = 'Y')`,
    
    // 超48H未更新: 视图IS_48H='Y'且视图状态不属于已结束状态的订单
    NO_UPDATE_48H: buildNoUpdate48hCondition('v.IS_48H', 'v.DIS_STATUS')
  },

  // 🔧 修复：构建筛选条件和参数 - 支持多品牌数组和用户权限
  buildFilters(queryParams, brand, platform, selfFlag, authorizedCustomerNos) {
    let brandFilter = '';
    let platformFilter = '';
    let selfFlagFilter = '';
    
    // 🔐 品牌筛选：支持单个品牌、多个品牌（数组）、用户权限范围
    brandFilter = buildScopedBrandFilter({
      queryParams,
      requestedBrands: brand,
      authorizedCustomerNos,
      brandMapping: this.BRAND_MAPPING_FALLBACK,
      fieldName: 't.CUSTOMERNO',
      paramPrefix: 'brand'
    });
    
    if (platform && platform !== 'all') {
      platformFilter = ` AND EXISTS (
        SELECT 1 FROM APP_CMS.BAS_CODES bc 
        WHERE t.PLATFORM = bc.CODE 
          AND bc.CODEID = 'PLATFORM_CLASS' 
          AND bc.UDF1 = :platform
      )`;
      queryParams.platform = this.PLATFORM_MAPPING[platform] || platform;
      console.log(`🏪 [Platform Filter] 平台筛选映射: ${platform} -> ${queryParams.platform} (通过UDF1字段)`);
    }
    
    // 🔥 自管筛选条件 - 仅在提供selfFlag参数时处理
    if (selfFlag === 'all') {
      // 选择"全部"：不添加SELF_FLAG筛选条件
      selfFlagFilter = '';
      console.log(`🔧 [Self Flag Filter] 全部订单（自管+非自管）`);
    } else if (selfFlag === 'Y' || selfFlag === 'N') {
      // 明确指定Y或N：筛选对应类型
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      queryParams.selfFlag = selfFlag;
      console.log(`🔧 [Self Flag Filter] ${selfFlag === 'Y' ? '自管订单' : '非自管订单'}: ${selfFlag}`);
    } else {
      // 未提供或其他情况：默认为自管
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      queryParams.selfFlag = 'Y';
      console.log(`🔧 [Self Flag Filter] 默认自管订单: Y`);
    }
    
    return { brandFilter, platformFilter, selfFlagFilter };
  },

  // ✅ 异步构建筛选条件和参数（支持动态品牌映射）
  async buildFiltersAsync(queryParams, brand, platform, selfFlag, authorizedCustomerNos) {
    let brandFilter = '';
    let platformFilter = '';
    let selfFlagFilter = '';

    const normalizedBrand = Array.isArray(brand)
      ? brand.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim())
      : (typeof brand === 'string' && brand.trim() ? brand.trim() : undefined);
    const hasRequestedBrand = Array.isArray(normalizedBrand)
      ? normalizedBrand.length > 0 && !normalizedBrand.includes('all')
      : Boolean(normalizedBrand && normalizedBrand !== 'all');
    const hasAuthorizedCustomerNos = Array.isArray(authorizedCustomerNos) && authorizedCustomerNos.length > 0;

    // 仅在需要品牌过滤/转换时加载映射，管理员全量查询不触发
    const BRAND_MAPPING = (hasRequestedBrand || hasAuthorizedCustomerNos)
      ? await getBrandMapping()
      : {};
    
    brandFilter = buildScopedBrandFilter({
      queryParams,
      requestedBrands: normalizedBrand,
      authorizedCustomerNos,
      brandMapping: BRAND_MAPPING,
      fieldName: 't.CUSTOMERNO',
      paramPrefix: 'brand'
    });
    
    if (platform && platform !== 'all') {
      // ✅ 修复：物流页面也直接通过 VIEW_TSK_LIST_TASK 视图过滤 PLATFORM_CLASS
      const normalizeStringOrStringArray = (v) => {
        if (v == null) return undefined;
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (trimmed === '') return undefined;
          if (trimmed.includes(',')) return trimmed.split(',').map(s => s.trim()).filter(Boolean);
          return trimmed;
        }
        if (Array.isArray(v)) {
          const res = v.filter(i => typeof i === 'string').map(i => i.trim()).filter(i => i);
          return res.length > 0 ? res : undefined;
        }
        return undefined;
      };

      const normalizedPlatform = normalizeStringOrStringArray(platform);
      if (normalizedPlatform) {
        const requested = Array.isArray(normalizedPlatform) ? normalizedPlatform : [normalizedPlatform];
        const expandSet = new Set();
        const normalizePlatformToken = (value) => String(value || '')
          .trim()
          .replace(/／/g, '/')
          .replace(/\s+/g, '')
          .toLowerCase();

        const aliasToCanonical = {
          'tmall': '天猫',
          'douyin': '抖音',
          'jd': '京东',
          'pdd': '拼多多',
          'official': '官网/小程序',
          'wechat': '微信',
          'kuaishou': '快手',
          'ks': '快手',
          '微信小程序': '微信',
          '抖音电商': '抖音',
          '官网': '官网/小程序',
          '小程序': '官网/小程序'
        };

        const canonicalVariants = {
          '官网/小程序': ['官网/小程序', '官网／小程序', '官网', '小程序'],
          '微信': ['微信', '微信小程序'],
          '抖音': ['抖音', '抖音电商'],
          '快手': ['快手', '快手电商']
        };

        const pushPlatformVariant = (value) => {
          const text = String(value || '').trim();
          if (!text) return;
          // 兼容半角/全角斜杠，避免“官网/小程序”类平台被误过滤为空
          expandSet.add(text);
          expandSet.add(text.replace(/\//g, '／'));
          expandSet.add(text.replace(/／/g, '/'));

          const normalizedToken = normalizePlatformToken(text);
          const canonical = aliasToCanonical[normalizedToken] || aliasToCanonical[text] || text;
          expandSet.add(String(canonical).trim());

          const aliasGroup = canonicalVariants[canonical] || [];
          aliasGroup.forEach(item => {
            expandSet.add(String(item).trim());
            expandSet.add(String(item).trim().replace(/／/g, '/'));
          });
        };

        requested.forEach(p => {
          pushPlatformVariant(p);
          const mapped = this.PLATFORM_MAPPING && this.PLATFORM_MAPPING[p];
          pushPlatformVariant(mapped || p);
        });
        const expanded = Array.from(expandSet)
          .map(v => String(v).trim().replace(/／/g, '/'))
          .filter(Boolean);
        const platformPlaceholders = expanded.map((_, i) => `:platform_${i}`).join(', ');
        // 物流统计查询通常 join 了 VIEW_TSK_LIST_TASK 别名为 v
        platformFilter = ` AND REPLACE(TRIM(v.PLATFORM_CLASS), '／', '/') IN (${platformPlaceholders})`;
        expanded.forEach((val, i) => { queryParams[`platform_${i}`] = val; });
        console.log(`🏪 [Logistics Platform Filter] 平台展开匹配: [${expanded.join(', ')}]`);
      }
    }
    
    // 🔥 自管筛选条件 - 默认筛选自管订单
    if (selfFlag === 'all') {
      // 选择"全部"：不添加SELF_FLAG筛选条件
      selfFlagFilter = '';
      console.log(`🔧 [Self Flag Filter] 全部订单（自管+非自管）`);
    } else if (selfFlag === 'Y' || selfFlag === 'N') {
      // 明确指定Y或N：筛选对应类型
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      queryParams.selfFlag = selfFlag;
      console.log(`🔧 [Self Flag Filter] ${selfFlag === 'Y' ? '自管订单' : '非自管订单'}: ${selfFlag}`);
    } else {
      // 未提供或其他情况：默认为自管
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      queryParams.selfFlag = 'Y';
      console.log(`🔧 [Self Flag Filter] 默认自管订单: Y`);
    }
    
    return { brandFilter, platformFilter, selfFlagFilter };
  }
};

/**
 * 🔥 获取品牌物流异常统计数据
 * GET /api/logistics/brands
 */
router.get('/brands', async (req, res) => {
  let connection;
  const cacheKey = buildLogisticsCacheKey(req, 'brands');
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag } = req.query;
    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
    
    console.log('🔄 [Logistics-Brands查询] 收到请求参数:', { dateFrom, dateTo, brand, platform, selfFlag, authorizedCustomerNos });
    
    if (!dateFrom || !dateTo) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '缺少必需的日期参数',
        details: { requiredFields: ['dateFrom', 'dateTo'] }
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '日期格式无效',
        details: { expectedFormat: 'YYYY-MM-DD' }
      });
    }

    const cached = getLogisticsCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    connection = await getConnection();
    
    // 🔧 使用统一的筛选条件构建逻辑（基于登录态品牌范围）
    const params = { dateFrom, dateTo };
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(params, brand, platform, selfFlag, authorizedCustomerNos);

    // 🔥 品牌物流异常数据详细统计查询（✅ 从数据库查询品牌名称）
    const brandsQuery = `
      SELECT 
        t.CUSTOMERNO as brand_code,
        COALESCE(v.COMPANY_NAME, t.CUSTOMERNO) as brand_name,
        -- 基础统计
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('70','80','85','92') THEN t.TSK_MERGE_NO END) as shipped_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS in ('95','93') THEN t.TSK_MERGE_NO END) as delivered_count,
        -- 四种核心异常类型的详细统计
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) as pickup_timeout,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) as shipping_timeout,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) as delivery_timeout,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END) as no_update_48h,
        -- 总异常数
        (
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END)
        ) as total_exceptions,
        -- 各阶段成功率计算
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as pickup_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('70','80','85','92') THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as shipping_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS in ('95','93') THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as delivery_rate,
        -- 异常率（基于四种核心异常条件）
        ROUND((
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END)
        ) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as exception_rate,
        -- 平均配送时间
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_time
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CUSTOMERNO, v.COMPANY_NAME
      ORDER BY order_count DESC
    `;
    
    // 🔍 调试：打印完整SQL和参数
    console.log('📝 [Logistics-Brands] 完整SQL查询:');
    console.log(brandsQuery);
    console.log('📝 [Logistics-Brands] 查询参数:', params);

    const result = await connection.execute(brandsQuery, params);
    
    // 🔧 映射品牌异常数据结构
    const brandExceptions = result.rows.map(row => ({
      brandCode: row[0] || 'UNKNOWN',
      brandName: row[1] || row[0] || 'UNKNOWN',
      orderCount: row[2] || 0,
      pickedCount: row[3] || 0,
      shippedCount: row[4] || 0,
      deliveredCount: row[5] || 0,
      // 四种核心异常类型
      pickupTimeout: row[6] || 0,
      shippingTimeout: row[7] || 0,
      deliveryTimeout: row[8] || 0,
      noUpdate48h: row[9] || 0,
      totalExceptions: row[10] || 0,
      // 各阶段成功率
      pickupRate: row[11] || 0,
      shippingRate: row[12] || 0,
      deliveryRate: row[13] || 0,
      exceptionRate: row[14] || 0,
      avgDeliveryTime: row[15] || 0,
      // 兼容字段名
      pickup_timeout: row[6] || 0,
      shipping_timeout: row[7] || 0,
      delivery_timeout: row[8] || 0,
      no_update_48h: row[9] || 0
    }));

    console.log('✅ [Logistics-Brands] 品牌物流异常数据查询成功:', {
      brandCount: brandExceptions.length,
      totalExceptions: brandExceptions.reduce((sum, brand) => sum + brand.totalExceptions, 0)
    });

    const payload = {
      success: true,
      data: {
        brandExceptions: brandExceptions,
        summary: {
          totalBrands: brandExceptions.length,
          totalOrders: brandExceptions.reduce((sum, brand) => sum + brand.orderCount, 0),
          totalExceptions: brandExceptions.reduce((sum, brand) => sum + brand.totalExceptions, 0),
          avgExceptionRate: brandExceptions.length > 0 
            ? Math.round((brandExceptions.reduce((sum, brand) => sum + brand.exceptionRate, 0) / brandExceptions.length) * 100) / 100
            : 0
        }
      },
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        platform: platform || 'all',
        selfFlag: selfFlag || 'Y'
      }
    };

    setLogisticsCache(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error('品牌物流异常数据查询失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取品牌物流异常数据失败' });
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
 * 获取快递商性能统计
 * GET /api/logistics/couriers
 */
router.get('/couriers', async (req, res) => {
  let connection;
  const cacheKey = buildLogisticsCacheKey(req, 'couriers');
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag } = req.query;
    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
    
    console.log('🔄 [Logistics-Couriers查询] 收到请求参数:', { dateFrom, dateTo, brand, platform, selfFlag });
    
    if (!dateFrom || !dateTo) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '缺少必需的日期参数',
        details: { requiredFields: ['dateFrom', 'dateTo'] }
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '日期格式无效',
        details: { expectedFormat: 'YYYY-MM-DD' }
      });
    }

    const cached = getLogisticsCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    connection = await getConnection();
    
    // 🔧 使用统一的筛选条件构建逻辑
    const params = { dateFrom, dateTo };
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(params, brand, platform, selfFlag, authorizedCustomerNos);

    // 🔥 快递公司性能统计查询
    const couriersQuery = `
      SELECT 
        t.CARRIERID as courier_id,
        bc_carrier.COMPANY_ABNAME as courier_name,
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('70','80','85','92') THEN t.TSK_MERGE_NO END) as shipped_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS in ('95','93') THEN t.TSK_MERGE_NO END) as delivered_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '40' THEN t.TSK_MERGE_NO END) as forwarded_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('100', '105') THEN t.TSK_MERGE_NO END) as returned_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('90', '110') THEN t.TSK_MERGE_NO END) as cancelled_count,
        -- ✅ 新增：四种核心异常类型的详细统计
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) as pickup_timeout,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) as shipping_timeout,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) as delivery_timeout,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END) as no_update_48h,
        -- 总异常数（四种异常类型之和）
        (
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END)
        ) as exception_count,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_time,
        -- 各阶段成功率计算
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as pickup_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('70','80','85','92') THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as shipping_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS in ('95','93') THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as delivery_rate,
        -- 异常率（基于四种核心异常条件）
        ROUND((
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END)
        ) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as exception_rate
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      LEFT JOIN APP_CMS.BAS_COMPANY bc_carrier ON t.CARRIERID = bc_carrier.COMPANY_SYSID
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        AND t.CARRIERID IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CARRIERID, bc_carrier.COMPANY_ABNAME
      ORDER BY order_count DESC
    `;
    
    // 🔍 调试：打印完整SQL和参数
    console.log('📝 [Logistics-Couriers] 完整SQL查询:');
    console.log(couriersQuery);
    console.log('📝 [Logistics-Couriers] 查询参数:', params);

    const result = await connection.execute(couriersQuery, params);
    
    // 🔍 调试：打印原始SQL结果
    console.log('📊 [Logistics-Couriers] SQL查询结果行数:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('📊 [Logistics-Couriers] 第一行原始数据 (ZTO):', result.rows[0]);
      console.log('📊 [Logistics-Couriers] 字段位置: row[8]=pickupTimeout, row[9]=shippingTimeout, row[10]=deliveryTimeout, row[11]=noUpdate48h');
    }
    
    const couriersData = result.rows.map(row => ({
      carrierId: row[0] || 'UNKNOWN',
      carrierName: row[1] || row[0] || 'UNKNOWN',
      orderCount: row[2] || 0,
      pickedCount: row[3] || 0,
      shippedCount: row[4] || 0,
      deliveredCount: row[5] || 0,
      forwardedCount: row[6] || 0,
      returnedCount: row[7] || 0,
      cancelledCount: row[8] || 0,
      // ✅ 修复：四种异常类型的正确映射
      pickupTimeout: row[9] || 0,       // pickup_timeout
      shippingTimeout: row[10] || 0,    // shipping_timeout  
      deliveryTimeout: row[11] || 0,    // delivery_timeout
      noUpdate48h: row[12] || 0,        // no_update_48h
      // 总异常数和其他指标
      exceptionCount: row[13] || 0,     // exception_count (四种异常之和)
      avgDeliveryTime: row[14] || 0,    // avg_delivery_time
      pickupRate: row[15] || 0,         // pickup_rate
      shippingRate: row[16] || 0,       // shipping_rate
      deliveryRate: row[17] || 0,       // delivery_rate
      exceptionRate: row[18] || 0,      // exception_rate
      // 兼容旧字段名
      totalOrders: row[2] || 0,
      pickedOrders: row[3] || 0,
      shippedOrders: row[4] || 0,
      deliveredOrders: row[5] || 0,
      exceptionOrders: row[13] || 0,
      avgDeliveryHours: row[14] || 0,
      // ✅ 新增：前端需要的异常字段别名（支持多种命名格式）
      pickup_timeout: row[9] || 0,
      shipping_timeout: row[10] || 0,
      delivery_timeout: row[11] || 0,
      no_update_48h: row[12] || 0,
      // ✅ 兼容CourierMonitoring组件中的旧字段名
      timeout48hOrders: row[12] || 0,      // 超48h未更新
      notPickedOver2h: row[9] || 0,        // 超时未揽收
      notShippedOver12h: row[10] || 0,     // 超时未发运
      notUpdatedOver48h: row[12] || 0,     // 超48h未更新（另一个别名）
      notDeliveredOver3days: row[11] || 0  // 超时未签收
    }));

    const payload = {
      success: true,
      data: couriersData,
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        platform: platform || 'all',
        selfFlag: selfFlag || 'Y'
      }
    };

    setLogisticsCache(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error('快递商性能查询失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取快递商性能数据失败' });
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
 * 获取快递商状态分布统计
 * GET /api/logistics/status-distribution
 */
router.get('/status-distribution', async (req, res) => {
  let connection;
  const cacheKey = buildLogisticsCacheKey(req, 'status-distribution');
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag } = req.query;
    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
    
    if (!dateFrom || !dateTo) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '缺少必需的日期参数',
        details: { requiredFields: ['dateFrom', 'dateTo'] }
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '日期格式无效',
        details: { expectedFormat: 'YYYY-MM-DD' }
      });
    }

    const cached = getLogisticsCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    connection = await getConnection();
    
    // 🔧 使用统一的筛选条件构建逻辑
    const params = { dateFrom, dateTo };
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(params, brand, platform, selfFlag, authorizedCustomerNos);

    const statusDistributionQuery = `
      SELECT 
        t.CARRIERID,
        bc_carrier.COMPANY_ABNAME as carrier_name,
        t.DIS_STATUS,
        bs.CODENAME_C as status_name,
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        ROUND(
          COUNT(DISTINCT t.TSK_MERGE_NO) * 100.0 / 
          SUM(COUNT(DISTINCT t.TSK_MERGE_NO)) OVER (PARTITION BY t.CARRIERID),
          2
        ) as status_percentage
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_CODES bs ON t.DIS_STATUS = bs.CODE AND bs.CODEID = 'BL_STATUS'
      LEFT JOIN APP_CMS.BAS_COMPANY bc_carrier ON t.CARRIERID = bc_carrier.COMPANY_SYSID
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        AND t.CARRIERID IS NOT NULL
        AND t.DIS_STATUS IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CARRIERID, bc_carrier.COMPANY_ABNAME, t.DIS_STATUS, bs.CODENAME_C
      ORDER BY t.CARRIERID, t.DIS_STATUS
    `;

    const result = await connection.execute(statusDistributionQuery, params);
    const statusData = result.rows.map(row => ({
      carrierId: row[0],
      carrierName: row[1] || row[0],
      statusCode: row[2],
      statusName: row[3],
      orderCount: row[4],
      statusPercentage: row[5] || 0
    }));

    // 按快递公司分组整理数据
    const courierStatusMap = {};
    statusData.forEach(item => {
      if (!courierStatusMap[item.carrierId]) {
        courierStatusMap[item.carrierId] = {
          carrierId: item.carrierId,
          carrierName: item.carrierName,
          totalOrders: 0,
          statusDistribution: [],
          pickedOrders: 0,
          shippedOrders: 0,
          deliveredOrders: 0,
          exceptionOrders: 0
        };
      }
      
      courierStatusMap[item.carrierId].totalOrders += item.orderCount;
      courierStatusMap[item.carrierId].statusDistribution.push(item);
      
      const statusCode = String(item.statusCode);
      
      if (statusCode === '95') {
        courierStatusMap[item.carrierId].deliveredOrders += item.orderCount;
      }
      if (statusCode === '55') {
        courierStatusMap[item.carrierId].pickedOrders += item.orderCount;
      }
      if (statusCode === '70' || statusCode === '80' || statusCode === '85' || statusCode === '92') {
        courierStatusMap[item.carrierId].shippedOrders += item.orderCount;
      }
    });

    // 计算各项指标率
    const courierStats = Object.values(courierStatusMap).map(courier => {
      const pickupRate = courier.totalOrders > 0 
        ? Math.round((courier.pickedOrders / courier.totalOrders) * 100 * 100) / 100
        : 0;
        
      const shippingRate = courier.totalOrders > 0 
        ? Math.round((courier.shippedOrders / courier.totalOrders) * 100 * 100) / 100
        : 0;
        
      const deliveryRate = courier.totalOrders > 0 
        ? Math.round((courier.deliveredOrders / courier.totalOrders) * 100 * 100) / 100
        : 0;
        
      const exceptionRate = courier.totalOrders > 0 
        ? Math.round((courier.exceptionOrders / courier.totalOrders) * 100 * 100) / 100
        : 0;

      return {
        ...courier,
        pickupRate,
        shippingRate, 
        deliveryRate,
        exceptionRate
      };
    });

    const payload = {
      success: true,
      data: {
        courierStats,
        detailedDistribution: statusData
      },
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        platform: platform || 'all',
        selfFlag: selfFlag || 'Y'
      }
    };

    setLogisticsCache(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error('状态分布查询失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取状态分布数据失败' });
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
 * 获取重量分布分析  
 * GET /api/logistics/weight-distribution
 */
router.get('/weight-distribution', async (req, res) => {
  let connection;
  const cacheKey = buildLogisticsCacheKey(req, 'weight-distribution');
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag } = req.query;
    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
    
    if (!dateFrom || !dateTo) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '缺少必需的日期参数',
        details: { requiredFields: ['dateFrom', 'dateTo'] }
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '日期格式无效',
        details: { expectedFormat: 'YYYY-MM-DD' }
      });
    }

    const cached = getLogisticsCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    connection = await getConnection();
    
    // 🔧 使用统一的筛选条件构建逻辑
    const params = { dateFrom, dateTo };
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(params, brand, platform, selfFlag, authorizedCustomerNos);

    const weightQuery = `
      WITH weight_categories AS (
        SELECT 
          t.TSK_MERGE_NO,
          t.T_GROSSWEIGHT,
          t.T_CUBIC,
          t.CAL_TON_AR,
          t.CAL_TON_AP,
          t.DIS_STATUS,
          t.SUM_SEND_TIME2,
          t.CARRIERID,
          t.WMS_OUTBOUND_TIME,
          t.DISP_TIME,
          v.IS_48H,
          v.IF_DELAY,
          v.DIS_STATUS as view_dis_status,
          -- 重量分类
          CASE 
            WHEN t.T_GROSSWEIGHT <= 0.5 THEN '0-0.5kg'
            WHEN t.T_GROSSWEIGHT <= 1.0 THEN '0.5-1kg'
            WHEN t.T_GROSSWEIGHT <= 2.0 THEN '1-2kg'
            WHEN t.T_GROSSWEIGHT <= 3.0 THEN '2-3kg'
            WHEN t.T_GROSSWEIGHT <= 5.0 THEN '3-5kg'
            WHEN t.T_GROSSWEIGHT <= 10.0 THEN '5-10kg'
            WHEN t.T_GROSSWEIGHT <= 20.0 THEN '10-20kg'
            ELSE '20kg+'
          END as weight_category
        FROM APP_CMS.TSK_LIST_TASK t
        LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
        ${QueryUtils.BASE_WHERE_CONDITIONS}
          AND t.T_GROSSWEIGHT IS NOT NULL
          AND t.T_GROSSWEIGHT > 0
          ${brandFilter}
          ${platformFilter}
          ${selfFlagFilter}
      )
      SELECT 
        weight_category,
        COUNT(*) as order_count,
        COUNT(CASE WHEN DIS_STATUS in ('95','93') THEN 1 END) as delivered_count,
        -- 异常数量（基于四种核心异常条件）
        (COUNT(CASE WHEN DIS_STATUS = '00' AND WMS_OUTBOUND_TIME IS NOT NULL 
                    AND (SYSDATE - WMS_OUTBOUND_TIME) * 24 > 2 THEN 1 END) +
         COUNT(CASE WHEN DIS_STATUS = '55' AND WMS_OUTBOUND_TIME IS NOT NULL 
                    AND (SYSDATE - WMS_OUTBOUND_TIME) * 24 > 12 THEN 1 END) +
         COUNT(CASE WHEN IF_DELAY = 'Y' THEN 1 END) +
         COUNT(CASE WHEN ${buildNoUpdate48hCondition('IS_48H', 'view_dis_status')} THEN 1 END)) as exception_count,
        ROUND(AVG(T_GROSSWEIGHT), 3) as avg_weight,
        ROUND(AVG(T_CUBIC), 6) as avg_volume,
        ROUND(AVG(CAL_TON_AR), 3) as avg_chargeable_weight_ar,
        ROUND(AVG(CAL_TON_AP), 3) as avg_chargeable_weight_ap,
        ROUND(AVG(CASE WHEN SUM_SEND_TIME2 IS NOT NULL AND SUM_SEND_TIME2 > 0 THEN SUM_SEND_TIME2 END), 2) as avg_delivery_time,
        ROUND(COUNT(CASE WHEN DIS_STATUS in ('95','93') THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate
      FROM weight_categories
      GROUP BY weight_category
      ORDER BY 
        CASE weight_category
          WHEN '0-0.5kg' THEN 1
          WHEN '0.5-1kg' THEN 2
          WHEN '1-2kg' THEN 3
          WHEN '2-3kg' THEN 4
          WHEN '3-5kg' THEN 5
          WHEN '5-10kg' THEN 6
          WHEN '10-20kg' THEN 7
          WHEN '20kg+' THEN 8
        END
    `;

    const result = await connection.execute(weightQuery, params);
    const weightData = result.rows.map(row => ({
      weightCategory: row[0],
      orderCount: row[1],
      deliveredCount: row[2],
      exceptionCount: row[3],
      avgWeight: row[4] || 0,
      avgVolume: row[5] || 0,
      avgChargeableWeightAR: row[6] || 0,
      avgChargeableWeightAP: row[7] || 0,
      avgDeliveryTime: row[8] || 0,
      deliveryRate: row[9] || 0,
      exceptionRate: row[1] > 0 ? Math.round((row[3] / row[1]) * 100 * 100) / 100 : 0
    }));

    const payload = {
      success: true,
      data: weightData,
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        platform: platform || 'all',
        selfFlag: selfFlag || 'Y'
      }
    };

    setLogisticsCache(cacheKey, payload);
    res.json(payload);

  } catch (error) {
    console.error('重量分布查询失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取重量分布数据失败' });
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
 * 转寄分析API (Forwarding Analysis)
 * GET /api/logistics/forwarding
 * 
 * 功能：统计改地址订单和超区转寄订单
 * 
 * 查询参数:
 * - startDate: 开始日期 (必需, 格式: YYYY-MM-DD)
 * - endDate: 结束日期 (必需, 格式: YYYY-MM-DD)
 * - brand: 品牌筛选 (可选)
 * - platform: 平台筛选 (可选)
 * - selfFlag: 自管筛选 (可选)
 * 
 * 返回数据:
 * {
 *   success: true,
 *   data: {
 *     addressChange: { totalCount, percentage, byCourier[] },
 *     outOfRange: { totalCount, percentage, byCourier[], byProvince[] }
 *   }
 * }
 */
router.get('/forwarding', async (req, res) => {
  let connection;
  
  try {
    const { startDate, endDate, brand, platform, selfFlag } = req.query;
    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
    
    console.log('🔁 [Forwarding API] 接收请求参数:', { startDate, endDate, brand, platform, selfFlag, authorizedCustomerNos });
    
    // 参数验证
    if (!startDate || !endDate) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '缺少必需参数',
        details: { requiredFields: ['startDate', 'endDate'] }
      });
    }
    
    connection = await getConnection();
    
    // ===== 1. 获取总订单数 (用于计算占比) =====
    const queryParams = { 
      startDate, 
      endDate 
    };
    
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(
      queryParams, 
      brand, 
      platform, 
      selfFlag,
      authorizedCustomerNos
    );
    
    const totalOrdersSql = `
      SELECT COUNT(*) as TOTAL_COUNT
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      WHERE t.WMS_OUTBOUND_TIME >= ${dateBoundarySql('startDate')}
        AND t.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('endDate')}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
    `;
    
    const totalResult = await connection.execute(totalOrdersSql, queryParams, {
      outFormat: require('oracledb').OUT_FORMAT_OBJECT
    });
    
    const totalOrders = totalResult.rows[0]?.TOTAL_COUNT || 0;
    console.log(`📊 [Forwarding API] 总订单数: ${totalOrders}`);
    
    // ===== 2. 改地订单统计 (WITH快递商名称) =====
    const addressChangeSql = `
      SELECT 
        t.CARRIERID,
        bc.COMPANY_ABNAME as COURIER_NAME,
        COUNT(*) as COUNT
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CARRIERID = bc.COMPANY_SYSID
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      WHERE t.TR_FLAG = 'Y'
      
        AND t.WMS_OUTBOUND_TIME >= ${dateBoundarySql('startDate')}
        AND t.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('endDate')}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CARRIERID, bc.COMPANY_ABNAME
      ORDER BY COUNT DESC
    `;
    
    const addressChangeResult = await connection.execute(addressChangeSql, queryParams, {
      outFormat: require('oracledb').OUT_FORMAT_OBJECT
    });
    
    const addressChangeTotalCount = addressChangeResult.rows.reduce((sum, row) => sum + (row.COUNT || 0), 0);
    const addressChangePercentage = totalOrders > 0 ? ((addressChangeTotalCount / totalOrders) * 100).toFixed(2) : 0;
    
    const addressChangeByCourier = addressChangeResult.rows.map(row => ({
      courier: row.CARRIERID,
      courierName: row.COURIER_NAME || row.CARRIERID, // 使用数据库查询的名称，回退到代码
      count: row.COUNT,
      percentage: addressChangeTotalCount > 0 ? ((row.COUNT / addressChangeTotalCount) * 100).toFixed(1) : 0
    }));
    
    console.log(`📦 [Forwarding API] 改地址订单: ${addressChangeTotalCount} (${addressChangePercentage}%)`);
    
    // ===== 3. 超区转寄订单统计 (按快递商，WITH快递商名称) =====
    const outOfRangeByCourierSql = `
      SELECT 
        t.CARRIERID,
        bc.COMPANY_ABNAME as COURIER_NAME,
        COUNT(*) as COUNT
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CARRIERID = bc.COMPANY_SYSID
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      WHERE t.TR_FLAG2 = 'Y'
        AND t.WMS_OUTBOUND_TIME >= ${dateBoundarySql('startDate')}
        AND t.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('endDate')}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CARRIERID, bc.COMPANY_ABNAME
      ORDER BY COUNT DESC
    `;
    
    const outOfRangeByCourierResult = await connection.execute(outOfRangeByCourierSql, queryParams, {
      outFormat: require('oracledb').OUT_FORMAT_OBJECT
    });
    
    const outOfRangeTotalCount = outOfRangeByCourierResult.rows.reduce((sum, row) => sum + (row.COUNT || 0), 0);
    const outOfRangePercentage = totalOrders > 0 ? ((outOfRangeTotalCount / totalOrders) * 100).toFixed(2) : 0;
    
    const outOfRangeByCourier = outOfRangeByCourierResult.rows.map(row => ({
      courier: row.CARRIERID,
      courierName: row.COURIER_NAME || row.CARRIERID, // 使用数据库查询的名称，回退到代码
      count: row.COUNT,
      percentage: outOfRangeTotalCount > 0 ? ((row.COUNT / outOfRangeTotalCount) * 100).toFixed(1) : 0
    }));
    
    console.log(`🚚 [Forwarding API] 超区转寄订单: ${outOfRangeTotalCount} (${outOfRangePercentage}%)`);
    
    // ===== 4. 超区转寄订单统计 (按快递商+省份，WITH快递商名称) =====
    const outOfRangeByProvinceSql = `
      WITH courier_totals AS (
        SELECT 
          t.CARRIERID,
          COUNT(*) as COURIER_TOTAL
        FROM APP_CMS.TSK_LIST_TASK t
        LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
        WHERE t.TR_FLAG2 = 'Y'
          AND t.WMS_OUTBOUND_TIME >= ${dateBoundarySql('startDate')}
          AND t.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('endDate')}
          ${brandFilter}
          ${platformFilter}
          ${selfFlagFilter}
        GROUP BY t.CARRIERID
      )
      SELECT 
        t.CARRIERID,
        bc.COMPANY_ABNAME as COURIER_NAME,
        a.AREA_NAME,
        COUNT(*) as COUNT,
        ROUND(COUNT(*) * 100.0 / ct.COURIER_TOTAL, 2) as PERCENTAGE
      FROM APP_CMS.TSK_LIST_TASK t
      JOIN courier_totals ct ON t.CARRIERID = ct.CARRIERID
      LEFT JOIN APP_CMS.BAS_AREA a ON t.DEST_PROVINCE = a.AREA_ID
      LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CARRIERID = bc.COMPANY_SYSID
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      WHERE t.TR_FLAG2 = 'Y'
        AND t.WMS_OUTBOUND_TIME >= ${dateBoundarySql('startDate')}
        AND t.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('endDate')}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CARRIERID, bc.COMPANY_ABNAME, a.AREA_NAME, ct.COURIER_TOTAL
      ORDER BY t.CARRIERID, COUNT DESC
    `;
    
    const outOfRangeByProvinceResult = await connection.execute(outOfRangeByProvinceSql, queryParams, {
      outFormat: require('oracledb').OUT_FORMAT_OBJECT
    });
    
    const outOfRangeByProvince = outOfRangeByProvinceResult.rows.map(row => ({
      courier: row.CARRIERID,
      courierName: row.COURIER_NAME || row.CARRIERID, // 使用数据库查询的名称，回退到代码
      province: row.AREA_NAME || '未知',
      destProvince: row.AREA_NAME || '未知',
      count: row.COUNT,
      percentage: row.PERCENTAGE
    }));
    
    console.log(`📍 [Forwarding API] 超区转寄省份统计: ${outOfRangeByProvince.length}条记录`);
    
    // 返回结果
    res.json({
      success: true,
      data: {
        addressChange: {
          totalCount: addressChangeTotalCount,
          percentage: parseFloat(addressChangePercentage),
          byCourier: addressChangeByCourier
        },
        outOfRange: {
          totalCount: outOfRangeTotalCount,
          percentage: parseFloat(outOfRangePercentage),
          byCourier: outOfRangeByCourier,
          byProvince: outOfRangeByProvince
        }
      },
      filters: {
        dateFrom: startDate,
        dateTo: endDate,
        brand: brand || 'all',
        platform: platform || 'all',
        selfFlag: selfFlag || 'all'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [Forwarding API] 转寄分析查询失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取转寄分析数据失败' });
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
 * 🆕 拦截分析API
 * GET /api/logistics/interception
 * 
 * 业务说明:
 * - DOC_COMPLAINT表存储拦截订单数据
 * - TSK_MERGE_NO为快递单号，关联两表
 * - PROCESS_FLAG='Y'表示拦截成功
 * - 完结用时 = PROCESS_DATE2 - REQUEST_TIME (小时)
 * - 库内拦截: DIS_STATUS = 90
 * - 库外拦截: DIS_STATUS != 90
 * 
 * 查询参数:
 * - startDate: 开始日期 (必需)
 * - endDate: 结束日期 (必需)
 * - brand: 品牌代码 (可选)
 * - platform: 平台名称 (可选)
 * - selfFlag: 自管标识 (可选)
 * - interceptionStatus: 拦截状态 (可选: success/failed/all)
 * - interceptLocation: 拦截位置 (可选: warehouse/external/all)
 */
router.get('/interception', async (req, res) => {
  console.log('\n📦 ========================================');
  console.log('🛑 拦截分析查询请求');
  console.log('========================================');
  
  const { 
    startDate, 
    endDate, 
    brand, 
    platform, 
    selfFlag,
    interceptionStatus = 'all',
    interceptLocation = 'all',
  } = req.query;
  const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
  
  console.log('📋 查询参数:', {
    startDate,
    endDate,
    brand,
    platform,
    selfFlag,
    interceptionStatus,
    interceptLocation,
    authorizedCustomerNos
  });

  // 参数验证
  if (!startDate || !endDate) {
    return sendError(res, req, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      error: '缺少必需参数：startDate 和 endDate',
      details: { requiredFields: ['startDate', 'endDate'] }
    });
  }

  let connection;

  try {
    connection = await getConnection();
    console.log('✅ 数据库连接成功');
    
      // 🔧 使用统一的筛选条件构建逻辑（基于登录态品牌范围）
    const queryParams = { startDate, endDate };
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(
      queryParams, 
      brand, 
      platform, 
      selfFlag,
      authorizedCustomerNos
    );
    
    // 🔥 拦截分析特殊处理：将表别名从 t. 替换为 tsk.
    // 因为拦截分析使用 TSK_LIST_TASK 的别名是 tsk，而不是 t
    const tskBrandFilter = brandFilter.replace(/t\./g, 'tsk.');
    const tskPlatformFilter = platformFilter.replace(/v\./g, 'tsk_view.').replace(/t\./g, 'tsk.');
    const tskSelfFlagFilter = selfFlagFilter.replace(/t\./g, 'tsk.');
    
    console.log('🔍 替换后的筛选条件:', {
      brandFilter: tskBrandFilter,
      platformFilter: tskPlatformFilter,
      selfFlagFilter: tskSelfFlagFilter
    });

    // 拦截状态筛选
    let interceptionStatusFilter = '';
    if (interceptionStatus === 'success') {
      interceptionStatusFilter = ` AND dc.PROCESS_FLAG = 'Y'`;
    } else if (interceptionStatus === 'failed') {
      interceptionStatusFilter = ` AND dc.PROCESS_FLAG = 'N'`;
    }

    // 拦截位置筛选
    let interceptLocationFilter = '';
    if (interceptLocation === 'warehouse') {
      interceptLocationFilter = ` AND tsk.DIS_STATUS = 90`;
    } else if (interceptLocation === 'external') {
      interceptLocationFilter = ` AND tsk.DIS_STATUS != 90`;
    }

    // 组合所有筛选条件
    const whereClause = `tsk.WMS_OUTBOUND_TIME >= ${dateBoundarySql('startDate')}
      AND tsk.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('endDate')}
      AND dc.PROCESS_FLAG IN ('Y','N')
      ${tskBrandFilter}
      ${tskPlatformFilter}
      ${tskSelfFlagFilter}
      ${interceptionStatusFilter}
      ${interceptLocationFilter}`;

    console.log('🔍 WHERE条件:', whereClause);
    console.log('🔍 绑定参数:', queryParams);

    // ==========================================
    // 查询1: 拦截统计概览
    // ==========================================
    const overviewQuery = `
      SELECT 
        COUNT(DISTINCT dc.TSK_MERGE_NO) as total_count,
        COUNT(DISTINCT CASE WHEN dc.PROCESS_FLAG = 'Y' THEN dc.TSK_MERGE_NO END) as success_count,
        COUNT(DISTINCT CASE WHEN dc.PROCESS_FLAG = 'N' THEN dc.TSK_MERGE_NO END) as failed_count,
        ROUND(
          COUNT(DISTINCT CASE WHEN dc.PROCESS_FLAG = 'Y' THEN dc.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT dc.TSK_MERGE_NO), 0),
          2
        ) as success_rate,
        COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS = 90 THEN dc.TSK_MERGE_NO END) as warehouse_count,
        COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS != 90 THEN dc.TSK_MERGE_NO END) as external_count,
        COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS = 90 AND dc.PROCESS_FLAG = 'Y' THEN dc.TSK_MERGE_NO END) as warehouse_success_count,
        COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS != 90 AND dc.PROCESS_FLAG = 'Y' THEN dc.TSK_MERGE_NO END) as external_success_count,
        ROUND(
          COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS = 90 THEN dc.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT dc.TSK_MERGE_NO), 0),
          2
        ) as warehouse_rate,
        ROUND(
          COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS = 90 AND dc.PROCESS_FLAG = 'Y' THEN dc.TSK_MERGE_NO END) * 100.0 /
          NULLIF(COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS = 90 THEN dc.TSK_MERGE_NO END), 0),
          2
        ) as warehouse_success_rate,
        ROUND(
          COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS != 90 AND dc.PROCESS_FLAG = 'Y' THEN dc.TSK_MERGE_NO END) * 100.0 /
          NULLIF(COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS != 90 THEN dc.TSK_MERGE_NO END), 0),
          2
        ) as external_success_rate,
        ROUND(
          AVG(
            CASE 
              WHEN dc.PROCESS_DATE2 IS NOT NULL AND dc.REQUEST_TIME IS NOT NULL
              THEN (dc.PROCESS_DATE2 - dc.REQUEST_TIME) * 24
              ELSE NULL
            END
          ),
          1
        ) as avg_completion_hours,
        ROUND(
          AVG(
            CASE 
              WHEN tsk.DIS_STATUS = 90 
                AND dc.PROCESS_DATE2 IS NOT NULL 
                AND dc.REQUEST_TIME IS NOT NULL
              THEN (dc.PROCESS_DATE2 - dc.REQUEST_TIME) * 24
              ELSE NULL
            END
          ),
          1
        ) as warehouse_avg_hours,
        ROUND(
          AVG(
            CASE 
              WHEN tsk.DIS_STATUS != 90 
                AND dc.PROCESS_DATE2 IS NOT NULL 
                AND dc.REQUEST_TIME IS NOT NULL
              THEN (dc.PROCESS_DATE2 - dc.REQUEST_TIME) * 24
              ELSE NULL
            END
          ),
          1
        ) as external_avg_hours
      FROM APP_CMS.DOC_COMPLAINT dc
      INNER JOIN APP_CMS.TSK_LIST_TASK tsk 
        ON dc.TSK_MERGE_NO = tsk.TSK_MERGE_NO
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK tsk_view
        ON tsk.TSK_MERGE_NO = tsk_view.TSK_MERGE_NO
      WHERE ${whereClause}

    `;

    console.log('📊 执行拦截统计概览查询...');
    const overviewResult = await connection.execute(overviewQuery, queryParams);
    
    const overview = {
      totalCount: overviewResult.rows[0][0] || 0,
      successCount: overviewResult.rows[0][1] || 0,
      failedCount: overviewResult.rows[0][2] || 0,
      successRate: overviewResult.rows[0][3] || 0,
      warehouseCount: overviewResult.rows[0][4] || 0,
      externalCount: overviewResult.rows[0][5] || 0,
      warehouseSuccessCount: overviewResult.rows[0][6] || 0,
      externalSuccessCount: overviewResult.rows[0][7] || 0,
      warehouseRate: overviewResult.rows[0][8] || 0,
      warehouseSuccessRate: overviewResult.rows[0][9] || 0,
      externalSuccessRate: overviewResult.rows[0][10] || 0,
      avgCompletionHours: overviewResult.rows[0][11] || 0,
      warehouseAvgHours: overviewResult.rows[0][12] || 0,
      externalAvgHours: overviewResult.rows[0][13] || 0
    };

    console.log('✅ 拦截统计概览:', overview);

    // ==========================================
    // 查询2: 按快递商统计
    // ==========================================
    const carrierStatsQuery = `
      WITH interception_base AS (
        SELECT DISTINCT
          dc.TSK_MERGE_NO,
          tsk.CARRIERID,
          bc_carrier.COMPANY_ABNAME as CARRIER_NAME,
          tsk.DIS_STATUS,
          dc.PROCESS_FLAG,
          CASE
            WHEN dc.PROCESS_DATE2 IS NOT NULL AND dc.REQUEST_TIME IS NOT NULL
            THEN (dc.PROCESS_DATE2 - dc.REQUEST_TIME) * 24
            ELSE NULL
          END as completion_hours
        FROM APP_CMS.DOC_COMPLAINT dc
        INNER JOIN APP_CMS.TSK_LIST_TASK tsk 
          ON dc.TSK_MERGE_NO = tsk.TSK_MERGE_NO
        LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK tsk_view
          ON tsk.TSK_MERGE_NO = tsk_view.TSK_MERGE_NO
        LEFT JOIN APP_CMS.BAS_COMPANY bc_carrier
          ON tsk.CARRIERID = bc_carrier.COMPANY_SYSID
        WHERE ${whereClause}
      )
      SELECT 
        CARRIERID as carrier_id,
        CARRIER_NAME as carrier_name,
        COUNT(DISTINCT TSK_MERGE_NO) as total_count,
        COUNT(DISTINCT CASE WHEN PROCESS_FLAG = 'Y' THEN TSK_MERGE_NO END) as success_count,
        COUNT(DISTINCT CASE WHEN PROCESS_FLAG = 'N' THEN TSK_MERGE_NO END) as failed_count,
        ROUND(
          COUNT(DISTINCT CASE WHEN PROCESS_FLAG = 'Y' THEN TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT TSK_MERGE_NO), 0),
          2
        ) as success_rate,
        COUNT(DISTINCT CASE WHEN DIS_STATUS = 90 THEN TSK_MERGE_NO END) as warehouse_count,
        COUNT(DISTINCT CASE WHEN DIS_STATUS != 90 THEN TSK_MERGE_NO END) as external_count,
        COUNT(DISTINCT CASE WHEN DIS_STATUS = 90 AND PROCESS_FLAG = 'Y' THEN TSK_MERGE_NO END) as warehouse_success_count,
        COUNT(DISTINCT CASE WHEN DIS_STATUS != 90 AND PROCESS_FLAG = 'Y' THEN TSK_MERGE_NO END) as external_success_count,
        ROUND(
          COUNT(DISTINCT CASE WHEN DIS_STATUS = 90 AND PROCESS_FLAG = 'Y' THEN TSK_MERGE_NO END) * 100.0 /
          NULLIF(COUNT(DISTINCT CASE WHEN DIS_STATUS = 90 THEN TSK_MERGE_NO END), 0),
          2
        ) as warehouse_success_rate,
        ROUND(
          COUNT(DISTINCT CASE WHEN DIS_STATUS != 90 AND PROCESS_FLAG = 'Y' THEN TSK_MERGE_NO END) * 100.0 /
          NULLIF(COUNT(DISTINCT CASE WHEN DIS_STATUS != 90 THEN TSK_MERGE_NO END), 0),
          2
        ) as external_success_rate,
        ROUND(
          AVG(CASE WHEN PROCESS_FLAG = 'Y' THEN completion_hours END),
          1
        ) as avg_completion_hours,
        ROUND(
          AVG(CASE WHEN DIS_STATUS = 90 AND PROCESS_FLAG = 'Y' THEN completion_hours END),
          1
        ) as warehouse_avg_hours,
        ROUND(
          AVG(CASE WHEN DIS_STATUS != 90 AND PROCESS_FLAG = 'Y' THEN completion_hours END),
          1
        ) as external_avg_hours
      FROM interception_base
      GROUP BY CARRIERID, CARRIER_NAME
      ORDER BY total_count DESC
    `;
    
    // 🔍 调试：打印完整SQL和参数
    console.log('📝 [Logistics-Interception] 完整SQL查询:');
    console.log(carrierStatsQuery);
    console.log('📝 [Logistics-Interception] 查询参数:', queryParams);

    const carrierStatsResult = await connection.execute(carrierStatsQuery, queryParams);

    const carrierStats = carrierStatsResult.rows.map(row => ({
      carrierId: row[0],
      carrierName: row[1] || row[0],
      totalCount: row[2] || 0,
      successCount: row[3] || 0,
      failedCount: row[4] || 0,
      successRate: row[5] || 0,
      warehouseCount: row[6] || 0,
      externalCount: row[7] || 0,
      warehouseSuccessCount: row[8] || 0,
      externalSuccessCount: row[9] || 0,
      warehouseSuccessRate: row[10] || 0,
      externalSuccessRate: row[11] || 0,
      avgCompletionHours: row[12] || 0,
      warehouseAvgHours: row[13] || 0,
      externalAvgHours: row[14] || 0
    }));

    console.log(`✅ 按快递商统计 (${carrierStats.length}条记录)`);

    // ==========================================
    // 查询3: 按品牌统计
    // ==========================================
    const brandStatsQuery = `
      SELECT 
        tsk.CUSTOMERNO as brand_code,
        bc.COMPANY_ABNAME as brand_name,
        COUNT(DISTINCT dc.TSK_MERGE_NO) as total_count,
        COUNT(DISTINCT CASE WHEN dc.PROCESS_FLAG = 'Y' THEN dc.TSK_MERGE_NO END) as success_count,
        COUNT(DISTINCT CASE WHEN dc.PROCESS_FLAG = 'N' THEN dc.TSK_MERGE_NO END) as failed_count,
        ROUND(
          COUNT(DISTINCT CASE WHEN dc.PROCESS_FLAG = 'Y' THEN dc.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT dc.TSK_MERGE_NO), 0),
          2
        ) as success_rate,
        COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS = 90 THEN dc.TSK_MERGE_NO END) as warehouse_count,
        COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS != 90 THEN dc.TSK_MERGE_NO END) as external_count
      FROM APP_CMS.DOC_COMPLAINT dc
      INNER JOIN APP_CMS.TSK_LIST_TASK tsk 
        ON dc.TSK_MERGE_NO = tsk.TSK_MERGE_NO
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK tsk_view
        ON tsk.TSK_MERGE_NO = tsk_view.TSK_MERGE_NO
      LEFT JOIN APP_CMS.BAS_COMPANY bc
        ON tsk.CUSTOMERNO = bc.COMPANY_SYSID
      WHERE ${whereClause}
      GROUP BY tsk.CUSTOMERNO, bc.COMPANY_ABNAME
      ORDER BY total_count DESC
    `;

    console.log('📊 执行按品牌统计查询...');
    const brandStatsResult = await connection.execute(brandStatsQuery, queryParams);

    const brandStats = brandStatsResult.rows.map(row => ({
      brandCode: row[0],
      brandName: row[1] || row[0],
      totalCount: row[2] || 0,
      successCount: row[3] || 0,
      failedCount: row[4] || 0,
      successRate: row[5] || 0,
      warehouseCount: row[6] || 0,
      externalCount: row[7] || 0
    }));

    console.log(`✅ 按品牌统计 (${brandStats.length}条记录)`);

    // ==========================================
    // 查询4: 按日期统计（趋势分析）
    // ==========================================
    const dailyTrendQuery = `
      SELECT 
        TO_CHAR(dc.REQUEST_TIME, 'YYYY-MM-DD') as date_str,
        COUNT(DISTINCT dc.TSK_MERGE_NO) as total_count,
        COUNT(DISTINCT CASE WHEN dc.PROCESS_FLAG = 'Y' THEN dc.TSK_MERGE_NO END) as success_count,
        COUNT(DISTINCT CASE WHEN dc.PROCESS_FLAG = 'N' THEN dc.TSK_MERGE_NO END) as failed_count,
        COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS = 90 THEN dc.TSK_MERGE_NO END) as warehouse_count,
        COUNT(DISTINCT CASE WHEN tsk.DIS_STATUS != 90 THEN dc.TSK_MERGE_NO END) as external_count
      FROM APP_CMS.DOC_COMPLAINT dc
      INNER JOIN APP_CMS.TSK_LIST_TASK tsk 
        ON dc.TSK_MERGE_NO = tsk.TSK_MERGE_NO
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK tsk_view
        ON tsk.TSK_MERGE_NO = tsk_view.TSK_MERGE_NO
      WHERE ${whereClause}
      GROUP BY TO_CHAR(dc.REQUEST_TIME, 'YYYY-MM-DD')
      ORDER BY date_str
    `;

    console.log('📊 执行按日期统计查询...');
    const dailyTrendResult = await connection.execute(dailyTrendQuery, queryParams);

    const dailyTrend = dailyTrendResult.rows.map(row => ({
      date: row[0],
      totalCount: row[1] || 0,
      successCount: row[2] || 0,
      failedCount: row[3] || 0,
      warehouseCount: row[4] || 0,
      externalCount: row[5] || 0
    }));

    console.log(`✅ 按日期统计 (${dailyTrend.length}条记录)`);

    // ==========================================
    // 查询5: 拦截订单明细列表（TOP 100）
    // ==========================================
    const detailQuery = `
      SELECT * FROM (
        SELECT DISTINCT
          dc.TSK_MERGE_NO as tracking_no,
          tsk.CUSTOMERNO as brand_code,
          bc.COMPANY_ABNAME as brand_name,
          tsk.CARRIERID as carrier_id,
          bc_carrier.COMPANY_ABNAME as carrier_name,
          dc.REQUEST_TIME as request_time,
          dc.PROCESS_DATE2 as complete_time,
          ROUND(
            CASE 
              WHEN dc.PROCESS_DATE2 IS NOT NULL AND dc.REQUEST_TIME IS NOT NULL
              THEN (dc.PROCESS_DATE2 - dc.REQUEST_TIME) * 24
              ELSE NULL
            END,
            1
          ) as completion_hours,
          dc.PROCESS_FLAG as process_flag,
          CASE WHEN dc.PROCESS_FLAG = 'Y' THEN '成功' ELSE '失败' END as interception_status,
          tsk.DIS_STATUS as dis_status,
          CASE WHEN tsk.DIS_STATUS = 90 THEN '库内' ELSE '库外' END as interception_location
        FROM APP_CMS.DOC_COMPLAINT dc
        INNER JOIN APP_CMS.TSK_LIST_TASK tsk 
          ON dc.TSK_MERGE_NO = tsk.TSK_MERGE_NO
        LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK tsk_view
          ON tsk.TSK_MERGE_NO = tsk_view.TSK_MERGE_NO
        LEFT JOIN APP_CMS.BAS_COMPANY bc
          ON tsk.CUSTOMERNO = bc.COMPANY_SYSID
        LEFT JOIN APP_CMS.BAS_COMPANY bc_carrier
          ON tsk.CARRIERID = bc_carrier.COMPANY_SYSID
        WHERE ${whereClause}
        ORDER BY dc.REQUEST_TIME DESC
      ) 
    `;

    console.log('📊 执行拦截订单明细查询 ...');
    const detailResult = await connection.execute(detailQuery, queryParams);

    const orderDetails = detailResult.rows.map(row => ({
      trackingNo: row[0],
      brandCode: row[1],
      brandName: row[2] || row[1],
      carrierId: row[3],
      carrierName: row[4] || row[3],
      requestTime: row[5],
      completeTime: row[6],
      completionHours: row[7],
      processFlag: row[8],
      interceptionStatus: row[9],
      disStatus: row[10],
      interceptionLocation: row[11]
    }));

    console.log(`✅ 拦截订单明细 (${orderDetails.length}条记录)`);

    // ==========================================
    // 返回完整数据
    // ==========================================
    const responseData = {
      success: true,
      data: {
        overview,
        carrierStats,
        brandStats,
        dailyTrend,
        orderDetails
      },
      query: {
        startDate,
        endDate,
        brand,
        platform,
        selfFlag,
        interceptionStatus,
        interceptLocation
      }
    };

    console.log('✅ 拦截分析查询成功');
    console.log('========================================\n');

    res.json(responseData);

  } catch (error) {
    console.error('❌ 拦截分析查询失败:', error);
    console.log('========================================\n');

    return sendRouteError(res, req, error, { fallbackError: '查询拦截数据失败' });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('⚠️  关闭数据库连接时出错:', err);
      }
    }
  }
});

// 🔥 注册订单明细子路由
const orderDetailsRouter = require('./order-details');
router.use('/order-details', orderDetailsRouter);

/**
 * 重量分析权限接口（兼容入口）
 * GET /api/logistics/weight-analysis/permissions
 */
router.get('/weight-analysis/permissions', async (req, res) => {
  let connection;

  try {
    const queryUserId = req.query.userId;
    const internalRoleIds = new Set(['WPSAMIN', 'WPSADMIN']);
    const externalRoleIds = new Set(['CUSTOMER', 'CS', 'BRAND', 'VF_BRAND', 'LFAM']);

    let userId = req.user?.userId || queryUserId;
    let roleId = String(req.user?.roleId || '').toUpperCase();
    let userName = req.user?.userName || '';

    if ((!roleId || !userName) && userId) {
      connection = await getConnection();
      const roleResult = await connection.execute(
        `
          SELECT ROLE_ID, USER_NAME_C
          FROM APP_CMS.RWSYS_USER
          WHERE UPPER(USERID) = UPPER(:userId)
        `,
        { userId }
      );

      if (roleResult.rows?.length > 0) {
        roleId = String(roleResult.rows[0][0] || '').toUpperCase();
        userName = userName || String(roleResult.rows[0][1] || '');
      }
    }

    if (!userId) {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_FAILED,
        error: '未提供用户ID'
      });
    }

    const isInternalUser = internalRoleIds.has(roleId) || Boolean(req.user?.isAdmin);
    const isExternalUser = externalRoleIds.has(roleId) || !isInternalUser;

    return res.json({
      success: true,
      data: {
        userId,
        userName,
        roleId,
        isInternalUser,
        isExternalUser,
        allowedWeightTypes: isInternalUser ? ['payable', 'receivable'] : ['receivable'],
        defaultWeightType: 'receivable'
      }
    });
  } catch (error) {
    console.error('❌ [Logistics] 重量分析权限查询失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取重量分析权限失败' });
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