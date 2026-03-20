/**
 * VF物流数据分析平台 - 时效数据处理工具 (文件存储版本)
 * 
 * ✅ 2025-01-09创建: 支持文件存储的时效数据（无数据库写入权限）
 * 
 * 核心改进：
 * - 时效数据从文件系统加载到内存
 * - 订单数据从数据库查询
 * - 在应用层进行数据匹配（替代SQL JOIN）
 */

const { executeQuery } = require('../config/database-api');
const timelinessFileStore = require('./timelinessFileStore');

/**
 * 执行时效分析计算（使用文件存储的时效数据）
 */
async function analyzeTimelinessPerformance(options = {}) {
  const { 
    dateRange,
    selectedBrand = null,
    selectedCarrier = null,
    selectedSelfFlag = null,
    analysisType = 'S2D'
  } = options;

  console.log('🔄 开始时效分析计算（文件存储版本）...', options);

  try {
    // ✅ 步骤1: 加载时效数据（从文件）
    console.log('📂 加载时效标准数据...');
    const timelinessData = await timelinessFileStore.getTimelinessData();
    const hasTimelinessData = timelinessData && timelinessData.length > 0;
    
    if (hasTimelinessData) {
      console.log(`✅ 已加载${timelinessData.length}条时效标准数据`);
    } else {
      console.log('⚠️  未找到时效标准数据，将只返回Actual时效');
    }
    
    // ✅ 步骤2: 查询订单数据（从数据库）
    console.log('📊 查询订单数据...');
    const orders = await queryOrders({ dateRange, selectedBrand, selectedCarrier, selectedSelfFlag });
    
    if (!orders || orders.length === 0) {
      console.warn('⚠️  未找到符合条件的订单数据');
      return getEmptyAnalysisResult();
    }
    
    console.log(`✅ 查询到${orders.length}条订单数据`);
    
    // ✅ 步骤3: 在应用层进行数据匹配和分析
    console.log('🔗 执行时效匹配分析...');
    const analysis = performTimelinessAnalysis(orders, timelinessData);
    
    console.log(`✅ 时效分析完成: 总订单${analysis.totalOrders}条`);
    
    return analysis;
    
  } catch (error) {
    console.error('❌ 时效分析失败:', error);
    throw error;
  }
}

/**
 * 查询订单数据
 */
async function queryOrders(options) {
  const { dateRange, selectedBrand, selectedCarrier, selectedSelfFlag } = options;
  
  // VF品牌映射
  const VF_BRAND_MAPPING = {
    'DICKIES': '18405',
    'TNF': '18405-1', 
    'ICEBREAKER': '18405-2',
    'VANS': '18405-3',
    'TIMBERLAND': '18405-4'
  };
  
  const VF_BRAND_CODES = Object.values(VF_BRAND_MAPPING);
  
  // 构建WHERE条件
  let whereConditions = [];
  let params = {};
  
  // 自管筛选
  if (selectedSelfFlag && selectedSelfFlag !== 'all') {
    whereConditions.push('t.SELF_FLAG = :selfFlag');
    params.selfFlag = selectedSelfFlag;
  } else if (selectedSelfFlag === 'all') {
    // 不添加筛选
  } else {
    whereConditions.push('t.SELF_FLAG = :selfFlag');
    params.selfFlag = 'Y';
  }
  
  // 只查询VF品牌
  const brandCodesList = VF_BRAND_CODES.map((code, index) => `:brandCode${index}`).join(', ');
  whereConditions.push(`t.CUSTOMERNO IN (${brandCodesList})`);
  VF_BRAND_CODES.forEach((code, index) => {
    params[`brandCode${index}`] = code;
  });
  
  // 排除EMS和退货
  whereConditions.push("t.CARRIERID != 'EMS'");
  whereConditions.push("(t.DIS_TYPE IS NULL OR t.DIS_TYPE != '06')");
  
  // 时间范围
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
  
  // 查询订单（包含必要的字段）
  const orderQuery = `
    SELECT 
      t.CUSTOMERNO as BRAND_CODE,
      t.CARRIERID as CARRIER_ID,
      t.DEST_CITY as DEST_CITY,
      ba.AREA_NAME as CITY_NAME,
      ba.AREA_ID as AREA_ID,
      t.DIS_STATUS as ORDER_STATUS,
      t.SUM_SEND_TIME2 as ACTUAL_HOURS,
      t.WMS_OUTBOUND_TIME
    FROM APP_CMS.TSK_LIST_TASK t
    LEFT JOIN APP_CMS.BAS_AREA ba ON t.DEST_CITY = ba.AREA_ID
    ${whereClause}
    ORDER BY t.WMS_OUTBOUND_TIME DESC
  `;
  
  console.log('🔍 执行订单查询...');
  const result = await executeQuery(orderQuery, params);
  
  return result.rows || [];
}

/**
 * 执行时效匹配分析（在应用层）
 */
