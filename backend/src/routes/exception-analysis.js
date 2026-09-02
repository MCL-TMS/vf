/**
 * VF物流数据分析平台 - 异常监控分析API路由（CommonJS版本）
 * 
 * 提供基于责任方和异常原因的精准异常分析功能
 * 数据源：APP_CMS.view_TSK_LIST_TASK 视图
 * 核心字段：
 *   - CARRIERID_NAME：快递商名称
 *   - PATCH_REASON_GS：异常责任方
 *   - patch_reason2_name：异常原因
 */

const express = require('express');
const router = express.Router();
const { getConnection } = require('../config/database-api');
const oracledb = require('oracledb'); // 🔥 新增：导入 oracledb 以使用 OUT_FORMAT_OBJECT
const { getBrandMapping } = require('../utils/brandMapping');
const { buildScopedBrandFilter, getAuthorizedCustomerNos } = require('../utils/brandScope');
const { globalRateLimiter } = require('../middleware/rateLimitMiddleware');
const { ERROR_CODES, sendError, sendRouteError } = require('../utils/apiError');

/**
 * 🎯 异常监控分析 - 主接口
 * GET /api/exception-analysis/overview
 * 
 * 查询参数：
 * - dateFrom: 开始日期 (格式: YYYY-MM-DD)
 * - dateTo: 结束日期 (格式: YYYY-MM-DD)
 * - brand: 品牌代码 (可选，默认: all)
 * - platform: 平台 (可选，默认: all)
 * - selfFlag: 自管标识 (可选，Y/N)
 * 返回数据：
 * {
 *   success: true,
 *   data: {
 *     summary: { 总异常数量、责任方分布统计 },
 *     byResponsibility: [ 按责任方分组的异常数据 ],
 *     byCarrier: [ 按快递商分组的异常数据 ],
 *     byReason: [ 按异常原因分组的异常数据 ],
 *     crossAnalysis: [ 快递商×责任方×异常原因交叉分析 ]
 *   }
 * }
 */
