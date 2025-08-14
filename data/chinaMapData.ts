// 中国省份地图数据
export interface ProvinceMapData {
  name: string;           // 省份名称
  code: string;          // 省份代码
  orders: number;        // 订单量
  percentage: number;    // 占比
  growth: number;        // 增长率
  coordinates: [number, number]; // 标注点坐标 [x, y] (SVG坐标系)
}

// GeoJSON Feature 接口定义
export interface GeoJSONFeature {
  type: "Feature";
  properties: {
    id: string;
    size: string;
    name: string;
    cp: [number, number]; // 中心点坐标 [经度, 纬度]
    childNum: number;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

// 完整的中国地图GeoJSON数据结构
export interface ChinaGeoJSON {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// 中国地图GeoJSON数据 - 请在这里插入您的完整JSON数据
export const chinaGeoJSON: ChinaGeoJSON = {
  type: "FeatureCollection",
  features: [
    // ==========================================
    // 🔻 请将您的china.js文件中的features数组内容粘贴到这里 🔻
    // ==========================================
    {
      type: "Feature",
      properties: { id: "65", size: "550", name: "新疆维吾尔自治区", cp: [84.9023, 42.148], childNum: 18 },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [96.416, 42.7588],
          [96.416, 42.7148],
          [95.9766, 42.4951],
          [96.0645, 42.3193],
          [96.2402, 42.2314],
          [95.9766, 41.9238],
          [95.2734, 41.6162],
          [95.1855, 41.792],
          [94.5703, 41.4844],
          [94.043, 41.0889],
          [93.8672, 40.6934],
          [93.0762, 40.6494],
          [92.6367, 39.6387],
          [92.373, 39.3311],
          [92.373, 39.1113],
          [92.373, 39.0234],
          [90.1758, 38.4961],
          [90.3516, 38.2324],
          [90.6152, 38.3203],
          [90.5273, 37.8369],
          [91.0547, 37.4414],
          [91.3184, 37.0898],
          [90.7031, 36.7822],
          [90.791, 36.6064],
          [91.0547, 36.5186],
          [91.0547, 36.0791],
          [90.8789, 36.0352],
          [90, 36.2549],
          [89.9121, 36.0791],
          [89.7363, 36.0791],
          [89.209, 36.2988],
          [88.7695, 36.3428],
          [88.5938, 36.4746],
          [87.3633, 36.4307],
          [86.2207, 36.167],
          [86.1328, 35.8594],
          [85.6055, 35.6836],
          [85.0781, 35.7275],
          [84.1992, 35.376],
          [83.1445, 35.4199],
          [82.8809, 35.6836],
          [82.4414, 35.7275],
          [82.002, 35.332],
          [81.6504, 35.2441],
          [80.4199, 35.4199],
          [80.2441, 35.2881],
          [80.332, 35.1563],
          [80.2441, 35.2002],
          [79.8926, 34.8047],
          [79.8047, 34.4971],
          [79.1016, 34.4531],
          [79.0137, 34.3213],
          [78.2227, 34.7168],
          [78.0469, 35.2441],
          [78.0469, 35.5078],
          [77.4316, 35.4639],
          [76.8164, 35.6396],
          [76.5527, 35.8594],
          [76.2012, 35.8154],
          [75.9375, 36.0352],
          [76.0254, 36.4746],
          [75.8496, 36.6943],
          [75.498, 36.7383],
          [75.4102, 36.958],
          [75.0586, 37.002],
          [74.8828, 36.9141],
          [74.7949, 37.0459],
          [74.5313, 37.0898],
          [74.5313, 37.2217],
          [74.8828, 37.2217],
          [75.1465, 37.4414],
          [74.8828, 37.5732],
          [74.9707, 37.749],
          [74.8828, 38.4521],
          [74.3555, 38.6719],
          [74.1797, 38.6719],
          [74.0918, 38.54],
          [73.8281, 38.584],
          [73.7402, 38.8477],
          [73.8281, 38.9795],
          [73.4766, 39.375],
          [73.916, 39.5068],
          [73.916, 39.6826],
          [73.8281, 39.7705],
          [74.0039, 40.0342],
          [74.8828, 40.3418],
          [74.7949, 40.5176],
          [75.2344, 40.4297],
          [75.5859, 40.6494],
          [75.7617, 40.2979],
          [76.377, 40.3857],
          [76.9043, 41.001],
          [77.6074, 41.001],
          [78.1348, 41.2207],
          [78.1348, 41.3965],
          [80.1563, 42.0557],
          [80.2441, 42.2754],
          [80.1563, 42.627],
          [80.2441, 42.8467],
          [80.5078, 42.8906],
          [80.4199, 43.0664],
          [80.7715, 43.1982],
          [80.4199, 44.165],
          [80.4199, 44.6045],
          [79.9805, 44.8242],
          [79.9805, 44.9561],
          [81.7383, 45.3955],
          [82.0898, 45.2197],
          [82.5293, 45.2197],
          [82.2656, 45.6592],
          [83.0566, 47.2412],
          [83.6719, 47.0215],
          [84.7266, 47.0215],
          [84.9023, 46.8896],
          [85.5176, 47.0654],
          [85.6934, 47.2852],
          [85.5176, 48.1201],
          [85.7813, 48.4277],
          [86.5723, 48.5596],
          [86.8359, 48.8232],
          [86.748, 48.9551],
          [86.8359, 49.1309],
          [87.8027, 49.1748],
          [87.8906, 48.999],
          [87.7148, 48.9111],
          [88.0664, 48.7354],
          [87.9785, 48.6035],
          [88.5059, 48.3838],
          [88.6816, 48.1641],
          [89.1211, 47.9883],
          [89.5605, 48.0322],
          [89.7363, 47.8564],
          [90.0879, 47.8564],
          [90.3516, 47.6807],
          [90.5273, 47.2412],
          [90.8789, 46.9775],
          [91.0547, 46.582],
          [90.8789, 46.3184],
          [91.0547, 46.0107],
          [90.7031, 45.7471],
          [90.7031, 45.5273],
          [90.8789, 45.2197],
          [91.582, 45.0879],
          [93.5156, 44.9561],
          [94.7461, 44.3408],
          [95.3613, 44.2969],
          [95.3613, 44.0332],
          [95.5371, 43.9014],
          [95.8887, 43.2422],
          [96.3281, 42.9346],
          [96.416, 42.7588]
        ]]
      }
    }
    // ==========================================
    // 🔺 请在这里继续添加其他省份的数据 🔺
    // ==========================================
    // 提示：您需要将china.js文件中所有34个省份/直辖市/自治区的数据都复制到这里
    // 格式参考上面的新疆数据结构
  ]
};

