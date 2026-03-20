// VF Logo as placeholder URL
const vfLogo = "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=32&h=32&fit=crop&crop=center";

export interface KPIData {
  label: string;
  value: string;
  change: number;
  trend: 'up' | 'down';
}

export interface VendorData {
  name: string;
  value: number;
  percentage: number;
}

export interface WeightData {
  brand: string;
  weight: number;
  color: string;
}

export interface DestinationData {
  region: string;
  percentage: number;
  value: number;
}

export interface MapData {
  province: string;
  value: number;
  coordinates: [number, number];
}

export interface BrandData {
  name: string;
  logo: string; // emoji备用
  logoUrl?: string; // 品牌logo图片URL
}

// 重量区间数据接口
export interface WeightRangeData {
  range: string; // 重量区间，如 "0-1kg", "1-3kg"
  minWeight: number; // 最小重量
  maxWeight: number; // 最大重量
  brandData: {
    brand: string;
    orders: number;
    percentage: number;
    courierData: {
      courier: string;
      orders: number;
      percentage: number;
      avgShippingCost: number; // 单均运费
    }[];
  }[];
  totalOrders: number;
  avgCost: number;
}

// 省份重量快递详细数据
export interface ProvinceWeightDetail {
  province: string;
  weightRanges: {
    range: string;
    couriers: {
      courier: string;
      orders: number;
      avgShippingCost: number;
      percentage: number;
    }[];
    totalOrders: number;
    avgCost: number;
  }[];
}

export const kpiData: KPIData[] = [
  { label: 'Total Orders', value: '2,665,585', change: 12.5, trend: 'up' },
  { label: 'Active Orders', value: '13,161', change: -2.3, trend: 'down' },
  { label: 'Pending', value: '85,153', change: 8.7, trend: 'up' },
  { label: 'Completed', value: '2,522,821', change: 15.2, trend: 'up' },
  { label: 'Returns', value: '2,202', change: -5.1, trend: 'down' },
  { label: 'Cancelled', value: '275', change: -12.8, trend: 'down' },
];

export const vendorData: VendorData[] = [
  { name: 'Vendor A', value: 77, percentage: 77 },
  { name: 'Vendor B', value: 15, percentage: 15 },
  { name: 'Vendor C', value: 8, percentage: 8 },
];

export const weightData: WeightData[] = [
  { brand: 'VF', weight: 186780, color: '#2563eb' }, // VF 蓝色 (所有子品牌总和)
  { brand: 'TNF', weight: 78450, color: '#3b82f6' },
  { brand: 'DICKIES', weight: 67230, color: '#8b5cf6' },
  { brand: 'VANS', weight: 54890, color: '#06b6d4' },
  { brand: 'TIMBERLAND', weight: 43120, color: '#84cc16' },
  { brand: 'ICEBREAKER', weight: 32180, color: '#f59e0b' },
  { brand: 'KIPLING', weight: 21340, color: '#ef4444' },
];

export const destinationData: DestinationData[] = [
  { region: 'Guangdong', percentage: 28, value: 745380 },
  { region: 'Jiangsu', percentage: 18, value: 478920 },
  { region: 'Zhejiang', percentage: 15, value: 399150 },
  { region: 'Shandong', percentage: 12, value: 319560 },
  { region: 'Beijing', percentage: 10, value: 266100 },
  { region: 'Shanghai', percentage: 8, value: 212880 },
  { region: 'Others', percentage: 9, value: 239610 },
];

export const transferProgress = {
  completed: 99,
  total: 100,
  value: '15,585'
};

export const mapData: MapData[] = [
  { province: 'Guangdong', value: 745380, coordinates: [113.3, 23.1] },
  { province: 'Jiangsu', value: 478920, coordinates: [118.8, 32.1] },
  { province: 'Zhejiang', value: 399150, coordinates: [120.2, 30.3] },
  { province: 'Shandong', value: 319560, coordinates: [117.0, 36.7] },
  { province: 'Beijing', value: 266100, coordinates: [116.4, 39.9] },
  { province: 'Shanghai', value: 212880, coordinates: [121.5, 31.2] },
  { province: 'Hebei', value: 156780, coordinates: [114.5, 38.0] },
  { province: 'Henan', value: 134560, coordinates: [113.6, 34.8] },
];

