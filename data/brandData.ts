// VF Logo as data URL placeholder
const vfLogo = "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=32&h=32&fit=crop&crop=center";

export interface BrandOrderData {
  name: string;
  logo: string;
  logoUrl?: string; // 品牌logo图片URL
  totalOrders: number;
  kpiData: {
    picked: { value: number; change: { mom: number; yoy: number } };
    shipped: { value: number; change: { mom: number; yoy: number } };
    delivered: { value: number; change: { mom: number; yoy: number } };
    forwarded: { value: number; change: { mom: number; yoy: number } };
    returned: { value: number; change: { mom: number; yoy: number } };
    cancelled: { value: number; change: { mom: number; yoy: number } };
  };
  courierDistribution: {
    name: string;
    orders: number;
    percentage: number;
    performance: {
      pickupRate: number;
      shippingRate: number;
      deliveryRate: number;
      exceptions: number;
    };
  }[];
  regionalDistribution: {
    region: string;
    orders: number;
    percentage: number;
    growth: number;
  }[];
  monthlyTrend: {
    month: string;
    orders: number;
    growth: number;
  }[];
  topDestinations: {
    city: string;
    orders: number;
    percentage: number;
  }[];
  exceptions: {
    type: string;
    count: number;
    trend: number;
    description: string;
  }[];
}

