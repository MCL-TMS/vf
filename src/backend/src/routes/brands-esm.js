/**
 * 品牌相关API路由 (ES6模块版本)
 * 提供品牌映射关系（CUSTOMERNO <-> 品牌名称）
 */

import express from 'express';
import { getConnection } from '../config/database.js';

const router = express.Router();

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
    connection = await getConnection();
    console.log('✅ 数据库连接成功');

    // 查询品牌映射关系
    // COMPANY_SYSID = CUSTOMERNO (如 '18405', '18405-1', '18405-2')
    // COMPANY_ABNAME = 品牌名称 (如 'Dickies', 'TNF', 'Icebreaker')
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
  
  const { userBrands } = req.query; // 🔥 用户权限品牌代码，逗号分隔或数组
  
  let connection;
  
  try {
    connection = await getConnection();
    
    let query;
    let bindParams = {};
    
    // 🔥 解析 userBrands 参数
    const brandArray = userBrands 
      ? (Array.isArray(userBrands) ? userBrands : userBrands.split(',').map(b => b.trim()).filter(Boolean))
      : [];
    
    console.log('📊 用户品牌权限:', { userBrands, brandArray });
    
    if (brandArray.length > 0 && !brandArray.includes('all') && !brandArray.includes('ALL')) {
      // 🔥 普通用户 - 只查询有权限的品牌
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
      
      // 构建绑定参数
      brandArray.forEach((brand, i) => {
        bindParams[`brand${i}`] = brand;
      });
      
      console.log(`✅ 普通用户模式 - 查询品牌: ${brandArray.join(', ')}`);
      
    } else {
      // 🔥 管理员或无权限信息 - 查询所有品牌
      query = `
        SELECT 
          COMPANY_SYSID as brandCode,
          COMPANY_ABNAME as brandName,
          COMPANY_FNAME as fullName
        FROM APP_CMS.BAS_COMPANY
        WHERE COMPANY_SYSID IS NOT NULL
        ORDER BY COMPANY_SYSID
      `;
      
      console.log('✅ 管理员模式 - 查询所有品牌');
    }

    console.log('📊 执行SQL查询:', { bindParams });

    const result = await connection.execute(query, bindParams);
    
    const brandList = result.rows.map(row => ({
      brandCode: row[0],
      brandName: row[1],
      fullName: row[2] || ''
    }));

    console.log(`✅ 返回 ${brandList.length} 个品牌:`, brandList.map(b => `${b.brandCode}(${b.brandName})`).join(', '));

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

/**
 * GET /api/brands/available
 * 根据订单数据动态获取管理员可用的品牌列表
 * 支持按时间范围和自管标识筛选，返回实际有订单的品牌
 */
router.get('/available', async (req, res) => {
  console.log('\n📋 动态可用品牌查询请求');
  
  const { startDate, endDate, selfFlag = 'Y' } = req.query;
  console.log('📊 筛选条件:', { startDate, endDate, selfFlag });
  
  let connection;
  try {
    connection = await getConnection();
    
    let whereConditions = [];
    let bindParams = {};

    // 日期范围处理（只看发货时间）
    if (startDate) {
      whereConditions.push("t.WMS_OUTBOUND_TIME >= TO_DATE(:startDate, 'YYYY-MM-DD HH24:MI:SS')");
      bindParams.startDate = `${startDate} 00:00:00`;
    }
    if (endDate) {
      whereConditions.push("t.WMS_OUTBOUND_TIME <= TO_DATE(:endDate, 'YYYY-MM-DD HH24:MI:SS')");
      bindParams.endDate = `${endDate} 23:59:59`;
    }

    // 自管筛选处理
    if (selfFlag && selfFlag !== 'all') {
      whereConditions.push("t.SELF_FLAG = :selfFlag");
      bindParams.selfFlag = selfFlag;
    }

    // 组合 WHERE 子句
    const subqueryWhere = whereConditions.length > 0
      ? ' AND ' + whereConditions.join(' AND ')
      : '';

    // 使用 EXISTS 替代 GROUP BY + COUNT 极大提升查询性能
    const query = `
      SELECT 
        b.COMPANY_SYSID as brandCode,
        b.COMPANY_ABNAME as brandName,
        0 as orderCount
      FROM APP_CMS.BAS_COMPANY b
      WHERE EXISTS (
        SELECT 1 
        FROM APP_CMS.VIEW_TSK_LIST_TASK t 
        WHERE t.COMPANY_NAME = b.COMPANY_ABNAME
        ${subqueryWhere}
      )

    console.log('📊 执行SQL查询:', { query: query.replace(/\n\s+/g, ' ').substring(0, 200) + '...', bindParams });

    const result = await connection.execute(query, bindParams);
    
    const brandList = result.rows.map(row => ({
      brandCode: row[0],
      brandName: row[1],
      orderCount: row[2] || 0
    }));

    console.log(`✅ 返回 ${brandList.length} 个有订单的品牌 (最多显示5个日志):`, 
      brandList.slice(0, 5).map(b => `${b.brandName}(${b.orderCount}单)`).join(', '));

    res.json({
      success: true,
      data: brandList,
      count: brandList.length
    });

  } catch (error) {
    console.error('❌ 可用品牌查询失败:', error);
    res.status(500).json({
      success: false,
      error: '查询可用品牌失败',
      message: error.message
    });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

export default router;