 /**
 * VF物流数据分析平台 - 地域分析API路由
 * 
 * 提供省份分布、城市分析、地区性能等地域相关统计数据
 */

const express = require('express');
const router = express.Router();
const { getConnection, DateHelper } = require('../config/database-api');
const { getBrandMapping } = require('../utils/brandMapping');
const { buildScopedBrandFilter, getAuthorizedCustomerNos } = require('../utils/brandScope');
const { ERROR_CODES, sendError, sendRouteError } = require('../utils/apiError');

/**
 * 获取省份分布统计
 * GET /api/regional/provinces
 */
router.get('/provinces', async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, selfFlag } = req.query;
    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
    
    if (!dateFrom || !dateTo) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '缺少必需的日期参数',
        details: { requiredFields: ['dateFrom', 'dateTo'] }
      });
    }

    // 参数验证
    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '日期格式无效',
        details: { expectedFormat: 'YYYY-MM-DD' }
      });
    }

    connection = await getConnection();
    
    // 构建筛选条件 - 添加自管筛选支持
    let brandFilter = '';
    let selfFlagFilter = '';
    const params = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };

    const shouldLoadBrandMapping = Boolean((brand && brand !== 'all') || (Array.isArray(authorizedCustomerNos) && authorizedCustomerNos.length > 0));
    const brandMapping = shouldLoadBrandMapping ? await getBrandMapping() : {};
    brandFilter = buildScopedBrandFilter({
      queryParams: params,
      requestedBrands: brand,
      authorizedCustomerNos,
      brandMapping,
      fieldName: 't.CUSTOMERNO',
      paramPrefix: 'brand'
    });
    
    // 🔥 新增：自管筛选条件
    if (selfFlag && selfFlag !== 'all') {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = selfFlag;
    } else if (selfFlag === 'all') {
      selfFlagFilter = '';
    } else {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = 'Y';
    }

    const provincesQuery = `
      SELECT 
        t.DEST_PROVINCE,
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '95' THEN t.TSK_MERGE_NO END) as delivered_count,
        -- 四种核心异常的总数（基于具体业务条件）
        (COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '00' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                             AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2 THEN t.TSK_MERGE_NO END) +
         COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                             AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12 THEN t.TSK_MERGE_NO END) +
         COUNT(DISTINCT CASE WHEN v.IF_DELAY = 'Y' THEN t.TSK_MERGE_NO END) +
         COUNT(DISTINCT CASE WHEN t.IS48H_FLAG = 'Y' THEN t.TSK_MERGE_NO END)) as exception_count,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_time,
        ROUND(COUNT(CASE WHEN t.DIS_STATUS = '95' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate,
        -- 异常率（基于四种核心异常条件）
        ROUND(
          (COUNT(CASE WHEN t.DIS_STATUS = '00' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2 THEN 1 END) +
           COUNT(CASE WHEN t.DIS_STATUS = '55' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12 THEN 1 END) +
           COUNT(CASE WHEN v.IF_DELAY = 'Y' THEN 1 END) +
           COUNT(CASE WHEN t.IS48H_FLAG = 'Y' THEN 1 END)) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) as exception_rate
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      WHERE to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom
        AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo
        AND t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.DEST_PROVINCE IS NOT NULL
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
        ${selfFlagFilter}
      GROUP BY t.DEST_PROVINCE
      ORDER BY order_count DESC
    `;

    const result = await connection.execute(provincesQuery, params);
    const provincesData = result.rows.map(row => ({
      province: row[0],
      orderCount: row[1] || 0,
      deliveredCount: row[2] || 0,
      exceptionCount: row[3] || 0,
      avgDeliveryTime: row[4] || 0,
      deliveryRate: row[5] || 0,
      exceptionRate: row[6] || 0
    }));

    res.json({
      success: true,
      data: provincesData,
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        selfFlag: selfFlag || 'Y'
      }
    });

  } catch (error) {
    console.error('省份分布查询失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取省份分布数据失败' });
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
 * 获取城市分布统计
 * GET /api/regional/cities
 */
