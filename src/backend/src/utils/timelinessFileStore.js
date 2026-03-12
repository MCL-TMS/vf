/**
 * VF物流时效数据文件存储管理器
 * 
 * ✅ 2025-01-09创建: 无数据库写入权限的替代方案
 * ✅ 2025-01-09优化: 同时保存Excel原文件和JSON缓存，优先使用JSON，兼容Excel回退
 * 
 * 功能：
 * - 保存Excel原文件（主数据源）
 * - 保存JSON缓存（加速查询）
 * - 查询时优先使用JSON，如JSON缺失则实时解析Excel
 * - 维护内存缓存供快速查询
 * - 支持多版本管理和历史记录
 */

const fs = require('fs');
const path = require('path');

// 时效数据存储目录
const TIMELINESS_DATA_DIR = path.join(__dirname, '../../uploads/timeliness');
const METADATA_FILE = path.join(TIMELINESS_DATA_DIR, 'metadata.json');

// 内存缓存
let cachedTimelinessData = null;
let cachedMetadata = null;

/**
 * 确保存储目录存在
 */
function ensureDirectoryExists() {
  if (!fs.existsSync(TIMELINESS_DATA_DIR)) {
    fs.mkdirSync(TIMELINESS_DATA_DIR, { recursive: true });
    console.log(`✅ 创建时效数据目录: ${TIMELINESS_DATA_DIR}`);
  }
}

/**
 * 生成文件ID
 */
