/**
 * 平台相关API路由 (ES6模块版本)
 * 提供平台映射关系（平台代码 <-> 平台名称）
 */

import express from 'express';
import { getConnection } from '../config/database.js';

const router = express.Router();

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
    'PLATFORM_CLASS IS NOT NULL',
    "TRIM(PLATFORM_CLASS) <> ''"
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
    whereConditions.push(`CUSTOMERNO IN (${placeholders})`);
    brandArray.forEach((brandCode, i) => {
      bindParams[`brand${i}`] = brandCode;
    });
  }

  return { whereConditions, bindParams };
}

function mapPlatformRows(rows = []) {
  return rows
    .map((row) => row.PLATFORMNAME || row.platformName || row.PLATFORM_CLASS || row.platform_class || row[0])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((value) => ({
      platformCode: value,
      platformName: value,
      displayName: value
    }));
}

/**
 * GET /api/platform/mappings
 * 获取平台代码和平台名称的映射关系
 * 从 APP_CMS.BAS_CODES 表查询 PLATFORM_CLASS 字段的唯一值
 */
router.get('/mappings', async (req, res) => {
  console.log('\n🏪 ========================================');
  console.log('📋 平台映射查询请求');
  console.log('========================================');
  
  let connection;
  
  try {
    connection = await getConnection();
    console.log('✅ 数据库连接成功');

    const { startDate, endDate, selfFlag, brand } = req.query;
    const { whereConditions, bindParams } = buildPlatformFilters({ startDate, endDate, selfFlag, brand });
    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const query = `
      SELECT DISTINCT TRIM(PLATFORM_CLASS) AS platformName
      FROM APP_CMS.VIEW_TSK_LIST_TASK
      ${whereClause}
      ORDER BY platformName
    `;

    console.log('📊 执行SQL查询...');

    const result = await connection.execute(query, bindParams);
    const platformMapping = mapPlatformRows(result.rows || []);
    console.log(`✅ 查询成功，返回 ${platformMapping.length} 个平台`);

    console.log('🏪 平台映射列表:');
    platformMapping.forEach(platform => {
      console.log(`   - ${platform.platformCode}`);
    });

    res.json({
      success: true,
      data: platformMapping,
      count: platformMapping.length
    });

  } catch (error) {
    console.error('❌ 平台映射查询失败:', error);
    res.status(500).json({
      success: false,
      error: '查询平台映射失败',
      message: error.message
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('✅ 数据库连接已关闭');
      } catch (err) {
        console.error('⚠️  关闭数据库连接时出错:', err);
      }
    }
    console.log('========================================\n');
  }
});

/**
 * GET /api/platform/list
 * 获取平台列表（别名路由，与 /mappings 相同）
 */
router.get('/list', async (req, res) => {
  // 重定向到 /mappings 端点
  req.url = '/mappings';
  router.handle(req, res);
});

/**
 * GET /api/platform/available
 * 根据订单数据动态获取实际有订单的平台列表
 * 支持按时间范围、自管标识和品牌筛选
 */
router.get('/available', async (req, res) => {
  console.log('\n📋 动态可用平台查询请求');
  
  const { startDate, endDate, selfFlag = 'Y', brand } = req.query;
  console.log('📊 筛选条件:', { startDate, endDate, selfFlag, brand });
  
  let connection;
  try {
    connection = await getConnection();
    
    const { whereConditions, bindParams } = buildPlatformFilters({ startDate, endDate, selfFlag, brand });
    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const query = `
      SELECT DISTINCT TRIM(PLATFORM_CLASS) AS platformName
      FROM APP_CMS.VIEW_TSK_LIST_TASK
      ${whereClause}
      ORDER BY platformName
    `;

    const result = await connection.execute(query, bindParams);
    const platformList = mapPlatformRows(result.rows || []).map((item) => ({
      ...item,
      orderCount: 0
    }));

    console.log(`✅ 返回 ${platformList.length} 个有订单的平台:`, 
      platformList.slice(0, 5).map(p => `${p.platformName}(${p.orderCount}单)`).join(', '));

    res.json({
      success: true,
      data: platformList,
      count: platformList.length
    });

  } catch (error) {
    console.error('❌ 可用平台查询失败:', error);
    res.status(500).json({
      success: false,
      error: '查询可用平台失败',
      message: error.message
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

export default router;