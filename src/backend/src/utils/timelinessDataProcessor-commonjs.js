/**
 * VF物流数据分析平台 - 时效数据处理工具 (CommonJS版本)
 * 
 * ✅ 2025-01-09: 转换为CommonJS格式，解决upload-commonjs.js导入问题
 * ✅ 2025-01-XX: 添加C2D时效分析支持
 * 
 * 处理上传的时效Excel数据并执行时效分析
 * 
 * 关键映射关系：
 * - 时效表中的Carrier列对应TSK_LIST_TASK表中的CARRIERID字段
 * - 城市映射通过DEST_CITY代码在BAS_AREA表中查询area_name获取真实城市名称
 * - S2D计算使用SUM_SEND_TIME2字段作为实际配送时长（小时）
 * - C2D计算：DELIVERY_TIME - PAYMENTDATE_D（天数）
 */

const { executeQuery, getConnection, releaseConnection } = require('../config/database-api');
const timelinessFileStore = require('./timelinessFileStore');

/**
 * 执行时效分析计算（S2D、C2D）
 * 订单匹配：每个订单根据品牌、城市和快递公司与上传的时效表进行匹配
 * 关键映射：时效表中的Carrier列对应TSK_LIST_TASK表中的CARRIERID字段
 * 
 * ✅ 2025-01-09修复: 支持selectedSelfFlag参数
 * ✅ 2025-01-09优化: 使用文件存储替代数据库（无写入权限）
 */
