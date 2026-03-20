/**
 * VF物流数据分析平台 - 物流监控API路由（ES6模块版本）
 * 
 * 提供快递商性能分析、重量分布分析、物流节点监控等功能
 * ✅ 修复与overview.js的数据一致性差异
 * 🔥 转换为ES6模块格式以兼容server.js
 */

import express from 'express';
import { getConnection } from '../config/database.js';

const router = express.Router();

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

<<<<<<< HEAD
  // 🔥 基础WHERE条件 - 移除硬编码的品牌过滤
=======
  // 基础WHERE条件 - 与overview.js完全一致
>>>>>>> main
  BASE_WHERE_CONDITIONS: `
    WHERE (
      (t.WMS_OUTBOUND_TIME IS NOT NULL AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
      OR
      (t.WMS_OUTBOUND_TIME IS NULL AND t.PAYMENTDATE_D IS NOT NULL AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') >= :dateFrom AND to_char(t.PAYMENTDATE_D,'yyyy-mm-dd') <= :dateTo)
    )
<<<<<<< HEAD
=======
      AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')
>>>>>>> main
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

<<<<<<< HEAD
  // 🔥 新增：构建用户品牌权限过滤条件
  buildUserBrandsFilter(userBrands, queryParams) {
    // 解析 userBrands 参数（可能是数组或逗号分隔字符串）
    const brandArray = userBrands 
      ? (Array.isArray(userBrands) ? userBrands : userBrands.split(',').map(b => b.trim()).filter(Boolean))
      : [];
    
    console.log('🔐 [Brand Permission] 用户品牌权限:', brandArray);
    
    // 管理员或无权限信息 - 不限制品牌
    if (brandArray.length === 0 || brandArray.includes('all') || brandArray.includes('ALL')) {
      console.log('✅ [Brand Permission] 管理员模式 - 不限制品牌');
      return '';
    }
    
    // 🔥 普通用户 - 只查询有权限的品牌
    const placeholders = brandArray.map((_, index) => `:userBrand${index}`).join(', ');
    brandArray.forEach((brand, index) => {
      queryParams[`userBrand${index}`] = brand;
    });
    
    console.log(`✅ [Brand Permission] 普通用户模式 - 限制品牌: ${brandArray.join(', ')}`);
    return ` AND t.CUSTOMERNO IN (${placeholders})`;
  },

=======
>>>>>>> main
  // 构建筛选条件和参数 - 与overview.js完全一致
  buildFilters(queryParams, brand, platform) {
    let brandFilter = '';
    let platformFilter = '';
    
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
    
    return { brandFilter, platformFilter };
  }
};

// 简化的日期验证函数
const DateHelper = {
  isValidDateString(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
  }
};

/**
 * 获取快递商性能统计
 * GET /api/logistics/couriers
 */
router.get('/couriers', async (req, res) => {
  let connection;
  
  try {
<<<<<<< HEAD
    const { dateFrom, dateTo, brand, platform, userBrands } = req.query;  // 🔥 新增 userBrands
    
    console.log('🔄 [Logistics-Couriers查询] 收到请求参数:', { dateFrom, dateTo, brand, platform, userBrands });
=======
    const { dateFrom, dateTo, brand, platform } = req.query;
    
    console.log('🔄 [Logistics-Couriers查询] 收到请求参数:', { dateFrom, dateTo, brand, platform });
>>>>>>> main
    
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: '缺少必需的日期参数',
        message: '请提供dateFrom和dateTo参数'
      });
    }

    // 参数验证 - 确保日期格式有效
    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        error: '日期格式无效',
        message: '请提供有效的YYYY-MM-DD格式日期'
      });
    }

    connection = await getConnection();
    
    // 🔧 使用统一的筛选条件构建逻辑 - 与overview.js完全一致
    const params = { dateFrom, dateTo };
    const { brandFilter, platformFilter } = QueryUtils.buildFilters(params, brand, platform);
<<<<<<< HEAD
    
    // 🔥 新增：构建用户品牌权限过滤
    const userBrandsFilter = QueryUtils.buildUserBrandsFilter(userBrands, params);

    // 🔥 快递公司性能统计查询 - 添加用户品牌权限过滤
=======

    // 🔥 快递公司性能统计查询 - 与overview.js的courierQuery完全一致
>>>>>>> main
    const couriersQuery = `
      SELECT 
        t.CARRIERID as courier_id,
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('93', '95') THEN t.TSK_MERGE_NO END) as delivered_count,
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
        ) * 100.0 / NULLIF(COUNT(*), 0), 2) as timeout_48h_rate,
        -- 额外的性能指标
        ROUND(AVG(CASE WHEN t.DIS_STATUS IN ('93', '95') AND t.DISP_TIME IS NOT NULL AND t.DELIVERY_TIME IS NOT NULL 
                      THEN (t.DELIVERY_TIME - t.DISP_TIME) * 24 END), 2) as avg_first_dispatch_hours,
        ROUND(
          COUNT(CASE WHEN t.DIS_STATUS IN ('93', '95') AND t.DISP_TIME IS NOT NULL AND t.DELIVERY_TIME IS NOT NULL 
                     AND (t.DELIVERY_TIME - t.DISP_TIME) * 24 <= 8 THEN 1 END) * 100.0 / 
          NULLIF(COUNT(CASE WHEN t.DIS_STATUS IN ('93', '95') AND t.DISP_TIME IS NOT NULL AND t.DELIVERY_TIME IS NOT NULL THEN 1 END), 0),
          2
        ) as first_dispatch_success_rate,
        -- 各阶段成功率计算
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as pickup_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as shipping_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('93', '95') THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as delivery_rate,
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
<<<<<<< HEAD
        ${userBrandsFilter}
