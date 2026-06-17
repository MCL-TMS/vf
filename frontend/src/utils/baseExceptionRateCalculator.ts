/**
 * 基础异常率计算器
 * 用于从历史订单数据中动态计算各快递商的基础异常率
 */

import { courierData } from "../data/orderData";

export interface CourierExceptionStats {
  courier: string;
  totalOrders: number;
  totalExceptions: number;
  baseExceptionRate: number;
  exceptionBreakdown: {
    pickupTimeout: number;
    shippingTimeout: number;
    deliveryTimeout: number;
  };
  confidenceLevel: number;
  lastUpdated: Date;
}

export interface BaseExceptionRateConfig {
  timeWindowDays?: number;          // 计算时间窗口（天）
  minOrderThreshold?: number;       // 最小订单数量阈值
  smoothingFactor?: number;         // 平滑系数（0-1）
  outlierRemoval?: boolean;         // 是否移除异常值
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<BaseExceptionRateConfig> = {
  timeWindowDays: 30,               // 过去30天
  minOrderThreshold: 1000,          // 至少1000单
  smoothingFactor: 0.7,             // 70%权重给近期数据
  outlierRemoval: true              // 移除异常值
};

/**
 * 从历史数据计算基础异常率
 */
export function calculateBaseExceptionRates(
  config: BaseExceptionRateConfig = {}
): Map<string, CourierExceptionStats> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const results = new Map<string, CourierExceptionStats>();

  // 当前使用mock数据，实际应该从数据库查询历史订单
  const historicalData = generateMockHistoricalData(finalConfig.timeWindowDays);

  // 按快递商分组计算
  const courierGroups = groupByCourier(historicalData);

  for (const [courier, orders] of courierGroups.entries()) {
    if (orders.length < finalConfig.minOrderThreshold) {
      console.warn(`快递商 ${courier} 的订单量不足 ${finalConfig.minOrderThreshold}，跳过计算`);
      continue;
    }

    const stats = calculateCourierStats(courier, orders, finalConfig);
    results.set(courier, stats);
  }

  return results;
}

/**
 * 计算单个快递商的异常率统计
 */
function calculateCourierStats(
  courier: string,
  orders: MockOrderRecord[],
  config: Required<BaseExceptionRateConfig>
): CourierExceptionStats {
  // 1. 基础统计
  const totalOrders = orders.length;
  let pickupTimeouts = 0;
  let shippingTimeouts = 0;
  let deliveryTimeouts = 0;

  // 2. 遍历订单计算异常
  orders.forEach(order => {
    // 超时未揽收（>2小时）
    if (order.pickupTime && order.orderTime) {
      const pickupHours = (order.pickupTime.getTime() - order.orderTime.getTime()) / (1000 * 60 * 60);
      if (pickupHours > 2) pickupTimeouts++;
    } else if (!order.pickupTime && isTimeout(order.orderTime, 2, 'hours')) {
      pickupTimeouts++;
    }

    // 超时未发运（>12小时）
    if (order.shippingTime && order.pickupTime) {
      const shippingHours = (order.shippingTime.getTime() - order.pickupTime.getTime()) / (1000 * 60 * 60);
      if (shippingHours > 12) shippingTimeouts++;
    } else if (!order.shippingTime && order.pickupTime && isTimeout(order.pickupTime, 12, 'hours')) {
      shippingTimeouts++;
    }

    // 超时未签收（>3天）
    if (order.deliveryTime && order.shippingTime) {
      const deliveryDays = (order.deliveryTime.getTime() - order.shippingTime.getTime()) / (1000 * 60 * 60 * 24);
      if (deliveryDays > 3) deliveryTimeouts++;
    } else if (!order.deliveryTime && order.shippingTime && isTimeout(order.shippingTime, 3, 'days')) {
      deliveryTimeouts++;
    }
  });

  // 3. 计算异常率
  const totalExceptions = pickupTimeouts + shippingTimeouts + deliveryTimeouts;
  const baseExceptionRate = totalExceptions / totalOrders;

  // 4. 应用平滑处理
  const smoothedRate = applySmoothing(baseExceptionRate, courier, config.smoothingFactor);

  // 5. 移除异常值
  const finalRate = config.outlierRemoval ? removeOutliers(smoothedRate, courier) : smoothedRate;

  // 6. 计算置信度
  const confidenceLevel = calculateConfidenceLevel(totalOrders, totalExceptions);

  return {
    courier,
    totalOrders,
    totalExceptions,
    baseExceptionRate: Math.round(finalRate * 10000) / 10000, // 保留4位小数
    exceptionBreakdown: {
      pickupTimeout: Math.round((pickupTimeouts / totalOrders) * 10000) / 10000,
      shippingTimeout: Math.round((shippingTimeouts / totalOrders) * 10000) / 10000,
      deliveryTimeout: Math.round((deliveryTimeouts / totalOrders) * 10000) / 10000,
    },
    confidenceLevel,
    lastUpdated: new Date()
  };
}

