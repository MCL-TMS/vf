/**
 * BAS_AREA表数据诊断工具
 * 
 * 用于检查和诊断BAS_AREA表的数据情况
 */

const express = require('express');
const router = express.Router();

/**
 * BAS_AREA表完整诊断
 * GET /api/diagnostic/bas-area
 */
router.get('/bas-area', async (req, res) => {
  try {
    const { executeQuery } = require('../config/database-api');
    
    console.log('🔍 开始BAS_AREA表完整诊断...');
    
    const diagnosticResult = {
      tableExists: false,
      totalRecords: 0,
      fieldAnalysis: {},
      sampleData: [],
      recommendations: [],
      timestamp: new Date().toISOString()
    };
    
    try {
      // 1. 检查表是否存在 - 修复：查询ALL_TABLES而不是USER_TABLES
      console.log('📋 步骤1: 检查表存在性（支持跨Schema查询）...');
      
      let tableExists = false;
      
      try {
        // 尝试多种方式检查表存在性
        const tableCheckQueries = [
          {
            name: 'ALL_TABLES',
            sql: `SELECT COUNT(*) as TABLE_COUNT FROM ALL_TABLES WHERE OWNER = 'APP_CMS' AND TABLE_NAME = 'BAS_AREA'`
          },
          {
            name: 'USER_TABLES', 
            sql: `SELECT COUNT(*) as TABLE_COUNT FROM USER_TABLES WHERE TABLE_NAME = 'BAS_AREA'`
          },
          {
            name: 'DIRECT_QUERY',
            sql: `SELECT COUNT(*) as TABLE_COUNT FROM APP_CMS.BAS_AREA WHERE ROWNUM <= 1`
          }
        ];
        
        for (const query of tableCheckQueries) {
          try {
            console.log(`🔍 尝试${query.name}查询...`);
            const result = await executeQuery(query.sql);
            const count = result.rows?.[0]?.[0] || 0;
            
            if (count > 0) {
              console.log(`✅ ${query.name}查询成功，表存在`);
              tableExists = true;
              break;
            }
          } catch (queryError) {
            console.warn(`⚠️ ${query.name}查询失败:`, queryError.message);
          }
        }
        
        diagnosticResult.tableExists = tableExists;
        
        if (!tableExists) {
          diagnosticResult.recommendations.push('无法访问APP_CMS.BAS_AREA表，可能是权限问题或表不存在');
          console.log('❌ 所有表存在性检查都失败');
        }
        
      } catch (error) {
        console.warn('⚠️ 表存在性检查失败，将直接尝试查询数据:', error.message);
        diagnosticResult.tableExists = null; // 未知状态
      }
      
      console.log('✅ BAS_AREA表存在');
      
      // 2. 获取总记录数
      console.log('📊 步骤2: 统计总记录数...');
      const countQuery = `SELECT COUNT(*) as TOTAL_COUNT FROM APP_CMS.BAS_AREA`;
      const countResult = await executeQuery(countQuery);
      const totalCount = countResult.rows?.[0]?.[0] || 0;
      diagnosticResult.totalRecords = totalCount;
      
      console.log(`📊 总记录数: ${totalCount}`);
      
      if (totalCount === 0) {
        diagnosticResult.recommendations.push('BAS_AREA表为空，请插入城市映射数据');
        return res.json({
          success: false,
          message: 'BAS_AREA表为空',
          diagnostic: diagnosticResult
        });
      }
      
      // 3. 字段分析
      console.log('🔍 步骤3: 字段数据分析...');
      
      // 检查AREA_ID字段
      const areaIdNullQuery = `
        SELECT 
          COUNT(*) as TOTAL,
          COUNT(AREA_ID) as NON_NULL_AREA_ID,
          COUNT(CASE WHEN AREA_ID IS NULL THEN 1 END) as NULL_AREA_ID,
          COUNT(CASE WHEN TRIM(TO_CHAR(AREA_ID)) = '' THEN 1 END) as EMPTY_AREA_ID
        FROM APP_CMS.BAS_AREA
      `;
      
      const areaIdResult = await executeQuery(areaIdNullQuery);
      const areaIdStats = areaIdResult.rows?.[0];
      
      diagnosticResult.fieldAnalysis.areaId = {
        total: areaIdStats?.[0] || 0,
        nonNull: areaIdStats?.[1] || 0,
        nullCount: areaIdStats?.[2] || 0,
        emptyCount: areaIdStats?.[3] || 0
      };
      
      // 检查AREA_NAME字段
      const areaNameNullQuery = `
        SELECT 
          COUNT(*) as TOTAL,
          COUNT(AREA_NAME) as NON_NULL_AREA_NAME,
          COUNT(CASE WHEN AREA_NAME IS NULL THEN 1 END) as NULL_AREA_NAME,
          COUNT(CASE WHEN TRIM(AREA_NAME) = '' THEN 1 END) as EMPTY_AREA_NAME
        FROM APP_CMS.BAS_AREA
      `;
      
      const areaNameResult = await executeQuery(areaNameNullQuery);
      const areaNameStats = areaNameResult.rows?.[0];
      
      diagnosticResult.fieldAnalysis.areaName = {
        total: areaNameStats?.[0] || 0,
        nonNull: areaNameStats?.[1] || 0,
        nullCount: areaNameStats?.[2] || 0,
        emptyCount: areaNameStats?.[3] || 0
      };
      
      // 4. 获取样本数据
      console.log('📋 步骤4: 获取样本数据...');
      const sampleQuery = `
        SELECT * FROM (
          SELECT AREA_ID, AREA_NAME, ROWNUM as RN
          FROM APP_CMS.BAS_AREA 
          ORDER BY AREA_ID
        ) WHERE RN <= 10
      `;
      
      const sampleResult = await executeQuery(sampleQuery);
      diagnosticResult.sampleData = (sampleResult.rows || []).map(row => ({
        areaId: row[0],
        areaName: row[1],
        rowNumber: row[2]
      }));
      
      // 5. 检查有效数据数量
      const validDataQuery = `
        SELECT COUNT(*) as VALID_COUNT
        FROM APP_CMS.BAS_AREA 
        WHERE AREA_ID IS NOT NULL 
          AND AREA_NAME IS NOT NULL
          AND TRIM(AREA_NAME) != ''
      `;
      
      const validDataResult = await executeQuery(validDataQuery);
      const validCount = validDataResult.rows?.[0]?.[0] || 0;
      diagnosticResult.validRecords = validCount;
      
      // 6. 生成建议
      if (diagnosticResult.fieldAnalysis.areaId.nullCount > 0) {
        diagnosticResult.recommendations.push(`发现${diagnosticResult.fieldAnalysis.areaId.nullCount}条AREA_ID为空的记录`);
      }
      
      if (diagnosticResult.fieldAnalysis.areaName.nullCount > 0) {
        diagnosticResult.recommendations.push(`发现${diagnosticResult.fieldAnalysis.areaName.nullCount}条AREA_NAME为空的记录`);
      }
      
      if (diagnosticResult.fieldAnalysis.areaName.emptyCount > 0) {
        diagnosticResult.recommendations.push(`发现${diagnosticResult.fieldAnalysis.areaName.emptyCount}条AREA_NAME为空字符串的记录`);
      }
      
      if (validCount === 0) {
        diagnosticResult.recommendations.push('没有同时具有有效AREA_ID和AREA_NAME的记录');
      } else if (validCount < totalCount) {
        diagnosticResult.recommendations.push(`${totalCount}条记录中只有${validCount}条是有效的城市映射数据`);
      }
      
      const successMessage = `BAS_AREA表诊断完成: 总计${totalCount}条记录，有效数据${validCount}条`;
      console.log('✅', successMessage);
      
      res.json({
        success: true,
        message: successMessage,
        diagnostic: diagnosticResult
      });
      
    } catch (queryError) {
      console.error('🚨 BAS_AREA表诊断查询失败:', queryError);
      
      diagnosticResult.recommendations.push(`数据库查询失败: ${queryError.message}`);
      
      res.status(500).json({
        success: false,
        message: 'BAS_AREA表诊断失败',
        diagnostic: diagnosticResult,
        error: queryError.message
      });
    }
    
  } catch (error) {
    console.error('❌ BAS_AREA表诊断工具失败:', error);
    res.status(500).json({
      success: false,
      message: 'BAS_AREA诊断工具执行失败',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 简单的BAS_AREA数据查看
 * GET /api/diagnostic/bas-area/simple
 */
router.get('/bas-area/simple', async (req, res) => {
  try {
    const { executeQuery } = require('../config/database-api');
    
    // 执行用户提供的简单查询
    const simpleQuery = `SELECT * FROM APP_CMS.BAS_AREA`;
    const result = await executeQuery(simpleQuery);
    
    res.json({
      success: true,
      message: `BAS_AREA表简单查询完成，获取${result.rows?.length || 0}条记录`,
      data: {
        totalRows: result.rows?.length || 0,
        sampleRows: (result.rows || []).slice(0, 20), // 只显示前20条
        allData: result.rows || []
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('BAS_AREA简单查询失败:', error);
    res.status(500).json({
      success: false,
      message: 'BAS_AREA简单查询失败',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;