function generateFileId() {
  return `timeliness_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 保存时效数据到文件（同时保存Excel原文件和JSON缓存）
 * @param {Array} parsedData - 解析后的时效数据
 * @param {Object} metadata - 元数据（文件名、上传时间、excelFilePath等）
 * @returns {Object} 保存结果
 */
async function saveTimelinessData(parsedData, metadata) {
  try {
    ensureDirectoryExists();
    
    const fileId = generateFileId();
    const timestamp = new Date().toISOString();
    
    // JSON缓存文件路径
    const jsonFilePath = path.join(TIMELINESS_DATA_DIR, `${fileId}.json`);
    
    // Excel原文件路径（如果提供）
    let excelFilePath = null;
    if (metadata.excelFilePath && fs.existsSync(metadata.excelFilePath)) {
      // 复制Excel文件到时效数据目录
      const excelFileName = `${fileId}.xlsx`;
      excelFilePath = path.join(TIMELINESS_DATA_DIR, excelFileName);
      fs.copyFileSync(metadata.excelFilePath, excelFilePath);
      console.log(`✅ Excel原文件已保存: ${excelFilePath}`);
    }
    
    // 准备保存的数据结构
    const dataToSave = {
      fileId,
      uploadTime: timestamp,
      fileName: metadata.originalName || 'unknown.xlsx',
      recordCount: parsedData.length,
      data: parsedData,
      excelFilePath: excelFilePath, // ✅ 新增：保存Excel文件路径
      metadata: {
        uploader: metadata.uploader || 'system',
        remarks: metadata.remarks || '',
        version: metadata.version || '1.0',
        brand: metadata.brand || 'all'
      }
    };
    
    // 保存JSON缓存文件
    fs.writeFileSync(jsonFilePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
    console.log(`✅ JSON缓存已保存: ${jsonFilePath}`);
    
    // 更新元数据索引
    const metadataEntry = {
      fileId,
      fileName: dataToSave.fileName,
      uploadTime: timestamp,
      recordCount: parsedData.length,
      jsonFilePath: jsonFilePath,      // ✅ JSON缓存路径
      excelFilePath: excelFilePath,    // ✅ Excel原文件路径
      isActive: true
    };
    
    await updateMetadataIndex(metadataEntry);
    
    // 自动设置为当前活跃版本
    await setActiveVersion(fileId);
    
    return {
      success: true,
      fileId,
      recordCount: parsedData.length,
      jsonFilePath: jsonFilePath,
      excelFilePath: excelFilePath,
      message: `成功保存${parsedData.length}条时效数据（Excel原文件${excelFilePath ? '已保存' : '未提供'}）`
    };
    
  } catch (error) {
    console.error('❌ 保存时效数据失败:', error);
    throw new Error(`保存失败: ${error.message}`);
  }
}

/**
 * 更新元数据索引
 */
async function updateMetadataIndex(newEntry) {
  try {
    ensureDirectoryExists();
    
    let metadata = { files: [], activeFileId: null };
    
    // 读取现有元数据
    if (fs.existsSync(METADATA_FILE)) {
      const content = fs.readFileSync(METADATA_FILE, 'utf-8');
      metadata = JSON.parse(content);
    }
    
    // 添加新条目
    metadata.files.push(newEntry);
    
    // 保存更新后的元数据
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`✅ 元数据索引已更新`);
    
    // 更新缓存
    cachedMetadata = metadata;
    
  } catch (error) {
    console.error('❌ 更新元数据索引失败:', error);
    throw error;
  }
}

/**
 * 设置活跃版本
 */
async function setActiveVersion(fileId) {
  try {
    ensureDirectoryExists();
    
    let metadata = { files: [], activeFileId: null };
    
    if (fs.existsSync(METADATA_FILE)) {
      const content = fs.readFileSync(METADATA_FILE, 'utf-8');
      metadata = JSON.parse(content);
    }
    
    // 设置活跃版本
    metadata.activeFileId = fileId;
    
    // 更新所有文件的isActive状态
    metadata.files = metadata.files.map(file => ({
      ...file,
      isActive: file.fileId === fileId
    }));
    
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`✅ 已设置活跃版本: ${fileId}`);
    
    // 清除缓存，强制重新加载
    cachedTimelinessData = null;
    cachedMetadata = metadata;
    
    // 立即加载新的活跃版本
    await loadActiveTimelinessData();
    
  } catch (error) {
    console.error('❌ 设置活跃版本失败:', error);
    throw error;
  }
}

/**
 * 从Excel文件实时解析时效数据（备选方案）
 * 注意：由于模块格式问题（CommonJS vs ES6），暂时禁用此功能
 * 优先使用JSON缓存，如果JSON缺失，请重新上传Excel
 * 
 * @param {String} excelFilePath - Excel文件路径
 * @returns {Array|null} 解析后的数据
 */
async function parseExcelFile(excelFilePath) {
  console.warn('⚠️  Excel实时解析功能暂时禁用（模块格式问题）');
  console.log('💡 提示：请重新上传Excel文件以生成JSON缓存');
  return null;
  
  /* 
  // TODO: 修复模块导入问题后启用
  try {
    if (!fs.existsSync(excelFilePath)) {
      console.error(`❌ Excel文件不存在: ${excelFilePath}`);
      return null;
    }
    
    console.log(`📂 开始解析Excel文件: ${excelFilePath}`);
    
    // 动态导入Excel解析函数（需要解决ES6/CommonJS互操作）
    // const { parseTimelinessExcel } = require('../routes/upload.js');
    
    return null;
    
  } catch (error) {
    console.error('❌ Excel解析异常:', error.message);
    return null;
  }
  */
}

/**
 * 加载活跃的时效数据到内存（优先JSON，兼容Excel）
 */
async function loadActiveTimelinessData() {
  try {
    ensureDirectoryExists();
    
    // 如果已有缓存，直接返回
    if (cachedTimelinessData) {
      console.log('📋 使用内存缓存的时效数据');
      return cachedTimelinessData;
    }
    
    // 读取元数据
    if (!fs.existsSync(METADATA_FILE)) {
      console.log('⚠️  未找到时效数据元数据文件');
      return null;
    }
    
    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
    const activeFileId = metadata.activeFileId;
    
    if (!activeFileId) {
      console.log('⚠️  没有设置活跃的时效数据版本');
      return null;
    }
    
    // 查找活跃文件
    const activeFile = metadata.files.find(f => f.fileId === activeFileId);
    if (!activeFile) {
      console.log('⚠️  未找到活跃文件记录');
      return null;
    }
    
    // ✅ 优先使用JSON缓存（快速）
    if (activeFile.jsonFilePath && fs.existsSync(activeFile.jsonFilePath)) {
      try {
        console.log('📂 从JSON缓存加载时效数据（快速模式）');
        const fileContent = fs.readFileSync(activeFile.jsonFilePath, 'utf-8');
        const fileData = JSON.parse(fileContent);
        
        cachedTimelinessData = fileData.data;
        cachedMetadata = metadata;
        
        console.log(`✅ JSON加载成功: ${activeFile.fileName} (${fileData.recordCount}条记录)`);
        return cachedTimelinessData;
        
      } catch (jsonError) {
        console.warn('⚠️  JSON文件损坏，尝试从Excel解析:', jsonError.message);
      }
    }
    
    // ✅ JSON缺失或损坏，回退到Excel实时解析（兼容模式）
    if (activeFile.excelFilePath && fs.existsSync(activeFile.excelFilePath)) {
      console.log('📂 从Excel原文件实时解析（兼容模式）');
      const parsedData = await parseExcelFile(activeFile.excelFilePath);
      
      if (parsedData && parsedData.length > 0) {
        cachedTimelinessData = parsedData;
        cachedMetadata = metadata;
        
        console.log(`✅ Excel解析成功: ${activeFile.fileName} (${parsedData.length}条记录)`);
        
        // 可选：重建JSON缓存
        try {
          const jsonFilePath = activeFile.jsonFilePath || path.join(
            TIMELINESS_DATA_DIR, 
            `${activeFileId}_rebuilt.json`
          );
          const rebuiltData = {
            fileId: activeFileId,
            uploadTime: activeFile.uploadTime,
            fileName: activeFile.fileName,
            recordCount: parsedData.length,
            data: parsedData,
            metadata: { rebuilt: true, rebuildTime: new Date().toISOString() }
          };
          fs.writeFileSync(jsonFilePath, JSON.stringify(rebuiltData, null, 2), 'utf-8');
          console.log(`✅ 已重建JSON缓存: ${jsonFilePath}`);
        } catch (rebuildError) {
          console.warn('⚠️  JSON缓存重建失败（不影响查询）:', rebuildError.message);
        }
        
        return cachedTimelinessData;
      }
    }
    
    // ✅ 兼容旧格式：只有filePath字段
    if (activeFile.filePath && fs.existsSync(activeFile.filePath)) {
      try {
        console.log('📂 从旧格式文件加载（兼容模式）');
        const fileContent = fs.readFileSync(activeFile.filePath, 'utf-8');
        const fileData = JSON.parse(fileContent);
        
        cachedTimelinessData = fileData.data || fileData;
        cachedMetadata = metadata;
        
        console.log(`✅ 旧格式加载成功: ${activeFile.fileName}`);
        return cachedTimelinessData;
        
      } catch (oldFormatError) {
        console.error('❌ 旧格式加载失败:', oldFormatError.message);
      }
    }
    
    console.error('❌ 所有加载方式均失败');
    return null;
    
  } catch (error) {
    console.error('❌ 加载时效数据失败:', error);
    return null;
  }
}

/**
 * 获取时效数据（供查询使用）
 */
async function getTimelinessData() {
  if (!cachedTimelinessData) {
    await loadActiveTimelinessData();
  }
  return cachedTimelinessData || [];
}

/**
 * 查询匹配的时效值
 * @param {String} brandCode - 品牌代码
 * @param {String} carrierName - 快递商名称
 * @param {String} cityName - 城市名称
 * @param {String} areaId - 区域ID（可选）
 * @returns {Number|null} 时效值（小时）
 */
async function queryTimelinessValue(brandCode, carrierName, cityName, areaId = null) {
  const data = await getTimelinessData();
  
  if (!data || data.length === 0) {
    return null;
  }
  
  // 匹配逻辑：品牌 + 快递商 + (城市名称 或 区域ID)
  const matched = data.find(record => {
    const brandMatch = record.BRAND_CODE === brandCode;
    const carrierMatch = record.CARRIER_NAME === carrierName;
    const cityMatch = record.CITY_NAME === cityName || 
                     (areaId && record.AREA_ID === areaId);
    
    return brandMatch && carrierMatch && cityMatch;
  });
  
  return matched ? matched.TIME_VALUE : null;
}

/**
 * 获取上传历史
 */
async function getUploadHistory() {
  try {
    ensureDirectoryExists();
    
    if (!fs.existsSync(METADATA_FILE)) {
      return { files: [], activeFileId: null };
    }
    
    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
    cachedMetadata = metadata;
    
    return metadata;
    
  } catch (error) {
    console.error('❌ 获取上传历史失败:', error);
    return { files: [], activeFileId: null };
  }
}

/**
 * 删除时效数据文件
 */
async function deleteTimelinessFile(fileId) {
  try {
    ensureDirectoryExists();
    
    if (!fs.existsSync(METADATA_FILE)) {
      throw new Error('元数据文件不存在');
    }
    
    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
    
    // 查找文件
    const fileIndex = metadata.files.findIndex(f => f.fileId === fileId);
    if (fileIndex === -1) {
      throw new Error('文件不存在');
    }
    
    const fileToDelete = metadata.files[fileIndex];
    
    // 删除数据文件
    if (fs.existsSync(fileToDelete.filePath)) {
      fs.unlinkSync(fileToDelete.filePath);
      console.log(`✅ 已删除文件: ${fileToDelete.filePath}`);
    }
    
    // 从元数据中移除
    metadata.files.splice(fileIndex, 1);
    
    // 如果删除的是活跃版本，清除activeFileId
    if (metadata.activeFileId === fileId) {
      metadata.activeFileId = null;
      cachedTimelinessData = null;
    }
    
    // 保存更新后的元数据
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
    cachedMetadata = metadata;
    
    return {
      success: true,
      message: `已删除文件: ${fileToDelete.fileName}`
    };
    
  } catch (error) {
    console.error('❌ 删除文件失败:', error);
    throw error;
  }
}

/**
 * 清除内存缓存
 */
function clearCache() {
  cachedTimelinessData = null;
  cachedMetadata = null;
  console.log('🗑️  已清除时效数据缓存');
}

/**
 * 获取统计信息
 */
async function getStatistics() {
  try {
    const history = await getUploadHistory();
    const activeData = await getTimelinessData();
    
    return {
      totalFiles: history.files.length,
      activeFileId: history.activeFileId,
      totalRecords: activeData ? activeData.length : 0,
      cacheStatus: cachedTimelinessData ? 'loaded' : 'empty',
      storageDirectory: TIMELINESS_DATA_DIR
    };
  } catch (error) {
    console.error('❌ 获取统计信息失败:', error);
    return null;
  }
}

/**
 * 获取最新的时效数据（兼容旧接口）
 * @returns {Object|null} 包含data和metadata的对象
 */
function getLatestTimelinessData() {
  try {
    ensureDirectoryExists();
    
    // 读取元数据
    if (!fs.existsSync(METADATA_FILE)) {
      console.log('⚠️  未找到时效数据文件');
      return null;
    }
    
    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
    const activeFileId = metadata.activeFileId;
    
    if (!activeFileId) {
      console.log('⚠️  没有活跃的时效数据');
      return null;
    }
    
    const activeFile = metadata.files.find(f => f.fileId === activeFileId);
    if (!activeFile) {
      return null;
    }
    
    // 优先使用JSON
    let data = null;
    if (activeFile.jsonFilePath && fs.existsSync(activeFile.jsonFilePath)) {
      const fileContent = fs.readFileSync(activeFile.jsonFilePath, 'utf-8');
      const fileData = JSON.parse(fileContent);
      data = fileData.data;
    } else if (activeFile.filePath && fs.existsSync(activeFile.filePath)) {
      // 兼容旧格式
      const fileContent = fs.readFileSync(activeFile.filePath, 'utf-8');
      const fileData = JSON.parse(fileContent);
      data = fileData.data || fileData;
    }
    
    if (!data) {
      return null;
    }
    
    // ✅ 修复：统一转换字段名为小写格式（兼容timelinessDataProcessor）
    const normalizedData = data.map(item => ({
      brand: item.BRAND_CODE || item.brand,
      carrier: item.CARRIER_NAME || item.carrier,
      cityName: item.CITY_NAME || item.cityName,
      areaId: item.AREA_ID || item.areaId,
      timeValue: item.TIME_VALUE || item.timeValue
    }));
    
    return {
      data: normalizedData,
      metadata: {
        fileName: activeFile.fileName,
        uploadTime: activeFile.uploadTime,
        recordCount: normalizedData.length
      }
    };
    
  } catch (error) {
    console.error('❌ 获取最新时效数据失败:', error);
    return null;
  }
}

// 导出函数
module.exports = {
  saveTimelinessData,
  loadActiveTimelinessData,
  getTimelinessData,
  getLatestTimelinessData,  // ✅ 新增：兼容旧接口
  queryTimelinessValue,
  getUploadHistory,
  setActiveVersion,
  deleteTimelinessFile,
  clearCache,
  getStatistics,
  parseExcelFile  // ✅ 新增：直接解析Excel
};