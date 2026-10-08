/**
 * 品牌映射动态加载模块
 * 从 APP_CMS.BAS_COMPANY 表查询品牌名称和品牌代码的映射关系
 * 应用启动时加载一次，缓存在内存中
 */

const { getConnection, releaseConnection } = require('../config/database-api');

// 内存缓存
let brandMappingCache = null;
let lastLoadTime = null;
let mappingLoadPromise = null;
const CACHE_DURATION = 60 * 60 * 1000; // 缓存1小时

/**
 * 从数据库加载品牌映射
 */
async function loadBrandMapping() {
  if (mappingLoadPromise) {
    return mappingLoadPromise;
  }

  console.log('🔄 [品牌映射] 开始从数据库加载品牌映射...');

  mappingLoadPromise = (async () => {
    let connection;

    try {
      connection = await getConnection();

      // 查询全部有效品牌映射（品牌简称 -> 品牌编码）
      // 不能只限制 VF 品牌，否则外部用户品牌（如 APEDEMOD/BALMAIN）无法映射为 CUSTOMERNO。
      const query = `
        SELECT
          COMPANY_ABNAME,
          COMPANY_SYSID
        FROM APP_CMS.BAS_COMPANY
        WHERE COMPANY_ABNAME IS NOT NULL
          AND COMPANY_SYSID IS NOT NULL
        ORDER BY COMPANY_SYSID
      `;

      const result = await connection.execute(query);

      // 构建映射对象（同时保留原始键和大写键，提升匹配鲁棒性）
      const mapping = {};
      result.rows.forEach(row => {
        const brandName = String(row[0] || '').trim();
        const brandCode = String(row[1] || '').trim();
        if (brandName && brandCode) {
          mapping[brandName] = brandCode;
          mapping[brandName.toUpperCase()] = brandCode;
        }
      });

      brandMappingCache = mapping;
      lastLoadTime = Date.now();

      console.log(`📊 [品牌映射] 共加载 ${Object.keys(mapping).length} 条映射（含大小写冗余键）`);

      return mapping;
    } catch (error) {
      console.error('❌ [品牌映射] 加载失败:', error.message);

      const fallbackMapping = {
        'DICKIES': '18405',
        'TNF': '18405-1',
        'ICEBREAKER': '18405-2',
        'VANS': '18405-3',
        'TIMBERLAND': '18405-4',
        'SMARTWOOL': '18405-5'
      };

      console.log('⚠️ [品牌映射] 使用回退映射:', fallbackMapping);
      brandMappingCache = fallbackMapping;
      lastLoadTime = Date.now();

      return fallbackMapping;
    } finally {
      if (connection) {
        await releaseConnection(connection);
      }
    }
  })();

  try {
    return await mappingLoadPromise;
  } finally {
    mappingLoadPromise = null;
  }
}

/**
 * 获取品牌映射（带缓存）
 * @param {boolean} forceReload - 是否强制重新加载
 */
async function getBrandMapping(forceReload = false) {
  // 如果缓存为空或强制重新加载，则从数据库加载
  if (!brandMappingCache || forceReload) {
    return await loadBrandMapping();
  }
  
  // 如果缓存过期，重新加载
  const cacheAge = Date.now() - lastLoadTime;
  if (cacheAge > CACHE_DURATION) {
    console.log(`⏰ [品牌映射] 缓存已过期 (${Math.round(cacheAge / 1000 / 60)}分钟)，重新加载...`);
    return await loadBrandMapping();
  }
  
  // 返回缓存的映射
  return brandMappingCache;
}

/**
 * 将前端品牌名称转换为数据库品牌代码
 * @param {string} brandName - 品牌名称 (如 'DICKIES')
 * @returns {string} 品牌代码 (如 '18405')
 */
async function getBrandCode(brandName) {
  if (!brandName) {
    return null;
  }
  
  const mapping = await getBrandMapping();
  return mapping[brandName] || brandName; // 找不到时返回原值
}

/**
 * 获取所有品牌列表
 * @returns {Array} 品牌列表 [{name: 'DICKIES', code: '18405'}, ...]
 */
async function getAllBrands() {
  const mapping = await getBrandMapping();
  return Object.entries(mapping).map(([name, code]) => ({
    name,
    code
  }));
}

/**
 * 清除缓存（用于测试或手动刷新）
 */
function clearCache() {
  console.log('🗑️ [品牌映射] 清除缓存');
  brandMappingCache = null;
  lastLoadTime = null;
}

module.exports = {
  loadBrandMapping,
  getBrandMapping,
  getBrandCode,
  getAllBrands,
  clearCache
};
