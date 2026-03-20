/**
 * 品牌相关API路由
 * 提供品牌映射关系（CUSTOMERNO <-> 品牌名称）
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/brands/mapping
 * 获取品牌代码和品牌名称的映射关系
 * 从 APP_CMS.BAS_COMPANY 表查询
 */
router.get('/mapping', async (req, res) => {
  console.log('\n🏷️  ========================================');
  console.log('📋 品牌映射查询请求');
  console.log('========================================');
  
  let connection;
  
  try {
    connection = await pool.getConnection();
    console.log('✅ 数据库连接成功');

    // 查询品牌映射关系
    // company_sysid = CUSTOMERNO (如 '18405', '18405-1', '18405-2')
    // company_abname = 品牌名称 (如 'Dickies', 'TNF', 'Icebreaker')
    const query = `
      SELECT 
        COMPANY_SYSID as brandCode,
        COMPANY_ABNAME as brandName,
        COMPANY_FNAME as fullName
      FROM APP_CMS.BAS_COMPANY
      WHERE COMPANY_SYSID IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')
      ORDER BY COMPANY_SYSID
    `;

    console.log('📊 执行SQL查询...');
    console.log('查询语句:', query);

    const result = await connection.execute(query);
    console.log(`✅ 查询成功，返回 ${result.rows.length} 条品牌记录`);

    // 转换为前端友好的格式
    const brandMapping = result.rows.map(row => ({
      brandCode: row[0],      // COMPANY_SYSID
      brandName: row[1],      // COMPANY_ABNAME
      fullName: row[2] || ''  // COMPANY_FNAME
    }));

    console.log('🏷️  品牌映射列表:');
    brandMapping.forEach(brand => {
      console.log(`   - ${brand.brandCode} → ${brand.brandName} (${brand.fullName})`);
    });

    res.json({
      success: true,
      data: brandMapping,
      count: brandMapping.length
    });

  } catch (error) {
    console.error('❌ 品牌映射查询失败:', error);
    res.status(500).json({
      success: false,
      error: '查询品牌映射失败',
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
 * GET /api/brands/list
 * 获取用户有权限的品牌列表
 * 根据用户的 customerNo 返回对应的品牌
 */
router.get('/list', async (req, res) => {
  console.log('\n📋 品牌列表查询请求');
  
  const { userBrands } = req.query; // 用户权限品牌代码，逗号分隔
  
  let connection;
  
  try {
    connection = await pool.getConnection();
    
    let query;
    let params = [];
    
    if (userBrands && userBrands !== 'all') {
      // 用户有特定品牌权限
      const brandArray = userBrands.split(',').map(b => b.trim());
      const placeholders = brandArray.map((_, i) => `:brand${i}`).join(', ');
      
      query = `
        SELECT 
          COMPANY_SYSID as brandCode,
          COMPANY_ABNAME as brandName,
          COMPANY_FNAME as fullName
        FROM APP_CMS.BAS_COMPANY
        WHERE COMPANY_SYSID IN (${placeholders})
        ORDER BY COMPANY_SYSID
      `;
      
      params = brandArray.reduce((acc, brand, i) => {
        acc[`brand${i}`] = brand;
        return acc;
      }, {});
      
    } else {
      // 用户是管理员或查看所有品牌
      query = `
        SELECT 
          COMPANY_SYSID as brandCode,
          COMPANY_ABNAME as brandName,
          COMPANY_FNAME as fullName
        FROM APP_CMS.BAS_COMPANY
        WHERE COMPANY_SYSID IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')
        ORDER BY COMPANY_SYSID
      `;
    }

    console.log('📊 执行SQL查询:', { userBrands, params });

    const result = await connection.execute(query, params);
    
    const brandList = result.rows.map(row => ({
      brandCode: row[0],
      brandName: row[1],
      fullName: row[2] || ''
    }));

    console.log(`✅ 返回 ${brandList.length} 个品牌`);

    res.json({
      success: true,
      data: brandList,
      count: brandList.length
    });

  } catch (error) {
    console.error('❌ 品牌列表查询失败:', error);
    res.status(500).json({
      success: false,
      error: '查询品牌列表失败',
      message: error.message
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

module.exports = router;
