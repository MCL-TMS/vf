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

const router = express.Router();

/**
 * DEST_CITY代码到真实城市名称的映射查询
 * 从BAS_AREA表查找DEST_CITY代码对应的城市名称
 * 严格按照数据库结构：只有area_id和area_name两个字段，1:1映射
 */
async function getCityAreaMapping() {
  try {
    const { executeQuery } = require('../config/database-api');
    
    // 从BAS_AREA表获取DEST_CITY代码到城市名称的映射
    try {
      console.log('🗺️ 正在从BAS_AREA表查询DEST_CITY代码到城市名称的映射...');
      
      // 查询BAS_AREA表: 只查询area_id和area_name两个字段
      const query = `
        SELECT 
          AREA_ID,
          AREA_NAME
        FROM APP_CMS.BAS_AREA 
        WHERE AREA_ID IS NOT NULL 
          AND AREA_NAME IS NOT NULL
          AND TRIM(AREA_NAME) != ''
        ORDER BY AREA_ID
      `;
      
      const result = await executeQuery(query);
      
      // 构建DEST_CITY代码到城市名称的映射对象
      // TSK_LIST_TASK.DEST_CITY -> BAS_AREA.area_id -> BAS_AREA.area_name
      const destCityToNameMapping = {};
      
      if (result.rows && result.rows.length > 0) {
        result.rows.forEach(row => {
          const areaId = row[0]?.toString().trim();    // DEST_CITY代码
          const areaName = row[1]?.toString().trim();  // 真实城市名称
          
          if (areaId && areaName) {
            // 严格按照数据库返回的数据做1:1映射，不做任何处理
            destCityToNameMapping[areaId] = areaName;
          }
        });
        
        console.log(`✅ 从BAS_AREA表获取到${result.rows.length}条记录`);
        console.log(`📍 DEST_CITY->城市名称映射: ${Object.keys(destCityToNameMapping).length}个代码`);
        console.log('🔍 映射示例:', Object.entries(destCityToNameMapping).slice(0, 5).map(([code, name]) => `${code}->${name}`));
        
        return destCityToNameMapping;
      } else {
        console.warn('⚠️ BAS_AREA表查询结果为空');
        throw new Error('BAS_AREA表无数据');
      }
      
    } catch (dbError) {
      console.warn('💾 数据库查询失败:', dbError.message);
      
      // 在生产环境中，建议抛出错误而不是使用备用数据
      // 用户需要确保BAS_AREA表数据正确配置
      throw new Error(`无法获取城市映射数据：${dbError.message}`);
    }
    
  } catch (error) {
    console.error('❌ 获取城市区域映射完全失败:', error.message);
    return {};
  }
}

/**
 * 解析Excel文件中的时效数据
 */
