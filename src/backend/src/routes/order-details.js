const express = require('express');
const router = express.Router();
const { getBrandMapping } = require('../utils/brandMapping');

// 🔧 共享工具函数 - 与overview.js保持一致
const QueryUtils = {
  // ✅ 品牌表JOIN片段 - 从数据库查询品牌名称
  getBrandJoin(tableAlias = 't') {
    return `LEFT JOIN APP_CMS.BAS_COMPANY bc_brand ON ${tableAlias}.CUSTOMERNO = bc_brand.COMPANY_SYSID`;
  },

  // ✅ 品牌名称字段 - 从数据库查询，回退到CUSTOMERNO，统一转为大写
  getBrandNameColumn() {
    return `UPPER(COALESCE(bc_brand.COMPANY_ABNAME, t.CUSTOMERNO)) as brand_name`;
  },

  // 基础WHERE条件 - 与overview.js保持一致（⚡ 性能优化：使用TRUNC代替to_char）
  BASE_WHERE_CONDITIONS_VIEW: `
    WHERE (v.WMS_OUTBOUND_TIME IS NOT NULL 
           AND TRUNC(v.WMS_OUTBOUND_TIME) >= TO_DATE(:dateFrom, 'YYYY-MM-DD')
           AND TRUNC(v.WMS_OUTBOUND_TIME) <= TO_DATE(:dateTo, 'YYYY-MM-DD'))
      AND v.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')
      AND v.TSK_MERGE_NO IS NOT NULL`,

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
  
  // ✅ 异常条件SQL片段 - 与overview.js完全一致
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

  // ✅ 异步构建筛选条件和参数（支持动态品牌映射） - 与overview.js保持一致
  async buildFiltersAsync(queryParams, brand, platform, selfFlag, userBrands) {
    let brandFilter = '';
    let platformFilter = '';
    let selfFlagFilter = '';
    
    // 🔥 获取动态品牌映射
    const BRAND_MAPPING = await getBrandMapping();
    
    // 🔐 品牌筛选：支持单个品牌、多个品牌（数组或逗号分隔字符串）
    if (brand && brand !== 'all') {
      let brandArray = brand;
      if (typeof brand === 'string' && brand.includes(',')) {
        brandArray = brand.split(',').map(b => b.trim()).filter(b => b);
      } else if (!Array.isArray(brand)) {
        brandArray = [brand];
      }

      const customerNos = brandArray.map(b => BRAND_MAPPING[b] || b);
      
      if (customerNos.length === 1) {
        queryParams.brand0 = customerNos[0];
        brandFilter = 'AND v.CUSTOMERNO = :brand0';
      } else {
        customerNos.forEach((customerNo, index) => {
          queryParams[`brand${index}`] = customerNo;
        });
        const brandPlaceholders = customerNos.map((_, index) => `:brand${index}`).join(', ');
        brandFilter = `AND v.CUSTOMERNO IN (${brandPlaceholders})`;
      }
    } else if (userBrands && userBrands !== 'all') {
      const brandList = Array.isArray(userBrands) ? userBrands : userBrands.split(',').map(b => b.trim()).filter(Boolean);
      
      if (brandList.length > 0) {
        brandList.forEach((brandCode, index) => {
          queryParams[`userbrand${index}`] = brandCode;
        });
        const userBrandPlaceholders = brandList.map((_, index) => `:userbrand${index}`).join(', ');
        brandFilter = `AND v.CUSTOMERNO IN (${userBrandPlaceholders})`;
      }
    }
    
    // 🔧 平台筛选 - 使用PLATFORM_CLASS字段（VIEW视图已处理好）
    if (platform && platform !== 'all') {
      const platformValue = this.PLATFORM_MAPPING[platform] || platform;
      queryParams.platform = platformValue;
      platformFilter = 'AND v.PLATFORM_CLASS = :platform';
    }
    
    // 🔧 自管筛选
    if (selfFlag && selfFlag !== 'all') {
      queryParams.selfFlag = selfFlag;
      selfFlagFilter = 'AND v.SELF_FLAG = :selfFlag';
    }
    
    return { brandFilter, platformFilter, selfFlagFilter };
  }
};

/**
 * 🔥 订单明细导出API
 * GET /api/order-details/export
 * 
 * 功能：根据筛选条件获取订单原始数据（Raw Data）
 * 用途：Excel导出、数据分析、报表生成
 * 
 * 查询参数：
 * - startDate: 开始日期 (YYYY-MM-DD)
 * - endDate: 结束日期 (YYYY-MM-DD)
 * - brand: 品牌代码 (18405, 18405-1, 等)
 * - platform: 平台名称 (天猫, 京东, 抖音, 等)
 * - selfFlag: 自管标识 (Y/N/all)
 * - userBrands: 用户权限品牌 (逗号分隔)
 * - limit: 导出数量限制 (默认10000，最大50000)
 * - offset: 偏移量 (默认0)
 */
