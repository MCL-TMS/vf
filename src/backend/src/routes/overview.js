/**
 * VF物流数据分析平台 - 总览界面API路由（异常条件更新版）
 * 
 * 异常监控条件更新：
 * - 超时未揽收：出库时间后2小时，订单状态仍为'00'(已出库)    
 * - 超时未发运：出库时间后12小时，订单状态仍为'55'(已揽收) 
 * - 超时未签收：IF_DELAY字段值存在且为'Y'的订单
 * - 超48H未更新：IS48H_FLAG字段值存在且为'Y'的订单
 */

const express = require('express');
const router = express.Router();
const { getConnection, executeQuery, DateHelper } = require('../config/database-api');
const { getBrandMapping } = require('../utils/brandMapping'); // ✅ 导入动态品牌映射

// 🔧 共享工具函数 - 避免重复代码
const QueryUtils = {
  // ✅ 品牌映射配置 - 将改为异步从数据库加载
  // 保留作为回退映射（数据库加载失败时使用）
  BRAND_MAPPING_FALLBACK: {
    'DICKIES': '18405',
    'TNF': '18405-1', 
    'ICEBREAKER': '18405-2',
    'VANS': '18405-3',
    'TIMBERLAND': '18405-4',
    'SMARTWOOL': '18405-5'
  },

  // ✅ 品牌表JOIN片段 - 从数据库查询品牌名称
  getBrandJoin(tableAlias = 't') {
    return `LEFT JOIN APP_CMS.BAS_COMPANY bc_brand ON ${tableAlias}.CUSTOMERNO = bc_brand.COMPANY_SYSID`;
  },

  // ✅ 品牌名称字段 - 从数据库查询，回退到CUSTOMERNO，统一转为大写
  getBrandNameColumn() {
    return `UPPER(COALESCE(bc_brand.COMPANY_ABNAME, t.CUSTOMERNO)) as brand_name`;
  },

  // 🔥 基础WHERE条件 - 移除硬编码的品牌过滤（⚡ 性能优化：使用TRUNC代替to_char）
  BASE_WHERE_CONDITIONS: `
    WHERE (t.WMS_OUTBOUND_TIME IS NOT NULL 
           AND TRUNC(t.WMS_OUTBOUND_TIME) >= TO_DATE(:dateFrom, 'YYYY-MM-DD')
           AND TRUNC(t.WMS_OUTBOUND_TIME) <= TO_DATE(:dateTo, 'YYYY-MM-DD'))
      AND t.TSK_MERGE_NO IS NOT NULL`,

  // 平台映射配置 - 前端选择器值到数据库BAS_CODES表中UDF1字段的映射
  PLATFORM_MAPPING: {
    'tmall': '天猫',        // 天猫
    'douyin': '抖音',       // 抖音  
    'jd': '京东',           // 京东
    'pdd': '拼多多',         // 拼多多
    'official': '官网/小程序',     // 官网/小程序
    'o2o': 'O2O',          // O2O
    'xiaohongshu': '小红书', // 小红书
    'wechat': '微信'        // 微信小程序
  },

  // ✅ 四种核心异常类型的SQL片段 - 基于具体业务条件（更新版本）
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
    
    // 超48H未更新: IS48H_FLAG字段值存在且为'Y'的订单
    NO_UPDATE_48H: `(t.IS48H_FLAG = 'Y')`
  },

  /**
   * 规范化查询参数，避免字符串 / 数组 类型混淆
   * - 接受 string 或 string[]，忽略其他类型
   * - 去除首尾空格
   */
  normalizeStringOrStringArray(value) {
    if (value == null) {
      return undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    }
    if (Array.isArray(value)) {
      const normalized = value
        .filter(v => typeof v === 'string')
        .map(v => v.trim())
        .filter(v => v);
      return normalized.length > 0 ? normalized : undefined;
    }
    // 其他类型一律忽略
    return undefined;
  },

  // ✅ 异步构建筛选条件和参数（支持动态品牌映射）
  async buildFiltersAsync(queryParams, brand, platform, selfFlag, userBrands) {
    let brandFilter = '';
    let platformFilter = '';
    let selfFlagFilter = '';
    
    // 🔥 获取动态品牌映射
    const BRAND_MAPPING = await getBrandMapping();
    
    // 先对 brand 做类型规范化，避免字符串 / 数组混用导致的类型混淆
    const normalizedBrand = this.normalizeStringOrStringArray(brand);
    
    // 🔐 品牌筛选：支持单个品牌、多个品牌（数组或逗号分隔字符串）
    if (normalizedBrand && normalizedBrand !== 'all') {
      // 🔥 新增：如果是逗号分隔的字符串，拆分为数组
      let brandArray = normalizedBrand;
      if (typeof normalizedBrand === 'string' && normalizedBrand.includes(',')) {
        brandArray = normalizedBrand.split(',').map(b => b.trim()).filter(b => b);
        console.log(`🔧 [Brand Filter] 检测到逗号分隔字符串，拆分为数组:`, brandArray);
      } else if (!Array.isArray(normalizedBrand)) {
        brandArray = [normalizedBrand]; // 单个品牌也转为数组统一处理
      }
      
      if (brandArray.length > 1) {
        // 多个品牌：使用 IN 查询
        const brandCodes = brandArray.map(b => BRAND_MAPPING[b] || b);
        const placeholders = brandCodes.map((_, index) => `:brand${index}`).join(', ');
        brandFilter = ` AND t.CUSTOMERNO IN (${placeholders})`;
        
        // 绑定每个品牌参数
        brandCodes.forEach((code, index) => {
          queryParams[`brand${index}`] = code;
        });
        
        console.log(`🏷️ [Brand Filter] 多品牌筛选 (${brandCodes.length}个):`, brandCodes);
      } else if (brandArray.length === 1) {
        // 单个品牌：使用 = 查询
        brandFilter = ` AND t.CUSTOMERNO = :brand`;
        queryParams.brand = BRAND_MAPPING[brandArray[0]] || brandArray[0];
        console.log(`🏷️ [Brand Filter] 单品牌筛选:`, queryParams.brand);
      }
    } else {
      // 🔥 修复：当选择"全部品牌"时，使用用户权限范围
      if (userBrands && Array.isArray(userBrands) && userBrands.length > 0) {
        const placeholders = userBrands.map((_, index) => `:userBrand${index}`).join(', ');
        brandFilter = ` AND t.CUSTOMERNO IN (${placeholders})`;
        
        // 绑定每个用户品牌参数
        userBrands.forEach((code, index) => {
          queryParams[`userBrand${index}`] = code;
        });
        
        console.log(`🔐 [Brand Filter] 全部品牌 - 基于用户权限 (${userBrands.length}个):`, userBrands);
      } else {
        // 回退：如果没有userBrands，使用VF品牌范围（包含18405-5）
        brandFilter = ` AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')`;
        console.log(`🏷️ [Brand Filter] 全部品牌 - 回退到VF品牌范围（未提供userBrands）`);
      }
    }
    
    if (platform && platform !== 'all') {
      platformFilter = ` AND v.PLATFORM_CLASS = :platform`;
      queryParams.platform = this.PLATFORM_MAPPING[platform] || platform;
      console.log(`🏪 [Platform Filter] 平台筛选映射: ${platform} -> ${queryParams.platform} (从VIEW_TSK_LIST_TASK视图获取)`);
    }
    
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
 * 获取总览KPI指标 - 包含快递公司统计
 * GET /api/overview/kpi
 */
router.get('/kpi', async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag, userBrands } = req.query;
    
    console.log('🔄 [KPI查询] 收到请求参数:', { dateFrom, dateTo, brand, platform, selfFlag, userBrands });
    
    // 参数验证
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: '缺少必需的日期参数',
        message: '请提供dateFrom和dateTo参数'
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        error: '日期格式无效',
        message: '请提供有效的YYYY-MM-DD格式日期'
      });
    }

    connection = await getConnection();
    
    // 🔧 解析userBrands参数（可能是字符串或数组）
    let parsedUserBrands = null;
    if (userBrands) {
      if (Array.isArray(userBrands)) {
        parsedUserBrands = userBrands;
      } else if (typeof userBrands === 'string') {
        try {
          parsedUserBrands = JSON.parse(userBrands);
        } catch (e) {
          // 如果不是JSON，尝试按逗号分隔
          parsedUserBrands = userBrands.split(',').map(b => b.trim());
        }
      }
      console.log('🔐 [KPI查询] 解析后的userBrands:', parsedUserBrands);
    }
    
    // 计算历史日期范围用于同比环比
    const momRange = DateHelper.calculateMoMDateRange(dateFrom, dateTo);
    const yoyRange = DateHelper.calculateYoYDateRange(dateFrom, dateTo);
    
    // ⚡ 性能优化：准备3个时间段的参数用于并行查询
    const currentParams = { dateFrom, dateTo };
    const lastMonthParams = { dateFrom: momRange.lastMonthFrom, dateTo: momRange.lastMonthTo };
    const lastYearParams = { dateFrom: yoyRange.lastYearFrom, dateTo: yoyRange.lastYearTo };
    
    // 构建筛选条件（只用当前期间参数）
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(currentParams, brand, platform, selfFlag, parsedUserBrands);

    // 复制筛选参数到其他时间段
    Object.keys(currentParams).forEach(key => {
      if (key.startsWith('brand') || key.startsWith('userBrand') || key === 'platform' || key === 'selfFlag') {
        lastMonthParams[key] = currentParams[key];
        lastYearParams[key] = currentParams[key];
      }
    });
    
    // ⚠️ 兼容性：为其他查询保留baseParams引用
    const baseParams = currentParams;

    // 🔍 调试：打印筛选条件
    console.log('⚡ [KPI查询] 使用并行查询模式，提升性能...');
    console.log('🔍 [KPI查询] 筛选条件:', {
      brandFilter: brandFilter || '(无)',
      platformFilter: platformFilter || '(无)',
      selfFlagFilter: selfFlagFilter || '(无)',
      'currentParams.platform': currentParams.platform
    });

    // 核心KPI查询
    const kpiQuery = `
      WITH base_data AS (
        SELECT 
          t.TSK_MERGE_NO,
          t.CUSTOMERNO,
          t.DIS_STATUS,
          t.PLATFORM,
          t.PAYMENTDATE_D,
          t.WMS_OUTBOUND_TIME,
          t.DELIVERY_TIME,
          t.DISP_TIME,
          t.TRACKING_TIME,
          t.SUM_SEND_TIME2,
          t.IS48H_FLAG,
          v.IF_DELAY,
          t.CARRIERID,
          bs.CODENAME_C as status_name,
          v.PLATFORM_CLASS as platform_class,
          CASE 
            WHEN (
              t.WMS_OUTBOUND_TIME IS NOT NULL 
              AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom 
              AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo
            ) THEN 'current'
            WHEN (
              t.WMS_OUTBOUND_TIME IS NOT NULL 
              AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :lastMonthFrom 
              AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :lastMonthTo
            ) THEN 'last_month'
            WHEN (
              t.WMS_OUTBOUND_TIME IS NOT NULL 
              AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :lastYearFrom 
              AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :lastYearTo
            ) THEN 'last_year'
          END as period_type
        FROM APP_CMS.TSK_LIST_TASK t
        LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
        LEFT JOIN APP_CMS.BAS_CODES bs ON t.DIS_STATUS = bs.CODE AND bs.CODEID = 'BL_STATUS'
        WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
          AND (
            (to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
            OR
            (to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :lastMonthFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :lastMonthTo)
            OR
            (to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :lastYearFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :lastYearTo)
          )
          AND t.TSK_MERGE_NO IS NOT NULL
          AND t.CARRIERID IS NOT NULL
          ${brandFilter}
          ${platformFilter}
          ${selfFlagFilter}
      ),
      current_stats AS (
        SELECT 
          COUNT(DISTINCT TSK_MERGE_NO) as total_orders,
          COUNT(DISTINCT CASE WHEN IS48H_FLAG = 'Y' THEN TSK_MERGE_NO END) as timeout_48h_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS = '55' THEN TSK_MERGE_NO END) as picked_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS = '70' THEN TSK_MERGE_NO END) as shipped_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS in ('95','93') THEN TSK_MERGE_NO END) as delivered_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS = '40' THEN TSK_MERGE_NO END) as forwarded_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS IN ('100', '105') THEN TSK_MERGE_NO END) as returned_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS IN ('90', '110') THEN TSK_MERGE_NO END) as cancelled_orders,
          ROUND(AVG(CASE WHEN SUM_SEND_TIME2 IS NOT NULL AND SUM_SEND_TIME2 > 0 THEN SUM_SEND_TIME2 END), 2) as avg_delivery_hours,
          ROUND(AVG(CASE WHEN DIS_STATUS in ('95','93') AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL 
                        THEN (DELIVERY_TIME - DISP_TIME) * 24 END), 2) as avg_first_dispatch_hours,
          ROUND(
            COUNT(CASE WHEN DIS_STATUS in ('95','93') AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL 
                       AND (DELIVERY_TIME - DISP_TIME) * 24 <= 8 THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN DIS_STATUS in ('95','93') AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL THEN 1 END), 0),
            2
          ) as first_dispatch_success_rate,
          ROUND(COUNT(CASE WHEN DIS_STATUS = '55' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as picked_rate,
          ROUND(COUNT(CASE WHEN DIS_STATUS = '70' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as shipped_rate,
          ROUND(COUNT(CASE WHEN DIS_STATUS in ('95','93') THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate,
          ROUND((
            COUNT(CASE WHEN WMS_OUTBOUND_TIME IS NOT NULL AND DIS_STATUS = '00' AND (SYSDATE - WMS_OUTBOUND_TIME) * 24 > 2 THEN 1 END) +
            COUNT(CASE WHEN WMS_OUTBOUND_TIME IS NOT NULL AND DIS_STATUS = '55' AND (SYSDATE - WMS_OUTBOUND_TIME) * 24 > 12 THEN 1 END) +
            COUNT(CASE WHEN IF_DELAY = 'Y' THEN 1 END) +
            COUNT(CASE WHEN IS48H_FLAG = 'Y' THEN 1 END)
          ) * 100.0 / NULLIF(COUNT(*), 0), 2) as exception_rate,
          ROUND(COUNT(CASE WHEN IS48H_FLAG = 'Y' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as timeout_48h_rate
        FROM base_data 
        WHERE period_type = 'current'
      ),
      -- 🔥 新增：上月同比数据统计
      last_month_stats AS (
        SELECT 
          COUNT(DISTINCT TSK_MERGE_NO) as total_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS = '40' THEN TSK_MERGE_NO END) as forwarded_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS IN ('100', '105') THEN TSK_MERGE_NO END) as returned_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS IN ('90', '110') THEN TSK_MERGE_NO END) as cancelled_orders,
          ROUND(AVG(CASE WHEN SUM_SEND_TIME2 IS NOT NULL AND SUM_SEND_TIME2 > 0 THEN SUM_SEND_TIME2 END), 2) as avg_delivery_hours,
          ROUND(AVG(CASE WHEN DIS_STATUS IN ('95','93') AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL 
                        THEN (DELIVERY_TIME - DISP_TIME) * 24 END), 2) as avg_first_dispatch_hours,
          ROUND(
            COUNT(CASE WHEN DIS_STATUS IN ('95','93') AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL 
                       AND (DELIVERY_TIME - DISP_TIME) * 24 <= 8 THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN DIS_STATUS IN ('95','93') AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL THEN 1 END), 0),
            2
          ) as first_dispatch_success_rate
        FROM base_data 
        WHERE period_type = 'last_month'
      ),
      -- 🔥 新增：去年同比数据统计
      last_year_stats AS (
        SELECT 
          COUNT(DISTINCT TSK_MERGE_NO) as total_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS = '40' THEN TSK_MERGE_NO END) as forwarded_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS IN ('100', '105') THEN TSK_MERGE_NO END) as returned_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS IN ('90', '110') THEN TSK_MERGE_NO END) as cancelled_orders,
          ROUND(AVG(CASE WHEN SUM_SEND_TIME2 IS NOT NULL AND SUM_SEND_TIME2 > 0 THEN SUM_SEND_TIME2 END), 2) as avg_delivery_hours,
          ROUND(AVG(CASE WHEN DIS_STATUS IN ('95','93') AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL 
                        THEN (DELIVERY_TIME - DISP_TIME) * 24 END), 2) as avg_first_dispatch_hours,
          ROUND(
            COUNT(CASE WHEN DIS_STATUS IN ('95','93') AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL 
                       AND (DELIVERY_TIME - DISP_TIME) * 24 <= 8 THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN DIS_STATUS IN ('95','93') AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL THEN 1 END), 0),
            2
          ) as first_dispatch_success_rate
        FROM base_data 
        WHERE period_type = 'last_year'
      )
      SELECT 
        -- 当前数据
        cs.total_orders,
        cs.timeout_48h_orders,
        cs.picked_orders,
        cs.shipped_orders,
        cs.delivered_orders,
        cs.forwarded_orders,
        cs.returned_orders,
        cs.cancelled_orders,
        cs.avg_delivery_hours,
        cs.avg_first_dispatch_hours,
        cs.first_dispatch_success_rate,
        cs.picked_rate,
        cs.shipped_rate,
        cs.delivery_rate,
        cs.exception_rate,
        cs.timeout_48h_rate,
        -- 🔥 新增：历史数据用于同比环比计算
        lm.total_orders as last_month_total_orders,
        lm.forwarded_orders as last_month_forwarded_orders,
        lm.returned_orders as last_month_returned_orders,
        lm.cancelled_orders as last_month_cancelled_orders,
        lm.avg_delivery_hours as last_month_avg_delivery_hours,
        lm.avg_first_dispatch_hours as last_month_avg_first_dispatch_hours,
        lm.first_dispatch_success_rate as last_month_first_dispatch_success_rate,
        ly.total_orders as last_year_total_orders,
        ly.forwarded_orders as last_year_forwarded_orders,
        ly.returned_orders as last_year_returned_orders,
        ly.cancelled_orders as last_year_cancelled_orders,
        ly.avg_delivery_hours as last_year_avg_delivery_hours,
        ly.avg_first_dispatch_hours as last_year_avg_first_dispatch_hours,
        ly.first_dispatch_success_rate as last_year_first_dispatch_success_rate
      FROM current_stats cs
      LEFT JOIN last_month_stats lm ON 1=1
      LEFT JOIN last_year_stats ly ON 1=1
    `;

    // ⚡ 优化：使用更简单的单时间段查询
    const buildPeriodQuery = () => `
      SELECT 
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        COUNT(DISTINCT CASE WHEN t.IS48H_FLAG = 'Y' THEN t.TSK_MERGE_NO END) as timeout_48h_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('95','93') THEN t.TSK_MERGE_NO END) as delivered_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '40' THEN t.TSK_MERGE_NO END) as forwarded_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('100', '105') THEN t.TSK_MERGE_NO END) as returned_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('90', '110') THEN t.TSK_MERGE_NO END) as cancelled_orders,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_hours,
        ROUND(AVG(CASE WHEN t.DIS_STATUS IN ('95','93') AND t.DISP_TIME IS NOT NULL AND t.DELIVERY_TIME IS NOT NULL 
                      THEN (t.DELIVERY_TIME - t.DISP_TIME) * 24 END), 2) as avg_first_dispatch_hours,
        ROUND(
          COUNT(CASE WHEN t.DIS_STATUS IN ('95','93') AND t.DISP_TIME IS NOT NULL AND t.DELIVERY_TIME IS NOT NULL 
                     AND (t.DELIVERY_TIME - t.DISP_TIME) * 24 <= 8 THEN 1 END) * 100.0 / 
          NULLIF(COUNT(CASE WHEN t.DIS_STATUS IN ('95','93') AND t.DISP_TIME IS NOT NULL AND t.DELIVERY_TIME IS NOT NULL THEN 1 END), 0),
          2
        ) as first_dispatch_success_rate,
        ROUND(COUNT(CASE WHEN t.DIS_STATUS = '55' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as picked_rate,
        ROUND(COUNT(CASE WHEN t.DIS_STATUS = '70' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as shipped_rate,
        ROUND(COUNT(CASE WHEN t.DIS_STATUS IN ('95','93') THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate,
        ROUND((
          COUNT(CASE WHEN t.WMS_OUTBOUND_TIME IS NOT NULL AND t.DIS_STATUS = '00' AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2 THEN 1 END) +
          COUNT(CASE WHEN t.WMS_OUTBOUND_TIME IS NOT NULL AND t.DIS_STATUS = '55' AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12 THEN 1 END) +
          COUNT(CASE WHEN v.IF_DELAY = 'Y' THEN 1 END) +
          COUNT(CASE WHEN t.IS48H_FLAG = 'Y' THEN 1 END)
        ) * 100.0 / NULLIF(COUNT(*), 0), 2) as exception_rate,
        ROUND(COUNT(CASE WHEN t.IS48H_FLAG = 'Y' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as timeout_48h_rate
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND TRUNC(t.WMS_OUTBOUND_TIME) >= TO_DATE(:dateFrom, 'YYYY-MM-DD')
        AND TRUNC(t.WMS_OUTBOUND_TIME) <= TO_DATE(:dateTo, 'YYYY-MM-DD')
        AND t.TSK_MERGE_NO IS NOT NULL
        AND t.CARRIERID IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
    `;
    
    const queryStartTime = Date.now();
    
    // 🚀 并行执行3个查询
    const [currentResult, lastMonthResult, lastYearResult] = await Promise.all([
      connection.execute(buildPeriodQuery(), currentParams),
      connection.execute(buildPeriodQuery(), lastMonthParams),
      connection.execute(buildPeriodQuery(), lastYearParams)
    ]);
    
    const queryEndTime = Date.now();
    console.log(`✅ [KPI查询] 3个查询并行完成，耗时: ${queryEndTime - queryStartTime}ms`);
    
    // 提取查询结果
    const kpiData = currentResult.rows[0];
    const lastMonthData = lastMonthResult.rows[0];
    const lastYearData = lastYearResult.rows[0];
    
    // 🔥 详细打印历史数据用于验证
    console.log('\n' + '='.repeat(80));
    console.log('📅 [历史数据验证] 当前期间数据:');
    console.log('='.repeat(80));
    console.log('  日期范围:', dateFrom, '~', dateTo);
    console.log('  订单总数:', kpiData[0]);
    console.log('  48小时超时订单:', kpiData[1]);
    console.log('  已揽收订单:', kpiData[2]);
    console.log('  已发运订单:', kpiData[3]);
    console.log('  已签收订单:', kpiData[4]);
    console.log('  转寄订单:', kpiData[5]);
    console.log('  退货订单:', kpiData[6]);
    console.log('  取消订单:', kpiData[7]);
    console.log('  异常率:', kpiData[14]);
    
    console.log('\n' + '='.repeat(80));
    console.log('📅 [历史数据验证] 上个月同期数据 (环比基准):');
    console.log('='.repeat(80));
    console.log('  日期范围:', momRange.lastMonthFrom, '~', momRange.lastMonthTo);
    console.log('  订单总数:', lastMonthData[0]);
    console.log('  48小时超时订单:', lastMonthData[1]);
    console.log('  已揽收订单:', lastMonthData[2]);
    console.log('  已发运订单:', lastMonthData[3]);
    console.log('  已签收订单:', lastMonthData[4]);
    console.log('  转寄订单:', lastMonthData[5]);
    console.log('  退货订单:', lastMonthData[6]);
    console.log('  取消订单:', lastMonthData[7]);
    console.log('  异常率:', lastMonthData[14]);
    console.log('  📌 用于环比计算的基准值');
    
    console.log('\n' + '='.repeat(80));
    console.log('📅 [历史数据验证] 去年同期数据 (同比基准):');
    console.log('='.repeat(80));
    console.log('  日期范围:', yoyRange.lastYearFrom, '~', yoyRange.lastYearTo);
    console.log('  订单总数:', lastYearData[0]);
    console.log('  48小时超时订单:', lastYearData[1]);
    console.log('  已揽收订单:', lastYearData[2]);
    console.log('  已发运订单:', lastYearData[3]);
    console.log('  已签收订单:', lastYearData[4]);
    console.log('  转寄订单:', lastYearData[5]);
    console.log('  退货订单:', lastYearData[6]);
    console.log('  取消订单:', lastYearData[7]);
    console.log('  异常率:', lastYearData[14]);
    console.log('  📌 用于同比计算的基准值');
    console.log('='.repeat(80) + '\n');
    
    // 🔥 新增：计算同比环比增长率的辅助函数
    const calculateGrowthRate = (current, previous) => {
      if (!previous || previous === 0) return null;
      return Math.round(((current - previous) / previous * 100) * 100) / 100;
    };
    
    // ⚡ 并行查询优化：直接从单独的查询结果中提取数据
    const historicalData = {
      lastMonth: {
        totalOrders: lastMonthData[0] || 0,
        forwardedOrders: lastMonthData[5] || 0,
        returnedOrders: lastMonthData[6] || 0,
        cancelledOrders: lastMonthData[7] || 0,
        avgDeliveryHours: lastMonthData[8] || 0,
        avgFirstDispatchHours: lastMonthData[9] || 0,
        firstDispatchSuccessRate: lastMonthData[10] || 0,
        statusDistribution: [
          { statusCode: 40, orderCount: lastMonthData[5] || 0 },
          { statusCode: 100, orderCount: lastMonthData[6] || 0 },
          { statusCode: 90, orderCount: lastMonthData[7] || 0 }
        ],
        performanceMetrics: {
          avgDeliveryHours: lastMonthData[8] || 0,
          avgFirstDispatchHours: lastMonthData[9] || 0,
          firstDispatchSuccessRate: lastMonthData[10] || 0
        }
      },
      lastYear: {
        totalOrders: lastYearData[0] || 0,
        forwardedOrders: lastYearData[5] || 0,
        returnedOrders: lastYearData[6] || 0,
        cancelledOrders: lastYearData[7] || 0,
        avgDeliveryHours: lastYearData[8] || 0,
        avgFirstDispatchHours: lastYearData[9] || 0,
        firstDispatchSuccessRate: lastYearData[10] || 0,
        statusDistribution: [
          { statusCode: 40, orderCount: lastYearData[5] || 0 },
          { statusCode: 100, orderCount: lastYearData[6] || 0 },
          { statusCode: 90, orderCount: lastYearData[7] || 0 }
        ],
        performanceMetrics: {
          avgDeliveryHours: lastYearData[8] || 0,
          avgFirstDispatchHours: lastYearData[9] || 0,
          firstDispatchSuccessRate: lastYearData[10] || 0
        }
      }
    };
    
    // 🔥 新增：计算各指标的同比环比增长率
    const momGrowthRates = {
      totalOrders: calculateGrowthRate(kpiData[0], historicalData.lastMonth.totalOrders),
      forwardedOrders: calculateGrowthRate(kpiData[5], historicalData.lastMonth.forwardedOrders),
      returnedOrders: calculateGrowthRate(kpiData[6], historicalData.lastMonth.returnedOrders),
      cancelledOrders: calculateGrowthRate(kpiData[7], historicalData.lastMonth.cancelledOrders),
      avgDeliveryHours: calculateGrowthRate(kpiData[8], historicalData.lastMonth.avgDeliveryHours),
      avgFirstDispatchHours: calculateGrowthRate(kpiData[9], historicalData.lastMonth.avgFirstDispatchHours),
      firstDispatchSuccessRate: calculateGrowthRate(kpiData[10], historicalData.lastMonth.firstDispatchSuccessRate)
    };
    
    const yoyGrowthRates = {
      totalOrders: calculateGrowthRate(kpiData[0], historicalData.lastYear.totalOrders),
      forwardedOrders: calculateGrowthRate(kpiData[5], historicalData.lastYear.forwardedOrders),
      returnedOrders: calculateGrowthRate(kpiData[6], historicalData.lastYear.returnedOrders),
      cancelledOrders: calculateGrowthRate(kpiData[7], historicalData.lastYear.cancelledOrders),
      avgDeliveryHours: calculateGrowthRate(kpiData[8], historicalData.lastYear.avgDeliveryHours),
      avgFirstDispatchHours: calculateGrowthRate(kpiData[9], historicalData.lastYear.avgFirstDispatchHours),
      firstDispatchSuccessRate: calculateGrowthRate(kpiData[10], historicalData.lastYear.firstDispatchSuccessRate)
    };
    
    // 🔥 打印增长率计算结果
    console.log('📈 [增长率计算结果]:');
    console.log('  当前订单数:', kpiData[0]);
    console.log('  上月订单数:', historicalData.lastMonth.totalOrders);
    console.log('  去年订单数:', historicalData.lastYear.totalOrders);
    console.log('  环比增长率 (MoM):', momGrowthRates.totalOrders, '%');
    console.log('  同比增长率 (YoY):', yoyGrowthRates.totalOrders, '%');
    console.log('  计算公式:');
    console.log('    MoM = ((当前 - 上月) / 上月) × 100 = ((' + kpiData[0] + ' - ' + historicalData.lastMonth.totalOrders + ') / ' + historicalData.lastMonth.totalOrders + ') × 100');
    console.log('    YoY = ((当前 - 去年) / 去年) × 100 = ((' + kpiData[0] + ' - ' + historicalData.lastYear.totalOrders + ') / ' + historicalData.lastYear.totalOrders + ') × 100');
    console.log('');

    // 品牌分布查询（✅ 从数据库查询品牌名称，包含首派效率指标）
    const brandQuery = `
      SELECT 
        t.CUSTOMERNO,
        ${QueryUtils.getBrandNameColumn()},
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('95','93') THEN t.TSK_MERGE_NO END) as delivered_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '40' THEN t.TSK_MERGE_NO END) as forwarded_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('100', '105') THEN t.TSK_MERGE_NO END) as returned_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('90', '110') THEN t.TSK_MERGE_NO END) as cancelled_count,
        (
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END)
        ) as exception_count,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_hours,
        ROUND(
          AVG(
            CASE 
              WHEN t.DIS_STATUS IN ('95','93') 
                AND t.DISP_TIME IS NOT NULL 
                AND t.DELIVERY_TIME IS NOT NULL
              THEN (t.DELIVERY_TIME - t.DISP_TIME) * 24
              ELSE NULL 
            END
          ), 
          2
        ) as avg_first_dispatch_hours,
        ROUND(
          COUNT(DISTINCT CASE 
            WHEN t.DIS_STATUS IN ('95','93') 
              AND t.DISP_TIME IS NOT NULL 
              AND t.DELIVERY_TIME IS NOT NULL
              AND (t.DELIVERY_TIME - t.DISP_TIME) * 24 <= 8
            THEN t.TSK_MERGE_NO 
          END) * 100.0 / 
          NULLIF(COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('95','93') AND t.DISP_TIME IS NOT NULL AND t.DELIVERY_TIME IS NOT NULL THEN t.TSK_MERGE_NO END), 0), 
          2
        ) as first_dispatch_success_rate
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      ${QueryUtils.getBrandJoin('t')}
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CUSTOMERNO, bc_brand.COMPANY_ABNAME
      ORDER BY order_count DESC
    `;

    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    const brandQueryParams = { dateFrom, dateTo };
    
    // 复制所有 brand 相关参数（支持 brand0, brand1, brand2, ... 或单个 brand）
    Object.keys(baseParams).forEach(key => {
      if (key.startsWith('brand')) {
        brandQueryParams[key] = baseParams[key];
      }
    });
    
    if (platform && platform !== 'all') {
      brandQueryParams.platform = baseParams.platform;
    }
    if (baseParams.selfFlag) {
      brandQueryParams.selfFlag = baseParams.selfFlag;
    }

    const brandStartTime = Date.now();
    
    // 🔍 调试：打印完整SQL和参数
    console.log('📝 [Overview-BrandQuery] 完整SQL查询:');
    console.log(brandQuery);
    console.log('📝 [Overview-BrandQuery] 查询参数:', brandQueryParams);
    
    const brandResult = await connection.execute(brandQuery, brandQueryParams);
    const brandEndTime = Date.now();
    console.log(`✅ [品牌分析] 查询完成，耗时: ${brandEndTime - brandStartTime}ms`);
    
    const brandData = brandResult.rows.map(row => ({
      customerno: row[0],
      brandName: row[1],
      orderCount: row[2] || 0,
      pickedCount: row[3] || 0,
      shippedCount: row[4] || 0,
      deliveredCount: row[5] || 0,
      forwardedCount: row[6] || 0,
      returnedCount: row[7] || 0,
      cancelledCount: row[8] || 0,
      exceptionCount: row[9] || 0,
      avgDeliveryHours: row[10] || 0,  // 🔥 修复：字段名改为avgDeliveryHours，保持与KPI一致
      avgFirstDispatchHours: row[11] || 0,  // 🔥 新增：平均首派时长（小时）
      firstDispatchSuccessRate: row[12] || 0,  // 🔥 新增：首派成功率（百分比）
      // 计算各状态比率
      pickedRate: (row[2] && row[3]) ? Math.round((row[3] / row[2]) * 100 * 100) / 100 : 0,
      shippedRate: (row[2] && row[4]) ? Math.round((row[4] / row[2]) * 100 * 100) / 100 : 0,
      deliveryRate: (row[2] && row[5]) ? Math.round((row[5] / row[2]) * 100 * 100) / 100 : 0,
      forwardedRate: (row[2] && row[6]) ? Math.round((row[6] / row[2]) * 100 * 100) / 100 : 0,
      returnedRate: (row[2] && row[7]) ? Math.round((row[7] / row[2]) * 100 * 100) / 100 : 0,
      cancelledRate: (row[2] && row[8]) ? Math.round((row[8] / row[2]) * 100 * 100) / 100 : 0,
      exceptionRate: (row[2] && row[9]) ? Math.round((row[9] / row[2]) * 100 * 100) / 100 : 0
    }));

    // 🔥 新增：按品牌维度查询历史数据（上月和去年同期）
    console.log('\n' + '='.repeat(80));
    console.log('📊 [品牌历史数据] 开始查询各品牌的历史数据...');
    console.log('='.repeat(80));
    
    const brandHistoricalDataMap = {};
    
    for (const brand of brandData) {
      const brandCustomerno = brand.customerno;
      
      // 构建品牌历史数据查询SQL（不需要品牌JOIN，因为已经用CUSTOMERNO过滤）
      const buildBrandHistoricalQuery = (periodRange) => `
        SELECT 
          COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
          COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '40' THEN t.TSK_MERGE_NO END) as forwarded_orders,
          COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('100', '105') THEN t.TSK_MERGE_NO END) as returned_orders,
          COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('90', '110') THEN t.TSK_MERGE_NO END) as cancelled_orders,
          ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_hours,
          ROUND(
            AVG(
              CASE 
                WHEN t.DIS_STATUS IN ('95','93') 
                  AND v.DISP_TIME_T IS NOT NULL 
                  AND v.DELIVERY_TIME_C IS NOT NULL
                THEN (TO_DATE(v.DELIVERY_TIME_C, 'YYYY-MM-DD HH24:MI:SS') - TO_DATE(v.DISP_TIME_T, 'YYYY-MM-DD HH24:MI:SS')) * 24
                ELSE NULL 
              END
            ), 
            2
          ) as avg_first_dispatch_hours,
          ROUND(
            COUNT(DISTINCT CASE 
              WHEN t.DIS_STATUS IN ('95','93')
                AND v.DISP_TIME_T IS NOT NULL 
                AND v.DELIVERY_TIME_C IS NOT NULL
                AND (TO_DATE(v.DELIVERY_TIME_C, 'YYYY-MM-DD HH24:MI:SS') - TO_DATE(v.DISP_TIME_T, 'YYYY-MM-DD HH24:MI:SS')) * 24 <= 8
              THEN t.TSK_MERGE_NO 
            END) * 100.0 / 
            NULLIF(COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('95','93') AND v.DISP_TIME_T IS NOT NULL AND v.DELIVERY_TIME_C IS NOT NULL THEN t.TSK_MERGE_NO END), 0), 
            2
          ) as first_dispatch_success_rate
        FROM APP_CMS.TSK_LIST_TASK t
        LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
        WHERE t.CUSTOMERNO = :brandCustomerno
          AND t.WMS_OUTBOUND_TIME >= TO_DATE(:periodFrom, 'YYYY-MM-DD')
          AND t.WMS_OUTBOUND_TIME < TO_DATE(:periodTo, 'YYYY-MM-DD') + INTERVAL '1' DAY
          ${platformFilter}
          ${selfFlagFilter}
      `;
      
      try {
        // 查询上月数据
        const lastMonthParams = {
          brandCustomerno,
          periodFrom: momRange.lastMonthFrom,
          periodTo: momRange.lastMonthTo
        };
        if (platform && platform !== 'all') {
          lastMonthParams.platform = baseParams.platform;
        }
        if (baseParams.selfFlag) {
          lastMonthParams.selfFlag = baseParams.selfFlag;
        }
        
        const lastMonthResult = await connection.execute(
          buildBrandHistoricalQuery(momRange),
          lastMonthParams
        );
        
        // 查询去年同期数据
        const lastYearParams = {
          brandCustomerno,
          periodFrom: yoyRange.lastYearFrom,
          periodTo: yoyRange.lastYearTo
        };
        if (platform && platform !== 'all') {
          lastYearParams.platform = baseParams.platform;
        }
        if (baseParams.selfFlag) {
          lastYearParams.selfFlag = baseParams.selfFlag;
        }
        
        const lastYearResult = await connection.execute(
          buildBrandHistoricalQuery(yoyRange),
          lastYearParams
        );
        
        const lastMonthData = lastMonthResult.rows[0] || [];
        const lastYearData = lastYearResult.rows[0] || [];
        
        // 保存该品牌的历史数据
        brandHistoricalDataMap[brandCustomerno] = {
          lastMonth: {
            totalOrders: lastMonthData[0] || 0,
            forwardedOrders: lastMonthData[1] || 0,
            returnedOrders: lastMonthData[2] || 0,
            cancelledOrders: lastMonthData[3] || 0,
            avgDeliveryHours: lastMonthData[4] || 0,
            avgFirstDispatchHours: lastMonthData[5] || 0,
            firstDispatchSuccessRate: lastMonthData[6] || 0,
            performanceMetrics: {
              avgDeliveryHours: lastMonthData[4] || 0,
              avgFirstDispatchHours: lastMonthData[5] || 0,
              firstDispatchSuccessRate: lastMonthData[6] || 0
            }
          },
          lastYear: {
            totalOrders: lastYearData[0] || 0,
            forwardedOrders: lastYearData[1] || 0,
            returnedOrders: lastYearData[2] || 0,
            cancelledOrders: lastYearData[3] || 0,
            avgDeliveryHours: lastYearData[4] || 0,
            avgFirstDispatchHours: lastYearData[5] || 0,
            firstDispatchSuccessRate: lastYearData[6] || 0,
            performanceMetrics: {
              avgDeliveryHours: lastYearData[4] || 0,
              avgFirstDispatchHours: lastYearData[5] || 0,
              firstDispatchSuccessRate: lastYearData[6] || 0
            }
          }
        };
        
        console.log(`✅ [品牌历史数据] ${brand.brandName} (${brandCustomerno}):`);
        console.log(`   上月订单: ${lastMonthData[0] || 0}, 去年同期: ${lastYearData[0] || 0}`);
        
      } catch (error) {
        console.error(`❌ [品牌历史数据] 查询失败 - ${brand.brandName}:`, error.message);
        brandHistoricalDataMap[brandCustomerno] = {
          lastMonth: { totalOrders: 0, forwardedOrders: 0, returnedOrders: 0, cancelledOrders: 0, avgDeliveryHours: 0, avgFirstDispatchHours: 0, firstDispatchSuccessRate: 0, performanceMetrics: {} },
          lastYear: { totalOrders: 0, forwardedOrders: 0, returnedOrders: 0, cancelledOrders: 0, avgDeliveryHours: 0, avgFirstDispatchHours: 0, firstDispatchSuccessRate: 0, performanceMetrics: {} }
        };
      }
    }
    
    console.log('='.repeat(80));
    console.log(`✅ [品牌历史数据] 所有品牌历史数据查询完成，共${Object.keys(brandHistoricalDataMap).length}个品牌`);
    console.log('='.repeat(80) + '\n');
    
    // 🔥 将历史数据附加到品牌数据对象中
    brandData.forEach(brand => {
      brand.historicalData = brandHistoricalDataMap[brand.customerno] || {
        lastMonth: { totalOrders: 0, performanceMetrics: {} },
        lastYear: { totalOrders: 0, performanceMetrics: {} }
      };
    });

    // 平台分布查询 - 🔥 JOIN VIEW_TSK_LIST_TASK视图获取PLATFORM_CLASS字段
    const platformQuery = `
      SELECT 
        COALESCE(v.PLATFORM_CLASS, '未知平台') as platform_class,
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('95','93') THEN t.TSK_MERGE_NO END) as delivered_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '40' THEN t.TSK_MERGE_NO END) as forwarded_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('100', '105') THEN t.TSK_MERGE_NO END) as returned_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('90', '110') THEN t.TSK_MERGE_NO END) as cancelled_count,
        (
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END)
        ) as exception_count,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_time
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY COALESCE(v.PLATFORM_CLASS, '未知平台')
      ORDER BY order_count DESC
    `;

    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    const platformQueryParams = { dateFrom, dateTo };
    
    Object.keys(baseParams).forEach(key => {
      if (key.startsWith('brand')) {
        platformQueryParams[key] = baseParams[key];
      }
    });
    
    if (platform && platform !== 'all') {
      platformQueryParams.platform = baseParams.platform;
    }
    if (baseParams.selfFlag) {
      platformQueryParams.selfFlag = baseParams.selfFlag;
    }

    const platformStartTime = Date.now();
    const platformResult = await connection.execute(platformQuery, platformQueryParams);
    const platformEndTime = Date.now();
    console.log(`✅ [平台分析] 查询完成，耗时: ${platformEndTime - platformStartTime}ms`);
    
    const platformData = platformResult.rows.map(row => ({
      platformClass: row[0] || '未知平台', // 🔥 修复：UDF1 字段（如 天猫, 京东, 抖音）
      orderCount: row[1] || 0,
      pickedCount: row[2] || 0,
      shippedCount: row[3] || 0,
      deliveredCount: row[4] || 0,
      forwardedCount: row[5] || 0,
      returnedCount: row[6] || 0,
      cancelledCount: row[7] || 0,
      exceptionCount: row[8] || 0,
      avgDeliveryTime: row[9] || 0,  // 🔥 修复：平均配送时间索引调整
      // 计算各状态比率
      pickedRate: (row[1] && row[2]) ? Math.round((row[2] / row[1]) * 100 * 100) / 100 : 0,
      shippedRate: (row[1] && row[3]) ? Math.round((row[3] / row[1]) * 100 * 100) / 100 : 0,
      deliveryRate: (row[1] && row[4]) ? Math.round((row[4] / row[1]) * 100 * 100) / 100 : 0,
      forwardedRate: (row[1] && row[5]) ? Math.round((row[5] / row[1]) * 100 * 100) / 100 : 0,
      returnedRate: (row[1] && row[6]) ? Math.round((row[6] / row[1]) * 100 * 100) / 100 : 0,
      cancelledRate: (row[1] && row[7]) ? Math.round((row[7] / row[1]) * 100 * 100) / 100 : 0,
      exceptionRate: (row[1] && row[8]) ? Math.round((row[8] / row[1]) * 100 * 100) / 100 : 0
    }));

    // 🔥 快递公司统计查询 - 为快递公司订单占比组件提供数据
    const courierQuery = `
      SELECT 
        t.CARRIERID as courier_id,
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('95','93') THEN t.TSK_MERGE_NO END) as delivered_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '40' THEN t.TSK_MERGE_NO END) as forwarded_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('100', '105') THEN t.TSK_MERGE_NO END) as returned_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('90', '110') THEN t.TSK_MERGE_NO END) as cancelled_count,
        (
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) +
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END)
        ) as exception_count,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_time,
        ROUND((
          COUNT(CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN 1 END) +
          COUNT(CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN 1 END) +
          COUNT(CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN 1 END) +
          COUNT(CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN 1 END)
        ) * 100.0 / NULLIF(COUNT(*), 0), 2) as timeout_48h_rate
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        AND t.CARRIERID IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CARRIERID
      HAVING COUNT(DISTINCT t.TSK_MERGE_NO) > 0
      ORDER BY order_count DESC
    `;

    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    const courierQueryParams = { dateFrom, dateTo };
    
    Object.keys(baseParams).forEach(key => {
      if (key.startsWith('brand')) {
        courierQueryParams[key] = baseParams[key];
      }
    });
    
    if (platform && platform !== 'all') {
      courierQueryParams.platform = baseParams.platform;
    }
    if (baseParams.selfFlag) {
      courierQueryParams.selfFlag = baseParams.selfFlag;
    }

    const courierStartTime = Date.now();
    const courierResult = await connection.execute(courierQuery, courierQueryParams);
    const courierEndTime = Date.now();
    console.log(`✅ [快递商分析] 查询完成，耗时: ${courierEndTime - courierStartTime}ms`);
    
    // 计算快递公司总订单数用于百分比计算
    const totalCourierOrders = courierResult.rows.reduce((sum, row) => sum + (row[1] || 0), 0);
    
    const courierData = courierResult.rows.map(row => ({
      carrierId: row[0] || 'UNKNOWN',
      orderCount: row[1] || 0,
      pickedCount: row[2] || 0,
      shippedCount: row[3] || 0,
      deliveredCount: row[4] || 0,
      forwardedCount: row[5] || 0,
      returnedCount: row[6] || 0,
      cancelledCount: row[7] || 0,
      exceptionCount: row[8] || 0,
      avgDeliveryTime: row[9] || 0,
      timeout48hRate: row[10] || 0,
      // 计算各状态比率
      pickedRate: (row[1] && row[2]) ? Math.round((row[2] / row[1]) * 100 * 100) / 100 : 0,
      shippedRate: (row[1] && row[3]) ? Math.round((row[3] / row[1]) * 100 * 100) / 100 : 0,
      deliveryRate: (row[1] && row[4]) ? Math.round((row[4] / row[1]) * 100 * 100) / 100 : 0,
      forwardedRate: (row[1] && row[5]) ? Math.round((row[5] / row[1]) * 100 * 100) / 100 : 0,
      returnedRate: (row[1] && row[6]) ? Math.round((row[6] / row[1]) * 100 * 100) / 100 : 0,
      cancelledRate: (row[1] && row[7]) ? Math.round((row[7] / row[1]) * 100 * 100) / 100 : 0,
      exceptionRate: (row[1] && row[8]) ? Math.round((row[8] / row[1]) * 100 * 100) / 100 : 0,
      // 计算在所有快递公司中的占比
      percentage: totalCourierOrders > 0 ? Math.round(((row[1] || 0) / totalCourierOrders * 100) * 100) / 100 : 0
    }));

    // 🔥 品牌×平台交叉分析查询 - 按PLATFORM_CLASS汇总，而不是PLATFORM详细值
    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    const crossAnalysisQueryParams = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };
    
    // 复制所有 brand 相关参数（支持 brand0, brand1, brand2, ... 或单个 brand）
    Object.keys(baseParams).forEach(key => {
      if (key.startsWith('brand') || key.startsWith('userBrand')) {
        crossAnalysisQueryParams[key] = baseParams[key];
      }
    });
    
    // 🔥 修复：从baseParams获取platform参数（buildFiltersAsync已添加到baseParams）
    if (platform && platform !== 'all' && baseParams.platform) {
      crossAnalysisQueryParams.platform = baseParams.platform;
    }
    
    // 🔥 修复：从baseParams获取selfFlag参数（buildFiltersAsync已添加到baseParams）
    if (baseParams.selfFlag) {
      crossAnalysisQueryParams.selfFlag = baseParams.selfFlag;
    }

    const crossAnalysisQuery = `
      SELECT 
        t.CUSTOMERNO,
        ${QueryUtils.getBrandNameColumn()},
        COALESCE(v.PLATFORM_CLASS, '未知平台') as platform_class,
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('95','93') THEN t.TSK_MERGE_NO END) as delivered_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '40' THEN t.TSK_MERGE_NO END) as forwarded_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('100', '105') THEN t.TSK_MERGE_NO END) as returned_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('90', '110') THEN t.TSK_MERGE_NO END) as cancelled_orders,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_time,
        -- 🔥 新增：首派成功率（签收时间-首派时间<8H阈值的订单比例）
        ROUND(
          COUNT(DISTINCT CASE 
            WHEN t.DIS_STATUS IN ('95','93') 
              AND v.DISP_TIME_T IS NOT NULL 
              AND v.DELIVERY_TIME_C IS NOT NULL
              AND (TO_DATE(v.DELIVERY_TIME_C, 'YYYY-MM-DD HH24:MI:SS') - TO_DATE(v.DISP_TIME_T, 'YYYY-MM-DD HH24:MI:SS')) * 24 <= 8
            THEN t.TSK_MERGE_NO 
          END) * 100.0 / 
          NULLIF(COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('95','93') AND v.DISP_TIME_T IS NOT NULL AND v.DELIVERY_TIME_C IS NOT NULL THEN t.TSK_MERGE_NO END), 0), 
          2
        ) as first_dispatch_success_rate,
        -- 🔥 新增：平均首派时长（DELIVERY_TIME_C - DISP_TIME_T，VARCHAR2转DATE后计算）
        ROUND(
          AVG(
            CASE 
              WHEN t.DIS_STATUS IN ('95','93') 
                AND v.DISP_TIME_T IS NOT NULL 
                AND v.DELIVERY_TIME_C IS NOT NULL
              THEN (TO_DATE(v.DELIVERY_TIME_C, 'YYYY-MM-DD HH24:MI:SS') - TO_DATE(v.DISP_TIME_T, 'YYYY-MM-DD HH24:MI:SS')) * 24
              ELSE NULL 
            END
          ), 
          2
        ) as avg_first_dispatch_hours,
        -- 🔥 新增：平均配送时长（直接使用SUM_SEND_TIME2字段的平均值）
        ROUND(
          AVG(
            CASE 
              WHEN t.DIS_STATUS IN ('95','93') AND t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0
              THEN t.SUM_SEND_TIME2
              ELSE NULL
            END
          ),
          2
        ) as avg_delivery_hours
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      ${QueryUtils.getBrandJoin('t')}
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        ${brand && brand !== 'all' ? brandFilter : ''}
        ${platform && platform !== 'all' ? platformFilter : ''}
        ${selfFlagFilter}
      GROUP BY t.CUSTOMERNO, bc_brand.COMPANY_ABNAME, COALESCE(v.PLATFORM_CLASS, '未知平台')
      HAVING COUNT(DISTINCT t.TSK_MERGE_NO) > 0
      ORDER BY brand_name, total_orders DESC
    `;

    console.log('🔄 [交叉分析] 执行品牌×平台交叉查询（从VIEW_TSK_LIST_TASK获取PLATFORM_CLASS）');
    console.log('📊 [交叉分析] brandFilter:', brandFilter);
    console.log('📊 [交叉分析] platformFilter:', platformFilter);
    
    const crossAnalysisStartTime = Date.now();
    const crossAnalysisResult = await connection.execute(crossAnalysisQuery, crossAnalysisQueryParams);
    const crossAnalysisEndTime = Date.now();
    
    console.log(`✅ [交叉分析] 查询完成，耗时: ${crossAnalysisEndTime - crossAnalysisStartTime}ms`);
    console.log('✅ [交叉分析] 查询结果条数:', crossAnalysisResult.rows.length);
    
    // 🔍 调试：打印第一行原始数据
    if (crossAnalysisResult.rows.length > 0) {
      console.log('🔍 [交叉分析] 第一行原始数据:', crossAnalysisResult.rows[0]);
      console.log('🔍 [交叉分析] 字段索引映射:');
      console.log('  row[10] = avgDeliveryTime:', crossAnalysisResult.rows[0][10]);
      console.log('  row[11] = firstDispatchSuccessRate:', crossAnalysisResult.rows[0][11]);
      console.log('  row[12] = avgFirstDispatchHours:', crossAnalysisResult.rows[0][12]);
      console.log('  row[13] = avgDeliveryHours:', crossAnalysisResult.rows[0][13]);
    }
    
    // 处理查询结果 - platformClass已经是平台显示名称，直接使用
    const crossAnalysisData = crossAnalysisResult.rows.map(row => ({
      customerno: row[0],
      brandName: row[1],
      platformClass: row[2] || '未知平台',  // 平台名称（如 天猫, 京东, 抖音）- 直接来自视图
      totalOrders: row[3] || 0,
      pickedOrders: row[4] || 0,
      shippedOrders: row[5] || 0,
      deliveredOrders: row[6] || 0,
      forwardedOrders: row[7] || 0,
      returnedOrders: row[8] || 0,
      cancelledOrders: row[9] || 0,
      avgDeliveryTime: row[10] || 0,
      // 🔥 新增：效率指标
      firstDispatchSuccessRate: row[11] || 0,  // 首派成功率（%）
      avgFirstDispatchHours: row[12] || 0,      // 平均首派时长（小时）
      avgDeliveryHours: row[13] || 0            // 平均签收时长（小时）
    }));
    
    // 🔍 调试：打印处理后的第一条数据
    if (crossAnalysisData.length > 0) {
      console.log('🔍 [交叉分析] 处理后第一条数据:', {
        brand: crossAnalysisData[0].brandName,
        platform: crossAnalysisData[0].platformClass,
        totalOrders: crossAnalysisData[0].totalOrders,
        firstDispatchSuccessRate: crossAnalysisData[0].firstDispatchSuccessRate,
        avgFirstDispatchHours: crossAnalysisData[0].avgFirstDispatchHours,
        avgDeliveryHours: crossAnalysisData[0].avgDeliveryHours
      });
    }

    // 数据验证 - 确保交叉数据汇总后与品牌、平台数据一致
    const crossTotalByBrand = {};
    const crossTotalByPlatform = {};
    
    crossAnalysisData.forEach(item => {
      // 按品牌汇总
      if (!crossTotalByBrand[item.brandName]) {
        crossTotalByBrand[item.brandName] = 0;
      }
      crossTotalByBrand[item.brandName] += item.totalOrders;
      
      // 按平台汇总
      if (!crossTotalByPlatform[item.platformClass]) {
        crossTotalByPlatform[item.platformClass] = 0;
      }
      crossTotalByPlatform[item.platformClass] += item.totalOrders;
    });

    console.log('📊 [交叉分析] 数据验证:', {
      crossAnalysisRecords: crossAnalysisData.length,
      crossTotalOrders: crossAnalysisData.reduce((sum, item) => sum + item.totalOrders, 0),
      brandTotalsFromCross: crossTotalByBrand,
      platformTotalsFromCross: crossTotalByPlatform,
      sampleCrossData: crossAnalysisData.slice(0, 5).map(item => ({
        brand: item.brandName,
        platform: item.platformClass,
        orders: item.totalOrders,
        shipped: item.shippedOrders
      }))
    });

    // 🔥 异常监控统计查询 - 基于具体的时间和状态条件
    const exceptionQueryParams = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };
    
    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    Object.keys(baseParams).forEach(key => {
      if (key.startsWith('brand')) {
        exceptionQueryParams[key] = baseParams[key];
      }
    });
    
    if (platform && platform !== 'all') {
      exceptionQueryParams.platform = baseParams.platform;
    }

    const exceptionQuery = `
      SELECT 
        -- 超时未揽收：WMS_OUTBOUND_TIME后2小时，DIS_STATUS仍为'00'(已出库)
        COUNT(CASE 
          WHEN t.DIS_STATUS = '00' 
           AND t.WMS_OUTBOUND_TIME IS NOT NULL 
           AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2 
          THEN 1 
        END) as pickup_timeout_count,
        
        -- 超时未发运：WMS_OUTBOUND_TIME后12小时，DIS_STATUS仍为'55'(已揽收)
        COUNT(CASE 
          WHEN t.DIS_STATUS = '55' 
           AND t.WMS_OUTBOUND_TIME IS NOT NULL 
           AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12 
          THEN 1 
        END) as shipping_timeout_count,
        
        -- 超时未签收：IF_DELAY字段值存在且为'Y'的订单
        COUNT(CASE 
          WHEN v.IF_DELAY = 'Y' 
          THEN 1 
        END) as delivery_timeout_count,
        
        -- 超48H未更新：IS48H_FLAG字段值存在且为'Y'的订单
        COUNT(CASE 
          WHEN t.IS48H_FLAG = 'Y' 
          THEN 1 
        END) as update_timeout_count
        
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      WHERE (
        (t.WMS_OUTBOUND_TIME IS NOT NULL AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
        OR
        (t.WMS_OUTBOUND_TIME IS NULL AND t.PAYMENTDATE_D IS NOT NULL AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') >= :dateFrom AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') <= :dateTo)
      )
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
        ${platformFilter}
    `;

    console.log('执行异常监控查询，参数:', exceptionQueryParams);
    const exceptionResult = await connection.execute(exceptionQuery, exceptionQueryParams);
    console.log('异常监控查询结果:', exceptionResult.rows[0]);
    
    const exceptionData = exceptionResult.rows[0];
    const exceptionsStatistics = {
      pickupTimeouts: exceptionData[0] || 0,      // 超时未揽收
      shippingTimeouts: exceptionData[1] || 0,    // 超时未发运
      deliveryTimeouts: exceptionData[2] || 0,    // 超时未签收
      noUpdate48h: exceptionData[3] || 0          // 超48H未更新
    };

    console.log('📊 数据汇总完成（含交叉分析和异常监控）');

    // 返回完整的KPI数据，包含快递公司统计、交叉分析数据、异常监控统计和同比环比数据
    const response = {
      success: true,
      data: {
        kpi: {
          totalOrders: kpiData[0] || 0,
          timeout48hOrders: kpiData[1] || 0,
          pickedOrders: kpiData[2] || 0,
          shippedOrders: kpiData[3] || 0,
          deliveredOrders: kpiData[4] || 0,
          forwardedOrders: kpiData[5] || 0,
          returnedOrders: kpiData[6] || 0,
          cancelledOrders: kpiData[7] || 0,
          avgDeliveryHours: kpiData[8] || 0,
          avgFirstDispatchHours: kpiData[9] || 0,
          firstDispatchSuccessRate: kpiData[10] || 0,
          pickedRate: kpiData[11] || 0,
          shippedRate: kpiData[12] || 0,
          deliveryRate: kpiData[13] || 0,
          exceptionRate: kpiData[14] || 0,
          timeout48hRate: kpiData[15] || 0,
          // 🔥 新增：历史数据和同比环比增长率
          lastMonthOrders: historicalData.lastMonth.totalOrders,
          lastYearOrders: historicalData.lastYear.totalOrders,
          momGrowth: momGrowthRates.totalOrders,
          yoyGrowth: yoyGrowthRates.totalOrders,
          // 🔥 新增：各指标的同比环比数据
          growthRates: {
            totalOrders: { mom: momGrowthRates.totalOrders, yoy: yoyGrowthRates.totalOrders },
            forwardedOrders: { mom: momGrowthRates.forwardedOrders, yoy: yoyGrowthRates.forwardedOrders },
            returnedOrders: { mom: momGrowthRates.returnedOrders, yoy: yoyGrowthRates.returnedOrders },
            cancelledOrders: { mom: momGrowthRates.cancelledOrders, yoy: yoyGrowthRates.cancelledOrders },
            avgDeliveryHours: { mom: momGrowthRates.avgDeliveryHours, yoy: yoyGrowthRates.avgDeliveryHours },
            avgFirstDispatchHours: { mom: momGrowthRates.avgFirstDispatchHours, yoy: yoyGrowthRates.avgFirstDispatchHours },
            firstDispatchSuccessRate: { mom: momGrowthRates.firstDispatchSuccessRate, yoy: yoyGrowthRates.firstDispatchSuccessRate }
          }
        },
        brandDistribution: brandData,
        platformDistribution: platformData,
        courierDistribution: courierData, // 🔥 新增：快递公司分布数据
        crossAnalysisData: crossAnalysisData, // 🔥 新增：品牌×平台交叉分析数据
        exceptionStats: exceptionsStatistics, // 🔥 新增：专门的异常监控统计数据
        // 🔥 新增：完整的历史数据，支持前端详细分析
        historicalData: historicalData
      },
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom: dateFrom,
        dateTo: dateTo,
        brand: brand || 'all',
        platform: platform || 'all'
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ [KPI查询] 查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error.message || 'KPI数据查询失败',
      timestamp: new Date().toISOString()
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('❌ [KPI查询] 关闭数据库连接失败:', closeError);
      }
    }
  }
});

