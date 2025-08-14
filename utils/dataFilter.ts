import { orderKPIData } from '../data/orderData';
import { brandOrderData } from '../data/brandData';
import { platformsData } from '../data/platformData';

export interface FilteredData {
  kpiData: Array<{
    label: string;
    value: string;
    change: { mom: number; yoy: number };
    icon: string;
    color: string;
    details?: {
      brands?: { name: string; value: number; percentage: number }[];
      exceptions?: { type: string; count: number; threshold: string }[];
      status?: string;
    };
  }>;
  courierData: Array<{
    name: string;
    deliveryRate: number;
    pickupRate: number;
    shippingRate: number;
    exceptions: {
      notPickedOver2h: number;
      notShippedOver12h: number;
      notUpdatedOver48h: number;
      notDeliveredOver3days: number;
    };
  }>;
  interceptionData: Array<{
    type: string;
    successRate: number;
    count: number;
    trend: number;
  }>;
  brandStats: {
    totalOrders: number;
    marketShare: number;
    growth: number;
  };
  regionalData: Array<{
    region: string;
    orders: number;
    percentage: number;
    growth: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    orders: number;
    growth: number;
  }>;
  topDestinations: Array<{
    city: string;
    orders: number;
    percentage: number;
  }>;
  exceptions: Array<{
    type: string;
    count: number;
    trend: number;
    description: string;
  }>;
}

// 新的综合筛选函数
export function filterData(brandName: string = '', platformName: string = ''): FilteredData {
  const baseData = filterDataByBrand(brandName);
  
  if (!platformName) {
    return baseData;
  }

  // 获取平台信息
  const platformInfo = platformsData.find(p => p.name === platformName);
  if (!platformInfo) {
    return baseData;
  }

  // 根据平台市场份额调整数据
  const platformRatio = platformInfo.marketShare / 100;
  
  // 调整KPI数据
  const adjustedKPIData = baseData.kpiData.map(kpi => {
    const baseValue = kpi.value.includes('小时') || kpi.value.includes('天') ? 
      kpi.value : // 时长类型保持原值
      parseInt(kpi.value.replace(/,/g, ''));
    
    let adjustedValue;
    if (kpi.value.includes('小时') || kpi.value.includes('天')) {
      // 时长类型：根据平台调整时长
      const timeAdjustment = getPlatformTimeAdjustment(platformName, kpi.label);
      adjustedValue = kpi.value.replace(/[\d.]+/, (match) => {
        const num = parseFloat(match);
        return (num + timeAdjustment).toFixed(1);
      });
    } else if (kpi.value.includes('%')) {
      // 百分比类型保持原值
      adjustedValue = kpi.value;
    } else {
      // 数量类型：按比例调整
      adjustedValue = Math.round(baseValue * platformRatio).toLocaleString();
    }
    
    // 平台特定的变化率调整
    const platformAdjustment = getPlatformAdjustment(platformName, kpi.label);
    
    // 调整details中的异常数据
    let adjustedDetails = kpi.details;
    if (kpi.details?.exceptions) {
      adjustedDetails = {
        ...kpi.details,
        exceptions: kpi.details.exceptions.map(exception => ({
          ...exception,
          count: Math.round(exception.count * platformRatio)
        }))
      };
    }
    
    return {
      ...kpi,
      value: adjustedValue,
      change: {
        mom: kpi.change.mom + platformAdjustment.mom,
        yoy: kpi.change.yoy + platformAdjustment.yoy
      },
      details: adjustedDetails
    };
  });

  // 调整订单总数
  const adjustedTotalOrders = Math.round(baseData.brandStats.totalOrders * platformRatio);

  // 调整区域数据
  const adjustedRegionalData = baseData.regionalData.map(region => ({
    ...region,
    orders: Math.round(region.orders * platformRatio),
    growth: region.growth + getPlatformRegionalAdjustment(platformName, region.region)
  }));

  // 调整月度趋势
  const adjustedMonthlyTrend = baseData.monthlyTrend.map(month => ({
    ...month,
    orders: Math.round(month.orders * platformRatio),
    growth: month.growth + getPlatformMonthlyAdjustment(platformName)
  }));

  // 调整目的地数据
  const adjustedTopDestinations = baseData.topDestinations.map(dest => ({
    ...dest,
    orders: Math.round(dest.orders * platformRatio)
  }));

  // 调整异常数据
  const adjustedExceptions = baseData.exceptions.map(exception => ({
    ...exception,
    count: Math.round(exception.count * platformRatio),
    trend: exception.trend + getPlatformExceptionAdjustment(platformName)
  }));

  // 调整快递公司数据
  const adjustedCourierData = baseData.courierData.map(courier => ({
    ...courier,
    deliveryRate: courier.deliveryRate + getPlatformCourierAdjustment(platformName, courier.name),
    pickupRate: courier.pickupRate + getPlatformCourierAdjustment(platformName, courier.name),
    shippingRate: courier.shippingRate + getPlatformCourierAdjustment(platformName, courier.name),
    exceptions: {
      notPickedOver2h: Math.round(courier.exceptions.notPickedOver2h * platformRatio),
      notShippedOver12h: Math.round(courier.exceptions.notShippedOver12h * platformRatio),
      notUpdatedOver48h: Math.round(courier.exceptions.notUpdatedOver48h * platformRatio),
      notDeliveredOver3days: Math.round(courier.exceptions.notDeliveredOver3days * platformRatio)
    }
  }));

  return {
    ...baseData,
    kpiData: adjustedKPIData,
    courierData: adjustedCourierData,
    brandStats: {
      ...baseData.brandStats,
      totalOrders: adjustedTotalOrders,
      marketShare: brandName ? baseData.brandStats.marketShare * platformRatio : platformInfo.marketShare,
      growth: baseData.brandStats.growth + getPlatformGrowthAdjustment(platformName)
    },
    regionalData: adjustedRegionalData,
    monthlyTrend: adjustedMonthlyTrend,
    topDestinations: adjustedTopDestinations,
    exceptions: adjustedExceptions,
    interceptionData: baseData.interceptionData.map(item => ({
      ...item,
      count: Math.round(item.count * platformRatio),
      trend: item.trend + getPlatformInterceptionAdjustment(platformName)
    }))
  };
}

