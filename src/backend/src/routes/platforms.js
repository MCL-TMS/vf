/**
 * 平台相关API路由 (CommonJS版本)
 * 提供平台映射关系（平台代码 <-> 平台名称）
 */

const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database-api');

function normalizeBrandArray(brand) {
  if (!brand || brand === 'all') {
    return [];
  }

  if (Array.isArray(brand)) {
    return brand.map((item) => String(item || '').trim()).filter(Boolean);
  }

  return String(brand)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPlatformFilters(queryParams) {
  const { startDate, endDate, selfFlag, brand } = queryParams;
  const whereConditions = [
    'PLATFORM_CLASS IS NOT NULL'
  ];
  const bindParams = {};

  if (startDate) {
    whereConditions.push("WMS_OUTBOUND_TIME >= TO_DATE(:startDate, 'YYYY-MM-DD HH24:MI:SS')");
    bindParams.startDate = `${startDate} 00:00:00`;
  }

  if (endDate) {
    whereConditions.push("WMS_OUTBOUND_TIME <= TO_DATE(:endDate, 'YYYY-MM-DD HH24:MI:SS')");
    bindParams.endDate = `${endDate} 23:59:59`;
  }

  if (selfFlag && selfFlag !== 'all') {
    whereConditions.push('SELF_FLAG = :selfFlag');
    bindParams.selfFlag = selfFlag;
  }

  const brandArray = normalizeBrandArray(brand);
  if (brandArray.length > 0) {
    const placeholders = brandArray.map((_, i) => `:brand${i}`).join(', ');
    // 品牌筛选直接使用 VIEW_TSK_LIST_TASK 的 CUSTOMERNO，避免额外表关联。
    whereConditions.push(`CUSTOMERNO IN (${placeholders})`);
    brandArray.forEach((brandCode, i) => {
      bindParams[`brand${i}`] = brandCode;
    });
  }

  return { whereConditions, bindParams };
}

function mapPlatformRows(rows) {
  return rows
    .map((row) => {
      // 兼容对象格式和数组格式，处理Oracle键名大写问题
      if (!row) return null;
      if (Array.isArray(row)) return row[0];
      
      // 优先从 platformName 属性获取（因为 SQL 中使用了别名 "platformName"）
      const name = row.platformName || row.PLATFORMNAME || row.PLATFORM_CLASS || row.PLATFORM_NAME || 
                   row.PLATFORM_CODE || row.PLATFORMCODE || Object.values(row)[0];
      
      // 优先从 platformCode 属性获取
      const code = row.platformCode || row.PLATFORMCODE || row.platform_code || row.PLATFORM_CODE || name;
      
      return { name, code };
    })
    .filter(item => item && item.name)
    .map((item) => {
      const value = String(item.name || '').trim();
      const code = String(item.code || value).trim();
      return {
        platformCode: code,
        platformName: value,
        displayName: value
      };
    })
    .filter(p => p.platformCode);
}

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
    const { whereConditions, bindParams } = buildPlatformFilters({ startDate, endDate, selfFlag, brand });

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';

    // 使用引号包裹别名以保持大小写，或者在 mapPlatformRows 中处理
    const query = `
      SELECT DISTINCT TRIM(PLATFORM_CLASS) AS "platformName",
                      TRIM(PLATFORM_CLASS) AS "platformCode"
      FROM APP_CMS.VIEW_TSK_LIST_TASK
      ${whereClause}
      ORDER BY "platformName"
    `;

    console.log('📊 执行SQL查询:', { query: query.replace(/\n\s+/g, ' ').substring(0, 200) + '...', bindParams });

    const result = await executeQuery(query, bindParams);

    console.log('🔍 /mappings 数据库原始结果:', {
      hasResult: !!result,
      rowsLength: result && Array.isArray(result.rows) ? result.rows.length : 'N/A',
      metaData: result ? result.metaData : 'none',
      firstRowLine: result && result.rows && result.rows.length > 0 ? JSON.stringify(result.rows[0]) : 'empty'
    });

    const rows = Array.isArray(result.rows) ? result.rows : [];

    const platformMapping = mapPlatformRows(rows);


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
    const { whereConditions, bindParams } = buildPlatformFilters({ startDate, endDate, selfFlag, brand });

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';

    const query = `
      SELECT DISTINCT TRIM(PLATFORM_CLASS) AS "platformName"
      FROM APP_CMS.VIEW_TSK_LIST_TASK
      ${whereClause}
      ORDER BY "platformName"
    `;

    console.log('📊 执行SQL查询:', { query: query.replace(/\n\s+/g, ' ').substring(0, 200) + '...', bindParams });

    const result = await executeQuery(query, bindParams);
    const rows = Array.isArray(result.rows) ? result.rows : [];

    const platformMapping = mapPlatformRows(rows);


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