/**
 * 获取订单状态流向与异常分类分析数据
 * GET /api/overview/status-flow-analysis
 */
router.get('/status-flow-analysis', async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag, userBrands } = req.query;
    
    console.log('🔄 [Flow Analysis查询] 收到请求参数:', { dateFrom, dateTo, brand, platform, selfFlag, userBrands });
    
    // 参数验证
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: '缺少必需的日期参数',
        message: '请提供dateFrom和dateTo参数'
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        error: '日期格式无效',
        message: '请提供有效的YYYY-MM-DD格式日期'
      });
    }

    connection = await getConnection();
    
    // 🔧 解析userBrands参数（可能是字符串或数组）
    let parsedUserBrands = null;
    if (userBrands) {
      if (Array.isArray(userBrands)) {
        parsedUserBrands = userBrands;
      } else if (typeof userBrands === 'string') {
        try {
          parsedUserBrands = JSON.parse(userBrands);
        } catch (e) {
          parsedUserBrands = userBrands.split(',').map(b => b.trim());
        }
      }
      console.log('🔐 [Flow Analysis查询] 解析后的userBrands:', parsedUserBrands);
    }
    
    // 基础参数
    const baseParams = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };
    
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(baseParams, brand, platform, selfFlag, parsedUserBrands);

    // 订单流向分析查询 - 按状态分组统计
    const flowAnalysisQuery = `
      SELECT 
        t.DIS_STATUS,
        bs.CODENAME_C as status_name,
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        ROUND(COUNT(DISTINCT t.TSK_MERGE_NO) * 100.0 / 
              (SELECT COUNT(DISTINCT t2.TSK_MERGE_NO) 
               FROM APP_CMS.TSK_LIST_TASK t2
               LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v2 ON t2.TSK_MERGE_NO = v2.TSK_MERGE_NO
               WHERE (
                 (t2.WMS_OUTBOUND_TIME IS NOT NULL AND to_char(t2.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom AND to_char(t2.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
                 OR
                 (t2.WMS_OUTBOUND_TIME IS NULL AND t2.PAYMENTDATE_D IS NOT NULL AND to_char(t2.PAYMENTDATE_D,'yyyy-mm-dd') >= :dateFrom AND to_char(t2.PAYMENTDATE_D,'yyyy-mm-dd') <= :dateTo)
               )
                 AND t2.TSK_MERGE_NO IS NOT NULL
                 ${brandFilter.replace(/t\./g, 't2.')}
                 ${platformFilter.replace(/v\./g, 'v2.')}
                 ${selfFlagFilter.replace(/t\./g, 't2.')}
              ), 2) as percentage
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      LEFT JOIN APP_CMS.BAS_CODES bs ON t.DIS_STATUS = bs.CODE AND bs.CODEID = 'BL_STATUS'
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.DIS_STATUS, bs.CODENAME_C
      HAVING COUNT(DISTINCT t.TSK_MERGE_NO) > 0
      ORDER BY order_count DESC
    `;

    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    const flowQueryParams = { dateFrom, dateTo };
    
    Object.keys(baseParams).forEach(key => {
      if (key.startsWith('brand')) {
        flowQueryParams[key] = baseParams[key];
      }
    });
    
    if (platform && platform !== 'all') {
      flowQueryParams.platform = baseParams.platform;
    }
    if (baseParams.selfFlag) {
      flowQueryParams.selfFlag = baseParams.selfFlag;
    }

    const flowResult = await connection.execute(flowAnalysisQuery, flowQueryParams);
    const flowData = flowResult.rows.map(row => ({
      statusCode: row[0],
      statusName: row[1] || `状态${row[0]}`,
      orderCount: row[2] || 0,
      percentage: row[3] || 0
    }));

    // 异常分类分析查询 - 基于四种核心异常类型
    const exceptionAnalysisQuery = `
      WITH exception_stats AS (  
        SELECT 
          -- 超时未揽收
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) as pickup_timeout,
          -- 超时未发运
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) as shipping_timeout,
          -- 超时未签收
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) as delivery_timeout,
          -- 超48H未更新
          COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END) as no_update_48h,
          -- 总订单数
          COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders
        FROM APP_CMS.TSK_LIST_TASK t
        LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
        ${QueryUtils.BASE_WHERE_CONDITIONS}
          ${brandFilter}
          ${platformFilter}
          ${selfFlagFilter}
      )
      SELECT 
        pickup_timeout,
        shipping_timeout,
        delivery_timeout,
        no_update_48h,
        total_orders,
        ROUND(pickup_timeout * 100.0 / NULLIF(total_orders, 0), 2) as pickup_timeout_rate,
        ROUND(shipping_timeout * 100.0 / NULLIF(total_orders, 0), 2) as shipping_timeout_rate,
        ROUND(delivery_timeout * 100.0 / NULLIF(total_orders, 0), 2) as delivery_timeout_rate,
        ROUND(no_update_48h * 100.0 / NULLIF(total_orders, 0), 2) as no_update_48h_rate
      FROM exception_stats
    `;

    const exceptionResult = await connection.execute(exceptionAnalysisQuery, flowQueryParams);
    const exceptionData = exceptionResult.rows[0];

    console.log('📊 订单流向与异常分析数据汇总完成');

    // 返回订单流向与异常分类分析数据
    const response = {
      success: true,
      data: {
        flowAnalysis: flowData,
        exceptionAnalysis: {
          pickupTimeout: exceptionData[0] || 0,
          shippingTimeout: exceptionData[1] || 0,
          deliveryTimeout: exceptionData[2] || 0,
          noUpdate48h: exceptionData[3] || 0,
          totalOrders: exceptionData[4] || 0,
          pickupTimeoutRate: exceptionData[5] || 0,
          shippingTimeoutRate: exceptionData[6] || 0,
          deliveryTimeoutRate: exceptionData[7] || 0,
          noUpdate48hRate: exceptionData[8] || 0
        },
        exceptionsStatistics: {
          pickupTimeout: exceptionData[0] || 0,
          shippingTimeout: exceptionData[1] || 0,
          deliveryTimeout: exceptionData[2] || 0,
          updateTimeout: exceptionData[3] || 0
        }
      },
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom: dateFrom,
        dateTo: dateTo,
        brand: brand || 'all',
        platform: platform || 'all'
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ [Flow Analysis查询] 查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error.message || '订单流向与异常分类分析数据查询失败',
      timestamp: new Date().toISOString()
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('❌ [Flow Analysis查询] 关闭数据库连接失败:', closeError);
      }
    }
  }
});