// 平台特定的时长调整
function getPlatformTimeAdjustment(platformName: string, kpiLabel: string) {
  const adjustments = {
    'tmall': { '平均首派时长': -0.3, '平均签收时长': -0.2 },
    'jd': { '平均首派时长': -0.5, '平均签收时长': -0.4 },
    'douyin': { '平均首派时长': 0.8, '平均签收时长': 0.6 },
    'vipshop': { '平均首派时长': -0.1, '平均签收时长': -0.1 }
  };
  
  return adjustments[platformName]?.[kpiLabel] || 0;
}

// 平台特定的KPI调整
function getPlatformAdjustment(platformName: string, kpiLabel: string) {
  const adjustments = {
    'tmall': { mom: 2.1, yoy: 5.3 },
    'jd': { mom: 1.8, yoy: 4.2 },
    'douyin': { mom: 8.5, yoy: 25.7 },
    'vipshop': { mom: -0.5, yoy: 1.8 }
  };
  
  return adjustments[platformName] || { mom: 0, yoy: 0 };
}

// 平台特定的区域调整
function getPlatformRegionalAdjustment(platformName: string, region: string) {
  const adjustments = {
    'tmall': { '华东': 3.2, '华南': 2.1, '华北': 2.8, '西南': 1.5, '其他': 0.8 },
    'jd': { '华东': 2.8, '华南': 1.9, '华北': 4.2, '西南': 2.1, '其他': 1.2 },
    'douyin': { '华东': 12.5, '华南': 18.3, '华北': 8.7, '西南': 15.2, '其他': 22.1 },
    'vipshop': { '华东': 0.5, '华南': 1.2, '华北': -0.3, '西南': 0.8, '其他': 0.2 }
  };
  
  return adjustments[platformName]?.[region] || 0;
}

// 平台特定的月度调整
function getPlatformMonthlyAdjustment(platformName: string) {
  const adjustments = {
    'tmall': 2.5,
    'jd': 1.8,
    'douyin': 15.2,
    'vipshop': 0.3
  };
  
  return adjustments[platformName] || 0;
}

