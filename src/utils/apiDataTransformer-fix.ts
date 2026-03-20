import type { FilteredData } from './dataFilterExtended';

/**
 * 🔥 修复总单量同比环比显示问题的核心函数
 * 
 * 主要问题发现：
 * 1. 后端已经正确计算了同比环比数据并返回了momGrowthRates和yoyGrowthRates
 * 2. 后端返回的historicalData包含了lastMonth和lastYear的totalOrders数据
 * 3. 前端的transformAPIDataToFilteredData函数没有正确处理这些数据
 */

/**
 * 🔥 核心修复函数：将API数据转换为前端FilteredData格式
 * 
 * @param apiData 后端API返回的数据
 * @param selectedBrand 当前选中的品牌
 * @param selectedPlatform 当前选中的平台
 * @returns 转换后的前端数据格式
 */
export function transformAPIDataToFilteredData(
  apiData: any,
  selectedBrand: string | null = null,
  selectedPlatform: string | null = null
): FilteredData {
  
  console.log('🔧 [transformAPIDataToFilteredData] 开始转换API数据');
  console.log('🔧 [API Data] KPI:', apiData?.data?.kpi);
  console.log('🔧 [API Data] historicalData:', apiData?.data?.historicalData);
  
  if (!apiData || !apiData.success || !apiData.data) {
    console.warn('🚨 [transformAPIDataToFilteredData] API数据无效，返回null数据结构');
    return createNullFilteredData();
  }

  const kpiData = apiData.data.kpi;
  const historicalData = apiData.data.historicalData;
  const brandDistribution = apiData.data.brandDistribution || [];
  const platformDistribution = apiData.data.platformDistribution || [];
  const courierDistribution = apiData.data.courierDistribution || [];

  // 🔥 核心修复：正确计算总单量的同比环比
  const totalOrdersChange = calculateTotalOrdersGrowth(kpiData, historicalData);
  
  console.log('🔥 [总单量同比环比修复] 计算结果:', totalOrdersChange);
  console.log('🔧 [KPI Data] 各状态订单数据:', {
    pickedOrders: kpiData?.pickedOrders,
    shippedOrders: kpiData?.shippedOrders,
    deliveredOrders: kpiData?.deliveredOrders,
    forwardedOrders: kpiData?.forwardedOrders,
    returnedOrders: kpiData?.returnedOrders,
    cancelledOrders: kpiData?.cancelledOrders,
    firstDispatchSuccessRate: kpiData?.firstDispatchSuccessRate,
    avgFirstDispatchHours: kpiData?.avgFirstDispatchHours,
    avgDeliveryHours: kpiData?.avgDeliveryHours
  });

  // 构建KPI数据数组 - 🔥 移除总单量，总单量将在独立概览卡片中显示
  const filteredKpiData = [
    // 已揽收
    {
      label: '已揽收',
      value: kpiData?.pickedOrders ? kpiData.pickedOrders.toLocaleString() : 'null',
      change: calculateStatusGrowth(kpiData?.pickedOrders, historicalData, 'picked'),
      icon: '📦',
      color: 'green',
      statusCode: 55,
      details: { status: kpiData?.pickedOrders ? '正常' : '暂无数据' }
    },
    // 已发运
    {
      label: '已发运',
      value: kpiData?.shippedOrders ? kpiData.shippedOrders.toLocaleString() : 'null',
      change: calculateStatusGrowth(kpiData?.shippedOrders, historicalData, 'shipped'),
      icon: '🚚',
      color: 'blue',
      statusCode: 70,
      details: { status: kpiData?.shippedOrders ? '正常' : '暂无数据' }
    },
    // 已签收
    {
      label: '已签收',
      value: kpiData?.deliveredOrders ? kpiData.deliveredOrders.toLocaleString() : 'null',
      change: calculateStatusGrowth(kpiData?.deliveredOrders, historicalData, 'delivered'),
      icon: '✅',
      color: 'green',
      statusCode: 95,
      details: { status: kpiData?.deliveredOrders ? '正常' : '暂无数据' }
    },
    // 已转寄
    {
      label: '已转寄',
      value: kpiData?.forwardedOrders ? kpiData.forwardedOrders.toLocaleString() : 'null',
      change: calculateStatusGrowth(kpiData?.forwardedOrders, historicalData, 'forwarded'),
      icon: '🔄',
      color: 'orange',
      statusCode: 40,
      details: { status: kpiData?.forwardedOrders ? '正常' : '暂无数据' }
    },
    // 已退回
    {
      label: '已退回',
      value: kpiData?.returnedOrders ? kpiData.returnedOrders.toLocaleString() : 'null',
      change: calculateStatusGrowth(kpiData?.returnedOrders, historicalData, 'returned'),
      icon: '↩️',
      color: 'yellow',
      statusCode: 100,
      details: { status: kpiData?.returnedOrders ? '正常' : '暂无数据' }
    },
    // 已取消
    {
      label: '已取消',
      value: kpiData?.cancelledOrders ? kpiData.cancelledOrders.toLocaleString() : 'null',
      change: calculateStatusGrowth(kpiData?.cancelledOrders, historicalData, 'cancelled'),
      icon: '❌',
      color: 'red',
      statusCode: 90,
      details: { status: kpiData?.cancelledOrders ? '正常' : '暂无数据' }
    },
    // 首派成功率
    {
      label: '首派成功率',
      value: kpiData?.firstDispatchSuccessRate ? `${kpiData.firstDispatchSuccessRate.toFixed(1)}%` : 'null',
      change: calculatePerformanceGrowth(kpiData?.firstDispatchSuccessRate, historicalData, 'firstDispatchSuccessRate'),
      icon: '🎯',
      color: 'purple',
      details: { status: kpiData?.firstDispatchSuccessRate ? '正常' : '暂无数据' }
    },
    // 平均首派时长
    {
      label: '平均首派时长',
      value: kpiData?.avgFirstDispatchHours ? `${kpiData.avgFirstDispatchHours.toFixed(1)}小时` : 'null',
      change: calculatePerformanceGrowth(kpiData?.avgFirstDispatchHours, historicalData, 'avgFirstDispatchHours'),
      icon: '⏱️',
      color: 'blue',
      details: { status: kpiData?.avgFirstDispatchHours ? '正常' : '暂无数据' }
    },
    // 平均签收时长
    {
      label: '平均签收时长',
      value: kpiData?.avgDeliveryHours ? `${(kpiData.avgDeliveryHours / 24).toFixed(1)}天` : 'null',
      change: calculatePerformanceGrowth(kpiData?.avgDeliveryHours, historicalData, 'avgDeliveryHours'),
      icon: '📅',
      color: 'green',
      details: { status: kpiData?.avgDeliveryHours ? '正常' : '暂无数据' }
    }
  ];

  return {
    kpiData: filteredKpiData,
    courierData: transformCourierData(courierDistribution),
    interceptionData: [],
    brandStats: {
      totalOrders: kpiData?.totalOrders || null,
      marketShare: null,
      growth: totalOrdersChange.mom,
      // 🔥 新增：保存同比环比完整数据用于总单量概览卡片
      totalOrdersGrowth: totalOrdersChange
    },
    regionalData: [],
    monthlyTrend: [],
    topDestinations: [],
    exceptions: [],
    crossAnalysisData: apiData.data.crossAnalysisData || []
  };
}