async function analyzeTimelinessPerformance(options = {}) {
  const { 
    dateRange,
    selectedBrand = null,
    selectedCarrier = null,
    selectedSelfFlag = null,  // ✅ 新增：接收selfFlag参数
    analysisType = 'S2D'  // ✅ 默认只执行S2D分析
  } = options;

  console.log('🔄 开始时效分析计算...', options);

  try {
    // VF品牌映射 - 只分析这5个品牌
    const VF_BRAND_MAPPING = {
      'DICKIES': '18405',
      'TNF': '18405-1', 
      'ICEBREAKER': '18405-2',
      'VANS': '18405-3',
      'TIMBERLAND': '18405-4'
    };
    
    // VF品牌代码数组
    const VF_BRAND_CODES = Object.values(VF_BRAND_MAPPING);
    
    // ✅ 修复：根据selfFlag动态构建WHERE条件
    let whereConditions = [];
    let params = {};
    
    // ✅ 自管筛选条件 - 与总览界面逻辑保持一致
    if (selectedSelfFlag && selectedSelfFlag !== 'all') {
      whereConditions.push('t.SELF_FLAG = :selfFlag');
      params.selfFlag = selectedSelfFlag;
      console.log(`🔧 [Self Flag Filter] 自管筛选: ${selectedSelfFlag}`);
    } else if (selectedSelfFlag === 'all') {
      // ✅ 选择"全部"时，不添加SELF_FLAG筛选
      console.log(`🔧 [Self Flag Filter] 全部订单，无SELF_FLAG筛选`);
    } else {
      // ✅ 默认情况：selfFlag为null/undefined时，默认为自管
      whereConditions.push('t.SELF_FLAG = :selfFlag');
      params.selfFlag = 'Y';
      console.log(`🔧 [Self Flag Filter] selfFlag为空，默认自管筛选: Y`);
    }
    
    // 只查询VF的5个品牌数据
    const brandCodesList = VF_BRAND_CODES.map((code, index) => `:brandCode${index}`).join(', ');
    whereConditions.push(`t.CUSTOMERNO IN (${brandCodesList})`);
    VF_BRAND_CODES.forEach((code, index) => {
      params[`brandCode${index}`] = code;
    });
    
    // 排除EMS和退货订单
    whereConditions.push("t.CARRIERID != 'EMS'");
    whereConditions.push("(t.DIS_TYPE IS NULL OR t.DIS_TYPE != '06')");
    
    // 时间范围筛选
    if (dateRange && dateRange.from && dateRange.to) {
      whereConditions.push("t.WMS_OUTBOUND_TIME BETWEEN TO_DATE(:dateFrom, 'YYYY-MM-DD') AND TO_DATE(:dateTo, 'YYYY-MM-DD')");
      params.dateFrom = dateRange.from;
      params.dateTo = dateRange.to;
    }
    
    // 品牌筛选
    if (selectedBrand && selectedBrand !== 'all') {
      whereConditions.push('t.CUSTOMERNO = :brand');
      params.brand = selectedBrand;
    }
    
    // 快递商筛选
    if (selectedCarrier && selectedCarrier !== 'all') {
      whereConditions.push('t.CARRIERID = :carrier');
      params.carrier = selectedCarrier;
    }
    
    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';

    console.log('📊 执行优化的时效统计分析（聚合查询）...');
    console.log('🔍 WHERE条件:', whereClause);
    console.log('🔍 绑定参数:', params);
    
    // ✅ 检查时效数据来源（文件存储 或 数据库表）
    let timelinessDataSource = 'none';
    let timelinessDataFromFile = null;
    
    // 优先使用文件存储的时效数据
    try {
      timelinessDataFromFile = await timelinessFileStore.getTimelinessData();
      if (timelinessDataFromFile && timelinessDataFromFile.length > 0) {
        timelinessDataSource = 'file';
        console.log(`📋 使用文件存储的时效数据: ${timelinessDataFromFile.length}条记录`);
      }
    } catch (error) {
      console.warn('⚠️  无法加载文件存储的时效数据:', error.message);
    }
    
    // 如果文件存储没有数据，尝试检查数据库表（兼容性）
    let timelinessTableExists = false;
    if (timelinessDataSource === 'none') {
      try {
        const checkTableQuery = `
          SELECT COUNT(*) as TABLE_COUNT
          FROM ALL_TABLES
          WHERE OWNER = 'APP_CMS' AND TABLE_NAME = 'TSK_TIMELINESS_DATA'
        `;
        const checkResult = await executeQuery(checkTableQuery, {});
        timelinessTableExists = checkResult.rows && checkResult.rows[0] && checkResult.rows[0].TABLE_COUNT > 0;
        if (timelinessTableExists) {
          timelinessDataSource = 'database';
          console.log(`📋 使用数据库表的时效数据`);
        }
      } catch (error) {
        console.warn('⚠️  无法检查数据库时效表:', error.message);
      }
    }
    
    console.log(`📊 时效数据来源: ${timelinessDataSource === 'file' ? '文件存储' : timelinessDataSource === 'database' ? '数据库表' : '无数据'}`);

    
    // 🔥 优化查询：根据时效表存在，使用不同的SQL
    let statsQuery;
    if (timelinessTableExists) {
      // ✅ 时效表存在：包含Plan vs Actual对比
      console.log('📊 使用Plan vs Actual对比查询（包含时效表）');
      statsQuery = `
        SELECT 
          t.CUSTOMERNO as BRAND_CODE,
          t.CARRIERID as CARRIER_ID,
          ba.AREA_NAME as CITY_NAME,
          -- ✅ Actual时效分组统计
          COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 >= 0 
                     AND t.SUM_SEND_TIME2 <= 24 THEN 1 END) as ACTUAL_24H_COUNT,
          COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL 
                     AND t.SUM_SEND_TIME2 > 24 AND t.SUM_SEND_TIME2 <= 48 THEN 1 END) as ACTUAL_48H_COUNT,
          COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL 
                     AND t.SUM_SEND_TIME2 > 48 AND t.SUM_SEND_TIME2 <= 72 THEN 1 END) as ACTUAL_72H_COUNT,
          COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL 
                     AND t.SUM_SEND_TIME2 > 72 THEN 1 END) as ACTUAL_72H_PLUS_COUNT,
          -- ✅ Plan时效分组统计
          COUNT(CASE WHEN sla.TIME_VALUE IS NOT NULL 
                     AND sla.TIME_VALUE <= 24 THEN 1 END) as PLAN_24H_COUNT,
          COUNT(CASE WHEN sla.TIME_VALUE IS NOT NULL 
                     AND sla.TIME_VALUE > 24 AND sla.TIME_VALUE <= 48 THEN 1 END) as PLAN_48H_COUNT,
          COUNT(CASE WHEN sla.TIME_VALUE IS NOT NULL 
                     AND sla.TIME_VALUE > 48 AND sla.TIME_VALUE <= 72 THEN 1 END) as PLAN_72H_COUNT,
          COUNT(CASE WHEN sla.TIME_VALUE IS NOT NULL 
                     AND sla.TIME_VALUE > 72 THEN 1 END) as PLAN_72H_PLUS_COUNT,
          -- 总订单数和平均时效
          COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 >= 0 
                     THEN 1 END) as TOTAL_S2D_ORDERS,
          AVG(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 >= 0 
                   THEN t.SUM_SEND_TIME2 END) as AVG_ACTUAL_HOURS,
          AVG(CASE WHEN sla.TIME_VALUE IS NOT NULL 
                   THEN sla.TIME_VALUE END) as AVG_PLAN_HOURS
        FROM APP_CMS.TSK_LIST_TASK t
        LEFT JOIN APP_CMS.BAS_AREA ba ON t.DEST_CITY = ba.AREA_ID
        LEFT JOIN APP_CMS.TSK_TIMELINESS_DATA sla ON (
          sla.BRAND_CODE = t.CUSTOMERNO
          AND sla.CARRIER_NAME = t.CARRIERID
          AND (sla.AREA_ID = ba.AREA_ID OR sla.CITY_NAME = ba.AREA_NAME)
        )
        ${whereClause}
        GROUP BY t.CUSTOMERNO, t.CARRIERID, ba.AREA_NAME
        HAVING COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 >= 0 THEN 1 END) > 0
        ORDER BY TOTAL_S2D_ORDERS DESC
      `;
    } else {
      // ⚠️  时效表不存在：只查询Actual数据（不包含Plan）
      console.log('⚠️  时效表不存在，只查询Actual时效数据');
      statsQuery = `
        SELECT 
          t.CUSTOMERNO as BRAND_CODE,
          t.CARRIERID as CARRIER_ID,
          ba.AREA_NAME as CITY_NAME,
          -- ✅ Actual时效分组统计
          COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 >= 0 
                     AND t.SUM_SEND_TIME2 <= 24 THEN 1 END) as ACTUAL_24H_COUNT,
          COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL 
                     AND t.SUM_SEND_TIME2 > 24 AND t.SUM_SEND_TIME2 <= 48 THEN 1 END) as ACTUAL_48H_COUNT,
          COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL 
                     AND t.SUM_SEND_TIME2 > 48 AND t.SUM_SEND_TIME2 <= 72 THEN 1 END) as ACTUAL_72H_COUNT,
          COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL 
                     AND t.SUM_SEND_TIME2 > 72 THEN 1 END) as ACTUAL_72H_PLUS_COUNT,
          -- ❌ Plan时效为0（表不存在）
          0 as PLAN_24H_COUNT,
          0 as PLAN_48H_COUNT,
          0 as PLAN_72H_COUNT,
          0 as PLAN_72H_PLUS_COUNT,
          -- 总订单数和平均时效
          COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 >= 0 
                     THEN 1 END) as TOTAL_S2D_ORDERS,
          AVG(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 >= 0 
                   THEN t.SUM_SEND_TIME2 END) as AVG_ACTUAL_HOURS,
          NULL as AVG_PLAN_HOURS
        FROM APP_CMS.TSK_LIST_TASK t
        LEFT JOIN APP_CMS.BAS_AREA ba ON t.DEST_CITY = ba.AREA_ID
        ${whereClause}
        GROUP BY t.CUSTOMERNO, t.CARRIERID, ba.AREA_NAME
        HAVING COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 >= 0 THEN 1 END) > 0
        ORDER BY TOTAL_S2D_ORDERS DESC
      `;
    }

    console.log('📊 执行优化的时效统计查询（聚合方式）...');
    const statsResult = await executeQuery(statsQuery, params);
    const stats = statsResult.rows || [];

    console.log(`✅ 获取到 ${stats.length} 个品牌-快递商-城市组合的统计数据`);
    
    if (stats.length === 0) {
      console.warn('⚠️  没有找到符合条件的订单数据');
      return {
        totalOrders: 0,
        s2dAnalysis: {
          totalS2DOrders: 0,
          categories: {
            '24H': { actualCount: 0, planCount: 0, label: '≤24小时' },
            '48H': { actualCount: 0, planCount: 0, label: '24-48小时' },
            '72H': { actualCount: 0, planCount: 0, label: '48-72小时' },
            '72H+': { actualCount: 0, planCount: 0, label: '72小时以上' }
          },
          overallAvgActualHours: 0,
          overallAvgPlanHours: 0,
          brandStats: {},
          carrierStats: {}
        },
        c2dAnalysis: null,  // 新增C2D分析结果
        matchingStats: {
          totalOrders: 0,
          matchedOrders: 0,
          unmatchedOrders: 0,
          matchRate: 0
        }
      };
    }
    
    // 调试：显示前3条统计数据
    if (stats.length > 0) {
      console.log('📋 统计数据示例（前3条）:');
      stats.slice(0, 3).forEach((stat, index) => {
        console.log(`  [${index + 1}] 品牌: ${stat.BRAND_CODE}, 快递商: ${stat.CARRIER_ID}, 城市: ${stat.CITY_NAME}`);
        console.log(`      总订单: ${stat.TOTAL_S2D_ORDERS}`);
        console.log(`      Actual: 24H=${stat.ACTUAL_24H_COUNT}, 48H=${stat.ACTUAL_48H_COUNT}, 72H=${stat.ACTUAL_72H_COUNT}, 72H+=${stat.ACTUAL_72H_PLUS_COUNT}`);
        console.log(`      Plan: 24H=${stat.PLAN_24H_COUNT}, 48H=${stat.PLAN_48H_COUNT}, 72H=${stat.PLAN_72H_COUNT}, 72H+=${stat.PLAN_72H_PLUS_COUNT}`);
        console.log(`      平均时效: Actual=${stat.AVG_ACTUAL_HOURS}h, Plan=${stat.AVG_PLAN_HOURS}h`);
      });
    }

    // 执行S2D分析
    let s2dAnalysis = null;
    if (analysisType === 'S2D' || analysisType === 'both') {
      s2dAnalysis = analyzeS2DPerformanceFromStats(stats);
    }
    
    // 🆕 执行C2D分析
    let c2dAnalysis = null;
    if (analysisType === 'C2D' || analysisType === 'both') {
      // C2D需要不同的SQL查询（使用DELIVERY_TIME和PAYMENTDATE_D）
      c2dAnalysis = await analyzeC2DPerformance(whereClause, params, timelinessTableExists);
    }
    
    // 汇总结果
    const totalOrders = s2dAnalysis ? s2dAnalysis.totalS2DOrders : (c2dAnalysis ? c2dAnalysis.totalC2DOrders : 0);
    
    console.log(`✅ 时效分析完成: 总订单${totalOrders}条`);
    
    return {
      totalOrders,
      s2dAnalysis,
      c2dAnalysis,  // 新增C2D分析结果
      matchingStats: {
        totalOrders: totalOrders,
        matchedOrders: s2dAnalysis ? s2dAnalysis.totalS2DOrders : (c2dAnalysis ? c2dAnalysis.totalC2DOrders : 0),
        unmatchedOrders: 0,
        matchRate: 100
      }
    };
    
  } catch (error) {
    console.error('❌ 时效分析失败:', error);
    throw error;
  }
}

