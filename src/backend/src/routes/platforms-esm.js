/**
 * 平台相关API路由 (ES6模块版本)
 * 提供平台映射关系（平台代码 <-> 平台名称）
 */

import express from 'express';
import { getConnection } from '../config/database.js';

const router = express.Router();

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

    // 🔥 修复：移除硬编码的品牌列表
    // 查询平台映射关系
    // 从视图中查询所有不同的平台名称（PLATFORM_CLASS已经是最终的平台名称）
    const query = `
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
SELECT P.P_CLASS as platformName
FROM P
WHERE EXISTS (
  SELECT 1 FROM APP_CMS.VIEW_TSK_LIST_TASK
  WHERE PLATFORM_CLASS = P.P_CLASS
)
    `;

    console.log('📊 执行SQL查询...');

    const result = await connection.execute(query);
    console.log(`✅ 查询成功，返回 ${result.rows.length} 个平台`);

    // 转换为前端友好的格式
    // platformCode 和 platformName 都使用 PLATFORM_CLASS 的值
    const platformMapping = result.rows.map(row => ({
      platformCode: row[0],   // PLATFORM_CLASS
      platformName: row[0],   // PLATFORM_CLASS
      displayName: row[0]     // PLATFORM_CLASS
    }));

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
    
    let whereConditions = [];
    let bindParams = {};

    whereConditions.push("PLATFORM_CLASS IS NOT NULL");
    whereConditions.push("PLATFORM_CLASS <> ''");

    // 日期范围处理（以出库时间为准）
    if (startDate) {
      whereConditions.push("WMS_OUTBOUND_TIME >= TO_DATE(:startDate, 'YYYY-MM-DD HH24:MI:SS')");
      bindParams.startDate = `${startDate} 00:00:00`;
    }
    if (endDate) {
      whereConditions.push("WMS_OUTBOUND_TIME <= TO_DATE(:endDate, 'YYYY-MM-DD HH24:MI:SS')");
      bindParams.endDate = `${endDate} 23:59:59`;
    }

    // 自管筛选处理
    if (selfFlag && selfFlag !== 'all') {
      whereConditions.push("SELF_FLAG = :selfFlag");
      bindParams.selfFlag = selfFlag;
    }

    // 品牌限制
    if (brand && brand !== 'all') {
      const brandArray = brand.split(',').map(b => b.trim()).filter(Boolean);
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

    const query = `
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
SELECT P.P_CLASS as platformName, 0 as orderCount
FROM P
WHERE EXISTS (
  SELECT 1 FROM APP_CMS.VIEW_TSK_LIST_TASK
  ${whereClause} ${whereConditions.length > 0 ? 'AND' : 'WHERE'} PLATFORM_CLASS = P.P_CLASS
)

    const result = await connection.execute(query, bindParams);
    
    const platformList = (result.rows || []).map(row => {
        const code = row.PLATFORMCODE || row.platformCode || row.PLATFORMNAME || row.platformName || row.PLATFORM_CLASS || row.platform_class || row[0];
        const count = row.ORDERCOUNT || row.orderCount || row[1] || 0;
        platformCode: code,
        platformName: code,
        displayName: code,
        orderCount: count
      };
    });

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