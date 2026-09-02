import type { APIOverviewData } from './apiDataTransformer';

/**
 * 统一的快递商数据处理器
 * 解决总览页面和物流页面快递商数据不一致问题
 * 
 * 核心原则：
 * 1. 统一数据源：优先使用总览API的courierDistribution数据
 * 2. 统一处理逻辑：使用相同的计算方法和字段映射
 * 3. 统一格式输出：确保两个页面得到一致的数据结构
 */

// 快递商名称映射配置 - 统一CarrierID到中文名称的映射
export const COURIER_NAME_MAPPING = {
  'ZTO': '中通',
  'SF': '顺丰', 
  'JD': '京东',
  'EMS': '邮政EMS',
  'YTO': '圆通',
  'STO': '申通',
  'YUNDA': '韵达',
  'BEST': '百世',
  'ZJS': '宅急送',
  'HTKY': '百世汇通',
  'POSTB': '邮政',
  'UC': '优速',
  'DEPPON': '德邦',
  'DBKD': '德邦快递',
  'FAST': '快捷',
  'FEDEX': 'FedEx',
  'UPS': 'UPS',
  'DHL': 'DHL',
  'TNT': 'TNT'
} as const;

// 统一的快递商数据接口定义
export interface UnifiedCourierData {
  // 基础信息
  carrierId: string;
  name: string;
  
  // 订单统计
  total: number;
  orderCount: number;
  
  // 配送效率指标
  deliveryRate: number;
  pickupRate: number;
  shippingRate: number;
  avgDeliveryTime: number;
  
  // 市场占比
  percentage: number;
  
  // 异常监控
  exceptions: {
    // ✅ 新增：标准驼峰命名字段（优先使用）
    pickupTimeout?: number;        // 超时未揽收
    shippingTimeout?: number;      // 超时未发运
    noUpdate48h?: number;          // 超48h未更新
    deliveryTimeout?: number;      // 超时未签收
    // ✅ 兼容：旧字段名（向后兼容）
    notPickedOver2h: number;       // 超时未揽收（旧）
    notShippedOver12h: number;     // 超时未发运（旧）
    notUpdatedOver48h: number;     // 超48h未更新（旧）
    notDeliveredOver3days: number; // 超时未签收（旧）
  };
  
  // 数据源标识
  dataSource: 'overview' | 'logistics' | 'merged';
  
  // 调试信息
  debug?: {
    overviewData?: any;
    logisticsData?: any;
    calculationDetails?: any;
  };
}

/**
 * 获取快递商中文名称
 */
export function getCourierChineseName(carrierId: string): string {
  return COURIER_NAME_MAPPING[carrierId as keyof typeof COURIER_NAME_MAPPING] || carrierId || '未知快递商';
}

function resolveCourierDisplayName(courier: any): string {
  return String(courier?.carrierName || courier?.courierName || courier?.name || courier?.carrierId || '未知快递商');
}

/**
 * 从总览API数据中提取快递商信息
 */
function extractCouriersFromOverview(apiData: APIOverviewData): UnifiedCourierData[] {
  const couriers: UnifiedCourierData[] = [];
  
  // 优先使用courierDistribution数据
  const courierDistribution = apiData?.data?.courierDistribution;
  if (courierDistribution && Array.isArray(courierDistribution)) {
    console.log('📊 [UnifiedCourierProcessor] 使用总览API的courierDistribution数据');
    
    courierDistribution.forEach(courier => {
      const displayName = resolveCourierDisplayName(courier);
      
      // 计算效率指标
      const totalOrders = courier.orderCount || 0;
      const pickedCount = courier.pickedCount || 0;
      const shippedCount = courier.shippedCount || 0;
      const deliveredCount = courier.deliveredCount || 0;
      
      const pickupRate = totalOrders > 0 ? (pickedCount / totalOrders * 100) : 0;
      const shippingRate = totalOrders > 0 ? (shippedCount / totalOrders * 100) : 0;
      const deliveryRate = totalOrders > 0 ? (deliveredCount / totalOrders * 100) : 0;
      const avgDeliveryTime = courier.avgDeliveryTime ?? courier.avg_delivery_time ?? 0;
      
      couriers.push({
        carrierId: courier.carrierId,
        name: displayName,
        total: totalOrders,
        orderCount: totalOrders,
        deliveryRate: deliveryRate,
        pickupRate: pickupRate,
        shippingRate: shippingRate,
        avgDeliveryTime,
        percentage: courier.percentage || 0,
        exceptions: {
          notPickedOver2h: courier.exceptionCount || 0, // 暂时使用总异常数
          notShippedOver12h: 0,
          notUpdatedOver48h: 0,
          notDeliveredOver3days: 0
        },
        dataSource: 'overview',
        debug: {
          overviewData: courier,
          calculationDetails: {
            pickupRate: `${pickedCount}/${totalOrders} = ${pickupRate.toFixed(1)}%`,
            shippingRate: `${shippedCount}/${totalOrders} = ${shippingRate.toFixed(1)}%`,
            deliveryRate: `${deliveredCount}/${totalOrders} = ${deliveryRate.toFixed(1)}%`
          }
        }
      });
    });
  }
  
  return couriers;
}

