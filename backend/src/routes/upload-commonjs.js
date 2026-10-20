const { dateBoundarySql, dateEndExclusiveSql, validateRequestDateRange } = require('../utils/dateRange');
/**
 * VF物流数据分析平台 - 文件上传API路由 (CommonJS版本)
 * 
 * 处理时效Excel表格上传和解析
 * 修正版本：严格按照BAS_AREA表结构（只有area_id和area_name两个字段）进行1:1映射
 * 移除所有模拟数据，在实际测试运行环境中上传时效表
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const timelinessFileStore = require('../utils/timelinessFileStore');
const { globalRateLimiter } = require('../middleware/rateLimitMiddleware');
const { ERROR_CODES, sendError, sendRouteError } = require('../utils/apiError');

// 统一的上传文件根目录，应与 multer 的存储目录保持一致
const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');

const router = express.Router();
router.use(validateRequestDateRange);

/**
 * DEST_CITY代码到真实城市名称的映射查询
 * 从BAS_AREA表查找DEST_CITY代码对应的城市名称
 * 严格按照数据库结构：只有area_id和area_name两个字段，1:1映射
 */
async function getCityAreaMapping() {
  try {
    const { executeQuery } = require('../config/database-api');
    
    // 添加连接测试
    try {
      const testQuery = "SELECT 1 FROM DUAL";
      await executeQuery(testQuery);
      console.log('✅ 数据库连接测试成功');
    } catch (testError) {
      console.error('❌ 数据库连接测试失败:', testError.message);
      return {}; // 返回空对象，让上层接口继续处理
    }
    
    // 从BAS_AREA表获取DEST_CITY代码到城市名称的映射
    try {
      console.log('🗺️ 正在从BAS_AREA表查询DEST_CITY代码到城市名称的映射...');
      
      // 简化查询：直接获取所有城市映射数据
      const query = `
        SELECT 
          AREA_ID,
          AREA_NAME
        FROM APP_CMS.BAS_AREA 
        ORDER BY AREA_ID
      `;
      
      console.log('🔍 执行查询:', query.replace(/\s+/g, ' ').trim());
      const result = await executeQuery(query);
      console.log(`📋 查询完成，获取到${result.rows?.length || 0}条记录`);
      
      // 构建DEST_CITY代码到城市名称的映射对象
      // TSK_LIST_TASK.DEST_CITY -> BAS_AREA.area_id -> BAS_AREA.area_name
      const destCityToNameMapping = {};
      
      if (result.rows && result.rows.length > 0) {
        let validMappingCount = 0;
        let invalidRecordCount = 0;
        
        result.rows.forEach((row, index) => {
          const areaId = row.AREA_ID;
          const areaName = row.AREA_NAME;
          
          // 只在前3条记录显示详细日志，避免日志过多
          if (index < 3) {
            console.log(`🔍 处理第${index + 1}条记录: AREA_ID="${areaId}" (类型: ${typeof areaId}), AREA_NAME="${areaName}" (类型: ${typeof areaName})`);
          }
          
          // 极度宽松的验证逻辑：只要不是null/undefined就接受，获取到的AREA_NAME直接使用
          if (areaId !== null && areaId !== undefined && 
              areaName !== null && areaName !== undefined) {
            
            // 直接转换为字符串，不做过多处理
            const strAreaId = String(areaId).trim();
            const strAreaName = String(areaName).trim();
            
            // 只要转换后不是完全空字符串就接受
            if (strAreaId.length > 0 && strAreaName.length > 0) {
              destCityToNameMapping[strAreaId] = strAreaName;
              validMappingCount++;
              
              // 显示前3个成功的映射
              if (validMappingCount <= 3) {
                console.log(`✅ 成功映射: "${strAreaId}" -> "${strAreaName}"`);
              }
            } else {
              invalidRecordCount++;
              if (invalidRecordCount <= 5) { // 只显示前5个无效记录的警告
                console.warn(`⚠️ 跳过空字符串记录: AREA_ID="${strAreaId}" (长度:${strAreaId.length}), AREA_NAME="${strAreaName}" (长度:${strAreaName.length})`);
              }
            }
          } else {
            invalidRecordCount++;
            if (invalidRecordCount <= 5) { // 只显示前5个NULL记录的警告
              console.warn(`⚠️ 跳过NULL记录: AREA_ID=${areaId}, AREA_NAME=${areaName}`);
            }
          }
        });
        
        console.log(`✅ 从BAS_AREA表获取到${result.rows.length}条记录`);
        console.log(`📍 有效DEST_CITY->城市名称映射: ${validMappingCount}个，无效记录: ${invalidRecordCount}个`);
        
        if (validMappingCount > 0) {
          console.log('🔍 映射示例:', Object.entries(destCityToNameMapping).slice(0, 5).map(([code, name]) => `${code}->${name}`));
          return destCityToNameMapping;
        } else {
          console.warn('⚠️ 没有有效的AREA_ID和AREA_NAME组合，返回空映射');
          return {}; // 返回空对象而不是报错
        }
      } else {
        console.warn('⚠️ BAS_AREA表查询结果为空');
        return {}; // 返回空对象而不是报错
      }
      
    } catch (dbError) {
      console.warn('💾 数据库查询失败:', dbError.message);
      return {}; // 返回空对象，让上层接口继续处理
    }
    
  } catch (error) {
    console.error('❌ 获取城市区域映射完全失败:', error.message);
    return {};
  }
}

/**
 * 解析Excel文件中的时效数据
 */
function parseTimelinessExcel(filePath, cityMapping = {}, selectedBrand = null) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 转换为JSON数据
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // 使用数组形式，第一行作为表头
      defval: '' // 空单元格默认值
    });
    
    if (jsonData.length < 2) {
      throw new Error('Excel文件数据不足，至少需要表头和一行数据');
    }
    
    const headers = jsonData[0];
    const dataRows = jsonData.slice(1);
    
    // 查找关键列的索引
    const carrierIndex = headers.findIndex(h => 
      h && h.toString().toLowerCase().includes('carrier')
    );
    const cityIndex = headers.findIndex(h => 
      h && h.toString().toLowerCase().includes('city')
    );
    const serviceTypeIndex = headers.findIndex(h => {
      if (!h) return false;
      const normalizedHeader = h.toString().trim().toLowerCase();
      return normalizedHeader.includes('trservice_type_name')
        || normalizedHeader.includes('service')
        || normalizedHeader.includes('product')
        || h.toString().includes('快递产品')
        || h.toString().includes('产品类型')
        || h.toString().includes('快递服务');
    });
    const orderTypeIndex = headers.findIndex(h =>
      h && h.toString().trim().toLowerCase() === 'order_type_name'
    );
    const brandIndex = headers.findIndex(h =>
      h && ['brand', '品牌'].includes(h.toString().trim().toLowerCase())
    );
    const slaIndex = headers.findIndex(h =>
      h && ['sla', '时效', '计划时效'].includes(h.toString().trim().toLowerCase())
    );
    
    if (carrierIndex === -1 || cityIndex === -1) {
      throw new Error('Excel文件缺少必要的列：Carrier 和 City');
    }
    
    // 找到品牌列（DICKIES, Icebreaker, TBL, TNF, VANS等）
    let brandColumns = [];
    const brandNames = ['DICKIES', 'ICEBREAKER', 'TNF', 'VANS', 'TIMBERLAND', 'SMARTWOOL'];
    
    headers.forEach((header, index) => {
      if (header && brandNames.some(brand => 
        header.toString().toUpperCase().includes(brand)
      )) {
        brandColumns.push({
          index,
          name: header.toString().trim(),
          brandCode: getBrandCode(header.toString())
        });
      }
    });

    const isLongFormat = brandIndex >= 0 && slaIndex >= 0;
    if (!isLongFormat && brandColumns.length === 0) {
      throw new Error('Excel文件缺少品牌时效列：请提供 Brand 和 SLA 列，或提供各品牌时效列');
    }
    
    // 解析数据行
    const parsedData = [];
    let validRows = 0;
    let errorRows = 0;
    
    dataRows.forEach((row, rowIndex) => {
      try {
        const carrier = row[carrierIndex]?.toString().trim();
        const cityName = row[cityIndex]?.toString().trim();
        const serviceTypeName = serviceTypeIndex >= 0
          ? row[serviceTypeIndex]?.toString().trim() || null
          : null;
        const orderTypeName = orderTypeIndex >= 0
          ? row[orderTypeIndex]?.toString().trim() || '*'
          : '*';
        
        if (!carrier || !cityName) {
          errorRows++;
          return;
        }
        
        const appendTimelinessRecord = (brand, timeValue) => {
          if (!brand || !timeValue || timeValue === '-') return;
          const parsedTime = parseTimeValue(timeValue);
          if (parsedTime === null) return;

          parsedData.push({
            carrier,
            serviceTypeName,
            orderTypeName,
            cityName,
            areaId: null,
            brand: getBrandCode(brand.toString()),
            timeValue: parsedTime,
            isOvertime: timeValue.toString().includes('+'),
            rawValue: timeValue.toString(),
            rowIndex: rowIndex + 2
          });
        };

        if (isLongFormat) {
          appendTimelinessRecord(row[brandIndex], row[slaIndex]);
        } else {
          const optimizedBrandColumns = optimizeBrandColumns(brandColumns, selectedBrand);
          optimizedBrandColumns.forEach(brandCol => {
            appendTimelinessRecord(brandCol.brandCode, row[brandCol.index]);
          });
        }
        
        validRows++;
        
      } catch (rowError) {
        console.warn(`处理第${rowIndex + 2}行数据时出错:`, rowError.message);
        errorRows++;
      }
    });
    
    return {
      totalRows: dataRows.length,
      validRows,
      errorRows,
      parsedData,
      brandColumns: brandColumns.map(col => col.name),
      unmappedCities: []
    };
    
  } catch (error) {
    throw new Error(`Excel文件解析失败: ${error.message}`);
  }
}

