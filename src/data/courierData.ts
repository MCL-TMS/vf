// 快递商分析数据类型定义和模拟数据

export interface CourierData {
  id: string;
  name: string;
  logo: string;
  logoUrl?: string;
  type: 'major' | 'express' | 'local'; // 快递商类型：主要快递商、快递公司、本地配送
  marketShare: number; // 市场占有率(%)
  totalOrders: number; // 总订单量
  activeOrders: number; // 活跃订单数
  completedOrders: number; // 已完成订单数
  performance: CourierPerformance;
  brandDistribution: CourierBrandData[];
  regionCoverage: CourierRegionData[];
  costAnalysis: CourierCostData;
  slaMetrics: CourierSLAData;
}

export interface CourierPerformance {
  deliveryRate: number; // 配送成功率(%)
  onTimeRate: number; // 准时率(%)
  avgDeliveryTime: number; // 平均配送时长(小时)
  exceptionRate: number; // 异常率(%)
  returnRate: number; // 退回率(%)
  customerRating: number; // 客户评分(1-5分)
  trend: 'up' | 'down' | 'stable'; // 趋势
  monthOverMonth: number; // 环比变化(%)
}

export interface CourierBrandData {
  brand: string;
  orders: number;
  percentage: number;
  avgDeliveryTime: number;
  onTimeRate: number;
  avgCost: number;
}

export interface CourierRegionData {
  province: string;
  orders: number;
  percentage: number;
  avgDeliveryTime: number;
  coverage: 'full' | 'partial' | 'limited'; // 覆盖程度
}

export interface CourierCostData {
  avgShippingCost: number; // 平均运费
  costPerOrder: number; // 单均成本
  costTrend: 'up' | 'down' | 'stable';
  monthOverMonth: number; // 成本环比变化(%)
  weightBased: {
    range: string;
    avgCost: number;
    orders: number;
  }[];
}

export interface CourierSLAData {
  pickupSLA: {
    target: number; // 目标时长(小时)
    actual: number; // 实际时长
    achievement: number; // 达成率(%)
  };
  shippingSLA: {
    target: number;
    actual: number;
    achievement: number;
  };
  deliverySLA: {
    target: number;
    actual: number;
    achievement: number;
  };
}

// 快递商异常分析数据
export interface CourierExceptionData {
  courierId: string;
  courierName: string;
  exceptionType: 'pickup_timeout' | 'shipping_timeout' | 'delivery_timeout' | 'lost' | 'damaged' | 'returned';
  exceptionCount: number;
  affectedOrders: number;
  lossAmount: number; // 损失金额
  resolutionTime: number; // 平均解决时长(小时)
  brandImpact: {
    brand: string;
    orders: number;
    lossAmount: number;
  }[];
}

// 快递商对比分析数据
export interface CourierComparisonData {
  metrics: {
    metric: string;
    unit: string;
    couriers: {
      courierId: string;
      courierName: string;
      value: number;
      rank: number;
      trend: 'up' | 'down' | 'stable';
    }[];
  }[];
}