/**
 * 🔥 核心修复：计算总单量的同比环比增长率
 */
function calculateTotalOrdersGrowth(kpiData: any, historicalData: any): { mom: number | null; yoy: number | null } {
  if (!kpiData?.totalOrders || !historicalData) {
    console.log('🚨 [calculateTotalOrdersGrowth] 缺少数据，无法计算增长率');
    return { mom: null, yoy: null };
  }

  const current = kpiData.totalOrders;
  const lastMonth = historicalData.lastMonth?.totalOrders || 0;
  const lastYear = historicalData.lastYear?.totalOrders || 0;

  console.log('🔢 [计算总单量增长率] 当前:', current, '上月:', lastMonth, '去年:', lastYear);

  const mom = lastMonth > 0 ? ((current - lastMonth) / lastMonth * 100) : null;
  const yoy = lastYear > 0 ? ((current - lastYear) / lastYear * 100) : null;

  const result = {
    mom: mom !== null ? Math.round(mom * 100) / 100 : null,
    yoy: yoy !== null ? Math.round(yoy * 100) / 100 : null
  };

  console.log('✅ [总单量增长率计算结果]', result);
  return result;
}

/**
 * 🔥 修复：计算状态相关订单的同比环比增长率
 * 
 * 现在使用后端API返回的真实历史数据来计算各状态订单的同比环比
 */