/**
 * 从聚合统计数据中分析S2D性能
 * ✅ 支持Plan vs Actual对比
 */
function analyzeS2DPerformanceFromStats(stats) {
  console.log('📊 执行S2D时效分析（从聚合统计）...');
  
  let totalOrders = 0;
  
  // Actual时效统计
  let actualTotal24H = 0;
  let actualTotal48H = 0;
  let actualTotal72H = 0;
  let actualTotal72HPlus = 0;
  
  // Plan时效统计
  let planTotal24H = 0;
  let planTotal48H = 0;
  let planTotal72H = 0;
  let planTotal72HPlus = 0;
  
  let totalActualHours = 0;
  let totalPlanHours = 0;
  let actualOrdersCount = 0;
  let planOrdersCount = 0;
  
  const brandStats = {};
  const carrierStats = {};
  
  // 遍历统计数据
  stats.forEach(stat => {
    const brandCode = stat.BRAND_CODE || 'UNKNOWN';
    const carrierId = stat.CARRIER_ID || 'UNKNOWN';
    const orders = parseInt(stat.TOTAL_S2D_ORDERS) || 0;
    
    // Actual时效计数
    const actualCount24H = parseInt(stat.ACTUAL_24H_COUNT) || 0;
    const actualCount48H = parseInt(stat.ACTUAL_48H_COUNT) || 0;
    const actualCount72H = parseInt(stat.ACTUAL_72H_COUNT) || 0;
    const actualCount72HPlus = parseInt(stat.ACTUAL_72H_PLUS_COUNT) || 0;
    
    // Plan时效计数
    const planCount24H = parseInt(stat.PLAN_24H_COUNT) || 0;
    const planCount48H = parseInt(stat.PLAN_48H_COUNT) || 0;
    const planCount72H = parseInt(stat.PLAN_72H_COUNT) || 0;
    const planCount72HPlus = parseInt(stat.PLAN_72H_PLUS_COUNT) || 0;
    
    const avgActualHours = parseFloat(stat.AVG_ACTUAL_HOURS) || 0;
    const avgPlanHours = parseFloat(stat.AVG_PLAN_HOURS) || 0;
    
    totalOrders += orders;
    
    actualTotal24H += actualCount24H;
    actualTotal48H += actualCount48H;
    actualTotal72H += actualCount72H;
    actualTotal72HPlus += actualCount72HPlus;
    
    planTotal24H += planCount24H;
    planTotal48H += planCount48H;
    planTotal72H += planCount72H;
    planTotal72HPlus += planCount72HPlus;
    
    if (avgActualHours > 0) {
      totalActualHours += avgActualHours * orders;
      actualOrdersCount += orders;
    }
    
    if (avgPlanHours > 0) {
      totalPlanHours += avgPlanHours * orders;
      planOrdersCount += orders;
    }
    
    // 品牌统计
    if (!brandStats[brandCode]) {
      brandStats[brandCode] = {
        total: 0,
        actualCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        planCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        avgActualHours: 0,
        avgPlanHours: 0,
        slaMatchedCount: 0,
        totalActualHours: 0,
        totalPlanHours: 0
      };
    }
    brandStats[brandCode].total += orders;
    brandStats[brandCode].actualCategories['24H'] += actualCount24H;
    brandStats[brandCode].actualCategories['48H'] += actualCount48H;
    brandStats[brandCode].actualCategories['72H'] += actualCount72H;
    brandStats[brandCode].actualCategories['72H+'] += actualCount72HPlus;
    brandStats[brandCode].planCategories['24H'] += planCount24H;
    brandStats[brandCode].planCategories['48H'] += planCount48H;
    brandStats[brandCode].planCategories['72H'] += planCount72H;
    brandStats[brandCode].planCategories['72H+'] += planCount72HPlus;
    brandStats[brandCode].totalActualHours += avgActualHours * orders;
    brandStats[brandCode].totalPlanHours += avgPlanHours * orders;
    if (avgPlanHours > 0) {
      brandStats[brandCode].slaMatchedCount += orders;
    }
    
    // 快递商统计
    if (!carrierStats[carrierId]) {
      carrierStats[carrierId] = {
        total: 0,
        actualCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        planCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        avgActualHours: 0,
        avgPlanHours: 0,
        slaMatchedCount: 0,
        totalActualHours: 0,
        totalPlanHours: 0
      };
    }
    carrierStats[carrierId].total += orders;
    carrierStats[carrierId].actualCategories['24H'] += actualCount24H;
    carrierStats[carrierId].actualCategories['48H'] += actualCount48H;
    carrierStats[carrierId].actualCategories['72H'] += actualCount72H;
    carrierStats[carrierId].actualCategories['72H+'] += actualCount72HPlus;
    carrierStats[carrierId].planCategories['24H'] += planCount24H;
    carrierStats[carrierId].planCategories['48H'] += planCount48H;
    carrierStats[carrierId].planCategories['72H'] += planCount72H;
    carrierStats[carrierId].planCategories['72H+'] += planCount72HPlus;
    carrierStats[carrierId].totalActualHours += avgActualHours * orders;
    carrierStats[carrierId].totalPlanHours += avgPlanHours * orders;
    if (avgPlanHours > 0) {
      carrierStats[carrierId].slaMatchedCount += orders;
    }
  });
  
  // 计算平均值
  Object.keys(brandStats).forEach(brand => {
    if (brandStats[brand].total > 0) {
      brandStats[brand].avgActualHours = Math.round((brandStats[brand].totalActualHours / brandStats[brand].total) * 100) / 100;
      brandStats[brand].avgPlanHours = Math.round((brandStats[brand].totalPlanHours / brandStats[brand].total) * 100) / 100;
    }
  });
  
  Object.keys(carrierStats).forEach(carrier => {
    if (carrierStats[carrier].total > 0) {
      carrierStats[carrier].avgActualHours = Math.round((carrierStats[carrier].totalActualHours / carrierStats[carrier].total) * 100) / 100;
      carrierStats[carrier].avgPlanHours = Math.round((carrierStats[carrier].totalPlanHours / carrierStats[carrier].total) * 100) / 100;
    }
  });
  
  const overallAvgActualHours = actualOrdersCount > 0 ? 
    Math.round((totalActualHours / actualOrdersCount) * 100) / 100 : 0;
  const overallAvgPlanHours = planOrdersCount > 0 ? 
    Math.round((totalPlanHours / planOrdersCount) * 100) / 100 : 0;
  
  console.log(`📋 S2D统计完成（Plan vs Actual）:`);
  console.log(`  总订单: ${totalOrders}`);
  console.log(`  Actual时效分布: 24H:${actualTotal24H}, 48H:${actualTotal48H}, 72H:${actualTotal72H}, 72H+:${actualTotal72HPlus}`);
  console.log(`  Plan时效分布: 24H:${planTotal24H}, 48H:${planTotal48H}, 72H:${planTotal72H}, 72H+:${planTotal72HPlus}`);
  console.log(`  平均Actual时效: ${overallAvgActualHours}h`);
  console.log(`  平均Plan时效: ${overallAvgPlanHours}h`);
  console.log(`📊 品牌统计: ${Object.keys(brandStats).length}个品牌`);
  console.log(`🚚 快递商统计: ${Object.keys(carrierStats).length}个快递商`);
  
  return {
    totalS2DOrders: totalOrders,
    categories: {
      '24H': {
        actualCount: actualTotal24H,
        planCount: planTotal24H,
        label: '≤24小时'
      },
      '48H': {
        actualCount: actualTotal48H,
        planCount: planTotal48H,
        label: '24-48小时'
      },
      '72H': {
        actualCount: actualTotal72H,
        planCount: planTotal72H,
        label: '48-72小时'
      },
      '72H+': {
        actualCount: actualTotal72HPlus,
        planCount: planTotal72HPlus,
        label: '72小时以上'
      }
    },
    overallAvgActualHours,
    overallAvgPlanHours,
    brandStats,
    carrierStats
  };
}

