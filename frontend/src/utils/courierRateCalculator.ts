/**
 * 快递公司指标计算工具
 * 基于真实API状态数据计算揽收率、发运率、签收率
 */

// API返回的快递公司状态统计数据结构
interface CourierStatusStats {
  carrierId: string;
  totalOrders: number;
  statusDistribution: Array<{
    carrierId: string;
    statusCode: string;
    statusName: string;
    orderCount: number;
    statusPercentage: number;
  }>;
  pickedOrders: number;    // 已揽收订单量（状态55）
  shippedOrders: number;   // 已发运订单量（状态70）
  deliveredOrders: number; // 已签收订单量（状态95）
  exceptionOrders: number; // 异常订单量
  pickupRate: number;      // 揽收率（基于真实数据计算）
  shippingRate: number;    // 发运率（基于真实数据计算）
  deliveryRate: number;    // 签收率（基于真实数据计算）
  exceptionRate: number;   // 异常率
}

// 传统API的快递公司数据结构（用于向后兼容）
interface CourierRawData {
  carrierId: string;
  totalOrders: number;
  deliveredOrders: number;
  exceptionOrders: number;
  timeout48hOrders: number;
  avgDeliveryHours: number;
  avgFirstDispatchHours: number;
  firstDispatchSuccessRate: number;
  deliveryRate: number;
  exceptionRate: number;
  timeout48hRate: number;
  pickupTimeout: number;
  shippingTimeout: number;
  deliveryTimeout: number;
  totalTimeout: number;
}

// 最终处理后的快递公司数据
interface CourierProcessedData {
  carrierId: string;
  courierName: string;
  // 基础订单量（来自状态分布数据）
  totalOrders: number;
  pickedOrders: number;    // 实际已揽收订单量
  shippedOrders: number;   // 实际已发运订单量
  deliveredOrders: number; // 实际已签收订单量
  exceptionOrders: number; // 实际异常订单量
  // 计算的指标率（基于真实状态数据）
  pickupRate: number;      // 揽收率 = 已揽收订单 / 总订单
  shippingRate: number;    // 发运率 = 已发运订单 / 总订单  
  deliveryRate: number;    // 签收率 = 已签收订单 / 总订单
  exceptionRate: number;   // 异常率 = 异常订单 / 总订单
  // 时效指标（来自传统API）
  avgDeliveryHours?: number;
  avgFirstDispatchHours?: number;
  firstDispatchSuccessRate?: number;
  // 异常指标（来自传统API）
  pickupTimeout?: number;
  shippingTimeout?: number;
  deliveryTimeout?: number;
  totalTimeout?: number;
  // 状态分布详情
  statusDistribution?: Array<{
    statusCode: string;
    statusName: string;
    orderCount: number;
    statusPercentage: number;
  }>;
}

/**
 * 快递公司名称映射
 * 从CARRIERID映射到中文名称
 */
const COURIER_NAME_MAPPING: { [key: string]: string } = {
  'SF': '顺丰速运',
  'STO': '申通快递',
  'YTO': '圆通快递',
  'ZTO': '中通快递',
  'HTKY': '汇通快递',
  'YUNDA': '韵达快递',
  'EMS': 'EMS',
  'JD': '京东物流',
  'DEPPON': '德邦快递',
  'TNT': 'TNT',
  'DHL': 'DHL',
  'FEDEX': 'FedEx',
  'UPS': 'UPS',
  'OTHER': '其他快递'
};

/**
 * 物流状态码映射
 * 从数字状态码映射到含义
 */
const LOGISTICS_STATUS_MAPPING: { [key: string]: string } = {
  '00': '已下单',
  '10': '已接单',
  '20': '已取件',
  '30': '运输中',
  '40': '派件中',
  '50': '正在配送',
  '55': '已揽收',
  '60': '配送异常',
  '70': '已发运',
  '80': '配送延迟',
  '90': '配送失败',
  '95': '已签收',
  '100': '异常-地址问题',
  '105': '异常-收件人问题',
  '110': '异常-其他原因'
};

/**
 * 基于真实状态分布数据处理快递公司指标
 * 这是主要的处理函数，使用真实的状态数据而不是估算
 */