// 模拟数据
export const courierData: CourierData[] = [
  {
    id: 'zhongtong',
    name: '中通快递',
    logo: '📦',
    logoUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=32&h=32&fit=crop&crop=center',
    type: 'major',
    marketShare: 35.2,
    totalOrders: 938756,
    activeOrders: 4632,
    completedOrders: 899234,
    performance: {
      deliveryRate: 96.8,
      onTimeRate: 89.5,
      avgDeliveryTime: 32.5,
      exceptionRate: 2.1,
      returnRate: 1.3,
      customerRating: 4.2,
      trend: 'up',
      monthOverMonth: 3.2
    },
    brandDistribution: [
      { brand: 'TNF', orders: 187751, percentage: 20.0, avgDeliveryTime: 31.2, onTimeRate: 91.2, avgCost: 11.5 },
      { brand: 'DICKIES', orders: 158667, percentage: 16.9, avgDeliveryTime: 33.1, onTimeRate: 88.7, avgCost: 11.8 },
      { brand: 'VANS', orders: 132345, percentage: 14.1, avgDeliveryTime: 32.8, onTimeRate: 89.1, avgCost: 11.2 },
      { brand: 'TIMBERLAND', orders: 103263, percentage: 11.0, avgDeliveryTime: 34.2, onTimeRate: 87.5, avgCost: 12.1 },
      { brand: 'ICEBREAKER', orders: 84488, percentage: 9.0, avgDeliveryTime: 32.9, onTimeRate: 88.9, avgCost: 11.6 },
      { brand: 'KIPLING', orders: 75126, percentage: 8.0, avgDeliveryTime: 33.5, onTimeRate: 88.2, avgCost: 11.4 }
    ],
    regionCoverage: [
      { province: '广东', orders: 234688, percentage: 25.0, avgDeliveryTime: 28.5, coverage: 'full' },
      { province: '江苏', orders: 187751, percentage: 20.0, avgDeliveryTime: 30.2, coverage: 'full' },
      { province: '浙江', orders: 140813, percentage: 15.0, avgDeliveryTime: 29.8, coverage: 'full' },
      { province: '山东', orders: 103263, percentage: 11.0, avgDeliveryTime: 35.1, coverage: 'full' },
      { province: '河北', orders: 84488, percentage: 9.0, avgDeliveryTime: 38.2, coverage: 'partial' },
      { province: '其他', orders: 187751, percentage: 20.0, avgDeliveryTime: 45.8, coverage: 'partial' }
    ],
    costAnalysis: {
      avgShippingCost: 11.6,
      costPerOrder: 9.8,
      costTrend: 'up',
      monthOverMonth: 2.1,
      weightBased: [
        { range: '0-1kg', avgCost: 7.8, orders: 375502 },
        { range: '1-3kg', avgCost: 10.9, orders: 312940 },
        { range: '3-5kg', avgCost: 15.7, orders: 187751 },
        { range: '5kg+', avgCost: 23.2, orders: 131401 }
      ]
    },
    slaMetrics: {
      pickupSLA: { target: 8, actual: 6.2, achievement: 94.5 },
      shippingSLA: { target: 24, actual: 22.1, achievement: 91.8 },
      deliverySLA: { target: 72, actual: 68.5, achievement: 89.5 }
    }
  },
  {
    id: 'shunfeng',
    name: '顺丰速运',
    logo: '⚡',
    logoUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=32&h=32&fit=crop&crop=center',
    type: 'express',
    marketShare: 28.8,
    totalOrders: 768234,
    activeOrders: 3789,
    completedOrders: 738456,
    performance: {
      deliveryRate: 98.2,
      onTimeRate: 94.3,
      avgDeliveryTime: 24.2,
      exceptionRate: 1.3,
      returnRate: 0.8,
      customerRating: 4.6,
      trend: 'up',
      monthOverMonth: 4.1
    },
    brandDistribution: [
      { brand: 'TNF', orders: 153647, percentage: 20.0, avgDeliveryTime: 23.1, onTimeRate: 95.8, avgCost: 16.2 },
      { brand: 'DICKIES', orders: 129872, percentage: 16.9, avgDeliveryTime: 24.8, onTimeRate: 93.9, avgCost: 16.8 },
      { brand: 'VANS', orders: 108321, percentage: 14.1, avgDeliveryTime: 24.2, onTimeRate: 94.5, avgCost: 15.9 },
      { brand: 'TIMBERLAND', orders: 84506, percentage: 11.0, avgDeliveryTime: 25.1, onTimeRate: 92.8, avgCost: 17.3 },
      { brand: 'ICEBREAKER', orders: 69141, percentage: 9.0, avgDeliveryTime: 24.6, onTimeRate: 94.1, avgCost: 16.5 },
      { brand: 'KIPLING', orders: 61459, percentage: 8.0, avgDeliveryTime: 25.3, onTimeRate: 93.2, avgCost: 16.1 }
    ],
    regionCoverage: [
      { province: '广东', orders: 192058, percentage: 25.0, avgDeliveryTime: 20.5, coverage: 'full' },
      { province: '江苏', orders: 153647, percentage: 20.0, avgDeliveryTime: 22.1, coverage: 'full' },
      { province: '浙江', orders: 115235, percentage: 15.0, avgDeliveryTime: 21.8, coverage: 'full' },
      { province: '山东', orders: 84506, percentage: 11.0, avgDeliveryTime: 26.2, coverage: 'full' },
      { province: '北京', orders: 69141, percentage: 9.0, avgDeliveryTime: 18.5, coverage: 'full' },
      { province: '其他', orders: 153647, percentage: 20.0, avgDeliveryTime: 32.8, coverage: 'full' }
    ],
    costAnalysis: {
      avgShippingCost: 16.4,
      costPerOrder: 14.2,
      costTrend: 'stable',
      monthOverMonth: 0.3,
      weightBased: [
        { range: '0-1kg', avgCost: 13.0, orders: 307294 },
        { range: '1-3kg', avgCost: 17.4, orders: 253578 },
        { range: '3-5kg', avgCost: 25.1, orders: 153647 },
        { range: '5kg+', avgCost: 39.2, orders: 107764 }
      ]
    },
    slaMetrics: {
      pickupSLA: { target: 4, actual: 3.1, achievement: 96.8 },
      shippingSLA: { target: 12, actual: 10.5, achievement: 95.2 },
      deliverySLA: { target: 48, actual: 45.2, achievement: 94.3 }
    }
  },
  {
    id: 'yuantong',
    name: '圆通速递',
    logo: '🔵',
    logoUrl: 'https://images.unsplash.com/photo-1601597111158-2fceff292cdc?w=32&h=32&fit=crop&crop=center',
    type: 'major',
    marketShare: 15.8,
    totalOrders: 421367,
    activeOrders: 2078,
    completedOrders: 404812,
    performance: {
      deliveryRate: 95.2,
      onTimeRate: 86.7,
      avgDeliveryTime: 36.8,
      exceptionRate: 2.8,
      returnRate: 1.6,
      customerRating: 3.9,
      trend: 'stable',
      monthOverMonth: -0.5
    },
    brandDistribution: [
      { brand: 'TNF', orders: 84273, percentage: 20.0, avgDeliveryTime: 35.2, onTimeRate: 88.1, avgCost: 10.8 },
      { brand: 'DICKIES', orders: 71211, percentage: 16.9, avgDeliveryTime: 37.5, onTimeRate: 85.9, avgCost: 11.2 },
      { brand: 'VANS', orders: 59413, percentage: 14.1, avgDeliveryTime: 36.9, onTimeRate: 86.5, avgCost: 10.6 },
      { brand: 'TIMBERLAND', orders: 46350, percentage: 11.0, avgDeliveryTime: 38.1, onTimeRate: 84.8, avgCost: 11.5 },
      { brand: 'ICEBREAKER', orders: 37923, percentage: 9.0, avgDeliveryTime: 37.2, onTimeRate: 86.2, avgCost: 10.9 },
      { brand: 'KIPLING', orders: 33709, percentage: 8.0, avgDeliveryTime: 37.8, onTimeRate: 85.5, avgCost: 10.7 }
    ],
    regionCoverage: [
      { province: '广东', orders: 105342, percentage: 25.0, avgDeliveryTime: 32.8, coverage: 'full' },
      { province: '江苏', orders: 84273, percentage: 20.0, avgDeliveryTime: 34.5, coverage: 'full' },
      { province: '浙江', orders: 63205, percentage: 15.0, avgDeliveryTime: 33.9, coverage: 'full' },
      { province: '山东', orders: 46350, percentage: 11.0, avgDeliveryTime: 39.2, coverage: 'partial' },
      { province: '河南', orders: 37923, percentage: 9.0, avgDeliveryTime: 42.1, coverage: 'partial' },
      { province: '其他', orders: 84273, percentage: 20.0, avgDeliveryTime: 48.5, coverage: 'limited' }
    ],
    costAnalysis: {
      avgShippingCost: 10.9,
      costPerOrder: 9.2,
      costTrend: 'up',
      monthOverMonth: 1.8,
      weightBased: [
        { range: '0-1kg', avgCost: 7.2, orders: 168547 },
        { range: '1-3kg', avgCost: 10.3, orders: 139656 },
        { range: '3-5kg', avgCost: 14.8, orders: 84273 },
        { range: '5kg+', avgCost: 21.5, orders: 59014 }
      ]
    },
    slaMetrics: {
      pickupSLA: { target: 8, actual: 7.8, achievement: 88.9 },
      shippingSLA: { target: 24, actual: 26.2, achievement: 84.2 },
      deliverySLA: { target: 72, actual: 78.5, achievement: 86.7 }
    }
  },
  {
    id: 'yunda',
    name: '韵达速递',
    logo: '🟢',
    logoUrl: 'https://images.unsplash.com/photo-1609205968327-5c06e8b7de48?w=32&h=32&fit=crop&crop=center',
    type: 'major',
    marketShare: 12.4,
    totalOrders: 330845,
    activeOrders: 1633,
    completedOrders: 318212,
    performance: {
      deliveryRate: 96.1,
      onTimeRate: 88.2,
      avgDeliveryTime: 34.5,
      exceptionRate: 2.3,
      returnRate: 1.4,
      customerRating: 4.0,
      trend: 'up',
      monthOverMonth: 2.8
    },
    brandDistribution: [
      { brand: 'TNF', orders: 66169, percentage: 20.0, avgDeliveryTime: 33.1, onTimeRate: 89.5, avgCost: 10.2 },
      { brand: 'DICKIES', orders: 55913, percentage: 16.9, avgDeliveryTime: 35.2, onTimeRate: 87.8, avgCost: 10.6 },
      { brand: 'VANS', orders: 46649, percentage: 14.1, avgDeliveryTime: 34.8, onTimeRate: 88.1, avgCost: 10.0 },
      { brand: 'TIMBERLAND', orders: 36393, percentage: 11.0, avgDeliveryTime: 35.9, onTimeRate: 86.9, avgCost: 10.8 },
      { brand: 'ICEBREAKER', orders: 29776, percentage: 9.0, avgDeliveryTime: 34.2, onTimeRate: 88.4, avgCost: 10.3 },
      { brand: 'KIPLING', orders: 26468, percentage: 8.0, avgDeliveryTime: 35.5, onTimeRate: 87.2, avgCost: 10.1 }
    ],
    regionCoverage: [
      { province: '江苏', orders: 82711, percentage: 25.0, avgDeliveryTime: 30.8, coverage: 'full' },
      { province: '浙江', orders: 66169, percentage: 20.0, avgDeliveryTime: 31.5, coverage: 'full' },
      { province: '广东', orders: 49627, percentage: 15.0, avgDeliveryTime: 32.9, coverage: 'full' },
      { province: '山东', orders: 36393, percentage: 11.0, avgDeliveryTime: 37.2, coverage: 'partial' },
      { province: '安徽', orders: 29776, percentage: 9.0, avgDeliveryTime: 39.8, coverage: 'partial' },
      { province: '其他', orders: 66169, percentage: 20.0, avgDeliveryTime: 46.2, coverage: 'limited' }
    ],
    costAnalysis: {
      avgShippingCost: 10.3,
      costPerOrder: 8.9,
      costTrend: 'stable',
      monthOverMonth: 0.8,
      weightBased: [
        { range: '0-1kg', avgCost: 6.8, orders: 132338 },
        { range: '1-3kg', avgCost: 9.7, orders: 109615 },
        { range: '3-5kg', avgCost: 14.2, orders: 66169 },
        { range: '5kg+', avgCost: 20.8, orders: 46361 }
      ]
    },
    slaMetrics: {
      pickupSLA: { target: 8, actual: 7.2, achievement: 91.2 },
      shippingSLA: { target: 24, actual: 24.8, achievement: 86.5 },
      deliverySLA: { target: 72, actual: 75.2, achievement: 88.2 }
    }
  },
  {
    id: 'jingdong',
    name: '京东物流',
    logo: '🔴',
    logoUrl: 'https://images.unsplash.com/photo-1607083681285-9feb2c0b8cb5?w=32&h=32&fit=crop&crop=center',
    type: 'express',
    marketShare: 8.0,
    totalOrders: 213423,
    activeOrders: 1053,
    completedOrders: 205134,
    performance: {
      deliveryRate: 97.8,
      onTimeRate: 92.1,
      avgDeliveryTime: 28.9,
      exceptionRate: 1.6,
      returnRate: 0.9,
      customerRating: 4.4,
      trend: 'up',
      monthOverMonth: 5.2
    },
    brandDistribution: [
      { brand: 'TNF', orders: 42685, percentage: 20.0, avgDeliveryTime: 27.8, onTimeRate: 93.2, avgCost: 14.5 },
      { brand: 'DICKIES', orders: 36068, percentage: 16.9, avgDeliveryTime: 29.1, onTimeRate: 91.8, avgCost: 14.9 },
      { brand: 'VANS', orders: 30083, percentage: 14.1, avgDeliveryTime: 28.5, onTimeRate: 92.5, avgCost: 14.2 },
      { brand: 'TIMBERLAND', orders: 23477, percentage: 11.0, avgDeliveryTime: 30.2, onTimeRate: 90.8, avgCost: 15.1 },
      { brand: 'ICEBREAKER', orders: 19208, percentage: 9.0, avgDeliveryTime: 28.9, onTimeRate: 92.0, avgCost: 14.6 },
      { brand: 'KIPLING', orders: 17074, percentage: 8.0, avgDeliveryTime: 29.8, onTimeRate: 91.5, avgCost: 14.3 }
    ],
    regionCoverage: [
      { province: '北京', orders: 53356, percentage: 25.0, avgDeliveryTime: 24.5, coverage: 'full' },
      { province: '上海', orders: 42685, percentage: 20.0, avgDeliveryTime: 25.8, coverage: 'full' },
      { province: '广东', orders: 32014, percentage: 15.0, avgDeliveryTime: 27.2, coverage: 'full' },
      { province: '江苏', orders: 23477, percentage: 11.0, avgDeliveryTime: 29.5, coverage: 'full' },
      { province: '浙江', orders: 19208, percentage: 9.0, avgDeliveryTime: 28.8, coverage: 'full' },
      { province: '其他', orders: 42685, percentage: 20.0, avgDeliveryTime: 35.2, coverage: 'partial' }
    ],
    costAnalysis: {
      avgShippingCost: 14.6,
      costPerOrder: 12.8,
      costTrend: 'up',
      monthOverMonth: 1.5,
      weightBased: [
        { range: '0-1kg', avgCost: 11.8, orders: 85369 },
        { range: '1-3kg', avgCost: 15.2, orders: 70727 },
        { range: '3-5kg', avgCost: 18.9, orders: 42685 },
        { range: '5kg+', avgCost: 26.8, orders: 29909 }
      ]
    },
    slaMetrics: {
      pickupSLA: { target: 6, actual: 4.8, achievement: 94.5 },
      shippingSLA: { target: 18, actual: 16.2, achievement: 93.8 },
      deliverySLA: { target: 48, actual: 44.5, achievement: 92.1 }
    }
  }
];