// VF品牌体系：母品牌VF + 6个子品牌
export const brands: BrandData[] = [
  { 
    name: 'VF', 
    logo: '🏢',
    logoUrl: vfLogo
  },
  { 
    name: 'TNF', 
    logo: '🏔️',
    logoUrl: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=32&h=32&fit=crop&crop=center'
  },
  { 
    name: 'DICKIES', 
    logo: '👔',
    logoUrl: 'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=32&h=32&fit=crop&crop=center'
  },
  { 
    name: 'VANS', 
    logo: '👟',
    logoUrl: 'https://images.unsplash.com/photo-1552066344-2464c1135c32?w=32&h=32&fit=crop&crop=center'
  },
  { 
    name: 'TIMBERLAND', 
    logo: '🥾',
    logoUrl: 'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=32&h=32&fit=crop&crop=center'
  },
  { 
    name: 'ICEBREAKER', 
    logo: '🧊',
    logoUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=32&h=32&fit=crop&crop=center'
  },
  { 
    name: 'KIPLING', 
    logo: '🎒',
    logoUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=32&h=32&fit=crop&crop=center'
  }
];

// 重量区间分布数据 - 基于新的品牌结构
export const weightRangeData: WeightRangeData[] = [
  {
    range: "0-1kg",
    minWeight: 0,
    maxWeight: 1,
    totalOrders: 956038,
    avgCost: 8.5,
    brandData: [
      {
        brand: "TNF",
        orders: 191208,
        percentage: 20.0,
        courierData: [
          { courier: "中通", orders: 114725, percentage: 60.0, avgShippingCost: 7.5 },
          { courier: "顺丰", orders: 76483, percentage: 40.0, avgShippingCost: 13.2 }
        ]
      },
      {
        brand: "DICKIES", 
        orders: 162026,
        percentage: 16.9,
        courierData: [
          { courier: "中通", orders: 97216, percentage: 60.0, avgShippingCost: 7.8 },
          { courier: "顺丰", orders: 64810, percentage: 40.0, avgShippingCost: 13.5 }
        ]
      },
      {
        brand: "VANS",
        orders: 134565,
        percentage: 14.1,
        courierData: [
          { courier: "中通", orders: 80739, percentage: 60.0, avgShippingCost: 7.6 },
          { courier: "顺丰", orders: 53826, percentage: 40.0, avgShippingCost: 13.0 }
        ]
      },
      {
        brand: "TIMBERLAND",
        orders: 105652,
        percentage: 11.0,
        courierData: [
          { courier: "顺丰", orders: 63391, percentage: 60.0, avgShippingCost: 13.8 },
          { courier: "中通", orders: 42261, percentage: 40.0, avgShippingCost: 8.1 }
        ]
      },
      {
        brand: "ICEBREAKER",
        orders: 86522,
        percentage: 9.0,
        courierData: [
          { courier: "中通", orders: 51913, percentage: 60.0, avgShippingCost: 7.9 },
          { courier: "顺丰", orders: 34609, percentage: 40.0, avgShippingCost: 13.3 }
        ]
      },
      {
        brand: "KIPLING",
        orders: 76609,
        percentage: 8.0,
        courierData: [
          { courier: "中通", orders: 45965, percentage: 60.0, avgShippingCost: 7.7 },
          { courier: "顺丰", orders: 30644, percentage: 40.0, avgShippingCost: 13.1 }
        ]
      }
    ]
  },
  {
    range: "1-3kg",
    minWeight: 1,
    maxWeight: 3,
    totalOrders: 799234,
    avgCost: 12.8,
    brandData: [
      {
        brand: "TNF",
        orders: 159847,
        percentage: 20.0,
        courierData: [
          { courier: "中通", orders: 95908, percentage: 60.0, avgShippingCost: 10.8 },
          { courier: "顺丰", orders: 63939, percentage: 40.0, avgShippingCost: 17.5 }
        ]
      },
      {
        brand: "DICKIES",
        orders: 135052,
        percentage: 16.9,
        courierData: [
          { courier: "中通", orders: 81031, percentage: 60.0, avgShippingCost: 11.2 },
          { courier: "顺丰", orders: 54021, percentage: 40.0, avgShippingCost: 17.8 }
        ]
      },
      {
        brand: "VANS",
        orders: 112672,
        percentage: 14.1,
        courierData: [
          { courier: "中通", orders: 67603, percentage: 60.0, avgShippingCost: 10.9 },
          { courier: "顺丰", orders: 45069, percentage: 40.0, avgShippingCost: 17.3 }
        ]
      },
      {
        brand: "TIMBERLAND",
        orders: 87916,
        percentage: 11.0,
        courierData: [
          { courier: "顺丰", orders: 52750, percentage: 60.0, avgShippingCost: 18.1 },
          { courier: "中通", orders: 35166, percentage: 40.0, avgShippingCost: 11.5 }
        ]
      },
      {
        brand: "ICEBREAKER",
        orders: 71931,
        percentage: 9.0,
        courierData: [
          { courier: "中通", orders: 43159, percentage: 60.0, avgShippingCost: 11.0 },
          { courier: "顺丰", orders: 28772, percentage: 40.0, avgShippingCost: 17.6 }
        ]
      },
      {
        brand: "KIPLING",
        orders: 63939,
        percentage: 8.0,
        courierData: [
          { courier: "中通", orders: 38363, percentage: 60.0, avgShippingCost: 10.7 },
          { courier: "顺丰", orders: 25576, percentage: 40.0, avgShippingCost: 17.4 }
        ]
      }
    ]
  },
  {
    range: "3-5kg",
    minWeight: 3,
    maxWeight: 5,
    totalOrders: 532823,
    avgCost: 18.5,
    brandData: [
      {
        brand: "TNF",
        orders: 106565,
        percentage: 20.0,
        courierData: [
          { courier: "中通", orders: 63939, percentage: 60.0, avgShippingCost: 15.6 },
          { courier: "顺丰", orders: 42626, percentage: 40.0, avgShippingCost: 25.2 }
        ]
      },
      {
        brand: "DICKIES",
        orders: 90008,
        percentage: 16.9,
        courierData: [
          { courier: "中通", orders: 54005, percentage: 60.0, avgShippingCost: 16.1 },
          { courier: "顺丰", orders: 36003, percentage: 40.0, avgShippingCost: 25.7 }
        ]
      },
      {
        brand: "VANS",
        orders: 75128,
        percentage: 14.1,
        courierData: [
          { courier: "中通", orders: 45077, percentage: 60.0, avgShippingCost: 15.8 },
          { courier: "顺丰", orders: 30051, percentage: 40.0, avgShippingCost: 25.0 }
        ]
      },
      {
        brand: "TIMBERLAND",
        orders: 58611,
        percentage: 11.0,
        courierData: [
          { courier: "顺丰", orders: 35167, percentage: 60.0, avgShippingCost: 26.1 },
          { courier: "中通", orders: 23444, percentage: 40.0, avgShippingCost: 16.4 }
        ]
      },
      {
        brand: "ICEBREAKER",
        orders: 47954,
        percentage: 9.0,
        courierData: [
          { courier: "中通", orders: 28772, percentage: 60.0, avgShippingCost: 15.9 },
          { courier: "顺丰", orders: 19182, percentage: 40.0, avgShippingCost: 25.3 }
        ]
      },
      {
        brand: "KIPLING",
        orders: 42626,
        percentage: 8.0,
        courierData: [
          { courier: "中通", orders: 25576, percentage: 60.0, avgShippingCost: 15.7 },
          { courier: "顺丰", orders: 17050, percentage: 40.0, avgShippingCost: 25.1 }
        ]
      }
    ]
  },
  {
    range: "5kg+",
    minWeight: 5,
    maxWeight: 999,
    totalOrders: 377490,
    avgCost: 28.2,
    brandData: [
      {
        brand: "TNF",
        orders: 75498,
        percentage: 20.0,
        courierData: [
          { courier: "中通", orders: 45299, percentage: 60.0, avgShippingCost: 23.1 },
          { courier: "顺丰", orders: 30199, percentage: 40.0, avgShippingCost: 39.5 }
        ]
      },
      {
        brand: "DICKIES",
        orders: 63756,
        percentage: 16.9,
        courierData: [
          { courier: "中通", orders: 38254, percentage: 60.0, avgShippingCost: 23.8 },
          { courier: "顺丰", orders: 25502, percentage: 40.0, avgShippingCost: 40.2 }
        ]
      },
      {
        brand: "VANS",
        orders: 53246,
        percentage: 14.1,
        courierData: [
          { courier: "中通", orders: 31948, percentage: 60.0, avgShippingCost: 23.4 },
          { courier: "顺丰", orders: 21298, percentage: 40.0, avgShippingCost: 39.2 }
        ]
      },
      {
        brand: "TIMBERLAND",
        orders: 41524,
        percentage: 11.0,
        courierData: [
          { courier: "顺丰", orders: 24914, percentage: 60.0, avgShippingCost: 40.8 },
          { courier: "中通", orders: 16610, percentage: 40.0, avgShippingCost: 24.1 }
        ]
      },
      {
        brand: "ICEBREAKER",
        orders: 33974,
        percentage: 9.0,
        courierData: [
          { courier: "中通", orders: 20384, percentage: 60.0, avgShippingCost: 23.6 },
          { courier: "顺丰", orders: 13590, percentage: 40.0, avgShippingCost: 39.7 }
        ]
      },
      {
        brand: "KIPLING",
        orders: 30199,
        percentage: 8.0,
        courierData: [
          { courier: "中通", orders: 18119, percentage: 60.0, avgShippingCost: 23.2 },
          { courier: "顺丰", orders: 12080, percentage: 40.0, avgShippingCost: 39.0 }
        ]
      }
    ]
  }
];