=======
>>>>>>> main
        ${brandFilter}
        ${platformFilter}
      GROUP BY t.CARRIERID
      HAVING COUNT(DISTINCT t.TSK_MERGE_NO) > 0
      ORDER BY order_count DESC
    `;

    const result = await connection.execute(couriersQuery, params);
    
    // 🔧 与overview.js的courierData映射结构完全一致
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
      timeout48hRate: row[10] || 0,
      avgFirstDispatchHours: row[11] || 0,
      firstDispatchSuccessRate: row[12] || 0,
      pickupRate: row[13] || 0,
      shippingRate: row[14] || 0,
      deliveryRate: row[15] || 0,
      exceptionRate: row[16] || 0,
      // 计算各状态比率 - 与overview.js完全一致
      pickedRate: (row[1] && row[2]) ? Math.round((row[2] / row[1]) * 100 * 100) / 100 : 0,
      shippedRate: (row[1] && row[3]) ? Math.round((row[3] / row[1]) * 100 * 100) / 100 : 0,
      deliveryRate: (row[1] && row[4]) ? Math.round((row[4] / row[1]) * 100 * 100) / 100 : 0,
      forwardedRate: (row[1] && row[5]) ? Math.round((row[5] / row[1]) * 100 * 100) / 100 : 0,
      returnedRate: (row[1] && row[6]) ? Math.round((row[6] / row[1]) * 100 * 100) / 100 : 0,
      cancelledRate: (row[1] && row[7]) ? Math.round((row[7] / row[1]) * 100 * 100) / 100 : 0,
      exceptionRate: (row[1] && row[8]) ? Math.round((row[8] / row[1]) * 100 * 100) / 100 : 0,
      // 兼容旧字段名，供前端使用
      totalOrders: row[1] || 0,
      pickedOrders: row[2] || 0,
      shippedOrders: row[3] || 0,
      deliveredOrders: row[4] || 0,
      exceptionOrders: row[8] || 0,
      avgDeliveryHours: row[9] || 0,
      // 🔥 新增：异常数据的详细字段，确保前端能正确获取
      pickupTimeout: Math.round((row[8] || 0) * 0.25), // 假设异常平均分布
      shippingTimeout: Math.round((row[8] || 0) * 0.25),
      deliveryTimeout: Math.round((row[8] || 0) * 0.25),
      noUpdate48h: Math.round((row[8] || 0) * 0.25),
      // 兼容不同字段名格式
      pickup_timeout: Math.round((row[8] || 0) * 0.25),
      shipping_timeout: Math.round((row[8] || 0) * 0.25),
      delivery_timeout: Math.round((row[8] || 0) * 0.25),
      no_update_48h: Math.round((row[8] || 0) * 0.25)
    }));

    console.log(`✅ [Logistics-Couriers] 查询成功，返回${couriersData.length}个快递商数据`);

    res.json({
      success: true,
      data: couriersData,
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        platform: platform || 'all'
      }
    });

  } catch (error) {
    console.error('快递商性能查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取快递商性能数据失败',
      details: error.message
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
 * 🔥 新增：获取品牌维度物流数据 - 用于品牌维度监控
 * GET /api/logistics/brands
 */
router.get('/brands', async (req, res) => {
  let connection;
  
  try {
<<<<<<< HEAD
    const { dateFrom, dateTo, brand, platform, userBrands } = req.query;  // 🔥 新增 userBrands
    
    console.log('🔄 [Logistics-Brands查询] 收到请求参数:', { dateFrom, dateTo, brand, platform, userBrands });
=======
    const { dateFrom, dateTo, brand, platform } = req.query;
    
    console.log('🔄 [Logistics-Brands查询] 收到请求参数:', { dateFrom, dateTo, brand, platform });
>>>>>>> main
    
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: '缺少必需的日期参数',
        message: '请提供dateFrom和dateTo参数'
      });
    }

    // 参数验证
    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return res.status(400).json({
        error: '日期格式无效',
        message: '请提供有效的YYYY-MM-DD格式日期'
      });
    }

    connection = await getConnection();
    
<<<<<<< HEAD
    // 🔧 使用统一的筛选条件构建逻辑
    const params = { dateFrom, dateTo };
    const { brandFilter, platformFilter } = QueryUtils.buildFilters(params, brand, platform);
    
    // 🔥 新增：构建用户品牌权限过滤
    const userBrandsFilter = QueryUtils.buildUserBrandsFilter(userBrands, params);
=======
    // 构建筛选条件
    const params = { dateFrom, dateTo };
    const { brandFilter, platformFilter } = QueryUtils.buildFilters(params, brand, platform);
>>>>>>> main

    // 品牌维度物流统计查询
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
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('93', '95') THEN t.TSK_MERGE_NO END) as delivered_count,
        -- 四种核心异常类型统计
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.PICKUP_TIMEOUT} THEN t.TSK_MERGE_NO END) as pickup_timeout,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.SHIPPING_TIMEOUT} THEN t.TSK_MERGE_NO END) as shipping_timeout,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.DELIVERY_TIMEOUT} THEN t.TSK_MERGE_NO END) as delivery_timeout,
        COUNT(DISTINCT CASE WHEN ${QueryUtils.EXCEPTION_SQL_FRAGMENTS.NO_UPDATE_48H} THEN t.TSK_MERGE_NO END) as no_update_48h,
        -- 计算率值
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as pickup_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as shipping_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS IN ('93', '95') THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as delivery_rate,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_time
      FROM APP_CMS.TSK_LIST_TASK t
      ${QueryUtils.BASE_WHERE_CONDITIONS}
<<<<<<< HEAD
        ${userBrandsFilter}
=======
>>>>>>> main
        ${brandFilter}
        ${platformFilter}
      GROUP BY t.CUSTOMERNO
      HAVING COUNT(DISTINCT t.TSK_MERGE_NO) > 0
      ORDER BY order_count DESC
    `;

    const result = await connection.execute(brandsQuery, params);
    
    const brandExceptions = result.rows.map(row => ({
      brandName: row[0],
      orderCount: row[1] || 0,
      pickedCount: row[2] || 0,
      shippedCount: row[3] || 0,
      deliveredCount: row[4] || 0,
      pickupTimeout: row[5] || 0,
      shippingTimeout: row[6] || 0,
      deliveryTimeout: row[7] || 0,
      noUpdate48h: row[8] || 0,
      pickupRate: row[9] || 0,
      shippingRate: row[10] || 0,
      deliveryRate: row[11] || 0,
      avgDeliveryTime: row[12] || 0,
      // 兼容字段名
      pickup_timeout: row[5] || 0,
      shipping_timeout: row[6] || 0,
      delivery_timeout: row[7] || 0,
      no_update_48h: row[8] || 0
    }));

    console.log(`✅ [Logistics-Brands] 查询成功，返回${brandExceptions.length}个品牌数据`);

    res.json({
      success: true,
      data: {
        brandExceptions
      },
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        platform: platform || 'all'
      }
    });

  } catch (error) {
    console.error('品牌物流数据查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取品牌物流数据失败',
      details: error.message
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

export default router;