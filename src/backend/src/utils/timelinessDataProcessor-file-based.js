/**
 * S2D时效分析（Ship to Delivery）
 * 对比Plan时效目标 vs Actual实际表现
 * 
 * @param {Object} options - 分析参数
 * @param {Array} options.dateRange - 日期范围 [startDate, endDate]
 * @param {String} options.selectedBrand - 品牌筛选
 * @param {String} options.selectedCarrier - 快递商筛选
 * @param {String} options.analysisType - 分析类型: 'S2D', 'C2D', 'both'
 * @returns {Promise<Object>} 分析结果
 */
export async function analyzeTimelinessPerformance(options = {}) {
  try {
    console.log('\n🔥🔥🔥 ========== S2D时效分析开始 (file-based.js) ========== 🔥🔥🔥\n');
    
    const { 
      dateRange,
      selectedBrand = null,
      selectedCarrier = null,
      analysisType = 'S2D',
      userBrands = null // 🔥 新增：接收用户品牌权限
    } = options;
    
    // 🔥 品牌名称 → 品牌代码映射
    const BRAND_NAME_TO_CODE = {
      'DICKIES': '18405',
      'TNF': '18405-1',
      'ICEBREAKER': '18405-2',
      'VANS': '18405-3',
      'TIMBERLAND': '18405-4',
      'SMARTWOOL': '18405-5'
    };
    
    // 🔥 将品牌名称转换为品牌代码
    let brandCode = null;
    if (selectedBrand && selectedBrand !== 'all') {
      brandCode = BRAND_NAME_TO_CODE[selectedBrand] || selectedBrand;
      console.log(`🔄 品牌名称转换: "${selectedBrand}" → 品牌代码 "${brandCode}"`);
    }

    console.log('🔍 开始S2D时效分析（文件存储模式）:', {
      dateRange,
      selectedBrand,
      brandCode, // 🔥 新增日志
      selectedCarrier,
      analysisType,
      userBrands // 🔥 新增日志
    });

    // ✅ 步骤1: 从JSON文件加载时效数据
    console.log('📂 加载时效数据...');
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

    // ✅ 步骤2: 构建时效匹配索引（品牌+快递商+城市 → Plan时效值）
    const timelinessMap = new Map();
    const timelinessMapByAreaId = new Map();
    
    timelinessData.forEach(item => {
      // 按城市名称匹配
      if (item.cityName) {
        const key = `${item.brand}|${item.carrier}|${item.cityName}`;
        timelinessMap.set(key, item.timeValue);
      }
      // 按区域ID匹配（备选）
      if (item.areaId) {
        const keyById = `${item.brand}|${item.carrier}|${item.areaId}`;
        timelinessMapByAreaId.set(keyById, item.timeValue);
      }
    });

    console.log(`🗺️  构建时效匹配索引: ${timelinessMap.size}个映射（按城市名）+ ${timelinessMapByAreaId.size}个映射（按区域ID）`);

    // 🔍 打印前10个时效匹配键，供调试
    console.log('\n📋 时效匹配索引样本（前10个）:');
    let sampleCount = 0;
    for (const [key, value] of timelinessMap) {
      if (sampleCount < 10) {
        console.log(`  [${sampleCount + 1}] Key: "${key}" → Value: ${value}h`);
        sampleCount++;
      } else {
        break;
      }
    }
    console.log('');

    // ✅ 步骤3: 查询订单数据（不JOIN时效表）
    const { executeQuery } = await import('../config/database.js');
    
    const [startDate, endDate] = dateRange || [];
    
    // 构建WHERE条件
    const whereClauses = [];
    const params = {};
    
    if (startDate && endDate) {
      whereClauses.push(`t.WMS_OUTBOUND_TIME BETWEEN TO_DATE(:startDate, 'YYYY-MM-DD') AND TO_DATE(:endDate, 'YYYY-MM-DD') + INTERVAL '1' DAY - INTERVAL '1' SECOND`);
      params.startDate = startDate;
      params.endDate = endDate;
    }
    
    // 🔥 修复：品牌筛选逻辑（支持userBrands）
    if (brandCode) {
      // 单个品牌筛选
      whereClauses.push(`t.BRAND_CODE = :brandCode`);
      params.brandCode = brandCode;
      console.log(`🏷️ [Brand Filter] 单品牌筛选: ${brandCode}`);
    } else if (selectedBrand === 'all' && userBrands && Array.isArray(userBrands) && userBrands.length > 0) {
      // 🔥 新增：当选择"全部品牌"时，使用用户权限范围
      const placeholders = userBrands.map((_, index) => `:userBrand${index}`).join(', ');
      whereClauses.push(`t.BRAND_CODE IN (${placeholders})`);
      
      userBrands.forEach((code, index) => {
        params[`userBrand${index}`] = code;
      });
      
      console.log(`🔐 [Brand Filter] 全部品牌 - 基于用户权限 (${userBrands.length}个):`, userBrands);
    } else {
      // 🔥 回退：VF品牌范围（当没有userBrands时）
      whereClauses.push(`t.BRAND_CODE IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')`);
      console.log(`🏷️ [Brand Filter] 全部品牌 - 回退到VF品牌范围（未提供userBrands）`);
    }
    
    if (selectedCarrier) {
      whereClauses.push(`t.CARRIERID = :selectedCarrier`);
      params.selectedCarrier = selectedCarrier;
    }

    // ✅ 排除EMS承运订单和退货订单
    whereClauses.push(`t.CARRIERID != 'EMS'`);
    whereClauses.push(`(t.SELF_FLAG IS NULL OR t.SELF_FLAG != 'Y')`);

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    console.log('📊 查询订单数据...');
    
    // 查询订单统计（按品牌+快递商+城市分组）
    const statsQuery = `
      SELECT 
        t.BRAND_CODE,
        t.CARRIERID,
        ba.AREA_NAME as CITY_NAME,
        t.DEST_CITY as AREA_ID,
        
        -- Actual统计：只统计已签收订单（DIS_STATUS='95'）
        COUNT(CASE WHEN t.DIS_STATUS = '95' 
                   AND t.SUM_SEND_TIME2 IS NOT NULL 
                   AND t.SUM_SEND_TIME2 >= 0 THEN 1 END) as TOTAL_S2D_ORDERS,
        
        COUNT(CASE WHEN t.DIS_STATUS = '95' 
                   AND t.SUM_SEND_TIME2 IS NOT NULL 
                   AND t.SUM_SEND_TIME2 >= 0
                   AND t.SUM_SEND_TIME2 <= 24 THEN 1 END) as ACTUAL_24H_COUNT,
        
        COUNT(CASE WHEN t.DIS_STATUS = '95' 
                   AND t.SUM_SEND_TIME2 IS NOT NULL 
                   AND t.SUM_SEND_TIME2 > 24 
                   AND t.SUM_SEND_TIME2 <= 48 THEN 1 END) as ACTUAL_48H_COUNT,
        
        COUNT(CASE WHEN t.DIS_STATUS = '95' 
                   AND t.SUM_SEND_TIME2 IS NOT NULL 
                   AND t.SUM_SEND_TIME2 > 48 
                   AND t.SUM_SEND_TIME2 <= 72 THEN 1 END) as ACTUAL_72H_COUNT,
        
        COUNT(CASE WHEN t.DIS_STATUS = '95' 
                   AND t.SUM_SEND_TIME2 IS NOT NULL 
                   AND t.SUM_SEND_TIME2 > 72 THEN 1 END) as ACTUAL_OVER_72H_COUNT,
        
        -- 平均时效（只统计已签收订单）
        AVG(CASE WHEN t.DIS_STATUS = '95' 
                 AND t.SUM_SEND_TIME2 IS NOT NULL 
                 AND t.SUM_SEND_TIME2 >= 0 THEN t.SUM_SEND_TIME2 END) as AVG_S2D_TIME,
        
        -- 总订单数（用于Plan统计）
        COUNT(*) as TOTAL_ORDERS
        
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_AREA ba ON t.DEST_CITY = ba.AREA_ID
      ${whereClause}
      GROUP BY t.BRAND_CODE, t.CARRIERID, ba.AREA_NAME, t.DEST_CITY
      ORDER BY TOTAL_S2D_ORDERS DESC
    `;

    const statsResult = await executeQuery(statsQuery, params);
    
    if (!statsResult.rows || statsResult.rows.length === 0) {
      console.log('⚠️  查询结果为空');
      return {
        success: true,
        data: {
          totalS2DOrders: 0,
          planStats: { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 },
          actualStats: { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 },
          avgS2DTime: 0,
          achievementRate: 0,
          byBrand: [],
          byCourier: [],
          rawOrders: []  // ✅ 新增：原始订单数据
        }
      };
    }

    console.log(`✅ 查询到${statsResult.rows.length}个分组统计`);

    // 🔥 新增：查询原始订单数据（用于前端订单明细查看）
    console.log('📋 查询原始订单数据...');
    const rawOrdersQuery = `
      SELECT 
        t.TSK_MERGE_NO as order_no,
        t.TRACKING_NO as tracking_no,
        t.BRAND_CODE as customerno,
        t.CARRIERID as carrierid,
        ba.AREA_NAME as dest_province,
        t.DEST_CITY as dest_city,
        TO_CHAR(t.SEND_TIME, 'YYYY-MM-DD HH24:MI:SS') as send_time,
        TO_CHAR(t.SIGN_TIME, 'YYYY-MM-DD HH24:MI:SS') as sign_time,
        t.SUM_SEND_TIME2 as sum_send_time2,
        t.SUM_CREATE_TIME2 as sum_create_time2,
        NULL as plan_timeliness_hours
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_AREA ba ON t.DEST_CITY = ba.AREA_ID
      ${whereClause}
      AND t.DIS_STATUS = '95'
      AND t.SUM_SEND_TIME2 IS NOT NULL
      AND t.SUM_SEND_TIME2 >= 0
      ORDER BY t.SEND_TIME DESC
    `;

    const rawOrdersResult = await executeQuery(rawOrdersQuery, params);
    const rawOrdersRaw = rawOrdersResult.rows || [];
    
    // 🔥 转换字段名为小写（Oracle返回大写，前端需要小写）
    const rawOrders = rawOrdersRaw.map(order => ({
      order_no: order.ORDER_NO,
      tracking_no: order.TRACKING_NO,
      customerno: order.CUSTOMERNO,
      carrierid: order.CARRIERID,
      dest_province: order.DEST_PROVINCE,
      dest_city: order.DEST_CITY,
      send_time: order.SEND_TIME,
      sign_time: order.SIGN_TIME,
      sum_send_time2: order.SUM_SEND_TIME2,
      sum_create_time2: order.SUM_CREATE_TIME2,
      plan_timeliness_hours: null  // 后续匹配
    }));
    
    // 🔥 为每个订单匹配Plan时效
    rawOrders.forEach(order => {
      const matchKey = `${order.customerno}|${order.carrierid}|${order.dest_province}`;
      const matchKeyById = `${order.customerno}|${order.carrierid}|${order.dest_city}`;
      const planHours = timelinessMap.get(matchKey) || timelinessMapByAreaId.get(matchKeyById);
      order.plan_timeliness_hours = planHours || null;
    });
    
    console.log(`✅ 查询到${rawOrders.length}条原始订单数据`);
    
    // 🔍 打印前3条订单样本，供调试
    if (rawOrders.length > 0) {
      console.log('\\n📋 原始订单样本（前3条）:');
      rawOrders.slice(0, 3).forEach((order, index) => {
        console.log(`  [${index + 1}] Order: ${order.order_no} | Carrier: ${order.carrierid} | Brand: ${order.customerno} | S2D: ${order.sum_send_time2}h | Plan: ${order.plan_timeliness_hours}h`);
      });
      console.log('');
    }

    // 🔍 打印前10条数据库查询结果，供调试
    console.log('\n📋 数据库查询结果样本（前10条）:');
    statsResult.rows.slice(0, 10).forEach((row, index) => {
      console.log(`  [${index + 1}] Brand: ${row.BRAND_CODE} | Carrier: ${row.CARRIERID} | City: ${row.CITY_NAME} | AreaID: ${row.AREA_ID} | Orders: ${row.TOTAL_ORDERS}`);
    });
    console.log('');

    //  骤4: 在应用层匹配Plan时效
    const aggregatedStats = {
      totalS2DOrders: 0,
      planStats: { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 },
      actualStats: { total: 0, within24h: 0, within48h: 0, within72h: 0, over72h: 0 },
      totalS2DTime: 0,
      byBrand: new Map(),
      byCourier: new Map(),
      byBrandCourier: new Map()  // 🔥 新增：品牌×快递商交叉统计
    };

    let matchedCount = 0;
    let unmatchedCount = 0;
    const unmatchedSamples = [];

    statsResult.rows.forEach(row => {
      // ✅ 使用字段名访问（因为 outFormat: OUT_FORMAT_OBJECT）
      const brandCode = row.BRAND_CODE;
      const carrierId = row.CARRIERID;
      const cityName = row.CITY_NAME;
      const areaId = row.AREA_ID;
      const totalS2DOrders = parseInt(row.TOTAL_S2D_ORDERS) || 0;
      const actual24h = parseInt(row.ACTUAL_24H_COUNT) || 0;
      const actual48h = parseInt(row.ACTUAL_48H_COUNT) || 0;
      const actual72h = parseInt(row.ACTUAL_72H_COUNT) || 0;
      const actualOver72h = parseInt(row.ACTUAL_OVER_72H_COUNT) || 0;
      const avgS2DTime = parseFloat(row.AVG_S2D_TIME) || 0;
      const totalOrders = parseInt(row.TOTAL_ORDERS) || 0;

      // ✅ 匹配Plan时效值
      const matchKey = `${brandCode}|${carrierId}|${cityName}`;
      const matchKeyById = `${brandCode}|${carrierId}|${areaId}`;
      
      const matchedTimeValue = timelinessMap.get(matchKey) || timelinessMapByAreaId.get(matchKeyById);

      if (matchedTimeValue) {
        // 根据Plan时效值分配到对应区间（使用总订单数）
        if (matchedTimeValue <= 24) {
          aggregatedStats.planStats.within24h += totalOrders;
        } else if (matchedTimeValue <= 48) {
          aggregatedStats.planStats.within48h += totalOrders;
        } else if (matchedTimeValue <= 72) {
          aggregatedStats.planStats.within72h += totalOrders;
        } else {
          aggregatedStats.planStats.over72h += totalOrders;
        }
        aggregatedStats.planStats.total += totalOrders;
        matchedCount++;
      } else {
        unmatchedCount++;
        if (unmatchedSamples.length < 10) {
          unmatchedSamples.push({
            brandCode,
            carrierId,
            cityName,
            areaId,
            totalOrders
          });
        }
      }

      // Actual统计（只统计已签收订单）
      aggregatedStats.totalS2DOrders += totalS2DOrders;
      aggregatedStats.actualStats.within24h += actual24h;
      aggregatedStats.actualStats.within48h += actual48h;
      aggregatedStats.actualStats.within72h += actual72h;
      aggregatedStats.actualStats.over72h += actualOver72h;
      aggregatedStats.actualStats.total += totalS2DOrders;
      
      aggregatedStats.totalS2DTime += avgS2DTime * totalS2DOrders;

      // 按品牌聚合
      if (!aggregatedStats.byBrand.has(brandCode)) {
        aggregatedStats.byBrand.set(brandCode, {
          brandCode,
          totalS2DOrders: 0,
          planCount: 0,
          actualCount: 0,
          actual24h: 0,
          actual48h: 0,
          actual72h: 0,
          actualOver72h: 0,
          plan24h: 0,
          plan48h: 0,
          plan72h: 0,
          planOver72h: 0,
          totalS2DTime: 0  // 🔥 新增：累加总时长
        });
      }
      
      const brandStats = aggregatedStats.byBrand.get(brandCode);
      brandStats.totalS2DOrders += totalS2DOrders;
      brandStats.actualCount += totalS2DOrders;
      brandStats.actual24h += actual24h;
      brandStats.actual48h += actual48h;
      brandStats.actual72h += actual72h;
      brandStats.actualOver72h += actualOver72h;
      brandStats.totalS2DTime += avgS2DTime * totalS2DOrders;  // 🔥 累加时长
      
      if (matchedTimeValue) {
        brandStats.planCount += totalOrders;
        if (matchedTimeValue <= 24) brandStats.plan24h += totalOrders;
        else if (matchedTimeValue <= 48) brandStats.plan48h += totalOrders;
        else if (matchedTimeValue <= 72) brandStats.plan72h += totalOrders;
        else brandStats.planOver72h += totalOrders;
      }

      // 按快递商聚合
      if (!aggregatedStats.byCourier.has(carrierId)) {
        aggregatedStats.byCourier.set(carrierId, {
          carrierId,
          totalS2DOrders: 0,
          planCount: 0,
          actualCount: 0,
          actual24h: 0,
          actual48h: 0,
          actual72h: 0,
          actualOver72h: 0,
          plan24h: 0,
          plan48h: 0,
          plan72h: 0,
          planOver72h: 0,
          totalS2DTime: 0  // 🔥 新增：累加总时长
        });
      }
      
      const courierStats = aggregatedStats.byCourier.get(carrierId);
      courierStats.totalS2DOrders += totalS2DOrders;
      courierStats.actualCount += totalS2DOrders;
      courierStats.actual24h += actual24h;
      courierStats.actual48h += actual48h;
      courierStats.actual72h += actual72h;
      courierStats.actualOver72h += actualOver72h;
      courierStats.totalS2DTime += avgS2DTime * totalS2DOrders;  // 🔥 累加时长
      
      if (matchedTimeValue) {
        courierStats.planCount += totalOrders;
        if (matchedTimeValue <= 24) courierStats.plan24h += totalOrders;
        else if (matchedTimeValue <= 48) courierStats.plan48h += totalOrders;
        else if (matchedTimeValue <= 72) courierStats.plan72h += totalOrders;
        else courierStats.planOver72h += totalOrders;
      }

      // 🔥 新增：品牌×快递商交叉统计
      const brandCourierKey = `${brandCode}|${carrierId}`;
      if (!aggregatedStats.byBrandCourier.has(brandCourierKey)) {
        aggregatedStats.byBrandCourier.set(brandCourierKey, {
          brandCode,
          carrierId,
          totalS2DOrders: 0,
          planCount: 0,
          actualCount: 0,
          actual24h: 0,
          actual48h: 0,
          actual72h: 0,
          actualOver72h: 0,
          plan24h: 0,
          plan48h: 0,
          plan72h: 0,
          planOver72h: 0,
          totalS2DTime: 0  // 🔥 新增：累加总时长
        });
      }
      
      const brandCourierStats = aggregatedStats.byBrandCourier.get(brandCourierKey);
      brandCourierStats.totalS2DOrders += totalS2DOrders;
      brandCourierStats.actualCount += totalS2DOrders;
      brandCourierStats.actual24h += actual24h;
      brandCourierStats.actual48h += actual48h;
      brandCourierStats.actual72h += actual72h;
      brandCourierStats.actualOver72h += actualOver72h;
      brandCourierStats.totalS2DTime += avgS2DTime * totalS2DOrders;  // 🔥 累加时长
      
      if (matchedTimeValue) {
        brandCourierStats.planCount += totalOrders;
        if (matchedTimeValue <= 24) brandCourierStats.plan24h += totalOrders;
        else if (matchedTimeValue <= 48) brandCourierStats.plan48h += totalOrders;
        else if (matchedTimeValue <= 72) brandCourierStats.plan72h += totalOrders;
        else brandCourierStats.planOver72h += totalOrders;
      }
    });

    // 计算平均时效和达成率
    const avgS2DTime = aggregatedStats.totalS2DOrders > 0 
      ? aggregatedStats.totalS2DTime / aggregatedStats.totalS2DOrders 
      : 0;

    const achievementRate = aggregatedStats.planStats.total > 0
      ? (aggregatedStats.actualStats.total / aggregatedStats.planStats.total) * 100
      : 0;

    console.log('📊 分析结果汇总:');
    console.log(`  总S2D订单数（已签收）: ${aggregatedStats.totalS2DOrders}`);
    console.log(`  Plan总订单数: ${aggregatedStats.planStats.total}`);
    console.log(`  Actual总订单数: ${aggregatedStats.actualStats.total}`);
    console.log(`  平均S2D时效: ${avgS2DTime.toFixed(2)}小时`);
    console.log(`  时效达成率: ${achievementRate.toFixed(2)}%`);
    console.log(`\n🔍 Plan时效匹配统计:`);
    console.log(`  匹配成功: ${matchedCount}个分组`);
    console.log(`  匹配失败: ${unmatchedCount}个分组`);
    console.log(`  匹配率: ${((matchedCount / (matchedCount + unmatchedCount)) * 100).toFixed(2)}%`);
    
    if (unmatchedSamples.length > 0) {
      console.log(`\n❌ 未匹配样本（前${unmatchedSamples.length}个）:`);
      unmatchedSamples.forEach((sample, index) => {
        console.log(`  [${index + 1}] 尝试匹配: \"${sample.brandCode}|${sample.carrierId}|${sample.cityName}\" (${sample.totalOrders}订单)`);
      });
    }
    console.log('');

    return {
      success: true,
      data: {
        totalS2DOrders: aggregatedStats.totalS2DOrders,
        planStats: aggregatedStats.planStats,
        actualStats: aggregatedStats.actualStats,
        avgS2DTime: Math.round(avgS2DTime * 100) / 100,
        achievementRate: Math.round(achievementRate * 100) / 100,
        byBrand: Array.from(aggregatedStats.byBrand.values()).map(item => ({
          ...item,
          avgActualHours: item.totalS2DOrders > 0 ? 
            Math.round((item.totalS2DTime / item.totalS2DOrders) * 100) / 100 : 0
        })),
        byCourier: Array.from(aggregatedStats.byCourier.values()).map(item => ({
          ...item,
          avgActualHours: item.totalS2DOrders > 0 ? 
            Math.round((item.totalS2DTime / item.totalS2DOrders) * 100) / 100 : 0
        })),
        byBrandCourier: Array.from(aggregatedStats.byBrandCourier.values()).map(item => ({
          ...item,
          avgActualHours: item.totalS2DOrders > 0 ? 
            Math.round((item.totalS2DTime / item.totalS2DOrders) * 100) / 100 : 0
        })),
        rawOrders: rawOrders,  // 🔥 新增：原始订单数据
        metadata: {
          timelinessDataSource: timelinessFileData.metadata.fileName,
          timelinessDataUploadTime: timelinessFileData.metadata.uploadTime,
          timelinessRecordCount: timelinessData.length,
          analysisTime: new Date().toISOString(),
          matchedCount,
          unmatchedCount,
          unmatchedSamples
        }
      }
    };

  } catch (error) {
    console.error('❌ S2D时效分析失败:', error);
    throw error;
  }
}

/**
 * 获取SLA匹配状态
 */
export async function getSLAMatchingStatus(options = {}) {
  try {
    const timelinessFileData = getLatestTimelinessData();
    
    if (!timelinessFileData) {
      return {
        hasTimelinessData: false,
        message: '未找到时效数据文件'
      };
    }

    return {
      hasTimelinessData: true,
      fileName: timelinessFileData.metadata.fileName,
      uploadTime: timelinessFileData.metadata.uploadTime,
      recordCount: timelinessFileData.metadata.recordCount,
      message: '时效数据已加载'
    };

  } catch (error) {
    console.error('❌ 获取SLA匹配状态失败:', error);
    return {
      hasTimelinessData: false,
      error: error.message
    };
  }
}

// 导出所有函数
export default {
  analyzeTimelinessPerformance,
  getSLAMatchingStatus
};