/**
 * 判断是否超时
 */
function isTimeout(startTime: Date, threshold: number, unit: 'hours' | 'days'): boolean {
  const now = new Date();
  const diffMs = now.getTime() - startTime.getTime();
  
  if (unit === 'hours') {
    return diffMs > threshold * 60 * 60 * 1000;
  } else {
    return diffMs > threshold * 24 * 60 * 60 * 1000;
  }
}

/**
 * 应用指数平滑处理
 */
function applySmoothing(currentRate: number, courier: string, smoothingFactor: number): number {
  // 获取历史平均异常率（这里使用硬编码的行业基准）
  const industryBenchmark = getIndustryBenchmark(courier);
  
  // 指数平滑：新异常率 = α * 当前异常率 + (1-α) * 历史异常率
  return smoothingFactor * currentRate + (1 - smoothingFactor) * industryBenchmark;
}

/**
 * 获取行业基准异常率
 */
function getIndustryBenchmark(courier: string): number {
  // 基于行业经验和公开数据的基准值
  const benchmarks: Record<string, number> = {
    '中通': 0.12,      // 12% - 价格导向的快递，异常率相对较高  
    '顺丰': 0.05,      // 5% - 高端快递，异常率较低
    '韵达': 0.10,      // 10% - 中等水平
    '申通': 0.11,      // 11% - 中等偏高
    '圆通': 0.09,      // 9% - 中等水平
    '京东': 0.04,      // 4% - 自营物流，异常率很低
    '德邦': 0.07,      // 7% - 专业物流，异常率较低
  };
  
  return benchmarks[courier] || 0.08; // 默认8%
}

/**
 * 移除异常值
 */
function removeOutliers(rate: number, courier: string): number {
  const benchmark = getIndustryBenchmark(courier);
  const upperBound = benchmark * 2;    // 上限：基准值的2倍
  const lowerBound = benchmark * 0.5;  // 下限：基准值的一半
  
  return Math.max(lowerBound, Math.min(upperBound, rate));
}

/**
 * 计算置信度等级
 */
function calculateConfidenceLevel(totalOrders: number, totalExceptions: number): number {
  // 基于样本量和异常数量计算置信度
  if (totalOrders < 1000) return 0.6;      // 样本量小，置信度低
  if (totalOrders < 5000) return 0.8;      // 样本量中等，置信度中等
  if (totalOrders < 10000) return 0.9;     // 样本量大，置信度高
  return 0.95;                              // 样本量很大，置信度很高
}

/**
 * 按快递商分组
 */
function groupByCourier(orders: MockOrderRecord[]): Map<string, MockOrderRecord[]> {
  const groups = new Map<string, MockOrderRecord[]>();
  
  orders.forEach(order => {
    if (!groups.has(order.courier)) {
      groups.set(order.courier, []);
    }
    groups.get(order.courier)!.push(order);
  });
  
  return groups;
}

