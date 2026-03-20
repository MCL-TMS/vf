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
      SELECT DISTINCT 
        PLATFORM_CLASS as platformName
      FROM APP_CMS.VIEW_TSK_LIST_TASK
      WHERE PLATFORM_CLASS IS NOT NULL
        AND PLATFORM_CLASS != ''
      ORDER BY PLATFORM_CLASS
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

export default router;