// 快递商异常数据
export const courierExceptionData: CourierExceptionData[] = [
  {
    courierId: 'zhongtong',
    courierName: '中通快递',
    exceptionType: 'delivery_timeout',
    exceptionCount: 1842,
    affectedOrders: 19734,
    lossAmount: 156780,
    resolutionTime: 8.5,
    brandImpact: [
      { brand: 'TNF', orders: 3947, lossAmount: 31356 },
      { brand: 'DICKIES', orders: 3334, lossAmount: 26677 },
      { brand: 'VANS', orders: 2781, lossAmount: 22245 },
      { brand: 'TIMBERLAND', orders: 2171, lossAmount: 17366 },
      { brand: 'ICEBREAKER', orders: 1776, lossAmount: 14209 },
      { brand: 'KIPLING', orders: 1579, lossAmount: 12632 }
    ]
  },
  {
    courierId: 'shunfeng',
    courierName: '顺丰速运',
    exceptionType: 'pickup_timeout',
    exceptionCount: 897,
    affectedOrders: 9987,
    lossAmount: 89876,
    resolutionTime: 4.2,
    brandImpact: [
      { brand: 'TNF', orders: 1997, lossAmount: 17975 },
      { brand: 'DICKIES', orders: 1688, lossAmount: 15191 },
      { brand: 'VANS', orders: 1408, lossAmount: 12672 },
      { brand: 'TIMBERLAND', orders: 1099, lossAmount: 9889 },
      { brand: 'ICEBREAKER', orders: 899, lossAmount: 8091 },
      { brand: 'KIPLING', orders: 799, lossAmount: 7192 }
    ]
  }
];