router.get('/export', async (req, res) => {
  let connection;
  
  try {
    const { executeQuery } = require('../config/database-api');
    
    console.log('\n📦 ========================================');
    console.log('📋 订单明细导出请求');
    console.log('========================================');
    
    // 解析查询参数
    const { 
      startDate, 
      endDate, 
      brand, 
      platform, 
      selfFlag = 'Y',
      userBrands,
      limit = '10000',
      offset = '0' // 🔥 新增：偏移量
    } = req.query;
    
    console.log('📅 查询参数:', {
      startDate,
      endDate,
      brand,
      platform,
      selfFlag,
      userBrands,
      limit,
      offset
    });
    
    // 参数验证
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数：startDate 和 endDate'
      });
    }
    
    // 导出数量限制
    const exportLimit = Math.min(parseInt(limit, 10) || 10000, 50000);
    
    // 构建筛选条件
    const queryParams = {
      dateFrom: startDate,
      dateTo: endDate,
      exportLimit: exportLimit,
      offset: parseInt(offset, 10) || 0 // 🔥 新增：偏移量
    };
    
    // 异步构建筛选条件和参数
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(queryParams, brand, platform, selfFlag, userBrands);
    
    console.log('🔍 SQL参数:', queryParams);
    
    // 🔥 订单明细查询SQL（支持分页）
    const orderDetailsQuery = `
      SELECT * FROM (
        SELECT 
          -- 快递商信息
          v.CARRIERID as carrier_id,
          v.COMPANY_NAME as company_name,
          
          -- 订单基本信息
          v.TSK_MERGE_NO as tsk_merge_no,
          v.CO_PAY_TIME as payment_date,
          v.PLATFORM_CLASS as data_source,
          v.DIS_COMFIRM_TIME_T as wms_outbound_time,
          v.DIS_STATUS_NAME as dis_status_name,
          v.DELIVERY_DAYS as delivery_days,
          v.ORDER_TIME_T as order_time,
          
          -- 时间信息
          v.OUTBOUND_TIME_T as outbound_time,
          v.DELIVERY_TIME_C as delivery_time,
          v.TRACKING_TIME_T as tracking_time,
          v.DISP_TIME_T as disp_time,
          v.ETA_T as eta,
          v.ADDTIME_T as add_time,
          
          -- 时长信息
          v.DELIVERY_TIMES as delivery_times_h,
          v.DELAY_DAYS as delay_days,
          v.DELAY_CLASS_NAME as delay_class_name,
          
          -- 目的地信息
          v.DEST_PROVINCE_NAME as dest_province,
          v.DEST_CITY_NAME as dest_city_name,
          v.DEST_SECTIONE_NAME as dest_section_name,
          v.DEST_CUSTOMER_CONTACT as dest_customer,
          v.DEST_CUSTOMER_TEL1 as dest_customer_phone,
          v.DEST_CUSTOMER_ADDRESS as dest_customer_address,
          
          -- 始发地信息
          v.SOURCE_PROVINCE_NAME as source_province,
          v.SOURCE_CITY_NAME as source_city_name,
          
          -- 货物信息
          v.T_GROSSWEIGHT as t_grossweight,
          v.CAL_TON_AR as cal_ton_ar,
          v.T_CUBIC as t_cubic,
          
          -- WMS信息
          v.BL_ORDER_NO as bl_order_no,
          v.OPERATE_ORG_ID as operate_org_id,
          
          -- 标识信息
          v.IF_DELAY as if_delay,
          v.TR_DESCR as tr_descr,
          v.SELF_FLAG as self_flag,
          v.IS_24H as is_24h,
          v.IS48H_FLAG as is48h_flag,
          
          -- 类型信息
          v.ORDER_TYPE_NAME as order_type_name,
          v.DIS_TYPE_NAME as dis_type_name,
          v.TRSERVICE_TYPE_NAME as trservice_type_name,
          v.BILLING_TYPE as billing_type,
          
          -- 警告原因
          v.PATCH_REASON1 as patch_reason1,
          v.PATCH_REASON2 as patch_reason2,
          
          -- 🔥 行号（用于分页）
          ROWNUM as rnum
          
        FROM APP_CMS.view_TSK_LIST_TASK v
        ${QueryUtils.getBrandJoin('v')}
        ${QueryUtils.BASE_WHERE_CONDITIONS_VIEW}
          ${brandFilter}
          ${platformFilter}
          ${selfFlagFilter}
        ORDER BY v.WMS_OUTBOUND_TIME DESC
      ) WHERE rnum > :offset AND rnum <= (:offset + :exportLimit)
    `;
    
    console.log('🔍 执行查询...');
    const startTime = Date.now();
    
    const result = await executeQuery(orderDetailsQuery, queryParams);
    
    const endTime = Date.now();
    console.log(`✅ 查询完成，耗时: ${endTime - startTime}ms`);
    console.log(`📊 返回记录数: ${result.rows.length}`);
    
    // 🔥 调试：查看第一条原始数据
    if (result.rows.length > 0) {
      console.log('🔍 第一条原始数据类型:', typeof result.rows[0]);
      console.log('🔍 第一条原始数据:', result.rows[0]);
      console.log('🔍 数据字段列表:', Object.keys(result.rows[0]));
    }
    
    // 转换为对象数组（使用别名访问，不是数组索引）
    const orderDetails = result.rows.map(row => ({
      carrierId: row.CARRIER_ID || row.carrier_id,
      companyName: row.COMPANY_NAME || row.company_name,
      tskMergeNo: row.TSK_MERGE_NO || row.tsk_merge_no,
      paymentDate: row.PAYMENT_DATE || row.payment_date,
      dataSource: row.DATA_SOURCE || row.data_source,
      wmsOutboundTime: row.WMS_OUTBOUND_TIME || row.wms_outbound_time,
      disStatusName: row.DIS_STATUS_NAME || row.dis_status_name,
      deliveryDays: row.DELIVERY_DAYS || row.delivery_days,
      orderTime: row.ORDER_TIME || row.order_time,
      outboundTime: row.OUTBOUND_TIME || row.outbound_time,
      deliveryTime: row.DELIVERY_TIME || row.delivery_time,
      trackingTime: row.TRACKING_TIME || row.tracking_time,
      dispTime: row.DISP_TIME || row.disp_time,
      eta: row.ETA || row.eta,
      addTime: row.ADD_TIME || row.add_time,
      deliveryTimesH: row.DELIVERY_TIMES_H || row.delivery_times_h,
      delayDays: row.DELAY_DAYS || row.delay_days,
      delayClassName: row.DELAY_CLASS_NAME || row.delay_class_name,
      destProvince: row.DEST_PROVINCE || row.dest_province,
      destCityName: row.DEST_CITY_NAME || row.dest_city_name,
      destSectionName: row.DEST_SECTION_NAME || row.dest_section_name,
      destCustomer: row.DEST_CUSTOMER || row.dest_customer,
      destCustomerPhone: row.DEST_CUSTOMER_PHONE || row.dest_customer_phone,
      destCustomerAddress: row.DEST_CUSTOMER_ADDRESS || row.dest_customer_address,
      sourceProvince: row.SOURCE_PROVINCE || row.source_province,
      sourceCityName: row.SOURCE_CITY_NAME || row.source_city_name,
      tGrossweight: row.T_GROSSWEIGHT || row.t_grossweight,
      calTonAr: row.CAL_TON_AR || row.cal_ton_ar,
      tCubic: row.T_CUBIC || row.t_cubic,
      blOrderNo: row.BL_ORDER_NO || row.bl_order_no,
      operateOrgId: row.OPERATE_ORG_ID || row.operate_org_id,
      ifDelay: row.IF_DELAY || row.if_delay,
      trDescr: row.TR_DESCR || row.tr_descr,
      selfFlag: row.SELF_FLAG || row.self_flag,
      is24h: row.IS_24H || row.is_24h,
      is48hFlag: row.IS48H_FLAG || row.is48h_flag,
      orderTypeName: row.ORDER_TYPE_NAME || row.order_type_name,
      disTypeName: row.DIS_TYPE_NAME || row.dis_type_name,
      trserviceTypeName: row.TRSERVICE_TYPE_NAME || row.trservice_type_name,
      billingType: row.BILLING_TYPE || row.billing_type,
      patchReason1: row.PATCH_REASON1 || row.patch_reason1,
      patchReason2: row.PATCH_REASON2 || row.patch_reason2
    }));
    
    console.log('✅ 订单明细导出成功');
    console.log('========================================\n');
    
    res.json({
      success: true,
      data: orderDetails,
      metadata: {
        totalRecords: orderDetails.length,
        exportLimit: exportLimit,
        filters: {
          startDate,
          endDate,
          brand: brand || 'all',
          platform: platform || 'all',
          selfFlag: selfFlag || 'Y'
        },
        exportTime: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ 订单明细导出失败:', error);
    console.error('详细错误:', error.stack);
    console.log('========================================\n');
    
    res.status(500).json({
      success: false,
      error: '订单明细导出失败',
      details: error.message
    });
  }
});

module.exports = router;