// 平台特定的异常调整
function getPlatformExceptionAdjustment(platformName: string) {
  const adjustments = {
    'tmall': -2.1,
    'jd': -1.5,
    'douyin': 3.2,
    'vipshop': -0.8
  };
  
  return adjustments[platformName] || 0;
}

// 平台特定的快递公司调整
function getPlatformCourierAdjustment(platformName: string, courierName: string) {
  const adjustments = {
    'tmall': { '中通': 0.8, '顺丰': 0.5 },
    'jd': { '中通': 0.5, '顺丰': 1.2 },
    'douyin': { '中通': -1.2, '顺丰': -0.8 },
    'vipshop': { '中通': 0.3, '顺丰': 0.8 }
  };
  
  return adjustments[platformName]?.[courierName] || 0;
}

// 平台特定的增长率调整
function getPlatformGrowthAdjustment(platformName: string) {
  const adjustments = {
    'tmall': 2.1,
    'jd': 1.5,
    'douyin': 18.7,
    'vipshop': 0.8
  };
  
  return adjustments[platformName] || 0;
}

// 平台特定的拦截调整
function getPlatformInterceptionAdjustment(platformName: string) {
  const adjustments = {
    'tmall': 1.2,
    'jd': 0.8,
    'douyin': -2.1,
    'vipshop': 0.5
  };
  
  return adjustments[platformName] || 0;
}