/**
 * 从物流API数据中提取快递商信息
 * 🔥 修复：支持新的异常数据接口和字段映射
 */
function extractCouriersFromLogistics(logisticsData: any): UnifiedCourierData[] {
  const couriers: UnifiedCourierData[] = [];
  
  // 检查logistics数据结构
  const logisticsCouriers = logisticsData?.data || logisticsData || [];
  
  if (Array.isArray(logisticsCouriers)) {
    console.log('🚚 [UnifiedCourierProcessor] 使用物流API数据');
    
    logisticsCouriers.forEach(courier => {
      const displayName = resolveCourierDisplayName(courier);
      
      // 从物流数据中提取订单统计
      const totalOrders = courier.totalOrders || courier.orderCount || 0;
      const deliveredOrders = courier.deliveredOrders || courier.deliveredCount || 0;
      const pickedOrders = courier.pickedOrders || courier.pickedCount || 0;
      const shippedOrders = courier.shippedOrders || courier.shippedCount || 0;
      
      // 🔥 修复：计算效率指标，使用API返回的rate字段或计算得出
      const deliveryRate = courier.deliveryRate || (totalOrders > 0 ? (deliveredOrders / totalOrders * 100) : 0);
      const pickupRate = courier.pickupRate || (totalOrders > 0 ? (pickedOrders / totalOrders * 100) : 0);
      const shippingRate = courier.shippingRate || (totalOrders > 0 ? (shippedOrders / totalOrders * 100) : 0);
      const avgDeliveryTime = courier.avgDeliveryTime ?? courier.avg_delivery_time ?? 0;
      
      // 🔥 修复：支持多种异常数据字段名格式 - 使用 ?? 而非 || 避免0值被跳过
      const pickupTimeout = courier.notPickedOver2h ?? courier.pickupTimeout ?? courier.pickup_timeout ?? 0;
      const shippingTimeout = courier.notShippedOver12h ?? courier.shippingTimeout ?? courier.shipping_timeout ?? 0;
      const updateTimeout = courier.timeout48hOrders ?? courier.notUpdatedOver48h ?? courier.noUpdate48h ?? courier.no_update_48h ?? 0;
      const deliveryTimeout = courier.notDeliveredOver3days ?? courier.deliveryTimeout ?? courier.delivery_timeout ?? 0;
      
      console.log(`🔍 [UnifiedCourierProcessor] ${displayName} 异常数据提取:`, {
        原始courier对象所有字段: Object.keys(courier),
        原始数据字段: {
          pickup_timeout: courier.pickup_timeout,
          pickupTimeout: courier.pickupTimeout,
          notPickedOver2h: courier.notPickedOver2h,
          shipping_timeout: courier.shipping_timeout,
          shippingTimeout: courier.shippingTimeout,
          notShippedOver12h: courier.notShippedOver12h,
          no_update_48h: courier.no_update_48h,
          noUpdate48h: courier.noUpdate48h,
          timeout48hOrders: courier.timeout48hOrders,
          delivery_timeout: courier.delivery_timeout,
          deliveryTimeout: courier.deliveryTimeout,
          notDeliveredOver3days: courier.notDeliveredOver3days
        },
        提取结果: {
          pickupTimeout,
          shippingTimeout,
          updateTimeout,
          deliveryTimeout,
          总计: pickupTimeout + shippingTimeout + updateTimeout + deliveryTimeout
        }
      });
      
      couriers.push({
        carrierId: courier.carrierId,
        name: displayName,
        total: totalOrders,
        orderCount: totalOrders,
        deliveryRate: deliveryRate,
        pickupRate: pickupRate,
        shippingRate: shippingRate,
        avgDeliveryTime,
        percentage: 0, // 需要后续计算
        exceptions: {
          // 🔥 修复：使用标准的驼峰命名字段
          pickupTimeout: pickupTimeout,
          shippingTimeout: shippingTimeout,
          noUpdate48h: updateTimeout,
          deliveryTimeout: deliveryTimeout,
          // ✅ 兼容旧字段名
          notPickedOver2h: pickupTimeout,
          notShippedOver12h: shippingTimeout,
          notUpdatedOver48h: updateTimeout,
          notDeliveredOver3days: deliveryTimeout
        },
        dataSource: 'logistics',
        debug: {
          logisticsData: courier,
          calculationDetails: {
            deliveryRate: `${deliveredOrders}/${totalOrders} = ${deliveryRate.toFixed(1)}%`,
            pickupRate: `${pickedOrders}/${totalOrders} = ${pickupRate.toFixed(1)}%`,
            shippingRate: `${shippedOrders}/${totalOrders} = ${shippingRate.toFixed(1)}%`,
            异常数据: `揽收超时${pickupTimeout}, 发运超时${shippingTimeout}, 48h未更新${updateTimeout}, 签收超时${deliveryTimeout}`
          }
        }
      });
    });
  }
  
  return couriers;
}

