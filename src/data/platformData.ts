export interface PlatformData {
  name: string;
  displayName: string;
  logo: string;
  color: string;
  orders: number;
  marketShare: number;
  performance: {
    conversionRate: number;
    avgOrderValue: number;
    customerSatisfaction: number;
  };
}

export interface PlatformKPIData {
  platform: string;
  kpiData: {
    picked: { value: number; change: { mom: number; yoy: number } };
    shipped: { value: number; change: { mom: number; yoy: number } };
    delivered: { value: number; change: { mom: number; yoy: number } };
    forwarded: { value: number; change: { mom: number; yoy: number } };
    returned: { value: number; change: { mom: number; yoy: number } };
    cancelled: { value: number; change: { mom: number; yoy: number } };
    firstDeliveryRate: { value: number; change: { mom: number; yoy: number } };
  };
  courierDistribution: {
    courier: string;
    orders: number;
    percentage: number;
    performance: {
      deliveryRate: number;
      pickupRate: number;
      shippingRate: number;
      avgDeliveryTime: number;
    };
  }[];
}

export interface BrandPlatformCrossData {
  brand: string;
  platform: string;
  orders: number;
  marketShare: number;
  performance: {
    deliveryRate: number;
    firstDeliveryTime: number;
    customerRating: number;
    returnRate: number;
  };
  kpiBreakdown: {
    picked: number;
    shipped: number;
    delivered: number;
    forwarded: number;
    returned: number;
    cancelled: number;
  };
}

// 平台基础数据 - 与TopToolbar中的8个平台保持一致
export const platformsData: PlatformData[] = [
  {
    name: 'tmall',
    displayName: '天猫',
    logo: '🛍️',
    color: '#FF6600',
    orders: 1199513,
    marketShare: 35.0,
    performance: {
      conversionRate: 4.2,
      avgOrderValue: 186.8,
      customerSatisfaction: 4.6
    }
  },
  {
    name: 'douyin',
    displayName: '抖音',
    logo: '🎵',
    color: '#000000',
    orders: 426634,
    marketShare: 18.0,
    performance: {
      conversionRate: 2.9,
      avgOrderValue: 98.7,
      customerSatisfaction: 4.3
    }
  },
  {
    name: 'jd',
    displayName: '京东',
    logo: '🛒',
    color: '#E3101E',
    orders: 799675,
    marketShare: 22.0,
    performance: {
      conversionRate: 3.8,
      avgOrderValue: 156.4,
      customerSatisfaction: 4.5
    }
  },
  {
    name: 'pdd',
    displayName: '拼多多',
    logo: '🍊',
    color: '#FF5722',
    orders: 312547,
    marketShare: 12.0,
    performance: {
      conversionRate: 3.5,
      avgOrderValue: 89.6,
      customerSatisfaction: 4.2
    }
  },
  {
    name: 'official',
    displayName: '官网/小程序',
    logo: '🏪',
    color: '#2196F3',
    orders: 156273,
    marketShare: 6.0,
    performance: {
      conversionRate: 5.2,
      avgOrderValue: 245.3,
      customerSatisfaction: 4.7
    }
  },
  {
    name: 'o2o',
    displayName: 'O2O',
    logo: '🚀',
    color: '#9C27B0',
    orders: 104182,
    marketShare: 4.0,
    performance: {
      conversionRate: 4.8,
      avgOrderValue: 198.7,
      customerSatisfaction: 4.5
    }
  },
  {
    name: 'xiaohongshu',
    displayName: '小红书',
    logo: '📖',
    color: '#FF4081',
    orders: 78136,
    marketShare: 2.5,
    performance: {
      conversionRate: 3.1,
      avgOrderValue: 167.2,
      customerSatisfaction: 4.4
    }
  },
  {
    name: 'wechat',
    displayName: '微信小程序',
    logo: '💬',
    color: '#4CAF50',
    orders: 52091,
    marketShare: 1.5,
    performance: {
      conversionRate: 4.0,
      avgOrderValue: 134.8,
      customerSatisfaction: 4.3
    }
  }
];