/**
 * 执行C2D分析
 * 使用DELIVERY_TIME和PAYMENTDATE_D计算C2D时效
 */
async function analyzeC2DPerformance(whereClause, params, timelinessTableExists) {
  console.log('📊 执行C2D时效分析...');
  
  let totalOrders = 0;
  
  // Actual时效统计
  let actualTotal24H = 0;
  let actualTotal48H = 0;
  let actualTotal72H = 0;
  let actualTotal72HPlus = 0;
  
  // Plan时效统计
  let planTotal24H = 0;
  let planTotal48H = 0;
  let planTotal72H = 0;
  let planTotal72HPlus = 0;
  
  let totalActualHours = 0;
  let totalPlanHours = 0;
  let actualOrdersCount = 0;
  let planOrdersCount = 0;
  
  const brandStats = {};
  const carrierStats = {};
  
  // 🔥 优化查询：根据时效表存在，使用不同的SQL
  let statsQuery;
  if (timelinessTableExists) {
    // ✅ 时效表存在：包含Plan vs Actual对比
    console.log('📊 使用Plan vs Actual对比查询（包含时效表）');
    statsQuery = `
      SELECT 
        t.CUSTOMERNO as BRAND_CODE,
        t.CARRIERID as CARRIER_ID,
        ba.AREA_NAME as CITY_NAME,
        -- ✅ Actual时效分组统计
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL 
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 24 THEN 1 END) as ACTUAL_24H_COUNT,
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL 
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 > 24 AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 48 THEN 1 END) as ACTUAL_48H_COUNT,
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL 
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 > 48 AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 72 THEN 1 END) as ACTUAL_72H_COUNT,
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL 
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 > 72 THEN 1 END) as ACTUAL_72H_PLUS_COUNT,
        -- ✅ Plan时效分组统计
        COUNT(CASE WHEN sla.TIME_VALUE IS NOT NULL 
                   AND sla.TIME_VALUE <= 24 THEN 1 END) as PLAN_24H_COUNT,
        COUNT(CASE WHEN sla.TIME_VALUE IS NOT NULL 
                   AND sla.TIME_VALUE > 24 AND sla.TIME_VALUE <= 48 THEN 1 END) as PLAN_48H_COUNT,
        COUNT(CASE WHEN sla.TIME_VALUE IS NOT NULL 
                   AND sla.TIME_VALUE > 48 AND sla.TIME_VALUE <= 72 THEN 1 END) as PLAN_72H_COUNT,
        COUNT(CASE WHEN sla.TIME_VALUE IS NOT NULL 
                   AND sla.TIME_VALUE > 72 THEN 1 END) as PLAN_72H_PLUS_COUNT,
        -- 总订单数和平均时效
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL 
                   THEN 1 END) as TOTAL_C2D_ORDERS,
        AVG(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL 
                 THEN (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 END) as AVG_ACTUAL_HOURS,
        AVG(CASE WHEN sla.TIME_VALUE IS NOT NULL 
                 THEN sla.TIME_VALUE END) as AVG_PLAN_HOURS
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_AREA ba ON t.DEST_CITY = ba.AREA_ID
      LEFT JOIN APP_CMS.TSK_TIMELINESS_DATA sla ON (
        sla.BRAND_CODE = t.CUSTOMERNO
        AND sla.CARRIER_NAME = t.CARRIERID
        AND (sla.AREA_ID = ba.AREA_ID OR sla.CITY_NAME = ba.AREA_NAME)
      )
      ${whereClause}
      GROUP BY t.CUSTOMERNO, t.CARRIERID, ba.AREA_NAME
      HAVING COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL THEN 1 END) > 0
      ORDER BY TOTAL_C2D_ORDERS DESC
    `;
  } else {
    // ⚠️  时效表不存在：只查询Actual数据（不包含Plan）
    console.log('⚠️  时效表不存在，只查询Actual时效数据');
    statsQuery = `
      SELECT 
        t.CUSTOMERNO as BRAND_CODE,
        t.CARRIERID as CARRIER_ID,
        ba.AREA_NAME as CITY_NAME,
        -- ✅ Actual时效分组统计
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL 
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 24 THEN 1 END) as ACTUAL_24H_COUNT,
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL 
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 > 24 AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 48 THEN 1 END) as ACTUAL_48H_COUNT,
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL 
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 > 48 AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 72 THEN 1 END) as ACTUAL_72H_COUNT,
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL 
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 > 72 THEN 1 END) as ACTUAL_72H_PLUS_COUNT,
        -- ❌ Plan时效为0（表不存在）
        0 as PLAN_24H_COUNT,
        0 as PLAN_48H_COUNT,
        0 as PLAN_72H_COUNT,
        0 as PLAN_72H_PLUS_COUNT,
        -- 总订单数和平均时效
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL 
                   THEN 1 END) as TOTAL_C2D_ORDERS,
        AVG(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL 
                 THEN (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 END) as AVG_ACTUAL_HOURS,
        NULL as AVG_PLAN_HOURS
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_AREA ba ON t.DEST_CITY = ba.AREA_ID
      ${whereClause}
      GROUP BY t.CUSTOMERNO, t.CARRIERID, ba.AREA_NAME
      HAVING COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.DELIVERY_TIME IS NOT NULL AND t.PAYMENTDATE_D IS NOT NULL THEN 1 END) > 0
      ORDER BY TOTAL_C2D_ORDERS DESC
    `;
  }

  console.log('📊 执行优化的时效统计查询（聚合方式）...');
  const statsResult = await executeQuery(statsQuery, params);
  const stats = statsResult.rows || [];

  console.log(`✅ 获取到 ${stats.length} 个品牌-快递商-城市组合的统计数据`);
  
  if (stats.length === 0) {
    console.warn('⚠️  没有找到符合条件的订单数据');
    return {
      totalC2DOrders: 0,
      categories: {
        '24H': { actualCount: 0, planCount: 0, label: '≤24小时' },
        '48H': { actualCount: 0, planCount: 0, label: '24-48小时' },
        '72H': { actualCount: 0, planCount: 0, label: '48-72小时' },
        '72H+': { actualCount: 0, planCount: 0, label: '72小时以上' }
      },
      overallAvgActualHours: 0,
      overallAvgPlanHours: 0,
      brandStats: {},
      carrierStats: {}
    };
  }
  
  // 调试：显示前3条统计数据
  if (stats.length > 0) {
    console.log('📋 统计数据示例（前3条）:');
    stats.slice(0, 3).forEach((stat, index) => {
      console.log(`  [${index + 1}] 品牌: ${stat.BRAND_CODE}, 快递商: ${stat.CARRIER_ID}, 城市: ${stat.CITY_NAME}`);
      console.log(`      总订单: ${stat.TOTAL_C2D_ORDERS}`);
      console.log(`      Actual: 24H=${stat.ACTUAL_24H_COUNT}, 48H=${stat.ACTUAL_48H_COUNT}, 72H=${stat.ACTUAL_72H_COUNT}, 72H+=${stat.ACTUAL_72H_PLUS_COUNT}`);
      console.log(`      Plan: 24H=${stat.PLAN_24H_COUNT}, 48H=${stat.PLAN_48H_COUNT}, 72H=${stat.PLAN_72H_COUNT}, 72H+=${stat.PLAN_72H_PLUS_COUNT}`);
      console.log(`      平均时效: Actual=${stat.AVG_ACTUAL_HOURS}h, Plan=${stat.AVG_PLAN_HOURS}h`);
    });
  }

  // 遍历统计数据
  stats.forEach(stat => {
    const brandCode = stat.BRAND_CODE || 'UNKNOWN';
    const carrierId = stat.CARRIER_ID || 'UNKNOWN';
    const orders = parseInt(stat.TOTAL_C2D_ORDERS) || 0;
    
    // Actual时效计数
    const actualCount24H = parseInt(stat.ACTUAL_24H_COUNT) || 0;
    const actualCount48H = parseInt(stat.ACTUAL_48H_COUNT) || 0;
    const actualCount72H = parseInt(stat.ACTUAL_72H_COUNT) || 0;
    const actualCount72HPlus = parseInt(stat.ACTUAL_72H_PLUS_COUNT) || 0;
    
    // Plan时效计数
    const planCount24H = parseInt(stat.PLAN_24H_COUNT) || 0;
    const planCount48H = parseInt(stat.PLAN_48H_COUNT) || 0;
    const planCount72H = parseInt(stat.PLAN_72H_COUNT) || 0;
    const planCount72HPlus = parseInt(stat.PLAN_72H_PLUS_COUNT) || 0;
    
    const avgActualHours = parseFloat(stat.AVG_ACTUAL_HOURS) || 0;
    const avgPlanHours = parseFloat(stat.AVG_PLAN_HOURS) || 0;
    
    totalOrders += orders;
    
    actualTotal24H += actualCount24H;
    actualTotal48H += actualCount48H;
    actualTotal72H += actualCount72H;
    actualTotal72HPlus += actualCount72HPlus;
    
    planTotal24H += planCount24H;
    planTotal48H += planCount48H;
    planTotal72H += planCount72H;
    planTotal72HPlus += planCount72HPlus;
    
    if (avgActualHours > 0) {
      totalActualHours += avgActualHours * orders;
      actualOrdersCount += orders;
    }
    
    if (avgPlanHours > 0) {
      totalPlanHours += avgPlanHours * orders;
      planOrdersCount += orders;
    }
    
    // 品牌统计
    if (!brandStats[brandCode]) {
      brandStats[brandCode] = {
        total: 0,
        actualCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        planCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        avgActualHours: 0,
        avgPlanHours: 0,
        slaMatchedCount: 0,
        totalActualHours: 0,
        totalPlanHours: 0
      };
    }
    brandStats[brandCode].total += orders;
    brandStats[brandCode].actualCategories['24H'] += actualCount24H;
    brandStats[brandCode].actualCategories['48H'] += actualCount48H;
    brandStats[brandCode].actualCategories['72H'] += actualCount72H;
    brandStats[brandCode].actualCategories['72H+'] += actualCount72HPlus;
    brandStats[brandCode].planCategories['24H'] += planCount24H;
    brandStats[brandCode].planCategories['48H'] += planCount48H;
    brandStats[brandCode].planCategories['72H'] += planCount72H;
    brandStats[brandCode].planCategories['72H+'] += planCount72HPlus;
    brandStats[brandCode].totalActualHours += avgActualHours * orders;
    brandStats[brandCode].totalPlanHours += avgPlanHours * orders;
    if (avgPlanHours > 0) {
      brandStats[brandCode].slaMatchedCount += orders;
    }
    
    // 快递商统计
    if (!carrierStats[carrierId]) {
      carrierStats[carrierId] = {
        total: 0,
        actualCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        planCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        avgActualHours: 0,
        avgPlanHours: 0,
        slaMatchedCount: 0,
        totalActualHours: 0,
        totalPlanHours: 0
      };
    }
    carrierStats[carrierId].total += orders;
    carrierStats[carrierId].actualCategories['24H'] += actualCount24H;
    carrierStats[carrierId].actualCategories['48H'] += actualCount48H;
    carrierStats[carrierId].actualCategories['72H'] += actualCount72H;
    carrierStats[carrierId].actualCategories['72H+'] += actualCount72HPlus;
    carrierStats[carrierId].planCategories['24H'] += planCount24H;
    carrierStats[carrierId].planCategories['48H'] += planCount48H;
    carrierStats[carrierId].planCategories['72H'] += planCount72H;
    carrierStats[carrierId].planCategories['72H+'] += planCount72HPlus;
    carrierStats[carrierId].totalActualHours += avgActualHours * orders;
    carrierStats[carrierId].totalPlanHours += avgPlanHours * orders;
    if (avgPlanHours > 0) {
      carrierStats[carrierId].slaMatchedCount += orders;
    }
  });
  
  // 计算平均值
  Object.keys(brandStats).forEach(brand => {
    if (brandStats[brand].total > 0) {
      brandStats[brand].avgActualHours = Math.round((brandStats[brand].totalActualHours / brandStats[brand].total) * 100) / 100;
      brandStats[brand].avgPlanHours = Math.round((brandStats[brand].totalPlanHours / brandStats[brand].total) * 100) / 100;
    }
  });
  
  Object.keys(carrierStats).forEach(carrier => {
    if (carrierStats[carrier].total > 0) {
      carrierStats[carrier].avgActualHours = Math.round((carrierStats[carrier].totalActualHours / carrierStats[carrier].total) * 100) / 100;
      carrierStats[carrier].avgPlanHours = Math.round((carrierStats[carrier].totalPlanHours / carrierStats[carrier].total) * 100) / 100;
    }
  });
  
  const overallAvgActualHours = actualOrdersCount > 0 ? 
    Math.round((totalActualHours / actualOrdersCount) * 100) / 100 : 0;
  const overallAvgPlanHours = planOrdersCount > 0 ? 
    Math.round((totalPlanHours / planOrdersCount) * 100) / 100 : 0;
  
  console.log(`📋 C2D统计完成（Plan vs Actual）:`);
  console.log(`  总订单: ${totalOrders}`);
  console.log(`  Actual时效分布: 24H:${actualTotal24H}, 48H:${actualTotal48H}, 72H:${actualTotal72H}, 72H+:${actualTotal72HPlus}`);
  console.log(`  Plan时效分布: 24H:${planTotal24H}, 48H:${planTotal48H}, 72H:${planTotal72H}, 72H+:${planTotal72HPlus}`);
  console.log(`  平均Actual时效: ${overallAvgActualHours}h`);
  console.log(`  平均Plan时效: ${overallAvgPlanHours}h`);
  console.log(`📊 品牌统计: ${Object.keys(brandStats).length}个品牌`);
  console.log(`🚚 快递商统计: ${Object.keys(carrierStats).length}个快递商`);
  
  return {
    totalC2DOrders: totalOrders,
    categories: {
      '24H': {
        actualCount: actualTotal24H,
        planCount: planTotal24H,
        label: '≤24小时'
      },
      '48H': {
        actualCount: actualTotal48H,
        planCount: planTotal48H,
        label: '24-48小时'
      },
      '72H': {
        actualCount: actualTotal72H,
        planCount: planTotal72H,
        label: '48-72小时'
      },
      '72H+': {
        actualCount: actualTotal72HPlus,
        planCount: planTotal72HPlus,
        label: '72小时以上'
      }
    },
    overallAvgActualHours,
    overallAvgPlanHours,
    brandStats,
    carrierStats
  };
}

// 导出函数
module.exports = {
  analyzeTimelinessPerformance
};