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

// 平台基础数据
export const platformsData: PlatformData[] = [
  {
    name: 'tmall',
    displayName: '天猫',
    logo: '🛍️',
    color: '#FF6600',
    orders: 1199513,
    marketShare: 45.0,
    performance: {
      conversionRate: 4.2,
      avgOrderValue: 186.8,
      customerSatisfaction: 4.6
    }
  },
  {
    name: 'jd',
    displayName: '京东',
    logo: '🛒',
    color: '#E3101E',
    orders: 799675,
    marketShare: 30.0,
    performance: {
      conversionRate: 3.8,
      avgOrderValue: 156.4,
      customerSatisfaction: 4.5
    }
  },
  {
    name: 'douyin',
    displayName: '抖音',
    logo: '🎵',
    color: '#000000',
    orders: 426634,
    marketShare: 16.0,
    performance: {
      conversionRate: 2.9,
      avgOrderValue: 98.7,
      customerSatisfaction: 4.3
    }
  },
  {
    name: 'vipshop',
    displayName: '唯品会',
    logo: '💎',
    color: '#FF1493',
    orders: 239763,
    marketShare: 9.0,
    performance: {
      conversionRate: 3.2,
      avgOrderValue: 134.5,
      customerSatisfaction: 4.4
    }
  }
];