/**
 * Mock历史订单数据接口
 */
interface MockOrderRecord {
  orderId: string;
  courier: string;
  brand: string;
  orderTime: Date;
  pickupTime?: Date;
  shippingTime?: Date;
  deliveryTime?: Date;
  status: 'delivered' | 'shipping' | 'picked' | 'pending';
}

/**
 * 生成模拟历史数据
 */
function generateMockHistoricalData(days: number): MockOrderRecord[] {
  const orders: MockOrderRecord[] = [];
  const now = new Date();
  const brands = ['TNF', 'DICKIES', 'VANS', 'TIMBERLAND', 'ICEBREAKER', 'KIPLING'];
  const couriers = ['中通', '顺丰'];
  
  // 生成过去N天的订单数据
  for (let day = 0; day < days; day++) {
    const orderDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
    
    // 每天生成200-800单随机订单
    const dailyOrders = Math.floor(Math.random() * 600) + 200;
    
    for (let i = 0; i < dailyOrders; i++) {
      const courier = couriers[Math.floor(Math.random() * couriers.length)];
      const brand = brands[Math.floor(Math.random() * brands.length)];
      
      const order: MockOrderRecord = {
        orderId: `ORDER_${day}_${i}`,
        courier,
        brand,
        orderTime: new Date(orderDate.getTime() + Math.random() * 24 * 60 * 60 * 1000),
        status: 'pending'
      };
      
      // 模拟物流时效，基于快递商特性
      simulateLogisticsTimeline(order);
      
      orders.push(order);
    }
  }
  
  return orders;
}

/**
 * 模拟物流时效
 */
function simulateLogisticsTimeline(order: MockOrderRecord) {
  const isZTO = order.courier === '中通';
  const isSF = order.courier === '顺丰';
  
  // 1. 揽收时效模拟
  const pickupDelayProb = isZTO ? 0.15 : 0.08; // 中通15%概率延误，顺丰8%
  if (Math.random() > pickupDelayProb) {
    // 正常揽收：0.5-6小时
    const pickupHours = Math.random() * 5.5 + 0.5;
    order.pickupTime = new Date(order.orderTime.getTime() + pickupHours * 60 * 60 * 1000);
  } else {
    // 延误揽收：2-24小时
    const pickupHours = Math.random() * 22 + 2;
    order.pickupTime = new Date(order.orderTime.getTime() + pickupHours * 60 * 60 * 1000);
  }
  
  // 2. 发运时效模拟
  if (order.pickupTime) {
    const shippingDelayProb = isZTO ? 0.12 : 0.05; // 中通12%概率延误，顺丰5%
    if (Math.random() > shippingDelayProb) {
      // 正常发运：1-8小时
      const shippingHours = Math.random() * 7 + 1;
      order.shippingTime = new Date(order.pickupTime.getTime() + shippingHours * 60 * 60 * 1000);
    } else {
      // 延误发运：12-48小时
      const shippingHours = Math.random() * 36 + 12;
      order.shippingTime = new Date(order.pickupTime.getTime() + shippingHours * 60 * 60 * 1000);
    }
  }
  
  // 3. 签收时效模拟
  if (order.shippingTime) {
    const deliveryDelayProb = isZTO ? 0.08 : 0.03; // 中通8%概率延误，顺丰3%
    if (Math.random() > deliveryDelayProb) {
      // 正常签收：顺丰1-2天，中通2-3天
      const deliveryDays = isSF ? (Math.random() * 1 + 1) : (Math.random() * 1 + 2);
      order.deliveryTime = new Date(order.shippingTime.getTime() + deliveryDays * 24 * 60 * 60 * 1000);
      order.status = 'delivered';
    } else {
      // 延误签收：3-7天
      const deliveryDays = Math.random() * 4 + 3;
      if (Math.random() > 0.3) { // 70%最终还是会签收
        order.deliveryTime = new Date(order.shippingTime.getTime() + deliveryDays * 24 * 60 * 60 * 1000);
        order.status = 'delivered';
      } else {
        order.status = 'shipping'; // 30%仍在运输中
      }
    }
  }
}

