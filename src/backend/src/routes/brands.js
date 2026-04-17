/**
 * 品牌相关API路由
 * 提供品牌映射关系（CUSTOMERNO <-> 品牌名称）
 */

const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database-api');
const { ERROR_CODES, sendError } = require('../utils/apiError');
const { getAuthorizedCustomerNos, normalizeBrandValues } = require('../utils/brandScope');

function toBrandItem(row) {
  const brandCode = row.BRANDCODE || row.brandCode || row.COMPANY_SYSID || row.company_sysid || row[0];
  const brandName = row.BRANDNAME || row.brandName || row.COMPANY_ABNAME || row.company_abname || row[1] || brandCode;
  return {
    brandCode,
    brandName,
    fullName: brandName
  };
}

/**
 * GET /api/brands/mapping
 * 获取品牌代码和品牌名称的映射关系
 * 从 APP_CMS.BAS_COMPANY 表查询
 */
router.get('/mapping', async (req, res) => {
  console.log('\n🏷️  ========================================');
  console.log('📋 品牌映射查询请求');
  console.log('========================================');
  
  try {
    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);

    if (Array.isArray(authorizedCustomerNos) && authorizedCustomerNos.length === 0) {
      return sendError(res, req, {
        status: 403,
        code: ERROR_CODES.EMPTY_BRAND_SCOPE,
        error: '当前账号未配置可访问品牌'
      });
    }

    let whereClause = '';
    const params = {};

    if (Array.isArray(authorizedCustomerNos)) {
      authorizedCustomerNos.forEach((customerNo, index) => {
        params[`brand${index}`] = customerNo;
      });
      const placeholders = authorizedCustomerNos.map((_, index) => `:brand${index}`).join(', ');
      whereClause = `WHERE COMPANY_SYSID IN (${placeholders})`;
    }

    // 查询品牌映射关系
    // company_sysid = CUSTOMERNO (如 '18405', '18405-1', '18405-2')
    // company_abname = 品牌名称 (如 'Dickies', 'TNF', 'Icebreaker')
    const query = `
      SELECT 
        COMPANY_SYSID as brandCode,
        COMPANY_ABNAME as brandName
      FROM APP_CMS.BAS_COMPANY
      ${whereClause}
      ORDER BY COMPANY_SYSID
    `;

    console.log('📊 执行SQL查询...');
    console.log('查询语句:', query);

    const result = await executeQuery(query, params);
    console.log(`✅ 查询成功，返回 ${result.rows.length} 条品牌记录`);

    // 转换为前端友好的格式
    const brandMapping = (result.rows || []).map(toBrandItem);

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
  
  const { userBrands } = req.query;
  
  try {
    const authorizedCustomerNos = getAuthorizedCustomerNos(req.user);
    const requestedBrands = normalizeBrandValues(userBrands);

    if (Array.isArray(authorizedCustomerNos) && authorizedCustomerNos.length === 0) {
      return sendError(res, req, {
        status: 403,
        code: ERROR_CODES.EMPTY_BRAND_SCOPE,
        error: '当前账号未配置可访问品牌'
      });
    }

    let effectiveBrands = requestedBrands;
    if (Array.isArray(authorizedCustomerNos)) {
      if (requestedBrands) {
        const unauthorizedBrands = requestedBrands.filter((brandCode) => !authorizedCustomerNos.includes(brandCode));
        if (unauthorizedBrands.length > 0) {
          return sendError(res, req, {
            status: 403,
            code: ERROR_CODES.BRAND_SCOPE_FORBIDDEN,
            error: '请求的品牌超出当前账号权限范围',
            details: { unauthorizedBrands }
          });
        }
      }

      effectiveBrands = requestedBrands || authorizedCustomerNos;
    }

    let query = `
      SELECT 
        COMPANY_SYSID as brandCode,
        COMPANY_ABNAME as brandName
      FROM APP_CMS.BAS_COMPANY
    `;
    const params = {};

    if (effectiveBrands && effectiveBrands.length > 0) {
      const placeholders = effectiveBrands.map((_, i) => `:brand${i}`).join(', ');
      query += ` WHERE COMPANY_SYSID IN (${placeholders})`;
      effectiveBrands.forEach((brandCode, i) => {
        params[`brand${i}`] = brandCode;
      });
    }

    query += ' ORDER BY COMPANY_SYSID';

    console.log('📊 执行SQL查询:', { userBrands, authorizedCustomerNos, effectiveBrands, params });

    const result = await executeQuery(query, params);
    
    const brandList = (result.rows || []).map(toBrandItem);

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
    // executeQuery 内部已自动管理连接释放
  }
});

module.exports = router;
