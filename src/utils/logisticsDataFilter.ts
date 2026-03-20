import { LogisticsOrder } from "../data/logisticsOrderData";
import type { LogisticsExceptionFilter } from "../data/types";

// 根据品牌筛选物流订单数据
export const filterLogisticsOrdersByBrand = (orders: LogisticsOrder[], selectedBrand: string): LogisticsOrder[] => {
  if (!selectedBrand) return orders;
  return orders.filter(order => order.brand === selectedBrand);
};

// 根据快递公司筛选
export const filterLogisticsOrdersByCourier = (orders: LogisticsOrder[], selectedCourier: string): LogisticsOrder[] => {
  if (!selectedCourier) return orders;
  return orders.filter(order => order.courierCompany === selectedCourier);
};

// 根据城市筛选
export const filterLogisticsOrdersByCity = (orders: LogisticsOrder[], selectedCity: string): LogisticsOrder[] => {
  if (!selectedCity) return orders;
  return orders.filter(order => order.city === selectedCity);
};

// 根据订单状态筛选
export const filterLogisticsOrdersByStatus = (orders: LogisticsOrder[], status: string): LogisticsOrder[] => {
  if (!status) return orders;
  return orders.filter(order => order.status === status);
};

// 根据时间范围筛选
export const filterLogisticsOrdersByDateRange = (orders: LogisticsOrder[], startDate: Date, endDate: Date): LogisticsOrder[] => {
  return orders.filter(order => 
    order.createTime >= startDate && order.createTime <= endDate
  );
};

// 综合筛选函数
export const filterLogisticsOrders = (
  orders: LogisticsOrder[],
  filters: {
    brand?: string;
    courier?: string;
    city?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }
): LogisticsOrder[] => {
  let filteredOrders = orders;

  if (filters.brand) {
    filteredOrders = filterLogisticsOrdersByBrand(filteredOrders, filters.brand);
  }

  if (filters.courier) {
    filteredOrders = filterLogisticsOrdersByCourier(filteredOrders, filters.courier);
  }

  if (filters.city) {
    filteredOrders = filterLogisticsOrdersByCity(filteredOrders, filters.city);
  }

  if (filters.status) {
    filteredOrders = filterLogisticsOrdersByStatus(filteredOrders, filters.status);
  }

  if (filters.startDate && filters.endDate) {
    filteredOrders = filterLogisticsOrdersByDateRange(filteredOrders, filters.startDate, filters.endDate);
  }

  return filteredOrders;
};

// useAppState 需要的主要筛选函数
export const filterLogisticsData = (
  orders: LogisticsOrder[],
  selectedBrand: string | null,
  logisticsExceptionFilter: LogisticsExceptionFilter
): LogisticsOrder[] => {
  let filteredOrders = orders;

  // 按品牌筛选
  if (selectedBrand && selectedBrand !== 'all') {
    filteredOrders = filterLogisticsOrdersByBrand(filteredOrders, selectedBrand);
  }

  // 按异常类型筛选
  if (logisticsExceptionFilter.type) {
    filteredOrders = filteredOrders.filter(order => {
      switch (logisticsExceptionFilter.type) {
        case 'pickup_timeout':
          // 超时未揽收 - 订单创建超过2小时未被揽收
          return order.status === 'created' && 
                 order.createTime && 
                 (Date.now() - order.createTime.getTime()) > 2 * 60 * 60 * 1000;
        
        case 'shipping_timeout':
          // 超时未发运 - 已揽收超过12小时未发运
          return order.status === 'picked' && 
                 order.pickupTime && 
                 (Date.now() - order.pickupTime.getTime()) > 12 * 60 * 60 * 1000;
        
        case 'delivery_timeout':
          // 超时未签收 - 已发运超过3天未签收
          return order.status === 'shipped' && 
                 order.shipTime && 
                 (Date.now() - order.shipTime.getTime()) > 3 * 24 * 60 * 60 * 1000;
        
        default:
          return true;
      }
    });
  }

  // 按快递公司筛选
  if (logisticsExceptionFilter.courier) {
    filteredOrders = filterLogisticsOrdersByCourier(filteredOrders, logisticsExceptionFilter.courier);
  }

  return filteredOrders;
};

// 计算筛选后的汇总统计
export const calculateFilteredLogisticsStats = (orders: LogisticsOrder[]) => {
  const totalOrders = orders.length;
  const validOrders = orders.filter(order => !order.isEMS && !order.isReturn);
  
  const deliveredOrders = validOrders.filter(order => order.status === 'delivered');
  const shippedOrders = validOrders.filter(order => order.actualS2D !== undefined);
  
  const avgS2D = shippedOrders.length > 0 
    ? shippedOrders.reduce((sum, order) => sum + (order.actualS2D || 0), 0) / shippedOrders.length 
    : 0;
    
  const avgC2D = deliveredOrders.length > 0 
    ? deliveredOrders.reduce((sum, order) => sum + (order.actualC2D || 0), 0) / deliveredOrders.length 
    : 0;

  const s2dOnTimeCount = shippedOrders.filter(order => (order.actualS2D || 0) <= 72).length;
  const s2dOnTimeRate = shippedOrders.length > 0 ? (s2dOnTimeCount / shippedOrders.length) * 100 : 0;

  const c2dFastCount = deliveredOrders.filter(order => (order.actualC2D || 0) <= 2).length;
  const c2dFastRate = deliveredOrders.length > 0 ? (c2dFastCount / deliveredOrders.length) * 100 : 0;

  return {
    totalOrders,
    validOrders: validOrders.length,
    deliveredOrders: deliveredOrders.length,
    avgS2D,
    avgC2D,
    s2dOnTimeRate,
    c2dFastRate
  };
};