// 保持向后兼容的函数
export function filterDataByBrand(brandName: string): FilteredData {
  if (!brandName) {
    // 返回全部数据的聚合视图 - 直接使用orderKPIData，保留完整的details
    return {
      kpiData: orderKPIData.map(kpi => ({
        label: kpi.label,
        value: kpi.value,
        change: kpi.change,
        icon: kpi.icon,
        color: kpi.label === '已揽收' ? 'green' :
               kpi.label === '已发运' ? 'blue' :
               kpi.label === '已签收' ? 'green' :
               kpi.label === '已转寄' ? 'orange' :
               kpi.label === '已退回' ? 'yellow' :
               kpi.label === '已取消' ? 'red' :
               kpi.label === '首派成功率' ? 'purple' :
               kpi.label === '平均首派时长' ? 'blue' :
               kpi.label === '平均签收时长' ? 'green' : 'blue',
        details: kpi.details // 保留完整的details数据
      })),
      courierData: [
        {
          name: '中通',
          deliveryRate: 97.2,
          pickupRate: 96.5,
          shippingRate: 97.8,
          exceptions: {
            notPickedOver2h: 89,
            notShippedOver12h: 132,
            notUpdatedOver48h: 118,
            notDeliveredOver3days: 98
          }
        },
        {
          name: '顺丰',
          deliveryRate: 98.7,
          pickupRate: 98.9,
          shippingRate: 99.1,
          exceptions: {
            notPickedOver2h: 32,
            notShippedOver12h: 47,
            notUpdatedOver48h: 67,
            notDeliveredOver3days: 28
          }
        }
      ],
      interceptionData: [
        { type: 'warehouse_internal', successRate: 87.5, count: 12589, trend: 2.3 },
        { type: 'warehouse_external', successRate: 72.8, count: 8934, trend: -1.8 }
      ],
      brandStats: {
        totalOrders: 2665585,
        marketShare: 100,
        growth: 12.5
      },
      regionalData: [
        { region: '华东', orders: 799675, percentage: 30.0, growth: 16.8 },
        { region: '华南', orders: 666396, percentage: 25.0, growth: 12.4 },
        { region: '华北', orders: 533117, percentage: 20.0, growth: 18.9 },
        { region: '西南', orders: 399838, percentage: 15.0, growth: 8.7 },
        { region: '其他', orders: 266559, percentage: 10.0, growth: 5.3 }
      ],
      monthlyTrend: [
        { month: '1月', orders: 206632, growth: 12.5 },
        { month: '2月', orders: 193798, growth: 16.8 },
        { month: '3月', orders: 230282, growth: 19.3 },
        { month: '4月', orders: 245697, growth: 22.1 },
        { month: '5月', orders: 262930, growth: 25.7 },
        { month: '6月', orders: 250731, growth: 23.4 }
      ],
      topDestinations: [
        { city: '上海', orders: 213247, percentage: 8.0 },
        { city: '北京', orders: 186591, percentage: 7.0 },
        { city: '深圳', orders: 159936, percentage: 6.0 },
        { city: '广州', orders: 133279, percentage: 5.0 },
        { city: '杭州', orders: 106623, percentage: 4.0 }
      ],
      exceptions: [
        { type: '超时未揽收', count: 89, trend: -18.2, description: '已出库超过2小时未揽收' },
        { type: '超时未发运', count: 132, trend: -12.5, description: '揽收后超过12小时未发运' },
        { type: '超时未签收', count: 98, trend: -15.7, description: '发运后超过3天未签收' }
      ]
    };
  }

  // 根据品牌名称筛选数据
  const brandData = brandOrderData.find(brand => brand.name === brandName);
  
  if (!brandData) {
    // 如果找不到品牌数据，返回默认数据
    return filterDataByBrand('');
  }

  // 计算市场份额 (基于总订单量2,665,585)
  const totalMarketOrders = 2665585;
  const marketShare = (brandData.totalOrders / totalMarketOrders * 100);

  // 从orderKPIData获取原始details数据，并根据品牌调整数值
  const brandKPIData = orderKPIData.map(originalKPI => {
    let adjustedDetails = originalKPI.details;
    
    // 如果有品牌分布数据，按品牌市场份额调整
    if (originalKPI.details?.brands) {
      const brandInfo = originalKPI.details.brands.find(b => b.name === brandName);
      if (brandInfo) {
        // 调整品牌分布数据，只显示当前品牌的数据
        adjustedDetails = {
          ...originalKPI.details,
          brands: [{
            name: brandName,
            value: brandInfo.value,
            percentage: 100 // 单品牌显示为100%
          }]
        };
      }
    }
    
    // 根据品牌调整异常数据
    if (originalKPI.details?.exceptions) {
      adjustedDetails = {
        ...adjustedDetails,
        exceptions: originalKPI.details.exceptions.map(exception => ({
          ...exception,
          count: Math.round(exception.count * marketShare / 100)
        }))
      };
    }

    // 获取品牌特定的数值
    let brandValue: string;
    switch (originalKPI.label) {
      case '已揽收':
        brandValue = brandData.kpiData.picked.value.toLocaleString();
        break;
      case '已发运':
        brandValue = brandData.kpiData.shipped.value.toLocaleString();
        break;
      case '已签收':
        brandValue = brandData.kpiData.delivered.value.toLocaleString();
        break;
      case '已转寄':
        brandValue = brandData.kpiData.forwarded.value.toLocaleString();
        break;
      case '已退回':
        brandValue = brandData.kpiData.returned.value.toLocaleString();
        break;
      case '已取消':
        brandValue = brandData.kpiData.cancelled.value.toLocaleString();
        break;
      case '首派成功率':
        brandValue = '94.2%';
        break;
      case '平均首派时长':
        brandValue = getBrandAverageFirstDispatchTime(brandName);
        break;
      case '平均签收时长':
        brandValue = getBrandAverageDeliveryTime(brandName);
        break;
      default:
        brandValue = originalKPI.value;
    }

    // 获取品牌特定的变化率
    let brandChange = originalKPI.change;
    switch (originalKPI.label) {
      case '已揽收':
        brandChange = brandData.kpiData.picked.change;
        break;
      case '已发运':
        brandChange = brandData.kpiData.shipped.change;
        break;
      case '已签收':
        brandChange = brandData.kpiData.delivered.change;
        break;
      case '已转寄':
        brandChange = brandData.kpiData.forwarded.change;
        break;
      case '已退回':
        brandChange = brandData.kpiData.returned.change;
        break;
      case '已取消':
        brandChange = brandData.kpiData.cancelled.change;
        break;
      case '平均首派时长':
        brandChange = getBrandTimeChange(brandName, 'firstDispatch');
        break;
      case '平均签收时长':
        brandChange = getBrandTimeChange(brandName, 'delivery');
        break;
    }

    return {
      label: originalKPI.label,
      value: brandValue,
      change: brandChange,
      icon: originalKPI.icon,
      color: originalKPI.label === '已揽收' ? 'green' :
             originalKPI.label === '已发运' ? 'blue' :
             originalKPI.label === '已签收' ? 'green' :
             originalKPI.label === '已转寄' ? 'orange' :
             originalKPI.label === '已退回' ? 'yellow' :
             originalKPI.label === '已取消' ? 'red' :
             originalKPI.label === '首派成功率' ? 'purple' :
             originalKPI.label === '平均首派时长' ? 'blue' :
             originalKPI.label === '平均签收时长' ? 'green' : 'blue',
      details: adjustedDetails // 保留调整后的details数据
    };
  });

  return {
    kpiData: brandKPIData,
    courierData: brandData.courierDistribution.map(courier => ({
      name: courier.name,
      deliveryRate: courier.performance.deliveryRate,
      pickupRate: courier.performance.pickupRate,
      shippingRate: courier.performance.shippingRate,
      exceptions: {
        notPickedOver2h: Math.round(courier.performance.exceptions * 0.4),
        notShippedOver12h: Math.round(courier.performance.exceptions * 0.6),
        notUpdatedOver48h: Math.round(courier.performance.exceptions * 0.5),
        notDeliveredOver3days: Math.round(courier.performance.exceptions * 0.3)
      }
    })),
    interceptionData: [
      { type: 'warehouse_internal', successRate: 87.5, count: Math.round(brandData.totalOrders * 0.05), trend: 2.3 },
      { type: 'warehouse_external', successRate: 72.8, count: Math.round(brandData.totalOrders * 0.03), trend: -1.8 }
    ],
    brandStats: {
      totalOrders: brandData.totalOrders,
      marketShare: Math.round(marketShare * 10) / 10,
      growth: brandData.monthlyTrend[brandData.monthlyTrend.length - 1]?.growth || 0
    },
    regionalData: brandData.regionalDistribution,
    monthlyTrend: brandData.monthlyTrend,
    topDestinations: brandData.topDestinations,
    exceptions: brandData.exceptions
  };
}

