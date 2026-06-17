export interface OrderKPIData {
  label: string;
  value: string;
  icon: string;
  change: {
    mom: number; // 环比
    yoy: number; // 同比
  };
  trend: 'up' | 'down' | 'stable';
  details?: {
    brands?: { name: string; value: number; percentage: number }[];
    exceptions?: { type: string; count: number; threshold: string }[];
    status?: string;
  };
}

export interface CourierData {
  name: string;
  picked: number;
  shipped: number;
  delivered: number;
  total: number; // 🔥 修复：添加总订单数字段
  pickupRate: number;
  shippingRate: number;
  deliveryRate: number;
  exceptions: {
    notPickedOver2h: number;
    notShippedOver12h: number;
    notUpdatedOver48h: number; // 新增：超48h未更新
    notDeliveredOver3days: number;
  };
}

export interface ForwardingData {
  type: 'address_change' | 'out_of_range';
  count: number;
  percentage: number;
  couriers: {
    name: string;
    count: number;
    percentage: number;
  }[];
  destinations?: {
    province: string;
    count: number;
    recommendation: string;
  }[];
}

export interface InterceptionData {
  type: 'warehouse_internal' | 'warehouse_external';
  count: number;
  successRate: number;
  trend: number;
  avgTime: number; // 平均拦截时长（分钟）
  timeTrend: number; // 时长变化趋势（百分比）
  timeDistribution: {
    range: string; // 时间范围，如 "0-30分钟"
    count: number;
    percentage: number;
  }[];
}

