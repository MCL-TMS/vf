/**
 * VF物流数据分析平台 - 时效数据处理工具（CommonJS版本）
 * 
 * ✅ 2025-01-09创建：CommonJS版本，解决Node.js模块加载问题
 * ✅ 基于文件存储：从JSON/Excel文件加载时效数据
 * 
 * 架构说明：
 * - Plan时效数据存储在JSON文件中（backend/uploads/timeliness/*.json）
 * - 时效分析时从JSON文件加载数据，在应用层匹配Plan时效
 * - 不再使用数据库JOIN TSK_TIMELINESS_DATA表
 */

const { getLatestTimelinessData } = require('./timelinessFileStore.js');

const DEBUG_SNAPSHOT_LIMIT = 5;

function pruneDebugSnapshots(debugDir, prefix) {
  const fs = require('fs');
  const path = require('path');

  const snapshotFiles = fs.readdirSync(debugDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .map((name) => ({
      name,
      filePath: path.join(debugDir, name),
      mtimeMs: fs.statSync(path.join(debugDir, name)).mtimeMs
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  snapshotFiles.slice(DEBUG_SNAPSHOT_LIMIT).forEach((file) => {
    try {
      fs.unlinkSync(file.filePath);
    } catch (error) {
      console.warn(`⚠️ 删除旧调试文件失败: ${file.filePath}`, error.message);
    }
  });
}

function saveDebugSnapshot(debugDir, prefix, debugData) {
  const fs = require('fs');
  const path = require('path');

  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const debugFilePath = path.join(debugDir, `${prefix}-${timestamp}.json`);
  fs.writeFileSync(debugFilePath, JSON.stringify(debugData, null, 2), 'utf-8');
  pruneDebugSnapshots(debugDir, `${prefix}-`);
  return debugFilePath;
}

function getActualWithinPlanCount(planHours, actual24h, actual48h, actual72h, actualOver72h) {
  if (planHours <= 24) return actual24h;
  if (planHours <= 48) return actual24h + actual48h;
  if (planHours <= 72) return actual24h + actual48h + actual72h;
  return actual24h + actual48h + actual72h + actualOver72h;
}

function findMatchedTimeliness(timelinessMap, brandCode, carrierId, serviceTypeName, orderTypeName, cityName) {
  if (!brandCode || !carrierId || !cityName) {
    return { matchKey: null, matchedTimeValue: null };
  }

  const serviceName = serviceTypeName || '';
  const orderName = (orderTypeName || '').toString().trim();
  const orderTypeCandidates = orderName && orderName !== '*' ? [orderName, '*'] : ['*'];
  const buildKeys = (brand, service) => orderTypeCandidates.map((orderType) => `${brand}|${carrierId}|${service}|${orderType}|${cityName}`);
  const shouldUseWildcardBrand = brandCode !== '*' && orderName === '电商发货';
  const candidateKeys = [
    ...buildKeys(brandCode, serviceName)
  ];

  if (serviceName) {
    candidateKeys.push(...buildKeys(brandCode, ''));
  }

  if (shouldUseWildcardBrand) {
    candidateKeys.push(...buildKeys('*', serviceName));
    if (serviceName) {
      candidateKeys.push(...buildKeys('*', ''));
    }
  }

  for (const key of candidateKeys) {
    const matchedTimeValue = timelinessMap.get(key);
    if (matchedTimeValue) {
      return { matchKey: key, matchedTimeValue };
    }
  }

  return { matchKey: candidateKeys[0], matchedTimeValue: null };
}

/**
 * S2D时效分析（Ship to Delivery）
 * 对比Plan时效目标 vs Actual实际表现
 * 
 * @param {Object} options - 分析参数
 * @param {Object} options.dateRange - 日期范围 { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
 * @param {String} options.selectedBrand - 品牌筛选
 * @param {String} options.selectedSelfFlag - 自管筛选
 * @param {String} options.selectedCarrier - 快递商筛选
 * @param {String} options.analysisType - 分析类型: 'S2D', 'C2D', 'both'
 * @returns {Promise<Object>} 分析结果
 */
async function analyzeTimelinessPerformance(options = {}) {
  const analysisTypeForError = options.analysisType || 'S2D';

  try {
    const {
      dateRange,
      selectedBrand = null,
      selectedSelfFlag = 'Y',
      selectedCarrier = null,
      analysisType = 'S2D',
      userBrands = null // 🔥 新增：接收用户品牌权限
    } = options;

    console.log(`\n🔥🔥🔥 ========== ${analysisType}时效分析开始 (CommonJS版本) ========== 🔥🔥🔥\n`);
   // console.log(`🔍 开始${analysisType}时效分析（文件存储模式）:`, {
    //  dateRange,
   //   selectedBrand,
    //  selectedSelfFlag,
    //  selectedCarrier,
    //  analysisType,
    //  userBrands // 🔥 打印userBrands
   // });

    console.log('🔍 开始分析，分析类型:', analysisType, '配置详情:', {
      dateRange,
      selectedBrand,
      selectedSelfFlag,
      selectedCarrier,
      userBrands
    });

    // ✅ 根据analysisType选择执行S2D或C2D分析
    if (analysisType === 'C2D') {
      return await analyzeC2DPerformance(options);
    } else {
      return await analyzeS2DPerformance(options);
    }
  } catch (error) {
    console.error(`❌ ${analysisTypeForError}时效分析失败:`, error);
    throw error;
  }
}

/**
 * S2D时效分析（Ship to Delivery）
 * 从WMS出库到签收的时间分析
 */
async function analyzeS2DPerformance(options = {}) {
  try {
    const { 
      dateRange,
      selectedBrand = null,
      selectedPlatform = null,
      selectedSelfFlag = 'Y',
      selectedCarrier = null,
      analysisType = 'S2D',
      userBrands = null  // ✅ 新增：接收用户品牌权限
    } = options;

    console.log('🔍 执行S2D时效分析（文件存储模式）:', {
      dateRange,
      selectedBrand,
      selectedPlatform,
      selectedSelfFlag,
      selectedCarrier,
      userBrands  // ✅ 打印userBrands
    });

    // ✅ 步骤1: 从JSON文件加载时效数据
    console.log('📂 步骤1: 加载时效数据文件...');
    const timelinessFileData = getLatestTimelinessData();
    
    if (!timelinessFileData || !timelinessFileData.data || timelinessFileData.data.length === 0) {
      console.warn('⚠️  未找到时效数据文件');
      console.log('💡 提示：请先上传时效Excel文件（通过 POST /api/upload/timeliness-excel）');
      
      return {
        success: false,
        error: '未找到时效数据',
        message: '请先上传时效Excel文件',
        data: {
          totalS2DOrders: 0,
          planStats: { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 },
          actualStats: { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 },
          avgS2DTime: 0,
          achievementRate: 0,
          byBrand: [],
          byCourier: []
        }
      };
    }

    const timelinessData = timelinessFileData.data;
    console.log(`✅ 成功加载时效数据: ${timelinessData.length}条记录`);
    console.log(`📄 数据来源: ${timelinessFileData.metadata.fileName} (上传时间: ${timelinessFileData.metadata.uploadTime})`);
    
    // 🔍 检查时效文件中包含哪些品牌
    const uniqueBrands = [...new Set(timelinessData.map(item => item.brand))];
    console.log(`🏷️  时效文件中包含的品牌: ${uniqueBrands.join(', ')}`);
    // 🔥 修复：跳过"all"（全部品牌）的检查
    if (selectedBrand && selectedBrand !== 'all' && !uniqueBrands.includes(selectedBrand)) {
      console.warn(`⚠️  警告: 查询品牌"${selectedBrand}"不在时效文件中！`);
      console.warn(`   时效文件仅包含: ${uniqueBrands.join(', ')}`);
    }

    // ✅ 步骤2: 创建时效匹配Map（按城市名匹配 VIEW_TSK_LIST_TASK.DEST_CITY_NAME）
    const timelinessMap = new Map();          // 按城市名匹配: brand|carrier|serviceType|orderType|cityName → timeValue
    const exactSlaBrands = new Set();
    
    timelinessData.forEach(item => {
      const serviceTypeName = item.serviceTypeName || '';
      const orderTypeName = item.orderTypeName || '*';
      if (item.brand && item.brand !== '*') {
        exactSlaBrands.add(item.brand);
      }
      if (item.cityName) {
        const keyByCityName = `${item.brand}|${item.carrier}|${serviceTypeName}|${orderTypeName}|${item.cityName}`;
        timelinessMap.set(keyByCityName, item.timeValue);
      }
    });

    console.log(`✅ 时效匹配索引已建立:`);
    console.log(`   - 按城市名: ${timelinessMap.size}条记录`);

    // ✅ 步骤3: 查询订单数据（不JOIN时效表）
    console.log('\n📂 步骤3: 查询数据库订单数据...');
    const { executeQuery } = require('../config/database-api.js');
    
    // 解构dateRange
    const startDate = dateRange?.from;
    const endDate = dateRange?.to;
    
    // 构建WHERE条件
    const whereClauses = [];
    const params = {};
    
    // 品牌映射
    const BRAND_MAPPING = {
      'DICKIES': '18405',
      'TNF': '18405-1',
      'ICEBREAKER': '18405-2',
      'VANS': '18405-3',
      'TIMBERLAND': '18405-4'
    };
    
    if (startDate && endDate) {
      whereClauses.push(`t.WMS_OUTBOUND_TIME BETWEEN TO_DATE(:startDate, 'YYYY-MM-DD') AND TO_DATE(:endDate, 'YYYY-MM-DD') + INTERVAL '1' DAY - INTERVAL '1' SECOND`);
      params.startDate = startDate;
      params.endDate = endDate;
    }
    
    // 🔥 修复：品牌筛选逻辑（支持多选、单选、userBrands）
    const brandCode = selectedBrand && !Array.isArray(selectedBrand) ? (BRAND_MAPPING[selectedBrand] || selectedBrand) : null;  // 🔥 品牌代码转换

    if (Array.isArray(selectedBrand) && selectedBrand.length > 0) {
      // 多品牌筛选
      const placeholders = selectedBrand.map((_, index) => `:selectedBrand${index}`).join(', ');
      whereClauses.push(`t.CUSTOMERNO IN (${placeholders})`);
      selectedBrand.forEach((code, index) => {
        params[`selectedBrand${index}`] = code;
      });
      console.log(`[Brand Filter] 多品牌筛选:`, selectedBrand);
    } else if (brandCode && selectedBrand !== 'all') {
      // 单品牌筛选
      whereClauses.push(`t.CUSTOMERNO = :brandCode`);
      params.brandCode = brandCode;
      console.log('[Brand Filter] 单品牌筛选:', brandCode);
    } else if (selectedBrand === 'all' && userBrands && Array.isArray(userBrands) && userBrands.length > 0) {
      // 🔥 新增：当选择"全部品牌"时，使用用户权限范围
      const placeholders = userBrands.map((_, index) => `:userBrand${index}`).join(', ');
      whereClauses.push(`t.CUSTOMERNO IN (${placeholders})`);
      userBrands.forEach((code, index) => {
        params[`userBrand${index}`] = code;
      });
      console.log('🔐 [Brand Filter] 全部品牌 - 基于用户权限 (%d个):', userBrands.length, userBrands);
    } else if (!selectedBrand || selectedBrand === 'all') {
      // 🔥 回退：VF品牌范围（当没有userBrands时）
      whereClauses.push(`t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4')`);
      console.log('🏷️ [Brand Filter] 全部品牌 - 回退到VF品牌范围（未提供userBrands）');
    }
    
    if (selectedCarrier) {
      whereClauses.push(`t.CARRIERID = :selectedCarrier`);
      params.selectedCarrier = selectedCarrier;
    }

    // 平台筛选（按VIEW平台分类字段，兼容代码/中文名/同义词）
    if (selectedPlatform && selectedPlatform !== 'all') {
      const PLATFORM_MAPPING = {
        tmall: '天猫',
        douyin: '抖音',
        jd: '京东',
        pdd: '拼多多',
        official: '官网/小程序',
        o2o: 'O2O',
        xiaohongshu: '小红书',
        wechat: '微信'
      };

      const aliasToCanonical = {
        tmall: '天猫',
        douyin: '抖音',
        jd: '京东',
        pdd: '拼多多',
        official: '官网/小程序',
        wechat: '微信',
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

      const normalizePlatforms = (value) => {
        if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean).filter(v => v !== 'all');
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed || trimmed === 'all') return [];
          return trimmed.includes(',')
            ? trimmed.split(',').map(v => v.trim()).filter(Boolean).filter(v => v !== 'all')
            : [trimmed];
        }
        return [];
      };

      const normalizeToken = (value) => String(value || '')
        .trim()
        .replace(/／/g, '/')
        .replace(/\s+/g, '')
        .toLowerCase();

      const expandSet = new Set();
      const addPlatformVariant = (value) => {
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

      const requestedPlatforms = normalizePlatforms(selectedPlatform);
      requestedPlatforms.forEach((p) => {
        addPlatformVariant(p);
        addPlatformVariant(PLATFORM_MAPPING[p] || p);
      });

      const normalizedValues = Array.from(expandSet)
        .map((value) => String(value).trim().replace(/／/g, '/'))
        .filter(Boolean);

      if (normalizedValues.length === 1) {
        whereClauses.push(`REPLACE(TRIM(v.PLATFORM_CLASS), '／', '/') = :selectedPlatform0`);
        params.selectedPlatform0 = normalizedValues[0];
      } else if (normalizedValues.length > 1) {
        const placeholders = normalizedValues.map((_, index) => `:selectedPlatform${index}`).join(', ');
        whereClauses.push(`REPLACE(TRIM(v.PLATFORM_CLASS), '／', '/') IN (${placeholders})`);
        normalizedValues.forEach((value, index) => {
          params[`selectedPlatform${index}`] = value;
        });
      }
    }

    // ✅ 排除EMS承运订单
    whereClauses.push(`t.CARRIERID != 'EMS'`);
    
    // ✅ 只分析正常订单（使用VIEW中的DIS_TYPE_NAME）
    whereClauses.push(`v.DIS_TYPE_NAME = '正常'`);
    // ✅ 只统计指定签收状态
    whereClauses.push(`v.DIS_STATUS IN ('93', '95', '100')`);
    
    // ✅ 自管筛选逻辑（修正版）
    if (selectedSelfFlag === 'Y') {
      // 选择"自管" → 查询SELF_FLAG='Y'的订单
      whereClauses.push(`t.SELF_FLAG = 'Y'`);
    } else if (selectedSelfFlag === 'N') {
      // 选择"非自管" → 查询SELF_FLAG为NULL或不为Y的订单
      whereClauses.push(`(t.SELF_FLAG IS NULL OR t.SELF_FLAG != 'Y')`);
    }
    // selectedSelfFlag === 'all' 或其他值时不添加筛选条件

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    //console.log('📊 SQL查询参数:', { params, whereClause: whereClause.substring(0, 200) + '...' });

    // ✅ 正确做法 (确认为纯静态字符串作为第一个参数)
    console.log('📊 SQL查询参数');
    console.log('Params:', params);
    console.log('WhereClause:', whereClause.substring(0, 200) + '...');

    // 查询订单统计（按品牌+快递商+城市分组）
    // 🔥 使用JOIN BAS_COMPANY表动态获取品牌名称
    const statsQuery = `
      SELECT 
        bc.COMPANY_ABNAME as BRAND_CODE,
        t.CARRIERID,
        bc_carrier.COMPANY_ABNAME as CARRIER_NAME,
        v.TRSERVICE_TYPE_NAME as SERVICE_TYPE_NAME,
        v.ORDER_TYPE_NAME as ORDER_TYPE_NAME,
        v.DEST_CITY_NAME as CITY_NAME,
        t.DEST_CITY as AREA_ID,
        
        -- ✅ Plan统计：所有订单（不限制状态，用于Plan时效统计）
        COUNT(*) as PLAN_TOTAL_ORDERS,
        
        -- ✅ Actual统计：总数不做限制（与Plan一致）
        COUNT(*) as TOTAL_S2D_ORDERS,
        COUNT(CASE WHEN v.DELIVERY_TIMES IS NOT NULL AND v.DELIVERY_TIMES >= 0 THEN 1 END) as ACTUAL_MEASURED_COUNT,
        
           COUNT(CASE WHEN v.DELIVERY_TIMES IS NOT NULL 
             AND v.DELIVERY_TIMES >= 0
             AND v.DELIVERY_TIMES <= 24 THEN 1 END) as ACTUAL_24H_COUNT,
        
        COUNT(CASE WHEN v.DELIVERY_TIMES IS NOT NULL 
             AND v.DELIVERY_TIMES >= 0
             AND v.DELIVERY_TIMES > 24 
             AND v.DELIVERY_TIMES <= 48 THEN 1 END) as ACTUAL_48H_COUNT,
        
        COUNT(CASE WHEN v.DELIVERY_TIMES IS NOT NULL 
             AND v.DELIVERY_TIMES >= 0
             AND v.DELIVERY_TIMES > 48 
             AND v.DELIVERY_TIMES <= 72 THEN 1 END) as ACTUAL_72H_COUNT,
        
        COUNT(CASE WHEN v.DELIVERY_TIMES IS NOT NULL 
             AND v.DELIVERY_TIMES >= 0
             AND v.DELIVERY_TIMES > 72 THEN 1 END) as ACTUAL_OVER72H_COUNT,
        
        AVG(CASE WHEN v.DELIVERY_TIMES IS NOT NULL 
           AND v.DELIVERY_TIMES >= 0 
           AND v.DELIVERY_TIMES <= 1000 THEN v.DELIVERY_TIMES END) as AVG_S2D_TIME
        
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      LEFT JOIN APP_CMS.BAS_AREA ba ON t.DEST_CITY = ba.AREA_ID
      LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CUSTOMERNO = bc.COMPANY_SYSID
      LEFT JOIN APP_CMS.BAS_COMPANY bc_carrier ON t.CARRIERID = bc_carrier.COMPANY_SYSID
      ${whereClause}
      GROUP BY 
        bc.COMPANY_ABNAME,
        t.CARRIERID,
        bc_carrier.COMPANY_ABNAME,
        v.TRSERVICE_TYPE_NAME,
        v.ORDER_TYPE_NAME,
        v.DEST_CITY_NAME, 
        t.DEST_CITY
      ORDER BY TOTAL_S2D_ORDERS DESC
    `;

    const statsResult = await executeQuery(statsQuery, params);
    
    if (!statsResult || !statsResult.rows || statsResult.rows.length === 0) {
      console.warn('⚠️  查询结果为空');
      return {
        success: false,
        error: '查询结果为空',
        message: '未找到符合条件的订单数据',
        data: {
          totalS2DOrders: 0,
          planStats: { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 },
          actualStats: { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 },
          avgS2DTime: 0,
          achievementRate: 0,
          byBrand: [],
          byCourier: []
        }
      };
    }

    console.log(`✅ 查询成功，共 ${statsResult.rows.length} 个分组记录`);

    // 🔍 打印前3条查询结果，用于调试字段名
    console.log('\n📋 查询结果样本（前3条）:');
    statsResult.rows.slice(0, 3).forEach((row, index) => {
      console.log(`  [${index + 1}]`, JSON.stringify(row, null, 2));
    });
    console.log('');

    // ✅ 步骤4: 在应用层处理订单数据并匹配Plan时效...
    console.log('\n📂 步骤4: 在应用层处理订单数据并匹配Plan时效...');
    
    const planStats = { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 };
    const actualStats = { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 };
    const byBrandMap = new Map();
    const byCourierMap = new Map();
    const byBrandCourierMap = new Map();  // ✅ 新增：品牌×快递商交叉统计

    let totalS2DTime = 0;
    let totalS2DCount = 0;
    let achievedOrderCount = 0;

    let matchedCount = 0;
    let unmatchedCount = 0;

    // 🔍 收集匹配详情，用于调试分析
    const matchedRecords = [];
    const unmatchedRecords = [];

    statsResult.rows.forEach(row => {
      const brandCode = row.BRAND_CODE;
      const carrierId = row.CARRIERID;
      const carrierName = row.CARRIER_NAME || carrierId;
      const serviceTypeName = row.SERVICE_TYPE_NAME || '';
      const orderTypeName = row.ORDER_TYPE_NAME || '';
      const cityName = row.CITY_NAME;
      const areaId = row.AREA_ID;
      
      const planTotalOrders = parseInt(row.PLAN_TOTAL_ORDERS) || 0;  // ✅ 新增：所有订单数（用于Plan统计）
      const totalOrders = parseInt(row.TOTAL_S2D_ORDERS) || 0;        // Actual订单数（不做限制）
      const actual24h = parseInt(row.ACTUAL_24H_COUNT) || 0;
      const actual48h = parseInt(row.ACTUAL_48H_COUNT) || 0;
      const actual72h = parseInt(row.ACTUAL_72H_COUNT) || 0;
      const actualOver72h = parseInt(row.ACTUAL_OVER72H_COUNT) || 0;
      const actualMeasuredCount = parseInt(row.ACTUAL_MEASURED_COUNT) || 0;
      const avgS2DTime = parseFloat(row.AVG_S2D_TIME) || 0;

      // 🔍 打印第一条匹配的数据，供调试
      if (statsResult.rows.indexOf(row) === 0) {
        console.log('📋 第一条数据解析结果:');
        console.log('   🎯 Plan相关（所有订单）:');
        console.log(`      - planTotalOrders: ${planTotalOrders}`);
        console.log('   📦 Actual相关（基于DELIVERY_TIMES，不限制订单状态）:');
        console.log(`      - totalOrders: ${totalOrders}`);
        console.log(`      - actual24h: ${actual24h}`);
        console.log(`      - actual48h: ${actual48h}`);
        console.log(`      - actual72h: ${actual72h}`);
        console.log(`      - actualOver72h: ${actualOver72h}`);
        console.log(`      - avgS2DTime: ${avgS2DTime}`);
        console.log('   🏷️  分组维度:');
        console.log(`      - brandCode: ${brandCode}`);
        console.log(`      - carrierId: ${carrierId}`);
        console.log(`      - serviceTypeName: ${serviceTypeName || 'N/A'}`);
        console.log(`      - orderTypeName: ${orderTypeName || 'N/A'}`);
        console.log(`      - cityName: ${cityName}`);
        console.log(`      - areaId: ${areaId}`);
      }

      // Plan统计（匹配时效表）
      // ✅ 直接按视图DEST_CITY_NAME匹配SLA City字段
      const { matchKey, matchedTimeValue } = findMatchedTimeliness(
        timelinessMap,
        brandCode,
        carrierId,
        serviceTypeName,
        orderTypeName,
        cityName
      );
      
      // 🔍 打印前3条匹配尝试
      if (statsResult.rows.indexOf(row) < 3) {
        console.log(`🔍 匹配尝试 [${statsResult.rows.indexOf(row) + 1}]: Key="${matchKey || 'N/A'}" → ${matchedTimeValue ? `匹配成功(${matchedTimeValue}h)` : '未匹配'}`);
      }

      if (matchedTimeValue) {
        matchedCount++;
        actualStats.total += actualMeasuredCount;
        actualStats.within24h += actual24h;
        actualStats.within48h += actual48h;
        actualStats.within72h += actual72h;
        actualStats.over72h += actualOver72h;
        if (actualMeasuredCount > 0 && avgS2DTime > 0) {
          totalS2DTime += avgS2DTime * actualMeasuredCount;
          totalS2DCount += actualMeasuredCount;
        }
        achievedOrderCount += getActualWithinPlanCount(
          matchedTimeValue,
          actual24h,
          actual48h,
          actual72h,
          actualOver72h
        );
        
        // ✅ 根据Plan时效值分配到对应区间（使用所有订单数planTotalOrders）
        // 注意：Plan统计使用所有订单，Actual统计基于DELIVERY_TIMES（不限制订单状态）
        if (matchedTimeValue <= 24) {
          planStats.within24h += planTotalOrders;
        } else if (matchedTimeValue <= 48) {
          planStats.within48h += planTotalOrders;
        } else if (matchedTimeValue <= 72) {
          planStats.within72h += planTotalOrders;
        } else {
          planStats.over72h += planTotalOrders;
        }
        planStats.total += planTotalOrders;

        // 🔍 收集匹配记录
        matchedRecords.push({
          brandCode,
          carrierId,
          serviceTypeName,
          orderTypeName,
          cityName,
          areaId,
          planTotalOrders,  // ✅ 改为planTotalOrders
          actualTotalOrders: totalOrders,  // ✅ 新增：Actual订单数
          matchedTimeValue
        });
      } else {
        unmatchedCount++;
        const usesWildcardBrandScope = !exactSlaBrands.has(brandCode);
        const isEcommerceShipment = orderTypeName === '电商发货';

        // 🔍 收集未匹配记录
        unmatchedRecords.push({
          brandCode,
          carrierId,
          serviceTypeName,
          orderTypeName,
          cityName,
          areaId,
          planTotalOrders,  // ✅ 改为planTotalOrders
          actualTotalOrders: totalOrders  // ✅ 新增：Actual订单数
        });
        if (usesWildcardBrandScope && !isEcommerceShipment) {
          return;
        }
      }

      // 按品牌汇总
      if (!byBrandMap.has(brandCode)) {
        byBrandMap.set(brandCode, {
          brandCode,
          planTotal: 0,
          plan24h: 0,
          plan48h: 0,
          plan72h: 0,
          planOver72h: 0,
          actualTotal: 0,
          actual24h: 0,
          actual48h: 0,
          actual72h: 0,
          actualOver72h: 0,
          actualTotalTime: 0,  // ✅ 改名：Actual时效总和
          actualCount: 0,      // ✅ 改名：Actual订单计数
          planTotalTime: 0,    // ✅ Plan时效总和
          planCount: 0         // ✅ Plan订单计数
        });
      }
      const brandData = byBrandMap.get(brandCode);
      if (matchedTimeValue) {
        brandData.planTotal += planTotalOrders;  // ✅ 改为planTotalOrders
        // ✅ 根据Plan时效值分配到对应区间
        if (matchedTimeValue <= 24) {
          brandData.plan24h += planTotalOrders;  // ✅ 改为planTotalOrders
        } else if (matchedTimeValue <= 48) {
          brandData.plan48h += planTotalOrders;  // ✅ 改为planTotalOrders
        } else if (matchedTimeValue <= 72) {
          brandData.plan72h += planTotalOrders;  // ✅ 改为planTotalOrders
        } else {
          brandData.planOver72h += planTotalOrders;  // ✅ 改为planTotalOrders
        }
        // ✅ 累计Plan时效总和（用于计算平均Plan时效）
        brandData.planTotalTime += matchedTimeValue * planTotalOrders;  // ✅ 改为planTotalOrders
        brandData.planCount += planTotalOrders;  // ✅ 改为planTotalOrders
      }
      brandData.actualTotal += totalOrders;
      brandData.actual24h += actual24h;
      brandData.actual48h += actual48h;
      brandData.actual72h += actual72h;
      brandData.actualOver72h += actualOver72h;
      if (totalOrders > 0 && avgS2DTime > 0) {
        // ✅ 累计Actual时效总和（用于计算平均Actual时效）
        brandData.actualTotalTime += avgS2DTime * totalOrders;  // ✅ 改名：actualTotalTime
        brandData.actualCount += totalOrders;                   // ✅ 改名：actualCount
      }

      // 按快递商汇总
      if (!byCourierMap.has(carrierId)) {
        byCourierMap.set(carrierId, {
          carrierId,
          carrierName,
          planTotal: 0,
          plan24h: 0,
          plan48h: 0,
          plan72h: 0,
          planOver72h: 0,
          actualTotal: 0,
          actual24h: 0,
          actual48h: 0,
          actual72h: 0,
          actualOver72h: 0,
          actualTotalTime: 0,  // ✅ 改名：Actual时效总和
          actualCount: 0,      // ✅ 改名：Actual订单计数
          planTotalTime: 0,    // ✅ Plan时效总和
          planCount: 0         // ✅ Plan订单计数
        });
      }
      const courierData = byCourierMap.get(carrierId);
      if (matchedTimeValue) {
        courierData.planTotal += planTotalOrders;  // ✅ 改为planTotalOrders
        // ✅ 根据Plan时效值分配到对应区间
        if (matchedTimeValue <= 24) {
          courierData.plan24h += planTotalOrders;  // ✅ 改为planTotalOrders
        } else if (matchedTimeValue <= 48) {
          courierData.plan48h += planTotalOrders;  // ✅ 改为planTotalOrders
        } else if (matchedTimeValue <= 72) {
          courierData.plan72h += planTotalOrders;  // ✅ 改为planTotalOrders
        } else {
          courierData.planOver72h += planTotalOrders;  // ✅ 改为planTotalOrders
        }
        // ✅ 累计Plan时效总和（用于计算平均Plan时效）
        courierData.planTotalTime += matchedTimeValue * planTotalOrders;  // ✅ 改为planTotalOrders
        courierData.planCount += planTotalOrders;  // ✅ 改为planTotalOrders
      }
      courierData.actualTotal += totalOrders;
      courierData.actual24h += actual24h;
      courierData.actual48h += actual48h;
      courierData.actual72h += actual72h;
      courierData.actualOver72h += actualOver72h;
      if (totalOrders > 0 && avgS2DTime > 0) {
        // ✅ 累计Actual时效总和（用于计算平均Actual时效）
        courierData.actualTotalTime += avgS2DTime * totalOrders;  // ✅ 改名：actualTotalTime
        courierData.actualCount += totalOrders;                   // ✅ 改名：actualCount
      }

      // 按品牌×快递商交叉汇总
      const brandCourierKey = `${brandCode}|${carrierId}`;
      if (!byBrandCourierMap.has(brandCourierKey)) {
        byBrandCourierMap.set(brandCourierKey, {
          brandCode,
          carrierId,
          carrierName,
          planTotal: 0,
          plan24h: 0,
          plan48h: 0,
          plan72h: 0,
          planOver72h: 0,
          actualTotal: 0,
          actual24h: 0,
          actual48h: 0,
          actual72h: 0,
          actualOver72h: 0,
          actualTotalTime: 0,  // ✅ 改名：Actual时效总和
          actualCount: 0,      // ✅ 改名：Actual订单计数
          planTotalTime: 0,    // ✅ Plan时效总和
          planCount: 0         // ✅ Plan订单计数
        });
      }
      const brandCourierData = byBrandCourierMap.get(brandCourierKey);
      if (matchedTimeValue) {
        brandCourierData.planTotal += planTotalOrders;  // ✅ 改为planTotalOrders
        // ✅ 根据Plan时效值分配到对应区间
        if (matchedTimeValue <= 24) {
          brandCourierData.plan24h += planTotalOrders;  // ✅ 改为planTotalOrders
        } else if (matchedTimeValue <= 48) {
          brandCourierData.plan48h += planTotalOrders;  // ✅ 改为planTotalOrders
        } else if (matchedTimeValue <= 72) {
          brandCourierData.plan72h += planTotalOrders;  // ✅ 改为planTotalOrders
        } else {
          brandCourierData.planOver72h += planTotalOrders;  // ✅ 改为planTotalOrders
        }
        // ✅ 累计Plan时效总和（用于计算平均Plan时效）
        brandCourierData.planTotalTime += matchedTimeValue * planTotalOrders;  // ✅ 改为planTotalOrders
        brandCourierData.planCount += planTotalOrders;  // ✅ 改为planTotalOrders
      }
      brandCourierData.actualTotal += totalOrders;
      brandCourierData.actual24h += actual24h;
      brandCourierData.actual48h += actual48h;
      brandCourierData.actual72h += actual72h;
      brandCourierData.actualOver72h += actualOver72h;
      if (totalOrders > 0 && avgS2DTime > 0) {
        // ✅ 累计Actual时效总和（用于计算平均Actual时效）
        brandCourierData.actualTotalTime += avgS2DTime * totalOrders;  // ✅ 改名：actualTotalTime
        brandCourierData.actualCount += totalOrders;                   // ✅ 改名：actualCount
      }
    });

    console.log(`📊 匹配统计: ${matchedCount}个分组匹配成功, ${unmatchedCount}个分组未匹配`);
    console.log(`✅ Plan订单总数: ${planStats.total}`);
    console.log(`✅ Actual订单总数: ${actualStats.total}`);

    // 🔍 打印Plan vs Actual完整对比（前3个匹配记录）
    console.log('\n📊 Plan vs Actual完整对比（前3个匹配记录）:');
    matchedRecords.slice(0, 3).forEach((record, index) => {
      const planTimeValue = record.matchedTimeValue;
      // 根据Plan时效值确定Plan区间分配
      let plan24h = 0, plan48h = 0, plan72h = 0, planOver72h = 0;
      if (planTimeValue <= 24) {
        plan24h = record.planTotalOrders;
      } else if (planTimeValue <= 48) {
        plan48h = record.planTotalOrders;
      } else if (planTimeValue <= 72) {
        plan72h = record.planTotalOrders;
      } else {
        planOver72h = record.planTotalOrders;
      }
      
      console.log(`  [${index + 1}] ${record.brandCode} × ${record.carrierId} × ${record.cityName}`);
      console.log(`      🎯 Plan时效: ${planTimeValue}h`);
      console.log(`      📦 Plan区间分配: ≤24h=${plan24h}, ≤48h=${plan48h}, ≤72h=${plan72h}, >72h=${planOver72h}`);
      console.log(`      ✅ Actual订单: ${record.actualTotalOrders}`);
      console.log('');
    });

    // 🔍 打印全局Plan vs Actual四个时效区间对比
    console.log('📊 全局Plan vs Actual四个时效区间对比:');
    console.log(`   🎯 Plan区间:`);
    console.log(`      - ≤24h: ${planStats.within24h}`);
    console.log(`      - ≤48h: ${planStats.within48h}`);
    console.log(`      - ≤72h: ${planStats.within72h}`);
    console.log(`      - >72h: ${planStats.over72h}`);
    console.log(`      - Total: ${planStats.total}`);
    console.log(`   📦 Actual区间:`);
    console.log(`      - ≤24h: ${actualStats.within24h}`);
    console.log(`      - ≤48h: ${actualStats.within48h}`);
    console.log(`      - ≤72h: ${actualStats.within72h}`);
    console.log(`      - >72h: ${actualStats.over72h}`);
    console.log(`      - Total: ${actualStats.total}`);
    console.log('');

    // 🔍 保存匹配详情到文件，供调试分析
    const path = require('path');

    const debugDir = path.join(__dirname, '../../debug');
    
    const debugData = {
      summary: {
        totalGroups: statsResult.rows.length,
        matchedGroups: matchedCount,
        unmatchedGroups: unmatchedCount,
        planTotalOrders: planStats.total,
        actualTotalOrders: actualStats.total,
        analysisTime: new Date().toISOString(),
        filters: {
          dateRange,
          selectedBrand,
          selectedSelfFlag,
          selectedCarrier
        }
      },
      matchedRecords: matchedRecords.sort((a, b) => b.totalOrders - a.totalOrders),
      unmatchedRecords: unmatchedRecords.sort((a, b) => b.totalOrders - a.totalOrders)
    };

    const debugFilePath = saveDebugSnapshot(debugDir, 'matching-details', debugData);
    console.log(`📁 匹配详情已保存到: ${debugFilePath}`);
    console.log(`   - 已匹配记录: ${matchedRecords.length}条`);
    console.log(`   - 未匹配记录: ${unmatchedRecords.length}条`);

    // 计算平均时效
    const avgS2DTime = totalS2DCount > 0 ? (totalS2DTime / totalS2DCount).toFixed(2) : 0;

    // 达成率只比较已匹配SLA且已取得实际时长的订单：Actual <= Plan。
    const achievementRate = actualStats.total > 0
      ? (achievedOrderCount / actualStats.total * 100).toFixed(2)
      : 0;

    // 转换Map为数组
    const byBrand = Array.from(byBrandMap.values()).map(item => ({
      ...item,
      avgS2DTime: item.actualCount > 0 ? parseFloat((item.actualTotalTime / item.actualCount).toFixed(2)) : 0,  // ✅ 改名
      avgPlanTime: item.planCount > 0 ? parseFloat((item.planTotalTime / item.planCount).toFixed(2)) : 0
    }));

    const byCourier = Array.from(byCourierMap.values()).map(item => ({
      ...item,
      avgS2DTime: item.actualCount > 0 ? parseFloat((item.actualTotalTime / item.actualCount).toFixed(2)) : 0,  // ✅ 改名
      avgPlanTime: item.planCount > 0 ? parseFloat((item.planTotalTime / item.planCount).toFixed(2)) : 0
    }));

    const byBrandCourier = Array.from(byBrandCourierMap.values()).map(item => ({
      ...item,
      avgS2DTime: item.actualCount > 0 ? parseFloat((item.actualTotalTime / item.actualCount).toFixed(2)) : 0,  // ✅ 改名
      avgPlanTime: item.planCount > 0 ? parseFloat((item.planTotalTime / item.planCount).toFixed(2)) : 0
    }));

    console.log('\n✅ ========== S2D时效分析完成 ========== ✅\n');
    console.log('📊 最终统计:');
    console.log(`  - Plan订单总数: ${planStats.total}`);
    console.log(`  - Actual订单总数: ${actualStats.total}`);
    console.log(`  - 平均S2D时效: ${avgS2DTime}小时`);
    console.log(`  - 时效达成率: ${achievementRate}%`);
    console.log(`  - 品牌维度: ${byBrand.length}个品牌`);
    console.log(`  - 快递商维度: ${byCourier.length}个快递商`);
    console.log(`  - 品牌×快递商交叉: ${byBrandCourier.length}个组合\n`);
    
    // 🔍 打印交叉统计详情（前5个）
    if (byBrandCourier.length > 0) {
      console.log('📋 品牌×快递商交叉统计（前5个）:');
      byBrandCourier.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.brandCode} × ${item.carrierId}: Plan=${item.planTotal}, Actual=${item.actualTotal}, AvgS2D=${item.avgS2DTime}h, AvgPlan=${item.avgPlanTime}h`);
      });
      console.log('');
    } else {
      console.log('⚠️ 警告: byBrandCourier为空数组！');
    }

    return {
      success: true,
      data: {
        totalS2DOrders: actualStats.total,
        planStats,
        actualStats,
        avgS2DTime: parseFloat(avgS2DTime),
        achievementRate: parseFloat(achievementRate),
        achievedOrderCount,
        byBrand,
        byCourier,
        byBrandCourier
      }
    };

  } catch (error) {
    console.error('❌ S2D时效分析失败:', error);
    throw error;
  }
}

/**
 * C2D时效分析（Customer to Delivery）
 * 从客户付款到签收的时间分析
 * 
 * ✅ 使用 VIEW_TSK_LIST_TASK.CO_PAY_TIME 和 DELIVERY_TIME_C 计算C2D时效
 * 计算公式：(DELIVERY_TIME_C - CO_PAY_TIME) * 24 小时
 */
async function analyzeC2DPerformance(options = {}) {
  try {
    const { 
      dateRange,
      selectedBrand = null,
      selectedPlatform = null,
      selectedSelfFlag = 'Y',
      selectedCarrier = null,
      analysisType = 'C2D',
      userBrands = null  // ✅ 新增：接收用户品牌权限
    } = options;

    console.log('🔍 执行C2D时效分析（文件存储模式）:', {
      dateRange,
      selectedBrand,
      selectedPlatform,
      selectedSelfFlag,
      selectedCarrier,
      userBrands  // ✅ 打印userBrands
    });

    // ✅ 步骤1: 从JSON文件加载时效数据
    console.log('📂 步骤1: 加载时效数据文件...');
    const timelinessFileData = getLatestTimelinessData();
    
    if (!timelinessFileData || !timelinessFileData.data || timelinessFileData.data.length === 0) {
      console.warn('⚠️  未找到时效数据文件');
      console.log('💡 提示：请先上传时效Excel文件（通过 POST /api/upload/timeliness-excel）');
      
      return {
        success: false,
        error: '未找到时效数据',
        message: '请先上传时效Excel文件',
        data: {
          totalC2DOrders: 0,
          planStats: { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 },
          actualStats: { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 },
          avgC2DTime: 0,
          achievementRate: 0,
          byBrand: [],
          byCourier: []
        }
      };
    }

    const timelinessData = timelinessFileData.data;
    console.log(`✅ 成功加载时效数据: ${timelinessData.length}条记录`);
    console.log(`📄 数据来源: ${timelinessFileData.metadata.fileName} (上传时间: ${timelinessFileData.metadata.uploadTime})`);
    
    // 🔍 检查时效文件中包含哪些品牌
    const uniqueBrands = [...new Set(timelinessData.map(item => item.brand))];
    console.log(`🏷️  时效文件中包含的品牌: ${uniqueBrands.join(', ')}`);
    // 🔥 修复：跳过"all"（全部品牌）的检查
    if (selectedBrand && selectedBrand !== 'all' && !uniqueBrands.includes(selectedBrand)) {
      console.warn(`⚠️  警告: 查询品牌"${selectedBrand}"不在时效文件中！`);
      console.warn(`   时效文件仅包含: ${uniqueBrands.join(', ')}`);
    }

    // ✅ 步骤2: 创建时效匹配Map（按城市名匹配 VIEW_TSK_LIST_TASK.DEST_CITY_NAME）
    const timelinessMap = new Map();          // 按城市名匹配: brand|carrier|serviceType|orderType|cityName → timeValue
    const exactSlaBrands = new Set();
    
    timelinessData.forEach(item => {
      const serviceTypeName = item.serviceTypeName || '';
      const orderTypeName = item.orderTypeName || '*';
      if (item.brand && item.brand !== '*') {
        exactSlaBrands.add(item.brand);
      }
      if (item.cityName) {
        const keyByCityName = `${item.brand}|${item.carrier}|${serviceTypeName}|${orderTypeName}|${item.cityName}`;
        timelinessMap.set(keyByCityName, item.timeValue);
      }
    });

    console.log(`✅ 时效匹配索引已建立:`);
    console.log(`   - 按城市名: ${timelinessMap.size}条记录`);

    // ✅ 步骤3: 查询订单数据（不JOIN时效表）
    console.log('\\n📂 步骤3: 查询数据库订单数据...');
    const { executeQuery } = require('../config/database-api.js');
    
    // 解构dateRange
    const startDate = dateRange?.from;
    const endDate = dateRange?.to;
    
    // 构建WHERE条件
    const whereClauses = [];
    const params = {};
    
    // 品牌映射
    const BRAND_MAPPING = {
      'DICKIES': '18405',
      'TNF': '18405-1',
      'ICEBREAKER': '18405-2',
      'VANS': '18405-3',
      'TIMBERLAND': '18405-4'
    };
    
    if (startDate && endDate) {
      whereClauses.push(`t.WMS_OUTBOUND_TIME BETWEEN TO_DATE(:startDate, 'YYYY-MM-DD') AND TO_DATE(:endDate, 'YYYY-MM-DD') + INTERVAL '1' DAY - INTERVAL '1' SECOND`);
      params.startDate = startDate;
      params.endDate = endDate;
    }
    
    // 🔥 修复：品牌筛选逻辑（支持多选、单选、userBrands）- C2D版本
    const brandCode = selectedBrand && !Array.isArray(selectedBrand) ? (BRAND_MAPPING[selectedBrand] || selectedBrand) : null;  // 🔥 品牌代码转换

    if (Array.isArray(selectedBrand) && selectedBrand.length > 0) {
      // 多品牌筛选
      const placeholders = selectedBrand.map((_, index) => `:selectedBrand${index}`).join(', ');
      whereClauses.push(`t.CUSTOMERNO IN (${placeholders})`);
      selectedBrand.forEach((code, index) => {
        params[`selectedBrand${index}`] = code;
      });
      console.log(`[C2D Brand Filter] 多品牌筛选:`, selectedBrand);
    } else if (brandCode && selectedBrand !== 'all') {
      // 单品牌筛选
      whereClauses.push(`t.CUSTOMERNO = :brandCode`);
      params.brandCode = brandCode;
      console.log('[C2D Brand Filter] 单品牌筛选:', brandCode);
    } else if (selectedBrand === 'all' && userBrands && Array.isArray(userBrands) && userBrands.length > 0) {
      // 🔥 新增：当选择"全部品牌"时，使用用户权限范围
      const placeholders = userBrands.map((_, index) => `:userBrand${index}`).join(', ');
      whereClauses.push(`t.CUSTOMERNO IN (${placeholders})`);
      userBrands.forEach((code, index) => {
        params[`userBrand${index}`] = code;
      });
      console.log('🔐 [C2D Brand Filter] 全部品牌 - 基于用户权限 (%d个):', userBrands.length, userBrands);
    } else if (!selectedBrand || selectedBrand === 'all') {
      // 🔥 回退：VF品牌范围（当没有userBrands时）
      whereClauses.push(`t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4')`);
      console.log('[C2D Brand Filter] 全部品牌 - 回退到VF品牌范围（未提供userBrands）');
    }
    
    if (selectedCarrier) {
      whereClauses.push(`t.CARRIERID = :selectedCarrier`);
      params.selectedCarrier = selectedCarrier;
    }

    // 平台筛选（按VIEW平台分类字段，兼容代码/中文名/同义词）
    if (selectedPlatform && selectedPlatform !== 'all') {
      const PLATFORM_MAPPING = {
        tmall: '天猫',
        douyin: '抖音',
        jd: '京东',
        pdd: '拼多多',
        official: '官网/小程序',
        o2o: 'O2O',
        xiaohongshu: '小红书',
        wechat: '微信'
      };

      const aliasToCanonical = {
        tmall: '天猫',
        douyin: '抖音',
        jd: '京东',
        pdd: '拼多多',
        official: '官网/小程序',
        wechat: '微信',
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

      const normalizePlatforms = (value) => {
        if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean).filter(v => v !== 'all');
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed || trimmed === 'all') return [];
          return trimmed.includes(',')
            ? trimmed.split(',').map(v => v.trim()).filter(Boolean).filter(v => v !== 'all')
            : [trimmed];
        }
        return [];
      };

      const normalizeToken = (value) => String(value || '')
        .trim()
        .replace(/／/g, '/')
        .replace(/\s+/g, '')
        .toLowerCase();

      const expandSet = new Set();
      const addPlatformVariant = (value) => {
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

      const requestedPlatforms = normalizePlatforms(selectedPlatform);
      requestedPlatforms.forEach((p) => {
        addPlatformVariant(p);
        addPlatformVariant(PLATFORM_MAPPING[p] || p);
      });

      const normalizedValues = Array.from(expandSet)
        .map((value) => String(value).trim().replace(/／/g, '/'))
        .filter(Boolean);

      if (normalizedValues.length === 1) {
        whereClauses.push(`REPLACE(TRIM(v.PLATFORM_CLASS), '／', '/') = :selectedPlatform0`);
        params.selectedPlatform0 = normalizedValues[0];
      } else if (normalizedValues.length > 1) {
        const placeholders = normalizedValues.map((_, index) => `:selectedPlatform${index}`).join(', ');
        whereClauses.push(`REPLACE(TRIM(v.PLATFORM_CLASS), '／', '/') IN (${placeholders})`);
        normalizedValues.forEach((value, index) => {
          params[`selectedPlatform${index}`] = value;
        });
      }
    }

    // ✅ 排除EMS承运订单
    whereClauses.push(`t.CARRIERID != 'EMS'`);
    
    // ✅ 只分析正常订单（使用VIEW中的DIS_TYPE_NAME）
    whereClauses.push(`v.DIS_TYPE_NAME = '正常'`);
    // ✅ 只统计指定签收状态
    whereClauses.push(`v.DIS_STATUS IN ('93', '95', '100')`);
    
    // ✅ 自管筛选逻辑（修正版）
    if (selectedSelfFlag === 'Y') {
      whereClauses.push(`t.SELF_FLAG = 'Y'`);
    } else if (selectedSelfFlag === 'N') {
      whereClauses.push(`(t.SELF_FLAG IS NULL OR t.SELF_FLAG != 'Y')`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    console.log('📊 SQL查询参数:', { params, whereClause: whereClause.substring(0, 200) + '...' });

    // ✅ 查询订单统计（按品牌+快递商+城市分组）
    // ✅ C2D时效 = (DELIVERY_TIME_C - CO_PAY_TIME) * 24小时
    // 🔥 使用JOIN BAS_COMPANY表动态获取品牌名称
    const coPayTimeExpr = `TO_DATE(v.CO_PAY_TIME, 'YYYY-MM-DD HH24:MI:SS')`;
    const deliveryTimeExpr = `TO_DATE(v.DELIVERY_TIME_C, 'YYYY-MM-DD HH24:MI:SS')`;
    const c2dHoursExpr = `(${deliveryTimeExpr} - ${coPayTimeExpr}) * 24`;

    const statsQuery = `
      SELECT 
        bc.COMPANY_ABNAME as BRAND_CODE,
        t.CARRIERID,
        bc_carrier.COMPANY_ABNAME as CARRIER_NAME,
        v.TRSERVICE_TYPE_NAME as SERVICE_TYPE_NAME,
        v.ORDER_TYPE_NAME as ORDER_TYPE_NAME,
        v.DEST_CITY_NAME as CITY_NAME,
        t.DEST_CITY as AREA_ID,
        
        -- ✅ Plan统计：所有订单（不限制状态，用于Plan时效统计）
        COUNT(*) as PLAN_TOTAL_ORDERS,
        
        -- ✅ C2D Actual统计：总数不做限制（与Plan一致）
           -- C2D时效 = (DELIVERY_TIME_C - CO_PAY_TIME) * 24小时
        COUNT(*) as TOTAL_C2D_ORDERS,
           COUNT(CASE WHEN v.CO_PAY_TIME IS NOT NULL
             AND v.DELIVERY_TIME_C IS NOT NULL
             AND ${deliveryTimeExpr} >= ${coPayTimeExpr} THEN 1 END) as ACTUAL_MEASURED_COUNT,
        
           COUNT(CASE WHEN v.CO_PAY_TIME IS NOT NULL 
             AND v.DELIVERY_TIME_C IS NOT NULL 
             AND ${deliveryTimeExpr} >= ${coPayTimeExpr}
             AND ${c2dHoursExpr} <= 24 THEN 1 END) as ACTUAL_24H_COUNT,
        
           COUNT(CASE WHEN v.CO_PAY_TIME IS NOT NULL 
             AND v.DELIVERY_TIME_C IS NOT NULL 
             AND ${deliveryTimeExpr} >= ${coPayTimeExpr}
             AND ${c2dHoursExpr} > 24 
             AND ${c2dHoursExpr} <= 48 THEN 1 END) as ACTUAL_48H_COUNT,
        
           COUNT(CASE WHEN v.CO_PAY_TIME IS NOT NULL 
             AND v.DELIVERY_TIME_C IS NOT NULL 
             AND ${deliveryTimeExpr} >= ${coPayTimeExpr}
             AND ${c2dHoursExpr} > 48 
             AND ${c2dHoursExpr} <= 72 THEN 1 END) as ACTUAL_72H_COUNT,
        
           COUNT(CASE WHEN v.CO_PAY_TIME IS NOT NULL 
             AND v.DELIVERY_TIME_C IS NOT NULL 
             AND ${deliveryTimeExpr} >= ${coPayTimeExpr}
             AND ${c2dHoursExpr} > 72 THEN 1 END) as ACTUAL_OVER72H_COUNT,
        
           AVG(CASE WHEN v.CO_PAY_TIME IS NOT NULL 
           AND v.DELIVERY_TIME_C IS NOT NULL 
           AND ${deliveryTimeExpr} >= ${coPayTimeExpr}
           AND ${c2dHoursExpr} <= 1000 
           THEN ${c2dHoursExpr} END) as AVG_C2D_TIME
        
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.VIEW_TSK_LIST_TASK v ON t.TSK_MERGE_NO = v.TSK_MERGE_NO
      LEFT JOIN APP_CMS.BAS_AREA ba ON t.DEST_CITY = ba.AREA_ID
      LEFT JOIN APP_CMS.BAS_COMPANY bc ON t.CUSTOMERNO = bc.COMPANY_SYSID
      LEFT JOIN APP_CMS.BAS_COMPANY bc_carrier ON t.CARRIERID = bc_carrier.COMPANY_SYSID
      ${whereClause}
      GROUP BY 
        bc.COMPANY_ABNAME,
        t.CARRIERID,
        bc_carrier.COMPANY_ABNAME,
        v.TRSERVICE_TYPE_NAME,
        v.ORDER_TYPE_NAME,
        v.DEST_CITY_NAME, 
        t.DEST_CITY
      ORDER BY TOTAL_C2D_ORDERS DESC
    `;

    const statsResult = await executeQuery(statsQuery, params);
    
    if (!statsResult || !statsResult.rows || statsResult.rows.length === 0) {
      console.warn('⚠️  查询结果为空');
      return {
        success: false,
        error: '查询结果为空',
        message: '未找到符合条件的订单数据',
        data: {
          totalC2DOrders: 0,
          planStats: { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 },
          actualStats: { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 },
          avgC2DTime: 0,
          achievementRate: 0,
          byBrand: [],
          byCourier: []
        }
      };
    }

    console.log(`✅ 查询成功，共 ${statsResult.rows.length} 个分组记录`);

    // 🔍 打印前3条查询结果，用于调试字段名
    console.log('\\n📋 查询结果样本（前3条）:');
    statsResult.rows.slice(0, 3).forEach((row, index) => {
      console.log(`  [${index + 1}]`, JSON.stringify(row, null, 2));
    });
    console.log('');

    // ✅ 步骤4: 在应用层处理订单数据并匹配Plan时效...
    console.log('\\n📂 步骤4: 在应用层处理订单数据并匹配Plan时效...');
    
    const planStats = { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 };
    const actualStats = { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 };
    const byBrandMap = new Map();
    const byCourierMap = new Map();
    const byBrandCourierMap = new Map();

    let totalC2DTime = 0;  // ✅ 改为C2D
    let totalC2DCount = 0; // ✅ 改为C2D
    let achievedOrderCount = 0;

    let matchedCount = 0;
    let unmatchedCount = 0;

    // 🔍 收集匹配详情，用于调试分析
    const matchedRecords = [];
    const unmatchedRecords = [];

    statsResult.rows.forEach(row => {
      const brandCode = row.BRAND_CODE;
      const carrierId = row.CARRIERID;
      const carrierName = row.CARRIER_NAME || carrierId;
      const serviceTypeName = row.SERVICE_TYPE_NAME || '';
      const orderTypeName = row.ORDER_TYPE_NAME || '';
      const cityName = row.CITY_NAME;
      const areaId = row.AREA_ID;
      
      const planTotalOrders = parseInt(row.PLAN_TOTAL_ORDERS) || 0;
      const totalOrders = parseInt(row.TOTAL_C2D_ORDERS) || 0;  // ✅ 改为C2D
      const actual24h = parseInt(row.ACTUAL_24H_COUNT) || 0;
      const actual48h = parseInt(row.ACTUAL_48H_COUNT) || 0;
      const actual72h = parseInt(row.ACTUAL_72H_COUNT) || 0;
      const actualOver72h = parseInt(row.ACTUAL_OVER72H_COUNT) || 0;
      const actualMeasuredCount = parseInt(row.ACTUAL_MEASURED_COUNT) || 0;
      const avgC2DTime = parseFloat(row.AVG_C2D_TIME) || 0;  // ✅ 改为C2D

      // 🔍 打印第一条匹配的数据，供调试
      if (statsResult.rows.indexOf(row) === 0) {
        console.log('📋 第一条数据解析结果:');
        console.log('   🎯 Plan相关（所有订单）:');
        console.log(`      - planTotalOrders: ${planTotalOrders}`);
        console.log('   📦 C2D Actual相关（基于付款+签收时间，不限制订单状态）:');
        console.log(`      - totalOrders: ${totalOrders}`);
        console.log(`      - actual24h: ${actual24h}`);
        console.log(`      - actual48h: ${actual48h}`);
        console.log(`      - actual72h: ${actual72h}`);
        console.log(`      - actualOver72h: ${actualOver72h}`);
        console.log(`      - avgC2DTime: ${avgC2DTime}`);  // ✅ 改为C2D
        console.log('   🏷️  分组维度:');
        console.log(`      - brandCode: ${brandCode}`);
        console.log(`      - carrierId: ${carrierId}`);
        console.log(`      - serviceTypeName: ${serviceTypeName || 'N/A'}`);
        console.log(`      - orderTypeName: ${orderTypeName || 'N/A'}`);
        console.log(`      - cityName: ${cityName}`);
        console.log(`      - areaId: ${areaId}`);
      }

      // Plan统计（匹配时效表）
      // ✅ 直接按视图DEST_CITY_NAME匹配SLA City字段
      const { matchKey, matchedTimeValue } = findMatchedTimeliness(
        timelinessMap,
        brandCode,
        carrierId,
        serviceTypeName,
        orderTypeName,
        cityName
      );
      
      if (statsResult.rows.indexOf(row) < 3) {
        console.log(`🔍 匹配尝试 [${statsResult.rows.indexOf(row) + 1}]: Key="${matchKey || 'N/A'}" → ${matchedTimeValue ? `匹配成功(${matchedTimeValue}h)` : '未匹配'}`);
      }

      if (matchedTimeValue) {
        matchedCount++;
        actualStats.total += actualMeasuredCount;
        actualStats.within24h += actual24h;
        actualStats.within48h += actual48h;
        actualStats.within72h += actual72h;
        actualStats.over72h += actualOver72h;
        if (actualMeasuredCount > 0 && avgC2DTime > 0) {
          totalC2DTime += avgC2DTime * actualMeasuredCount;
          totalC2DCount += actualMeasuredCount;
        }
        achievedOrderCount += getActualWithinPlanCount(
          matchedTimeValue,
          actual24h,
          actual48h,
          actual72h,
          actualOver72h
        );
        
        if (matchedTimeValue <= 24) {
          planStats.within24h += planTotalOrders;
        } else if (matchedTimeValue <= 48) {
          planStats.within48h += planTotalOrders;
        } else if (matchedTimeValue <= 72) {
          planStats.within72h += planTotalOrders;
        } else {
          planStats.over72h += planTotalOrders;
        }
        planStats.total += planTotalOrders;

        matchedRecords.push({
          brandCode,
          carrierId,
          serviceTypeName,
          orderTypeName,
          cityName,
          areaId,
          planTotalOrders,
          actualTotalOrders: totalOrders,
          matchedTimeValue
        });
      } else {
        unmatchedCount++;
        const usesWildcardBrandScope = !exactSlaBrands.has(brandCode);
        const isEcommerceShipment = orderTypeName === '电商发货';
        unmatchedRecords.push({
          brandCode,
          carrierId,
          serviceTypeName,
          orderTypeName,
          cityName,
          areaId,
          planTotalOrders,
          actualTotalOrders: totalOrders
        });
        if (usesWildcardBrandScope && !isEcommerceShipment) {
          return;
        }
      }

      // 按品牌汇总
      if (!byBrandMap.has(brandCode)) {
        byBrandMap.set(brandCode, {
          brandCode,
          planTotal: 0,
          plan24h: 0,
          plan48h: 0,
          plan72h: 0,
          planOver72h: 0,
          actualTotal: 0,
          actual24h: 0,
          actual48h: 0,
          actual72h: 0,
          actualOver72h: 0,
          actualTotalTime: 0,
          actualCount: 0,
          planTotalTime: 0,
          planCount: 0
        });
      }
      const brandData = byBrandMap.get(brandCode);
      if (matchedTimeValue) {
        brandData.planTotal += planTotalOrders;
        if (matchedTimeValue <= 24) {
          brandData.plan24h += planTotalOrders;
        } else if (matchedTimeValue <= 48) {
          brandData.plan48h += planTotalOrders;
        } else if (matchedTimeValue <= 72) {
          brandData.plan72h += planTotalOrders;
        } else {
          brandData.planOver72h += planTotalOrders;
        }
        brandData.planTotalTime += matchedTimeValue * planTotalOrders;
        brandData.planCount += planTotalOrders;
      }
      brandData.actualTotal += totalOrders;
      brandData.actual24h += actual24h;
      brandData.actual48h += actual48h;
      brandData.actual72h += actual72h;
      brandData.actualOver72h += actualOver72h;
      if (totalOrders > 0 && avgC2DTime > 0) {  // ✅ 改为C2D
        brandData.actualTotalTime += avgC2DTime * totalOrders;  // ✅ 改为C2D
        brandData.actualCount += totalOrders;
      }

      // 按快递商汇总
      if (!byCourierMap.has(carrierId)) {
        byCourierMap.set(carrierId, {
          carrierId,
          carrierName,
          planTotal: 0,
          plan24h: 0,
          plan48h: 0,
          plan72h: 0,
          planOver72h: 0,
          actualTotal: 0,
          actual24h: 0,
          actual48h: 0,
          actual72h: 0,
          actualOver72h: 0,
          actualTotalTime: 0,
          actualCount: 0,
          planTotalTime: 0,
          planCount: 0
        });
      }
      const courierData = byCourierMap.get(carrierId);
      if (matchedTimeValue) {
        courierData.planTotal += planTotalOrders;
        if (matchedTimeValue <= 24) {
          courierData.plan24h += planTotalOrders;
        } else if (matchedTimeValue <= 48) {
          courierData.plan48h += planTotalOrders;
        } else if (matchedTimeValue <= 72) {
          courierData.plan72h += planTotalOrders;
        } else {
          courierData.planOver72h += planTotalOrders;
        }
        courierData.planTotalTime += matchedTimeValue * planTotalOrders;
        courierData.planCount += planTotalOrders;
      }
      courierData.actualTotal += totalOrders;
      courierData.actual24h += actual24h;
      courierData.actual48h += actual48h;
      courierData.actual72h += actual72h;
      courierData.actualOver72h += actualOver72h;
      if (totalOrders > 0 && avgC2DTime > 0) {  // ✅ 改为C2D
        courierData.actualTotalTime += avgC2DTime * totalOrders;  // ✅ 改为C2D
        courierData.actualCount += totalOrders;
      }

      // 按品牌×快递商交叉汇总
      const brandCourierKey = `${brandCode}|${carrierId}`;
      if (!byBrandCourierMap.has(brandCourierKey)) {
        byBrandCourierMap.set(brandCourierKey, {
          brandCode,
          carrierId,
          carrierName,
          planTotal: 0,
          plan24h: 0,
          plan48h: 0,
          plan72h: 0,
          planOver72h: 0,
          actualTotal: 0,
          actual24h: 0,
          actual48h: 0,
          actual72h: 0,
          actualOver72h: 0,
          actualTotalTime: 0,
          actualCount: 0,
          planTotalTime: 0,
          planCount: 0
        });
      }
      const brandCourierData = byBrandCourierMap.get(brandCourierKey);
      if (matchedTimeValue) {
        brandCourierData.planTotal += planTotalOrders;
        if (matchedTimeValue <= 24) {
          brandCourierData.plan24h += planTotalOrders;
        } else if (matchedTimeValue <= 48) {
          brandCourierData.plan48h += planTotalOrders;
        } else if (matchedTimeValue <= 72) {
          brandCourierData.plan72h += planTotalOrders;
        } else {
          brandCourierData.planOver72h += planTotalOrders;
        }
        brandCourierData.planTotalTime += matchedTimeValue * planTotalOrders;
        brandCourierData.planCount += planTotalOrders;
      }
      brandCourierData.actualTotal += totalOrders;
      brandCourierData.actual24h += actual24h;
      brandCourierData.actual48h += actual48h;
      brandCourierData.actual72h += actual72h;
      brandCourierData.actualOver72h += actualOver72h;
      if (totalOrders > 0 && avgC2DTime > 0) {  // ✅ 改为C2D
        brandCourierData.actualTotalTime += avgC2DTime * totalOrders;  // ✅ 改为C2D
        brandCourierData.actualCount += totalOrders;
      }
    });

    console.log(`📊 匹配统计: ${matchedCount}个分组匹配成功, ${unmatchedCount}个分组未匹配`);
    console.log(`✅ Plan订单总数: ${planStats.total}`);
    console.log(`✅ Actual订单总数: ${actualStats.total}`);

    console.log('\\n📊 Plan vs Actual完整对比（前3个匹配记录）:');
    matchedRecords.slice(0, 3).forEach((record, index) => {
      const planTimeValue = record.matchedTimeValue;
      let plan24h = 0, plan48h = 0, plan72h = 0, planOver72h = 0;
      if (planTimeValue <= 24) {
        plan24h = record.planTotalOrders;
      } else if (planTimeValue <= 48) {
        plan48h = record.planTotalOrders;
      } else if (planTimeValue <= 72) {
        plan72h = record.planTotalOrders;
      } else {
        planOver72h = record.planTotalOrders;
      }
      
      console.log(`  [${index + 1}] ${record.brandCode} × ${record.carrierId} × ${record.cityName}`);
      console.log(`      🎯 Plan时效: ${planTimeValue}h`);
      console.log(`      📦 Plan区间分配: ≤24h=${plan24h}, ≤48h=${plan48h}, ≤72h=${plan72h}, >72h=${planOver72h}`);
      console.log(`      ✅ Actual已签收订单: ${record.actualTotalOrders}`);
      console.log('');
    });

    console.log('📊 全局Plan vs Actual四个时效区间对比:');
    console.log(`   🎯 Plan区间:`);
    console.log(`      - ≤24h: ${planStats.within24h}`);
    console.log(`      - ≤48h: ${planStats.within48h}`);
    console.log(`      - ≤72h: ${planStats.within72h}`);
    console.log(`      - >72h: ${planStats.over72h}`);
    console.log(`      - Total: ${planStats.total}`);
    console.log(`   📦 Actual区间:`);
    console.log(`      - ≤24h: ${actualStats.within24h}`);
    console.log(`      - ≤48h: ${actualStats.within48h}`);
    console.log(`      - ≤72h: ${actualStats.within72h}`);
    console.log(`      - >72h: ${actualStats.over72h}`);
    console.log(`      - Total: ${actualStats.total}`);
    console.log('');

    // 🔍 保存匹配详情到文件
    const path = require('path');

    const debugDir = path.join(__dirname, '../../debug');
    
    const debugData = {
      summary: {
        totalGroups: statsResult.rows.length,
        matchedGroups: matchedCount,
        unmatchedGroups: unmatchedCount,
        planTotalOrders: planStats.total,
        actualTotalOrders: actualStats.total,
        analysisTime: new Date().toISOString(),
        analysisType: 'C2D',
        filters: {
          dateRange,
          selectedBrand,
          selectedSelfFlag,
          selectedCarrier
        }
      },
      matchedRecords: matchedRecords.sort((a, b) => b.actualTotalOrders - a.actualTotalOrders),
      unmatchedRecords: unmatchedRecords.sort((a, b) => b.actualTotalOrders - a.actualTotalOrders)
    };

    const debugFilePath = saveDebugSnapshot(debugDir, 'c2d-matching-details', debugData);
    console.log(`📁 C2D匹配详情已保存到: ${debugFilePath}`);
    console.log(`   - 已匹配记录: ${matchedRecords.length}条`);
    console.log(`   - 未匹配记录: ${unmatchedRecords.length}条`);

    // 计算平均时效
    const avgC2DTime = totalC2DCount > 0 ? (totalC2DTime / totalC2DCount).toFixed(2) : 0;  // ✅ 改为C2D

    // 计算时效达成率
    const achievementRate = actualStats.total > 0
      ? (achievedOrderCount / actualStats.total * 100).toFixed(2)
      : 0;

    // 转换Map为数组
    const byBrand = Array.from(byBrandMap.values()).map(item => ({
      ...item,
      avgC2DTime: item.actualCount > 0 ? parseFloat((item.actualTotalTime / item.actualCount).toFixed(2)) : 0,  // ✅ 改为C2D
      avgPlanTime: item.planCount > 0 ? parseFloat((item.planTotalTime / item.planCount).toFixed(2)) : 0
    }));

    const byCourier = Array.from(byCourierMap.values()).map(item => ({
      ...item,
      avgC2DTime: item.actualCount > 0 ? parseFloat((item.actualTotalTime / item.actualCount).toFixed(2)) : 0,  // ✅ 改为C2D
      avgPlanTime: item.planCount > 0 ? parseFloat((item.planTotalTime / item.planCount).toFixed(2)) : 0
    }));

    const byBrandCourier = Array.from(byBrandCourierMap.values()).map(item => ({
      ...item,
      avgC2DTime: item.actualCount > 0 ? parseFloat((item.actualTotalTime / item.actualCount).toFixed(2)) : 0,  // ✅ 改为C2D
      avgPlanTime: item.planCount > 0 ? parseFloat((item.planTotalTime / item.planCount).toFixed(2)) : 0
    }));

    console.log('\\n✅ ========== C2D时效分析完成 ========== ✅\\n');
    console.log('📊 最终统计:');
    console.log(`  - Plan订单总数: ${planStats.total}`);
    console.log(`  - Actual订单总数: ${actualStats.total}`);
    console.log(`  - 平均C2D时效: ${avgC2DTime}小时`);  // ✅ 改为C2D
    console.log(`  - 时效达成率: ${achievementRate}%`);
    console.log(`  - 品牌维度: ${byBrand.length}个品牌`);
    console.log(`  - 快递商维度: ${byCourier.length}个快递商`);
    console.log(`  - 品牌×快递商交叉: ${byBrandCourier.length}个组合\\n`);
    
    if (byBrandCourier.length > 0) {
      console.log('📋 品牌×快递商交叉统计（前5个）:');
      byBrandCourier.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.brandCode} × ${item.carrierId}: Plan=${item.planTotal}, Actual=${item.actualTotal}, AvgC2D=${item.avgC2DTime}h, AvgPlan=${item.avgPlanTime}h`);  // ✅ 改为C2D
      });
      console.log('');
    } else {
      console.log('⚠️ 警告: byBrandCourier为空数组！');
    }

    return {
      success: true,
      data: {
        totalC2DOrders: actualStats.total,  // ✅ 改为C2D
        planStats,
        actualStats,
        avgC2DTime: parseFloat(avgC2DTime),  // ✅ 改为C2D
        achievementRate: parseFloat(achievementRate),
        achievedOrderCount,
        byBrand,
        byCourier,
        byBrandCourier
      }
    };

  } catch (error) {
    console.error('❌ C2D时效分析失败:', error);
    throw error;
  }
}


module.exports = {
  analyzeTimelinessPerformance
};