router.get('/overview', globalRateLimiter, async (req, res) => {
  let connection;
  
  try {
    const { dateFrom, dateTo, brand, platform, selfFlag } = req.query;
    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
    
    console.log('🔄 [Exception-Analysis] 收到异常监控分析请求:', { 
      dateFrom, dateTo, brand, platform, selfFlag, authorizedCustomerNos 
    });
    
    // 🔒 参数验证
    if (!dateFrom || !dateTo) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '缺少必需的日期参数',
        details: { requiredFields: ['dateFrom', 'dateTo'] }
      });
    }
    
    // 🔌 获取数据库连接
    connection = await getConnection();
    console.log('✅ [Exception-Analysis] 数据库连接成功');
    
    // 🔧 构建查询参数
    const queryParams = {
      dateFrom,
      dateTo
    };
    const brandMapping = await getBrandMapping();
    
    const brandFilter = buildScopedBrandFilter({
      queryParams,
      requestedBrands: brand,
      authorizedCustomerNos,
      brandMapping,
      fieldName: 't.CUSTOMERNO',
      paramPrefix: 'brand'
    });
    
    // 🔥 构建平台筛选条件（支持单值或数组）
    let platformFilter = '';
    const normalizeStringOrArray = (v) => {
      if (v == null) return undefined;
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed === '') return undefined;
        // 支持逗号分隔的多值字符串
        if (trimmed.includes(',')) {
          return trimmed.split(',').map(s => s.trim()).filter(Boolean);
        }
        return trimmed;
      }
      if (Array.isArray(v)) return v.map(i => String(i).trim()).filter(Boolean);
      return undefined;
    };

    const PLATFORM_MAPPING = {
      'tmall': '天猫',
      'douyin': '抖音',
      'jd': '京东',
      'pdd': '拼多多',
      'official': '官网/小程序',
      'o2o': 'O2O',
      'xiaohongshu': '小红书',
      'wechat': '微信'
    };

    const normalizedPlatform = normalizeStringOrArray(platform);
    if (normalizedPlatform && normalizedPlatform !== 'all') {
      // 直接使用视图字段 PLATFORM_CLASS 过滤，避免依赖不存在的 t.PLATFORM 字段
      const requested = Array.isArray(normalizedPlatform) ? normalizedPlatform : [normalizedPlatform];
      const expandSet = new Set();
      requested.forEach((p) => {
        const token = String(p || '').trim();
        if (!token) return;
        expandSet.add(token);
        const mapped = PLATFORM_MAPPING[token.toLowerCase()] || PLATFORM_MAPPING[token] || token;
        expandSet.add(mapped);
      });

      const expanded = Array.from(expandSet)
        .map((v) => String(v).trim().replace(/／/g, '/'))
        .filter(Boolean);

      if (expanded.length > 0) {
        const placeholders = expanded.map((_, i) => `:platform_${i}`).join(', ');
        platformFilter = ` AND REPLACE(TRIM(t.PLATFORM_CLASS), '／', '/') IN (${placeholders})`;
        expanded.forEach((val, i) => { queryParams[`platform_${i}`] = val; });
        console.log(`🏪 [Exception-Analysis] 平台多选/单选展开匹配: [${expanded.join(', ')}]`);
      }
    }
    
    // 🔥 构建自管筛选条件
    let selfFlagFilter = '';
    if (selfFlag && (selfFlag === 'Y' || selfFlag === 'N')) {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      queryParams.selfFlag = selfFlag;
      console.log(`🔖 [Exception-Analysis] 自管筛选: ${selfFlag}`);
    }
    
    // ==================== 查询1: 总览统计 ====================
    const summarySQL = `
      SELECT 
        COUNT(*) as TOTAL_EXCEPTIONS,
        COUNT(DISTINCT t.CARRIERID) as TOTAL_CARRIERS,
        COUNT(DISTINCT t.PATCH_REASON_GS) as TOTAL_RESPONSIBILITY_TYPES,
        COUNT(DISTINCT t.patch_reason2_name) as TOTAL_REASON_TYPES,
        SUM(CASE WHEN t.PATCH_REASON_GS = '快递责任' THEN 1 ELSE 0 END) as CARRIER_RESPONSIBILITY_COUNT,
        SUM(CASE WHEN t.PATCH_REASON_GS != '快递责任' THEN 1 ELSE 0 END) as OTHER_RESPONSIBILITY_COUNT
      FROM APP_CMS.view_TSK_LIST_TASK t
      WHERE (
        (t.WMS_OUTBOUND_TIME IS NOT NULL 
         AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom 
         AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
      )
        AND t.TSK_MERGE_NO IS NOT NULL
        AND t.PATCH_REASON_GS IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
    `;
    
    console.log('📊 [Exception-Analysis] 执行总览统计查询...');
    console.log('🔍 [Exception-Analysis] SQL:', summarySQL);
    console.log('🔍 [Exception-Analysis] 参数:', queryParams);
    
    const summaryResult = await connection.execute(summarySQL, queryParams, {
      outFormat: oracledb.OUT_FORMAT_OBJECT // 🔥 显式指定输出格式为对象
    });
    
    console.log('🔍 [Exception-Analysis] summaryResult 结构:', {
      hasRows: !!summaryResult.rows,
      rowsLength: summaryResult.rows?.length,
      hasMetaData: !!summaryResult.metaData,
      firstRowType: summaryResult.rows?.[0] ? typeof summaryResult.rows[0] : 'undefined',
      firstRowKeys: summaryResult.rows?.[0] ? Object.keys(summaryResult.rows[0]) : []
    });
    
    const summary = summaryResult.rows[0];
    
    console.log('✅ [Exception-Analysis] 总览统计完成:', {
      总异常数: summary.TOTAL_EXCEPTIONS,
      快递商数: summary.TOTAL_CARRIERS,
      责任方类型数: summary.TOTAL_RESPONSIBILITY_TYPES,
      异常原因类型数: summary.TOTAL_REASON_TYPES,
      summaryObject: summary // 🔥 输出完整对象用于调试
    });
    
    // ==================== 查询2: 按责任方分组 ====================
    const byResponsibilitySQL = `
      SELECT 
        NVL(t.PATCH_REASON_GS, '未分类') as RESPONSIBILITY,
        COUNT(*) as EXCEPTION_COUNT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as PERCENTAGE,
        COUNT(DISTINCT t.CARRIERID) as AFFECTED_CARRIERS,
        COUNT(DISTINCT t.patch_reason2_name) as REASON_TYPES
      FROM APP_CMS.view_TSK_LIST_TASK t
      WHERE (
        (t.WMS_OUTBOUND_TIME IS NOT NULL 
         AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom 
         AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
      )
        AND t.TSK_MERGE_NO IS NOT NULL
        AND t.PATCH_REASON_GS IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.PATCH_REASON_GS
      ORDER BY EXCEPTION_COUNT DESC
    `;
    
    console.log('📊 [Exception-Analysis] 执行责任方分组查询...');
    const byResponsibilityResult = await connection.execute(byResponsibilitySQL, queryParams, {
      outFormat: oracledb.OUT_FORMAT_OBJECT // 🔥 显式指定输出格式为对象
    });
    
    // ==================== 查询3: 按快递商分组 ====================
    const byCarrierSQL = `
      SELECT 
        t.CARRIERID as CARRIER_ID,
        NVL(bc_carrier.COMPANY_ABNAME, t.CARRIERID) as CARRIER_NAME,
        COUNT(*) as EXCEPTION_COUNT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as PERCENTAGE,
        COUNT(DISTINCT t.PATCH_REASON_GS) as RESPONSIBILITY_TYPES,
        COUNT(DISTINCT t.patch_reason2_name) as REASON_TYPES,
        SUM(CASE WHEN t.PATCH_REASON_GS = '快递责任' THEN 1 ELSE 0 END) as CARRIER_FAULT_COUNT,
        SUM(CASE WHEN t.PATCH_REASON_GS != '快递责任' THEN 1 ELSE 0 END) as OTHER_FAULT_COUNT
      FROM APP_CMS.view_TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_COMPANY bc_carrier ON t.CARRIERID = bc_carrier.COMPANY_SYSID
      WHERE (
        (t.WMS_OUTBOUND_TIME IS NOT NULL 
         AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom 
         AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
      )
        AND t.TSK_MERGE_NO IS NOT NULL
        AND t.PATCH_REASON_GS IS NOT NULL
        AND t.PATCH_REASON_GS = '快递责任'
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CARRIERID, bc_carrier.COMPANY_ABNAME
      ORDER BY EXCEPTION_COUNT DESC
    `;
    
    console.log('📊 [Exception-Analysis] 执行快递商分组查询...');
    const byCarrierResult = await connection.execute(byCarrierSQL, queryParams, {
      outFormat: oracledb.OUT_FORMAT_OBJECT // 🔥 显式指定输出格式为对象
    });
    
    // ==================== 查询4: 按异常原因分组 ====================
    const byReasonSQL = `
      SELECT 
        NVL(t.patch_reason2_name, '未分类') as REASON_NAME,
        NVL(t.PATCH_REASON_GS, '未分类') as RESPONSIBILITY,
        COUNT(*) as EXCEPTION_COUNT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as PERCENTAGE,
        COUNT(DISTINCT t.CARRIERID) as AFFECTED_CARRIERS
      FROM APP_CMS.view_TSK_LIST_TASK t
      WHERE (
        (t.WMS_OUTBOUND_TIME IS NOT NULL 
         AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom 
         AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
      )
        AND t.TSK_MERGE_NO IS NOT NULL
        AND t.PATCH_REASON_GS IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.patch_reason2_name, t.PATCH_REASON_GS
      ORDER BY EXCEPTION_COUNT DESC
      FETCH FIRST 20 ROWS ONLY
    `;
    
    console.log('📊 [Exception-Analysis] 执行异常原因分组查询...');
    const byReasonResult = await connection.execute(byReasonSQL, queryParams, {
      outFormat: oracledb.OUT_FORMAT_OBJECT // 🔥 显式指定输出格式为对象
    });
    
    // ==================== 查询5: 快递商×责任方×异常原因交叉分析 ====================
    const crossAnalysisSQL = `
      SELECT 
        t.CARRIERID as CARRIER_ID,
        NVL(bc_carrier.COMPANY_ABNAME, t.CARRIERID) as CARRIER_NAME,
        NVL(t.PATCH_REASON_GS, '未分类') as RESPONSIBILITY,
        NVL(t.patch_reason2_name, '未分类') as REASON_NAME,
        COUNT(*) as EXCEPTION_COUNT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(PARTITION BY t.CARRIERID), 2) as CARRIER_PERCENTAGE
      FROM APP_CMS.view_TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_COMPANY bc_carrier ON t.CARRIERID = bc_carrier.COMPANY_SYSID
      WHERE (
        (t.WMS_OUTBOUND_TIME IS NOT NULL 
         AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom 
         AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
      )
        AND t.TSK_MERGE_NO IS NOT NULL
        AND t.PATCH_REASON_GS IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.CARRIERID, bc_carrier.COMPANY_ABNAME, t.PATCH_REASON_GS, t.patch_reason2_name
      ORDER BY CARRIER_NAME, EXCEPTION_COUNT DESC
      FETCH FIRST 100 ROWS ONLY
    `;
    
    console.log('📊 [Exception-Analysis] 执行交叉分析查询...');
    const crossAnalysisResult = await connection.execute(crossAnalysisSQL, queryParams, {
      outFormat: oracledb.OUT_FORMAT_OBJECT // 🔥 显式指定输出格式为对象
    });
    
    // 🔧 数据转换：Oracle行对象 -> JavaScript对象
    const formatRows = (result) => {
      if (!result || !result.rows || result.rows.length === 0) {
        return [];
      }
      
      // 🔥 由于已经使用 OUT_FORMAT_OBJECT，数据已经是对象格式
      // 只需要转换字段名为驼峰格式
      return result.rows.map(row => {
        const formattedRow = {};
        Object.keys(row).forEach(key => {
          // 转换为驼峰命名
          const camelKey = key.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          formattedRow[camelKey] = row[key];
        });
        return formattedRow;
      });
    };
    
    // 🔧 格式化总览数据
    const formattedSummary = {
      totalExceptions: summary.TOTAL_EXCEPTIONS || 0,
      totalCarriers: summary.TOTAL_CARRIERS || 0,
      totalResponsibilityTypes: summary.TOTAL_RESPONSIBILITY_TYPES || 0,
      totalReasonTypes: summary.TOTAL_REASON_TYPES || 0,
      carrierResponsibilityCount: summary.CARRIER_RESPONSIBILITY_COUNT || 0,
      otherResponsibilityCount: summary.OTHER_RESPONSIBILITY_COUNT || 0,
      carrierResponsibilityPercentage: summary.TOTAL_EXCEPTIONS > 0 
        ? Math.round((summary.CARRIER_RESPONSIBILITY_COUNT / summary.TOTAL_EXCEPTIONS) * 100 * 100) / 100
        : 0,
      otherResponsibilityPercentage: summary.TOTAL_EXCEPTIONS > 0 
        ? Math.round((summary.OTHER_RESPONSIBILITY_COUNT / summary.TOTAL_EXCEPTIONS) * 100 * 100) / 100
        : 0
    };
    
    // 📦 返回结果
    const responseData = {
      success: true,
      data: {
        summary: formattedSummary,
        byResponsibility: formatRows(byResponsibilityResult),
        byCarrier: formatRows(byCarrierResult),
        byReason: formatRows(byReasonResult),
        crossAnalysis: formatRows(crossAnalysisResult)
      },
      filters: {
        dateFrom,
        dateTo,
        brand: brand || 'all',
        platform: platform || 'all',
        selfFlag: selfFlag || 'all'
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ [Exception-Analysis] 异常监控分析完成:', {
      总异常数: formattedSummary.totalExceptions,
      责任方分组数: responseData.data.byResponsibility.length,
      快递商分组数: responseData.data.byCarrier.length,
      异常原因分组数: responseData.data.byReason.length,
      交叉分析记录数: responseData.data.crossAnalysis.length
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ [Exception-Analysis] 查询异常:', error);

    return sendRouteError(res, req, error, { fallbackError: '异常监控分析查询失败' });
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('🔒 [Exception-Analysis] 数据库连接已关闭');
      } catch (closeError) {
        console.error('❌ [Exception-Analysis] 关闭数据库连接时出错:', closeError);
      }
    }
  }
});

