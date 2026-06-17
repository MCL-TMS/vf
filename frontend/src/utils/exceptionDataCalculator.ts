/**
 * 统一的异常数据计算工具
 * 确保总览页面和物流页面使用相同的异常统计逻辑
 */

export interface ExceptionStats {
  totalPickupTimeouts: number;
  totalShippingTimeouts: number;
  totalNoUpdate48h: number;
  totalDeliveryTimeouts: number;
}

export interface ExceptionDataResult {
  totalOrders: number;
  exceptions: {
    pickupTimeout: number;
    shippingTimeout: number;
    noUpdate48h: number;
    deliveryTimeout: number;
  };
  brandDistribution: Record<string, number>;
}

// 移除异常比例配置 - 不再使用按比例分配的方式

/**
 * 模拟数据的固定异常数量
 */
const MOCK_EXCEPTIONS = {
  pickupTimeout: 4750,   // 超时未揽收
  shippingTimeout: 4250, // 超时未发运
  noUpdate48h: 3800,     // 超48h未更新
  deliveryTimeout: 4200  // 超时未签收
};

/**
 * 模拟数据的品牌分布
 */
const MOCK_BRAND_DISTRIBUTION = {
  'TNF': 45820,
  'DICKIES': 38650,
  'VANS': 35240,
  'TIMBERLAND': 28960,
  'ICEBREAKER': 15680,
  'KIPLING': 12450
};

/**
 * 统一的异常数据获取函数
 * @param useRealData 是否使用真实数据
 * @param rawApiData API原始数据
 * @param componentName 调用组件名（用于日志标识）
 * @returns 统一格式的异常数据
 */
export function getUnifiedExceptionData(
  useRealData: boolean,
  rawApiData: any,
  componentName: string = 'UnknownComponent'
): ExceptionDataResult {
  console.log(`🔍 [${componentName}] getUnifiedExceptionData调用:`, {
    useRealData,
    hasRawApiData: !!rawApiData,
    rawApiDataKeys: rawApiData ? Object.keys(rawApiData) : null,
    dataKeys: rawApiData?.data ? Object.keys(rawApiData.data) : null
  });

  if (!useRealData || !rawApiData?.data) {
    console.log(`⚠️ [${componentName}] 使用模拟数据`);
    return {
      totalOrders: 158076,
      exceptions: MOCK_EXCEPTIONS,
      brandDistribution: MOCK_BRAND_DISTRIBUTION
    };
  }

  const brands = rawApiData.data.brandDistribution || [];
  const kpi = rawApiData.data.kpi || {};
  
  console.log(`🔍 [${componentName}] brands数据:`, brands);
  console.log(`🔍 [${componentName}] 第一个brand:`, brands[0]);
  
  let totalOrders = kpi.totalOrders || 0;
  
  // 如果没有总订单数，从品牌分布计算
  if (!totalOrders && brands.length > 0) {
    totalOrders = brands.reduce((sum: number, brand: any) => sum + (brand.orderCount || 0), 0);
  }

  // 构建品牌分布对象
  const brandDistribution = brands.reduce((acc: Record<string, number>, brand: any) => {
    // 🔥 修复：同时支持品牌代码和品牌名称作为key
    // 品牌代码（如 '18405'）
    if (brand.brandCode) {
      acc[brand.brandCode] = brand.orderCount || 0;
      console.log(`🔍 [${componentName}] 添加品牌代码 ${brand.brandCode}: ${brand.orderCount}`);
    }
    // 品牌名称（如 'DICKIES'）
    if (brand.brandName) {
      acc[brand.brandName] = brand.orderCount || 0;
      console.log(`🔍 [${componentName}] 添加品牌名称 ${brand.brandName}: ${brand.orderCount}`);
    }
    // 如果只有brandName没有brandCode，也要能查找
    return acc;
  }, {} as Record<string, number>);
  
  console.log(`🔍 [${componentName}] 最终 brandDistribution:`, brandDistribution);

  // 🔥 关键：优先使用API直接提供的异常统计
  if (rawApiData.data.exceptionStats) {
    const exceptionStats = rawApiData.data.exceptionStats;
    console.log(`✅ [${componentName}] 找到API exceptionStats:`, exceptionStats);
    
    const exceptions = {
      pickupTimeout: exceptionStats.pickupTimeouts || 0,
      shippingTimeout: exceptionStats.shippingTimeouts || 0,
      noUpdate48h: exceptionStats.noUpdate48h || 0,
      deliveryTimeout: exceptionStats.deliveryTimeouts || 0
    };

    return {
      totalOrders,
      exceptions,
      brandDistribution
    };
  }

  // 🔥 重要修正：当没有直接的异常统计时，尝试从品牌/快递商/平台维度数据汇总异常
  console.log(`🔄 [${componentName}] 未找到API异常统计，尝试从维度数据汇总:`, { 
    totalOrders,
    brandCount: brands.length,
    hasDirectExceptions: !!(rawApiData.data.couriers || rawApiData.data.courierStats)
  });
  
  // 🔥 修复：尝试从快递商数据汇总异常，支持不同的API数据结构
  let couriers = rawApiData.data.couriers || rawApiData.data.courierStats || [];
  
  // 🔥 新增：如果data直接是数组（快递商API的结构）
  if (Array.isArray(rawApiData.data) && rawApiData.data.length > 0 && rawApiData.data[0].carrierId) {
    couriers = rawApiData.data;
    console.log(`📊 [${componentName}] 使用直接数组格式的快递商数据`);
  }
  
  if (couriers.length > 0) {
    // 从快递商数据计算总订单数
    if (!totalOrders) {
      totalOrders = couriers.reduce((sum: number, courier: any) => sum + (courier.totalOrders || 0), 0);
      console.log(`📊 [${componentName}] 从快递商数据计算总订单数:`, totalOrders);
    }
    
    const exceptions = {
      pickupTimeout: couriers.reduce((sum: number, courier: any) => sum + (courier.pickupTimeout || 0), 0),
      shippingTimeout: couriers.reduce((sum: number, courier: any) => sum + (courier.shippingTimeout || 0), 0),
      noUpdate48h: couriers.reduce((sum: number, courier: any) => sum + (courier.timeout48hOrders || 0), 0),
      deliveryTimeout: couriers.reduce((sum: number, courier: any) => sum + (courier.deliveryTimeout || 0), 0)
    };
    
    console.log(`📊 [${componentName}] 从快递商数据汇总的异常数据:`, {
      courierCount: couriers.length,
      totalOrders,
      exceptions,
      firstCourier: couriers[0]
    });
    
    return {
      totalOrders,
      exceptions,
      brandDistribution
    };
  }
  
  // 尝试从品牌数据汇总异常
  if (brands.length > 0) {
    const exceptions = {
      pickupTimeout: brands.reduce((sum: number, brand: any) => sum + (brand.pickupTimeout || brand.pickupTimeouts || 0), 0),
      shippingTimeout: brands.reduce((sum: number, brand: any) => sum + (brand.shippingTimeout || brand.shippingTimeouts || 0), 0),
      noUpdate48h: brands.reduce((sum: number, brand: any) => sum + (brand.timeout48hOrders || brand.noUpdate48h || 0), 0),
      deliveryTimeout: brands.reduce((sum: number, brand: any) => sum + (brand.deliveryTimeout || brand.deliveryTimeouts || 0), 0)
    };
    
    // 如果有异常数据，使用汇总结果
    if (exceptions.pickupTimeout > 0 || exceptions.shippingTimeout > 0 || exceptions.noUpdate48h > 0 || exceptions.deliveryTimeout > 0) {
      console.log(`📊 [${componentName}] 从品牌数据汇总的异常数据:`, exceptions);
      
      return {
        totalOrders,
        exceptions,
        brandDistribution
      };
    }
  }
  
  // 最后回退到固定的模拟异常数据
  console.log(`📊 [${componentName}] 使用固定模拟异常数据:`, MOCK_EXCEPTIONS);
  
  return {
    totalOrders: totalOrders || 158076,
    exceptions: MOCK_EXCEPTIONS,
    brandDistribution
  };
}