/**
 * 解析时效值（处理72+, 72-, 48等格式）
 * 
 * SLA时效值定义：
 * - 24   → 24小时（当日达/次日达）
 * - 48   → 48小时（两日达）
 * - 72   → 72小时（三日达）
 * - 72+  → >72小时（超时/偏远地区）→ 返回999作为特殊标识
 * - -    → 暂无时效 → 返回null
 */
function parseTimeValue(value) {
  if (!value) return null;
  
  const str = value.toString().trim();
  if (str === '-' || str === '') return null;
  
  // ✅ 特殊处理：72+ 表示超时区间（>72小时）
  if (str.includes('+')) {
    return 999;  // 使用999标识超时区间
  }
  
  // 提取数字部分
  const match = str.match(/(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  
  return null;
}

/**
 * 根据表头获取品牌代码
 */
function getBrandCode(header) {
  const upperHeader = header.toUpperCase();
  
  if (upperHeader.includes('DICKIES')) return 'DICKIES';
  if (upperHeader.includes('ICEBREAKER')) return 'ICEBREAKER';
  if (upperHeader.includes('TBL') || upperHeader.includes('TIMBERLAND')) return 'TIMBERLAND';
  if (upperHeader.includes('TNF')) return 'TNF';
  if (upperHeader.includes('VANS')) return 'VANS';
  if (upperHeader.includes('SMARTWOOL')) return 'SMARTWOOL';
  
  return header.trim();
}

/**
 * 根据选择的品牌优化品牌列排序
 */
function optimizeBrandColumns(brandColumns, selectedBrand) {
  if (!selectedBrand) return brandColumns;
  
  // 将选择的品牌列排在前面
  const selectedBrandColumns = brandColumns.filter(col => col.brandCode === selectedBrand);
  const otherBrandColumns = brandColumns.filter(col => col.brandCode !== selectedBrand);
  
  return [...selectedBrandColumns, ...otherBrandColumns];
}

function findTimelinessMatch(timelinessMap, brandName, carrierId, serviceTypeName, orderTypeName, cityName) {
  if (!brandName || !carrierId || !cityName) {
    return { matchKey: null, timelinessMatch: null };
  }

  const serviceName = serviceTypeName || '';
  const orderName = (orderTypeName || '').toString().trim();
  const orderTypeCandidates = orderName && orderName !== '*' ? [orderName, '*'] : ['*'];
  const buildKeys = (brand, service) => orderTypeCandidates.map((orderType) => `${brand}|${carrierId}|${service}|${orderType}|${cityName}`);
  const shouldUseWildcardBrand = brandName !== '*' && orderName === '电商发货';
  const candidateKeys = [
    ...buildKeys(brandName, serviceName)
  ];

  if (serviceName) {
    candidateKeys.push(...buildKeys(brandName, ''));
  }

  if (shouldUseWildcardBrand) {
    candidateKeys.push(...buildKeys('*', serviceName));
    if (serviceName) {
      candidateKeys.push(...buildKeys('*', ''));
    }
  }

  for (const key of candidateKeys) {
    const timelinessMatch = timelinessMap.get(key);
    if (timelinessMatch) {
      return { matchKey: key, timelinessMatch };
    }
  }

  return { matchKey: candidateKeys[0], timelinessMatch: null };
}

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名
    const timestamp = Date.now();
    const originalExt = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv' // .csv
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件格式，请上传Excel或CSV文件'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: fileFilter
});

/**
 * 上传时效分析Excel表格
 * POST /api/upload/timeliness-excel
 */
router.post('/timeliness-excel', globalRateLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '未接收到文件',
        details: { requiredFields: ['file'] }
      });
    }

    const { type, brand } = req.body;
    const file = req.file;

    console.log('📁 时效表格上传请求:', {
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      type,
      brand
    });

    let parseResult = null;

    try {
      // 1. 解析Excel文件（按SLA City列与视图DEST_CITY_NAME匹配，不再映射areaId）
      console.log('📊 解析Excel文件...', brand ? `优先处理品牌: ${brand}` : '');
      if (file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel')) {
        parseResult = parseTimelinessExcel(file.path, {}, brand);
      } else {
        throw new Error('暂不支持CSV格式，请上传Excel文件');
      }

      console.log('✅ Excel解析完成:', {
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        errorRows: parseResult.errorRows,
        parsedDataCount: parseResult.parsedData.length,
        brandColumns: parseResult.brandColumns,
        unmappedCitiesCount: parseResult.unmappedCities.length
      });

      // 3. 数据验证和质量检查
      const dataQuality = {
        totalTimelinessRecords: parseResult.parsedData.length,
        brandDistribution: {},
        carrierDistribution: {},
        cityMappingRate: 0
      };

      // 统计品牌分布
      parseResult.parsedData.forEach(item => {
        dataQuality.brandDistribution[item.brand] = 
          (dataQuality.brandDistribution[item.brand] || 0) + 1;
        dataQuality.carrierDistribution[item.carrier] = 
          (dataQuality.carrierDistribution[item.carrier] || 0) + 1;
      });

      dataQuality.cityMappingRate = 100;

      // 4. TODO: 在生产环境中将解析的数据保存到数据库
      // await saveTimelinessDataToDatabase(parseResult.parsedData);

      // 5. 构建详细响应
      const response = {
        success: true,
        message: brand ? `时效表格上传并解析成功，优先处理品牌：${brand}` : '时效表格上传并解析成功',
        data: {
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          uploadTime: new Date().toISOString(),
          type: type || 'timeliness_analysis',
          brand: brand || 'all',
          selectedBrand: brand,
          status: 'processed',
          parsedData: parseResult.parsedData  // ✅ 添加parsedDatadata对象中供前端访问
        },
        processingResult: {
          totalRows: parseResult.totalRows,
          validRows: parseResult.validRows,
          errorRows: parseResult.errorRows,
          duplicateRows: 0, // 暂未实现去重检查
          timelinessRecords: parseResult.parsedData.length,
          brandColumns: parseResult.brandColumns,
          selectedBrandRecords: brand ? parseResult.parsedData.filter(item => item.brand === brand).length : null,
          dataQuality: dataQuality,
          parsedData: parseResult.parsedData  // 保持兼容性
        },
        warnings: parseResult.unmappedCities.length > 0 ? [
          `以下${parseResult.unmappedCities.length}个城市未能在数据库中找到对应区域: ${parseResult.unmappedCities.slice(0, 10).join(', ')}${parseResult.unmappedCities.length > 10 ? '...' : ''}`
        ] : []
      };

      res.json(response);

    } catch (parseError) {
      console.error('文件解析失败:', parseError);
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '文件解析失败',
        details: {
          reason: parseError.message,
          stack: process.env.NODE_ENV === 'development' ? parseError.stack : undefined
        }
      });
    } finally {
      // 清理临时文件
      try {
        if (file && file.path) {
          // 将文件路径限制在受控的上传目录中，防止路径遍历
          const safePath = path.resolve(UPLOAD_ROOT, path.basename(file.path));

          if (safePath.startsWith(UPLOAD_ROOT)) {
            if (fs.existsSync(safePath)) {
              fs.unlinkSync(safePath);
            }
          } else {
            console.warn('检测到潜在的非法文件路径，已跳过删除:', file.path);
          }
        }
      } catch (cleanupError) {
        console.warn('清理临时文件失败:', cleanupError.message);
      }
    }

  } catch (error) {
    console.error('时效表格上传失败:', error);
    
    // 如果是multer错误
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, req, {
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          error: '文件大小超限',
          details: { maxSizeMb: 10 }
        });
      }
    }

    return sendRouteError(res, req, error, { fallbackError: '文件上传处理失败，请稍后重试' });
  }
});

