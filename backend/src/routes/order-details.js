const express = require('express');
const router = express.Router();
const { getBrandMapping } = require('../utils/brandMapping');
const { buildScopedBrandFilter, getAuthorizedCustomerNos } = require('../utils/brandScope');
const { ERROR_CODES, sendError, sendRouteError } = require('../utils/apiError');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BRAND_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const SELF_FLAG_VALUES = new Set(['Y', 'N', 'all']);
const NO_UPDATE_48H_EXCLUDED_STATUSES = "('40','90','93','94','95','99','100','105','110')";

function buildNoUpdate48hCondition(flagExpr, statusExpr) {
  return `(${flagExpr} = 'Y' AND ${statusExpr} NOT IN ${NO_UPDATE_48H_EXCLUDED_STATUSES})`;
}

function isValidDateValue(value) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parsePositiveInteger(value, defaultValue, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (!/^\d+$/.test(String(value))) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

function normalizeBrandList(value) {
  if (!value || value === 'all') {
    return null;
  }

  const brandList = Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : String(value).split(',').map((item) => item.trim()).filter(Boolean);

  if (brandList.length === 0 || brandList.length > 20) {
    return null;
  }

  if (!brandList.every((item) => BRAND_CODE_PATTERN.test(item))) {
    return null;
  }

  return brandList;
}

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
    
    // 超48H未更新: 视图IS_48H='Y'且视图状态不属于已结束状态的订单
    NO_UPDATE_48H: buildNoUpdate48hCondition('v.IS_48H', 'v.DIS_STATUS')
  },

  // ✅ 异步构建筛选条件和参数（支持动态品牌映射） - 与overview.js保持一致
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
      fieldName: 'v.CUSTOMERNO',
      paramPrefix: 'brand'
    }).trim();
    
    // 🔧 平台筛选 - 支持单值或数组，使用PLATFORM_CLASS字段（VIEW视图已处理好）
    if (platform && platform !== 'all') {
      const normalize = (v) => {
        if (v == null) return undefined;
        if (typeof v === 'string') {
          const t = v.trim();
          if (t === '') return undefined;
          if (t.includes(',')) return t.split(',').map(s => s.trim()).filter(Boolean);
          return t;
        }
        if (Array.isArray(v)) return v.map(i => String(i).trim()).filter(Boolean);
        return undefined;
      };

      const normalizedPlatform = normalize(platform);
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
          // 兼容半角/全角斜杠，避免“官网/小程序”类平台在不同数据源中匹配失败
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
        const placeholders = expanded.map((_, i) => `:platform_${i}`).join(', ');
        expanded.forEach((p, i) => { queryParams[`platform_${i}`] = p; });
        platformFilter = `AND REPLACE(TRIM(v.PLATFORM_CLASS), '／', '/') IN (${placeholders})`;
      }
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
      limit = '10000',
      offset = '0' // 🔥 新增：偏移量
    } = req.query;
    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
    
    console.log('📅 查询参数:', {
      startDate,
      endDate,
      brand,
      platform,
      selfFlag,
      authorizedCustomerNos,
      limit,
      offset
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

    if (!isValidDateValue(startDate) || !isValidDateValue(endDate)) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '日期格式无效，请使用 YYYY-MM-DD',
        details: { expectedFormat: 'YYYY-MM-DD' }
      });
    }

    if (new Date(`${startDate}T00:00:00Z`) > new Date(`${endDate}T00:00:00Z`)) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '开始日期不能晚于结束日期'
      });
    }

    const normalizedBrandList = normalizeBrandList(brand);
    if (brand && brand !== 'all' && !normalizedBrandList) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: 'brand 参数格式无效'
      });
    }

    if (platform && String(platform).length > 32) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: 'platform 参数长度超出限制'
      });
    }

    if (!SELF_FLAG_VALUES.has(selfFlag)) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: 'selfFlag 参数无效，仅支持 Y、N、all'
      });
    }
    
    // 导出数量限制
    const exportLimit = parsePositiveInteger(limit, 10000, { min: 1, max: 50000 });
    const exportOffset = parsePositiveInteger(offset, 0, { min: 0, max: 1000000 });

    if (exportLimit === null || exportOffset === null) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: 'limit 或 offset 参数无效'
      });
    }
    
    // 构建筛选条件
    const queryParams = {
      dateFrom: startDate,
      dateTo: endDate,
      exportLimit: exportLimit,
      offset: exportOffset // 🔥 新增：偏移量
    };
    
    // 异步构建筛选条件和参数
    const { brandFilter, platformFilter, selfFlagFilter } = await QueryUtils.buildFiltersAsync(
      queryParams,
      normalizedBrandList || brand,
      platform,
      selfFlag,
      authorizedCustomerNos
    );
    
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
          v.IS_48H as is_48h,
          
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
      is48hFlag: row.IS_48H || row.is_48h,
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
    
    return sendRouteError(res, req, error, { fallbackError: '订单明细导出失败' });
  }
});

module.exports = router;