/**
 * 为CourierMonitoring组件格式化异常统计数据
 * @param exceptionData 统一格式的异常数据
 * @returns CourierMonitoring所需的异常统计格式
 */
export function formatExceptionStatsForCourier(exceptionData: ExceptionDataResult): ExceptionStats {
  return {
    totalPickupTimeouts: exceptionData.exceptions.pickupTimeout,
    totalShippingTimeouts: exceptionData.exceptions.shippingTimeout,
    totalNoUpdate48h: exceptionData.exceptions.noUpdate48h,
    totalDeliveryTimeouts: exceptionData.exceptions.deliveryTimeout
  };
}

/**
 * 计算异常率
 * @param exceptions 异常数据
 * @param totalOrders 总订单数
 * @returns 总异常率（百分比）
 */
export function calculateExceptionRate(exceptions: ExceptionDataResult['exceptions'], totalOrders: number): number {
  if (totalOrders <= 0) return 0;
  
  const totalExceptions = exceptions.pickupTimeout + 
                         exceptions.shippingTimeout + 
                         exceptions.noUpdate48h + 
                         exceptions.deliveryTimeout;
  
  return (totalExceptions / totalOrders) * 100;
}

/**
 * 验证异常数据的合理性
 * @param exceptions 异常数据
 * @param totalOrders 总订单数
 * @returns 验证结果和警告信息
 */
export function validateExceptionData(
  exceptions: ExceptionDataResult['exceptions'], 
  totalOrders: number
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let isValid = true;

  // 检查异常数是否为负数
  Object.entries(exceptions).forEach(([type, count]) => {
    if (count < 0) {
      warnings.push(`${type}异常数不能为负数: ${count}`);
      isValid = false;
    }
  });

  // 检查异常数是否超过总订单数
  const totalExceptions = Object.values(exceptions).reduce((sum, count) => sum + count, 0);
  if (totalExceptions > totalOrders) {
    warnings.push(`总异常数(${totalExceptions})不能超过总订单数(${totalOrders})`);
    isValid = false;
  }

  // 检查异常率是否过高（超过50%可能不合理）
  const exceptionRate = calculateExceptionRate(exceptions, totalOrders);
  if (exceptionRate > 50) {
    warnings.push(`异常率过高: ${exceptionRate.toFixed(1)}%，可能数据有误`);
  }

  return { isValid, warnings };
}