// 快递商对比分析数据
export const courierComparisonData: CourierComparisonData = {
  metrics: [
    {
      metric: '配送成功率',
      unit: '%',
      couriers: [
        { courierId: 'shunfeng', courierName: '顺丰速运', value: 98.2, rank: 1, trend: 'up' },
        { courierId: 'jingdong', courierName: '京东物流', value: 97.8, rank: 2, trend: 'up' },
        { courierId: 'zhongtong', courierName: '中通快递', value: 96.8, rank: 3, trend: 'up' },
        { courierId: 'yunda', courierName: '韵达速递', value: 96.1, rank: 4, trend: 'up' },
        { courierId: 'yuantong', courierName: '圆通速递', value: 95.2, rank: 5, trend: 'stable' }
      ]
    },
    {
      metric: '准时率',
      unit: '%',
      couriers: [
        { courierId: 'shunfeng', courierName: '顺丰速运', value: 94.3, rank: 1, trend: 'up' },
        { courierId: 'jingdong', courierName: '京东物流', value: 92.1, rank: 2, trend: 'up' },
        { courierId: 'zhongtong', courierName: '中通快递', value: 89.5, rank: 3, trend: 'up' },
        { courierId: 'yunda', courierName: '韵达速递', value: 88.2, rank: 4, trend: 'up' },
        { courierId: 'yuantong', courierName: '圆通速递', value: 86.7, rank: 5, trend: 'stable' }
      ]
    },
    {
      metric: '客户评分',
      unit: '分',
      couriers: [
        { courierId: 'shunfeng', courierName: '顺丰速运', value: 4.6, rank: 1, trend: 'up' },
        { courierId: 'jingdong', courierName: '京东物流', value: 4.4, rank: 2, trend: 'up' },
        { courierId: 'zhongtong', courierName: '中通快递', value: 4.2, rank: 3, trend: 'up' },
        { courierId: 'yunda', courierName: '韵达速递', value: 4.0, rank: 4, trend: 'up' },
        { courierId: 'yuantong', courierName: '圆通速递', value: 3.9, rank: 5, trend: 'stable' }
      ]
    },
    {
      metric: '平均配送时长',
      unit: '小时',
      couriers: [
        { courierId: 'shunfeng', courierName: '顺丰速运', value: 24.2, rank: 1, trend: 'down' },
        { courierId: 'jingdong', courierName: '京东物流', value: 28.9, rank: 2, trend: 'down' },
        { courierId: 'zhongtong', courierName: '中通快递', value: 32.5, rank: 3, trend: 'down' },
        { courierId: 'yunda', courierName: '韵达速递', value: 34.5, rank: 4, trend: 'stable' },
        { courierId: 'yuantong', courierName: '圆通速递', value: 36.8, rank: 5, trend: 'up' }
      ]
    },
    {
      metric: '异常率',
      unit: '%',
      couriers: [
        { courierId: 'shunfeng', courierName: '顺丰速运', value: 1.3, rank: 1, trend: 'down' },
        { courierId: 'jingdong', courierName: '京东物流', value: 1.6, rank: 2, trend: 'down' },
        { courierId: 'zhongtong', courierName: '中通快递', value: 2.1, rank: 3, trend: 'down' },
        { courierId: 'yunda', courierName: '韵达速递', value: 2.3, rank: 4, trend: 'stable' },
        { courierId: 'yuantong', courierName: '圆通速递', value: 2.8, rank: 5, trend: 'up' }
      ]
    }
  ]
};

export default courierData;