// 平台KPI数据
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
      {
        courier: '中通',
        orders: 695658,
        percentage: 58.0,
        performance: { deliveryRate: 96.8, pickupRate: 96.2, shippingRate: 97.1, avgDeliveryTime: 28.5 }
      },
      {
        courier: '顺丰',
        orders: 503855,
        percentage: 42.0,
        performance: { deliveryRate: 98.5, pickupRate: 98.8, shippingRate: 99.0, avgDeliveryTime: 22.3 }
      }
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
      {
        courier: '中通',
        orders: 463811,
        percentage: 58.0,
        performance: { deliveryRate: 97.1, pickupRate: 96.5, shippingRate: 97.4, avgDeliveryTime: 29.2 }
      },
      {
        courier: '顺丰',
        orders: 335864,
        percentage: 42.0,
        performance: { deliveryRate: 98.8, pickupRate: 99.1, shippingRate: 99.3, avgDeliveryTime: 21.8 }
      }
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
      {
        courier: '中通',
        orders: 247448,
        percentage: 58.0,
        performance: { deliveryRate: 96.2, pickupRate: 95.8, shippingRate: 96.9, avgDeliveryTime: 31.2 }
      },
      {
        courier: '顺丰',
        orders: 179186,
        percentage: 42.0,
        performance: { deliveryRate: 98.1, pickupRate: 98.4, shippingRate: 98.7, avgDeliveryTime: 23.6 }
      }
    ]
  },
  {
    platform: 'vipshop',
    kpiData: {
      picked: { value: 1193, change: { mom: 4.7, yoy: 12.3 } },
      shipped: { value: 7712, change: { mom: -4.5, yoy: 8.9 } },
      delivered: { value: 221373, change: { mom: 7.8, yoy: 19.4 } },
      forwarded: { value: 198, change: { mom: -41.2, yoy: -18.6 } },
      returned: { value: 1400, change: { mom: -21.7, yoy: -12.5 } },
      cancelled: { value: 24, change: { mom: -75.6, yoy: -48.9 } },
      firstDeliveryRate: { value: 91.4, change: { mom: 1.6, yoy: 3.2 } }
    },
    courierDistribution: [
      {
        courier: '中通',
        orders: 139022,
        percentage: 58.0,
        performance: { deliveryRate: 96.5, pickupRate: 96.1, shippingRate: 97.0, avgDeliveryTime: 30.1 }
      },
      {
        courier: '顺丰',
        orders: 100741,
        percentage: 42.0,
        performance: { deliveryRate: 98.3, pickupRate: 98.6, shippingRate: 98.9, avgDeliveryTime: 22.9 }
      }
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
  { brand: 'TNF', platform: 'vipshop', orders: 47952, marketShare: 1.8, 
    performance: { deliveryRate: 96.8, firstDeliveryTime: 27.6, customerRating: 4.3, returnRate: 2.5 },
    kpiBreakdown: { picked: 238, shipped: 1535, delivered: 44258, forwarded: 40, returned: 280, cancelled: 5 } },

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
  { brand: 'DICKIES', platform: 'vipshop', orders: 40525, marketShare: 1.5, 
    performance: { deliveryRate: 96.6, firstDeliveryTime: 27.9, customerRating: 4.2, returnRate: 2.6 },
    kpiBreakdown: { picked: 201, shipped: 1297, delivered: 37404, forwarded: 34, returned: 237, cancelled: 4 } },

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
  { brand: 'VANS', platform: 'vipshop', orders: 33809, marketShare: 1.3, 
    performance: { deliveryRate: 96.7, firstDeliveryTime: 27.5, customerRating: 4.2, returnRate: 2.5 },
    kpiBreakdown: { picked: 167, shipped: 1082, delivered: 31207, forwarded: 28, returned: 198, cancelled: 3 } },

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
  { brand: 'TIMBERLAND', platform: 'vipshop', orders: 26363, marketShare: 1.0, 
    performance: { deliveryRate: 97.0, firstDeliveryTime: 27.2, customerRating: 4.3, returnRate: 2.4 },
    kpiBreakdown: { picked: 131, shipped: 844, delivered: 24355, forwarded: 22, returned: 154, cancelled: 2 } },

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
  { brand: 'ICEBREAKER', platform: 'vipshop', orders: 21587, marketShare: 0.8, 
    performance: { deliveryRate: 96.4, firstDeliveryTime: 28.0, customerRating: 4.1, returnRate: 2.7 },
    kpiBreakdown: { picked: 107, shipped: 691, delivered: 19937, forwarded: 18, returned: 126, cancelled: 2 } },

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
  { brand: 'KIPLING', platform: 'vipshop', orders: 19177, marketShare: 0.7, 
    performance: { deliveryRate: 96.2, firstDeliveryTime: 28.3, customerRating: 4.0, returnRate: 2.8 },
    kpiBreakdown: { picked: 95, shipped: 614, delivered: 17710, forwarded: 16, returned: 112, cancelled: 2 } },

  // VF 母品牌数据 - 所有子品牌的总和
  { brand: 'VF', platform: 'tmall', orders: 947870, marketShare: 35.7, 
    performance: { deliveryRate: 96.7, firstDeliveryTime: 27.4, customerRating: 4.4, returnRate: 2.4 },
    kpiBreakdown: { picked: 4693, shipped: 30333, delivered: 875095, forwarded: 783, returned: 5542, cancelled: 98 } },
  { brand: 'VF', platform: 'jd', orders: 632023, marketShare: 23.7, 
    performance: { deliveryRate: 97.0, firstDeliveryTime: 26.0, customerRating: 4.3, returnRate: 2.2 },
    kpiBreakdown: { picked: 3131, shipped: 20226, delivered: 583278, forwarded: 522, returned: 3689, cancelled: 52 } },
  { brand: 'VF', platform: 'douyin', orders: 337048, marketShare: 12.7, 
    performance: { deliveryRate: 96.3, firstDeliveryTime: 29.3, customerRating: 4.1, returnRate: 3.0 },
    kpiBreakdown: { picked: 1668, shipped: 10788, delivered: 311089, forwarded: 279, returned: 1970, cancelled: 28 } },
  { brand: 'VF', platform: 'vipshop', orders: 189414, marketShare: 7.1, 
    performance: { deliveryRate: 96.5, firstDeliveryTime: 27.8, customerRating: 4.2, returnRate: 2.6 },
    kpiBreakdown: { picked: 939, shipped: 6063, delivered: 174871, forwarded: 157, returned: 1107, cancelled: 15 } }
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