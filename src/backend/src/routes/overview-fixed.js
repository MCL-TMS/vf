/**
 * VF物流数据分析平台 - 总览界面API路由（修复版）
 * 
 * 提供总览仪表板所需的核心KPI指标和统计数据，包括快递公司统计查询
 * 支持品牌筛选、平台分析、时间范围查询等功能
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

  // ✅ 四种核心异常类型的SQL片段 - 基于具体业务条件
  EXCEPTION_SQL_FRAGMENTS: {
    // 超时未揽收: WMS_OUTBOUND_TIME后48小时，DIS_STATUS仍为'00'(已出库)
    PICKUP_TIMEOUT: `(
      t.WMS_OUTBOUND_TIME IS NOT NULL 
      AND t.DIS_STATUS = '00' 
      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 48
    )`,
    
    // 超时未发运: WMS_OUTBOUND_TIME后72小时，DIS_STATUS仍为'55'(已揽收)
    SHIPPING_TIMEOUT: `(
      t.WMS_OUTBOUND_TIME IS NOT NULL 
      AND t.DIS_STATUS = '55' 
      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 72
    )`,
    
    // 超时未签收: DISP_TIME后72小时，DIS_STATUS仍为'70'(已发运)
    DELIVERY_TIMEOUT: `(
      t.DISP_TIME IS NOT NULL 
      AND t.DIS_STATUS = '70' 
      AND (SYSDATE - t.DISP_TIME) * 24 > 72
    )`,
    
    // 超48H未更新: IS48H_FLAG字段值存在且为'Y'的订单
    NO_UPDATE_48H: `(t.IS48H_FLAG = 'Y')`
  },

  // 构建筛选条件和参数 - 支持多品牌数组
  buildFilters(queryParams, brand, platform) {
    let brandFilter = '';
    let platformFilter = '';
    
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
    
    return { brandFilter, platformFilter };
  }
};

/**
 * 获取总览KPI指标 - 包含快递公司统计
 * GET /api/overview/kpi
 */
router.get('/kpi', async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, platform } = req.query;
    
    console.log('🔄 [KPI查询] 收到请求参数:', { dateFrom, dateTo, brand, platform });
    
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
    
    const { brandFilter, platformFilter } = QueryUtils.buildFilters(baseParams, brand, platform);

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
            COUNT(CASE WHEN WMS_OUTBOUND_TIME IS NOT NULL AND DIS_STATUS = '00' AND (SYSDATE - WMS_OUTBOUND_TIME) * 24 > 48 THEN 1 END) +
            COUNT(CASE WHEN WMS_OUTBOUND_TIME IS NOT NULL AND DIS_STATUS = '55' AND (SYSDATE - WMS_OUTBOUND_TIME) * 24 > 72 THEN 1 END) +
            COUNT(CASE WHEN DISP_TIME IS NOT NULL AND DIS_STATUS = '70' AND (SYSDATE - DISP_TIME) * 24 > 72 THEN 1 END) +
            COUNT(CASE WHEN IS48H_FLAG = 'Y' THEN 1 END)
          ) * 100.0 / NULLIF(COUNT(*), 0), 2) as exception_rate,
          ROUND(COUNT(CASE WHEN IS48H_FLAG = 'Y' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as timeout_48h_rate
        FROM base_data 
        WHERE period_type = 'current'
      )
      SELECT * FROM current_stats
    `;

    const kpiResult = await connection.execute(kpiQuery, baseParams);
    const kpiData = kpiResult.rows[0];

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
      GROUP BY t.CUSTOMERNO
      ORDER BY order_count DESC
    `;

    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    const brandQueryParams = { dateFrom, dateTo };
    Object.keys(baseParams).forEach(key => {
      if (key.startsWith('brand')) brandQueryParams[key] = baseParams[key];
    });
    if (platform && platform !== 'all') brandQueryParams.platform = baseParams.platform;

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
      GROUP BY COALESCE(v.PLATFORM_CLASS, '未知平台')
      ORDER BY order_count DESC
    `;

    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    const platformQueryParams = { dateFrom, dateTo };
    Object.keys(baseParams).forEach(key => {
      if (key.startsWith('brand')) platformQueryParams[key] = baseParams[key];
    });
    if (platform && platform !== 'all') platformQueryParams.platform = baseParams.platform;

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

    // 🔥 快递公司统计查询 - 为快递公司订单占比组件提供数据
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

    const courierResult = await connection.execute(courierQuery, courierQueryParams);
    
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

    console.log('📊 数据汇总完成');

    // 返回完整的KPI数据，包含快递公司统计
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
          timeout48hRate: kpiData[15] || 0
        },
        brandDistribution: brandData,
        platformDistribution: platformData,
        courierDistribution: courierData // 🔥 新增：快递公司分布数据
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

module.exports = router;