// 获取品牌特定的平均首派时长
function getBrandAverageFirstDispatchTime(brandName: string): string {
  const brandTimes = {
    'TNF': '16.8小时',
    'DICKIES': '19.2小时',
    'VANS': '17.5小时',
    'TIMBERLAND': '20.1小时',
    'ICEBREAKER': '18.9小时',
    'KIPLING': '17.8小时'
  };
  return brandTimes[brandName] || '18.5小时';
}

// 获取品牌特定的平均签收时长
function getBrandAverageDeliveryTime(brandName: string): string {
  const brandTimes = {
    'TNF': '2.1天',
    'DICKIES': '2.5天',
    'VANS': '2.2天',
    'TIMBERLAND': '2.6天',
    'ICEBREAKER': '2.4天',
    'KIPLING': '2.3天'
  };
  return brandTimes[brandName] || '2.3天';
}

// 获取品牌特定的时长变化率
function getBrandTimeChange(brandName: string, type: 'firstDispatch' | 'delivery') {
  const brandChanges = {
    'TNF': { 
      firstDispatch: { mom: -3.2, yoy: -7.8 },
      delivery: { mom: -2.8, yoy: -6.2 }
    },
    'DICKIES': { 
      firstDispatch: { mom: -1.5, yoy: -4.1 },
      delivery: { mom: -1.2, yoy: -3.5 }
    },
    'VANS': { 
      firstDispatch: { mom: -2.8, yoy: -6.5 },
      delivery: { mom: -2.1, yoy: -4.8 }
    },
    'TIMBERLAND': { 
      firstDispatch: { mom: -1.2, yoy: -3.8 },
      delivery: { mom: -0.9, yoy: -2.9 }
    },
    'ICEBREAKER': { 
      firstDispatch: { mom: -2.1, yoy: -5.2 },
      delivery: { mom: -1.8, yoy: -4.1 }
    },
    'KIPLING': { 
      firstDispatch: { mom: -2.5, yoy: -5.9 },
      delivery: { mom: -2.0, yoy: -4.5 }
    }
  };
  
  return brandChanges[brandName]?.[type] || { mom: -2.1, yoy: -5.8 };
}