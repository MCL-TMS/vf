import type { FilteredData as OriginalFilteredData } from './dataFilter';

// 扩展的FilteredData接口，包含交叉分析数据和总单量增长数据
export interface FilteredData extends Omit<OriginalFilteredData, 'brandStats'> {
  // 🔥 扩展brandStats，添加总单量的完整同比环比数据
  brandStats: {
    totalOrders: number | null;
    marketShare: number | null;
    growth: number | null;
    // 🔥 新增：完整的总单量增长数据
    totalOrdersGrowth?: {
      mom: number | null;
      yoy: number | null;
    };
  };

  // 🔥 新增：交叉分析数据 - 为CrossAnalysisChart组件提供品牌×平台矩阵数据
  crossAnalysisData?: Array<{
    brandName: string;
    platformClass: string;
    totalOrders: number;
    pickedOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    forwardedOrders: number;
    returnedOrders: number;
    cancelledOrders: number;
    avgDeliveryTime: number;
    deliveryRate: number;
    exceptionRate: number;
  }>;
}