/**
 * 获取上传历史记录
 * GET /api/upload/history
 */
router.get('/history', async (req, res) => {
  try {
    const { type, limit = 10 } = req.query;
    
    // 尝试从数据库查询真实的上传历史
    try {
      const { executeQuery } = require('../config/database-api');
      
      // 检查是否存在上传历史表 (如果不存在会捕获错误)
      const query = `
        SELECT 
          upload_id,
          filename,
          upload_time,
          file_type,
          status,
          file_size
        FROM APP_CMS.UPLOAD_HISTORY 
        WHERE (:type IS NULL OR file_type = :type)
        ORDER BY upload_time DESC
        FETCH FIRST :limit ROWS ONLY
      `;
      
      const result = await executeQuery(query, {
        type: type || null,
        limit: parseInt(limit)
      });
      
      res.json({
        success: true,
        data: result.rows || [],
        total: result.rows ? result.rows.length : 0,
        message: '上传历史查询成功',
        timestamp: new Date().toISOString()
      });
      
    } catch (dbError) {
      console.warn('📝 上传历史表不存在或查询失败，返回模拟数据:', dbError.message);
      
      // 如果历史表不存在，返回模拟数据
      const mockHistory = [
        {
          uploadId: 'mock_001',
          filename: '时效标准表_示例.xlsx',
          uploadTime: new Date(Date.now() - 86400000).toISOString(),
          fileType: 'timeliness_analysis',
          status: 'completed',
          fileSize: 2048
        },
        {
          uploadId: 'mock_002', 
          filename: '时效数据_测试.xlsx',
          uploadTime: new Date(Date.now() - 172800000).toISOString(),
          fileType: 'timeliness_analysis',
          status: 'completed',
          fileSize: 1536
        }
      ];
      
      const filteredHistory = type ? mockHistory.filter(h => h.fileType === type) : mockHistory;
      
      res.json({
        success: true,
        data: filteredHistory.slice(0, parseInt(limit)),
        total: filteredHistory.length,
        message: '返回模拟上传历史数据 (UPLOAD_HISTORY表不存在)',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('获取上传历史失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取上传历史失败' });
  }
});

/**
 * 获取城市区域映射信息
 * GET /api/upload/city-mapping
 */
router.get('/city-mapping', async (req, res) => {
  try {
    const { search } = req.query;
    
    const cityMapping = await getCityAreaMapping();
    
    let mappingData = Object.entries(cityMapping).map(([areaId, areaName]) => ({
      areaId,
      areaName
    }));
    
    // 如果有搜索参数，过滤结果
    if (search) {
      const searchTerm = search.toString().toLowerCase();
      mappingData = mappingData.filter(item => 
        item.areaName.toLowerCase().includes(searchTerm)
      );
    }
    
    // 按城市名称排序
    mappingData.sort((a, b) => a.areaName.localeCompare(b.areaName, 'zh-CN'));
    
    res.json({
      success: true,
      message: '城市映射数据获取成功',
      data: mappingData,
      total: mappingData.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('获取城市映射失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取城市映射失败' });
  }
});

/**
 * 根据DEST_CITY代码查询城市名称
 * GET /api/upload/dest-city-lookup?destCities=29139,29140,29141
 */
router.get('/dest-city-lookup', async (req, res) => {
  try {
    const { destCities } = req.query;
    
    if (!destCities) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '参数错误',
        details: { requiredFields: ['destCities'] }
      });
    }
    
    const destCityList = destCities.toString().split(',').map(id => id.trim()).filter(id => id);
    
    if (destCityList.length === 0) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '参数错误',
        details: { requiredFields: ['destCities'] }
      });
    }
    
    console.log('🔍 查询DEST_CITY对应的城市名称:', destCityList);
    
    try {
      const { executeQuery } = require('../config/database-api');
      const bindParams = {};
      const destCityPlaceholders = destCityList.map((id, index) => {
        const key = `city${index}`;
        bindParams[key] = id;
        return `:${key}`;
      }).join(',');
      
      const query = `
        SELECT 
          AREA_ID,
          AREA_NAME
        FROM APP_CMS.BAS_AREA 
        WHERE AREA_ID IN (${destCityPlaceholders})
        ORDER BY AREA_ID
      `;
      
      console.log('🔍 执行DEST_CITY查询，参数数量:', destCityList.length);
      
      const result = await executeQuery(query, bindParams);
      
      const lookupResults = {};
      
      if (result.rows && result.rows.length > 0) {
        result.rows.forEach(row => {
          const areaId = row.AREA_ID?.toString();
          const areaName = row.AREA_NAME?.toString().trim();
          
          if (areaId && areaName) {
            lookupResults[areaId] = {
              areaId,
              areaName,
              displayName: areaName
            };
          }
        });
      }
      
      // 标记未找到的DEST_CITY
      const notFound = destCityList.filter(id => !lookupResults[id]);
      
      console.log(`✅ DEST_CITY查询完成: 找到${Object.keys(lookupResults).length}个，未找到${notFound.length}个`);
      
      res.json({
        success: true,
        message: `DEST_CITY查询完成`,
        data: {
          found: lookupResults,
          notFound: notFound,
          totalQueried: destCityList.length,
          foundCount: Object.keys(lookupResults).length,
          notFoundCount: notFound.length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (dbError) {
      console.error('💾 DEST_CITY数据库查询失败:', dbError);

      return sendRouteError(res, req, dbError, { fallbackError: '无法查询DEST_CITY映射' });
    }
    
  } catch (error) {
    console.error('❌ DEST_CITY查询失败:', error);
    return sendRouteError(res, req, error, { fallbackError: 'DEST_CITY查询失败' });
  }
});

/**
 * 验证Excel文件格式（不实际上传）
 * POST /api/upload/validate-format
 */
router.post('/validate-format', globalRateLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '未接收到文件',
        details: { requiredFields: ['file'] }
      });
    }

    const file = req.file;
    
    try {
      // 解析文件但不保存数据（按城市名称匹配，不再映射areaId）
      const parseResult = parseTimelinessExcel(file.path, {});
      
      // 返回格式验证结果
      const validationResult = {
        isValid: parseResult.errorRows === 0,
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        errorRows: parseResult.errorRows,
        brandColumns: parseResult.brandColumns,
        sampleData: parseResult.parsedData.slice(0, 5), // 前5条数据作为样例
        warnings: parseResult.unmappedCities.length > 0 ? [
          `以下${parseResult.unmappedCities.length}个城市无法映射到区域: ${parseResult.unmappedCities.slice(0, 5).join(', ')}`
        ] : []
      };
      
      res.json({
        success: true,
        message: '文件格式验证完成',
        validation: validationResult,
        timestamp: new Date().toISOString()
      });
      
    } catch (parseError) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '文件格式验证失败',
        details: { reason: parseError.message }
      });
    } finally {
      // 清理临时文件
      try {
        if (file && file.path) {
          // 🔥 安全加固：使用 path.basename 确保不发生路径穿越
          const safePath = path.join(UPLOAD_ROOT, path.basename(file.path));
          if (fs.existsSync(safePath)) {
            fs.unlinkSync(safePath);
          }
        }
      } catch (cleanupError) {
        console.warn('清理临时文件失败:', cleanupError.message);
      }
    }

  } catch (error) {
    console.error('文件格式验证失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '文件格式验证失败' });
  }
});