/**
 * 🎯 快递商异常详情
 * GET /api/exception-analysis/carrier/:carrierName
 * 
 * 获取特定快递商的异常详情，包括责任方分布和异常原因详情
 */
router.get('/carrier/:carrierName', async (req, res) => {
  let connection;
  
  try {
    const { carrierName } = req.params;
    const { dateFrom, dateTo, brand, platform, selfFlag } = req.query;
    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
    
    console.log("🔄 [Exception-Analysis] 查询快递商异常详情:", carrierName, { 
      dateFrom, dateTo, brand, platform 
    });
    
    // 🔒 参数验证
    if (!dateFrom || !dateTo) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '缺少必需的日期参数',
        details: { requiredFields: ['dateFrom', 'dateTo'] }
      });
    }
    
    // 🔌 获取数据库连接
    connection = await getConnection();
    
    // 🔧 构建查询参数
    const queryParams = {
      dateFrom,
      dateTo,
      carrierName
    };
    const brandMapping = await getBrandMapping();
    
    const brandFilter = buildScopedBrandFilter({
      queryParams,
      requestedBrands: brand,
      authorizedCustomerNos,
      brandMapping,
      fieldName: 't.CUSTOMERNO',
      paramPrefix: 'brand'
    });
    
    let platformFilter = '';
    const normalize = (v) => {
      if (v == null) return undefined;
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed === '') return undefined;
        if (trimmed.includes(',')) return trimmed.split(',').map(s => s.trim()).filter(Boolean);
        return trimmed;
      }
      if (Array.isArray(v)) return v.map(i => String(i).trim()).filter(Boolean);
      return undefined;
    };

    const normalizedPlatform = normalize(platform);
    if (normalizedPlatform && normalizedPlatform !== 'all') {
      const PLATFORM_MAPPING = {
        'tmall': '天猫',
        'douyin': '抖音',
        'jd': '京东',
        'pdd': '拼多多',
        'official': '官网/小程序',
        'o2o': 'O2O',
        'xiaohongshu': '小红书',
        'wechat': '微信'
      };

      const requested = Array.isArray(normalizedPlatform) ? normalizedPlatform : [normalizedPlatform];
      const expanded = Array.from(new Set(
        requested
          .map((item) => {
            const token = String(item || '').trim();
            return [token, PLATFORM_MAPPING[token.toLowerCase()] || token];
          })
          .flat()
          .map((item) => String(item || '').trim().replace(/／/g, '/'))
          .filter(Boolean)
      ));

      const placeholders = expanded.map((_, i) => `:platform_${i}`).join(', ');
      platformFilter = ` AND REPLACE(TRIM(t.PLATFORM_CLASS), '／', '/') IN (${placeholders})`;
      expanded.forEach((val, i) => { queryParams[`platform_${i}`] = val; });
    }
    
    let selfFlagFilter = '';
    if (selfFlag && (selfFlag === 'Y' || selfFlag === 'N')) {
      selfFlagFilter = ` AND t.SELF_FLAG = :selfFlag`;
      queryParams.selfFlag = selfFlag;
    }
    
    // 查询SQL
    const detailSQL = `
      SELECT 
        NVL(t.PATCH_REASON_GS, '未分类') as RESPONSIBILITY,
        NVL(t.patch_reason2_name, '未分类') as REASON_NAME,
        COUNT(*) as EXCEPTION_COUNT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as PERCENTAGE
      FROM APP_CMS.view_TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_COMPANY bc_carrier ON t.CARRIERID = bc_carrier.COMPANY_SYSID
      WHERE (
        (t.WMS_OUTBOUND_TIME IS NOT NULL 
         AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') >= :dateFrom 
         AND to_char(t.WMS_OUTBOUND_TIME,'yyyy-mm-dd') <= :dateTo)
      )
        AND t.TSK_MERGE_NO IS NOT NULL
        AND (t.CARRIERID = :carrierName OR bc_carrier.COMPANY_ABNAME = :carrierName)
        AND t.PATCH_REASON_GS IS NOT NULL
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
      GROUP BY t.PATCH_REASON_GS, t.patch_reason2_name
      ORDER BY EXCEPTION_COUNT DESC
    `;
    
    console.log('📊 [Exception-Analysis] 执行快递商异常详情查询...');
    const result = await connection.execute(detailSQL, queryParams, {
      outFormat: oracledb.OUT_FORMAT_OBJECT
    });
    
    // 🔧 数据转换
    const details = result.rows.map(row => ({
      responsibility: row.RESPONSIBILITY,
      reasonName: row.REASON_NAME,
      exceptionCount: row.EXCEPTION_COUNT,
      percentage: row.PERCENTAGE
    }));
    
    console.log('✅ [Exception-Analysis] %s 异常详情查询完成:', carrierName, {
      异常记录数: details.length
    });
    
    res.json({
      success: true,
      data: {
        carrierName,
        details
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [Exception-Analysis] 快递商异常详情查询失败:', error);

    return sendRouteError(res, req, error, { fallbackError: '快递商异常详情查询失败' });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('❌ 关闭数据库连接时出错:', closeError);
      }
    }
  }
});

module.exports = router;