// 地图配置参数
export const chinaMapConfig = {
  center: [104.1954, 35.8617] as [number, number], // 中国地理中心坐标
  zoom: 4,
  projection: "geoMercator" as const,
  width: 800,
  height: 600,
  // SVG视图框配置
  viewBox: {
    width: 500,
    height: 450,
    minX: 0,
    minY: 0
  }
};

// 省份名称映射（用于匹配GeoJSON中的省份名称和我们的统计数据）
export const provinceNameMapping: Record<string, string> = {
  // GeoJSON中的名称 -> 我们数据中的名称
  '新疆维吾尔自治区': '新疆',
  '西藏自治区': '西藏', 
  '内蒙古自治区': '内蒙古',
  '青海省': '青海',
  '四川省': '四川',
  '黑龙江省': '黑龙江',
  '甘肃省': '甘肃',
  '云南省': '云南',
  '广西壮族自治区': '广西',
  '湖南省': '湖南',
  '陕西省': '陕西',
  '广东省': '广东',
  '吉林省': '吉林',
  '河北省': '河北',
  '湖北省': '湖北',
  '贵州省': '贵州',
  '山东省': '山东',
  '江西省': '江西',
  '河南省': '河南',
  '辽宁省': '辽宁',
  '山西省': '山西',
  '安徽省': '安徽',
  '福建省': '福建',
  '浙江省': '浙江',
  '江苏省': '江苏',
  '重庆市': '重庆',
  '宁夏回族自治区': '宁夏',
  '海南省': '海南',
  '台湾省': '台湾',
  '北京市': '北京',
  '天津市': '天津',
  '上海市': '上海',
  '香港特别行政区': '香港',
  '澳门特别行政区': '澳门'
};

