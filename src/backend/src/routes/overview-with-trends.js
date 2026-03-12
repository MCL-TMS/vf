/**
 * VF物流数据分析平台 - 总览界面API路由（完整版含同比环比）
 * 
 * 提供总览仪表板所需的核心KPI指标和统计数据，包含真实的同比环比计算
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
 * 🔥 新增：获取包含同比环比数据的总览KPI指标
 * GET /api/overview/kpi-with-trends
 */
router.get('/kpi-with-trends', async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, platform } = req.query;
    
    console.log('🔄 [KPI+趋势查询] 收到请求参数:', { dateFrom, dateTo, brand, platform });
    
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
    
    console.log('📅 [KPI+趋势查询] 历史日期计算:', {
      current: { from: dateFrom, to: dateTo },
      lastMonth: momRange,
      lastYear: yoyRange
    });
    
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

    // 🔥 修复：核心KPI查询 - 包含真实的同比环比数据
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
          'current' as period,
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
      ),
      last_month_stats AS (
        SELECT 
          'last_month' as period,
          COUNT(DISTINCT TSK_MERGE_NO) as total_orders,
          ROUND((
            COUNT(CASE WHEN WMS_OUTBOUND_TIME IS NOT NULL AND DIS_STATUS = '00' AND (SYSDATE - WMS_OUTBOUND_TIME) * 24 > 48 THEN 1 END) +
            COUNT(CASE WHEN WMS_OUTBOUND_TIME IS NOT NULL AND DIS_STATUS = '55' AND (SYSDATE - WMS_OUTBOUND_TIME) * 24 > 72 THEN 1 END) +
            COUNT(CASE WHEN DISP_TIME IS NOT NULL AND DIS_STATUS = '70' AND (SYSDATE - DISP_TIME) * 24 > 72 THEN 1 END) +
            COUNT(CASE WHEN IS48H_FLAG = 'Y' THEN 1 END)
          ) * 100.0 / NULLIF(COUNT(*), 0), 2) as exception_rate
        FROM base_data 
        WHERE period_type = 'last_month'
      ),
      last_year_stats AS (
        SELECT 
          'last_year' as period,
          COUNT(DISTINCT TSK_MERGE_NO) as total_orders,
          ROUND((
            COUNT(CASE WHEN WMS_OUTBOUND_TIME IS NOT NULL AND DIS_STATUS = '00' AND (SYSDATE - WMS_OUTBOUND_TIME) * 24 > 48 THEN 1 END) +
            COUNT(CASE WHEN WMS_OUTBOUND_TIME IS NOT NULL AND DIS_STATUS = '55' AND (SYSDATE - WMS_OUTBOUND_TIME) * 24 > 72 THEN 1 END) +
            COUNT(CASE WHEN DISP_TIME IS NOT NULL AND DIS_STATUS = '70' AND (SYSDATE - DISP_TIME) * 24 > 72 THEN 1 END) +
            COUNT(CASE WHEN IS48H_FLAG = 'Y' THEN 1 END)
          ) * 100.0 / NULLIF(COUNT(*), 0), 2) as exception_rate
        FROM base_data 
        WHERE period_type = 'last_year'
      ),
      all_stats AS (
        SELECT * FROM current_stats
        UNION ALL
        SELECT period, total_orders, 0 as timeout_48h_orders, 0 as picked_orders, 0 as shipped_orders,
               0 as delivered_orders, 0 as forwarded_orders, 0 as returned_orders, 0 as cancelled_orders,
               0 as avg_delivery_hours, 0 as avg_first_dispatch_hours, 0 as first_dispatch_success_rate,
               0 as picked_rate, 0 as shipped_rate, 0 as delivery_rate, exception_rate, 0 as timeout_48h_rate
        FROM last_month_stats
        UNION ALL
        SELECT period, total_orders, 0 as timeout_48h_orders, 0 as picked_orders, 0 as shipped_orders,
               0 as delivered_orders, 0 as forwarded_orders, 0 as returned_orders, 0 as cancelled_orders,
               0 as avg_delivery_hours, 0 as avg_first_dispatch_hours, 0 as first_dispatch_success_rate,
               0 as picked_rate, 0 as shipped_rate, 0 as delivery_rate, exception_rate, 0 as timeout_48h_rate
        FROM last_year_stats
      )
      SELECT * FROM all_stats ORDER BY 
        CASE period
          WHEN 'current' THEN 1
          WHEN 'last_month' THEN 2
          WHEN 'last_year' THEN 3
        END
    `;

    console.log('🔄 [KPI+趋势查询] 开始执行包含同比环比数据的查询，参数:', baseParams);
    const kpiResult = await connection.execute(kpiQuery, baseParams);
    
    console.log('✅ [KPI+趋势查询] 查询结果行数:', kpiResult.rows.length);
    console.log('📊 [KPI+趋势查询] 原始查询结果:', {
      current: kpiResult.rows.find(row => row[0] === 'current'),
      lastMonth: kpiResult.rows.find(row => row[0] === 'last_month'),
      lastYear: kpiResult.rows.find(row => row[0] === 'last_year')
    });

    // 处理三个时期的数据
    const currentData = kpiResult.rows.find(row => row[0] === 'current') || [];
    const lastMonthData = kpiResult.rows.find(row => row[0] === 'last_month') || [];
    const lastYearData = kpiResult.rows.find(row => row[0] === 'last_year') || [];

    // 🔥 详细打印历史数据用于验证
    console.log('\n' + '='.repeat(80));
    console.log('📅 [历史数据验证] 当前期间数据:');
    console.log('='.repeat(80));
    console.log('  期间标识:', currentData[0]);
    console.log('  订单总数:', currentData[1]);
    console.log('  异常率:', currentData[15]);
    console.log('  48小时超时订单:', currentData[2]);
    
    console.log('\n' + '='.repeat(80));
    console.log('📅 [历史数据验证] 上个月同期数据 (环比基准):');
    console.log('='.repeat(80));
    console.log('  期间标识:', lastMonthData[0]);
    console.log('  订单总数:', lastMonthData[1]);
    console.log('  异常率:', lastMonthData[15]);
    console.log('  📌 用于环比计算的基准值');
    
    console.log('\n' + '='.repeat(80));
    console.log('📅 [历史数据验证] 去年同期数据 (同比基准):');
    console.log('='.repeat(80));
    console.log('  期间标识:', lastYearData[0]);
    console.log('  订单总数:', lastYearData[1]);
    console.log('  异常率:', lastYearData[15]);
    console.log('  📌 用于同比计算的基准值');
    console.log('='.repeat(80) + '\n');

    // 计算同比环比增长率
    const currentOrders = currentData[1] || 0;
    const lastMonthOrders = lastMonthData[1] || 0;
    const lastYearOrders = lastYearData[1] || 0;

    const momGrowth = lastMonthOrders > 0 ? 
      Math.round(((currentOrders - lastMonthOrders) / lastMonthOrders * 100) * 100) / 100 : null;
    const yoyGrowth = lastYearOrders > 0 ? 
      Math.round(((currentOrders - lastYearOrders) / lastYearOrders * 100) * 100) / 100 : null;

    console.log('📈 [增长率计算结果]:');
    console.log('  当前订单数:', currentOrders);
    console.log('  上月订单数:', lastMonthOrders);
    console.log('  去年订单数:', lastYearOrders);
    console.log('  环比增长率 (MoM):', momGrowth, '%');
    console.log('  同比增长率 (YoY):', yoyGrowth, '%');
    console.log('  计算公式:');
    console.log('    MoM = ((当前 - 上月) / 上月) × 100 = ((' + currentOrders + ' - ' + lastMonthOrders + ') / ' + lastMonthOrders + ') × 100');
    console.log('    YoY = ((当前 - 去年) / 去年) × 100 = ((' + currentOrders + ' - ' + lastYearOrders + ') / ' + lastYearOrders + ') × 100');

    // 🔥 四种核心异常数据查询
    const exceptionStatsQuery = `
      SELECT 
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) as pickup_timeouts,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) as shipping_timeouts,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) as delivery_timeouts,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END) as no_update_48h
      FROM APP_CMS.TSK_LIST_TASK t
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        ${brandFilter}
        ${platformFilter}
    `;

    // 🔥 修复：复制所有品牌参数（支持多品牌数组）
    const exceptionParams = { dateFrom, dateTo };
    
    // 复制所有 brand 相关参数（支持 brand0, brand1, brand2, ... 或单个 brand）
    Object.keys(baseParams).forEach(key => {
      if (key.startsWith('brand')) {
        exceptionParams[key] = baseParams[key];
      }
    });
    
    if (platform && platform !== 'all') {
      exceptionParams.platform = baseParams.platform;
    }

    const exceptionResult = await connection.execute(exceptionStatsQuery, exceptionParams);
    const exceptionData = exceptionResult.rows[0];

    // 返回包含同比环比数据的完整响应
    const response = {
      success: true,
      data: {
        kpi: {
          // 当前期间数据
          totalOrders: currentData[1] || 0,
          timeout48hOrders: currentData[2] || 0,
          pickedOrders: currentData[3] || 0,
          shippedOrders: currentData[4] || 0,
          deliveredOrders: currentData[5] || 0,
          forwardedOrders: currentData[6] || 0,
          returnedOrders: currentData[7] || 0,
          cancelledOrders: currentData[8] || 0,
          avgDeliveryHours: currentData[9] || 0,
          avgFirstDispatchHours: currentData[10] || 0,
          firstDispatchSuccessRate: currentData[11] || 0,
          pickedRate: currentData[12] || 0,
          shippedRate: currentData[13] || 0,
          deliveryRate: currentData[14] || 0,
          exceptionRate: currentData[15] || 0,
          timeout48hRate: currentData[16] || 0,
          
          // 🔥 新增：历史数据
          lastMonthOrders: lastMonthOrders,
          lastYearOrders: lastYearOrders,
          lastMonthExceptionRate: lastMonthData[15] || 0,
          lastYearExceptionRate: lastYearData[15] || 0,
          
          // 🔥 新增：真实的同比环比增长率
          momGrowth: momGrowth,
          yoyGrowth: yoyGrowth
        },
        
        // 🔥 新增：四种核心异常统计
        exceptionStats: {
          pickupTimeouts: exceptionData[0] || 0,
          shippingTimeouts: exceptionData[1] || 0,  
          deliveryTimeouts: exceptionData[2] || 0,
          noUpdate48h: exceptionData[3] || 0
        }
      },
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom: dateFrom,
        dateTo: dateTo,
        brand: brand || 'all',
        platform: platform || 'all'
      },
      trends: {
        mom: {
          period: `${momRange.lastMonthFrom} ~ ${momRange.lastMonthTo}`,
          growth: momGrowth
        },
        yoy: {
          period: `${yoyRange.lastYearFrom} ~ ${yoyRange.lastYearTo}`,
          growth: yoyGrowth
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ [KPI+趋势查询] 查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error.message || 'KPI+趋势数据查询失败',
      timestamp: new Date().toISOString()
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('❌ [KPI+趋势查询] 关闭数据库连接失败:', closeError);
      }
    }
  }
});

module.exports = router;