function parseTimelinessExcel(filePath, cityMapping, selectedBrand = null) {
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
    
    // 解析数据行
    const parsedData = [];
    let validRows = 0;
    let errorRows = 0;
    
    dataRows.forEach((row, rowIndex) => {
      try {
        const carrier = row[carrierIndex]?.toString().trim();
        const cityName = row[cityIndex]?.toString().trim();
        
        if (!carrier || !cityName) {
          errorRows++;
          return;
        }
        
        // 严格按照城市映射查找area_id，不做额外处理
        const areaId = cityMapping[cityName];
        
        // 根据选择的品牌优化处理顺序
        const optimizedBrandColumns = optimizeBrandColumns(brandColumns, selectedBrand);
        
        // 解析各品牌的时效数据
        optimizedBrandColumns.forEach(brandCol => {
          const timeValue = row[brandCol.index];
          if (timeValue && timeValue !== '-') {
            const parsedTime = parseTimeValue(timeValue);
            if (parsedTime !== null) {
              parsedData.push({
                carrier: carrier,
                cityName: cityName,
                areaId: areaId || null,
                brand: brandCol.brandCode,
                timeValue: parsedTime,
                isOvertime: timeValue.toString().includes('+'),
                rawValue: timeValue.toString(),
                rowIndex: rowIndex + 2 // Excel行号（从1开始，加上表头）
              });
            }
          }
        });
        
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
      unmappedCities: parsedData
        .filter(item => !item.areaId)
        .map(item => item.cityName)
        .filter((city, index, arr) => arr.indexOf(city) === index)
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
 * POST /api/upload/timeliness
 */
router.post('/timeliness', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: '未接收到文件',
        message: '请选择要上传的Excel或CSV文件'
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
    let cityMapping = {};

    try {
      // 1. 获取城市区域映射
      console.log('🗺️ 获取城市区域映射...');
      cityMapping = await getCityAreaMapping();
      console.log(`✅ 获取到${Object.keys(cityMapping).length}个城市映射`);

      // 2. 解析Excel文件
      console.log('📊 解析Excel文件...', brand ? `优先处理品牌: ${brand}` : '');
      if (file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel')) {
        parseResult = parseTimelinessExcel(file.path, cityMapping, brand);
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

      // 计算城市映射率
      const mappedCities = parseResult.parsedData.filter(item => item.areaId).length;
      dataQuality.cityMappingRate = parseResult.parsedData.length > 0 
        ? Math.round((mappedCities / parseResult.parsedData.length) * 100) 
        : 0;

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
          status: 'processed'
        },
        processingResult: {
          totalRows: parseResult.totalRows,
          validRows: parseResult.validRows,
          errorRows: parseResult.errorRows,
          duplicateRows: 0, // 暂未实现去重检查
          timelinessRecords: parseResult.parsedData.length,
          brandColumns: parseResult.brandColumns,
          selectedBrandRecords: brand ? parseResult.parsedData.filter(item => item.brand === brand).length : null,
          dataQuality: dataQuality
        },
        warnings: parseResult.unmappedCities.length > 0 ? [
          `以下${parseResult.unmappedCities.length}个城市未能在数据库中找到对应区域: ${parseResult.unmappedCities.slice(0, 10).join(', ')}${parseResult.unmappedCities.length > 10 ? '...' : ''}`
        ] : []
      };

      res.json(response);

    } catch (parseError) {
      console.error('文件解析失败:', parseError);
      return res.status(400).json({
        error: '文件解析失败',
        message: parseError.message,
        details: parseError.stack
      });
    } finally {
      // 清理临时文件
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
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
        return res.status(400).json({
          error: '文件大小超限',
          message: '文件大小不能超过10MB'
        });
      }
    }

    res.status(500).json({
      error: '服务器内部错误',
      message: '文件上传处理失败，请稍后重试',
      details: error.message
    });
  }
});

/**
 * 获取上传历史记录
 * GET /api/upload/history
 */
router.get('/history', async (req, res) => {
  try {
    const { type, limit = 10 } = req.query;
    
    // 从数据库查询上传历史记录
    // 在生产环境中，这里应该连接到数据库查询真实的上传历史
    // TODO: 实现真实的数据库查询
    // const query = `SELECT * FROM UPLOAD_HISTORY WHERE TYPE = ? ORDER BY UPLOAD_TIME DESC LIMIT ?`;
    // const result = await executeQuery(query, [type, limit]);

    res.json({
      success: true,
      data: [],
      total: 0,
      message: '上传历史功能需要在生产环境中连接数据库实现',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('获取上传历史失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取上传历史失败'
    });
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
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取城市映射失败'
    });
  }
});

/**
 * 根据DEST_CITY代码查询城市名称
 * POST /api/upload/dest-city-lookup
 */