router.get('/cities', async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, province, selfFlag } = req.query;
    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
    
    if (!dateFrom || !dateTo) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '缺少必需的日期参数',
        details: { requiredFields: ['dateFrom', 'dateTo'] }
      });
    }

    // 参数验证
    if (!DateHelper.isValidDateString(dateFrom) || !DateHelper.isValidDateString(dateTo)) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '日期格式无效',
        details: { expectedFormat: 'YYYY-MM-DD' }
      });
    }

    connection = await getConnection();
    
    // 构建筛选条件 - 添加自管筛选支持
    let brandFilter = '';
    let provinceFilter = '';
    let selfFlagFilter = '';
    const params = {
      dateFrom: dateFrom,
      dateTo: dateTo
    };

    const shouldLoadBrandMapping = Boolean((brand && brand !== 'all') || (Array.isArray(authorizedCustomerNos) && authorizedCustomerNos.length > 0));
    const brandMapping = shouldLoadBrandMapping ? await getBrandMapping() : {};
    brandFilter = buildScopedBrandFilter({
      queryParams: params,
      requestedBrands: brand,
      authorizedCustomerNos,
      brandMapping,
      fieldName: 't.CUSTOMERNO',
      paramPrefix: 'brand'
    });
    
    if (province && province !== 'all') {
      provinceFilter = ` AND t.DEST_PROVINCE = :province`;
      params.province = province;
    }
    
    // 🔥 新增：自管筛选条件
    if (selfFlag && selfFlag !== 'all') {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = selfFlag;
    } else if (selfFlag === 'all') {
      selfFlagFilter = '';
    } else {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      params.selfFlag = 'Y';
    }

    const citiesQuery = `
      SELECT 
        t.DEST_PROVINCE,
        t.DEST_CITY,
        COUNT(DISTINCT t.TSK_MERGE_NO) as order_count,
        COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '95' THEN t.TSK_MERGE_NO END) as delivered_count,
        -- 四种核心异常的总数（基于具体业务条件）
        (COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '00' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                             AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2 THEN t.TSK_MERGE_NO END) +
         COUNT(DISTINCT CASE WHEN t.DIS_STATUS = '55' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                             AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12 THEN t.TSK_MERGE_NO END) +
         COUNT(DISTINCT CASE WHEN v.IF_DELAY = 'Y' THEN t.TSK_MERGE_NO END) +
         COUNT(DISTINCT CASE WHEN t.IS48H_FLAG = 'Y' THEN t.TSK_MERGE_NO END)) as exception_count,
        ROUND(AVG(CASE WHEN t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 > 0 THEN t.SUM_SEND_TIME2 END), 2) as avg_delivery_time,
        ROUND(COUNT(CASE WHEN t.DIS_STATUS = '95' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as delivery_rate,
        -- 异常率（基于四种核心异常条件）
        ROUND(
          (COUNT(CASE WHEN t.DIS_STATUS = '00' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 2 THEN 1 END) +
           COUNT(CASE WHEN t.DIS_STATUS = '55' AND t.WMS_OUTBOUND_TIME IS NOT NULL 
                      AND (SYSDATE - t.WMS_OUTBOUND_TIME) * 24 > 12 THEN 1 END) +
           COUNT(CASE WHEN v.IF_DELAY = 'Y' THEN 1 END) +
           COUNT(CASE WHEN t.IS48H_FLAG = 'Y' THEN 1 END)) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) as exception_rate
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      WHERE to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom
        AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo
        AND t.WMS_OUTBOUND_TIME IS NOT NULL
        AND t.DEST_PROVINCE IS NOT NULL
        AND t.DEST_CITY IS NOT NULL
        AND t.TSK_MERGE_NO IS NOT NULL
        ${brandFilter}
        ${provinceFilter}
        ${selfFlagFilter}
      GROUP BY t.DEST_PROVINCE, t.DEST_CITY
      ORDER BY order_count DESC
      FETCH FIRST 500 ROWS ONLY
    `;

    const result = await connection.execute(citiesQuery, params);
    const citiesData = result.rows.map(row => ({
      province: row[0],
      city: row[1],
      orderCount: row[2] || 0,
      deliveredCount: row[3] || 0,
      exceptionCount: row[4] || 0,
      avgDeliveryTime: row[5] || 0,
      deliveryRate: row[6] || 0,
      exceptionRate: row[7] || 0
    }));

    res.json({
      success: true,
      data: citiesData,
      timestamp: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        province: province || 'all',
        selfFlag: selfFlag || 'Y'
      }
    });

  } catch (error) {
    console.error('城市分布查询失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取城市分布数据失败' });
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