/**
 * 🔥 新增：获取VF子品牌×快递商×异常分类流向分析数据
 * GET /api/overview/flow-analysis
 * 
 * 为ImpactChart组件提供品牌×快递商×异常类型的详细流向分析数据
 * 支持Sankey图的数据可视化需求
 */
router.get('/flow-analysis', async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag, userBrands } = req.query;
    
    console.log('🔄 [品牌×快递商流向分析] 收到请求参数:', { dateFrom, dateTo, brand, platform, selfFlag, userBrands });
    
    // 参数验证
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: '缺少必需的日期参数',
        message: '请提供dateFrom和dateTo参数'
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        error: '日期格式无效',
        message: '请提供有效的YYYY-MM-DD格式日期'
      });
    }

    connection = await getConnection();
    
    // 🔧 解析userBrands参数（可能是字符串或数组）
    let parsedUserBrands = null;
    if (userBrands) {
      if (Array.isArray(userBrands)) {
        parsedUserBrands = userBrands;
      } else if (typeof userBrands === 'string') {
        try {
          parsedUserBrands = JSON.parse(userBrands);
        } catch (e) {
          parsedUserBrands = userBrands.split(',').map(b => b.trim());
        }
      }
      console.log('🔐 [品牌×快递商流向分析] 解析后的userBrands:', parsedUserBrands);
    }
    
    // 基础参数
    const baseParams = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };
    
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(baseParams, brand, platform, selfFlag, parsedUserBrands);

    // 🔥 核心查询：品牌×快递商×异常分类流向分析（✅ 从数据库查询品牌名称）
    const flowAnalysisQuery = `
      SELECT 
        ${QueryUtils.getBrandNameColumn()},
        t.CARRIERID as courier_id,
        COUNT(DISTINCT t.TSK_MERGE_NO) as total_orders,
        -- 四种核心异常类型统计
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) as pickup_timeout_orders,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) as shipping_timeout_orders,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) as delivery_timeout_orders,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END) as update_timeout_orders,
        -- 各订单状态统计
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '00' THEN t.TSK_MERGE_NO END) as outbound_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('95','93') THEN t.TSK_MERGE_NO END) as delivered_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '40' THEN t.TSK_MERGE_NO END) as forwarded_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('100', '105') THEN t.TSK_MERGE_NO END) as returned_orders,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('90', '110') THEN t.TSK_MERGE_NO END) as cancelled_orders,
        -- 平均时效
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_time
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      ${QueryUtils.getBrandJoin('t')}
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        AND t.CARRIERID IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CUSTOMERNO, bc_brand.COMPANY_ABNAME, t.CARRIERID
      HAVING COUNT(DISTINCT t.TSK_MERGE_NO) > 0
      ORDER BY brand_name, total_orders DESC
    `;

    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    const flowQueryParams = { dateFrom, dateTo };
    
    Object.keys(baseParams).forEach(key => {
      if (key.startsWith('brand')) {
        flowQueryParams[key] = baseParams[key];
      }
    });
    
    if (platform && platform !== 'all') {
      flowQueryParams.platform = baseParams.platform;
    }
    if (baseParams.selfFlag) {
      flowQueryParams.selfFlag = baseParams.selfFlag;
    }

    const flowResult = await connection.execute(flowAnalysisQuery, flowQueryParams);
    const flowAnalysisData = flowResult.rows.map(row => ({
      brandName: row[0],
      courierId: row[1],
      totalOrders: row[2] || 0,
      pickupTimeoutOrders: row[3] || 0,
      shippingTimeoutOrders: row[4] || 0,
      deliveryTimeoutOrders: row[5] || 0,
      updateTimeoutOrders: row[6] || 0,
      outboundOrders: row[7] || 0,
      pickedOrders: row[8] || 0,
      shippedOrders: row[9] || 0,
      deliveredOrders: row[10] || 0,
      forwardedOrders: row[11] || 0,
      returnedOrders: row[12] || 0,
      cancelledOrders: row[13] || 0,
      avgDeliveryTime: row[14] || 0,
      // 计算异常率
      exceptionRate: row[2] > 0 ? Math.round(((row[3] + row[4] + row[5] + row[6]) / row[2] * 100) * 100) / 100 : 0,
      // 计算各异常类型比率
      pickupTimeoutRate: row[2] > 0 ? Math.round((row[3] / row[2] * 100) * 100) / 100 : 0,
      shippingTimeoutRate: row[2] > 0 ? Math.round((row[4] / row[2] * 100) * 100) / 100 : 0,
      deliveryTimeoutRate: row[2] > 0 ? Math.round((row[5] / row[2] * 100) * 100) / 100 : 0,
      updateTimeoutRate: row[2] > 0 ? Math.round((row[6] / row[2] * 100) * 100) / 100 : 0
    }));

    // 汇总统计
    const overallStats = {
      totalOrders: flowAnalysisData.reduce((sum, item) => sum + item.totalOrders, 0),
      activeBrands: new Set(flowAnalysisData.map(item => item.brandName)).size,
      activeCouriers: new Set(flowAnalysisData.map(item => item.courierId)).size,
      totalExceptions: flowAnalysisData.reduce((sum, item) => 
        sum + item.pickupTimeoutOrders + item.shippingTimeoutOrders + 
        item.deliveryTimeoutOrders + item.updateTimeoutOrders, 0),
      overallExceptionRate: 0 // 后面计算
    };

    overallStats.overallExceptionRate = overallStats.totalOrders > 0 ? 
      Math.round((overallStats.totalExceptions / overallStats.totalOrders * 100) * 100) / 100 : 0;

    // 快递商汇总统计
    const courierSummary = {};
    flowAnalysisData.forEach(item => {
      if (!courierSummary[item.courierId]) {
        courierSummary[item.courierId] = {
          courierId: item.courierId,
          totalOrders: 0,
          totalExceptions: 0,
          avgDeliveryTime: 0,
          avgExceptionRate: 0,
          deliveryTimes: []
        };
      }
      const courier = courierSummary[item.courierId];
      courier.totalOrders += item.totalOrders;
      courier.totalExceptions += (item.pickupTimeoutOrders + item.shippingTimeoutOrders + 
                                 item.deliveryTimeoutOrders + item.updateTimeoutOrders);
      if (item.avgDeliveryTime > 0) {
        courier.deliveryTimes.push(item.avgDeliveryTime);
      }
    });

    // 计算快递商平均值
    const courierSummaryArray = Object.values(courierSummary).map(courier => ({
      courierId: courier.courierId,
      totalOrders: courier.totalOrders,
      totalExceptions: courier.totalExceptions,
      avgExceptionRate: courier.totalOrders > 0 ? 
        Math.round((courier.totalExceptions / courier.totalOrders * 100) * 100) / 100 : 0,
      avgDeliveryTime: courier.deliveryTimes.length > 0 ? 
        Math.round((courier.deliveryTimes.reduce((sum, time) => sum + time, 0) / courier.deliveryTimes.length) * 100) / 100 : 0
    }));

    console.log('📊 [品牌×快递商流向分析] 数据汇总完成:', {
      flowRecords: flowAnalysisData.length,
      totalOrders: overallStats.totalOrders,
      activeBrands: overallStats.activeBrands,
      activeCouriers: overallStats.activeCouriers,
      overallExceptionRate: overallStats.overallExceptionRate
    });

    // 返回完整的流向分析数据
    const response = {
      success: true,
      data: {
        flowAnalysisData: flowAnalysisData,
        overallStats: overallStats,
        courierSummary: courierSummaryArray
      },
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom: dateFrom,
        dateTo: dateTo,
        brand: brand || 'all',
        platform: platform || 'all'
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ [品牌×快递商流向分析] 查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error.message || '品牌×快递商流向分析数据查询失败',
      timestamp: new Date().toISOString()
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('❌ [品牌×快递商流向分析] 关闭数据库连接失败:', closeError);
      }
    }
  }
});

module.exports = router;