// 获取省份的GeoJSON数据
export function getProvinceGeoJSON(provinceName: string): GeoJSONFeature | null {
  // 支持通过中文全名或简称查找
  const fullName = Object.keys(provinceNameMapping).find(key => 
    provinceNameMapping[key] === provinceName || key === provinceName
  );
  
  if (!fullName) return null;
  
  return chinaGeoJSON.features.find(feature => 
    feature.properties.name === fullName
  ) || null;
}

// 获取所有省份的GeoJSON特征
export function getAllProvincesGeoJSON(): GeoJSONFeature[] {
  return chinaGeoJSON.features;
}

// 根据省份名称获取统计数据
export function getProvinceStatsData(geoJsonName: string): ProvinceMapData | null {
  const shortName = provinceNameMapping[geoJsonName];
  if (!shortName) return null;
  
  return chinaProvinceData.find(province => province.name === shortName) || null;
}

// 中国省份订单分布数据（基于RegionalPage中的省份数据扩展）
export const chinaProvinceData: ProvinceMapData[] = [
  // 华北地区
  { name: "北京", code: "beijing", orders: 1700, percentage: 7.2, growth: 6.5, coordinates: [398, 134] },
  { name: "天津", code: "tianjin", orders: 1087, percentage: 4.6, growth: 4.1, coordinates: [406, 144] },
  { name: "河北", code: "hebei", orders: 981, percentage: 4.2, growth: 2.5, coordinates: [380, 160] },
  { name: "山西", code: "shanxi", orders: 223, percentage: 0.9, growth: 1.0, coordinates: [350, 180] },
  { name: "内蒙古", code: "neimenggu", orders: 274, percentage: 1.2, growth: 2.5, coordinates: [320, 120] },
  
  // 东北地区
  { name: "辽宁", code: "liaoning", orders: 176, percentage: 0.7, growth: 2.8, coordinates: [420, 110] },
  { name: "吉林", code: "jilin", orders: 355, percentage: 1.5, growth: 1.8, coordinates: [440, 90] },
  { name: "黑龙江", code: "heilongjiang", orders: 418, percentage: 1.8, growth: 2.5, coordinates: [430, 70] },
  
  // 华东地区
  { name: "上海", code: "shanghai", orders: 1300, percentage: 5.5, growth: 0.2, coordinates: [450, 250] },
  { name: "江苏", code: "jiangsu", orders: 2100, percentage: 8.9, growth: 5.8, coordinates: [420, 240] },
  { name: "浙江", code: "zhejiang", orders: 1850, percentage: 7.9, growth: 4.8, coordinates: [440, 270] },
  { name: "安徽", code: "anhui", orders: 151, percentage: 0.6, growth: -0.5, coordinates: [400, 250] },
  { name: "福建", code: "fujian", orders: 350, percentage: 1.5, growth: -2.1, coordinates: [430, 310] },
  { name: "江西", code: "jiangxi", orders: 115, percentage: 0.5, growth: 1.8, coordinates: [390, 290] },
  { name: "山东", code: "shandong", orders: 870, percentage: 3.7, growth: 5.8, coordinates: [380, 190] },
  
  // 华中地区
  { name: "河南", code: "henan", orders: 803, percentage: 3.4, growth: 4.8, coordinates: [360, 220] },
  { name: "湖北", code: "hubei", orders: 330, percentage: 1.4, growth: 3.2, coordinates: [350, 260] },
  { name: "湖南", code: "hunan", orders: 680, percentage: 2.9, growth: 3.8, coordinates: [340, 290] },
  
  // 华南地区
  { name: "广东", code: "guangdong", orders: 3270, percentage: 13.9, growth: 6.1, coordinates: [360, 340] },
  { name: "广西", code: "guangxi", orders: 290, percentage: 1.2, growth: 1.4, coordinates: [320, 350] },
  { name: "海南", code: "hainan", orders: 275, percentage: 1.2, growth: 2.1, coordinates: [340, 410] },
  
  // 西南地区
  { name: "重庆", code: "chongqing", orders: 234, percentage: 1.0, growth: 3.8, coordinates: [320, 280] },
  { name: "四川", code: "sichuan", orders: 800, percentage: 3.4, growth: 6.0, coordinates: [280, 280] },
  { name: "贵州", code: "guizhou", orders: 520, percentage: 2.2, growth: 4.0, coordinates: [300, 320] },
  { name: "云南", code: "yunnan", orders: 470, percentage: 2.0, growth: 2.8, coordinates: [260, 340] },
  { name: "西藏", code: "xizang", orders: 89, percentage: 0.4, growth: 1.2, coordinates: [200, 300] },
  
  // 西北地区
  { name: "陕西", code: "shaanxi", orders: 103, percentage: 0.4, growth: -3.2, coordinates: [320, 220] },
  { name: "甘肃", code: "gansu", orders: 180, percentage: 0.8, growth: -1.5, coordinates: [260, 200] },
  { name: "青海", code: "qinghai", orders: 124, percentage: 0.5, growth: 0.8, coordinates: [240, 220] },
  { name: "宁夏", code: "ningxia", orders: 98, percentage: 0.4, growth: 2.1, coordinates: [310, 190] },
  { name: "新疆", code: "xinjiang", orders: 156, percentage: 0.7, growth: 1.8, coordinates: [160, 160] }
];