// 平台KPI数据 - 扩展到8个平台
export const platformKPIData: PlatformKPIData[] = [
  {
    platform: 'tmall',
    kpiData: {
      picked: { value: 5935, change: { mom: 8.2, yoy: 15.6 } },
      shipped: { value: 38371, change: { mom: -2.1, yoy: 12.8 } },
      delivered: { value: 1106307, change: { mom: 12.4, yoy: 28.9 } },
      forwarded: { value: 991, change: { mom: -28.5, yoy: -8.3 } },
      returned: { value: 7013, change: { mom: -15.2, yoy: -5.7 } },
      cancelled: { value: 124, change: { mom: -62.1, yoy: -38.4 } },
      firstDeliveryRate: { value: 93.8, change: { mom: 2.1, yoy: 4.8 } }
    },
    courierDistribution: [
      { courier: '中通', orders: 695658, percentage: 58.0, performance: { deliveryRate: 96.8, pickupRate: 96.2, shippingRate: 97.1, avgDeliveryTime: 28.5 } },
      { courier: '顺丰', orders: 503855, percentage: 42.0, performance: { deliveryRate: 98.5, pickupRate: 98.8, shippingRate: 99.0, avgDeliveryTime: 22.3 } }
    ]
  },
  {
    platform: 'douyin',
    kpiData: {
      picked: { value: 2111, change: { mom: 15.3, yoy: 32.7 } },
      shipped: { value: 13651, change: { mom: 3.2, yoy: 28.1 } },
      delivered: { value: 393810, change: { mom: 18.7, yoy: 45.2 } },
      forwarded: { value: 353, change: { mom: -25.8, yoy: -15.9 } },
      returned: { value: 2497, change: { mom: -12.4, yoy: -8.9 } },
      cancelled: { value: 44, change: { mom: -71.3, yoy: -52.6 } },
      firstDeliveryRate: { value: 89.6, change: { mom: 3.2, yoy: 6.8 } }
    },
    courierDistribution: [
      { courier: '中通', orders: 247448, percentage: 58.0, performance: { deliveryRate: 96.2, pickupRate: 95.8, shippingRate: 96.9, avgDeliveryTime: 31.2 } },
      { courier: '顺丰', orders: 179186, percentage: 42.0, performance: { deliveryRate: 98.1, pickupRate: 98.4, shippingRate: 98.7, avgDeliveryTime: 23.6 } }
    ]
  },
  {
    platform: 'jd',
    kpiData: {
      picked: { value: 3957, change: { mom: 6.8, yoy: 18.2 } },
      shipped: { value: 25581, change: { mom: -1.8, yoy: 14.5 } },
      delivered: { value: 737741, change: { mom: 10.9, yoy: 25.6 } },
      forwarded: { value: 661, change: { mom: -32.1, yoy: -11.7 } },
      returned: { value: 4675, change: { mom: -18.6, yoy: -7.2 } },
      cancelled: { value: 83, change: { mom: -58.9, yoy: -42.1 } },
      firstDeliveryRate: { value: 92.1, change: { mom: 1.8, yoy: 3.9 } }
    },
    courierDistribution: [
      { courier: '中通', orders: 463811, percentage: 58.0, performance: { deliveryRate: 97.1, pickupRate: 96.5, shippingRate: 97.4, avgDeliveryTime: 29.2 } },
      { courier: '顺丰', orders: 335864, percentage: 42.0, performance: { deliveryRate: 98.8, pickupRate: 99.1, shippingRate: 99.3, avgDeliveryTime: 21.8 } }
    ]
  },
  {
    platform: 'pdd',
    kpiData: {
      picked: { value: 1546, change: { mom: 12.5, yoy: 28.3 } },
      shipped: { value: 9987, change: { mom: 4.2, yoy: 19.7 } },
      delivered: { value: 288564, change: { mom: 16.8, yoy: 34.1 } },
      forwarded: { value: 258, change: { mom: -22.1, yoy: -12.4 } },
      returned: { value: 1825, change: { mom: -11.8, yoy: -6.9 } },
      cancelled: { value: 32, change: { mom: -68.2, yoy: -44.7 } },
      firstDeliveryRate: { value: 88.7, change: { mom: 2.8, yoy: 5.9 } }
    },
    courierDistribution: [
      { courier: '中通', orders: 181437, percentage: 58.0, performance: { deliveryRate: 95.9, pickupRate: 95.5, shippingRate: 96.6, avgDeliveryTime: 32.1 } },
      { courier: '顺丰', orders: 131110, percentage: 42.0, performance: { deliveryRate: 97.8, pickupRate: 98.1, shippingRate: 98.4, avgDeliveryTime: 24.5 } }
    ]
  },
  {
    platform: 'official',
    kpiData: {
      picked: { value: 773, change: { mom: 18.9, yoy: 25.6 } },
      shipped: { value: 4991, change: { mom: 7.3, yoy: 21.4 } },
      delivered: { value: 144236, change: { mom: 21.5, yoy: 38.7 } },
      forwarded: { value: 129, change: { mom: -19.3, yoy: -9.8 } },
      returned: { value: 912, change: { mom: -8.7, yoy: -4.2 } },
      cancelled: { value: 16, change: { mom: -72.5, yoy: -51.3 } },
      firstDeliveryRate: { value: 95.2, change: { mom: 3.5, yoy: 7.1 } }
    },
    courierDistribution: [
      { courier: '中通', orders: 90638, percentage: 58.0, performance: { deliveryRate: 97.5, pickupRate: 97.2, shippingRate: 97.8, avgDeliveryTime: 26.8 } },
      { courier: '顺丰', orders: 65635, percentage: 42.0, performance: { deliveryRate: 99.1, pickupRate: 99.3, shippingRate: 99.5, avgDeliveryTime: 20.7 } }
    ]
  },
  {
    platform: 'o2o',
    kpiData: {
      picked: { value: 516, change: { mom: 14.2, yoy: 22.8 } },
      shipped: { value: 3327, change: { mom: 5.8, yoy: 18.3 } },
      delivered: { value: 96168, change: { mom: 19.4, yoy: 31.2 } },
      forwarded: { value: 86, change: { mom: -26.7, yoy: -14.5 } },
      returned: { value: 609, change: { mom: -13.2, yoy: -7.8 } },
      cancelled: { value: 11, change: { mom: -78.9, yoy: -56.1 } },
      firstDeliveryRate: { value: 94.1, change: { mom: 2.9, yoy: 6.4 } }
    },
    courierDistribution: [
      { courier: '中通', orders: 60426, percentage: 58.0, performance: { deliveryRate: 97.1, pickupRate: 96.8, shippingRate: 97.4, avgDeliveryTime: 27.3 } },
      { courier: '顺丰', orders: 43756, percentage: 42.0, performance: { deliveryRate: 98.7, pickupRate: 98.9, shippingRate: 99.1, avgDeliveryTime: 21.2 } }
    ]
  },
  {
    platform: 'xiaohongshu',
    kpiData: {
      picked: { value: 387, change: { mom: 11.6, yoy: 19.4 } },
      shipped: { value: 2495, change: { mom: 3.7, yoy: 15.8 } },
      delivered: { value: 72125, change: { mom: 17.2, yoy: 28.6 } },
      forwarded: { value: 65, change: { mom: -24.3, yoy: -11.7 } },
      returned: { value: 456, change: { mom: -10.8, yoy: -5.3 } },
      cancelled: { value: 8, change: { mom: -81.2, yoy: -59.4 } },
      firstDeliveryRate: { value: 91.8, change: { mom: 2.4, yoy: 5.2 } }
    },
    courierDistribution: [
      { courier: '中通', orders: 45319, percentage: 58.0, performance: { deliveryRate: 96.4, pickupRate: 96.1, shippingRate: 96.7, avgDeliveryTime: 29.8 } },
      { courier: '顺丰', orders: 32817, percentage: 42.0, performance: { deliveryRate: 98.0, pickupRate: 98.2, shippingRate: 98.5, avgDeliveryTime: 23.1 } }
    ]
  },
  {
    platform: 'wechat',
    kpiData: {
      picked: { value: 258, change: { mom: 9.3, yoy: 16.7 } },
      shipped: { value: 1663, change: { mom: 2.1, yoy: 12.9 } },
      delivered: { value: 48084, change: { mom: 15.8, yoy: 24.3 } },
      forwarded: { value: 43, change: { mom: -21.9, yoy: -8.6 } },
      returned: { value: 304, change: { mom: -9.4, yoy: -3.8 } },
      cancelled: { value: 5, change: { mom: -84.6, yoy: -62.7 } },
      firstDeliveryRate: { value: 90.4, change: { mom: 1.9, yoy: 4.1 } }
    },
    courierDistribution: [
      { courier: '中通', orders: 30213, percentage: 58.0, performance: { deliveryRate: 95.7, pickupRate: 95.4, shippingRate: 96.0, avgDeliveryTime: 30.5 } },
      { courier: '顺丰', orders: 21878, percentage: 42.0, performance: { deliveryRate: 97.6, pickupRate: 97.8, shippingRate: 98.1, avgDeliveryTime: 24.2 } }
    ]
  }
];