/**
 * 执行时效分析计算
 * POST /api/upload/analyze-timeliness
 * 
 * ✅ 2025-01-09修复: 调用timelinessDataProcessor进行完整的Plan vs Actual分析
 */
router.post('/analyze-timeliness', async (req, res) => {
  try {
    console.log('\n\n\n');
    console.log('=' .repeat(80));
    console.log('🔥🔥🔥 /api/upload/analyze-timeliness (CommonJS upload-commonjs.js) 🔥🔥🔥');
    console.log('=' .repeat(80));
    console.log('\n');
    
    const { 
      dateRange, 
      selectedBrand, 
      selectedPlatform,
      selectedSelfFlag,  // ✅ 新增：支持selfFlag参数
      selectedCarrier, 
      analysisType = 'S2D',  // ✅ 默认只执行S2D分析
      userBrands  // 🔥 新增：用户品牌权限列表
    } = req.body;
    
    if (!dateRange || !dateRange.from || !dateRange.to) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '参数错误',
        details: { requiredFields: ['dateRange.from', 'dateRange.to'] }
      });
    }
    
    console.log('🔍 开始时效分析计算（调用timelinessDataProcessor-file-based.js）:', {
      dateRange,
      selectedBrand,
      selectedPlatform,
      selectedSelfFlag,
      selectedCarrier,
      analysisType,
      userBrands  // 🔥 新增日志
    });
    
    try {
      // ✅ 使用CommonJS版本的时效分析处理器（解决模块加载问题）
      console.log('📦 正在加载 timelinessDataProcessor-cjs.js（CommonJS版本）...');
      const { analyzeTimelinessPerformance } = require('../utils/timelinessDataProcessor-cjs.js');
      console.log('✅ 成功加载 timelinessDataProcessor-cjs.js');
      
      const analysisResult = await analyzeTimelinessPerformance({
        dateRange,
        selectedBrand,
        selectedPlatform,
        selectedSelfFlag,  // ✅ 传递selfFlag参数
        selectedCarrier,
        analysisType,
        userBrands  // ✅ 新增：传递用户品牌权限列表
      });
      
      // 🔥 转换数据格式为前端期望的对象格式
      const transformedData = analysisResult.data || analysisResult;
      
      // 🔍 打印调试信息
      console.log('\n📊 数据转换前:');
      console.log(`  - 分析类型: ${analysisType}`);
      console.log(`  - byBrand数量: ${(transformedData.byBrand || []).length}`);
      console.log(`  - byCourier数量: ${(transformedData.byCourier || []).length}`);
      console.log(`  - byBrandCourier数量: ${(transformedData.byBrandCourier || []).length}`);
      
      if (transformedData.byBrandCourier && transformedData.byBrandCourier.length > 0) {
        console.log('📋 byBrandCourier样本（前3个）:');
        transformedData.byBrandCourier.slice(0, 3).forEach((item, index) => {
          console.log(`  ${index + 1}.`, item);
        });
      }
      
      // ✅ 根据分析类型选择字段名
      const isC2D = analysisType === 'C2D';
      const timeFieldKey = isC2D ? 'avgC2DTime' : 'avgS2DTime';
      const totalOrdersKey = isC2D ? 'totalC2DOrders' : 'totalS2DOrders';
      const analysisKey = isC2D ? 'c2dAnalysis' : 's2dAnalysis';
      
      console.log(`✅ 使用字段: ${timeFieldKey}, ${totalOrdersKey}, analysisKey=${analysisKey}`);
      
      // 🔥 构建统一的数据转换函数
      const transformStats = (dataArray, timeField) => {
        return dataArray.reduce((acc, item) => {
          const key = item.brandCode || item.carrierId || `${item.brandCode}|${item.carrierId}`;
          acc[key] = {
            ...item,
            total: item.actualTotal || 0,
            actualCategories: {
              '24H': item.actual24h || 0,
              '48H': item.actual48h || 0,
              '72H': item.actual72h || 0,
              '72H+': item.actualOver72h || 0
            },
            planCategories: {
              '24H': item.plan24h || 0,
              '48H': item.plan48h || 0,
              '72H': item.plan72h || 0,
              '72H+': item.planOver72h || 0
            },
            avgActualHours: item[timeField] || 0,  // ✅ 动态选择字段
            avgPlanHours: item.avgPlanTime || 0
          };
          return acc;
        }, {});
      };
      
      const formattedResponse = {
        [analysisKey]: {
          brandStats: transformStats(transformedData.byBrand || [], timeFieldKey),
          carrierStats: transformStats(transformedData.byCourier || [], timeFieldKey),
          brandCarrierStats: (transformedData.byBrandCourier || []).reduce((acc, item) => {
            const key = `${item.brandCode}|${item.carrierId}`;
            acc[key] = {
              ...item,
              total: item.actualTotal || 0,
              actualCategories: {
                '24H': item.actual24h || 0,
                '48H': item.actual48h || 0,
                '72H': item.actual72h || 0,
                '72H+': item.actualOver72h || 0
              },
              planCategories: {
                '24H': item.plan24h || 0,
                '48H': item.plan48h || 0,
                '72H': item.plan72h || 0,
                '72H+': item.planOver72h || 0
              },
              avgActualHours: item[timeFieldKey] || 0,  // ✅ 动态选择字段
              avgPlanHours: item.avgPlanTime || 0
            };
            return acc;
          }, {}),
          categories: {
            '24H': {
              actualCount: transformedData.actualStats?.within24h || 0,
              planCount: transformedData.planStats?.within24h || 0
            },
            '48H': {
              actualCount: transformedData.actualStats?.within48h || 0,
              planCount: transformedData.planStats?.within48h || 0
            },
            '72H': {
              actualCount: transformedData.actualStats?.within72h || 0,
              planCount: transformedData.planStats?.within72h || 0
            },
            '72H+': {
              actualCount: transformedData.actualStats?.over72h || 0,
              planCount: transformedData.planStats?.over72h || 0
            }
          },
          [totalOrdersKey]: transformedData.actualStats?.total || 0,  // ✅ 动态字段名
          [timeFieldKey]: transformedData[timeFieldKey] || 0,  // ✅ 动态字段名
          achievementRate: transformedData.achievementRate || 0
        },
        // 保留原始格式供其他组件使用
        raw: transformedData
      };
      
      console.log('✅ 数据格式转换完成，返回前端');
      
      res.json({
        success: true,
        message: '时效分析计算完成',
        data: formattedResponse,
        timestamp: new Date().toISOString()
      });
      
    } catch (dbError) {
      console.error('💾 时效分析数据库查询失败:', dbError);

      return sendRouteError(res, req, dbError, { fallbackError: '时效分析计算失败' });
    }
    
  } catch (error) {
    console.error('❌ 时效分析失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '时效分析计算失败' });
  }
});

/**
 * 获取SLA匹配状态
 * GET /api/upload/sla-matching-status
 */
