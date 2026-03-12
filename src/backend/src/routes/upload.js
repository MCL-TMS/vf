/**
 * VF物流数据分析平台 - 时效分析API路由
 * 
 * ✅ 时效数据已预置为JSON文件，不需要上传功能
 * ✅ 只提供时效分析计算接口
 */

import express from 'express';

const router = express.Router();

/**
 * 执行时效分析计算
 * POST /api/upload/analyze-timeliness
 */
router.post('/analyze-timeliness', async (req, res) => {
  try {
    console.log('\n\n\n');
    console.log('=' .repeat(80));
    console.log('🔥🔥🔥 ========== /api/upload/analyze-timeliness 接口被调用 (ES6 VERSION) ========== 🔥🔥🔥');
    console.log('=' .repeat(80));
    console.log('\n');
    
    const { 
      dateRange,
      selectedBrand = null,
      selectedCarrier = null,
      analysisType = 'both', // 'S2D', 'C2D', 'both'
      userBrands = null // 🔥 新增：接收用户品牌权限
    } = req.body;

    console.log('🔍 时效分析请求:', {
      dateRange,
      selectedBrand,
      selectedCarrier,
      analysisType,
      userBrands // 🔥 打印userBrands
    });

    // ✅ 导入时效分析处理函数（基于文件存储版本）
    const { analyzeTimelinessPerformance } = await import('../utils/timelinessDataProcessor-file-based.js');
    
    console.log('🔥 upload.js: 已导入 timelinessDataProcessor-file-based.js');
    console.log('🔥 upload.js: 即将调用 analyzeTimelinessPerformance');
    
    // 执行时效分析计算
    const analysisResult = await analyzeTimelinessPerformance({
      dateRange,
      selectedBrand,
      selectedCarrier,
      analysisType,
      userBrands // 🔥 新增：传递用户品牌权限
    });
    
    console.log('🔥 upload.js: analyzeTimelinessPerformance 执行完成');
    console.log('🔍 upload.js: 检查rawOrders数据:', {
      hasRawOrders: !!analysisResult.data.rawOrders,
      rawOrdersCount: analysisResult.data.rawOrders?.length || 0,
      rawOrdersSample: analysisResult.data.rawOrders?.slice(0, 2) // 打印前2条样本
    });

    // 🔥 转换数据格式为前端期望的对象格式
    const formattedResult = {
      success: true,
      data: {
        rawOrders: analysisResult.data.rawOrders || [],  // 🔥 新增：原始订单数据
        s2dAnalysis: {
          totalOrders: analysisResult.data.totalS2DOrders,
          achievementRate: analysisResult.data.achievementRate,
          avgS2DTime: analysisResult.data.avgS2DTime,
          // 转换byBrand数组为对象，并添加前端期望的字段
          brandStats: analysisResult.data.byBrand.reduce((acc, item) => {
            acc[item.brandCode] = {
              ...item,
              total: item.totalS2DOrders,
              actualCategories: {
                '24H': item.actual24h || 0,
                '48H': item.actual48h || 0,
                '72H': item.actual72h || 0,
                '72H+': item.actualOver72h || 0
              },
              planCategories: {
                '24H': item.plan24h || 0,
                '48H': item.plan48h || 0,
                '72H': item.plan72h || 0,
                '72H+': item.planOver72h || 0
              }
              // ✅ avgActualHours已由timelinessDataProcessor-file-based.js计算好
            };
            return acc;
          }, {}),
          // 转换byCourier数组为对象，并添加前端期望的字段
          carrierStats: analysisResult.data.byCourier.reduce((acc, item) => {
            acc[item.carrierId] = {
              ...item,
              total: item.totalS2DOrders,
              actualCategories: {
                '24H': item.actual24h || 0,
                '48H': item.actual48h || 0,
                '72H': item.actual72h || 0,
                '72H+': item.actualOver72h || 0
              },
              planCategories: {
                '24H': item.plan24h || 0,
                '48H': item.plan48h || 0,
                '72H': item.plan72h || 0,
                '72H+': item.planOver72h || 0
              }
              // ✅ avgActualHours已由timelinessDataProcessor-file-based.js计算好
            };
            return acc;
          }, {}),
          // 🔥 修复：改名为 brandCarrierStats（前端期望的字段名）
          brandCarrierStats: analysisResult.data.byBrandCourier ? 
            analysisResult.data.byBrandCourier.reduce((acc, item) => {
              const key = `${item.brandCode}|${item.carrierId}`;
              acc[key] = {
                ...item,
                total: item.totalS2DOrders,
                actualCategories: {
                  '24H': item.actual24h || 0,
                  '48H': item.actual48h || 0,
                  '72H': item.actual72h || 0,
                  '72H+': item.actualOver72h || 0
                },
                planCategories: {
                  '24H': item.plan24h || 0,
                  '48H': item.plan48h || 0,
                  '72H': item.plan72h || 0,
                  '72H+': item.planOver72h || 0
                }
                // ✅ avgActualHours已由timelinessDataProcessor-file-based.js计算好
              };
              return acc;
            }, {}) : {},
          metadata: analysisResult.data.metadata
        }
      },
      timestamp: new Date().toISOString()
    };

    console.log('📤 upload.js: 即将返回给前端的数据摘要:', {
      success: formattedResult.success,
      hasData: !!formattedResult.data,
      hasRawOrders: !!formattedResult.data.rawOrders,
      rawOrdersCount: formattedResult.data.rawOrders?.length || 0
    });

    res.json(formattedResult);

  } catch (error) {
    console.error('时效分析计算失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '时效分析计算失败',
      details: error.message
    });
  }
});

/**
 * 获取时效SLA匹配状态
 * GET /api/upload/sla-matching-status
 */
router.get('/sla-matching-status', async (req, res) => {
  try {
    const { brand, dateRange } = req.query;
    
    console.log('📊 获取SLA匹配状态:', { brand, dateRange });

    // ✅ 导入SLA匹配状态检查函数（基于文件存储版本）
    const { getSLAMatchingStatus } = await import('../utils/timelinessDataProcessor-file-based.js');
    
    const matchingStatus = await getSLAMatchingStatus({
      brand,
      dateRange: dateRange ? JSON.parse(dateRange) : null
    });

    res.json({
      success: true,
      message: 'SLA匹配状态获取成功',
      data: matchingStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('获取SLA匹配状态失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取SLA匹配状态失败',
      details: error.message
    });
  }
});

export default router;