// 订单KPI数据 - 异常监控按阶段匹配
export const orderKPIData: OrderKPIData[] = [
  {
    label: '已揽收',
    value: '13,161',
    icon: '📋',
    change: { mom: 100.0, yoy: 85.2 },
    trend: 'up',
    details: {
      brands: [
        { name: 'TNF', value: 2632, percentage: 20.0 },
        { name: 'DICKIES', value: 2223, percentage: 16.9 },
        { name: 'VANS', value: 1856, percentage: 14.1 },
        { name: 'TIMBERLAND', value: 1448, percentage: 11.0 },
        { name: 'ICEBREAKER', value: 1184, percentage: 9.0 },
        { name: 'KIPLING', value: 1053, percentage: 8.0 },
      ],
      exceptions: [
        { type: '超时未揽收', count: 156, threshold: '2小时' }
      ]
    }
  },
  {
    label: '已发运',
    value: '85,153',
    icon: '🚚',
    change: { mom: -3.0, yoy: 15.8 },
    trend: 'down',
    details: {
      brands: [
        { name: 'TNF', value: 17031, percentage: 20.0 },
        { name: 'DICKIES', value: 14391, percentage: 16.9 },
        { name: 'VANS', value: 12007, percentage: 14.1 },
        { name: 'TIMBERLAND', value: 9367, percentage: 11.0 },
        { name: 'ICEBREAKER', value: 7664, percentage: 9.0 },
        { name: 'KIPLING', value: 6812, percentage: 8.0 },
      ],
      exceptions: [
        { type: '超时未发运', count: 127, threshold: '12小时' },
        { type: '超48h未更新', count: 185, threshold: '48小时' }
      ]
    }
  },
  {
    label: '已签收',
    value: '2,458,234',
    icon: '✅',
    change: { mom: 18.5, yoy: 32.1 },
    trend: 'up',
    details: {
      brands: [
        { name: 'TNF', value: 491647, percentage: 20.0 },
        { name: 'DICKIES', value: 415442, percentage: 16.9 },
        { name: 'VANS', value: 346612, percentage: 14.1 },
        { name: 'TIMBERLAND', value: 270406, percentage: 11.0 },
        { name: 'ICEBREAKER', value: 221241, percentage: 9.0 },
        { name: 'KIPLING', value: 196659, percentage: 8.0 },
      ],
      exceptions: [
        { type: '超时未签收', count: 156, threshold: '3天' }
      ]
    }
  },
  {
    label: '已转寄',
    value: '2,202',
    icon: '🔄',
    change: { mom: -35.0, yoy: -12.5 },
    trend: 'down',
    details: {
      brands: [
        { name: 'TNF', value: 440, percentage: 20.0 },
        { name: 'DICKIES', value: 372, percentage: 16.9 },
        { name: 'VANS', value: 310, percentage: 14.1 },
        { name: 'TIMBERLAND', value: 242, percentage: 11.0 },
        { name: 'ICEBREAKER', value: 198, percentage: 9.0 },
        { name: 'KIPLING', value: 176, percentage: 8.0 },
      ],
      // 已转寄不涉及异常指标，移除exceptions
      status: '改地址与超区转寄统计'
    }
  },
  {
    label: '已退回',
    value: '15,585',
    icon: '↩️',
    change: { mom: -17.0, yoy: -8.3 },
    trend: 'down',
    details: {
      brands: [
        { name: 'TNF', value: 3117, percentage: 20.0 },
        { name: 'DICKIES', value: 2634, percentage: 16.9 },
        { name: 'VANS', value: 2197, percentage: 14.1 },
        { name: 'TIMBERLAND', value: 1714, percentage: 11.0 },
        { name: 'ICEBREAKER', value: 1403, percentage: 9.0 },
        { name: 'KIPLING', value: 1247, percentage: 8.0 },
      ],
      exceptions: [
        { type: '超时未揽收', count: 56, threshold: '2小时' },
        { type: '超时未发运', count: 78, threshold: '12小时' },
        { type: '超48h未更新', count: 62, threshold: '48小时' },
        { type: '超时未签收', count: 187, threshold: '3天' }
      ],
      status: '拦截成功率监控'
    }
  },
  {
    label: '已取消',
    value: '275',
    icon: '❌',
    change: { mom: -67.0, yoy: -45.2 },
    trend: 'down',
    details: {
      brands: [
        { name: 'TNF', value: 55, percentage: 20.0 },
        { name: 'DICKIES', value: 46, percentage: 16.9 },
        { name: 'VANS', value: 39, percentage: 14.1 },
        { name: 'TIMBERLAND', value: 30, percentage: 11.0 },
        { name: 'ICEBREAKER', value: 25, percentage: 9.0 },
        { name: 'KIPLING', value: 22, percentage: 8.0 },
      ],
      exceptions: [
        { type: '超时未揽收', count: 32, threshold: '2小时' },
        { type: '超时未发运', count: 28, threshold: '12小时' },
        { type: '超48h未更新', count: 28, threshold: '48小时' }
      ],
      status: '库内外拦截分析'
    }
  },
  {
    label: '首派成功率',
    value: '92.3%',
    icon: '🎯',
    change: { mom: 1.8, yoy: 4.2 },
    trend: 'up',
    details: {
      brands: [
        { name: 'TNF', value: 92.8, percentage: 100.5 }, // 相对于平均值的表现
        { name: 'DICKIES', value: 92.2, percentage: 99.9 },
        { name: 'VANS', value: 92.4, percentage: 100.1 },
        { name: 'TIMBERLAND', value: 92.3, percentage: 100.0 },
        { name: 'ICEBREAKER', value: 92.0, percentage: 99.7 },
        { name: 'KIPLING', value: 92.1, percentage: 99.8 },
      ],
      exceptions: [
        { type: '超时未签收', count: 156, threshold: '3天' }
      ]
    }
  },
  {
    label: '平均首派时长',
    value: '18.5小时',
    icon: '⏱️',
    change: { mom: -2.1, yoy: -5.8 },
    trend: 'down',
    details: {
      brands: [
        { name: 'TNF', value: 16.8, percentage: 90.8 }, // 相对于平均值的表现，低于100表示优于平均
        { name: 'DICKIES', value: 19.2, percentage: 103.8 },
        { name: 'VANS', value: 17.5, percentage: 94.6 },
        { name: 'TIMBERLAND', value: 20.1, percentage: 108.6 },
        { name: 'ICEBREAKER', value: 18.9, percentage: 102.2 },
        { name: 'KIPLING', value: 17.8, percentage: 96.2 },
      ],
      exceptions: [
        { type: '超时未揽收', count: 234, threshold: '2小时' },
        { type: '超时未发运', count: 156, threshold: '12小时' },
        { type: '超48h未更新', count: 125, threshold: '48小时' }
      ]
    }
  },
  {
    label: '平均签收时长',
    value: '2.3天',
    icon: '📅',
    change: { mom: -1.8, yoy: -4.2 },
    trend: 'down',
    details: {
      brands: [
        { name: 'TNF', value: 2.1, percentage: 91.3 }, // 相对于平均值的表现，低于100表示优于平均
        { name: 'DICKIES', value: 2.5, percentage: 108.7 },
        { name: 'VANS', value: 2.2, percentage: 95.7 },
        { name: 'TIMBERLAND', value: 2.6, percentage: 113.0 },
        { name: 'ICEBREAKER', value: 2.4, percentage: 104.3 },
        { name: 'KIPLING', value: 2.3, percentage: 100.0 },
      ],
      exceptions: [
        { type: '超时未发运', count: 56, threshold: '12小时' },
        { type: '超48h未更新', count: 48, threshold: '48小时' },
        { type: '超时未签收', count: 187, threshold: '3天' }
      ]
    }
  }
];

