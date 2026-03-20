/**
 * C2D时效分析（Customer to Delivery）
 * 从客户付款到签收的时间分析
 * 
 * ✅ 2025-01-17修复：使用 PAYMENTDATE_D 和 DELIVERY_TIME 计算C2D时效
 * 计算公式：(DELIVERY_TIME - PAYMENTDATE_D) * 24 小时
 */
async function analyzeC2DPerformance(options = {}) {
  try {
    const { 
      dateRange,
      selectedBrand = null,
      selectedSelfFlag = 'Y',
      selectedCarrier = null,
      analysisType = 'C2D'
    } = options;

    console.log('🔍 执行C2D时效分析（文件存储模式）:', {
      dateRange,
      selectedBrand,
      selectedSelfFlag,
      selectedCarrier
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

    // ✅ 步骤2: 创建时效匹配Map（优化：按区域ID匹配 > 按城市名匹配）
    const timelinessMap = new Map();          // 按城市名匹配: brand|carrier|cityName → timeValue
    const timelinessMapByAreaId = new Map();  // 按区域ID匹配: brand|carrier|areaId → timeValue
    
    timelinessData.forEach(item => {
      // 按区域ID建立索引（优先使用）
      if (item.areaId) {
        const keyByAreaId = `${item.brand}|${item.carrier}|${item.areaId}`;
        timelinessMapByAreaId.set(keyByAreaId, item.timeValue);
      }
      
      // 按城市名建立索引（备选）
      if (item.cityName) {
        const keyByCityName = `${item.brand}|${item.carrier}|${item.cityName}`;
        timelinessMap.set(keyByCityName, item.timeValue);
      }
    });

    console.log(`✅ 时效匹配索引已建立:`);
    console.log(`   - 按区域ID: ${timelinessMapByAreaId.size}条记录`);
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
      'TIMBERLAND': '18405-4',
      'SMARTWOOL': '18405-5'
    };
    
    if (startDate && endDate) {
      whereClauses.push(`t.WMS_OUTBOUND_TIME BETWEEN TO_DATE(:startDate, 'YYYY-MM-DD') AND TO_DATE(:endDate, 'YYYY-MM-DD') + INTERVAL '1' DAY - INTERVAL '1' SECOND`);
      params.startDate = startDate;
      params.endDate = endDate;
    }
    
    if (selectedBrand) {
      whereClauses.push(`t.CUSTOMERNO = :selectedBrand`);
      params.selectedBrand = BRAND_MAPPING[selectedBrand] || selectedBrand;
    }
    
    if (selectedCarrier) {
      whereClauses.push(`t.CARRIERID = :selectedCarrier`);
      params.selectedCarrier = selectedCarrier;
    }

    // ✅ 排除EMS承运订单
    whereClauses.push(`t.CARRIERID != 'EMS'`);
    
    // ✅ 只分析DIS_TYPE=01的订单（正常订单）
    whereClauses.push(`t.DIS_TYPE = '01'`);
    
    // ✅ 品牌筛选逻辑（2025-01-17修复：支持竞品数据查询）
    if (!selectedBrand) {
      whereClauses.push(`t.CUSTOMERNO IN ('18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5')`);
    }
    
    // ✅ 自管筛选逻辑（修正版）
    if (selectedSelfFlag === 'Y') {
      whereClauses.push(`t.SELF_FLAG = 'Y'`);
    } else if (selectedSelfFlag === 'N') {
      whereClauses.push(`(t.SELF_FLAG IS NULL OR t.SELF_FLAG != 'Y')`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    console.log('📊 SQL查询参数:', { params, whereClause: whereClause.substring(0, 200) + '...' });

    // ✅ 查询订单统计（按品牌+快递商+城市分组）
    // ✅ C2D时效 = (DELIVERY_TIME - PAYMENTDATE_D) * 24小时
    const statsQuery = `
      SELECT 
        CASE t.CUSTOMERNO
          WHEN '18405' THEN 'DICKIES'
          WHEN '18405-1' THEN 'TNF'
          WHEN '18405-2' THEN 'ICEBREAKER'
          WHEN '18405-3' THEN 'VANS'
          WHEN '18405-4' THEN 'TIMBERLAND'
          WHEN '18405-5' THEN 'SMARTWOOL'
          ELSE t.CUSTOMERNO
        END as BRAND_CODE,
        t.CARRIERID,
        ba.AREA_NAME as CITY_NAME,
        t.DEST_CITY as AREA_ID,
        
        -- ✅ Plan统计：所有订单（不限制状态，用于Plan时效统计）
        COUNT(*) as PLAN_TOTAL_ORDERS,
        
        -- ✅ C2D Actual统计：只统计已签收订单（DIS_STATUS='93'或'95'）
        -- C2D时效 = (DELIVERY_TIME - PAYMENTDATE_D) * 24小时
        COUNT(CASE WHEN t.DIS_STATUS IN ('93', '95') 
                   AND t.PAYMENTDATE_D IS NOT NULL 
                   AND t.DELIVERY_TIME IS NOT NULL 
                   AND t.DELIVERY_TIME >= t.PAYMENTDATE_D THEN 1 END) as TOTAL_C2D_ORDERS,
        
        COUNT(CASE WHEN t.DIS_STATUS IN ('93', '95') 
                   AND t.PAYMENTDATE_D IS NOT NULL 
                   AND t.DELIVERY_TIME IS NOT NULL 
                   AND t.DELIVERY_TIME >= t.PAYMENTDATE_D
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 24 THEN 1 END) as ACTUAL_24H_COUNT,
        
        COUNT(CASE WHEN t.DIS_STATUS IN ('93', '95') 
                   AND t.PAYMENTDATE_D IS NOT NULL 
                   AND t.DELIVERY_TIME IS NOT NULL 
                   AND t.DELIVERY_TIME >= t.PAYMENTDATE_D
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 > 24 
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 48 THEN 1 END) as ACTUAL_48H_COUNT,
        
        COUNT(CASE WHEN t.DIS_STATUS IN ('93', '95') 
                   AND t.PAYMENTDATE_D IS NOT NULL 
                   AND t.DELIVERY_TIME IS NOT NULL 
                   AND t.DELIVERY_TIME >= t.PAYMENTDATE_D
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 > 48 
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 72 THEN 1 END) as ACTUAL_72H_COUNT,
        
        COUNT(CASE WHEN t.DIS_STATUS IN ('93', '95') 
                   AND t.PAYMENTDATE_D IS NOT NULL 
                   AND t.DELIVERY_TIME IS NOT NULL 
                   AND t.DELIVERY_TIME >= t.PAYMENTDATE_D
                   AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 > 72 THEN 1 END) as ACTUAL_OVER72H_COUNT,
        
        AVG(CASE WHEN t.DIS_STATUS IN ('93', '95') 
                 AND t.PAYMENTDATE_D IS NOT NULL 
                 AND t.DELIVERY_TIME IS NOT NULL 
                 AND t.DELIVERY_TIME >= t.PAYMENTDATE_D
                 AND (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 <= 1000 
                 THEN (t.DELIVERY_TIME - t.PAYMENTDATE_D) * 24 END) as AVG_C2D_TIME
        
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_AREA ba ON t.DEST_CITY = ba.AREA_ID
      ${whereClause}
      GROUP BY 
        CASE t.CUSTOMERNO
          WHEN '18405' THEN 'DICKIES'
          WHEN '18405-1' THEN 'TNF'
          WHEN '18405-2' THEN 'ICEBREAKER'
          WHEN '18405-3' THEN 'VANS'
          WHEN '18405-4' THEN 'TIMBERLAND'
          WHEN '18405-5' THEN 'SMARTWOOL'
          ELSE t.CUSTOMERNO
        END,
        t.CARRIERID, 
        ba.AREA_NAME, 
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

    let matchedCount = 0;
    let unmatchedCount = 0;

    // 🔍 收集匹配详情，用于调试分析
    const matchedRecords = [];
    const unmatchedRecords = [];

    statsResult.rows.forEach(row => {
      const brandCode = row.BRAND_CODE;
      const carrierId = row.CARRIERID;
      const cityName = row.CITY_NAME;
      const areaId = row.AREA_ID;
      
      const planTotalOrders = parseInt(row.PLAN_TOTAL_ORDERS) || 0;
      const totalOrders = parseInt(row.TOTAL_C2D_ORDERS) || 0;  // ✅ 改为C2D
      const actual24h = parseInt(row.ACTUAL_24H_COUNT) || 0;
      const actual48h = parseInt(row.ACTUAL_48H_COUNT) || 0;
      const actual72h = parseInt(row.ACTUAL_72H_COUNT) || 0;
      const actualOver72h = parseInt(row.ACTUAL_OVER72H_COUNT) || 0;
      const avgC2DTime = parseFloat(row.AVG_C2D_TIME) || 0;  // ✅ 改为C2D

      // 🔍 打印第一条匹配的数据，供调试
      if (statsResult.rows.indexOf(row) === 0) {
        console.log('📋 第一条数据解析结果:');
        console.log('   🎯 Plan相关（所有订单）:');
        console.log(`      - planTotalOrders: ${planTotalOrders}`);
        console.log('   📦 C2D Actual相关（已签收订单 DIS_STATUS=95）:');
        console.log(`      - totalOrders: ${totalOrders}`);
        console.log(`      - actual24h: ${actual24h}`);
        console.log(`      - actual48h: ${actual48h}`);
        console.log(`      - actual72h: ${actual72h}`);
        console.log(`      - actualOver72h: ${actualOver72h}`);
        console.log(`      - avgC2DTime: ${avgC2DTime}`);  // ✅ 改为C2D
        console.log('   🏷️  分组维度:');
        console.log(`      - brandCode: ${brandCode}`);
        console.log(`      - carrierId: ${carrierId}`);
        console.log(`      - cityName: ${cityName}`);
        console.log(`      - areaId: ${areaId}`);
      }

      // Actual统计（已签收订单的实际表现）
      actualStats.total += totalOrders;
      actualStats.within24h += actual24h;
      actualStats.within48h += actual48h;
      actualStats.within72h += actual72h;
      actualStats.over72h += actualOver72h;

      if (totalOrders > 0 && avgC2DTime > 0) {  // ✅ 改为C2D
        totalC2DTime += avgC2DTime * totalOrders;  // ✅ 改为C2D
        totalC2DCount += totalOrders;  // ✅ 改为C2D
      }

      // Plan统计（匹配时效表）
      let matchKey = areaId ? `${brandCode}|${carrierId}|${areaId}` : null;
      let matchedTimeValue = matchKey ? timelinessMapByAreaId.get(matchKey) : null;
      
      if (statsResult.rows.indexOf(row) < 3) {
        console.log(`🔍 匹配尝试 [${statsResult.rows.indexOf(row) + 1}]: Key="${matchKey || 'N/A'}" → ${matchedTimeValue ? `匹配成功(${matchedTimeValue}h)` : '未匹配'}`);
      }
      
      if (!matchedTimeValue && cityName) {
        matchKey = `${brandCode}|${carrierId}|${cityName}`;
        matchedTimeValue = timelinessMap.get(matchKey);
        
        if (statsResult.rows.indexOf(row) < 3) {
          console.log(`   └─ 尝试城市名匹配: Key="${matchKey}" → ${matchedTimeValue ? `匹配成功(${matchedTimeValue}h)` : '未匹配'}`);
        }
      }

      if (matchedTimeValue) {
        matchedCount++;
        
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
          cityName,
          areaId,
          planTotalOrders,
          actualTotalOrders: totalOrders,
          matchedTimeValue
        });
      } else {
        unmatchedCount++;
        unmatchedRecords.push({
          brandCode,
          carrierId,
          cityName,
          areaId,
          planTotalOrders,
          actualTotalOrders: totalOrders
        });
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
    const fs = require('fs');
    const path = require('path');
    
    const debugDir = path.join(__dirname, '../../debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const debugFilePath = path.join(debugDir, `c2d-matching-details-${timestamp}.json`);
    
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

    fs.writeFileSync(debugFilePath, JSON.stringify(debugData, null, 2), 'utf-8');
    console.log(`📁 C2D匹配详情已保存到: ${debugFilePath}`);
    console.log(`   - 已匹配记录: ${matchedRecords.length}条`);
    console.log(`   - 未匹配记录: ${unmatchedRecords.length}条`);

    // 计算平均时效
    const avgC2DTime = totalC2DCount > 0 ? (totalC2DTime / totalC2DCount).toFixed(2) : 0;  // ✅ 改为C2D

    // 计算时效达成率
    const achievementRate = planStats.total > 0 
      ? ((actualStats.within24h + actualStats.within48h) / planStats.total * 100).toFixed(2)
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