// 品牌×平台交叉数据 - VF品牌体系，包含6个子品牌
export const brandPlatformCrossData: BrandPlatformCrossData[] = [
  // TNF 品牌在各平台的表现
  { brand: 'TNF', platform: 'tmall', orders: 239903, marketShare: 9.0, 
    performance: { deliveryRate: 96.9, firstDeliveryTime: 27.2, customerRating: 4.5, returnRate: 2.3 },
    kpiBreakdown: { picked: 1188, shipped: 7677, delivered: 221471, forwarded: 198, returned: 1402, cancelled: 25 } },
  { brand: 'TNF', platform: 'jd', orders: 159935, marketShare: 6.0, 
    performance: { deliveryRate: 97.2, firstDeliveryTime: 25.8, customerRating: 4.4, returnRate: 2.1 },
    kpiBreakdown: { picked: 792, shipped: 5119, delivered: 147633, forwarded: 132, returned: 934, cancelled: 17 } },
  { brand: 'TNF', platform: 'douyin', orders: 85327, marketShare: 3.2, 
    performance: { deliveryRate: 96.5, firstDeliveryTime: 29.4, customerRating: 4.2, returnRate: 3.0 },
    kpiBreakdown: { picked: 422, shipped: 2730, delivered: 78703, forwarded: 70, returned: 499, cancelled: 9 } },


  // DICKIES 品牌在各平台的表现
  { brand: 'DICKIES', platform: 'tmall', orders: 202865, marketShare: 7.6, 
    performance: { deliveryRate: 96.7, firstDeliveryTime: 27.5, customerRating: 4.4, returnRate: 2.4 },
    kpiBreakdown: { picked: 1004, shipped: 6492, delivered: 187364, forwarded: 168, returned: 1188, cancelled: 21 } },
  { brand: 'DICKIES', platform: 'jd', orders: 135243, marketShare: 5.1, 
    performance: { deliveryRate: 97.0, firstDeliveryTime: 26.1, customerRating: 4.3, returnRate: 2.2 },
    kpiBreakdown: { picked: 670, shipped: 4330, delivered: 124774, forwarded: 112, returned: 791, cancelled: 14 } },
  { brand: 'DICKIES', platform: 'douyin', orders: 72130, marketShare: 2.7, 
    performance: { deliveryRate: 96.3, firstDeliveryTime: 29.7, customerRating: 4.1, returnRate: 3.1 },
    kpiBreakdown: { picked: 357, shipped: 2310, delivered: 66600, forwarded: 60, returned: 422, cancelled: 7 } },


  // VANS 品牌在各平台的表现
  { brand: 'VANS', platform: 'tmall', orders: 169235, marketShare: 6.4, 
    performance: { deliveryRate: 96.8, firstDeliveryTime: 27.1, customerRating: 4.4, returnRate: 2.3 },
    kpiBreakdown: { picked: 838, shipped: 5416, delivered: 156187, forwarded: 140, returned: 989, cancelled: 17 } },
  { brand: 'VANS', platform: 'jd', orders: 112823, marketShare: 4.2, 
    performance: { deliveryRate: 97.1, firstDeliveryTime: 25.7, customerRating: 4.3, returnRate: 2.1 },
    kpiBreakdown: { picked: 559, shipped: 3612, delivered: 104120, forwarded: 93, returned: 660, cancelled: 11 } },
  { brand: 'VANS', platform: 'douyin', orders: 60175, marketShare: 2.3, 
    performance: { deliveryRate: 96.4, firstDeliveryTime: 29.0, customerRating: 4.1, returnRate: 2.9 },
    kpiBreakdown: { picked: 298, shipped: 1926, delivered: 55562, forwarded: 50, returned: 352, cancelled: 6 } },


  // TIMBERLAND 品牌在各平台的表现
  { brand: 'TIMBERLAND', platform: 'tmall', orders: 131948, marketShare: 5.0, 
    performance: { deliveryRate: 97.1, firstDeliveryTime: 26.8, customerRating: 4.5, returnRate: 2.2 },
    kpiBreakdown: { picked: 653, shipped: 4222, delivered: 121801, forwarded: 109, returned: 771, cancelled: 13 } },
  { brand: 'TIMBERLAND', platform: 'jd', orders: 87966, marketShare: 3.3, 
    performance: { deliveryRate: 97.4, firstDeliveryTime: 25.4, customerRating: 4.4, returnRate: 2.0 },
    kpiBreakdown: { picked: 436, shipped: 2815, delivered: 81229, forwarded: 73, returned: 514, cancelled: 9 } },
  { brand: 'TIMBERLAND', platform: 'douyin', orders: 46910, marketShare: 1.8, 
    performance: { deliveryRate: 96.7, firstDeliveryTime: 28.6, customerRating: 4.2, returnRate: 2.8 },
    kpiBreakdown: { picked: 232, shipped: 1501, delivered: 43304, forwarded: 39, returned: 274, cancelled: 5 } },


  // ICEBREAKER 品牌在各平台的表现
  { brand: 'ICEBREAKER', platform: 'tmall', orders: 107957, marketShare: 4.1, 
    performance: { deliveryRate: 96.5, firstDeliveryTime: 27.6, customerRating: 4.3, returnRate: 2.5 },
    kpiBreakdown: { picked: 535, shipped: 3455, delivered: 99684, forwarded: 89, returned: 631, cancelled: 11 } },
  { brand: 'ICEBREAKER', platform: 'jd', orders: 71971, marketShare: 2.7, 
    performance: { deliveryRate: 96.8, firstDeliveryTime: 26.2, customerRating: 4.2, returnRate: 2.3 },
    kpiBreakdown: { picked: 357, shipped: 2303, delivered: 66432, forwarded: 60, returned: 421, cancelled: 7 } },
  { brand: 'ICEBREAKER', platform: 'douyin', orders: 38384, marketShare: 1.4, 
    performance: { deliveryRate: 96.1, firstDeliveryTime: 29.8, customerRating: 4.0, returnRate: 3.2 },
    kpiBreakdown: { picked: 190, shipped: 1229, delivered: 35433, forwarded: 32, returned: 224, cancelled: 4 } },


  // KIPLING 品牌在各平台的表现
  { brand: 'KIPLING', platform: 'tmall', orders: 95962, marketShare: 3.6, 
    performance: { deliveryRate: 96.3, firstDeliveryTime: 27.9, customerRating: 4.2, returnRate: 2.6 },
    kpiBreakdown: { picked: 475, shipped: 3071, delivered: 88588, forwarded: 79, returned: 561, cancelled: 10 } },
  { brand: 'KIPLING', platform: 'jd', orders: 63975, marketShare: 2.4, 
    performance: { deliveryRate: 96.6, firstDeliveryTime: 26.5, customerRating: 4.1, returnRate: 2.4 },
    kpiBreakdown: { picked: 317, shipped: 2047, delivered: 59060, forwarded: 53, returned: 374, cancelled: 6 } },
  { brand: 'KIPLING', platform: 'douyin', orders: 34122, marketShare: 1.3, 
    performance: { deliveryRate: 95.9, firstDeliveryTime: 30.1, customerRating: 3.9, returnRate: 3.3 },
    kpiBreakdown: { picked: 169, shipped: 1092, delivered: 31507, forwarded: 28, returned: 199, cancelled: 4 } },


  // 新增平台数据 - TNF品牌
  { brand: 'TNF', platform: 'pdd', orders: 31976, marketShare: 1.2, 
    performance: { deliveryRate: 96.2, firstDeliveryTime: 30.8, customerRating: 4.0, returnRate: 3.2 },
    kpiBreakdown: { picked: 158, shipped: 1022, delivered: 29521, forwarded: 26, returned: 187, cancelled: 3 } },
  { brand: 'TNF', platform: 'official', orders: 15988, marketShare: 0.6, 
    performance: { deliveryRate: 97.8, firstDeliveryTime: 24.2, customerRating: 4.6, returnRate: 1.8 },
    kpiBreakdown: { picked: 79, shipped: 511, delivered: 14760, forwarded: 13, returned: 93, cancelled: 2 } },
  { brand: 'TNF', platform: 'o2o', orders: 10659, marketShare: 0.4, 
    performance: { deliveryRate: 97.5, firstDeliveryTime: 25.1, customerRating: 4.5, returnRate: 2.0 },
    kpiBreakdown: { picked: 53, shipped: 341, delivered: 9840, forwarded: 9, returned: 62, cancelled: 1 } },
  { brand: 'TNF', platform: 'xiaohongshu', orders: 7994, marketShare: 0.3, 
    performance: { deliveryRate: 96.8, firstDeliveryTime: 28.5, customerRating: 4.3, returnRate: 2.7 },
    kpiBreakdown: { picked: 40, shipped: 256, delivered: 7380, forwarded: 7, returned: 47, cancelled: 1 } },
  { brand: 'TNF', platform: 'wechat', orders: 5329, marketShare: 0.2, 
    performance: { deliveryRate: 96.4, firstDeliveryTime: 29.2, customerRating: 4.2, returnRate: 2.9 },
    kpiBreakdown: { picked: 26, shipped: 171, delivered: 4920, forwarded: 4, returned: 31, cancelled: 0 } },

  // 新增平台数据 - DICKIES品牌  
  { brand: 'DICKIES', platform: 'pdd', orders: 27064, marketShare: 1.0, 
    performance: { deliveryRate: 96.0, firstDeliveryTime: 31.1, customerRating: 3.9, returnRate: 3.3 },
    kpiBreakdown: { picked: 134, shipped: 866, delivered: 24984, forwarded: 22, returned: 158, cancelled: 3 } },
  { brand: 'DICKIES', platform: 'official', orders: 13532, marketShare: 0.5, 
    performance: { deliveryRate: 97.6, firstDeliveryTime: 24.5, customerRating: 4.5, returnRate: 1.9 },
    kpiBreakdown: { picked: 67, shipped: 433, delivered: 12498, forwarded: 11, returned: 79, cancelled: 1 } },
  { brand: 'DICKIES', platform: 'o2o', orders: 9021, marketShare: 0.3, 
    performance: { deliveryRate: 97.3, firstDeliveryTime: 25.4, customerRating: 4.4, returnRate: 2.1 },
    kpiBreakdown: { picked: 45, shipped: 289, delivered: 8332, forwarded: 7, returned: 53, cancelled: 1 } },
  { brand: 'DICKIES', platform: 'xiaohongshu', orders: 6765, marketShare: 0.3, 
    performance: { deliveryRate: 96.6, firstDeliveryTime: 28.8, customerRating: 4.2, returnRate: 2.8 },
    kpiBreakdown: { picked: 33, shipped: 217, delivered: 6249, forwarded: 6, returned: 40, cancelled: 0 } },
  { brand: 'DICKIES', platform: 'wechat', orders: 4510, marketShare: 0.2, 
    performance: { deliveryRate: 96.2, firstDeliveryTime: 29.5, customerRating: 4.1, returnRate: 3.0 },
    kpiBreakdown: { picked: 22, shipped: 144, delivered: 4166, forwarded: 4, returned: 26, cancelled: 0 } },

  // 新增平台数据 - VANS品牌
  { brand: 'VANS', platform: 'pdd', orders: 22553, marketShare: 0.9, 
    performance: { deliveryRate: 96.1, firstDeliveryTime: 30.9, customerRating: 4.0, returnRate: 3.1 },
    kpiBreakdown: { picked: 112, shipped: 721, delivered: 20832, forwarded: 19, returned: 132, cancelled: 2 } },
  { brand: 'VANS', platform: 'official', orders: 11277, marketShare: 0.4, 
    performance: { deliveryRate: 97.7, firstDeliveryTime: 24.3, customerRating: 4.5, returnRate: 1.8 },
    kpiBreakdown: { picked: 56, shipped: 361, delivered: 10416, forwarded: 9, returned: 66, cancelled: 1 } },
  { brand: 'VANS', platform: 'o2o', orders: 7518, marketShare: 0.3, 
    performance: { deliveryRate: 97.4, firstDeliveryTime: 25.2, customerRating: 4.4, returnRate: 2.0 },
    kpiBreakdown: { picked: 37, shipped: 241, delivered: 6944, forwarded: 6, returned: 44, cancelled: 1 } },
  { brand: 'VANS', platform: 'xiaohongshu', orders: 5638, marketShare: 0.2, 
    performance: { deliveryRate: 96.7, firstDeliveryTime: 28.6, customerRating: 4.2, returnRate: 2.7 },
    kpiBreakdown: { picked: 28, shipped: 180, delivered: 5209, forwarded: 5, returned: 33, cancelled: 0 } },
  { brand: 'VANS', platform: 'wechat', orders: 3759, marketShare: 0.1, 
    performance: { deliveryRate: 96.3, firstDeliveryTime: 29.3, customerRating: 4.1, returnRate: 2.9 },
    kpiBreakdown: { picked: 19, shipped: 120, delivered: 3472, forwarded: 3, returned: 22, cancelled: 0 } },

  // 新增平台数据 - TIMBERLAND品牌
  { brand: 'TIMBERLAND', platform: 'pdd', orders: 17581, marketShare: 0.7, 
    performance: { deliveryRate: 96.4, firstDeliveryTime: 30.5, customerRating: 4.1, returnRate: 3.0 },
    kpiBreakdown: { picked: 87, shipped: 563, delivered: 16239, forwarded: 15, returned: 103, cancelled: 2 } },
  { brand: 'TIMBERLAND', platform: 'official', orders: 8791, marketShare: 0.3, 
    performance: { deliveryRate: 98.0, firstDeliveryTime: 23.9, customerRating: 4.6, returnRate: 1.7 },
    kpiBreakdown: { picked: 44, shipped: 281, delivered: 8119, forwarded: 7, returned: 51, cancelled: 1 } },
  { brand: 'TIMBERLAND', platform: 'o2o', orders: 5861, marketShare: 0.2, 
    performance: { deliveryRate: 97.7, firstDeliveryTime: 24.8, customerRating: 4.5, returnRate: 1.9 },
    kpiBreakdown: { picked: 29, shipped: 188, delivered: 5413, forwarded: 5, returned: 34, cancelled: 0 } },
  { brand: 'TIMBERLAND', platform: 'xiaohongshu', orders: 4395, marketShare: 0.2, 
    performance: { deliveryRate: 97.0, firstDeliveryTime: 28.2, customerRating: 4.3, returnRate: 2.6 },
    kpiBreakdown: { picked: 22, shipped: 141, delivered: 4062, forwarded: 4, returned: 26, cancelled: 0 } },
  { brand: 'TIMBERLAND', platform: 'wechat', orders: 2930, marketShare: 0.1, 
    performance: { deliveryRate: 96.6, firstDeliveryTime: 28.9, customerRating: 4.2, returnRate: 2.8 },
    kpiBreakdown: { picked: 15, shipped: 94, delivered: 2708, forwarded: 2, returned: 17, cancelled: 0 } },

  // 新增平台数据 - ICEBREAKER品牌
  { brand: 'ICEBREAKER', platform: 'pdd', orders: 14382, marketShare: 0.5, 
    performance: { deliveryRate: 95.8, firstDeliveryTime: 31.4, customerRating: 3.8, returnRate: 3.4 },
    kpiBreakdown: { picked: 71, shipped: 460, delivered: 13287, forwarded: 12, returned: 84, cancelled: 1 } },
  { brand: 'ICEBREAKER', platform: 'official', orders: 7191, marketShare: 0.3, 
    performance: { deliveryRate: 97.4, firstDeliveryTime: 24.8, customerRating: 4.4, returnRate: 2.0 },
    kpiBreakdown: { picked: 36, shipped: 230, delivered: 6643, forwarded: 6, returned: 42, cancelled: 1 } },
  { brand: 'ICEBREAKER', platform: 'o2o', orders: 4794, marketShare: 0.2, 
    performance: { deliveryRate: 97.1, firstDeliveryTime: 25.7, customerRating: 4.3, returnRate: 2.2 },
    kpiBreakdown: { picked: 24, shipped: 153, delivered: 4429, forwarded: 4, returned: 28, cancelled: 0 } },
  { brand: 'ICEBREAKER', platform: 'xiaohongshu', orders: 3595, marketShare: 0.1, 
    performance: { deliveryRate: 96.4, firstDeliveryTime: 29.1, customerRating: 4.1, returnRate: 2.9 },
    kpiBreakdown: { picked: 18, shipped: 115, delivered: 3322, forwarded: 3, returned: 21, cancelled: 0 } },
  { brand: 'ICEBREAKER', platform: 'wechat', orders: 2397, marketShare: 0.1, 
    performance: { deliveryRate: 96.0, firstDeliveryTime: 29.8, customerRating: 4.0, returnRate: 3.1 },
    kpiBreakdown: { picked: 12, shipped: 77, delivered: 2215, forwarded: 2, returned: 14, cancelled: 0 } },

  // 新增平台数据 - KIPLING品牌
  { brand: 'KIPLING', platform: 'pdd', orders: 12787, marketShare: 0.5, 
    performance: { deliveryRate: 95.6, firstDeliveryTime: 31.7, customerRating: 3.7, returnRate: 3.5 },
    kpiBreakdown: { picked: 63, shipped: 409, delivered: 11808, forwarded: 11, returned: 75, cancelled: 1 } },
  { brand: 'KIPLING', platform: 'official', orders: 6394, marketShare: 0.2, 
    performance: { deliveryRate: 97.2, firstDeliveryTime: 25.1, customerRating: 4.3, returnRate: 2.1 },
    kpiBreakdown: { picked: 32, shipped: 204, delivered: 5904, forwarded: 5, returned: 37, cancelled: 1 } },
  { brand: 'KIPLING', platform: 'o2o', orders: 4262, marketShare: 0.2, 
    performance: { deliveryRate: 96.9, firstDeliveryTime: 26.0, customerRating: 4.2, returnRate: 2.3 },
    kpiBreakdown: { picked: 21, shipped: 136, delivered: 3937, forwarded: 4, returned: 25, cancelled: 0 } },
  { brand: 'KIPLING', platform: 'xiaohongshu', orders: 3197, marketShare: 0.1, 
    performance: { deliveryRate: 96.2, firstDeliveryTime: 29.4, customerRating: 4.0, returnRate: 3.0 },
    kpiBreakdown: { picked: 16, shipped: 102, delivered: 2954, forwarded: 3, returned: 19, cancelled: 0 } },
  { brand: 'KIPLING', platform: 'wechat', orders: 2131, marketShare: 0.1, 
    performance: { deliveryRate: 95.8, firstDeliveryTime: 30.1, customerRating: 3.9, returnRate: 3.2 },
    kpiBreakdown: { picked: 11, shipped: 68, delivered: 1969, forwarded: 2, returned: 13, cancelled: 0 } },

  // VF 母品牌数据 - 所有子品牌的总和，包含新增平台
  { brand: 'VF', platform: 'tmall', orders: 947870, marketShare: 35.7, 
    performance: { deliveryRate: 96.7, firstDeliveryTime: 27.4, customerRating: 4.4, returnRate: 2.4 },
    kpiBreakdown: { picked: 4693, shipped: 30333, delivered: 875095, forwarded: 783, returned: 5542, cancelled: 98 } },
  { brand: 'VF', platform: 'douyin', orders: 337048, marketShare: 12.7, 
    performance: { deliveryRate: 96.3, firstDeliveryTime: 29.3, customerRating: 4.1, returnRate: 3.0 },
    kpiBreakdown: { picked: 1668, shipped: 10788, delivered: 311089, forwarded: 279, returned: 1970, cancelled: 28 } },
  { brand: 'VF', platform: 'jd', orders: 632023, marketShare: 23.7, 
    performance: { deliveryRate: 97.0, firstDeliveryTime: 26.0, customerRating: 4.3, returnRate: 2.2 },
    kpiBreakdown: { picked: 3131, shipped: 20226, delivered: 583278, forwarded: 522, returned: 3689, cancelled: 52 } },
  { brand: 'VF', platform: 'pdd', orders: 126343, marketShare: 4.8, 
    performance: { deliveryRate: 96.1, firstDeliveryTime: 30.9, customerRating: 4.0, returnRate: 3.2 },
    kpiBreakdown: { picked: 625, shipped: 4041, delivered: 116671, forwarded: 105, returned: 739, cancelled: 11 } },
  { brand: 'VF', platform: 'official', orders: 63173, marketShare: 2.4, 
    performance: { deliveryRate: 97.6, firstDeliveryTime: 24.5, customerRating: 4.5, returnRate: 1.9 },
    kpiBreakdown: { picked: 314, shipped: 2020, delivered: 58340, forwarded: 52, returned: 368, cancelled: 6 } },
  { brand: 'VF', platform: 'o2o', orders: 42115, marketShare: 1.6, 
    performance: { deliveryRate: 97.3, firstDeliveryTime: 25.2, customerRating: 4.4, returnRate: 2.1 },
    kpiBreakdown: { picked: 209, shipped: 1348, delivered: 38895, forwarded: 35, returned: 246, cancelled: 3 } },
  { brand: 'VF', platform: 'xiaohongshu', orders: 31584, marketShare: 1.2, 
    performance: { deliveryRate: 96.6, firstDeliveryTime: 28.7, customerRating: 4.2, returnRate: 2.8 },
    kpiBreakdown: { picked: 157, shipped: 1011, delivered: 29176, forwarded: 26, returned: 184, cancelled: 2 } },
  { brand: 'VF', platform: 'wechat', orders: 21056, marketShare: 0.8, 
    performance: { deliveryRate: 96.2, firstDeliveryTime: 29.3, customerRating: 4.1, returnRate: 3.0 },
    kpiBreakdown: { picked: 105, shipped: 674, delivered: 19450, forwarded: 17, returned: 123, cancelled: 1 } }
];

// 根据筛选条件获取平台数据
export function getPlatformData(selectedPlatform?: string): PlatformData[] {
  if (!selectedPlatform) {
    return platformsData;
  }
  return platformsData.filter(platform => platform.name === selectedPlatform);
}

// 根据品牌和平台获取交叉分析数据
export function getBrandPlatformCrossAnalysis(selectedBrand?: string, selectedPlatform?: string): BrandPlatformCrossData[] {
  let result = brandPlatformCrossData;
  
  if (selectedBrand) {
    result = result.filter(item => item.brand === selectedBrand);
  }
  
  if (selectedPlatform) {
    result = result.filter(item => item.platform === selectedPlatform);
  }
  
  return result;
}

// 获取平台KPI数据
export function getPlatformKPIData(selectedPlatform?: string): PlatformKPIData[] {
  if (!selectedPlatform) {
    return platformKPIData;
  }
  return platformKPIData.filter(platform => platform.platform === selectedPlatform);
}