// 省份重量快递详细数据
export const provinceWeightDetails: ProvinceWeightDetail[] = [
  {
    province: "广东",
    weightRanges: [
      {
        range: "0-1kg",
        totalOrders: 267693,
        avgCost: 8.2,
        couriers: [
          { courier: "中通", orders: 160616, percentage: 60.0, avgShippingCost: 7.0 },
          { courier: "顺丰", orders: 107077, percentage: 40.0, avgShippingCost: 12.5 }
        ]
      },
      {
        range: "1-3kg", 
        totalOrders: 223785,
        avgCost: 12.5,
        couriers: [
          { courier: "中通", orders: 134271, percentage: 60.0, avgShippingCost: 10.2 },
          { courier: "顺丰", orders: 89514, percentage: 40.0, avgShippingCost: 16.8 }
        ]
      },
      {
        range: "3-5kg",
        totalOrders: 149190,
        avgCost: 18.2,
        couriers: [
          { courier: "中通", orders: 89514, percentage: 60.0, avgShippingCost: 14.8 },
          { courier: "顺丰", orders: 59676, percentage: 40.0, avgShippingCost: 24.2 }
        ]
      },
      {
        range: "5kg+",
        totalOrders: 105712,
        avgCost: 27.8,
        couriers: [
          { courier: "中通", orders: 63427, percentage: 60.0, avgShippingCost: 21.8 },
          { courier: "顺丰", orders: 42285, percentage: 40.0, avgShippingCost: 37.5 }
        ]
      }
    ]
  },
  {
    province: "江苏",
    weightRanges: [
      {
        range: "0-1kg",
        totalOrders: 172097,
        avgCost: 8.5,
        couriers: [
          { courier: "中通", orders: 103258, percentage: 60.0, avgShippingCost: 7.3 },
          { courier: "顺丰", orders: 68839, percentage: 40.0, avgShippingCost: 12.8 }
        ]
      },
      {
        range: "1-3kg",
        totalOrders: 143769,
        avgCost: 12.8,
        couriers: [
          { courier: "中通", orders: 86262, percentage: 60.0, avgShippingCost: 10.5 },
          { courier: "顺丰", orders: 57508, percentage: 40.0, avgShippingCost: 17.2 }
        ]
      },
      {
        range: "3-5kg",
        totalOrders: 95846,
        avgCost: 18.5,
        couriers: [
          { courier: "中通", orders: 57508, percentage: 60.0, avgShippingCost: 15.2 },
          { courier: "顺丰", orders: 38338, percentage: 40.0, avgShippingCost: 24.8 }
        ]
      },
      {
        range: "5kg+",
        totalOrders: 67908,
        avgCost: 28.2,
        couriers: [
          { courier: "中通", orders: 40745, percentage: 60.0, avgShippingCost: 22.5 },
          { courier: "顺丰", orders: 27163, percentage: 40.0, avgShippingCost: 38.8 }
        ]
      }
    ]
  },
  {
    province: "浙江",
    weightRanges: [
      {
        range: "0-1kg",
        totalOrders: 143581,
        avgCost: 8.6,
        couriers: [
          { courier: "中通", orders: 86149, percentage: 60.0, avgShippingCost: 7.4 },
          { courier: "顺丰", orders: 57432, percentage: 40.0, avgShippingCost: 12.9 }
        ]
      },
      {
        range: "1-3kg",
        totalOrders: 119873,
        avgCost: 12.9,
        couriers: [
          { courier: "中通", orders: 71924, percentage: 60.0, avgShippingCost: 10.6 },
          { courier: "顺丰", orders: 47949, percentage: 40.0, avgShippingCost: 17.3 }
        ]
      },
      {
        range: "3-5kg",
        totalOrders: 79915,
        avgCost: 18.6,
        couriers: [
          { courier: "中通", orders: 47949, percentage: 60.0, avgShippingCost: 15.3 },
          { courier: "顺丰", orders: 31966, percentage: 40.0, avgShippingCost: 24.9 }
        ]
      },
      {
        range: "5kg+",
        totalOrders: 56631,
        avgCost: 28.4,
        couriers: [
          { courier: "中通", orders: 33979, percentage: 60.0, avgShippingCost: 22.7 },
          { courier: "顺丰", orders: 22652, percentage: 40.0, avgShippingCost: 39.0 }
        ]
      }
    ]
  }
];