/**
 * 合并总览和物流数据，优先使用总览数据的订单统计，物流数据的异常信息
 */
function mergeCourierData(
  overviewCouriers: UnifiedCourierData[], 
  logisticsCouriers: UnifiedCourierData[]
): UnifiedCourierData[] {
  const merged: UnifiedCourierData[] = [];
  
  console.log('🔀 [UnifiedCourierProcessor] 开始合并数据');
  console.log('📊 总览数据快递商数量:', overviewCouriers.length);
  console.log('🚚 物流数据快递商数量:', logisticsCouriers.length);
  
  // 以总览数据为主，补充物流数据的异常信息
  overviewCouriers.forEach(overviewCourier => {
    // 查找对应的物流数据
    const logisticsCourier = logisticsCouriers.find(lc => 
      lc.carrierId === overviewCourier.carrierId || 
      lc.name === overviewCourier.name
    );
    
    const mergedCourier: UnifiedCourierData = {
      ...overviewCourier,
      dataSource: 'merged',
      debug: {
        overviewData: overviewCourier.debug?.overviewData,
        logisticsData: logisticsCourier?.debug?.logisticsData,
        calculationDetails: {
          ...overviewCourier.debug?.calculationDetails,
          mergedFrom: logisticsCourier ? 'both' : 'overview-only'
        }
      }
    };
    
    // 如果找到对应的物流数据，使用其异常信息
    if (logisticsCourier) {
      mergedCourier.exceptions = { ...logisticsCourier.exceptions };
      
      // 数据一致性检查
      const orderDiff = Math.abs(overviewCourier.total - logisticsCourier.total);
      if (orderDiff > 1) {
        console.warn(`⚠️ [数据不一致] ${mergedCourier.name}: 总览${overviewCourier.total}单 vs 物流${logisticsCourier.total}单，差异${orderDiff}单`);
      }
    }
    
    merged.push(mergedCourier);
  });
  
  // 添加只在物流数据中存在的快递商
  logisticsCouriers.forEach(logisticsCourier => {
    const exists = overviewCouriers.some(oc => 
      oc.carrierId === logisticsCourier.carrierId || 
      oc.name === logisticsCourier.name
    );
    
    if (!exists) {
      console.log(`ℹ️ [新增快递商] ${logisticsCourier.name} 仅在物流数据中存在`);
      merged.push({
        ...logisticsCourier,
        dataSource: 'logistics'
      });
    }
  });
  
  return merged;
}

/**
 * 计算快递商市场占比
 */
function calculateMarketShare(couriers: UnifiedCourierData[]): UnifiedCourierData[] {
  const totalOrders = couriers.reduce((sum, courier) => sum + courier.total, 0);
  
  if (totalOrders === 0) {
    return couriers;
  }
  
  return couriers.map(courier => ({
    ...courier,
    percentage: (courier.total / totalOrders) * 100
  }));
}

/**
 * 统一的快递商数据处理器主函数
 */