function calculateStatusGrowth(currentValue: number | undefined | null, historicalData: any, statusType: string): { mom: number | null; yoy: number | null } {
  if (!currentValue || !historicalData) {
    console.log(`📊 [calculateStatusGrowth] ${statusType} - 缺少当前值或历史数据`);
    return { mom: null, yoy: null };
  }

  // 🔥 根据状态类型获取对应的历史数据
  let lastMonthValue = null;
  let lastYearValue = null;

  switch (statusType) {
    case 'forwarded': // 已转寄
      lastMonthValue = historicalData.lastMonth?.forwardedOrders || 0;
      lastYearValue = historicalData.lastYear?.forwardedOrders || 0;
      break;
    case 'returned': // 已退回  
      lastMonthValue = historicalData.lastMonth?.returnedOrders || 0;
      lastYearValue = historicalData.lastYear?.returnedOrders || 0;
      break;
    case 'cancelled': // 已取消
      lastMonthValue = historicalData.lastMonth?.cancelledOrders || 0;
      lastYearValue = historicalData.lastYear?.cancelledOrders || 0;
      break;
    default:
      // 已揽收、已发运、已签收不显示同比环比（根据EnhancedKPICard的shouldShowGrowthData逻辑）
      console.log(`📊 [calculateStatusGrowth] ${statusType} - 不支持同比环比计算`);
      return { mom: null, yoy: null };
  }

  // 计算增长率的辅助函数
  const calculateGrowthRate = (current: number, previous: number): number | null => {
    if (!previous || previous === 0) return null;
    return Math.round(((current - previous) / previous * 100) * 100) / 100;
  };

  const mom = calculateGrowthRate(currentValue, lastMonthValue);
  const yoy = calculateGrowthRate(currentValue, lastYearValue);

  console.log(`📊 [calculateStatusGrowth] ${statusType} 增长率计算:`, {
    current: currentValue,
    lastMonth: lastMonthValue,
    lastYear: lastYearValue,
    mom,
    yoy
  });

  return { mom, yoy };
}

/**
 * 🔥 新增：计算效率指标的同比环比增长率
 * 
 * 处理首派成功率、平均首派时长、平均签收时长等效率指标的同比环比计算
 */
function calculatePerformanceGrowth(currentValue: number | undefined | null, historicalData: any, metricType: string): { mom: number | null; yoy: number | null } {
  if (!currentValue || !historicalData) {
    console.log(`📈 [calculatePerformanceGrowth] ${metricType} - 缺少当前值或历史数据`);
    return { mom: null, yoy: null };
  }

  // 🔥 根据指标类型获取对应的历史数据
  let lastMonthValue = null;
  let lastYearValue = null;

  switch (metricType) {
    case 'firstDispatchSuccessRate': // 首派成功率
      lastMonthValue = historicalData.lastMonth?.performanceMetrics?.firstDispatchSuccessRate || 0;
      lastYearValue = historicalData.lastYear?.performanceMetrics?.firstDispatchSuccessRate || 0;
      break;
    case 'avgFirstDispatchHours': // 平均首派时长
      lastMonthValue = historicalData.lastMonth?.performanceMetrics?.avgFirstDispatchHours || 0;
      lastYearValue = historicalData.lastYear?.performanceMetrics?.avgFirstDispatchHours || 0;
      break;
    case 'avgDeliveryHours': // 平均签收时长
      lastMonthValue = historicalData.lastMonth?.performanceMetrics?.avgDeliveryHours || 0;
      lastYearValue = historicalData.lastYear?.performanceMetrics?.avgDeliveryHours || 0;
      break;
    default:
      console.log(`📈 [calculatePerformanceGrowth] ${metricType} - 不支持的指标类型`);
      return { mom: null, yoy: null };
  }

  // 计算增长率的辅助函数
  const calculateGrowthRate = (current: number, previous: number): number | null => {
    if (!previous || previous === 0) return null;
    return Math.round(((current - previous) / previous * 100) * 100) / 100;
  };

  const mom = calculateGrowthRate(currentValue, lastMonthValue);
  const yoy = calculateGrowthRate(currentValue, lastYearValue);

  console.log(`📈 [calculatePerformanceGrowth] ${metricType} 增长率计算:`, {
    current: currentValue,
    lastMonth: lastMonthValue,
    lastYear: lastYearValue,
    mom,
    yoy
  });

  return { mom, yoy };
}

/**
 * 转换快递商数据
 */
function transformCourierData(courierDistribution: any[]): any[] {
  if (!Array.isArray(courierDistribution) || courierDistribution.length === 0) {
    return [
      {
        name: '暂无快递商数据',
        deliveryRate: null,
        pickupRate: null,
        shippingRate: null,
        orderCount: null,
        percentage: null,
        exceptions: {
          notPickedOver2h: null,
          notShippedOver12h: null,
          notUpdatedOver48h: null,
          notDeliveredOver3days: null
        }
      }
    ];
  }

  return courierDistribution.map(courier => ({
    name: courier.carrierId || '未知快递商',
    deliveryRate: courier.deliveryRate || null,
    pickupRate: null,
    shippingRate: null,
    orderCount: courier.orderCount || null,
    percentage: courier.percentage || null,
    exceptions: {
      notPickedOver2h: null,
      notShippedOver12h: null,
      notUpdatedOver48h: null,
      notDeliveredOver3days: null
    }
  }));
}

/**
 * 创建null数据结构 - 🔥 移除总单量，总单量将在独立概览卡片中显示
 */