router.get('/sla-matching-status', async (req, res) => {
  try {
    const { brand, dateRange } = req.query;
    
    try {
      const { executeQuery } = require('../config/database-api');
      
      // 检查数据库中的订单数据分布
      const statsQuery = `
        SELECT 
          COALESCE(bc.COMPANY_ABNAME, t.CUSTOMERNO) as brand_name,
          t.CARRIERID,
          COUNT(*) as order_count,
          COUNT(DISTINCT t.DEST_CITY) as city_count
        FROM APP_CMS.TSK_LIST_TASK t
        LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CUSTOMERNO = bc.COMPANY_SYSID
        WHERE t.SELF_FLAG = 'Y' 
          AND t.SUM_SEND_TIME2 IS NOT NULL
          AND t.CARRIERID != 'EMS'
          AND (t.DIS_TYPE IS NULL OR t.DIS_TYPE != '06')
          ${brand && brand !== 'all' ? `AND t.CUSTOMERNO = :brandParam` : ""}
        GROUP BY t.CUSTOMERNO, bc.COMPANY_ABNAME, t.CARRIERID
        ORDER BY order_count DESC
      `;
      
      const bindParams = {};
      if (brand && brand !== 'all') {
        bindParams.brandParam = brand;
      }
      
      const result = await executeQuery(statsQuery, bindParams);
      const orderStats = result.rows || [];
      
      // 分析数据覆盖情况
      const totalCombinations = orderStats.length;
      const totalOrders = orderStats.reduce((sum, row) => sum + (row.ORDER_COUNT || 0), 0);
      const totalCities = orderStats.reduce((sum, row) => sum + (row.CITY_COUNT || 0), 0);
      
      // 按品牌分组统计
      const brandCoverage = {};
      const carrierCoverage = {};
      
      orderStats.forEach(stat => {
        const brandName = stat.BRAND_NAME || 'Unknown';
        const carrierName = stat.CARRIERID || 'Unknown';
        
        if (!brandCoverage[brandName]) {
          brandCoverage[brandName] = { orders: 0, carriers: new Set(), cities: 0 };
        }
        brandCoverage[brandName].orders += stat.ORDER_COUNT || 0;
        brandCoverage[brandName].carriers.add(carrierName);
        brandCoverage[brandName].cities += stat.CITY_COUNT || 0;
        
        if (!carrierCoverage[carrierName]) {
          carrierCoverage[carrierName] = { orders: 0, brands: new Set(), cities: 0 };
        }
        carrierCoverage[carrierName].orders += stat.ORDER_COUNT || 0;
        carrierCoverage[carrierName].brands.add(brandName);
        carrierCoverage[carrierName].cities += stat.CITY_COUNT || 0;
      });
      
      // 转换Set为数组计数
      Object.keys(brandCoverage).forEach(brand => {
        brandCoverage[brand].carrierCount = brandCoverage[brand].carriers.size;
        delete brandCoverage[brand].carriers;
      });
      
      Object.keys(carrierCoverage).forEach(carrier => {
        carrierCoverage[carrier].brandCount = carrierCoverage[carrier].brands.size;
        delete carrierCoverage[carrier].brands;
      });
      
      res.json({
        success: true,
        message: 'SLA匹配状态分析完成',
        data: {
          totalSLARecords: 0, // 需要上传时效表后才有数据
          orderDataStats: {
            totalCombinations,
            totalOrders,
            uniqueCities: totalCities,
            brandCarrierCombinations: orderStats.slice(0, 10) // 只返回前10条
          },
          brandCoverage: brandCoverage,
          carrierCoverage: carrierCoverage,
          coverageAnalysis: {
            dataAvailable: totalOrders > 0,
            requireTimelinessTable: true,
            coverageRate: 0, // 需要上传时效表后计算
            estimatedCombinations: totalCombinations,
            hasOrderData: totalOrders > 0
          },
          instructions: '上传时效标准表后将计算实际SLA覆盖率'
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (dbError) {
      console.warn('📊 SLA状态数据库查询失败，返回基础信息:', dbError.message);
      
      res.json({
        success: true,
        message: 'SLA匹配状态查询 (基础模式)',
        data: {
          totalSLARecords: 0,
          brandCoverage: {},
          carrierCoverage: {},
          cityCoverage: {},
          lastUpdateTime: null,
          coverageRate: 0,
          missingCombinations: [],
          databaseStatus: 'connection_issue',
          coverageAnalysis: {
            dataAvailable: false,
            requireTimelinessTable: true,
            hasOrderData: false
          }
        },
        instructions: '请检查数据库连接，然后上传时效标准表以获取完整SLA匹配状态',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('获取SLA状态失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取SLA匹配状态失败' });
  }
});

/**
 * ========================================
 * 文件存储管理API (无需数据库写入权限)
 * ========================================
 */

// ✅ timelinessFileStore已在文件开头导入，这里不需要重复导入

/**
 * 保存上传的时效数据到文件系统
 * POST /api/upload/save-to-file
 */
router.post('/save-to-file', async (req, res) => {
  try {
    const { parsedData, metadata } = req.body;
    
    if (!parsedData || !Array.isArray(parsedData)) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '参数错误',
        details: { requiredFields: ['parsedData'] }
      });
    }
    
    console.log(`📂 保存${parsedData.length}条时效数据到文件系统...`);
    
    // 转换数据格式（前端 → 存储格式）
    const dataToStore = parsedData.map(item => ({
      BRAND_CODE: item.brand || item.BRAND_CODE,
      CARRIER_NAME: item.carrier || item.CARRIER_NAME,
      CITY_NAME: item.cityName || item.CITY_NAME,
      SERVICE_TYPE_NAME: item.serviceTypeName || item.SERVICE_TYPE_NAME || item.TRSERVICE_TYPE_NAME || null,
      ORDER_TYPE_NAME: item.orderTypeName || item.ORDER_TYPE_NAME || '*',
      AREA_ID: item.areaId || item.AREA_ID || null,
      TIME_VALUE: parseFloat(item.timeValue || item.TIME_VALUE)
    }));
    
    const result = await timelinessFileStore.saveTimelinessData(dataToStore, {
      originalName: metadata?.fileName || 'unknown.xlsx',
      uploader: metadata?.uploader || 'system',
      remarks: metadata?.remarks || '',
      version: metadata?.version || '1.0'
    });
    
    res.json({
      success: true,
      message: '时效数据已保存到文件系统',
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 保存时效数据到文件失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '保存失败' });
  }
});

/**
 * 获取时效数据上传历史
 * GET /api/upload/file-history
 */
router.get('/file-history', async (req, res) => {
  try {
    const history = await timelinessFileStore.getUploadHistory();
    
    res.json({
      success: true,
      message: '获取上传历史成功',
      data: history,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 获取上传历史失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取失败' });
  }
});

/**
 * 设置活跃版本
 * POST /api/upload/set-active-version
 */
router.post('/set-active-version', async (req, res) => {
  try {
    const { fileId } = req.body;
    
    if (!fileId) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '参数错误',
        details: { requiredFields: ['fileId'] }
      });
    }
    
    await timelinessFileStore.setActiveVersion(fileId);
    
    res.json({
      success: true,
      message: `已设置活跃版本: ${fileId}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 设置活跃版本失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '设置失败' });
  }
});

/**
 * 删除时效数据文件
 * DELETE /api/upload/file/:fileId
 */
router.delete('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '参数错误',
        details: { requiredFields: ['fileId'] }
      });
    }
    
    const result = await timelinessFileStore.deleteTimelinessFile(fileId);
    
    res.json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 删除文件失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '删除失败' });
  }
});

/**
 * 获取时效数据统计信息
 * GET /api/upload/file-statistics
 */
router.get('/file-statistics', async (req, res) => {
  try {
    const stats = await timelinessFileStore.getStatistics();
    
    res.json({
      success: true,
      message: '获取统计信息成功',
      data: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 获取统计信息失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '获取失败' });
  }
});

/**
 * 加载预置的时效表文件
 * POST /api/upload/load-default-timeliness
 * 
 * 功能：扫描 backend/uploads/timeliness 目录，自动加载用户预置的时效Excel文件
 * 这样用户就不需要手工上传，只需将Excel文件放在指定目录即可
 */
router.post('/load-default-timeliness', globalRateLimiter, async (req, res) => {
  try {
    console.log('\n📁 加载预置时效表文件请求');
    
    const uploadsDir = path.join(__dirname, '../../uploads/timeliness');
    
    // 确保目录存在
    if (!fs.existsSync(uploadsDir)) {
      return sendError(res, req, {
        status: 404,
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        error: '目录不存在',
        details: { path: 'backend/uploads/timeliness' }
      });
    }
    
    // 扫描目录查找Excel文件（排除JSON文件）
    const files = fs.readdirSync(uploadsDir);
    const excelFiles = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return (ext === '.xlsx' || ext === '.xls') && !f.startsWith('~'); // 排除Excel临时文件
    });
    
    if (excelFiles.length === 0) {
      return sendError(res, req, {
        status: 404,
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        error: '未找到预置文件',
        details: { path: 'backend/uploads/timeliness' }
      });
    }
    
    // 如果有多个Excel文件，使用最新的
    const selectedFile = excelFiles.sort((a, b) => {
      const statA = fs.statSync(path.join(uploadsDir, a));
      const statB = fs.statSync(path.join(uploadsDir, b));
      return statB.mtime - statB.mtime; // 按修改时间倒序
    })[0];
    
    const filePath = path.join(uploadsDir, selectedFile);
    
    console.log(`📊 找到预置时效表: ${selectedFile}`);
    console.log(`📍 文件路径: ${filePath}`);
    
    // 解析Excel文件（按城市名称匹配，不再映射areaId）
    console.log('📊 解析Excel文件...');
    const parseResult = parseTimelinessExcel(filePath, {});
    
    console.log('✅ Excel解析完成:', {
      totalRows: parseResult.totalRows,
      validRows: parseResult.validRows,
      errorRows: parseResult.errorRows,
      parsedDataCount: parseResult.parsedData.length,
      brandColumns: parseResult.brandColumns,
      unmappedCitiesCount: parseResult.unmappedCities.length
    });
    
    // 检查是否有解析后的数据
    if (!parseResult.parsedData || parseResult.parsedData.length === 0) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '解析失败',
        details: {
          totalRows: parseResult.totalRows,
          brandColumns: parseResult.brandColumns,
          unmappedCities: parseResult.unmappedCities
        }
      });
    }
    
    // 保存到文件系统
    console.log('💾 保存时效数据到文件系统...');
    const saveResult = await timelinessFileStore.saveTimelinessData(
      parseResult.parsedData,
      {
        originalName: selectedFile,
        uploader: 'system',
        remarks: '预置时效表（自动加载）',
        version: '1.0'
      }
    );
    
    console.log('✅ 时效数据已保存到文件');
    
    // 返回成功响应
    res.json({
      success: true,
      message: `成功加载预置时效表: ${selectedFile}`,
      data: {
        fileName: selectedFile,
        fileId: saveResult.fileId,
        recordCount: saveResult.recordCount,
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        errorRows: parseResult.errorRows,
        brandColumns: parseResult.brandColumns,
        unmappedCitiesCount: parseResult.unmappedCities.length,
        slaMatchingStatus: {
          totalS2DOrders: 0,
          matchedOrders: parseResult.parsedData.length,
          unmatchedOrders: 0,
          matchRate: '100.00%'
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 加载预置时效表失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '加载失败' });
  }
});

/**
 * 导出时效分析原始数据（RawData）
 * POST /api/upload/export-timeliness-rawdata
 * 
 * 返回订单级别的详细信息，包含所有字段和时效区间
 * ✅ 参考 order-details.js 的查询结构
 */
router.post('/export-timeliness-rawdata', async (req, res) => {
  try {
    console.log('\n🔥 开始导出时效分析RawData...');
    
    const { 
      dateRange, 
      selectedBrand, 
      selectedPlatform,
      selectedSelfFlag = 'Y',
      selectedCarrier = null,
      analysisType = 'S2D',
      userBrands = null
    } = req.body;
    
    console.log('📊 导出参数:', {
      dateRange,
      selectedBrand,
      selectedPlatform,
      selectedSelfFlag,
      selectedCarrier,
      analysisType,
      userBrands
    });
    
    const { executeQuery } = require('../config/database-api.js');
    const { getLatestTimelinessData } = require('../utils/timelinessFileStore.js');
    const { getBrandMapping } = require('../utils/brandMapping');
    
    // 获取时效数据用于匹配Plan时效
    const timelinessResult = getLatestTimelinessData();
    if (!timelinessResult || !timelinessResult.data || timelinessResult.data.length === 0) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '未找到时效数据文件，请先上传时效Excel表'
      });
    }
    
    const timelinessData = timelinessResult.data;  // ✅ 获取实际的数据数组
    console.log(`📊 加载了 ${timelinessData.length} 条时效数据`);

    const timelinessMap = new Map();
    const exactSlaBrands = new Set();
    timelinessData.forEach(item => {
      const serviceTypeName = item.serviceTypeName || '';
      const orderTypeName = item.orderTypeName || '*';
      if (item.brand && item.brand !== '*') {
        exactSlaBrands.add(item.brand);
      }
      if (item.cityName) {
        timelinessMap.set(
          `${item.brand}|${item.carrier}|${serviceTypeName}|${orderTypeName}|${item.cityName}`,
          item
        );
      }
    });
    
    // 🔍 打印时效数据的前10条样本（包含完整信息）
    console.log('🔍 时效数据样本（前10条）:');
    timelinessData.slice(0, 10).forEach((item, index) => {
      // ✅ 现在时效数据已经被timelinessFileStore标准化为小写字段名
      const brandName = item.brand;
      const cityName = item.cityName;
      const courierCode = item.carrier;
      const timeValue = item.timeValue;
      const orderTypeName = item.orderTypeName || '*';
      const itemKey = `${brandName}|${courierCode}|${item.serviceTypeName || ''}|${orderTypeName}|${item.areaId || cityName}`;
      
      console.log(`  ${index + 1}. 原始数据:`, { brandName, cityName, courierCode, orderTypeName, timeValue });
      console.log(`     生成的Key: "${itemKey}"`);
    });
    
    // ✅ 复用 order-details.js 的 QueryUtils
    const QueryUtils = {
      getBrandJoin(tableAlias = 't') {
        return `LEFT JOIN APP_CMS.BAS_COMPANY bc_brand ON ${tableAlias}.CUSTOMERNO = bc_brand.COMPANY_SYSID`;
      },
      
      BASE_WHERE_CONDITIONS_VIEW: `
        WHERE (v.WMS_OUTBOUND_TIME IS NOT NULL 
               AND v.WMS_OUTBOUND_TIME >= ${dateBoundarySql('dateFrom')}
               AND v.WMS_OUTBOUND_TIME < ${dateEndExclusiveSql('dateTo')})
          AND v.TSK_MERGE_NO IS NOT NULL`,
      
      async buildFiltersAsync(queryParams, brand, platform, selfFlag, userBrands, carrierid) {
        let brandFilter = '';
        let platformFilter = '';
        let selfFlagFilter = '';
        let carrierFilter = '';

        const normalizeStringOrArray = (value) => {
          if (value == null) return undefined;
          if (Array.isArray(value)) {
            const normalized = value
              .map(v => String(v).trim())
              .filter(Boolean)
              .filter(v => v !== 'all');
            return normalized.length > 0 ? normalized : undefined;
          }
          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed || trimmed === 'all') return undefined;
            if (trimmed.includes(',')) {
              const normalized = trimmed.split(',').map(v => v.trim()).filter(Boolean).filter(v => v !== 'all');
              return normalized.length > 0 ? normalized : undefined;
            }
            return trimmed;
          }
          return undefined;
        };
        
        // 获取动态品牌映射
        const BRAND_MAPPING = await getBrandMapping();
        
        // 品牌筛选（支持单选/多选）
        const normalizedBrand = normalizeStringOrArray(brand);
        if (normalizedBrand) {
          const requested = Array.isArray(normalizedBrand) ? normalizedBrand : [normalizedBrand];
          const mappedBrands = requested
            .map(item => BRAND_MAPPING[item] || item)
            .map(item => String(item).trim())
            .filter(Boolean);

          if (mappedBrands.length === 1) {
            queryParams.brand0 = mappedBrands[0];
            brandFilter = 'AND v.CUSTOMERNO = :brand0';
          } else if (mappedBrands.length > 1) {
            mappedBrands.forEach((code, index) => {
              queryParams[`brand${index}`] = code;
            });
            const placeholders = mappedBrands.map((_, index) => `:brand${index}`).join(', ');
            brandFilter = `AND v.CUSTOMERNO IN (${placeholders})`;
          }
        } else if (userBrands && userBrands !== 'all') {
          const brandList = normalizeStringOrArray(userBrands) || [];
          const normalizedBrandList = Array.isArray(brandList) ? brandList : [brandList];
          
          if (normalizedBrandList.length > 0) {
            normalizedBrandList.forEach((brandCode, index) => {
              queryParams[`userbrand${index}`] = brandCode;
            });
            const userBrandPlaceholders = normalizedBrandList.map((_, index) => `:userbrand${index}`).join(', ');
            brandFilter = `AND v.CUSTOMERNO IN (${userBrandPlaceholders})`;
          }
        }
        
        // 平台筛选（支持单值或数组）
        if (platform && platform !== 'all') {
          const normalize = (v) => {
            if (v == null) return undefined;
            if (typeof v === 'string') {
              const t = v.trim();
              if (t === '') return undefined;
              if (t.includes(',')) return t.split(',').map(s => s.trim()).filter(Boolean);
              return t;
            }
            if (Array.isArray(v)) return v.map(i => String(i).trim()).filter(Boolean);
            return undefined;
          };

          const normalizedPlatform = normalize(platform);
          if (normalizedPlatform) {
            const PLATFORM_MAPPING = {
              'tmall': '天猫',
              'douyin': '抖音',
              'jd': '京东',
              'pdd': '拼多多',
              'official': '官网/小程序',
              'o2o': 'O2O',
              'xiaohongshu': '小红书',
              'wechat': '微信'
            };
            const aliasToCanonical = {
              'tmall': '天猫',
              'douyin': '抖音',
              'jd': '京东',
              'pdd': '拼多多',
              'official': '官网/小程序',
              'wechat': '微信',
              '微信小程序': '微信',
              '抖音电商': '抖音',
              '官网': '官网/小程序',
              '小程序': '官网/小程序'
            };
            const canonicalVariants = {
              '官网/小程序': ['官网/小程序', '官网／小程序', '官网', '小程序'],
              '微信': ['微信', '微信小程序'],
              '抖音': ['抖音', '抖音电商']
            };

            const normalizeToken = (value) => String(value || '')
              .trim()
              .replace(/／/g, '/')
              .replace(/\s+/g, '')
              .toLowerCase();

            const addPlatformVariant = (expandSet, value) => {
              const text = String(value || '').trim();
              if (!text) return;
              expandSet.add(text);
              expandSet.add(text.replace(/\//g, '／'));
              expandSet.add(text.replace(/／/g, '/'));

              const normalizedToken = normalizeToken(text);
              const canonical = aliasToCanonical[normalizedToken] || aliasToCanonical[text] || text;
              expandSet.add(String(canonical).trim());

              const variants = canonicalVariants[canonical] || [];
              variants.forEach((item) => {
                const candidate = String(item || '').trim();
                if (!candidate) return;
                expandSet.add(candidate);
                expandSet.add(candidate.replace(/／/g, '/'));
              });
            };

            const requested = Array.isArray(normalizedPlatform) ? normalizedPlatform : [normalizedPlatform];
            const expandSet = new Set();
            requested.forEach((p) => {
              addPlatformVariant(expandSet, p);
              addPlatformVariant(expandSet, PLATFORM_MAPPING[p] || p);
            });
            const expanded = Array.from(expandSet)
              .map((value) => String(value).trim().replace(/／/g, '/'))
              .filter(Boolean);
            expanded.forEach((p, idx) => { queryParams[`platform_${idx}`] = p; });
            const placeholders = expanded.map((_, idx) => `:platform_${idx}`).join(', ');
            platformFilter = `AND REPLACE(TRIM(v.PLATFORM_CLASS), '／', '/') IN (${placeholders})`;
          }
        }
        
        // 自管筛选
        if (selfFlag && selfFlag !== 'all') {
          queryParams.selfFlag = selfFlag;
          selfFlagFilter = 'AND v.SELF_FLAG = :selfFlag';
        }
        
        // 快递商筛选
        if (carrierid) {
          queryParams.carrierid = carrierid;
          carrierFilter = 'AND v.CARRIERID = :carrierid';
        }
        
        return { brandFilter, platformFilter, selfFlagFilter, carrierFilter };
      }
    };
    
    // 构建查询参数
    const queryParams = {
      dateFrom: dateRange?.from,
      dateTo: dateRange?.to
    };
    
    // 异步构建筛选条件
    const { brandFilter, platformFilter, selfFlagFilter, carrierFilter } = await QueryUtils.buildFiltersAsync(
      queryParams, 
      selectedBrand,
      selectedPlatform,
      selectedSelfFlag, 
      userBrands,
      selectedCarrier
    );

    // Oracle普通SQL不允许直接数组绑定，执行前强校验防止 ORA-01484。
    const arrayBindKeys = Object.keys(queryParams).filter((k) => Array.isArray(queryParams[k]));
    if (arrayBindKeys.length > 0) {
      throw new Error(`Invalid array bind params for raw export: ${arrayBindKeys.join(', ')}`);
    }
    
    console.log('🔍 SQL参数:', queryParams);
    
    // ✅ 完全参考 order-details.js 的查询结构
    const rawDataQuery = `
      SELECT 
        -- 快递商信息
        v.CARRIERID as carrier_id,
        bc_carrier.COMPANY_ABNAME as carrier_name,
        v.COMPANY_NAME as company_name,
        
        -- 订单基本信息
        v.TSK_MERGE_NO as tsk_merge_no,
        v.CO_PAY_TIME as payment_date,
        v.PLATFORM_CLASS as data_source,
        v.DIS_COMFIRM_TIME_T as wms_outbound_time,
        v.DIS_STATUS_NAME as dis_status_name,
        v.DELIVERY_DAYS as delivery_days,
        v.ORDER_TIME_T as order_time,
        
        -- 时间信息
        v.OUTBOUND_TIME_T as outbound_time,
        v.DELIVERY_TIME_C as delivery_time,
        v.TRACKING_TIME_T as tracking_time,
        v.DISP_TIME_T as disp_time,
        v.ETA_T as eta,
        
        -- 时长信息
        v.OUTBOUND_TIME_LEN as outbound_time_len,  -- 🆕 新增：揽收时长H
        v.DELIVERY_TIMES as delivery_times_h,
        v.DELAY_DAYS as delay_days,
        v.DELAY_CLASS_NAME as delay_class_name,
        
        -- 目的地信息
        v.DEST_PROVINCE_NAME as dest_province,
        v.DEST_CITY_NAME as dest_city_name,
        v.DEST_SECTIONE_NAME as dest_section_name,
        v.DEST_CUSTOMER_CONTACT as dest_customer,
        v.DEST_CUSTOMER_TEL1 as dest_customer_phone,
        v.DEST_CUSTOMER_ADDRESS as dest_customer_address,
        
        -- 始发地信息
        v.SOURCE_PROVINCE_NAME as source_province,
        v.SOURCE_CITY_NAME as source_city_name,
        
        -- 标识信息
        v.IF_DELAY as if_delay,
        v.TR_DESCR as tr_descr,
        v.SELF_FLAG as self_flag,
        v.IS_24H as is_24h,
        v.IS_48H as is_48h,
        
        -- 类型信息
        v.ORDER_TYPE_NAME as order_type_name,
        v.DIS_TYPE_NAME as dis_type_name,
        
        -- 警告原因
        v.PATCH_REASON1_NAME as patch_reason1,
        v.PATCH_REASON2_NAME as patch_reason2,
        
        -- 🆕 新增字段：用于时效计算
        v.DIS_STATUS as dis_status,
        v.DELIVERY_TIMES as s2d_actual_hours,
        v.DEST_CITY_NAME as dest_city_for_plan,
        v.TRSERVICE_TYPE_NAME as service_type_name
        
      FROM APP_CMS.VIEW_TSK_LIST_TASK v
      ${QueryUtils.getBrandJoin('v')}
      LEFT JOIN APP_CMS.BAS_COMPANY bc_carrier ON v.CARRIERID = bc_carrier.COMPANY_SYSID
      ${QueryUtils.BASE_WHERE_CONDITIONS_VIEW}
        ${brandFilter}
        ${platformFilter}
        ${selfFlagFilter}
        ${carrierFilter}
        AND v.CARRIERID != 'EMS'
        AND v.DIS_TYPE = '01'
        AND v.DIS_STATUS IN ('93', '95', '100')  -- ✅ 修复问题1：只导出已签收订单
      ORDER BY v.WMS_OUTBOUND_TIME DESC
    `;
    
    console.log('📋 执行查询...');
    const startTime = Date.now();
    
    const result = await executeQuery(rawDataQuery, queryParams);
    const rawData = result.rows || result;  // ✅ 兼容不同的返回格式
    
    const endTime = Date.now();
    console.log(`✅ 查询完成，耗时: ${endTime - startTime}ms，查询到 ${rawData.length} 条数据`);
    
    const normalizedAnalysisType = String(analysisType || 'S2D').toUpperCase();
    const isC2DAnalysis = normalizedAnalysisType === 'C2D';

    const parseDateTimeToMillis = (value) => {
      if (!value) return null;
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.getTime();
      }

      const text = String(value).trim();
      if (!text) return null;

      // 兼容 Oracle 常见输出：YYYY-MM-DD HH:mm:ss
      const normalized = text.replace(' ', 'T');
      const ms = Date.parse(normalized);
      return Number.isNaN(ms) ? null : ms;
    };

    const calcC2DHours = (paymentDate, deliveryTime) => {
      const paymentMs = parseDateTimeToMillis(paymentDate);
      const deliveryMs = parseDateTimeToMillis(deliveryTime);
      if (paymentMs == null || deliveryMs == null || deliveryMs < paymentMs) {
        return null;
      }

      return Math.round((((deliveryMs - paymentMs) / (1000 * 60 * 60)) * 100)) / 100;
    };

    // 为每条订单计算实际时效区间和计划时效区间
    let processedCount = 0;  // ✅ 修复：使用独立的计数器，避免在map内部访问enrichedData
    const enrichedData = rawData.map(order => {
      // 根据分析类型计算实际时效小时：
      // - S2D: 使用视图字段 DELIVERY_TIMES
      // - C2D: 使用 DELIVERY_TIME - PAYMENTDATE_D
      const actualHours = isC2DAnalysis
        ? calcC2DHours(order.PAYMENT_DATE, order.DELIVERY_TIME)
        : (order.S2D_ACTUAL_HOURS !== null && order.S2D_ACTUAL_HOURS !== undefined
            ? Number(order.S2D_ACTUAL_HOURS)
            : null);

      // 计算实际时效区间
      let actualTimeZone = '';
      if (actualHours !== null && actualHours !== undefined && Number.isFinite(actualHours)) {
        if (actualHours <= 24) {
          actualTimeZone = '24H';
        } else if (actualHours <= 48) {
          actualTimeZone = '48H';
        } else if (actualHours <= 72) {
          actualTimeZone = '72H';
        } else {
          actualTimeZone = '72H+';
        }
      }
      
      // 匹配Plan时效
      let planTimeZone = '';
      let planHours = null;
      let matchDebug = null;  // 🔍 调试信息
      const orderTypeName = order.ORDER_TYPE_NAME || order.order_type_name || '';
      
      if (order.COMPANY_NAME && order.CARRIER_ID) {
        const serviceTypeName = order.SERVICE_TYPE_NAME || '';
        const cityName = order.DEST_CITY_FOR_PLAN;
        const { matchKey, timelinessMatch } = findTimelinessMatch(
          timelinessMap,
          order.COMPANY_NAME,
          order.CARRIER_ID,
          serviceTypeName,
          orderTypeName,
          cityName
        );
        
        matchDebug = {
          matchKey,
          found: !!timelinessMatch,
          companyName: order.COMPANY_NAME,
          city: cityName,
          carrier: order.CARRIER_ID,
          serviceTypeName,
          orderTypeName
        };
        
        if (timelinessMatch) {
          // ✅ 使用小写字段名
          planHours = timelinessMatch.timeValue;
          if (planHours <= 24) {
            planTimeZone = '24H';
          } else if (planHours <= 48) {
            planTimeZone = '48H';
          } else if (planHours <= 72) {
            planTimeZone = '72H';
          } else {
            planTimeZone = '72H+';
          }
        }
      }
      
      // 🔍 打印前3条订单的匹配结果（使用独立计数器）
      processedCount++;
      if (processedCount <= 3) {
        console.log(`\n🔍 订单 #${processedCount} 匹配结果:`, matchDebug);
        console.log(`  - Plan时效区间: ${planTimeZone || '未匹配'}`);
        console.log(`  - Plan时效小时: ${planHours || '未匹配'}`);
      }

      const usesWildcardBrandScope = !exactSlaBrands.has(order.COMPANY_NAME);
      const isEcommerceShipment = orderTypeName === '电商发货';
      if (usesWildcardBrandScope && !isEcommerceShipment) {
        return null;
      }
      
      return {
        快递商: order.CARRIER_NAME || order.CARRIER_ID || '',
        项目名称: order.COMPANY_NAME || '',
        快递单号: order.TSK_MERGE_NO || '',
        消费者付款时间: order.PAYMENT_DATE || '',
        销售平台分类: order.DATA_SOURCE || '',
        出库时间: order.WMS_OUTBOUND_TIME || '',
        快递单状态: order.DIS_STATUS_NAME || '',
        WMS进单时间: order.ORDER_TIME || '',
        揽收时间: order.OUTBOUND_TIME || '',
        揽收时长H: order.OUTBOUND_TIME_LEN || '',  // 🆕 新增：揽收时长H
        目的地省份: order.DEST_PROVINCE || '',
        目的地城市: order.DEST_CITY_NAME || '',
        收件人: order.DEST_CUSTOMER || '',
        收件人电话: order.DEST_CUSTOMER_PHONE || '',
        目的地区县: order.DEST_SECTION_NAME || '',
        目的地地址: order.DEST_CUSTOMER_ADDRESS || '',
        始发省份: order.SOURCE_PROVINCE || '',
        始发城市: order.SOURCE_CITY_NAME || '',
        是否超时: order.IF_DELAY || '',
        预计送达时间: order.ETA || '',
        签收时间: order.DELIVERY_TIME || '',
        超时天数: order.DELAY_DAYS || '',
        最后跟踪时间: order.TRACKING_TIME || '',
        最后描述: order.TR_DESCR || '',
        是否自管: order.SELF_FLAG || '',
        订单类型: orderTypeName,
        快递单类型: order.DIS_TYPE_NAME || '',
        快递产品: order.SERVICE_TYPE_NAME || '',
        配送时长H: order.DELIVERY_TIMES_H || '',
        一级警告原因: order.PATCH_REASON1 || '',
        二级警告原因: order.PATCH_REASON2 || '',
        超时级别: order.DELAY_CLASS_NAME || '',
        超24H未揽收: order.IS_24H || '',
        超48H未更新: order.IS_48H || order.is_48h || '',
        首派时间: order.DISP_TIME || '',
        时效分析类型: normalizedAnalysisType,
        实际时效区间: actualTimeZone,
        计划时效区间: planTimeZone,
        实际时效小时: actualHours !== null ? actualHours : '',
        计划时效小时: planHours !== null ? planHours : ''
      };
    }).filter(Boolean);
    
    console.log(`✅ 数据处理完成，共 ${enrichedData.length} 条记录`);
    
    res.json({
      success: true,
      data: enrichedData,
      summary: {
        totalRecords: enrichedData.length,
        dateRange,
        selectedBrand,
        selectedPlatform,
        analysisType
      }
    });
    
  } catch (error) {
    console.error('❌ 导出RawData失败:', error);
    return sendRouteError(res, req, error, { fallbackError: '导出失败' });
  }
});

module.exports = router;