export function processUnifiedCourierData(
  overviewApiData: APIOverviewData | null,
  logisticsApiData: any | null,
  options: {
    prioritizeDataSource?: 'overview' | 'logistics' | 'merged';
    includeDebugInfo?: boolean;
  } = {}
): UnifiedCourierData[] {
  
  const { prioritizeDataSource = 'merged', includeDebugInfo = false } = options;
  
  console.log('🎯 [UnifiedCourierProcessor] 开始处理快递商数据');
  console.log('📊 总览API数据:', !!overviewApiData);
  console.log('🚚 物流API数据:', !!logisticsApiData);
  console.log('⚙️ 优先数据源:', prioritizeDataSource);
  
  let result: UnifiedCourierData[] = [];
  
  try {
    // 根据优先级和数据可用性选择处理策略
    if (prioritizeDataSource === 'overview' && overviewApiData) {
      // 仅使用总览数据
      result = extractCouriersFromOverview(overviewApiData);
      console.log('✅ 使用总览数据源');
      
    } else if (prioritizeDataSource === 'logistics' && logisticsApiData) {
      // 仅使用物流数据
      result = extractCouriersFromLogistics(logisticsApiData);
      console.log('✅ 使用物流数据源');
      
    } else if (prioritizeDataSource === 'merged') {
      // 合并两个数据源
      const overviewCouriers = overviewApiData ? extractCouriersFromOverview(overviewApiData) : [];
      const logisticsCouriers = logisticsApiData ? extractCouriersFromLogistics(logisticsApiData) : [];
      
      if (overviewCouriers.length > 0 || logisticsCouriers.length > 0) {
        result = mergeCourierData(overviewCouriers, logisticsCouriers);
        console.log('✅ 使用合并数据源');
      }
      
    } else {
      // 回退策略：使用任何可用的数据
      if (overviewApiData) {
        result = extractCouriersFromOverview(overviewApiData);
        console.log('✅ 回退到总览数据源');
      } else if (logisticsApiData) {
        result = extractCouriersFromLogistics(logisticsApiData);
        console.log('✅ 回退到物流数据源');
      }
    }
    
    // 计算市场占比
    result = calculateMarketShare(result);
    
    // 按订单量排序
    result.sort((a, b) => b.total - a.total);
    
    // 移除调试信息（如果不需要）
    if (!includeDebugInfo) {
      result = result.map(courier => {
        const { debug, ...cleanCourier } = courier;
        return cleanCourier as UnifiedCourierData;
      });
    }
    
    console.log(`🎯 [UnifiedCourierProcessor] 处理完成，共${result.length}家快递商`);
    
    // 输出处理摘要
    if (result.length > 0) {
      const totalOrders = result.reduce((sum, c) => sum + c.total, 0);
      const topCouriers = result.slice(0, 3).map(c => `${c.name}(${c.total}单)`).join(', ');
      console.log(`📈 总订单量: ${totalOrders.toLocaleString()}单`);
      console.log(`🏆 前三快递商: ${topCouriers}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ [UnifiedCourierProcessor] 处理失败:', error);
    return [];
  }
}

/**
 * 转换为总览页面使用的格式
 */
export function convertToOverviewFormat(couriers: UnifiedCourierData[]) {
  return couriers.map(courier => ({
    name: courier.name,
    value: courier.total,
    percentage: `${courier.percentage.toFixed(1)}%`
  }));
}

/**
 * 转换为物流页面CourierMonitoring组件使用的格式
 */
export function convertToCourierMonitoringFormat(couriers: UnifiedCourierData[]) {
  console.log('🔄 [convertToCourierMonitoringFormat] 开始转换数据:', couriers.length, '家快递商');
  
  const result = couriers.map(courier => {
    const formatted = {
      name: courier.name,
      deliveryRate: courier.deliveryRate,
      pickupRate: courier.pickupRate,
      shippingRate: courier.shippingRate,
      total: courier.total,
      orderCount: courier.orderCount,
      percentage: courier.percentage,
      exceptions: courier.exceptions
    };
    
    console.log(`🔍 [convertToCourierMonitoringFormat] ${courier.name} 异常数据:`, {
      原始: courier.exceptions,
      转换后: formatted.exceptions
    });
    
    return formatted;
  });
  
  console.log('✅ [convertToCourierMonitoringFormat] 转换完成');
  return result;
}

/**
 * 详细的数据差异分析报告
 */
export interface DetailedConsistencyReport {
  isConsistent: boolean;
  issues: string[];
  summary: {
    overviewCouriers: number;
    logisticsCouriers: number;
    totalOrdersOverview: number;
    totalOrdersLogistics: number;
    ordersDifference: number;
    ordersDifferencePercentage: number;
  };
  courierComparison: Array<{
    carrierId: string;
    name: string;
    overviewData: {
      totalOrders: number;
      deliveryRate: number;
      pickedCount: number;
      shippedCount: number;
      deliveredCount: number;
    } | null;
    logisticsData: {
      totalOrders: number;
      deliveryRate: number;
      pickedOrders: number;
      shippedOrders: number;
      deliveredOrders: number;
    } | null;
    differences: {
      ordersDiff: number;
      ordersPercentageDiff: number;
      deliveryRateDiff: number;
      isSignificant: boolean;
      analysis: string;
    };
  }>;
  possibleCauses: string[];
  recommendations: string[];
}

/**
 * 生成详细的数据一致性报告
 */
export function generateDetailedConsistencyReport(
  overviewApiData: APIOverviewData | null,
  logisticsApiData: any | null
): DetailedConsistencyReport {
  
  const overviewCouriers = overviewApiData ? extractCouriersFromOverview(overviewApiData) : [];
  const logisticsCouriers = logisticsApiData ? extractCouriersFromLogistics(logisticsApiData) : [];
  
  const issues: string[] = [];
  const possibleCauses: string[] = [];
  const recommendations: string[] = [];
  const courierComparison: DetailedConsistencyReport['courierComparison'] = [];
  
  // 检查快递商数量差异
  if (Math.abs(overviewCouriers.length - logisticsCouriers.length) > 0) {
    issues.push(`快递商数量不一致: 总览${overviewCouriers.length}家 vs 物流${logisticsCouriers.length}家`);
    possibleCauses.push('不同接口使用了不同的快递商筛选条件');
  }
  
  // 检查总订单量差异
  const totalOrdersOverview = overviewCouriers.reduce((sum, c) => sum + c.total, 0);
  const totalOrdersLogistics = logisticsCouriers.reduce((sum, c) => sum + c.total, 0);
  const ordersDifference = Math.abs(totalOrdersOverview - totalOrdersLogistics);
  const ordersDifferencePercentage = totalOrdersOverview > 0 ? (ordersDifference / totalOrdersOverview) * 100 : 0;
  
  if (ordersDifferencePercentage > 1) { // 1%阈值
    issues.push(`总订单量差异过大: ${ordersDifference}单 (${ordersDifferencePercentage.toFixed(2)}%)`);
    possibleCauses.push('两个接口查询了不同的时间范围或筛选条件');
    possibleCauses.push('两个接口查询了不同的数据表或使用了不同的JOIN条件');
  }
  
  // 创建所有快递商的合并列表
  const allCarrierIds = new Set([
    ...overviewCouriers.map(c => c.carrierId),
    ...logisticsCouriers.map(c => c.carrierId)
  ]);
  
  // 逐个对比快递商数据
  allCarrierIds.forEach(carrierId => {
    const overviewCourier = overviewCouriers.find(c => c.carrierId === carrierId);
    const logisticsCourier = logisticsCouriers.find(c => c.carrierId === carrierId);
    
    let analysis = '';
    let isSignificant = false;
    let ordersDiff = 0;
    let ordersPercentageDiff = 0;
    let deliveryRateDiff = 0;
    
    if (overviewCourier && logisticsCourier) {
      // 计算订单数差异
      ordersDiff = Math.abs(overviewCourier.total - logisticsCourier.total);
      ordersPercentageDiff = overviewCourier.total > 0 ? (ordersDiff / overviewCourier.total) * 100 : 0;
      
      // 计算配送率差异
      deliveryRateDiff = Math.abs(overviewCourier.deliveryRate - logisticsCourier.deliveryRate);
      
      // 判断是否为显著差异
      isSignificant = ordersPercentageDiff > 5 || deliveryRateDiff > 2; // 5%订单数差异或2%配送率差异
      
      if (isSignificant) {
        analysis = `显著差异 - 订单数相差${ordersDiff}单(${ordersPercentageDiff.toFixed(1)}%), 配送率相差${deliveryRateDiff.toFixed(1)}%`;
        issues.push(`${overviewCourier?.name || logisticsCourier?.name || carrierId}数据差异显著: ${analysis}`);
      } else {
        analysis = `轻微差异 - 订单数相差${ordersDiff}单(${ordersPercentageDiff.toFixed(1)}%), 配送率相差${deliveryRateDiff.toFixed(1)}%`;
      }
      
    } else if (overviewCourier && !logisticsCourier) {
      analysis = '仅在总览接口中存在';
      isSignificant = true;
      issues.push(`${overviewCourier.name || carrierId}仅在总览接口中存在`);
      
    } else if (!overviewCourier && logisticsCourier) {
      analysis = '仅在物流接口中存在';
      isSignificant = true;
      issues.push(`${logisticsCourier.name || carrierId}仅在物流接口中存在`);
    }
    
    courierComparison.push({
      carrierId,
      name: overviewCourier?.name || logisticsCourier?.name || carrierId,
      overviewData: overviewCourier ? {
        totalOrders: overviewCourier.total,
        deliveryRate: overviewCourier.deliveryRate,
        pickedCount: Math.round(overviewCourier.total * (overviewCourier.pickupRate / 100)),
        shippedCount: Math.round(overviewCourier.total * (overviewCourier.shippingRate / 100)),
        deliveredCount: Math.round(overviewCourier.total * (overviewCourier.deliveryRate / 100))
      } : null,
      logisticsData: logisticsCourier ? {
        totalOrders: logisticsCourier.total,
        deliveryRate: logisticsCourier.deliveryRate,
        pickedOrders: Math.round(logisticsCourier.total * (logisticsCourier.pickupRate / 100)),
        shippedOrders: Math.round(logisticsCourier.total * (logisticsCourier.shippingRate / 100)),
        deliveredOrders: Math.round(logisticsCourier.total * (logisticsCourier.deliveryRate / 100))
      } : null,
      differences: {
        ordersDiff,
        ordersPercentageDiff,
        deliveryRateDiff,
        isSignificant,
        analysis
      }
    });
  });
  
  // 根据发现的问题生成可能原因
  if (issues.length > 0) {
    possibleCauses.push('API接口查询时间点不同，存在数据更新延迟');
    possibleCauses.push('两个接口使用了不同的SQL查询逻辑或JOIN条件');
    possibleCauses.push('数据库表结构或字段映射存在差异');
    possibleCauses.push('缓存机制导致数据不同步');
    possibleCauses.push('筛选条件（品牌、时间范围等）应用不一致');
  }
  
  // 生成修复建议
  if (issues.length > 0) {
    recommendations.push('统一两个接口的查询逻辑，确保使用相同的SQL条件');
    recommendations.push('检查数据库字段映射，确保orderCount与totalOrders指向相同数据');
    recommendations.push('同步两个接口的缓存策略和更新频率');
    recommendations.push('添加接口执行时间戳，确保数据时效性');
    recommendations.push('在后端实现数据一致性校验机制');
  }
  
  return {
    isConsistent: issues.length === 0,
    issues,
    summary: {
      overviewCouriers: overviewCouriers.length,
      logisticsCouriers: logisticsCouriers.length,
      totalOrdersOverview,
      totalOrdersLogistics,
      ordersDifference,
      ordersDifferencePercentage
    },
    courierComparison,
    possibleCauses,
    recommendations
  };
}

/**
 * 简化版数据一致性报告（向后兼容）
 */
export function generateConsistencyReport(
  overviewApiData: APIOverviewData | null,
  logisticsApiData: any | null
): {
  isConsistent: boolean;
  issues: string[];
  summary: {
    overviewCouriers: number;
    logisticsCouriers: number;
    totalOrdersOverview: number;
    totalOrdersLogistics: number;
    ordersDifference: number;
  };
} {
  const detailedReport = generateDetailedConsistencyReport(overviewApiData, logisticsApiData);
  
  return {
    isConsistent: detailedReport.isConsistent,
    issues: detailedReport.issues,
    summary: {
      overviewCouriers: detailedReport.summary.overviewCouriers,
      logisticsCouriers: detailedReport.summary.logisticsCouriers,
      totalOrdersOverview: detailedReport.summary.totalOrdersOverview,
      totalOrdersLogistics: detailedReport.summary.totalOrdersLogistics,
      ordersDifference: detailedReport.summary.ordersDifference
    }
  };
}