// 订单量分级配置 - 使用Maersk色彩系统
export const ORDER_LEVEL_CONFIG = [
  { 
    min: 0, 
    max: 100, 
    color: 'var(--functional-bright-blue)', // #e2f3fb - 最浅蓝色
    borderColor: 'var(--functional-light-blue)', // #a1d1e8 - 浅蓝色边框
    label: '0-100',
    description: '低订单量区域'
  },
  { 
    min: 101, 
    max: 500, 
    color: 'var(--functional-light-blue)', // #a1d1e8 - 浅蓝色
    borderColor: 'var(--functional-mid-blue)', // #1686bd - 中蓝色边框
    label: '101-500',
    description: '中低订单量区域'
  },
  { 
    min: 501, 
    max: 1000, 
    color: 'var(--maersk-blue)', // #42b0d5 - Maersk蓝
    borderColor: 'var(--functional-mid-blue)', // #1686bd - 中蓝色边框
    label: '501-1000',
    description: '中等订单量区域'
  },
  { 
    min: 1001, 
    max: 2000, 
    color: 'var(--functional-mid-blue)', // #1686bd - 中蓝色
    borderColor: 'var(--functional-dark-blue)', // #003e62 - 深蓝色边框
    label: '1001-2000',
    description: '中高订单量区域'
  },
  { 
    min: 2001, 
    max: Infinity, 
    color: 'var(--functional-dark-blue)', // #003e62 - 深蓝色
    borderColor: 'var(--maersk-black)', // #141414 - 黑色边框
    label: '2000+',
    description: '高订单量区域'
  }
];

// 根据订单量获取颜色配置
export function getOrderLevelConfig(orderCount: number) {
  const config = ORDER_LEVEL_CONFIG.find(level => 
    orderCount >= level.min && orderCount <= level.max
  );
  return config || ORDER_LEVEL_CONFIG[0];
}

