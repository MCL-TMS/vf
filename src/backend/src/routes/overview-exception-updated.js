/**
 * VF物流数据分析平台 - 总览界面API路由（异常监控条件更新版）
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

// 🔧 共享工具函数 - 避免重复代码
const QueryUtils = {
  // 品牌映射配置
  BRAND_MAPPING: {
    'DICKIES': '18405',
    'TNF': '18405-1', 
    'ICEBREAKER': '18405-2',
    'VANS': '18405-3',
    'TIMBERLAND': '18405-4',
    'SMARTWOOL': '18405-5'
  },

  // 品牌名称映射SQL片段
  BRAND_NAME_CASE_SQL: `
    CASE t.CUSTOMERNO
      WHEN '18405' THEN 'DICKIES'
      WHEN '18405-1' THEN 'TNF'
      WHEN '18405-2' THEN 'ICEBREAKER'
      WHEN '18405-3' THEN 'VANS'
      WHEN '18405-4' THEN 'TIMBERLAND'
      WHEN '18405-5' THEN 'SMARTWOOL'
      ELSE t.CUSTOMERNO
    END`,

  // 基础WHERE条件 - 日期和品牌筛选
  BASE_WHERE_CONDITIONS: `
    WHERE (
      (t.WMS_OUTBOUND_TIME IS NOT NULL AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
      OR
      (t.WMS_OUTBOUND_TIME IS NULL AND t.PAYMENTDATE_D IS NOT NULL AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') >= :dateFrom AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') <= :dateTo)
    )
      AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')
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
    // 超时未揽收: WMS_OUTBOUND_TIME后2小时，DIS_STATUS仍为'00'(已出库)
    PICKUP_TIMEOUT: `(
      t.WMS_OUTBOUND_TIME IS NOT NULL 
      AND t.DIS_STATUS = '00' 
      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2
    )`,
    
    // 超时未发运: WMS_OUTBOUND_TIME后12小时，DIS_STATUS仍为'55'(已揽收)
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

  // 构建筛选条件和参数 - 支持多品牌数组
  buildFilters(queryParams, brand, platform, selfFlag) {
    let brandFilter = '';
    let platformFilter = '';
    let selfFlagFilter = '';
    
    // 🔐 品牌筛选：支持单个品牌、多个品牌（数组）
    if (brand && brand !== 'all') {
      if (Array.isArray(brand)) {
        // 多个品牌：使用 IN 查询
        const brandCodes = brand.map(b => this.BRAND_MAPPING[b] || b);
        const placeholders = brandCodes.map((_, index) => `:brand${index}`).join(', ');
        brandFilter = ` AND t.CUSTOMERNO IN (${placeholders})`;
        
        // 绑定每个品牌参数
        brandCodes.forEach((code, index) => {
          queryParams[`brand${index}`] = code;
        });
        
        console.log(`🏷️ [Brand Filter] 多品牌筛选 (${brandCodes.length}个):`, brandCodes);
      } else {
        // 单个品牌：使用 = 查询
        brandFilter = ` AND t.CUSTOMERNO = :brand`;
        queryParams.brand = this.BRAND_MAPPING[brand] || brand;
        console.log(`🏷️ [Brand Filter] 单品牌筛选:`, queryParams.brand);
      }
    }
    
    if (platform && platform !== 'all') {
      platformFilter = ` AND v.PLATFORM_CLASS = :platform`;
      queryParams.platform = this.PLATFORM_MAPPING[platform] || platform;
      console.log(`🏪 [Platform Filter] 平台筛选映射: ${platform} -> ${queryParams.platform} (从VIEW_TSK_LIST_TASK视图获取)`);
    }
    
    // 🔥 修复：自管筛选条件 - 解决数据不一致问题
    if (selfFlag && selfFlag !== 'all') {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      queryParams.selfFlag = selfFlag;
      console.log(`🔧 [Self Flag Filter] 自管筛选: ${selfFlag}`);
    } else if (selfFlag === 'all') {
      // ❌ 修复：当选择"全部"时，不添加SELF_FLAG筛选条件
      selfFlagFilter = '';
      // 不设置 queryParams.selfFlag
      console.log(`🔧 [Self Flag Filter] 全部订单，无SELF_FLAG筛选: ${selfFlag}`);
    } else {
      // 仅当selfFlag为null/undefined时才默认为自管
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      queryParams.selfFlag = 'Y';
      console.log(`🔧 [Self Flag Filter] selfFlag为空，默认自管筛选: Y`);
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
    const { dateFrom, dateTo, brand, platform, selfFlag } = req.query;
    
    console.log('🔄 [KPI查询] 收到请求参数:', { dateFrom, dateTo, brand, platform, selfFlag });
    
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
    
    // 计算历史日期范围用于同比环比
    const momRange = DateHelper.calculateMoMDateRange(dateFrom, dateTo);
    const yoyRange = DateHelper.calculateYoYDateRange(dateFrom, dateTo);
    
    // 基础参数
    const baseParams = {
      dateFrom: dateFrom,
      dateTo: dateTo,
      lastMonthFrom: momRange.lastMonthFrom,
      lastMonthTo: momRange.lastMonthTo,
      lastYearFrom: yoyRange.lastYearFrom,
      lastYearTo: yoyRange.lastYearTo
    };
    
    const { brandFilter, platformFilter, selfFlagFilter } = QueryUtils.buildFilters(baseParams, brand, platform, selfFlag);

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
              (t.WMS_OUTBOUND_TIME IS NOT NULL AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
              OR
              (t.WMS_OUTBOUND_TIME IS NULL AND t.PAYMENTDATE_D IS NOT NULL AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') >= :dateFrom AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') <= :dateTo)
            ) THEN 'current'
            WHEN (
              (t.WMS_OUTBOUND_TIME IS NOT NULL AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :lastMonthFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :lastMonthTo)
              OR
              (t.WMS_OUTBOUND_TIME IS NULL AND t.PAYMENTDATE_D IS NOT NULL AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') >= :lastMonthFrom AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') <= :lastMonthTo)
            ) THEN 'last_month'
            WHEN (
              (t.WMS_OUTBOUND_TIME IS NOT NULL AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :lastYearFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :lastYearTo)
              OR
              (t.WMS_OUTBOUND_TIME IS NULL AND t.PAYMENTDATE_D IS NOT NULL AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') >= :lastYearFrom AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') <= :lastYearTo)
            ) THEN 'last_year'
          END as period_type
        FROM APP_CMS.TSK_LIST_TASK t
        LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
        LEFT JOIN APP_CMS.BAS_CODES bs ON t.DIS_STATUS = bs.CODE AND bs.CODEID = 'BL_STATUS'
        WHERE (
          (
            (t.WMS_OUTBOUND_TIME IS NOT NULL AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
            OR
            (t.WMS_OUTBOUND_TIME IS NULL AND t.PAYMENTDATE_D IS NOT NULL AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') >= :dateFrom AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') <= :dateTo)
          )
          OR
          (
            (t.WMS_OUTBOUND_TIME IS NOT NULL AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :lastMonthFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :lastMonthTo)
            OR
            (t.WMS_OUTBOUND_TIME IS NULL AND t.PAYMENTDATE_D IS NOT NULL AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') >= :lastMonthFrom AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') <= :lastMonthTo)
          )
          OR
          (
            (t.WMS_OUTBOUND_TIME IS NOT NULL AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :lastYearFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :lastYearTo)
            OR
            (t.WMS_OUTBOUND_TIME IS NULL AND t.PAYMENTDATE_D IS NOT NULL AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') >= :lastYearFrom AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') <= :lastYearTo)
          )
        )
          AND t.TSK_MERGE_NO IS NOT NULL
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
          COUNT(DISTINCT CASE WHEN DIS_STATUS = '95' THEN TSK_MERGE_NO END) as delivered_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS = '40' THEN TSK_MERGE_NO END) as forwarded_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS IN ('100', '105') THEN TSK_MERGE_NO END) as returned_orders,
          COUNT(DISTINCT CASE WHEN DIS_STATUS IN ('90', '110') THEN TSK_MERGE_NO END) as cancelled_orders,
          ROUND(AVG(CASE WHEN SUM_SEND_TIME2 IS NOT NULL AND SUM_SEND_TIME2 > 0 THEN SUM_SEND_TIME2 END), 2) as avg_delivery_hours,
          ROUND(AVG(CASE WHEN DIS_STATUS = '95' AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL 
                        THEN (DELIVERY_TIME - DISP_TIME) * 24 END), 2) as avg_first_dispatch_hours,
          ROUND(
            COUNT(CASE WHEN DIS_STATUS = '95' AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL 
                       AND (DELIVERY_TIME - DISP_TIME) * 24 <= 8 THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN DIS_STATUS = '95' AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL THEN 1 END), 0),
            2
          ) as first_dispatch_success_rate,
          ROUND(COUNT(CASE WHEN DIS_STATUS = '55' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as picked_rate,
          ROUND(COUNT(CASE WHEN DIS_STATUS = '70' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as shipped_rate,
          ROUND(COUNT(CASE WHEN DIS_STATUS = '95' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate,
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
          ROUND(AVG(CASE WHEN DIS_STATUS = '95' AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL 
                        THEN (DELIVERY_TIME - DISP_TIME) * 24 END), 2) as avg_first_dispatch_hours,
          ROUND(
            COUNT(CASE WHEN DIS_STATUS = '95' AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL 
                       AND (DELIVERY_TIME - DISP_TIME) * 24 <= 8 THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN DIS_STATUS = '95' AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL THEN 1 END), 0),
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
          ROUND(AVG(CASE WHEN DIS_STATUS = '95' AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL 
                        THEN (DELIVERY_TIME - DISP_TIME) * 24 END), 2) as avg_first_dispatch_hours,
          ROUND(
            COUNT(CASE WHEN DIS_STATUS = '95' AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL 
                       AND (DELIVERY_TIME - DISP_TIME) * 24 <= 8 THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN DIS_STATUS = '95' AND DISP_TIME IS NOT NULL AND DELIVERY_TIME IS NOT NULL THEN 1 END), 0),
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

    const kpiResult = await connection.execute(kpiQuery, baseParams);
    const kpiData = kpiResult.rows[0];
    
    // 计算同比环比增长率的辅助函数
    const calculateGrowthRate = (current, previous) => {
      if (!previous || previous === 0) return null;
      return Math.round(((current - previous) / previous * 100) * 100) / 100;
    };
    
    // 提取历史数据并计算同比环比
    const historicalData = {
      lastMonth: {
        totalOrders: kpiData[16] || 0,
        forwardedOrders: kpiData[17] || 0,
        returnedOrders: kpiData[18] || 0,
        cancelledOrders: kpiData[19] || 0,
        avgDeliveryHours: kpiData[20] || 0,
        avgFirstDispatchHours: kpiData[21] || 0,
        firstDispatchSuccessRate: kpiData[22] || 0,
        statusDistribution: [
          { statusCode: 40, orderCount: kpiData[17] || 0 },
          { statusCode: 100, orderCount: kpiData[18] || 0 },
          { statusCode: 90, orderCount: kpiData[19] || 0 }
        ],
        performanceMetrics: {
          avgDeliveryHours: kpiData[20] || 0,
          avgFirstDispatchHours: kpiData[21] || 0,
          firstDispatchSuccessRate: kpiData[22] || 0
        }
      },
      lastYear: {
        totalOrders: kpiData[23] || 0,
        forwardedOrders: kpiData[24] || 0,
        returnedOrders: kpiData[25] || 0,
        cancelledOrders: kpiData[26] || 0,
        avgDeliveryHours: kpiData[27] || 0,
        avgFirstDispatchHours: kpiData[28] || 0,
        firstDispatchSuccessRate: kpiData[29] || 0,
        statusDistribution: [
          { statusCode: 40, orderCount: kpiData[24] || 0 },
          { statusCode: 100, orderCount: kpiData[25] || 0 },
          { statusCode: 90, orderCount: kpiData[26] || 0 }
        ],
        performanceMetrics: {
          avgDeliveryHours: kpiData[27] || 0,
          avgFirstDispatchHours: kpiData[28] || 0,
          firstDispatchSuccessRate: kpiData[29] || 0
        }
      }
    };
    
    // 计算各指标的同比环比增长率
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

    // 品牌分布查询
    const brandQuery = `
      SELECT 
        t.CUSTOMERNO,
        ${QueryUtils.BRAND_NAME_CASE_SQL} as brand_name,
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '95' THEN t.TSK_MERGE_NO END) as delivered_count,
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
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CUSTOMERNO
      ORDER BY order_count DESC
    `;

    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    const brandQueryParams = { dateFrom, dateTo };
    Object.keys(baseParams).forEach(key => {
      if (key.startsWith('brand')) brandQueryParams[key] = baseParams[key];
    });
    if (platform && platform !== 'all') brandQueryParams.platform = baseParams.platform;
    if (baseParams.selfFlag) brandQueryParams.selfFlag = baseParams.selfFlag;

    const brandResult = await connection.execute(brandQuery, brandQueryParams);
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
      avgDeliveryTime: row[10] || 0,
      // 计算各状态比率
      pickedRate: (row[2] && row[3]) ? Math.round((row[3] / row[2]) * 100 * 100) / 100 : 0,
      shippedRate: (row[2] && row[4]) ? Math.round((row[4] / row[2]) * 100 * 100) / 100 : 0,
      deliveryRate: (row[2] && row[5]) ? Math.round((row[5] / row[2]) * 100 * 100) / 100 : 0,
      forwardedRate: (row[2] && row[6]) ? Math.round((row[6] / row[2]) * 100 * 100) / 100 : 0,
      returnedRate: (row[2] && row[7]) ? Math.round((row[7] / row[2]) * 100 * 100) / 100 : 0,
      cancelledRate: (row[2] && row[8]) ? Math.round((row[8] / row[2]) * 100 * 100) / 100 : 0,
      exceptionRate: (row[2] && row[9]) ? Math.round((row[9] / row[2]) * 100 * 100) / 100 : 0
    }));

    // 平台分布查询 - 🔥 JOIN VIEW_TSK_LIST_TASK视图获取PLATFORM_CLASS字段
    const platformQuery = `
      SELECT 
        COALESCE(v.PLATFORM_CLASS, '未知平台') as platform_class,
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '95' THEN t.TSK_MERGE_NO END) as delivered_count,
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
      if (key.startsWith('brand')) platformQueryParams[key] = baseParams[key];
    });
    if (platform && platform !== 'all') platformQueryParams.platform = baseParams.platform;
    if (baseParams.selfFlag) platformQueryParams.selfFlag = baseParams.selfFlag;

    const platformResult = await connection.execute(platformQuery, platformQueryParams);
    const platformData = platformResult.rows.map(row => ({
      platformClass: row[0] || '未知平台',  // 🔥 修复：UDF1 字段
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

    // 快递公司统计查询
    const courierQuery = `
      SELECT 
        t.CARRIERID as courier_id,
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '95' THEN t.TSK_MERGE_NO END) as delivered_count,
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
      if (key.startsWith('brand')) courierQueryParams[key] = baseParams[key];
    });
    if (platform && platform !== 'all') courierQueryParams.platform = baseParams.platform;
    if (baseParams.selfFlag) courierQueryParams.selfFlag = baseParams.selfFlag;

    const courierResult = await connection.execute(courierQuery, courierQueryParams);
    
    // 计算快递公司总订单数用于百分比计算
    const totalCourierOrders = courierResult.rows.reduce((sum, row) => sum + (row[1] || 0), 0);
    
    // 🔧 映射快递公司数据结构
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
      // 计算百分比
      percentage: totalCourierOrders > 0 ? Math.round((row[1] / totalCourierOrders) * 100 * 100) / 100 : 0,
      // 计算各状态比率
      pickedRate: (row[1] && row[2]) ? Math.round((row[2] / row[1]) * 100 * 100) / 100 : 0,
      shippedRate: (row[1] && row[3]) ? Math.round((row[3] / row[1]) * 100 * 100) / 100 : 0,
      deliveryRate: (row[1] && row[4]) ? Math.round((row[4] / row[1]) * 100 * 100) / 100 : 0,
      forwardedRate: (row[1] && row[5]) ? Math.round((row[5] / row[1]) * 100 * 100) / 100 : 0,
      returnedRate: (row[1] && row[6]) ? Math.round((row[6] / row[1]) * 100 * 100) / 100 : 0,
      cancelledRate: (row[1] && row[7]) ? Math.round((row[7] / row[1]) * 100 * 100) / 100 : 0,
      exceptionRate: (row[1] && row[8]) ? Math.round((row[8] / row[1]) * 100 * 100) / 100 : 0
    }));

    console.log('✅ [KPI查询] 查询成功，数据统计:', {
      totalOrders: kpiData[0],
      timeout48hOrders: kpiData[1],
      deliveredOrders: kpiData[4],
      exceptionRate: kpiData[14],
      brandCount: brandData.length,
      platformCount: platformData.length,
      courierCount: courierData.length
    });

    res.json({
      success: true,
      data: {
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
        
        brandData,
        platformData,
        courierData,
        
        // 🔥 新增：历史数据和增长率
        historicalData,
        growthRates: {
          mom: momGrowthRates,
          yoy: yoyGrowthRates
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
    });

  } catch (error) {
    console.error('KPI查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取KPI数据失败'
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