export const brandOrderData: BrandOrderData[] = [
  {
    name: 'VF',
    logo: '🏢',
    logoUrl: vfLogo,
    totalOrders: 2665585, // 作为总品牌的总数
    kpiData: {
      picked: { value: 13161, change: { mom: 10.2, yoy: 18.5 } },
      shipped: { value: 85153, change: { mom: -1.5, yoy: 14.2 } },
      delivered: { value: 2522821, change: { mom: 15.2, yoy: 28.9 } },
      forwarded: { value: 2202, change: { mom: -8.7, yoy: -3.1 } },
      returned: { value: 15585, change: { mom: -6.3, yoy: -2.8 } },
      cancelled: { value: 275, change: { mom: -12.8, yoy: -15.4 } }
    },
    courierDistribution: [
      { 
        name: '中通', 
        orders: 1546039, 
        percentage: 58.0,
        performance: { pickupRate: 96.5, shippingRate: 97.8, deliveryRate: 97.2, exceptions: 89 }
      },
      { 
        name: '顺丰', 
        orders: 1119546, 
        percentage: 42.0,
        performance: { pickupRate: 98.9, shippingRate: 99.1, deliveryRate: 98.7, exceptions: 32 }
      }
    ],
    regionalDistribution: [
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
      { type: '超时未签收', count: 98, trend: -15.7, description: '发运后超过3天未签收' },
      { type: '地址异常', count: 67, trend: -22.8, description: '收货地址不详或错误' }
    ]
  },
  {
    name: 'TNF',
    logo: '🏔️',
    logoUrl: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=32&h=32&fit=crop&crop=center',
    totalOrders: 532580,
    kpiData: {
      picked: { value: 2634, change: { mom: 8.5, yoy: 15.2 } },
      shipped: { value: 17031, change: { mom: -1.2, yoy: 12.8 } },
      delivered: { value: 491668, change: { mom: 18.5, yoy: 32.1 } },
      forwarded: { value: 441, change: { mom: -25.3, yoy: -8.1 } },
      returned: { value: 3117, change: { mom: -12.4, yoy: -5.6 } },
      cancelled: { value: 55, change: { mom: -58.2, yoy: -32.1 } }
    },
    courierDistribution: [
      { 
        name: '中通', 
        orders: 319548, 
        percentage: 60.0,
        performance: { pickupRate: 96.2, shippingRate: 97.1, deliveryRate: 96.8, exceptions: 23 }
      },
      { 
        name: '顺丰', 
        orders: 213032, 
        percentage: 40.0,
        performance: { pickupRate: 98.8, shippingRate: 99.2, deliveryRate: 99.0, exceptions: 8 }
      }
    ],
    regionalDistribution: [
      { region: '华东', orders: 159774, percentage: 30.0, growth: 12.5 },
      { region: '华南', orders: 133145, percentage: 25.0, growth: 8.2 },
      { region: '华北', orders: 106516, percentage: 20.0, growth: 15.1 },
      { region: '西南', orders: 79887, percentage: 15.0, growth: 6.8 },
      { region: '其他', orders: 53258, percentage: 10.0, growth: 3.2 }
    ],
    monthlyTrend: [
      { month: '1月', orders: 41240, growth: 8.2 },
      { month: '2月', orders: 38650, growth: 12.5 },
      { month: '3月', orders: 45880, growth: 15.3 },
      { month: '4月', orders: 48920, growth: 18.7 },
      { month: '5月', orders: 52340, growth: 22.1 },
      { month: '6月', orders: 49870, growth: 19.4 }
    ],
    topDestinations: [
      { city: '上海', orders: 42605, percentage: 8.0 },
      { city: '北京', orders: 37431, percentage: 7.0 },
      { city: '深圳', orders: 31954, percentage: 6.0 },
      { city: '广州', orders: 26629, percentage: 5.0 },
      { city: '杭州', orders: 21303, percentage: 4.0 }
    ],
    exceptions: [
      { type: '超时未揽收', count: 23, trend: -15.2, description: '已出库超过2小时未揽收' },
      { type: '超时未发运', count: 35, trend: -8.5, description: '揽收后超过12小时未发运' },
      { type: '超时未签收', count: 28, trend: -12.3, description: '发运后超过3天未签收' },
      { type: '地址异常', count: 18, trend: -22.1, description: '收货地址不详或错误' }
    ]
  },
  {
    name: 'Dickies',
    logo: '👔',
    logoUrl: 'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=32&h=32&fit=crop&crop=center',
    totalOrders: 425486,
    kpiData: {
      picked: { value: 2107, change: { mom: 12.3, yoy: 18.7 } },
      shipped: { value: 13604, change: { mom: -2.8, yoy: 9.4 } },
      delivered: { value: 393637, change: { mom: 19.2, yoy: 29.8 } },
      forwarded: { value: 352, change: { mom: -18.9, yoy: -12.3 } },
      returned: { value: 2492, change: { mom: -8.7, yoy: -3.2 } },
      cancelled: { value: 44, change: { mom: -61.8, yoy: -28.9 } }
    },
    courierDistribution: [
      { 
        name: '中通', 
        orders: 234267, 
        percentage: 55.0,
        performance: { pickupRate: 95.8, shippingRate: 97.2, deliveryRate: 96.9, exceptions: 19 }
      },
      { 
        name: '顺丰', 
        orders: 191219, 
        percentage: 45.0,
        performance: { pickupRate: 98.9, shippingRate: 99.3, deliveryRate: 99.1, exceptions: 6 }
      }
    ],
    regionalDistribution: [
      { region: '华南', orders: 127646, percentage: 30.0, growth: 14.2 },
      { region: '华东', orders: 106372, percentage: 25.0, growth: 10.8 },
      { region: '华北', orders: 85097, percentage: 20.0, growth: 18.3 },
      { region: '西南', orders: 63823, percentage: 15.0, growth: 7.9 },
      { region: '其他', orders: 42549, percentage: 10.0, growth: 4.1 }
    ],
    monthlyTrend: [
      { month: '1月', orders: 32992, growth: 6.8 },
      { month: '2月', orders: 30920, growth: 9.2 },
      { month: '3月', orders: 36684, growth: 12.4 },
      { month: '4月', orders: 39136, growth: 15.7 },
      { month: '5月', orders: 41872, growth: 19.1 },
      { month: '6月', orders: 39896, growth: 16.8 }
    ],
    topDestinations: [
      { city: '广州', orders: 34039, percentage: 8.0 },
      { city: '深圳', orders: 29781, percentage: 7.0 },
      { city: '上海', orders: 25549, percentage: 6.0 },
      { city: '北京', orders: 21274, percentage: 5.0 },
      { city: '成都', orders: 17024, percentage: 4.0 }
    ],
    exceptions: [
      { type: '超时未揽收', count: 19, trend: -18.5, description: '已出库超过2小时未揽收' },
      { type: '超时未发运', count: 28, trend: -12.3, description: '揽收后超过12小时未发运' },
      { type: '超时未签收', count: 22, trend: -15.8, description: '发运后超过3天未签收' },
      { type: '包装异常', count: 14, trend: -8.7, description: '包装破损或不当' }
    ]
  },
  {
    name: 'Timberland',
    logo: '🥾',
    logoUrl: 'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=32&h=32&fit=crop&crop=center',
    totalOrders: 372831,
    kpiData: {
      picked: { value: 1847, change: { mom: 15.7, yoy: 22.3 } },
      shipped: { value: 11931, change: { mom: -0.8, yoy: 11.2 } },
      delivered: { value: 344513, change: { mom: 17.8, yoy: 30.5 } },
      forwarded: { value: 309, change: { mom: -32.1, yoy: -15.8 } },
      returned: { value: 2186, change: { mom: -15.2, yoy: -7.1 } },
      cancelled: { value: 39, change: { mom: -72.1, yoy: -41.2 } }
    },
    courierDistribution: [
      { 
        name: '顺丰', 
        orders: 223698, 
        percentage: 60.0,
        performance: { pickupRate: 99.1, shippingRate: 99.4, deliveryRate: 99.2, exceptions: 4 }
      },
      { 
        name: '中通', 
        orders: 149133, 
        percentage: 40.0,
        performance: { pickupRate: 95.7, shippingRate: 97.3, deliveryRate: 97.0, exceptions: 18 }
      }
    ],
    regionalDistribution: [
      { region: '华北', orders: 111849, percentage: 30.0, growth: 16.8 },
      { region: '华东', orders: 93208, percentage: 25.0, growth: 13.2 },
      { region: '华南', orders: 74566, percentage: 20.0, growth: 11.7 },
      { region: '西南', orders: 55925, percentage: 15.0, growth: 9.4 },
      { region: '其他', orders: 37283, percentage: 10.0, growth: 5.8 }
    ],
    monthlyTrend: [
      { month: '1月', orders: 28907, growth: 10.2 },
      { month: '2月', orders: 27116, growth: 13.8 },
      { month: '3月', orders: 32154, growth: 16.9 },
      { month: '4月', orders: 34310, growth: 20.4 },
      { month: '5月', orders: 36706, growth: 24.1 },
      { month: '6月', orders: 34988, growth: 21.7 }
    ],
    topDestinations: [
      { city: '北京', orders: 29826, percentage: 8.0 },
      { city: '上海', orders: 26098, percentage: 7.0 },
      { city: '天津', orders: 22370, percentage: 6.0 },
      { city: '杭州', orders: 18642, percentage: 5.0 },
      { city: '南京', orders: 14913, percentage: 4.0 }
    ],
    exceptions: [
      { type: '超时未揽收', count: 16, trend: -22.1, description: '已出库超过2小时未揽收' },
      { type: '超时未发运', count: 24, trend: -15.8, description: '揽收后超过12小时未发运' },
      { type: '超时未签收', count: 19, trend: -18.3, description: '发运后超过3天未签收' },
      { type: '尺寸异常', count: 12, trend: -18.9, description: '包裹尺寸超出标准' }
    ]
  },
  {
    name: 'Vans',
    logo: '👟',
    logoUrl: 'https://images.unsplash.com/photo-1552066344-2464c1135c32?w=32&h=32&fit=crop&crop=center',
    totalOrders: 319675,
    kpiData: {
      picked: { value: 1583, change: { mom: 18.2, yoy: 25.4 } },
      shipped: { value: 10227, change: { mom: 1.2, yoy: 14.8 } },
      delivered: { value: 295081, change: { mom: 16.9, yoy: 28.7 } },
      forwarded: { value: 265, change: { mom: -28.7, yoy: -18.3 } },
      returned: { value: 1873, change: { mom: -18.9, yoy: -9.2 } },
      cancelled: { value: 33, change: { mom: -69.8, yoy: -35.7 } }
    },
    courierDistribution: [
      { 
        name: '中通', 
        orders: 191805, 
        percentage: 60.0,
        performance: { pickupRate: 96.8, shippingRate: 98.2, deliveryRate: 97.9, exceptions: 14 }
      },
      { 
        name: '顺丰', 
        orders: 127870, 
        percentage: 40.0,
        performance: { pickupRate: 99.2, shippingRate: 99.5, deliveryRate: 99.3, exceptions: 3 }
      }
    ],
    regionalDistribution: [
      { region: '华东', orders: 95903, percentage: 30.0, growth: 18.7 },
      { region: '华南', orders: 79919, percentage: 25.0, growth: 15.3 },
      { region: '华北', orders: 63935, percentage: 20.0, growth: 12.8 },
      { region: '西南', orders: 47951, percentage: 15.0, growth: 10.4 },
      { region: '其他', orders: 31968, percentage: 10.0, growth: 6.9 }
    ],
    monthlyTrend: [
      { month: '1月', orders: 24774, growth: 12.8 },
      { month: '2月', orders: 23238, growth: 16.2 },
      { month: '3月', orders: 27571, growth: 19.8 },
      { month: '4月', orders: 29421, growth: 23.5 },
      { month: '5月', orders: 31461, growth: 27.3 },
      { month: '6月', orders: 30007, growth: 24.9 }
    ],
    topDestinations: [
      { city: '上海', orders: 25574, percentage: 8.0 },
      { city: '杭州', orders: 22377, percentage: 7.0 },
      { city: '南京', orders: 19181, percentage: 6.0 },
      { city: '广州', orders: 15984, percentage: 5.0 },
      { city: '深圳', orders: 12787, percentage: 4.0 }
    ],
    exceptions: [
      { type: '超时未揽收', count: 14, trend: -25.8, description: '已出库超过2小时未揽收' },
      { type: '超时未发运', count: 20, trend: -18.7, description: '揽收后超过12小时未发运' },
      { type: '超时未签收', count: 16, trend: -21.4, description: '发运后超过3天未签收' },
      { type: '重量异常', count: 9, trend: -28.3, description: '包裹重量与预期不符' }
    ]
  }
];