// 根据订单量获取颜色
export function getOrderLevelColor(orderCount: number): string {
  const config = getOrderLevelConfig(orderCount);
  return config.color;
}

// 根据订单量获取边框颜色
export function getOrderLevelBorderColor(orderCount: number): string {
  const config = getOrderLevelConfig(orderCount);
  return config.borderColor;
}

// 根据订单量获取标签
export function getOrderLevelLabel(orderCount: number): string {
  const config = getOrderLevelConfig(orderCount);
  return config.label;
}

// 根据订单量获取描述
export function getOrderLevelDescription(orderCount: number): string {
  const config = getOrderLevelConfig(orderCount);
  return config.description;
}

// 获取省份显示名称（缩写）
export function getProvinceShortName(fullName: string): string {
  const shortNames: Record<string, string> = {
    '北京': '京',
    '天津': '津', 
    '河北': '冀',
    '山西': '晋',
    '内蒙古': '蒙',
    '辽宁': '辽',
    '吉林': '吉',
    '黑龙江': '黑',
    '上海': '沪',
    '江苏': '苏',
    '浙江': '浙',
    '安徽': '皖',
    '福建': '闽',
    '江西': '赣',
    '山东': '鲁',
    '河南': '豫',
    '湖北': '鄂',
    '湖南': '湘',
    '广东': '粤',
    '广西': '桂',
    '海南': '琼',
    '重庆': '渝',
    '四川': '川',
    '贵州': '黔',
    '云南': '滇',
    '西藏': '藏',
    '陕西': '陕',
    '甘肃': '甘',
    '青海': '青',
    '宁夏': '宁',
    '新疆': '新'
  };
  
  return shortNames[fullName] || fullName.substring(0, 2);
}

// 计算总订单量
export const totalChinaOrders = chinaProvinceData.reduce((sum, province) => sum + province.orders, 0);

// 获取Top省份（订单量前5）
export const topProvinces = [...chinaProvinceData]
  .sort((a, b) => b.orders - a.orders)
  .slice(0, 5);

// Maersk色彩主题配置
export const MAERSK_MAP_THEME = {
  background: {
    primary: 'var(--functional-bright-grey)', // #f0f0f0 - 背景色
    secondary: 'var(--maersk-white)', // #ffffff - 卡片背景
  },
  text: {
    primary: 'var(--maersk-black)', // #141414 - 主要文字
    secondary: 'var(--functional-mid-grey)', // #6a6a6a - 次要文字
    accent: 'var(--maersk-blue)', // #42b0d5 - 强调文字
  },
  border: {
    primary: 'var(--functional-light-grey)', // #d4d4d4 - 主要边框
    secondary: 'var(--functional-bright-blue)', // #e2f3fb - 次要边框
    active: 'var(--maersk-blue)', // #42b0d5 - 激活边框
  },
  interaction: {
    hover: 'var(--functional-bright-blue)', // #e2f3fb - hover背景
    active: 'var(--maersk-blue)', // #42b0d5 - 激活状态
    focus: 'var(--functional-mid-blue)', // #1686bd - 焦点状态
  }
};

// 验证GeoJSON数据的完整性
export function validateChinaGeoJSON(): {
  isValid: boolean;
  totalFeatures: number;
  missingProvinces: string[];
  message: string;
} {
  const expectedProvinces = Object.keys(provinceNameMapping);
  const actualProvinces = chinaGeoJSON.features.map(f => f.properties.name);
  const missingProvinces = expectedProvinces.filter(p => !actualProvinces.includes(p));
  
  const isValid = missingProvinces.length === 0 && chinaGeoJSON.features.length >= 34;
  
  return {
    isValid,
    totalFeatures: chinaGeoJSON.features.length,
    missingProvinces,
    message: isValid 
      ? `✅ GeoJSON数据完整，包含${chinaGeoJSON.features.length}个省份/地区`
      : `⚠️ GeoJSON数据不完整，缺少${missingProvinces.length}个省份: ${missingProvinces.join(', ')}`
  };
}