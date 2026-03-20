import { vfBrands, majorCities, courierCompanies, findSLA } from './slaData';

// 订单状态
export type OrderStatus = 'created' | 'picked' | 'shipped' | 'delivered' | 'returned' | 'cancelled';

// 物流订单接口
export interface LogisticsOrder {
  id: string;
  brand: string;
  city: string;
  courierCompany: string;
  status: OrderStatus;
  createTime: Date;        // 订单创建时间（消费者付款时间）
  pickupTime?: Date;       // 揽收时间
  shipTime?: Date;         // 发运时间
  deliveryTime?: Date;     // 签收时间
  returnTime?: Date;       // 退货时间
  
  // S2D: Ship to Delivery (发运到签收时间，小时)
  actualS2D?: number;      // 实际S2D时长（小时）
  planS2D?: number;        // 计划S2D时长（小时）
  
  // C2D: Customer to Delivery (付款到签收时间，小时) 
  actualC2D?: number;      // 实际C2D时长（小时）
  planC2D?: number;        // 计划C2D时长（小时）
  
  weight: number;          // 包裹重量（kg）
  isEMS: boolean;          // 是否EMS
  isReturn: boolean;       // 是否退货
}

// 时效分类 - 统一使用小时作为单位
export type TimeCategory = '24H' | '48H' | '72H' | '72H+';

// 时效统计数据
export interface TimeEfficiencyStats {
  category: TimeCategory;
  deliveryCount: number;           // 该时效分类下的订单数量
  totalOrders: number;             // 总订单数
  deliveryRatio: number;           // 配送率 (%)
  actualVsPlanRatio: number;       // 实际 vs 计划时效比例 (%)
  avgActualTime: number;           // 平均实际时长
  avgPlanTime: number;             // 平均计划时长
}

