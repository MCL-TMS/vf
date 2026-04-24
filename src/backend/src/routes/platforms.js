/**
 * 平台相关API路由 (CommonJS版本)
 * 提供平台映射关系（平台代码 <-> 平台名称）
 */

const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database-api');

/**
 * GET /api/platform/mappings
 * 获取平台代码和平台名称的映射关系
 * 从 APP_CMS.VIEW_TSK_LIST_TASK 查询 PLATFORM_CLASS 唯一值
 * 支持可选的日期范围和自管标识筛选
 */
router.get('/mappings', async (req, res) => {
  console.log('\n📋 平台映射查询请求');
  
  const { startDate, endDate, selfFlag, brand } = req.query;
  console.log('📊 筛选条件:', { startDate, endDate, selfFlag, brand });
  
  try {
    let whereConditions = [];
    let bindParams = {};

    whereConditions.push("PLATFORM_CLASS IS NOT NULL");
    whereConditions.push("PLATFORM_CLASS <> ' '");

    // 日期范围处理（可选）
    if (startDate) {
      whereConditions.push("WMS_OUTBOUND_TIME >= TO_DATE(:startDate, 'YYYY-MM-DD HH24:MI:SS')");
      bindParams.startDate = `${startDate} 00:00:00`;
    }
    if (endDate) {
      whereConditions.push("WMS_OUTBOUND_TIME <= TO_DATE(:endDate, 'YYYY-MM-DD HH24:MI:SS')");
      bindParams.endDate = `${endDate} 23:59:59`;
    }

    // 自管筛选处理（可选）
    if (selfFlag && selfFlag !== 'all') {
      whereConditions.push("SELF_FLAG = :selfFlag");
      bindParams.selfFlag = selfFlag;
    }

    // 品牌限制（可选）
    if (brand && brand !== 'all') {
        const brandArray = Array.isArray(brand) ? brand : brand.split(',').map(b => b.trim()).filter(Boolean);
      if (brandArray.length > 0) {
        const placeholders = brandArray.map((_, i) => `:brand${i}`).join(', ');
        whereConditions.push(`COMPANY_NAME IN (SELECT COMPANY_ABNAME FROM APP_CMS.BAS_COMPANY WHERE COMPANY_SYSID IN (${placeholders}))`);
        brandArray.forEach((b, i) => {
          bindParams[`brand${i}`] = b;
        });
      }
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';

    // 使用 CTE 和 EXISTS 断路查询来避免全表/全视图扫描，极大提升页面筛选下拉加载速度
    const P_CTE = `
      WITH P AS (
        SELECT '天猫' AS P_CLASS FROM DUAL UNION ALL
        SELECT '抖音' AS P_CLASS FROM DUAL UNION ALL
        SELECT '京东' AS P_CLASS FROM DUAL UNION ALL
        SELECT '拼多多' AS P_CLASS FROM DUAL UNION ALL
        SELECT '官网/小程序' AS P_CLASS FROM DUAL UNION ALL
        SELECT 'O2O' AS P_CLASS FROM DUAL UNION ALL
        SELECT '小红书' AS P_CLASS FROM DUAL UNION ALL
        SELECT '微信' AS P_CLASS FROM DUAL
      )
    `;

    const extraAnd = whereConditions.length > 0 ? ' AND ' : ' WHERE ';

    const query = `
      ${P_CTE}
      SELECT 
        P.P_CLASS AS platformName
      FROM P
      WHERE EXISTS (
        SELECT 1 
        FROM APP_CMS.VIEW_TSK_LIST_TASK
        ${whereClause} ${extraAnd} PLATFORM_CLASS = P.P_CLASS
      )
      ORDER BY P.P_CLASS
    `;

    console.log('📊 执行SQL查询:', { query: query.replace(/\n\s+/g, ' ').substring(0, 200) + '...', bindParams });

    const result = await executeQuery(query, bindParams);
    const rows = Array.isArray(result.rows) ? result.rows : [];

    const platformMapping = rows.map((row) => {
      const value = row.PLATFORMNAME || row.platformName || row.PLATFORM_CLASS || row.platform_class || row[0];
      return {
        platformCode: value,
        platformName: value,
        displayName: value
      };
    });


    console.log('✅ 返回 ' + platformMapping.length + ' 个有订单的平台:', platformMapping.slice(0, 5).map(p => `${p.platformName}`).join(", "));

    res.json({
      success: true,
      data: platformMapping,
      count: platformMapping.length
    });

  } catch (error) {
    console.error('❌ 可用平台查询失败:', error);
    res.status(500).json({
      success: false,
      error: '查询可用平台失败',
      message: error.message
    });
  }
});


// 独立实现 /available 路由，逻辑与 /mappings 完全一致，避免 req.url hack
router.get('/available', async (req, res) => {
  console.log('\n📋 平台可用列表查询请求');
  const { startDate, endDate, selfFlag, brand } = req.query;
  console.log('📊 筛选条件:', { startDate, endDate, selfFlag, brand });
  try {
    let whereConditions = [];
    let bindParams = {};

    whereConditions.push("PLATFORM_CLASS IS NOT NULL");
    whereConditions.push("PLATFORM_CLASS <> ' '");

    if (startDate) {
      whereConditions.push("WMS_OUTBOUND_TIME >= TO_DATE(:startDate, 'YYYY-MM-DD HH24:MI:SS')");
      bindParams.startDate = `${startDate} 00:00:00`;
    }
    if (endDate) {
      whereConditions.push("WMS_OUTBOUND_TIME <= TO_DATE(:endDate, 'YYYY-MM-DD HH24:MI:SS')");
      bindParams.endDate = `${endDate} 23:59:59`;
    }
    if (selfFlag && selfFlag !== 'all') {
      whereConditions.push("SELF_FLAG = :selfFlag");
      bindParams.selfFlag = selfFlag;
    }
    if (brand && brand !== 'all') {
      const brandArray = Array.isArray(brand) ? brand : brand.split(',').map(b => b.trim()).filter(Boolean);
      if (brandArray.length > 0) {
        const placeholders = brandArray.map((_, i) => `:brand${i}`).join(', ');
        whereConditions.push(`COMPANY_NAME IN (SELECT COMPANY_ABNAME FROM APP_CMS.BAS_COMPANY WHERE COMPANY_SYSID IN (${placeholders}))`);
        brandArray.forEach((b, i) => {
          bindParams[`brand${i}`] = b;
        });
      }
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';

    const P_CTE = `
      WITH P AS (
        SELECT '天猫' AS P_CLASS FROM DUAL UNION ALL
        SELECT '抖音' AS P_CLASS FROM DUAL UNION ALL
        SELECT '京东' AS P_CLASS FROM DUAL UNION ALL
        SELECT '拼多多' AS P_CLASS FROM DUAL UNION ALL
        SELECT '官网/小程序' AS P_CLASS FROM DUAL UNION ALL
        SELECT 'O2O' AS P_CLASS FROM DUAL UNION ALL
        SELECT '小红书' AS P_CLASS FROM DUAL UNION ALL
        SELECT '微信' AS P_CLASS FROM DUAL
      )
    `;

    const extraAnd = whereConditions.length > 0 ? ' AND ' : ' WHERE ';

    const query = `
      ${P_CTE}
      SELECT 
        P.P_CLASS AS platformName
      FROM P
      WHERE EXISTS (
        SELECT 1 
        FROM APP_CMS.VIEW_TSK_LIST_TASK
        ${whereClause} ${extraAnd} PLATFORM_CLASS = P.P_CLASS
      )
      ORDER BY P.P_CLASS
    `;

    console.log('📊 执行SQL查询:', { query: query.replace(/\n\s+/g, ' ').substring(0, 200) + '...', bindParams });

    const result = await executeQuery(query, bindParams);
    const rows = Array.isArray(result.rows) ? result.rows : [];

    const platformMapping = rows.map((row) => {
      const value = row.PLATFORMNAME || row.platformName || row.PLATFORM_CLASS || row.platform_class || row[0];
      return {
        platformCode: value,
        platformName: value,
        displayName: value
      };
    });

    console.log('✅ 返回 ' + platformMapping.length + ' 个有订单的平台:', platformMapping.slice(0, 5).map(p => `${p.platformName}`).join(", "));

    res.json({
      success: true,
      data: platformMapping,
      count: platformMapping.length
    });

  } catch (error) {
    console.error('❌ 可用平台查询失败:', error);
    res.status(500).json({
      success: false,
      error: '查询可用平台失败',
      message: error.message
    });
  }
});

module.exports = router;