// 快递公司数据 - 只保留中通和顺丰
export const courierData: CourierData[] = [
  {
    name: '中通',
    picked: 7832,
    shipped: 7523,
    delivered: 7234,
    total: 8175, // 🔥 修复：添加总订单数
    pickupRate: 95.8,
    shippingRate: 96.1,
    deliveryRate: 96.2,
    exceptions: {
      notPickedOver2h: 89,
      notShippedOver12h: 156,
      notUpdatedOver48h: 118, // 超48h未更新 - 适当增加数值
      notDeliveredOver3days: 124
    }
  },
  {
    name: '顺丰',
    picked: 5329,
    shipped: 5278,
    delivered: 5222,
    total: 5412, // 🔥 修复：添加总订单数
    pickupRate: 98.5,
    shippingRate: 99.0,
    deliveryRate: 99.1,
    exceptions: {
      notPickedOver2h: 67,
      notShippedOver12h: 78,
      notUpdatedOver48h: 67, // 超48h未更新 - 适当增加数值
      notDeliveredOver3days: 63
    }
  }
];

// 转寄数据 - 只包含中通和顺丰
export const forwardingData: ForwardingData[] = [
  {
    type: 'address_change',
    count: 1321,
    percentage: 60.0,
    couriers: [
      { name: '中通', count: 770, percentage: 58.3 },
      { name: '顺丰', count: 551, percentage: 41.7 }
    ]
  },
  {
    type: 'out_of_range',
    count: 881,
    percentage: 40.0,
    couriers: [
      { name: '中通', count: 599, percentage: 68.0 },
      { name: '顺丰', count: 282, percentage: 32.0 }
    ],
    destinations: [
      { province: '新疆', count: 234, recommendation: '建议使用邮政或德邦' },
      { province: '西藏', count: 187, recommendation: '建议使用邮政' },
      { province: '内蒙古', count: 156, recommendation: '建议使用中通' },
      { province: '甘肃', count: 134, recommendation: '建议使用顺丰' },
      { province: '青海', count: 89, recommendation: '建议使用邮政' },
      { province: '宁夏', count: 81, recommendation: '建议使用中通' }
    ]
  }
];

// 拦截数据 - 增加时长分析
export const interceptionData: InterceptionData[] = [
  {
    type: 'warehouse_internal',
    count: 8934,
    successRate: 98.5,
    trend: 2.3,
    avgTime: 12.5, // 平均拦截时长12.5分钟
    timeTrend: -5.2, // 时长减少5.2%
    timeDistribution: [
      { range: '0-10分钟', count: 5876, percentage: 65.8 },
      { range: '10-30分钟', count: 2678, percentage: 30.0 },
      { range: '30-60分钟', count: 312, percentage: 3.5 },
      { range: '60分钟以上', count: 68, percentage: 0.7 }
    ]
  },
  {
    type: 'warehouse_external',
    count: 6651,
    successRate: 87.2,
    trend: -1.8,
    avgTime: 156.8, // 平均拦截时长156.8分钟（约2.6小时）
    timeTrend: 3.1, // 时长增加3.1%
    timeDistribution: [
      { range: '0-60分钟', count: 1330, percentage: 20.0 },
      { range: '1-3小时', count: 2660, percentage: 40.0 },
      { range: '3-6小时', count: 1995, percentage: 30.0 },
      { range: '6小时以上', count: 666, percentage: 10.0 }
    ]
  }
];

// 为了兼容现有的导入，创建一个统一的订单数据结构
export interface OrderData {
  // 你可以根据实际需要定义这个结构
  kpiData: OrderKPIData[];
  courierData: CourierData[];
  forwardingData: ForwardingData[];
  interceptionData: InterceptionData[];
}

// 导出统一的订单数据对象
export const orderData: OrderData = {
  kpiData: orderKPIData,
  courierData: courierData,
  forwardingData: forwardingData,
  interceptionData: interceptionData
};

// 默认导出
export default orderData;