// 生成模拟订单数据
export const generateLogisticsOrders = (count: number = 5000): LogisticsOrder[] => {
  const orders: LogisticsOrder[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const brand = vfBrands[Math.floor(Math.random() * vfBrands.length)];
    const city = majorCities[Math.floor(Math.random() * majorCities.length)];
    const courierCompany = courierCompanies[Math.floor(Math.random() * courierCompanies.length)];
    
    // 排除EMS和部分退货订单
    const isEMS = Math.random() < 0.05; // 5%的EMS订单，后续会被过滤
    const isReturn = Math.random() < 0.03; // 3%的退货订单，后续会被过滤
    
    // 创建时间在过去30天内 (消费者付款时间)
    const createTime = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    
    // 获取SLA标准
    const sla = findSLA(brand, city, courierCompany);
    
    // 计划时效设置
    const planS2D = sla?.s2dSLA || 24; // S2D计划时效（小时）
    const planC2D = (sla?.c2dSLA || 2) * 24; // C2D计划时效（小时，转换为小时）
    
    // 生成订单状态和时间
    let status: OrderStatus = 'created';
    let pickupTime: Date | undefined;
    let shipTime: Date | undefined;
    let deliveryTime: Date | undefined;
    let returnTime: Date | undefined;
    let actualS2D: number | undefined;
    let actualC2D: number | undefined;
    
    const statusRandom = Math.random();
    
    if (isReturn) {
      // 退货订单
      status = 'returned';
      pickupTime = new Date(createTime.getTime() + Math.random() * 12 * 60 * 60 * 1000);
      shipTime = new Date(pickupTime.getTime() + Math.random() * 24 * 60 * 60 * 1000);
      returnTime = new Date(shipTime.getTime() + Math.random() * 48 * 60 * 60 * 1000);
      actualS2D = (returnTime.getTime() - shipTime.getTime()) / (60 * 60 * 1000);
      actualC2D = (returnTime.getTime() - createTime.getTime()) / (60 * 60 * 1000);
    } else if (statusRandom > 0.9) {
      // 10%取消订单
      status = 'cancelled';
    } else if (statusRandom > 0.2) {
      // 70%已签收订单
      status = 'delivered';
      
      // 揽收时间 (创建后6-18小时)
      pickupTime = new Date(createTime.getTime() + (Math.random() * 12 + 6) * 60 * 60 * 1000);
      
      // 发运时间 (揽收后1-12小时)
      shipTime = new Date(pickupTime.getTime() + (Math.random() * 11 + 1) * 60 * 60 * 1000);
      
      // 签收时间 - 基于计划时效的波动
      const s2dVariation = 0.7 + Math.random() * 0.6; // 0.7-1.3倍的变化
      const c2dVariation = 0.8 + Math.random() * 0.4; // 0.8-1.2倍的变化
      
      const actualS2DTime = planS2D * s2dVariation;
      const actualC2DTime = planC2D * c2dVariation;
      
      deliveryTime = new Date(shipTime.getTime() + actualS2DTime * 60 * 60 * 1000);
      
      // 确保C2D时间合理
      const calculatedDeliveryTime = new Date(createTime.getTime() + actualC2DTime * 60 * 60 * 1000);
      if (calculatedDeliveryTime > deliveryTime) {
        deliveryTime = calculatedDeliveryTime;
      }
      
      actualS2D = (deliveryTime.getTime() - shipTime.getTime()) / (60 * 60 * 1000);
      actualC2D = (deliveryTime.getTime() - createTime.getTime()) / (60 * 60 * 1000);
      
    } else if (statusRandom > 0.1) {
      // 10%已发运订单
      status = 'shipped';
      pickupTime = new Date(createTime.getTime() + (Math.random() * 12 + 6) * 60 * 60 * 1000);
      shipTime = new Date(pickupTime.getTime() + (Math.random() * 11 + 1) * 60 * 60 * 1000);
    } else {
      // 10%已揽收订单
      status = 'picked';
      pickupTime = new Date(createTime.getTime() + Math.random() * 24 * 60 * 60 * 1000);
    }
    
    orders.push({
      id: `ORD${i.toString().padStart(6, '0')}`,
      brand,
      city,
      courierCompany,
      status,
      createTime,
      pickupTime,
      shipTime,
      deliveryTime,
      returnTime,
      actualS2D,
      actualC2D,
      planS2D,
      planC2D,
      weight: Math.random() * 5 + 0.5, // 0.5-5.5kg
      isEMS,
      isReturn
    });
  }
  
  return orders;
};

// 时效分类函数 - 统一使用小时
export const categorizeByTime = (actualTime: number): TimeCategory => {
  if (actualTime <= 24) return '24H';
  if (actualTime <= 48) return '48H';
  if (actualTime <= 72) return '72H';
  return '72H+';
};

// 过滤有效订单（排除EMS和退货）
export const filterValidOrders = (orders: LogisticsOrder[]): LogisticsOrder[] => {
  return orders.filter(order => !order.isEMS && !order.isReturn);
};

// 生成S2D统计数据
export const generateS2DStats = (orders: LogisticsOrder[]): TimeEfficiencyStats[] => {
  const validOrders = filterValidOrders(orders).filter(order => 
    order.actualS2D !== undefined && order.planS2D !== undefined && order.status === 'delivered'
  );
  
  const categories: TimeCategory[] = ['24H', '48H', '72H', '72H+'];
  const stats: TimeEfficiencyStats[] = [];
  const totalOrders = validOrders.length;
  
  categories.forEach(category => {
    const categoryOrders = validOrders.filter(order => 
      categorizeByTime(order.actualS2D!) === category
    );
    
    const deliveryCount = categoryOrders.length;
    const deliveryRatio = totalOrders > 0 ? (deliveryCount / totalOrders) * 100 : 0;
    
    // 计算实际vs计划时效比例
    const avgActualTime = deliveryCount > 0 
      ? categoryOrders.reduce((sum, order) => sum + order.actualS2D!, 0) / deliveryCount 
      : 0;
      
    const avgPlanTime = deliveryCount > 0 
      ? categoryOrders.reduce((sum, order) => sum + order.planS2D!, 0) / deliveryCount 
      : 0;
    
    const actualVsPlanRatio = avgPlanTime > 0 ? (avgActualTime / avgPlanTime) * 100 : 100;
    
    stats.push({
      category,
      deliveryCount,
      totalOrders,
      deliveryRatio,
      actualVsPlanRatio,
      avgActualTime,
      avgPlanTime
    });
  });
  
  return stats;
};

