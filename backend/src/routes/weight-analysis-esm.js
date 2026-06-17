/**
 * VF物流数据分析平台 - 重量分析API路由
 *
 * 说明：
 * - 以 CommonJS 方式运行，兼容当前 api-server.js
 * - 支持应收/应付计费重切换
 * - 使用登录态 req.user 进行权限判断，query.userId 仅作为兜底
 */

const express = require('express');
const router = express.Router();
const { getConnection, DateHelper } = require('../config/database-api');
const { getBrandMapping } = require('../utils/brandMapping');
const { buildScopedBrandFilter, getAuthorizedCustomerNos } = require('../utils/brandScope');
const { sendError, sendRouteError, ERROR_CODES } = require('../utils/apiError');

const WEIGHT_RANGES = [
  { key: '0-0.5kg', label: '0-0.5kg', sortOrder: 1 },
  { key: '0.5-1kg', label: '0.5-1kg', sortOrder: 2 },
  { key: '1-2kg', label: '1-2kg', sortOrder: 3 },
  { key: '2-3kg', label: '2-3kg', sortOrder: 4 },
  { key: '>3kg', label: '>3kg', sortOrder: 5 }
];

// 快递公司映射（与其他API保持一致）
const INTERNAL_ROLE_IDS = new Set(['WPSAMIN', 'WPSADMIN']);
const EXTERNAL_ROLE_IDS = new Set(['CUSTOMER', 'CS', 'BRAND', 'VF_BRAND', 'LFAM']);

function toWeightCaseSql(weightColumn) {
  return `
    CASE
      WHEN ${weightColumn} > 0 AND ${weightColumn} <= 0.5 THEN '0-0.5kg'
      WHEN ${weightColumn} > 0.5 AND ${weightColumn} <= 1 THEN '0.5-1kg'
      WHEN ${weightColumn} > 1 AND ${weightColumn} <= 2 THEN '1-2kg'
      WHEN ${weightColumn} > 2 AND ${weightColumn} <= 3 THEN '2-3kg'
      WHEN ${weightColumn} > 3 THEN '>3kg'
      ELSE 'unknown'
    END
  `;
}