function performTimelinessAnalysis(orders, timelinessData) {
  console.log('🔗 开始匹配订单与时效标准...');
  
  // 创建时效查询索引（提升匹配性能）
  const timelinessIndex = createTimelinessIndex(timelinessData);
  
  // 分类统计
  let stats = {
    totalOrders: 0,
    actualStats: {
      '24H': 0,
      '48H': 0,
      '72H': 0,
      '72H+': 0
    },
    planStats: {
      '24H': 0,
      '48H': 0,
      '72H': 0,
      '72H+': 0
    },
    brandStats: {},
    carrierStats: {},
    totalActualHours: 0,
    totalPlanHours: 0,
    actualCount: 0,
    planCount: 0
  };
  
  // 遍历订单进行匹配
  orders.forEach(order => {
    const brandCode = order.BRAND_CODE;
    const carrierId = order.CARRIER_ID;
    const cityName = order.CITY_NAME;
    const areaId = order.AREA_ID;
    const orderStatus = order.ORDER_STATUS;
    const actualHours = parseFloat(order.ACTUAL_HOURS);
    
    // ✅ 匹配时效标准
    const timelinessValue = matchTimelinessValue(brandCode, carrierId, cityName, areaId, timelinessIndex);
    const planHours = timelinessValue ? parseFloat(timelinessValue) : null;
    
    // ✅ 统计Actual时效（只统计已签收订单）
    if (orderStatus === '95' && actualHours >= 0 && !isNaN(actualHours)) {
      stats.totalOrders++;
      stats.actualCount++;
      stats.totalActualHours += actualHours;
      
      // 时效区间分类
      if (actualHours <= 24) {
        stats.actualStats['24H']++;
      } else if (actualHours <= 48) {
        stats.actualStats['48H']++;
      } else if (actualHours <= 72) {
        stats.actualStats['72H']++;
      } else {
        stats.actualStats['72H+']++;
      }
    }
    
    // ✅ 统计Plan时效（所有匹配到的订单）
    if (planHours && !isNaN(planHours)) {
      stats.planCount++;
      stats.totalPlanHours += planHours;
      
      // 时效区间分类
      if (planHours <= 24) {
        stats.planStats['24H']++;
      } else if (planHours <= 48) {
        stats.planStats['48H']++;
      } else if (planHours <= 72) {
        stats.planStats['72H']++;
      } else {
        stats.planStats['72H+']++;
      }
    }
    
    // 品牌统计
    if (!stats.brandStats[brandCode]) {
      stats.brandStats[brandCode] = {
        total: 0,
        actualCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        planCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        totalActualHours: 0,
        totalPlanHours: 0,
        actualCount: 0,
        planCount: 0
      };
    }
    
    if (orderStatus === '95' && actualHours >= 0 && !isNaN(actualHours)) {
      stats.brandStats[brandCode].total++;
      stats.brandStats[brandCode].actualCount++;
      stats.brandStats[brandCode].totalActualHours += actualHours;
      
      if (actualHours <= 24) stats.brandStats[brandCode].actualCategories['24H']++;
      else if (actualHours <= 48) stats.brandStats[brandCode].actualCategories['48H']++;
      else if (actualHours <= 72) stats.brandStats[brandCode].actualCategories['72H']++;
      else stats.brandStats[brandCode].actualCategories['72H+']++;
    }
    
    if (planHours && !isNaN(planHours)) {
      stats.brandStats[brandCode].planCount++;
      stats.brandStats[brandCode].totalPlanHours += planHours;
      
      if (planHours <= 24) stats.brandStats[brandCode].planCategories['24H']++;
      else if (planHours <= 48) stats.brandStats[brandCode].planCategories['48H']++;
      else if (planHours <= 72) stats.brandStats[brandCode].planCategories['72H']++;
      else stats.brandStats[brandCode].planCategories['72H+']++;
    }
    
    // 快递商统计（类似逻辑）
    if (!stats.carrierStats[carrierId]) {
      stats.carrierStats[carrierId] = {
        total: 0,
        actualCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        planCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        totalActualHours: 0,
        totalPlanHours: 0,
        actualCount: 0,
        planCount: 0
      };
    }
    
    if (orderStatus === '95' && actualHours >= 0 && !isNaN(actualHours)) {
      stats.carrierStats[carrierId].total++;
      stats.carrierStats[carrierId].actualCount++;
      stats.carrierStats[carrierId].totalActualHours += actualHours;
      
      if (actualHours <= 24) stats.carrierStats[carrierId].actualCategories['24H']++;
      else if (actualHours <= 48) stats.carrierStats[carrierId].actualCategories['48H']++;
      else if (actualHours <= 72) stats.carrierStats[carrierId].actualCategories['72H']++;
      else stats.carrierStats[carrierId].actualCategories['72H+']++;
    }
    
    if (planHours && !isNaN(planHours)) {
      stats.carrierStats[carrierId].planCount++;
      stats.carrierStats[carrierId].totalPlanHours += planHours;
      
      if (planHours <= 24) stats.carrierStats[carrierId].planCategories['24H']++;
      else if (planHours <= 48) stats.carrierStats[carrierId].planCategories['48H']++;
      else if (planHours <= 72) stats.carrierStats[carrierId].planCategories['72H']++;
      else stats.carrierStats[carrierId].planCategories['72H+']++;
    }
  });
  
  // 计算平均值
  Object.keys(stats.brandStats).forEach(brand => {
    if (stats.brandStats[brand].actualCount > 0) {
      stats.brandStats[brand].avgActualHours = 
        Math.round((stats.brandStats[brand].totalActualHours / stats.brandStats[brand].actualCount) * 100) / 100;
    }
    if (stats.brandStats[brand].planCount > 0) {
      stats.brandStats[brand].avgPlanHours = 
        Math.round((stats.brandStats[brand].totalPlanHours / stats.brandStats[brand].planCount) * 100) / 100;
    }
  });
  
  Object.keys(stats.carrierStats).forEach(carrier => {
    if (stats.carrierStats[carrier].actualCount > 0) {
      stats.carrierStats[carrier].avgActualHours = 
        Math.round((stats.carrierStats[carrier].totalActualHours / stats.carrierStats[carrier].actualCount) * 100) / 100;
    }
    if (stats.carrierStats[carrier].planCount > 0) {
      stats.carrierStats[carrier].avgPlanHours = 
        Math.round((stats.carrierStats[carrier].totalPlanHours / stats.carrierStats[carrier].planCount) * 100) / 100;
    }
  });
  
  const overallAvgActualHours = stats.actualCount > 0 ? 
    Math.round((stats.totalActualHours / stats.actualCount) * 100) / 100 : 0;
  const overallAvgPlanHours = stats.planCount > 0 ? 
    Math.round((stats.totalPlanHours / stats.planCount) * 100) / 100 : 0;
  
  console.log(`✅ 匹配完成: 总订单${stats.totalOrders}, Actual${stats.actualCount}, Plan${stats.planCount}`);
  
  return {
    totalOrders: stats.totalOrders,
    s2dAnalysis: {
      totalS2DOrders: stats.totalOrders,
      categories: {
        '24H': {
          actualCount: stats.actualStats['24H'],
          planCount: stats.planStats['24H'],
          label: '≤24小时'
        },
        '48H': {
          actualCount: stats.actualStats['48H'],
          planCount: stats.planStats['48H'],
          label: '24-48小时'
        },
        '72H': {
          actualCount: stats.actualStats['72H'],
          planCount: stats.planStats['72H'],
          label: '48-72小时'
        },
        '72H+': {
          actualCount: stats.actualStats['72H+'],
          planCount: stats.planStats['72H+'],
          label: '72小时以上'
        }
      },
      overallAvgActualHours,
      overallAvgPlanHours,
      brandStats: stats.brandStats,
      carrierStats: stats.carrierStats
    },
    matchingStats: {
      totalOrders: stats.totalOrders,
      matchedOrders: stats.planCount,
      unmatchedOrders: stats.totalOrders - stats.planCount,
      matchRate: stats.totalOrders > 0 ? 
        Math.round((stats.planCount / stats.totalOrders) * 10000) / 100 : 0
    }
  };
}

