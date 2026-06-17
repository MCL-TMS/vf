/**
 * 🏆 竞品对标配置管理
 * 
 * ⚠️ 核心原则：
 * - 竞品数据从API获取（与当前品牌数据使用同一接口）
 * - 只是 CUSTOMERNO 参数不同
 * - 竞品数据不做任何前台展示
 * - 仅在AI助手回答客户提问时使用
 * - AI助手只显示比率，不显示具体订单数
 * 
 * 📋 配置说明：
 * - enabled: 是否启用竞品对比功能
 * - competitors: 竞品品牌代码列表（对应数据库中的 CUSTOMERNO）
 */

export interface CompetitorBenchmarkConfig {
  enabled: boolean;
  competitors: string[];  // 竞品品牌代码列表（如 'ANF', 'STICHDMAN'）
}

// 🔧 竞品对标配置
export const COMPETITOR_BENCHMARK_CONFIG: CompetitorBenchmarkConfig = {
  // ⚠️ 如果数据库中没有竞品数据，请设置为 false
  enabled: false, // ← 暂时禁用，避免不必要的API请求
  
  // 🏆 竞品品牌代码列表（对应数据库中的 CUSTOMERNO）
  // ⚠️ 确保这些品牌在数据库中存在订单数据！
  competitors: ['ANF', 'STICHDMAN']
  
  // 💡 使用建议：
  // 1. 先在数据库中查询可用的品牌代码：
  //    SELECT DISTINCT CUSTOMERNO FROM APP_CMS.VF_LOGISTICS_ORDER;
  // 
  // 2. 选择订单量相似的品牌作为竞品（例如）：
  //    competitors: ['TNF', 'VANS']
  // 
  // 3. 如果数据库中只有一个品牌的数据，请设置：
  //    enabled: false
  //    competitors: []
  
  // ⚠️ 注意：
  // - 每个竞品会增加一次API调用
  // - 品牌代码必须与数据库 CUSTOMERNO 字段完全一致（大小写敏感）
  // - 建议竞品数量：2-3个（避免过多API请求）
};