// 生成C2D统计数据
export const generateC2DStats = (orders: LogisticsOrder[]): TimeEfficiencyStats[] => {
  const validOrders = filterValidOrders(orders).filter(order => 
    order.actualC2D !== undefined && order.planC2D !== undefined && order.status === 'delivered'
  );
  
  const categories: TimeCategory[] = ['24H', '48H', '72H', '72H+'];
  const stats: TimeEfficiencyStats[] = [];
  const totalOrders = validOrders.length;
  
  categories.forEach(category => {
    const categoryOrders = validOrders.filter(order => 
      categorizeByTime(order.actualC2D!) === category
    );
    
    const deliveryCount = categoryOrders.length;
    const deliveryRatio = totalOrders > 0 ? (deliveryCount / totalOrders) * 100 : 0;
    
    // 计算实际vs计划时效比例
    const avgActualTime = deliveryCount > 0 
      ? categoryOrders.reduce((sum, order) => sum + order.actualC2D!, 0) / deliveryCount 
      : 0;
      
    const avgPlanTime = deliveryCount > 0 
      ? categoryOrders.reduce((sum, order) => sum + order.planC2D!, 0) / deliveryCount 
      : 0;
    
    const actualVsPlanRatio = avgPlanTime > 0 ? (avgActualTime / avgPlanTime) * 100 : 100;
    
    stats.push({
      category,
      deliveryCount,
      totalOrders,
      deliveryRatio,
      actualVsPlanRatio,
      avgActualTime,
      avgPlanTime
    });
  });
  
  return stats;
};

// 按品牌生成S2D统计
export const generateS2DStatsByBrand = (orders: LogisticsOrder[], selectedBrand?: string): Record<string, TimeEfficiencyStats[]> => {
  const validOrders = filterValidOrders(orders).filter(order => 
    order.actualS2D !== undefined && order.planS2D !== undefined && order.status === 'delivered'
  );
  
  const brands = selectedBrand ? [selectedBrand] : vfBrands;
  const brandStats: Record<string, TimeEfficiencyStats[]> = {};
  
  brands.forEach(brand => {
    const brandOrders = validOrders.filter(order => order.brand === brand);
    brandStats[brand] = generateS2DStats([...brandOrders, ...Array(brandOrders.length).fill(null).map(() => ({ 
      ...brandOrders[0], 
      isEMS: false, 
      isReturn: false 
    }))]);;
  });
  
  return brandStats;
};

// 按品牌生成C2D统计
export const generateC2DStatsByBrand = (orders: LogisticsOrder[], selectedBrand?: string): Record<string, TimeEfficiencyStats[]> => {
  const validOrders = filterValidOrders(orders).filter(order => 
    order.actualC2D !== undefined && order.planC2D !== undefined && order.status === 'delivered'
  );
  
  const brands = selectedBrand ? [selectedBrand] : vfBrands;
  const brandStats: Record<string, TimeEfficiencyStats[]> = {};
  
  brands.forEach(brand => {
    const brandOrders = validOrders.filter(order => order.brand === brand);
    brandStats[brand] = generateC2DStats([...brandOrders, ...Array(brandOrders.length).fill(null).map(() => ({ 
      ...brandOrders[0], 
      isEMS: false, 
      isReturn: false 
    }))]);
  });
  
  return brandStats;
};

// 生成模拟数据
export const logisticsOrders = generateLogisticsOrders(8000);

// 导出统计数据
export const s2dStats = generateS2DStats(logisticsOrders);
export const c2dStats = generateC2DStats(logisticsOrders);

// 为了兼容 useAppState 的导入需要，导出物流订单数据
export const logisticsOrderData = logisticsOrders;

// 默认导出
export default logisticsOrders;