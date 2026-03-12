/**
 * VF物流数据分析平台 - 物流监控API路由（参数绑定修复版）
 * 
 * 提供快递商性能分析、重量分布分析、物流节点监控等功能
 * ✅ 修复与overview.js的数据一致性差异
 * ✅ 修复参数绑定不匹配问题
 */

const express = require('express');
const router = express.Router();
const { getConnection, DateHelper } = require('../config/database-api');

// 🔧 共享工具函数 - 与overview.js保持一致
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

  // 基础WHERE条件 - 与overview.js完全一致
  BASE_WHERE_CONDITIONS: `
    WHERE (
      (t.WMS_OUTBOUND_TIME IS NOT NULL AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
      OR
      (t.WMS_OUTBOUND_TIME IS NULL AND t.PAYMENTDATE_D IS NOT NULL AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') >= :dateFrom AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') <= :dateTo)
    )
      AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')
      AND t.TSK_MERGE_NO IS NOT NULL`,

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

  // ✅ 四种核心异常类型的SQL片段 - 与overview.js完全一致
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

  // 🔧 修复：构建筛选条件和参数 - 兼容旧版调用
  buildFilters(queryParams, brand, platform, selfFlag) {
    let brandFilter = '';
    let platformFilter = '';
    let selfFlagFilter = '';
    
    if (brand && brand !== 'all') {
      brandFilter = ` AND t.CUSTOMERNO = :brand`;
      queryParams.brand = this.BRAND_MAPPING[brand] || brand;
    }
    
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
    if (selfFlag !== undefined) {
      if (selfFlag && selfFlag !== 'all') {
        selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
        queryParams.selfFlag = selfFlag;
        console.log(`🔧 [Self Flag Filter] 自管筛选: ${selfFlag}`);
      } else if (selfFlag === 'all') {
        // 当选择"全部"时，不添加SELF_FLAG筛选条件
        selfFlagFilter = '';
        console.log(`🔧 [Self Flag Filter] 全部订单，无SELF_FLAG筛选: ${selfFlag}`);
      } else {
        // 仅当selfFlag为null/undefined时才默认为自管
        selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
        queryParams.selfFlag = 'Y';
        console.log(`🔧 [Self Flag Filter] selfFlag为空，默认自管筛选: Y`);
      }
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
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag } = req.query;
    
    console.log('🔄 [Logistics-Brands查询] 收到请求参数:', { dateFrom, dateTo, brand, platform, selfFlag });
    
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
    
    // 🔧 使用统一的筛选条件构建逻辑
    const params = { dateFrom, dateTo };
    const { brandFilter, platformFilter, selfFlagFilter } = QueryUtils.buildFilters(params, brand, platform, selfFlag);

    // 🔥 品牌物流异常数据详细统计查询
    const brandsQuery = `
      SELECT 
        CASE t.CUSTOMERNO
          WHEN '18405' THEN 'DICKIES'
          WHEN '18405-1' THEN 'TNF'
          WHEN '18405-2' THEN 'ICEBREAKER'
          WHEN '18405-3' THEN 'VANS'
          WHEN '18405-4' THEN 'TIMBERLAND'
          WHEN '18405-5' THEN 'SMARTWOOL'
          ELSE t.CUSTOMERNO
        END as brand_name,
        -- 基础统计
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '95' THEN t.TSK_MERGE_NO END) as delivered_count,
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
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as shipping_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '95' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as delivery_rate,
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
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CUSTOMERNO
      HAVING COUNT(DISTINCT t.TSK_MERGE_NO) > 0
      ORDER BY order_count DESC
    `;

    const result = await connection.execute(brandsQuery, params);
    
    // 🔧 映射品牌异常数据结构
    const brandExceptions = result.rows.map(row => ({
      brandName: row[0] || 'UNKNOWN',
      orderCount: row[1] || 0,
      pickedCount: row[2] || 0,
      shippedCount: row[3] || 0,
      deliveredCount: row[4] || 0,
      // 四种核心异常类型
      pickupTimeout: row[5] || 0,
      shippingTimeout: row[6] || 0,
      deliveryTimeout: row[7] || 0,
      noUpdate48h: row[8] || 0,
      totalExceptions: row[9] || 0,
      // 各阶段成功率
      pickupRate: row[10] || 0,
      shippingRate: row[11] || 0,
      deliveryRate: row[12] || 0,
      exceptionRate: row[13] || 0,
      avgDeliveryTime: row[14] || 0,
      // 兼容字段名
      pickup_timeout: row[5] || 0,
      shipping_timeout: row[6] || 0,
      delivery_timeout: row[7] || 0,
      no_update_48h: row[8] || 0
    }));

    console.log('✅ [Logistics-Brands] 品牌物流异常数据查询成功:', {
      brandCount: brandExceptions.length,
      totalExceptions: brandExceptions.reduce((sum, brand) => sum + brand.totalExceptions, 0)
    });

    res.json({
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
    });

  } catch (error) {
    console.error('品牌物流异常数据查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取品牌物流异常数据失败'
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
 * 获取快递商性能统计
 * GET /api/logistics/couriers
 */
router.get('/couriers', async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag } = req.query;
    
    console.log('🔄 [Logistics-Couriers查询] 收到请求参数:', { dateFrom, dateTo, brand, platform, selfFlag });
    
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
    
    // 🔧 使用统一的筛选条件构建逻辑
    const params = { dateFrom, dateTo };
    const { brandFilter, platformFilter, selfFlagFilter } = QueryUtils.buildFilters(params, brand, platform, selfFlag);

    // 🔥 快递公司性能统计查询
    const couriersQuery = `
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
        -- 各阶段成功率计算
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as pickup_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as shipping_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '95' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as delivery_rate,
        -- 异常率（基于四种核心异常条件）
        ROUND((
          COUNT(CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN 1 END) +
          COUNT(CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN 1 END) +
          COUNT(CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN 1 END) +
          COUNT(CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN 1 END)
        ) * 100.0 / NULLIF(COUNT(*), 0), 2) as exception_rate
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

    const result = await connection.execute(couriersQuery, params);
    
    const couriersData = result.rows.map(row => ({
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
      pickupRate: row[10] || 0,
      shippingRate: row[11] || 0,
      deliveryRate: row[12] || 0,
      exceptionRate: row[13] || 0,
      // 兼容旧字段名
      totalOrders: row[1] || 0,
      pickedOrders: row[2] || 0,
      shippedOrders: row[3] || 0,
      deliveredOrders: row[4] || 0,
      exceptionOrders: row[8] || 0,
      avgDeliveryHours: row[9] || 0
    }));

    res.json({
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
    });

  } catch (error) {
    console.error('快递商性能���询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取快递商性能数据失败'
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
 * 获取快递商状态分布统计
 * GET /api/logistics/status-distribution
 */
router.get('/status-distribution', async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag } = req.query;
    
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: '缺少必需的日期参数'
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        error: '日期格式无效',
        message: '请提供有效的YYYY-MM-DD格式日期'
      });
    }

    connection = await getConnection();
    
    // 🔧 使用统一的筛选条件构建逻辑
    const params = { dateFrom, dateTo };
    const { brandFilter, platformFilter, selfFlagFilter } = QueryUtils.buildFilters(params, brand, platform, selfFlag);

    const statusDistributionQuery = `
      SELECT 
        t.CARRIERID,
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
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        AND t.CARRIERID IS NOT NULL
        AND t.DIS_STATUS IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CARRIERID, t.DIS_STATUS, bs.CODENAME_C
      ORDER BY t.CARRIERID, t.DIS_STATUS
    `;

    const result = await connection.execute(statusDistributionQuery, params);
    const statusData = result.rows.map(row => ({
      carrierId: row[0],
      statusCode: row[1],
      statusName: row[2],
      orderCount: row[3],
      statusPercentage: row[4] || 0
    }));

    // 按快递公司分组整理数据
    const courierStatusMap = {};
    statusData.forEach(item => {
      if (!courierStatusMap[item.carrierId]) {
        courierStatusMap[item.carrierId] = {
          carrierId: item.carrierId,
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
      if (statusCode === '70') {
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

    res.json({
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
    });

  } catch (error) {
    console.error('状态分布查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取状态分布数据失败'
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
 * 获取重量分布分析  
 * GET /api/logistics/weight-distribution
 */
router.get('/weight-distribution', async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag } = req.query;
    
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: '缺少必需的日期参数'
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        error: '日期格式无效',
        message: '请提供有效的YYYY-MM-DD格式日期'
      });
    }

    connection = await getConnection();
    
    // 🔧 使用统一的筛选条件构建逻辑
    const params = { dateFrom, dateTo };
    const { brandFilter, platformFilter, selfFlagFilter } = QueryUtils.buildFilters(params, brand, platform, selfFlag);

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
          t.IS48H_FLAG,
          t.DISP_TIME,
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
        COUNT(CASE WHEN DIS_STATUS = '95' THEN 1 END) as delivered_count,
        -- 异常数量（基于四种核心异常条件）
        (COUNT(CASE WHEN DIS_STATUS = '00' AND WMS_OUTBOUND_TIME IS NOT NULL 
                    AND (SYSDATE - WMS_OUTBOUND_TIME) * 24 > 48 THEN 1 END) +
         COUNT(CASE WHEN DIS_STATUS = '55' AND WMS_OUTBOUND_TIME IS NOT NULL 
                    AND (SYSDATE - WMS_OUTBOUND_TIME) * 24 > 72 THEN 1 END) +
         COUNT(CASE WHEN IS48H_FLAG = 'Y' THEN 1 END) +
         COUNT(CASE WHEN DIS_STATUS = '70' AND DISP_TIME IS NOT NULL 
                    AND (SYSDATE - DISP_TIME) * 24 > 72 THEN 1 END)) as exception_count,
        ROUND(AVG(T_GROSSWEIGHT), 3) as avg_weight,
        ROUND(AVG(T_CUBIC), 6) as avg_volume,
        ROUND(AVG(CAL_TON_AR), 3) as avg_chargeable_weight_ar,
        ROUND(AVG(CAL_TON_AP), 3) as avg_chargeable_weight_ap,
        ROUND(AVG(CASE WHEN SUM_SEND_TIME2 IS NOT NULL AND SUM_SEND_TIME2 > 0 THEN SUM_SEND_TIME2 END), 2) as avg_delivery_time,
        ROUND(COUNT(CASE WHEN DIS_STATUS = '95' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate
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

    res.json({
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
    });

  } catch (error) {
    console.error('重量分布查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取重量分布数据失败'
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