async function resolveUserRole(connection, req, queryUserId) {
  let userId = req.user?.userId || queryUserId;
  let roleId = String(req.user?.roleId || '').toUpperCase();
  let userName = req.user?.userName || '';

  if ((!roleId || !userName) && userId) {
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

  const isInternalUser = INTERNAL_ROLE_IDS.has(roleId) || Boolean(req.user?.isAdmin);
  const isExternalUser = EXTERNAL_ROLE_IDS.has(roleId);

  return {
    userId,
    userName,
    roleId,
    isInternalUser,
    isExternalUser,
    allowedWeightTypes: isInternalUser ? ['payable', 'receivable'] : ['receivable'],
    defaultWeightType: 'receivable'
  };
}

/**
 * GET /api/logistics/weight-analysis
 * 获取重量分析数据
 * 
 * Query参数：
 * - dateFrom: 开始日期 (YYYY-MM-DD)
 * - dateTo: 结束日期 (YYYY-MM-DD)
 * - brand: 品牌代码（可选，如 DICKIES）
 * - platform: 平台（可选）
 * - selfFlag: 自管标识（可选，Y/N）
 * - weightType: 重量类型（payable=应付, receivable=应收）
 * - userId: 用户ID（用于权限验证）
 */
router.get('/weight-analysis', async (req, res) => {
  let connection;
  // 全局日志，确认请求已进入主逻辑
  console.log('[重量分析] 收到请求:', req.originalUrl, req.query);
  try {
    const {
      dateFrom,
      dateTo,
      brand,
      platform,
      selfFlag,
      weightType = 'receivable',
      userId
    } = req.query;

    if (!dateFrom || !dateTo) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '缺少必需参数：dateFrom 和 dateTo'
      });
    }

    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '日期格式无效，请使用 YYYY-MM-DD'
      });
    }

    if (!['payable', 'receivable'].includes(String(weightType))) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: 'weightType 参数无效',
        details: { allowedValues: ['payable', 'receivable'] }
      });
    }

    connection = await getConnection();

    const permissions = await resolveUserRole(connection, req, userId);

    if (!permissions.userId) {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_FAILED,
        error: '未识别到用户身份，无法查询重量分析'
      });
    }

    if (!permissions.isInternalUser && weightType === 'payable') {
      return sendError(res, req, {
        status: 403,
        code: ERROR_CODES.AUTH_FAILED,
        error: '外部用户无权查看应付计费重量数据',
        details: {
          allowedWeightTypes: ['receivable']
        }
      });
    }

    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
    const brandMapping = await getBrandMapping();
    const weightColumn = weightType === 'payable' ? 'v.CAL_TON_AP' : 'v.CAL_TON_AR';
    const weightCaseSql = toWeightCaseSql(weightColumn);
    // 保证品牌分析接口与品牌筛选器编码一致，brandNameSql直接用t.CUSTOMERNO
    const brandNameSql = 't.CUSTOMERNO';

    const params = { dateFrom, dateTo };
    // 日志：打印用户权限品牌
    console.log('[重量分析] authorizedCustomerNos:', authorizedCustomerNos);
    // 日志：打印品牌映射表
    console.log('[重量分析] brandMapping:', brandMapping);
    // 日志：打印请求参数 brand
    console.log('[重量分析] 请求参数 brand:', brand);
    // 日志：打印初始 params
    console.log('[重量分析] 初始 params:', params);
    // 🔥 修复：buildScopedBrandFilter使用CUSTOMERNO进行权限筛选
    const brandFilter = buildScopedBrandFilter({
      queryParams: params,
      requestedBrands: brand,
      authorizedCustomerNos,
      brandMapping,
      fieldName: 't.CUSTOMERNO',  // 🔥 使用CUSTOMERNO筛选
      paramPrefix: 'brand'
    });
    // 日志：打印brandFilter和最终params
    console.log('[重量分析] brandFilter:', brandFilter);
    console.log('[重量分析] 最终 params:', params);

    // 先处理 platformFilter 和 selfFlagFilter
    let platformFilter = '';
    if (platform && platform !== 'all') {
      platformFilter = `
        AND EXISTS (
          SELECT 1
          FROM APP_CMS.BAS_CODES bc
          WHERE bc.CODEID = 'PLATFORM_CLASS'
            AND bc.CODE = t.PLATFORM
            AND bc.UDF1 = :platform
        )
      `;
      params.platform = platform;
    }

    let selfFlagFilter = '';
    if (selfFlag && selfFlag !== 'all') {
      selfFlagFilter = ' AND t.SELF_FLAG = :selfFlag';
      params.selfFlag = selfFlag;
    } else if (!selfFlag) {
      selfFlagFilter = ' AND t.SELF_FLAG = :selfFlag';
      params.selfFlag = 'Y';
    }

    // 先定义 baseWhere
    const baseWhere = `
      WHERE t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.WMS_OUTBOUND_TIME >= TO_DATE(:dateFrom, 'YYYY-MM-DD')
        AND t.WMS_OUTBOUND_TIME < TO_DATE(:dateTo, 'YYYY-MM-DD') + 1
        AND t.TSK_MERGE_NO IS NOT NULL
        AND ${weightColumn} IS NOT NULL
        AND ${weightColumn} > 0
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
    `;
    // 日志：打印最终SQL片段
    console.log('[重量分析] baseWhere:', `\n${baseWhere}`);

    // 再定义所有SQL
    const rangeQuery = `
      SELECT
        ${weightCaseSql} AS weight_range,
        COUNT(DISTINCT t.TSK_MERGE_NO) AS order_count,
        ROUND(AVG(${weightColumn}), 3) AS avg_weight
      FROM APP_CMS.TSK_LIST_TASK t
      JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      ${baseWhere}
      GROUP BY ${weightCaseSql}
    `;

    const brandQuery = `
      SELECT
        ${brandNameSql} AS brand_name,
        ${weightCaseSql} AS weight_range,
        COUNT(DISTINCT t.TSK_MERGE_NO) AS order_count,
        ROUND(AVG(${weightColumn}), 3) AS avg_weight
      FROM APP_CMS.TSK_LIST_TASK t
      JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      ${baseWhere}
      GROUP BY ${brandNameSql}, ${weightCaseSql}
    `;

    const courierQuery = `
      SELECT
        NVL(bc.COMPANY_ABNAME, t.CARRIERID) AS carrier_name,
        ${weightCaseSql} AS weight_range,
        COUNT(DISTINCT t.TSK_MERGE_NO) AS order_count,
        ROUND(AVG(${weightColumn}), 3) AS avg_weight
      FROM APP_CMS.TSK_LIST_TASK t
      JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CARRIERID = bc.COMPANY_SYSID
      ${baseWhere}
        AND t.CARRIERID IS NOT NULL
      GROUP BY NVL(bc.COMPANY_ABNAME, t.CARRIERID), ${weightCaseSql}
    `;

    const brandCourierQuery = `
      SELECT
        ${brandNameSql} AS brand_name,
        NVL(bc.COMPANY_ABNAME, t.CARRIERID) AS carrier_name,
        ${weightCaseSql} AS weight_range,
        COUNT(DISTINCT t.TSK_MERGE_NO) AS order_count,
        ROUND(AVG(${weightColumn}), 3) AS avg_weight
      FROM APP_CMS.TSK_LIST_TASK t
      JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CARRIERID = bc.COMPANY_SYSID
      ${baseWhere}
        AND t.CARRIERID IS NOT NULL
      GROUP BY ${brandNameSql}, NVL(bc.COMPANY_ABNAME, t.CARRIERID), ${weightCaseSql}
    `;

    const overallQuery = `
      SELECT
        COUNT(DISTINCT t.TSK_MERGE_NO) AS total_orders,
        ROUND(AVG(${weightColumn}), 3) AS avg_weight,
        ROUND(MIN(${weightColumn}), 3) AS min_weight,
        ROUND(MAX(${weightColumn}), 3) AS max_weight
      FROM APP_CMS.TSK_LIST_TASK t
      JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      ${baseWhere}
    `;

    // 地区分析SQL：按省份统计订单数、平均重量、快递公司，区分轻量包裹
    const regionQuery = `
      SELECT
        v.DEST_PROVINCE_NAME AS province,
        NVL(bc.COMPANY_ABNAME, t.CARRIERID) AS carrier_name,
        COUNT(DISTINCT t.TSK_MERGE_NO) AS order_count,
        ROUND(AVG(${weightColumn}), 3) AS avg_weight,
        SUM(CASE WHEN ${weightColumn} <= 1 THEN 1 ELSE 0 END) AS light_order_count,
        ROUND(AVG(CASE WHEN ${weightColumn} <= 1 THEN ${weightColumn} END), 3) AS light_avg_weight
      FROM APP_CMS.TSK_LIST_TASK t
      JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CARRIERID = bc.COMPANY_SYSID
      ${baseWhere}
        AND v.DEST_PROVINCE_NAME IS NOT NULL
      GROUP BY v.DEST_PROVINCE_NAME, NVL(bc.COMPANY_ABNAME, t.CARRIERID)
    `;

    // 日志：打印 regionQuery 及参数
    console.log('[地区分析] regionQuery SQL:', regionQuery);
    console.log('[地区分析] regionQuery params:', params);
    const [rangeResult, brandResult, courierResult, brandCourierResult, overallResult, regionResult] = await Promise.all([
      connection.execute(rangeQuery, params),
      connection.execute(brandQuery, params),
      connection.execute(courierQuery, params),
      connection.execute(brandCourierQuery, params),
      connection.execute(overallQuery, params),
      connection.execute(regionQuery, params)
    ]);
    // 地区分析数据处理
    const regionRows = regionResult.rows || [];
    // 结构：{ province: string, order_count: number, avg_weight: number, carriers: { [carrier]: { order_count, avg_weight, avg_fee } } }
    const regionMap = new Map();
    console.log('[地区分析] regionRows:', JSON.stringify(regionRows, null, 2));

    regionRows.forEach(row => {
      const province = row[0] || '未知';
      const carrier = row[1] || '未知';
      const orderCount = Number(row[2] || 0);
      const avgWeight = Number(row[3] || 0);
      const lightOrderCount = Number(row[4] || 0);  // 轻量包裹订单数
      const lightAvgWeight = Number(row[5] || 0);   // 轻量包裹平均重量
      
      // 运费规则
      let avgFee = 0;
      if (carrier.includes('顺丰')) {
        avgFee = 15;
      } else if (carrier.includes('中通')) {
        avgFee = 10;
      } else {
        avgFee = 8;
      }
      if (!regionMap.has(province)) {
        regionMap.set(province, { 
          province, 
          totalOrders: 0, 
          lightOrders: 0,  // 新增：轻量包裹总数
          carriers: {}, 
          avgWeightSum: 0, 
          carrierCount: 0 
        });
      }
      const provObj = regionMap.get(province);
      provObj.totalOrders += orderCount;
      provObj.lightOrders += lightOrderCount;  // 累加轻量包裹数
      provObj.avgWeightSum += avgWeight * orderCount;
      provObj.carrierCount += orderCount;
      provObj.carriers[carrier] = {
        orderCount,
        lightOrderCount,  // 新增
        avgWeight,
        lightAvgWeight,   // 新增
        avgFee
      };
    });
    // 生成最终地区分析数组
    const regionAnalysis = Array.from(regionMap.values()).map(item => ({
      province: item.province,
      totalOrders: item.totalOrders,
      lightOrders: item.lightOrders,  // 新增：轻量包裹数
      lightRatio: item.totalOrders > 0 ? Number(((item.lightOrders / item.totalOrders) * 100).toFixed(1)) : 0,  // 新增：轻量包裹占比
      avgWeight: item.carrierCount > 0 ? Number((item.avgWeightSum / item.carrierCount).toFixed(3)) : 0,
      carriers: item.carriers
    }));
    console.log('[地区分析] regionAnalysis:', JSON.stringify(regionAnalysis, null, 2));

    const rangeRows = rangeResult.rows || [];
    const brandRows = brandResult.rows || [];
    const courierRows = courierResult.rows || [];
    const brandCourierRows = brandCourierResult.rows || [];
    const overallRows = overallResult.rows || [];

    const rangeMap = new Map();
    rangeRows.forEach((row) => {
      rangeMap.set(row[0], {
        range: row[0],
        orders: Number(row[1] || 0),
        avgWeight: Number(row[2] || 0)
      });
    });

    const weightRangeDistribution = WEIGHT_RANGES.map((cfg) => {
      const matched = rangeMap.get(cfg.key);
      return {
        range: cfg.label,
        rangeKey: cfg.key,
        sortOrder: cfg.sortOrder,
        orders: matched?.orders || 0,
        avgWeight: matched?.avgWeight || 0
      };
    });

    const brandWeightDistribution = {};
    brandRows.forEach((row) => {
      const brandName = row[0] || 'UNKNOWN';
      const weightRange = row[1];
      if (!brandWeightDistribution[brandName]) {
        brandWeightDistribution[brandName] = [];
      }
      brandWeightDistribution[brandName].push({
        range: weightRange,
        orders: Number(row[2] || 0),
        avgWeight: Number(row[3] || 0)
      });
    });

    const courierWeightDistribution = {};
    courierRows.forEach((row) => {
      const courierName = row[0] || 'UNKNOWN';
      const weightRange = row[1];
      if (!courierWeightDistribution[courierName]) {
        courierWeightDistribution[courierName] = [];
      }
      courierWeightDistribution[courierName].push({
        range: weightRange,
        orders: Number(row[2] || 0),
        avgWeight: Number(row[3] || 0)
      });
    });

    const brandCourierWeightDistribution = {};
    brandCourierRows.forEach((row) => {
      const brandName = row[0] || 'UNKNOWN';
      const courierName = row[1] || 'UNKNOWN';
      const weightRange = row[2];

      if (!brandCourierWeightDistribution[brandName]) {
        brandCourierWeightDistribution[brandName] = {};
      }
      if (!brandCourierWeightDistribution[brandName][courierName]) {
        brandCourierWeightDistribution[brandName][courierName] = [];
      }

      brandCourierWeightDistribution[brandName][courierName].push({
        range: weightRange,
        orders: Number(row[3] || 0),
        avgWeight: Number(row[4] || 0)
      });
    });

    const overall = overallRows.length > 0
      ? {
          totalOrders: Number(overallRows[0][0] || 0),
          avgWeight: Number(overallRows[0][1] || 0),
          minWeight: Number(overallRows[0][2] || 0),
          maxWeight: Number(overallRows[0][3] || 0)
        }
      : {
          totalOrders: 0,
          avgWeight: 0,
          minWeight: 0,
          maxWeight: 0
        };

    const lightWeightOrders = weightRangeDistribution
      .filter((item) => item.rangeKey === '0-0.5kg' || item.rangeKey === '0.5-1kg')
      .reduce((sum, item) => sum + item.orders, 0);

    const lightWeightRatio = overall.totalOrders > 0
      ? Number(((lightWeightOrders / overall.totalOrders) * 100).toFixed(2))
      : 0;

    return res.json({
      success: true,
      data: {
        weightType,
        weightTypeLabel: weightType === 'payable' ? '应付计费重' : '应收计费重',
        dateRange: { from: dateFrom, to: dateTo },
        filters: { brand: brand || 'all', platform: platform || 'all', selfFlag: selfFlag || 'Y' },
        userPermissions: permissions,
        overallStats: {
          ...overall,
          lightWeightOrders,
          lightWeightRatio
        },
        weightRangeDistribution,
        brandWeightDistribution,
        courierWeightDistribution,
        brandCourierWeightDistribution,
        regionAnalysis // 新增：地区分析
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 重量分析API错误:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取重量分析数据失败' });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('❌ 关闭数据库连接失败:', err);
      }
    }
  }
});

/**
 * GET /api/logistics/weight-analysis/permissions
 * 仅查询用户权限（不返回数据）
 * 
 * Query参数：
 * - userId: 用户ID
 */
router.get('/weight-analysis/permissions', async (req, res) => {
  let connection;
  
  try {
    const queryUserId = req.query.userId;

    connection = await getConnection();

    const permissions = await resolveUserRole(connection, req, queryUserId);
    if (!permissions.userId) {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_FAILED,
        error: '未提供用户ID'
      });
    }

    return res.json({
      success: true,
      data: permissions
    });

  } catch (error) {
    console.error('❌ 权限查询API错误:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取重量分析权限失败' });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('❌ 关闭数据库连接失败:', err);
      }
    }
  }
});

module.exports = router;