export function processCourierDataFromStatusDistribution(
  statusStatsData: CourierStatusStats[]
): CourierProcessedData[] {
  return statusStatsData.map(courierStats => {
    // 获取快递公司中文名称
    const courierName = COURIER_NAME_MAPPING[courierStats.carrierId] || courierStats.carrierId;
    
    // 使用API返回的精确计算结果，无需前端再次计算
    return {
      carrierId: courierStats.carrierId,
      courierName,
      totalOrders: courierStats.totalOrders,
      pickedOrders: courierStats.pickedOrders,
      shippedOrders: courierStats.shippedOrders,
      deliveredOrders: courierStats.deliveredOrders,
      exceptionOrders: courierStats.exceptionOrders,
      pickupRate: courierStats.pickupRate,      // 来自API的精确计算
      shippingRate: courierStats.shippingRate,  // 来自API的精确计算
      deliveryRate: courierStats.deliveryRate,  // 来自API的精确计算
      exceptionRate: courierStats.exceptionRate,
      statusDistribution: courierStats.statusDistribution
    };
  });
}

/**
 * 结合状态分布数据和传统API数据
 * 提供完整的快递公司分析数据
 */
export function combineCourierDataWithMetrics(
  statusStatsData: CourierStatusStats[],
  traditionalApiData: CourierRawData[]
): CourierProcessedData[] {
  
  // 创建传统API数据的映射，便于查找
  const traditionalDataMap = new Map<string, CourierRawData>();
  traditionalApiData.forEach(courier => {
    traditionalDataMap.set(courier.carrierId, courier);
  });
  
  return statusStatsData.map(courierStats => {
    const traditionalData = traditionalDataMap.get(courierStats.carrierId);
    const courierName = COURIER_NAME_MAPPING[courierStats.carrierId] || courierStats.carrierId;
    
    return {
      carrierId: courierStats.carrierId,
      courierName,
      // 基础数据来自状态分布（精确）
      totalOrders: courierStats.totalOrders,
      pickedOrders: courierStats.pickedOrders,
      shippedOrders: courierStats.shippedOrders,
      deliveredOrders: courierStats.deliveredOrders,
      exceptionOrders: courierStats.exceptionOrders,
      // 指标率来自状态分布（精确计算）
      pickupRate: courierStats.pickupRate,
      shippingRate: courierStats.shippingRate,
      deliveryRate: courierStats.deliveryRate,
      exceptionRate: courierStats.exceptionRate,
      // 时效数据来自传统API（如果有的话）
      avgDeliveryHours: traditionalData?.avgDeliveryHours,
      avgFirstDispatchHours: traditionalData?.avgFirstDispatchHours,
      firstDispatchSuccessRate: traditionalData?.firstDispatchSuccessRate,
      // 超时数据来自传统API
      pickupTimeout: traditionalData?.pickupTimeout,
      shippingTimeout: traditionalData?.shippingTimeout,
      deliveryTimeout: traditionalData?.deliveryTimeout,
      totalTimeout: traditionalData?.totalTimeout,
      // 状态分布详情
      statusDistribution: courierStats.statusDistribution
    };
  });
}

/**
 * 向后兼容函数 - 为没有状态分布数据的情况提供估算
 * 只在无法获取状态分布API数据时使用
 */
export function processCourierDataLegacy(rawData: CourierRawData[]): CourierProcessedData[] {
  console.warn('⚠️ [CourierRateCalculator] 使用估算模式计算快递指标，建议使用状态分布API获取精确数据');
  
  return rawData.map(courier => {
    // 基于行业经验的估算比例（仅作为备选方案）
    let pickupRateEstimate: number;
    let shippingRateEstimate: number;
    
    if (courier.deliveryRate >= 94) {
      // 高端快递（顺丰、京东等）
      pickupRateEstimate = 0.98;
      shippingRateEstimate = 0.97;
    } else if (courier.deliveryRate >= 90) {
      // 中端快递（三通一达等）
      pickupRateEstimate = 0.95;
      shippingRateEstimate = 0.92;
    } else {
      // 其他快递
      pickupRateEstimate = 0.92;
      shippingRateEstimate = 0.89;
    }
    
    const pickedOrders = Math.round(courier.totalOrders * pickupRateEstimate);
    const shippedOrders = Math.round(courier.totalOrders * shippingRateEstimate);
    
    const pickupRate = Math.round(pickupRateEstimate * 100 * 100) / 100;
    const shippingRate = Math.round(shippingRateEstimate * 100 * 100) / 100;
    
    const courierName = COURIER_NAME_MAPPING[courier.carrierId] || courier.carrierId;
    
    return {
      carrierId: courier.carrierId,
      courierName,
      totalOrders: courier.totalOrders,
      pickedOrders,
      shippedOrders,
      deliveredOrders: courier.deliveredOrders,
      exceptionOrders: courier.exceptionOrders,
      pickupRate,
      shippingRate,
      deliveryRate: courier.deliveryRate,
      exceptionRate: courier.exceptionRate,
      avgDeliveryHours: courier.avgDeliveryHours,
      avgFirstDispatchHours: courier.avgFirstDispatchHours,
      firstDispatchSuccessRate: courier.firstDispatchSuccessRate,
      pickupTimeout: courier.pickupTimeout,
      shippingTimeout: courier.shippingTimeout,
      deliveryTimeout: courier.deliveryTimeout,
      totalTimeout: courier.totalTimeout
    };
  });
}