/**
 * 获取快递商的当前基础异常率
 */
export function getCourierBaseExceptionRate(
  courier: string, 
  config?: BaseExceptionRateConfig
): number {
  const stats = calculateBaseExceptionRates(config);
  const courierStats = stats.get(courier);
  
  if (courierStats && courierStats.confidenceLevel > 0.7) {
    return courierStats.baseExceptionRate;
  }
  
  // 如果没有足够数据或置信度不高，返回行业基准
  return getIndustryBenchmark(courier);
}

/**
 * 批量获取所有快递商的基础异常率
 */
export function getAllCourierBaseExceptionRates(
  config?: BaseExceptionRateConfig
): Record<string, number> {
  const stats = calculateBaseExceptionRates(config);
  const rates: Record<string, number> = {};
  
  // 添加计算出的异常率
  for (const [courier, stat] of stats.entries()) {
    rates[courier] = stat.baseExceptionRate;
  }
  
  // 添加默认快递商的基准异常率
  const defaultCouriers = ['中通', '顺丰', '韵达', '申通', '圆通', '京东', '德邦'];
  defaultCouriers.forEach(courier => {
    if (!rates[courier]) {
      rates[courier] = getIndustryBenchmark(courier);
    }
  });
  
  return rates;
}

/**
 * 生成异常率报告
 */
export function generateExceptionRateReport(
  config?: BaseExceptionRateConfig
): {
  summary: {
    totalCouriers: number;
    averageExceptionRate: number;
    highestRiskCourier: string;
    lowestRiskCourier: string;
  };
  details: CourierExceptionStats[];
  recommendations: string[];
} {
  const stats = calculateBaseExceptionRates(config);
  const details = Array.from(stats.values());
  
  if (details.length === 0) {
    return {
      summary: {
        totalCouriers: 0,
        averageExceptionRate: 0,
        highestRiskCourier: '',
        lowestRiskCourier: ''
      },
      details: [],
      recommendations: ['数据不足，无法生成报告']
    };
  }
  
  // 计算汇总统计
  const totalCouriers = details.length;
  const averageExceptionRate = details.reduce((sum, stat) => sum + stat.baseExceptionRate, 0) / totalCouriers;
  const sortedByRate = details.sort((a, b) => b.baseExceptionRate - a.baseExceptionRate);
  const highestRiskCourier = sortedByRate[0].courier;
  const lowestRiskCourier = sortedByRate[sortedByRate.length - 1].courier;
  
  // 生成建议
  const recommendations: string[] = [];
  
  if (sortedByRate[0].baseExceptionRate > 0.15) {
    recommendations.push(`${highestRiskCourier}的异常率过高(${(sortedByRate[0].baseExceptionRate * 100).toFixed(1)}%)，建议减少使用或要求改进`);
  }
  
  if (averageExceptionRate > 0.10) {
    recommendations.push(`整体平均异常率偏高(${(averageExceptionRate * 100).toFixed(1)}%)，建议优化快递商结构`);
  }
  
  const highPickupTimeoutCouriers = details.filter(stat => stat.exceptionBreakdown.pickupTimeout > 0.08);
  if (highPickupTimeoutCouriers.length > 0) {
    recommendations.push(`${highPickupTimeoutCouriers.map(c => c.courier).join('、')}揽收超时率过高，建议加强揽收管理`);
  }
  
  return {
    summary: {
      totalCouriers,
      averageExceptionRate: Math.round(averageExceptionRate * 10000) / 10000,
      highestRiskCourier,
      lowestRiskCourier
    },
    details: sortedByRate,
    recommendations
  };
}