function createNullFilteredData(): FilteredData {
  return {
    kpiData: [
      {
        label: '已揽收',
        value: 'null',
        change: { mom: null, yoy: null },
        icon: '📦',
        color: 'green',
        statusCode: 55,
        details: { status: '暂无数据' }
      },
      {
        label: '已发运',
        value: 'null',
        change: { mom: null, yoy: null },
        icon: '🚚',
        color: 'blue',
        statusCode: 70,
        details: { status: '暂无数据' }
      },
      {
        label: '已签收',
        value: 'null',
        change: { mom: null, yoy: null },
        icon: '✅',
        color: 'green',
        statusCode: 95,
        details: { status: '暂无数据' }
      },
      {
        label: '已转寄',
        value: 'null',
        change: { mom: null, yoy: null },
        icon: '🔄',
        color: 'orange',
        statusCode: 40,
        details: { status: '暂无数据' }
      },
      {
        label: '已退回',
        value: 'null',
        change: { mom: null, yoy: null },
        icon: '↩️',
        color: 'yellow',
        statusCode: 100,
        details: { status: '暂无数据' }
      },
      {
        label: '已取消',
        value: 'null',
        change: { mom: null, yoy: null },
        icon: '❌',
        color: 'red',
        statusCode: 90,
        details: { status: '暂无数据' }
      },
      {
        label: '首派成功率',
        value: 'null',
        change: { mom: null, yoy: null },
        icon: '🎯',
        color: 'purple',
        details: { status: '暂无数据' }
      },
      {
        label: '平均首派时长',
        value: 'null',
        change: { mom: null, yoy: null },
        icon: '⏱️',
        color: 'blue',
        details: { status: '暂无数据' }
      },
      {
        label: '平均签收时长',
        value: 'null',
        change: { mom: null, yoy: null },
        icon: '📅',
        color: 'green',
        details: { status: '暂无数据' }
      }
    ],
    courierData: [],
    interceptionData: [],
    brandStats: { 
      totalOrders: null, 
      marketShare: null, 
      growth: null,
      totalOrdersGrowth: { mom: null, yoy: null }
    },
    regionalData: [],
    monthlyTrend: [],
    topDestinations: [],
    exceptions: [],
    crossAnalysisData: []
  };
}

/**
 * 格式化增长率显示
 */
export function formatGrowthRate(growthRate: number | null): string {
  if (growthRate === null || growthRate === undefined) {
    return 'null';
  }
  
  const formattedRate = Math.abs(growthRate).toFixed(1);
  const sign = growthRate >= 0 ? '+' : '-';
  return `${sign}${formattedRate}%`;
}

/**
 * 分析增长趋势
 */
export function analyzeGrowthTrend(momGrowth: number | null, yoyGrowth: number | null): string {
  if (momGrowth === null && yoyGrowth === null) {
    return '暂无趋势数据';
  }
  
  if (momGrowth !== null && yoyGrowth !== null) {
    if (momGrowth > 0 && yoyGrowth > 0) {
      return '持续增长趋势';
    } else if (momGrowth < 0 && yoyGrowth < 0) {
      return '持续下降趋势';
    } else if (momGrowth > 0 && yoyGrowth < 0) {
      return '短期回升';
    } else if (momGrowth < 0 && yoyGrowth > 0) {
      return '短期回调';
    } else {
      return '趋势稳定';
    }
  }
  
  if (momGrowth !== null) {
    return momGrowth > 0 ? '环比增长' : '环比下降';
  }
  
  if (yoyGrowth !== null) {
    return yoyGrowth > 0 ? '同比增长' : '同比下降';
  }
  
  return '趋势不明';
}

/**
 * 验证API数据格式
 */
export function validateAPIData(apiData: any): boolean {
  if (!apiData || typeof apiData !== 'object') {
    console.warn('[validateAPIData] API数据为空或不是对象');
    return false;
  }

  if (!apiData.success) {
    console.warn('[validateAPIData] API响应success为false');
    return false;
  }

  if (!apiData.data) {
    console.warn('[validateAPIData] API响应data为空');
    return false;
  }

  if (!apiData.data.kpi) {
    console.warn('[validateAPIData] API响应缺少kpi数据');
    return false;
  }

  if (!Array.isArray(apiData.data.brandDistribution)) {
    console.warn('[validateAPIData] API响应缺少brandDistribution数据');
    return false;
  }

  if (!Array.isArray(apiData.data.platformDistribution)) {
    console.warn('[validateAPIData] API响应缺少platformDistribution数据');
    return false;
  }

  console.log('[validateAPIData] API数据验证通过');
  return true;
}

console.log('✅ [apiDataTransformer-fix] 总单量同比环比修复模块已加载');