/**
 * 创建时效查询索引（加速匹配）
 */
function createTimelinessIndex(timelinessData) {
  if (!timelinessData || timelinessData.length === 0) {
    return {};
  }
  
  const index = {};
  
  timelinessData.forEach(record => {
    const key = `${record.BRAND_CODE}|${record.CARRIER_NAME}|${record.CITY_NAME || ''}`;
    index[key] = record.TIME_VALUE;
    
    // 如果有AREA_ID，也创建索引
    if (record.AREA_ID) {
      const keyWithAreaId = `${record.BRAND_CODE}|${record.CARRIER_NAME}|${record.AREA_ID}`;
      index[keyWithAreaId] = record.TIME_VALUE;
    }
  });
  
  return index;
}

/**
 * 匹配时效值
 */
function matchTimelinessValue(brandCode, carrierId, cityName, areaId, index) {
  if (!index || Object.keys(index).length === 0) {
    return null;
  }
  
  // 先尝试城市名称匹配
  if (cityName) {
    const key = `${brandCode}|${carrierId}|${cityName}`;
    if (index[key]) {
      return index[key];
    }
  }
  
  // 再尝试区域ID匹配
  if (areaId) {
    const key = `${brandCode}|${carrierId}|${areaId}`;
    if (index[key]) {
      return index[key];
    }
  }
  
  return null;
}

/**
 * 返回空分析结果
 */
function getEmptyAnalysisResult() {
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
    matchingStats: {
      totalOrders: 0,
      matchedOrders: 0,
      unmatchedOrders: 0,
      matchRate: 0
    }
  };
}

module.exports = {
  analyzeTimelinessPerformance
};
