// 时效表数据 - SLA标准
export interface SLARecord {
  brand: string;
  city: string;
  courierCompany: string;
  s2dSLA: number; // S2D时效标准（小时）
  c2dSLA: number; // C2D时效标准（天）
}

// 快递公司列表（仅中通和顺丰）
export const courierCompanies = [
  '顺丰速运',
  '中通快递'
];

// 主要城市列表
export const majorCities = [
  '北京', '上海', '广州', '深圳', '杭州', '南京', '苏州', '成都',
  '重庆', '武汉', '西安', '天津', '青岛', '大连', '宁波', '无锡',
  '长沙', '郑州', '沈阳', '济南', '哈尔滨', '长春', '福州', '厦门',
  '昆明', '南宁', '贵阳', '兰州', '乌鲁木齐', '银川', '西宁', '拉萨'
];

// VF品牌列表
export const vfBrands = ['TNF', 'DICKIES', 'VANS', 'TIMBERLAND', 'ICEBREAKER', 'KIPLING'];

// 生成SLA时效表数据
export const generateSLAData = (): SLARecord[] => {
  const slaData: SLARecord[] = [];
  
  vfBrands.forEach(brand => {
    majorCities.forEach(city => {
      courierCompanies.forEach(courier => {
        // 根据城市等级和快递公司设置不同的SLA标准
        let s2dSLA: number;
        let c2dSLA: number;
        
        // 一线城市（北上广深）
        if (['北京', '上海', '广州', '深圳'].includes(city)) {
          if (['顺丰速运', '京东物流'].includes(courier)) {
            s2dSLA = 12; // 12小时
            c2dSLA = 1;  // 1天
          } else {
            s2dSLA = 24; // 24小时
            c2dSLA = 2;  // 2天
          }
        }
        // 新一线城市
        else if (['杭州', '南京', '苏州', '成都', '重庆', '武汉', '西安', '天津'].includes(city)) {
          if (['顺丰速运', '京东物流'].includes(courier)) {
            s2dSLA = 18; // 18小时
            c2dSLA = 2;  // 2天
          } else {
            s2dSLA = 36; // 36小时
            c2dSLA = 3;  // 3天
          }
        }
        // 其他城市
        else {
          if (['顺丰速运', '京东物流'].includes(courier)) {
            s2dSLA = 24; // 24小时
            c2dSLA = 2;  // 2天
          } else {
            s2dSLA = 48; // 48小时
            c2dSLA = 3;  // 3天
          }
        }
        
        slaData.push({
          brand,
          city,
          courierCompany: courier,
          s2dSLA,
          c2dSLA
        });
      });
    });
  });
  
  return slaData;
};

// 获取SLA数据
export const slaData = generateSLAData();

// 根据品牌、城市、快递公司查找SLA标准
export const findSLA = (brand: string, city: string, courier: string): SLARecord | null => {
  return slaData.find(record => 
    record.brand === brand && 
    record.city === city && 
    record.courierCompany === courier
  ) || null;
};