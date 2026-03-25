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
const { getBrandMapping } = require('../utils/brandMapping'); // ✅ 导入动态品牌映射

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
      (t.WMS_OUTBOUND_TIME IS NOT NULL AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
      AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')
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
    
    // 超48H未更新: IS48H_FLAG字段值存在且为'Y'的订单
    NO_UPDATE_48H: `(t.IS48H_FLAG = 'Y')`
  },

  // 🔧 修复：构建筛选条件和参数 - 支持多品牌数组和用户权限
  buildFilters(queryParams, brand, platform, selfFlag, userBrands) {
    let brandFilter = '';
    let platformFilter = '';
    let selfFlagFilter = '';
    
    // 🔐 品牌筛选：支持单个品牌、多个品牌（数组）、用户权限范围
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
    } else {
      // 🔥 修复：当选择"全部品牌"时，使用用户权限范围
      if (userBrands && Array.isArray(userBrands) && userBrands.length > 0) {
        const placeholders = userBrands.map((_, index) => `:userBrand${index}`).join(', ');
        brandFilter = ` AND t.CUSTOMERNO IN (${placeholders})`;
        
        // 绑定每个用户品牌参数
        userBrands.forEach((code, index) => {
          queryParams[`userBrand${index}`] = code;
        });
        
        console.log('🔐 [Brand Filter] 全部品牌 - 基于用户权限 (%d个): %o', userBrands.length, userBrands);
      } else {
        // 回退：如果没有userBrands，使用VF品牌范围
        brandFilter = ` AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')`;
        console.log(`🏷️ [Brand Filter] 全部品牌 - 回退到VF品牌范围（未提供userBrands）`);
      }
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
  async buildFiltersAsync(queryParams, brand, platform, selfFlag, userBrands) {
    let brandFilter = '';
    let platformFilter = '';
    let selfFlagFilter = '';
    
    // 🔥 获取动态品牌映射
    const BRAND_MAPPING = await getBrandMapping();
    
    // 🔐 品牌筛选：支持单个品牌、多个品牌（数组）、用户权限范围
    if (brand && brand !== 'all') {
      if (Array.isArray(brand)) {
        // 多个品牌：使用 IN 查询
        const brandCodes = brand.map(b => BRAND_MAPPING[b] || b);
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
        queryParams.brand = BRAND_MAPPING[brand] || brand;
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
        
        console.log('🔐 [Brand Filter] 全部品牌 - 基于用户权限 (%d个): %o', userBrands.length, userBrands);
      } else {
        // 回退：如果没有userBrands，使用VF品牌范围
        brandFilter = ` AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')`;
        console.log(`🏷️ [Brand Filter] 全部品��� - 回退到VF品牌范围（未提供userBrands）`);
      }
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
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag, userBrands } = req.query;
    
    console.log('🔄 [Logistics-Brands查询] 收到请求参数:', { dateFrom, dateTo, brand, platform, selfFlag, userBrands });
    
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
      console.log('🔐 [Logistics-Brands] 解析后的userBrands:', parsedUserBrands);
    }
    
    // 🔧 使用统一的筛选条件构建逻辑（传递userBrands）
    const params = { dateFrom, dateTo };
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(params, brand, platform, selfFlag, parsedUserBrands);

    // 🔥 品牌物流异常数据详细统计查询（✅ 从数据库查询品牌名称）
    const brandsQuery = `
      SELECT 
        COALESCE(bc.COMPANY_ABNAME, t.CUSTOMERNO) as brand_name,
        -- 基础统计
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_count,
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
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as shipping_rate,
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
      LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CUSTOMERNO = bc.COMPANY_SYSID
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CUSTOMERNO, bc.COMPANY_ABNAME
      ORDER BY order_count DESC
    `;
    
    // 🔍 调试：打印完整SQL和参数
    console.log('📝 [Logistics-Brands] 完整SQL查询:');
    console.log(brandsQuery);
    console.log('📝 [Logistics-Brands] 查询参数:', params);

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
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(params, brand, platform, selfFlag);

    // 🔥 快递公司性能统计查询
    const couriersQuery = `
      SELECT 
        t.CARRIERID as courier_id,
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' THEN t.TSK_MERGE_NO END) as picked_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) as shipped_count,
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
        ROUND(COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '70' THEN t.TSK_MERGE_NO END) * 100.0 / NULLIF(COUNT(DISTINCT t.TSK_MERGE_NO), 0), 2) as shipping_rate,
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
      ${QueryUtils.BASE_WHERE_CONDITIONS}
        AND t.CARRIERID IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CARRIERID
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
      orderCount: row[1] || 0,
      pickedCount: row[2] || 0,
      shippedCount: row[3] || 0,
      deliveredCount: row[4] || 0,
      forwardedCount: row[5] || 0,
      returnedCount: row[6] || 0,
      cancelledCount: row[7] || 0,
      // ✅ 修复：四种异常类型的正确映射
      pickupTimeout: row[8] || 0,       // pickup_timeout
      shippingTimeout: row[9] || 0,     // shipping_timeout  
      deliveryTimeout: row[10] || 0,    // delivery_timeout
      noUpdate48h: row[11] || 0,        // no_update_48h
      // 总异常数和其他指标
      exceptionCount: row[12] || 0,     // exception_count (四种异常之和)
      avgDeliveryTime: row[13] || 0,    // avg_delivery_time
      pickupRate: row[14] || 0,         // pickup_rate
      shippingRate: row[15] || 0,       // shipping_rate
      deliveryRate: row[16] || 0,       // delivery_rate
      exceptionRate: row[17] || 0,      // exception_rate
      // 兼容旧字段名
      totalOrders: row[1] || 0,
      pickedOrders: row[2] || 0,
      shippedOrders: row[3] || 0,
      deliveredOrders: row[4] || 0,
      exceptionOrders: row[12] || 0,
      avgDeliveryHours: row[13] || 0,
      // ✅ 新增：前端需要的异常字段别名（支持多种命名格式）
      pickup_timeout: row[8] || 0,
      shipping_timeout: row[9] || 0,
      delivery_timeout: row[10] || 0,
      no_update_48h: row[11] || 0,
      // ✅ 兼容CourierMonitoring组件中的旧字段名
      timeout48hOrders: row[11] || 0,      // 超48h未更新
      notPickedOver2h: row[8] || 0,        // 超时未揽收
      notShippedOver12h: row[9] || 0,      // 超时未发运
      notUpdatedOver48h: row[11] || 0,     // 超48h未更新（另一个别名）
      notDeliveredOver3days: row[10] || 0  // 超时未签收
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
    console.error('快递商性能查询失败:', error);
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
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(params, brand, platform, selfFlag);

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
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(params, brand, platform, selfFlag);

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
          v.IF_DELAY,
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
         COUNT(CASE WHEN IS48H_FLAG = 'Y' THEN 1 END)) as exception_count,
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
 * - userBrands: 用户品牌筛选 (可选)
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
    const { startDate, endDate, brand, platform, selfFlag, userBrands } = req.query; // 🔥 新增：接收userBrands参数
    
    console.log('🔁 [Forwarding API] 接收请求参数:', { startDate, endDate, brand, platform, selfFlag, userBrands }); // 🔥 新增：记录userBrands
    
    // 参数验证
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数',
        message: '请提供startDate和endDate参数'
      });
    }
    
    connection = await getConnection();
    
    // 🔥 新增：解析userBrands（可能是JSON字符串）
    let parsedUserBrands = null;
    if (userBrands) {
      if (Array.isArray(userBrands)) {
        parsedUserBrands = userBrands;
      } else if (typeof userBrands === 'string') {
        try {
          parsedUserBrands = JSON.parse(userBrands);
          console.log('🔐 [Forwarding API] 解析userBrands成功:', parsedUserBrands);
        } catch (e) {
          // 如果不是JSON，尝试按逗号分隔
          parsedUserBrands = userBrands.split(',').map(b => b.trim());
          console.log('🔐 [Forwarding API] 逗号分隔userBrands:', parsedUserBrands);
        }
      }
    }
    
    // 快递公司名称映射
    const COURIER_NAME_MAPPING = {
      'ZTO': '中通',
      'SF': '顺丰',
      'YTO': '圆通',
      'STO': '申通',
      'JD': '京东',
      'EMS': '邮政EMS',
      'YUNDA': '韵达',
      'BEST': '百世',
      'ZJS': '宅急送',
      'HTKY': '百世汇通',
      'POSTB': '邮政',
      'UC': '优速',
      'DEPPON': '德邦',
      'DBKD': '德邦快递'
    };
    
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
      parsedUserBrands // 🔥 修复：传递解析后的userBrands
    );
    
    const totalOrdersSql = `
      SELECT COUNT(*) as TOTAL_COUNT
      FROM APP_CMS.TSK_LIST_TASK t
      WHERE WMS_OUTBOUND_TIME >= TO_DATE(:startDate, 'YYYY-MM-DD')
        AND WMS_OUTBOUND_TIME <= TO_DATE(:endDate, 'YYYY-MM-DD') + 1
        AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')
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
      WHERE TR_FLAG = 'Y'
      
        AND WMS_OUTBOUND_TIME >= TO_DATE(:startDate, 'YYYY-MM-DD')
        AND WMS_OUTBOUND_TIME <= TO_DATE(:endDate, 'YYYY-MM-DD') + 1
        AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')
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
      WHERE TR_FLAG2 = 'Y'
        AND WMS_OUTBOUND_TIME >= TO_DATE(:startDate, 'YYYY-MM-DD')
        AND WMS_OUTBOUND_TIME <= TO_DATE(:endDate, 'YYYY-MM-DD') + 1
        AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')
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
          CARRIERID,
          COUNT(*) as COURIER_TOTAL
        FROM APP_CMS.TSK_LIST_TASK t
        WHERE TR_FLAG2 = 'Y'
          AND WMS_OUTBOUND_TIME >= TO_DATE(:startDate, 'YYYY-MM-DD')
          AND WMS_OUTBOUND_TIME <= TO_DATE(:endDate, 'YYYY-MM-DD') + 1
          AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')
          ${brandFilter}
          ${platformFilter}
          ${selfFlagFilter}
        GROUP BY CARRIERID
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
      WHERE t.TR_FLAG2 = 'Y'
        AND t.WMS_OUTBOUND_TIME >= TO_DATE(:startDate, 'YYYY-MM-DD')
        AND t.WMS_OUTBOUND_TIME <= TO_DATE(:endDate, 'YYYY-MM-DD') + 1
        AND t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')
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
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: '获取转寄分析数据失败: ' + error.message
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
    userBrands // 🔥 新增：接收userBrands参数
  } = req.query;
  
  console.log('📋 查询参数:', {
    startDate,
    endDate,
    brand,
    platform,
    selfFlag,
    interceptionStatus,
    interceptLocation,
    userBrands // 🔥 新增：记录userBrands
  });

  // 参数验证
  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: '缺少必需参数：startDate 和 endDate'
    });
  }

  let connection;

  try {
    connection = await getConnection();
    console.log('✅ 数据库连接成功');
    
    // 🔥 新增：解析userBrands（可能是JSON字符串）
    let parsedUserBrands = null;
    if (userBrands) {
      if (Array.isArray(userBrands)) {
        parsedUserBrands = userBrands;
      } else if (typeof userBrands === 'string') {
        try {
          parsedUserBrands = JSON.parse(userBrands);
          console.log('🔐 [Interception API] 解析userBrands成功:', parsedUserBrands);
        } catch (e) {
          // 如果不是JSON，尝试按逗号分隔
          parsedUserBrands = userBrands.split(',').map(b => b.trim());
          console.log('🔐 [Interception API] 逗号分隔userBrands:', parsedUserBrands);
        }
      }
    }

      // 🔧 使用统一的筛选条件构建逻辑（传递userBrands）
    const queryParams = { startDate, endDate };
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(
      queryParams, 
      brand, 
      platform, 
      selfFlag,
      parsedUserBrands // 🔥 传递解析后的userBrands
    );
    
    // 🔥 拦截分析特殊处理：将表别名从 t. 替换为 tsk.
    // 因为拦截分析使用 TSK_LIST_TASK 的别名是 tsk，而不是 t
    const tskBrandFilter = brandFilter.replace(/t\./g, 'tsk.');
    const tskPlatformFilter = platformFilter.replace(/t\./g, 'tsk.');
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
      interceptionStatusFilter = ` AND (dc.PROCESS_FLAG IS NULL OR dc.PROCESS_FLAG != 'Y')`;
    }

    // 拦截位置筛选
    let interceptLocationFilter = '';
    if (interceptLocation === 'warehouse') {
      interceptLocationFilter = ` AND tsk.DIS_STATUS = 90`;
    } else if (interceptLocation === 'external') {
      interceptLocationFilter = ` AND tsk.DIS_STATUS != 90`;
    }

    // 组合所有筛选条件
    const whereClause = `tsk.WMS_OUTBOUND_TIME >= TO_DATE(:startDate, 'YYYY-MM-DD')
      AND tsk.WMS_OUTBOUND_TIME < TO_DATE(:endDate, 'YYYY-MM-DD') + 1
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
        COUNT(*) as total_count,
        SUM(CASE WHEN dc.PROCESS_FLAG = 'Y' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN dc.PROCESS_FLAG IS NULL OR dc.PROCESS_FLAG != 'Y' THEN 1 ELSE 0 END) as failed_count,
        ROUND(
          SUM(CASE WHEN dc.PROCESS_FLAG = 'Y' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) as success_rate,
        SUM(CASE WHEN tsk.DIS_STATUS = 90 THEN 1 ELSE 0 END) as warehouse_count,
        SUM(CASE WHEN tsk.DIS_STATUS != 90 THEN 1 ELSE 0 END) as external_count,
        ROUND(
          SUM(CASE WHEN tsk.DIS_STATUS = 90 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) as warehouse_rate,
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
      warehouseRate: overviewResult.rows[0][6] || 0,
      avgCompletionHours: overviewResult.rows[0][7] || 0,
      warehouseAvgHours: overviewResult.rows[0][8] || 0,
      externalAvgHours: overviewResult.rows[0][9] || 0
    };

    console.log('✅ 拦截统计概览:', overview);

    // ==========================================
    // 查询2: 按快递商统计
    // ==========================================
    const carrierStatsQuery = `
      SELECT 
        tsk.CARRIERID as carrier_id,
        COUNT(*) as total_count,
        SUM(CASE WHEN dc.PROCESS_FLAG = 'Y' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN dc.PROCESS_FLAG IS NULL OR dc.PROCESS_FLAG != 'Y' THEN 1 ELSE 0 END) as failed_count,
        ROUND(
          SUM(CASE WHEN dc.PROCESS_FLAG = 'Y' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) as success_rate,
        SUM(CASE WHEN tsk.DIS_STATUS = 90 THEN 1 ELSE 0 END) as warehouse_count,
        SUM(CASE WHEN tsk.DIS_STATUS != 90 THEN 1 ELSE 0 END) as external_count,
        ROUND(
          AVG(
            CASE 
              WHEN dc.PROCESS_DATE2 IS NOT NULL AND dc.REQUEST_TIME IS NOT NULL
              THEN (dc.PROCESS_DATE2 - dc.REQUEST_TIME) * 24
              ELSE NULL
            END
          ),
          1
        ) as avg_completion_hours
      FROM APP_CMS.DOC_COMPLAINT dc
      INNER JOIN APP_CMS.TSK_LIST_TASK tsk 
        ON dc.TSK_MERGE_NO = tsk.TSK_MERGE_NO
      WHERE ${whereClause}
      GROUP BY tsk.CARRIERID
      ORDER BY total_count DESC
    `;
    
    // 🔍 调试：打印完整SQL和参数
    console.log('📝 [Logistics-Interception] 完整SQL查询:');
    console.log(carrierStatsQuery);
    console.log('📝 [Logistics-Interception] 查询参数:', queryParams);

    const carrierStatsResult = await connection.execute(carrierStatsQuery, queryParams);

    const carrierStats = carrierStatsResult.rows.map(row => ({
      carrierId: row[0],
      totalCount: row[1] || 0,
      successCount: row[2] || 0,
      failedCount: row[3] || 0,
      successRate: row[4] || 0,
      warehouseCount: row[5] || 0,
      externalCount: row[6] || 0,
      avgCompletionHours: row[7] || 0
    }));

    console.log(`✅ 按快递商统计 (${carrierStats.length}条记录)`);

    // ==========================================
    // 查询3: 按品牌统计
    // ==========================================
    const brandStatsQuery = `
      SELECT 
        tsk.CUSTOMERNO as brand_code,
        bc.COMPANY_ABNAME as brand_name,
        COUNT(*) as total_count,
        SUM(CASE WHEN dc.PROCESS_FLAG = 'Y' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN dc.PROCESS_FLAG IS NULL OR dc.PROCESS_FLAG != 'Y' THEN 1 ELSE 0 END) as failed_count,
        ROUND(
          SUM(CASE WHEN dc.PROCESS_FLAG = 'Y' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) as success_rate,
        SUM(CASE WHEN tsk.DIS_STATUS = 90 THEN 1 ELSE 0 END) as warehouse_count,
        SUM(CASE WHEN tsk.DIS_STATUS != 90 THEN 1 ELSE 0 END) as external_count
      FROM APP_CMS.DOC_COMPLAINT dc
      INNER JOIN APP_CMS.TSK_LIST_TASK tsk 
        ON dc.TSK_MERGE_NO = tsk.TSK_MERGE_NO
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
        COUNT(*) as total_count,
        SUM(CASE WHEN dc.PROCESS_FLAG = 'Y' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN dc.PROCESS_FLAG IS NULL OR dc.PROCESS_FLAG != 'Y' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN tsk.DIS_STATUS = 90 THEN 1 ELSE 0 END) as warehouse_count,
        SUM(CASE WHEN tsk.DIS_STATUS != 90 THEN 1 ELSE 0 END) as external_count
      FROM APP_CMS.DOC_COMPLAINT dc
      INNER JOIN APP_CMS.TSK_LIST_TASK tsk 
        ON dc.TSK_MERGE_NO = tsk.TSK_MERGE_NO
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
        SELECT 
          dc.TSK_MERGE_NO as tracking_no,
          tsk.CUSTOMERNO as brand_code,
          bc.COMPANY_ABNAME as brand_name,
          tsk.CARRIERID as carrier_id,
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
        LEFT JOIN APP_CMS.BAS_COMPANY bc
          ON tsk.CUSTOMERNO = bc.COMPANY_SYSID
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
      requestTime: row[4],
      completeTime: row[5],
      completionHours: row[6],
      processFlag: row[7],
      interceptionStatus: row[8],
      disStatus: row[9],
      interceptionLocation: row[10]
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
    
    res.status(500).json({
      success: false,
      error: '查询拦截数据失败',
      message: error.message
    });
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

module.exports = router;