/**
 * 获取快递公司绩效排名
 */
export function getCourierRankings(processedData: CourierProcessedData[]): {
  byPickupRate: CourierProcessedData[];
  byShippingRate: CourierProcessedData[];
  byDeliveryRate: CourierProcessedData[];
  byOverallPerformance: CourierProcessedData[];
} {
  return {
    byPickupRate: [...processedData].sort((a, b) => b.pickupRate - a.pickupRate),
    byShippingRate: [...processedData].sort((a, b) => b.shippingRate - a.shippingRate),
    byDeliveryRate: [...processedData].sort((a, b) => b.deliveryRate - a.deliveryRate),
    byOverallPerformance: [...processedData].sort((a, b) => 
      (b.pickupRate + b.shippingRate + b.deliveryRate) - (a.pickupRate + a.shippingRate + a.deliveryRate)
    )
  };
}

/**
 * 计算快递公司综合评分
 */
export function calculateCourierScore(courier: CourierProcessedData): number {
  // 权重配置
  const weights = {
    pickupRate: 0.25,      // 揽收率权重25%
    shippingRate: 0.25,    // 发运率权重25%
    deliveryRate: 0.30,    // 签收率权重30%（最重要）
    timeliness: 0.20       // 时效性权重20%
  };
  
  // 时效性评分（基于首派成功率和平均配送时长）
  let timelinessScore = 50; // 默认值
  if (courier.firstDispatchSuccessRate !== undefined && courier.avgDeliveryHours !== undefined) {
    timelinessScore = courier.firstDispatchSuccessRate * 0.6 + 
      Math.max(0, 100 - courier.avgDeliveryHours) * 0.4;
  }
  
  const totalScore = 
    courier.pickupRate * weights.pickupRate +
    courier.shippingRate * weights.shippingRate +
    courier.deliveryRate * weights.deliveryRate +
    timelinessScore * weights.timeliness;
  
  return Math.round(totalScore * 100) / 100;
}

/**
 * 获取状态码的中文名称
 */
export function getStatusName(statusCode: string): string {
  return LOGISTICS_STATUS_MAPPING[statusCode] || `状态${statusCode}`;
}

/**
 * 验证快递公司数据的完整性
 */
export function validateCourierData(data: CourierProcessedData[]): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  data.forEach((courier, index) => {
    // 检查基础数据
    if (courier.totalOrders <= 0) {
      issues.push(`快递公司 ${courier.courierName} 的总订单量为 ${courier.totalOrders}`);
    }
    
    // 检查指标合理性
    if (courier.pickupRate > 100 || courier.pickupRate < 0) {
      issues.push(`快递公司 ${courier.courierName} 的揽收率异常: ${courier.pickupRate}%`);
    }
    
    if (courier.shippingRate > 100 || courier.shippingRate < 0) {
      issues.push(`快递公司 ${courier.courierName} 的发运率异常: ${courier.shippingRate}%`);
    }
    
    if (courier.deliveryRate > 100 || courier.deliveryRate < 0) {
      issues.push(`快递公司 ${courier.courierName} 的签收率异常: ${courier.deliveryRate}%`);
    }
    
    // 检查数据逻辑性
    if (courier.pickedOrders > courier.totalOrders) {
      issues.push(`快递公司 ${courier.courierName} 的已揽收订单量超过总订单量`);
    }
    
    if (courier.deliveredOrders > courier.totalOrders) {
      issues.push(`快递公司 ${courier.courierName} 的已签收订单量超过总订单量`);
    }
  });
  
  if (data.length === 0) {
    issues.push('没有快递公司数据');
    recommendations.push('检查API连接和查询参数');
  }
  
  if (issues.length === 0) {
    recommendations.push('数据验证通过，可以进行分析');
  } else {
    recommendations.push('建议检查数据源和计算逻辑');
    recommendations.push('考虑使用状态分布API获取更准确的数据');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    recommendations
  };
}

// 导出类型定义
export type { 
  CourierRawData, 
  CourierProcessedData, 
  CourierStatusStats 
};

// 默认导出主要处理函数
export default processCourierDataFromStatusDistribution;