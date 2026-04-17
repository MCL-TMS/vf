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
 */
router.get('/mappings', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        PLATFORM_CLASS AS platformName
      FROM APP_CMS.VIEW_TSK_LIST_TASK
      WHERE PLATFORM_CLASS IS NOT NULL
        AND PLATFORM_CLASS <> ''
      ORDER BY PLATFORM_CLASS
    `;

    const result = await executeQuery(query);
    const rows = Array.isArray(result.rows) ? result.rows : [];

    const platformMapping = rows.map((row) => {
      const value = row.PLATFORMNAME || row.platformName || row.PLATFORM_CLASS || row.platform_class || row[0];
      return {
        platformCode: value,
        platformName: value,
        displayName: value
      };
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
  }
});

/**
 * GET /api/platform/list
 * 获取平台列表（别名路由，与 /mappings 相同）
 */
router.get('/list', async (req, res) => {
  req.url = '/mappings';
  return router.handle(req, res);
});

module.exports = router;