router.post('/dest-city-lookup', async (req, res) => {
  try {
    const { destCities } = req.body;
    
    if (!destCities || !Array.isArray(destCities) || destCities.length === 0) {
      return res.status(400).json({
        error: '参数错误',
        message: '请提供有效的destCities数组'
      });
    }
    
    console.log('🔍 查询DEST_CITY对应的城市名称:', destCities);
    
    try {
      const { getConnection, releaseConnection } = require('../config/database-api');
      const connection = await getConnection();
      
      if (!connection) {
        throw new Error('数据库连接失败');
      }
      
      // 构建IN查询的占位符
      const placeholders = destCities.map((_, index) => `:id${index}`).join(',');
      const bindParams = {};
      destCities.forEach((id, index) => {
        bindParams[`id${index}`] = id;
      });
      
      const query = `
        SELECT 
          AREA_ID,
          AREA_NAME
        FROM APP_CMS.BAS_AREA 
        WHERE AREA_ID IN (${placeholders})
        ORDER BY AREA_ID
      `;
      
      console.log('🔍 执行查询:', query);
      console.log('🔍 绑定参数:', bindParams);
      
      const result = await connection.execute(query, bindParams);
      await releaseConnection(connection);
      
      const lookupResults = {};
      
      if (result.rows && result.rows.length > 0) {
        result.rows.forEach(row => {
          const areaId = row[0]?.toString();
          const areaName = row[1]?.toString().trim();
          
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
      const notFound = destCities.filter(id => !lookupResults[id]);
      
      console.log(`✅ DEST_CITY查询完成: 找到${Object.keys(lookupResults).length}个，未找到${notFound.length}个`);
      
      res.json({
        success: true,
        message: `DEST_CITY查询完成`,
        data: {
          found: lookupResults,
          notFound: notFound,
          totalQueried: destCities.length,
          foundCount: Object.keys(lookupResults).length,
          notFoundCount: notFound.length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (dbError) {
      console.error('💾 DEST_CITY数据库查询失败:', dbError);
      
      res.status(500).json({
        error: '数据库连接失败',
        message: `无法查询DEST_CITY映射: ${dbError.message}`,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ DEST_CITY查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: 'DEST_CITY查询失败'
    });
  }
});

/**
 * 执行时效分析计算
 * POST /api/upload/analyze-timeliness
 */
router.post('/analyze-timeliness', async (req, res) => {
  try {
    const { dateRange, selectedBrand, selectedCarrier, analysisType = 'both', userBrands } = req.body; // ✅ 添加userBrands
    
    if (!dateRange || !dateRange.from || !dateRange.to) {
      return res.status(400).json({
        error: '参数错误',
        message: '请提供有效的时间范围'
      });
    }
    
    console.log('🔍 开始时效分析计算:', {
      dateRange,
      selectedBrand,
      selectedCarrier,
      analysisType,
      userBrands // ✅ 添加日志
    });
    
    try {
      const { getConnection, releaseConnection } = require('../config/database-api');
      const connection = await getConnection();
      
      if (!connection) {
        throw new Error('数据库连接失败');
      }
      
      // 构建基础查询条件 - 按照Plan S2D/C2D业务逻辑
      let whereConditions = [
        "WMS_OUTBOUND_TIME BETWEEN TO_DATE(:startDate, 'YYYY-MM-DD') AND TO_DATE(:endDate, 'YYYY-MM-DD')",
        "SELF_FLAG = 'Y'", // 默认只查自管订单
        "SUM_SEND_TIME2 IS NOT NULL", // 确保有实际配送时长数据
        "SUM_SEND_TIME2 > 0", // 排除无效时长
        "DEST_CITY IS NOT NULL", // 确保有目的城市数据（用于匹配时效表）
        "CARRIERID IS NOT NULL" // 确保有快递商数据（用于匹配时效表）
      ];
      
      let bindParams = {
        startDate: dateRange.from,
        endDate: dateRange.to
      };
      
      // 品牌筛选
      if (selectedBrand && selectedBrand !== 'all') {
        whereConditions.push("CUSTOMERNO = :customerno");
        // 品牌名称映射到CUSTOMERNO值
        const brandMapping = {
          'DICKIES': '18405',
          'TNF': '18405-1', 
          'ICEBREAKER': '18405-2',
          'VANS': '18405-3',
          'TIMBERLAND': '18405-4'
        };
        bindParams.customerno = brandMapping[selectedBrand] || selectedBrand;
      } else if (userBrands && Array.isArray(userBrands) && userBrands.length > 0) {
        // ✅ 新增：如果没有选择具体品牌，但有userBrands权限，则只查询用户有权限的品牌
        const brandPlaceholders = userBrands.map((_, idx) => `:userBrand${idx}`).join(', ');
        whereConditions.push(`CUSTOMERNO IN (${brandPlaceholders})`);
        
        userBrands.forEach((brand, idx) => {
          bindParams[`userBrand${idx}`] = brand;
        });
        
        console.log('🔐 [时效分析] 应用用户品牌权限过滤:', {
          userBrands,
          whereCondition: `CUSTOMERNO IN (${brandPlaceholders})`,
          bindParams: userBrands
        });
      }
      
      // 快递商筛选  
      if (selectedCarrier && selectedCarrier !== 'all') {
        whereConditions.push("CARRIERID = :carrierId");
        bindParams.carrierId = selectedCarrier;
      }
      
      // Plan S2D、C2D筛选规则
      // a) 排除EMS承运订单：CARRIERID字段≠"EMS"
      whereConditions.push("CARRIERID != 'EMS'");
      // b) 排除退货订单：DIS_TYPE字段≠"06"  
      whereConditions.push("(DIS_TYPE IS NULL OR DIS_TYPE != '06')");
      
      const whereClause = whereConditions.join(' AND ');
      
      // 获取订单基础数据用于Plan vs Actual分析
      const ordersQuery = `
        SELECT 
          TSK_MERGE_NO,
          CUSTOMERNO,
          CARRIERID,
          DEST_CITY,
          SUM_SEND_TIME2 as actual_hours,
          CASE CUSTOMERNO
            WHEN '18405' THEN 'DICKIES'
            WHEN '18405-1' THEN 'TNF'
            WHEN '18405-2' THEN 'ICEBREAKER'
            WHEN '18405-3' THEN 'VANS'
            WHEN '18405-4' THEN 'TIMBERLAND'
            ELSE CUSTOMERNO
          END as brand_name
        FROM APP_CMS.TSK_LIST_TASK
        WHERE ${whereClause}
      `;
      
      const ordersResult = await connection.execute(ordersQuery, bindParams);
      const ordersData = ordersResult.rows || [];
      
      console.log(`📊 获取到 ${ordersData.length} 条订单数据用于时效分析`);
      
      // TODO: 在生产环境中，这里应该从用户上传的真实时效表中获取Plan时效
      // 目前返回提示信息，要求用户先上传时效表
      
      await releaseConnection(connection);
      
      res.json({
        success: false,
        message: '时效分析需要先上传时效标准表',
        data: {
          analysisType,
          dateRange,
          selectedBrand: selectedBrand || 'all',
          selectedCarrier: selectedCarrier || 'all',
          totalOrders: ordersData.length,
          requireTimelinessTable: true
        },
        instructions: '请先使用 POST /api/upload/timeliness 接口上传包含品牌+城市+快递商时效标准的Excel表格',
        timestamp: new Date().toISOString()
      });
      
    } catch (dbError) {
      console.error('💾 时效分析数据库查询失败:', dbError);
      
      res.status(500).json({
        error: '数据库查询失败',
        message: `时效分析计算失败: ${dbError.message}`,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ 时效分析失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '时效分析计算失败'
    });
  }
});

/**
 * 获取SLA匹配状态
 * GET /api/upload/sla-matching-status
 */
router.get('/sla-matching-status', async (req, res) => {
  try {
    const { brand, dateRange } = req.query;
    
    // TODO: 在生产环境中查询已上传的时效表数据
    // 检查品牌+城市+快递商的时效覆盖情况
    
    res.json({
      success: true,
      message: 'SLA匹配状态查询',
      data: {
        totalSLARecords: 0,
        brandCoverage: {},
        carrierCoverage: {},
        cityCoverage: {},
        lastUpdateTime: null,
        coverageRate: 0,
        missingCombinations: []
      },
      instructions: '请先上传时效标准表以获取SLA匹配状态',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('获取SLA状态失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: '获取SLA匹配状态失败'
    });
  }
});

module.exports = router;