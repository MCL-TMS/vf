/**
 * VF物流数据分析平台 - 时效数据处理工具
 * 
 * 处理上传的时效Excel数据并存储到数据库
 * 
 * 关键映射关系：
 * - 时效表中的Carrier列对应TSK_LIST_TASK表中的CARRIERID字段
 * - 城市映射通过DEST_CITY代码在BAS_AREA表中查询area_name获取真实城市名称
 * - S2D计算使用SUM_SEND_TIME2字段作为实际配送时长
 */

/**
 * 将解析的时效数据保存到数据库（简化版本）
 * @param {Array} parsedData - 解析后的时效数据数组，每条数据包含: {carrier, cityName, areaId, brand, timeValue}
 * @param {Object} metadata - 上传文件的元数据
 * @returns {Promise<Object>} 保存结果
 */
export async function saveTimelinessDataToDatabase(parsedData, metadata) {
  try {
    const { executeQuery } = await import('../config/database.js');
    
    console.log(`🗄️ 开始保存${parsedData.length}条时效数据到数据库...`);
    
    // 生成批次ID
    const batchId = `BATCH_${Date.now()}`;
    
    // ✨ 先清空旧的时效数据
    console.log('🗑️  清空旧的时效数据...');
    try {
      await executeQuery('DELETE FROM APP_CMS.TSK_TIMELINESS_DATA', []);
      console.log('✅ 旧数据已清空');
    } catch (deleteError) {
      console.warn('⚠️  清空旧数据失败（可能表为空）:', deleteError.message);
    }
    
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    // 批量插入新数据
    console.log('💾 批量插入新的时效数据...');
    
    for (const item of parsedData) {
      try {
        const insertQuery = `
          INSERT INTO APP_CMS.TSK_TIMELINESS_DATA (
            BRAND_CODE,
            CARRIER_NAME,
            CITY_NAME,
            AREA_ID,
            TIME_VALUE,
            BATCH_ID,
            IS_ACTIVE,
            CREATED_TIME
          ) VALUES (
            :brandCode,
            :carrierName,
            :cityName,
            :areaId,
            :timeValue,
            :batchId,
            'Y',
            SYSDATE
          )
        `;
        
        const params = {
          brandCode: item.brand || null,
          carrierName: item.carrier || null,
          cityName: item.cityName || null,
          areaId: item.areaId || null,
          timeValue: item.timeValue || null,
          batchId: batchId
        };
        
        await executeQuery(insertQuery, params);
        insertedCount++;
        
        // 每100条打印一次进度
        if (insertedCount % 100 === 0) {
          console.log(`  📊 已插入 ${insertedCount}/${parsedData.length} 条...`);
        }
        
      } catch (itemError) {
        console.warn(`❌ 插入数据项失败:`, {
          brand: item.brand,
          carrier: item.carrier,
          cityName: item.cityName,
          error: itemError.message
        });
        errorCount++;
      }
    }
    
    console.log(`✅ 时效数据保存完成: 成功=${insertedCount}, 失败=${errorCount}`);
    
    // 验证：查询并打印前10条保存的数据
    console.log('\n📋 【数据库验证 - 前10条已保存数据】:');
    try {
      const verifyQuery = `
        SELECT 
          BRAND_CODE,
          CARRIER_NAME,
          CITY_NAME,
          AREA_ID,
          TIME_VALUE,
          ROWNUM as RN
        FROM APP_CMS.TSK_TIMELINESS_DATA
        WHERE ROWNUM <= 10
        ORDER BY CREATED_TIME DESC
      `;
      const verifyResult = await executeQuery(verifyQuery, []);
      
      if (verifyResult.rows && verifyResult.rows.length > 0) {
        verifyResult.rows.forEach((row, index) => {
          console.log(`  [${index + 1}] 品牌: ${row.BRAND_CODE} | 快递商: '${row.CARRIER_NAME}' | 城市: ${row.CITY_NAME} | 区域ID: ${row.AREA_ID || 'NULL'} | 时效: ${row.TIME_VALUE}h`);
        });
      } else {
        console.log('  ⚠️  未查询到数据');
      }
    } catch (verifyError) {
      console.warn('  ⚠️  验证查询失败:', verifyError.message);
    }
    console.log('');
    
    return {
      success: true,
      batchId,
      insertedCount,
      errorCount,
      totalRecords: parsedData.length
    };
    
  } catch (error) {
    console.error('❌ 保存时效数据失败:', error);
    throw new Error(`数据库保存失败: ${error.message}`);
  }
}

/**
 * 创建上传批次记录
 */
async function createUploadBatch(metadata) {
  const { executeQuery } = await import('../config/database.js');
  
  // 注意：这里需要创建实际的表结构
  // 示例表名：TSK_TIMELINESS_UPLOAD_BATCH
  const insertBatchQuery = `
    INSERT INTO APP_CMS.TSK_TIMELINESS_UPLOAD_BATCH (
      BATCH_ID,
      FILENAME,
      ORIGINAL_NAME,
      FILE_SIZE,
      UPLOAD_TIME,
      STATUS,
      CREATED_TIME
    ) VALUES (
      SYS_GUID(),
      :filename,
      :originalName,
      :fileSize,
      TO_DATE(:uploadTime, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
      'PROCESSING',
      SYSDATE
    ) RETURNING BATCH_ID INTO :batchId
  `;
  
  const params = {
    filename: metadata.filename,
    originalName: metadata.originalname,
    fileSize: metadata.size,
    uploadTime: metadata.uploadTime,
    batchId: { dir: 'OUT', type: 'STRING' }
  };
  
  const result = await executeQuery(insertBatchQuery, params);
  return result.outBinds.batchId;
}

/**
 * 批量插入时效数据
 */
async function batchInsertTimelinessData(parsedData, batchId) {
  const { executeQuery } = await import('../config/database.js');
  
  let insertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  // 示例表名：TSK_TIMELINESS_DATA
  const insertQuery = `
    MERGE INTO APP_CMS.TSK_TIMELINESS_DATA t
    USING (
      SELECT 
        :carrier as CARRIER_NAME,
        :cityName as CITY_NAME,
        :areaId as AREA_ID,
        :brand as BRAND_CODE,
        :timeValue as TIME_VALUE,
        :isOvertime as IS_OVERTIME,
        :batchId as BATCH_ID,
        SYSDATE as CREATED_TIME
      FROM DUAL
    ) s ON (
      t.CARRIER_NAME = s.CARRIER_NAME 
      AND t.AREA_ID = s.AREA_ID 
      AND t.BRAND_CODE = s.BRAND_CODE
    )
    WHEN MATCHED THEN
      UPDATE SET 
        t.TIME_VALUE = s.TIME_VALUE,
        t.IS_OVERTIME = s.IS_OVERTIME,
        t.UPDATED_TIME = SYSDATE,
        t.LAST_BATCH_ID = s.BATCH_ID
    WHEN NOT MATCHED THEN
      INSERT (
        TIMELINESS_ID,
        CARRIER_NAME,
        CITY_NAME,
        AREA_ID,
        BRAND_CODE,
        TIME_VALUE,
        IS_OVERTIME,
        BATCH_ID,
        CREATED_TIME
      ) VALUES (
        SYS_GUID(),
        s.CARRIER_NAME,
        s.CITY_NAME,
        s.AREA_ID,
        s.BRAND_CODE,
        s.TIME_VALUE,
        s.IS_OVERTIME,
        s.BATCH_ID,
        s.CREATED_TIME
      )
  `;
  
  // 分批处理数据（每次处理100条）
  const batchSize = 100;
  
  for (let i = 0; i < parsedData.length; i += batchSize) {
    const batch = parsedData.slice(i, i + batchSize);
    
    try {
      for (const item of batch) {
        try {
          const params = {
            carrier: item.carrier,
            cityName: item.cityName,
            areaId: item.areaId,
            brand: item.brand,
            timeValue: item.timeValue,
            isOvertime: item.isOvertime ? 'Y' : 'N',
            batchId: batchId
          };
          
          await executeQuery(insertQuery, params);
          insertedCount++;
          
        } catch (itemError) {
          console.warn(`处理数据项失败:`, item, itemError.message);
          errorCount++;
        }
      }
      
      console.log(`✅ 处理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(parsedData.length/batchSize)}`);
      
    } catch (batchError) {
      console.error(`批次处理失败:`, batchError);
      errorCount += batch.length;
    }
  }
  
  return { insertedCount, skippedCount, errorCount };
}

/**
 * 更新时效统计信息
 */
async function updateTimelinessStatistics() {
  const { executeQuery } = await import('../config/database.js');
  
  // 这里可以更新相关的统计表或视图
  // 例如按品牌、快递商统计平均时效等
  console.log('📊 更新时效统计信息...');
  
  // 示例：更新品牌时效统计
  const updateStatsQuery = `
    MERGE INTO APP_CMS.TSK_BRAND_TIMELINESS_STATS t
    USING (
      SELECT 
        BRAND_CODE,
        CARRIER_NAME,
        COUNT(*) as RECORD_COUNT,
        AVG(TIME_VALUE) as AVG_TIME,
        MIN(TIME_VALUE) as MIN_TIME,
        MAX(TIME_VALUE) as MAX_TIME
      FROM APP_CMS.TSK_TIMELINESS_DATA
      GROUP BY BRAND_CODE, CARRIER_NAME
    ) s ON (t.BRAND_CODE = s.BRAND_CODE AND t.CARRIER_NAME = s.CARRIER_NAME)
    WHEN MATCHED THEN
      UPDATE SET 
        t.RECORD_COUNT = s.RECORD_COUNT,
        t.AVG_TIME = s.AVG_TIME,
        t.MIN_TIME = s.MIN_TIME,
        t.MAX_TIME = s.MAX_TIME,
        t.UPDATED_TIME = SYSDATE
    WHEN NOT MATCHED THEN
      INSERT (
        STATS_ID,
        BRAND_CODE,
        CARRIER_NAME,
        RECORD_COUNT,
        AVG_TIME,
        MIN_TIME,
        MAX_TIME,
        CREATED_TIME
      ) VALUES (
        SYS_GUID(),
        s.BRAND_CODE,
        s.CARRIER_NAME,
        s.RECORD_COUNT,
        s.AVG_TIME,
        s.MIN_TIME,
        s.MAX_TIME,
        SYSDATE
      )
  `;
  
  try {
    await executeQuery(updateStatsQuery);
    console.log('✅ 统计信息更新完成');
  } catch (error) {
    console.warn('⚠️ 统计信息更新失败:', error.message);
  }
}

/**
 * 获取时效数据统计信息
 */
export async function getTimelinessStatistics(filters = {}) {
  const { executeQuery } = await import('../config/database.js');
  
  let whereConditions = [];
  let params = {};
  
  if (filters.brand) {
    whereConditions.push('t.BRAND_CODE = :brand');
    params.brand = filters.brand;
  }
  
  if (filters.carrier) {
    whereConditions.push('t.CARRIER_NAME LIKE :carrier');
    params.carrier = `%${filters.carrier}%`;
  }
  
  const whereClause = whereConditions.length > 0 ? 
    `WHERE ${whereConditions.join(' AND ')}` : '';
  
  const query = `
    SELECT 
      t.BRAND_CODE,
      t.CARRIER_NAME,
      COUNT(*) as TOTAL_RECORDS,
      AVG(t.TIME_VALUE) as AVG_TIME,
      MIN(t.TIME_VALUE) as MIN_TIME,
      MAX(t.TIME_VALUE) as MAX_TIME,
      COUNT(CASE WHEN t.IS_OVERTIME = 'Y' THEN 1 END) as OVERTIME_COUNT,
      ba.AREA_NAME as CITY_NAME
    FROM APP_CMS.TSK_TIMELINESS_DATA t
    LEFT JOIN APP_CMS.BAS_AREA ba ON t.AREA_ID = ba.AREA_ID
    ${whereClause}
    GROUP BY t.BRAND_CODE, t.CARRIER_NAME, ba.AREA_NAME
    ORDER BY t.BRAND_CODE, AVG(t.TIME_VALUE)
  `;
  
  try {
    const result = await executeQuery(query, params);
    return result.rows;
  } catch (error) {
    console.error('获取时效统计失败:', error);
    throw error;
  }
}

/**
 * 执行时效分析计算（S2D、C2D）
 * 订单匹配：每个订单根据品牌、城市和快递公司与上传的时效表进行匹配
 * 关键映射：时效表中的Carrier列对应TSK_LIST_TASK表中的CARRIERID字段
 */
export async function analyzeTimelinessPerformance(options = {}) {
  const { 
    dateRange,
    selectedBrand = null,
    selectedCarrier = null,
    selectedSelfFlag = null,  // ✅ 新增：接收selfFlag参数
    analysisType = 'both'
  } = options;

  console.log('🔄 开始时效分析计算...', options);

  try {
    const { executeQuery } = await import('../config/database.js');
    const { getLatestTimelinessData } = await import('./timelinessFileStore.js');
    
    // 🔥 关键：从JSON文件加载时效数据（用户无数据库写入权限）
    console.log('📂 从JSON文件加载时效数据...');
    const timelinessData = getLatestTimelinessData();
    
    if (!timelinessData || !timelinessData.data || timelinessData.data.length === 0) {
      console.warn('⚠️  未找到时效数据文件，Plan时效将为0');
      console.log('💡 请先上传时效Excel文件');
    } else {
      console.log(`✅ 成功加载时效数据: ${timelinessData.data.length}条记录`);
      console.log(`   文件上传时间: ${timelinessData.metadata?.uploadTime || '未知'}`);
      
      // 打印前5条样本
      console.log('\n📋 【时效数据样本 - 前5条】:');
      timelinessData.data.slice(0, 5).forEach((item, index) => {
        console.log(`  [${index + 1}] 品牌: ${item.brand} | 快递商: '${item.carrier}' | 城市: ${item.cityName} | 时效: ${item.timeValue}h`);
      });
    }
    
    // 构建时效匹配索引（品牌+快递商+城市 → 时效值）
    const timelinessMap = new Map();
    if (timelinessData && timelinessData.data) {
      timelinessData.data.forEach(item => {
        // 使用城市名称作为key（优先）
        if (item.cityName) {
          const key = `${item.brand}|${item.carrier}|${item.cityName}`;
          timelinessMap.set(key, item.timeValue);
        }
        // 如果有区域ID，也创建一个映射
        if (item.areaId) {
          const keyById = `${item.brand}|${item.carrier}|${item.areaId}`;
          timelinessMap.set(keyById, item.timeValue);
        }
      });
      console.log(`\n🗺️  构建时效匹配索引: ${timelinessMap.size}个映射\n`);
    }
    
    // VF品牌映射 - 只分析这5个品牌
    const VF_BRAND_MAPPING = {
      'DICKIES': '18405',
      'TNF': '18405-1', 
      'ICEBREAKER': '18405-2',
      'VANS': '18405-3',
      'TIMBERLAND': '18405-4'
    };
    
    // VF品牌代码数组
    const VF_BRAND_CODES = Object.values(VF_BRAND_MAPPING);
    
    // ✅ 修复：根据selfFlag动态构建WHERE条件，与总览界面保持一致
    let whereConditions = [];
    let params = {};
    
    // ✅ 自管筛选条件 - 与总览界面逻辑保持一致
    if (selectedSelfFlag && selectedSelfFlag !== 'all') {
      whereConditions.push('t.SELF_FLAG = :selfFlag');
      params.selfFlag = selectedSelfFlag;
      console.log(`🔧 [Self Flag Filter] 自管筛选: ${selectedSelfFlag}`);
    } else if (selectedSelfFlag === 'all') {
      // ✅ 选择"全部"时，不添加SELF_FLAG筛选
      console.log(`🔧 [Self Flag Filter] 全部订单，无SELF_FLAG筛选`);
    } else {
      // ✅ 默认情况：selfFlag为null/undefined时，默认为自管
      whereConditions.push('t.SELF_FLAG = :selfFlag');
      params.selfFlag = 'Y';
      console.log(`🔧 [Self Flag Filter] selfFlag为空，默认自管筛选: Y`);
    }
    
    // 只查询VF的5个品牌数据
    const brandCodesList = VF_BRAND_CODES.map((code, index) => `:brandCode${index}`).join(', ');
    whereConditions.push(`t.BRAND_CODE IN (${brandCodesList})`);
    VF_BRAND_CODES.forEach((code, index) => {
      params[`brandCode${index}`] = code;
    });
    
    // 排除EMS和退货订单
    whereConditions.push("t.CARRIER_NAME NOT LIKE '%EMS%'");
    whereConditions.push("(t.ORDER_TYPE IS NULL OR t.ORDER_TYPE NOT LIKE '%退货%')");
    
    if (dateRange && dateRange.from && dateRange.to) {
      whereConditions.push('t.WMS_OUTBOUND_TIME >= TO_DATE(:dateFrom, \'YYYY-MM-DD\')');
      whereConditions.push('t.WMS_OUTBOUND_TIME < TO_DATE(:dateTo, \'YYYY-MM-DD\') + 1');
      params.dateFrom = dateRange.from;
      params.dateTo = dateRange.to;
    }
    
    if (selectedBrand) {
      whereConditions.push('t.BRAND_CODE = :brand');
      params.brand = selectedBrand;
    }
    
    if (selectedCarrier) {
      whereConditions.push('t.CARRIER_NAME LIKE :carrier');
      params.carrier = `%${selectedCarrier}%`;
    }
    
    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';

    // 🔥 优化查询：使用聚合统计代替逐行查询，提升性能
    console.log('📊 执行优化的时效统计分析（聚合查询）...');
    
    const statsQuery = `
      SELECT 
        t.BRAND_CODE,
        t.CARRIERID as CARRIER_ID,
        ba.AREA_NAME as CITY_NAME,
        ba.AREA_ID as CITY_AREA_ID,
        -- ✅ Actual时效分组统计（基于实际配送时长SUM_SEND_TIME2，状态='95'已签收）
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 >= 0 
                   AND t.SUM_SEND_TIME2 <= 24 THEN 1 END) as ACTUAL_24H_COUNT,
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL 
                   AND t.SUM_SEND_TIME2 > 24 AND t.SUM_SEND_TIME2 <= 48 THEN 1 END) as ACTUAL_48H_COUNT,
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL 
                   AND t.SUM_SEND_TIME2 > 48 AND t.SUM_SEND_TIME2 <= 72 THEN 1 END) as ACTUAL_72H_COUNT,
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL 
                   AND t.SUM_SEND_TIME2 > 72 THEN 1 END) as ACTUAL_72H_PLUS_COUNT,
        -- 总订单数和平均时效
        COUNT(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 >= 0 
                   THEN 1 END) as TOTAL_S2D_ORDERS,
        AVG(CASE WHEN t.DIS_STATUS = '95' AND t.SUM_SEND_TIME2 IS NOT NULL AND t.SUM_SEND_TIME2 >= 0 
                 THEN t.SUM_SEND_TIME2 END) as AVG_ACTUAL_HOURS,
        -- 🔥 计算所有订单数（用于Plan匹配，不限制DIS_STATUS）
        COUNT(*) as TOTAL_ORDERS
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_AREA ba ON t.DEST_CITY = ba.AREA_ID
      ${whereClause}
      GROUP BY t.BRAND_CODE, t.CARRIERID, ba.AREA_NAME, ba.AREA_ID
      ORDER BY TOTAL_S2D_ORDERS DESC
    `;

    console.log('📊 执行时效统计查询（不JOIN时效表）...');
    const statsResult = await executeQuery(statsQuery, params);
    const stats = statsResult.rows;

    console.log(`✅ 获取到 ${stats.length} 个品牌-快递商-城市组合的统计数据`);
    
    // 🔥 在应用层匹配Plan时效（从JSON文件）
    console.log('\n📊 开始在应用层匹配Plan时效...');
    let matchedCount = 0;
    stats.forEach(stat => {
      // 尝试通过城市名称匹配
      let matchedTimeValue = null;
      if (stat.CITY_NAME) {
        const keyByName = `${stat.BRAND_CODE}|${stat.CARRIER_ID}|${stat.CITY_NAME}`;
        matchedTimeValue = timelinessMap.get(keyByName);
      }
      
      // 如果城市名称没匹配到，尝试通过区域ID匹配
      if (!matchedTimeValue && stat.CITY_AREA_ID) {
        const keyById = `${stat.BRAND_CODE}|${stat.CARRIER_ID}|${stat.CITY_AREA_ID}`;
        matchedTimeValue = timelinessMap.get(keyById);
      }
      
      // 根据匹配到的时效值，统计Plan订单数
      if (matchedTimeValue !== null && matchedTimeValue !== undefined) {
        matchedCount++;
        const totalOrders = stat.TOTAL_ORDERS || 0;
        
        // 所有订单都应该有Plan时效（不限制订单状态）
        if (matchedTimeValue <= 24) {
          stat.PLAN_24H_COUNT = totalOrders;
          stat.PLAN_48H_COUNT = 0;
          stat.PLAN_72H_COUNT = 0;
          stat.PLAN_72H_PLUS_COUNT = 0;
        } else if (matchedTimeValue <= 48) {
          stat.PLAN_24H_COUNT = 0;
          stat.PLAN_48H_COUNT = totalOrders;
          stat.PLAN_72H_COUNT = 0;
          stat.PLAN_72H_PLUS_COUNT = 0;
        } else if (matchedTimeValue <= 72) {
          stat.PLAN_24H_COUNT = 0;
          stat.PLAN_48H_COUNT = 0;
          stat.PLAN_72H_COUNT = totalOrders;
          stat.PLAN_72H_PLUS_COUNT = 0;
        } else {
          stat.PLAN_24H_COUNT = 0;
          stat.PLAN_48H_COUNT = 0;
          stat.PLAN_72H_COUNT = 0;
          stat.PLAN_72H_PLUS_COUNT = totalOrders;
        }
        
        stat.AVG_PLAN_HOURS = matchedTimeValue;
      } else {
        // 未匹配到时效，Plan为0
        stat.PLAN_24H_COUNT = 0;
        stat.PLAN_48H_COUNT = 0;
        stat.PLAN_72H_COUNT = 0;
        stat.PLAN_72H_PLUS_COUNT = 0;
        stat.AVG_PLAN_HOURS = null;
      }
    });
    
    console.log(`✅ Plan时效匹配完成: ${matchedCount}/${stats.length} 个组合匹配成功`);
    
    // 🔍 新增：首先检查时效表数据
    console.log('\n' + '='.repeat(100));
    console.log('📋 【时效表数据检查】');
    console.log('='.repeat(100));
    
    try {
      const slaCheckQuery = `
        SELECT 
          BRAND_CODE,
          CARRIER_NAME,
          CITY_NAME,
          AREA_ID,
          TIME_VALUE,
          ROWNUM as RN
        FROM APP_CMS.TSK_TIMELINESS_DATA
        WHERE ROWNUM <= 20
        ORDER BY BRAND_CODE, CARRIER_NAME, CITY_NAME
      `;
      
      const slaCheckResult = await executeQuery(slaCheckQuery, []);
      console.log(`\n✅ 时效表中共有数据（显示前20条）:`);
      slaCheckResult.rows.forEach((row, index) => {
        console.log(`  [${index + 1}] 品牌: ${row.BRAND_CODE} | 快递商: ${row.CARRIER_NAME} | 城市: ${row.CITY_NAME} | 区域ID: ${row.AREA_ID || 'NULL'} | 时效: ${row.TIME_VALUE}h`);
      });
      
      // 统计时效表总数
      const slaCountQuery = `SELECT COUNT(*) as TOTAL_COUNT FROM APP_CMS.TSK_TIMELINESS_DATA`;
      const slaCountResult = await executeQuery(slaCountQuery, []);
      console.log(`\n📊 时效表总记录数: ${slaCountResult.rows[0]?.TOTAL_COUNT || 0}`);
      
      // 按快递商统计
      const slaCarrierQuery = `
        SELECT 
          CARRIER_NAME,
          COUNT(*) as COUNT
        FROM APP_CMS.TSK_TIMELINESS_DATA
        GROUP BY CARRIER_NAME
        ORDER BY COUNT DESC
      `;
      const slaCarrierResult = await executeQuery(slaCarrierQuery, []);
      console.log(`\n📦 按快递商统计:`);
      slaCarrierResult.rows.forEach(row => {
        console.log(`  ${row.CARRIER_NAME}: ${row.COUNT}条`);
      });
      
    } catch (error) {
      console.error('❌ 检查时效表失败:', error.message);
    }
    
    console.log('='.repeat(100) + '\n');
    
    // 🔍 新增：特别检查SF快递商的数据
    console.log('\n' + '='.repeat(100));
    console.log('🔍 【SF快递商时效数据专项检查】');
    console.log('='.repeat(100));
    
    try {
      // 检查时效表中SF的数据
      const sfSlaQuery = `
        SELECT 
          BRAND_CODE,
          CARRIER_NAME,
          CITY_NAME,
          AREA_ID,
          TIME_VALUE
        FROM APP_CMS.TSK_TIMELINESS_DATA
        WHERE CARRIER_NAME LIKE '%SF%' OR CARRIER_NAME LIKE '%顺丰%'
        AND ROWNUM <= 10
      `;
      
      const sfSlaResult = await executeQuery(sfSlaQuery, []);
      if (sfSlaResult.rows.length > 0) {
        console.log(`\n✅ 时效表中SF快递商的数据（前10条）:`);
        sfSlaResult.rows.forEach((row, index) => {
          console.log(`  [${index + 1}] 品牌: ${row.BRAND_CODE} | 快递商: '${row.CARRIER_NAME}' | 城市: ${row.CITY_NAME} | 时效: ${row.TIME_VALUE}h`);
        });
      } else {
        console.log(`\n❌ 时效表中没有找到SF相关的数据！`);
        console.log(`   请检查Excel文件中SF快递商的名称格式`);
      }
      
      // 检查订单表中SF的快递商名称格式
      const sfOrderQuery = `
        SELECT DISTINCT t.CARRIERID
        FROM APP_CMS.TSK_LIST_TASK t
        WHERE t.CARRIERID LIKE '%SF%' OR t.CARRIERID LIKE '%顺丰%'
        AND ROWNUM <= 5
      `;
      
      const sfOrderResult = await executeQuery(sfOrderQuery, []);
      console.log(`\n📦 订单表中SF快递商的名称格式:`);
      if (sfOrderResult.rows.length > 0) {
        sfOrderResult.rows.forEach((row, index) => {
          console.log(`  [${index + 1}] '${row.CARRIERID}'`);
        });
        console.log(`\n⚠️  请确保时效表中的CARRIER_NAME与上述格式完全一致！`);
      } else {
        console.log(`  ❌ 未找到SF相关订单`);
      }
      
    } catch (error) {
      console.error('❌ SF数据检查失败:', error.message);
    }
    
    console.log('='.repeat(100) + '\n');
    
    // 🔍 新增：查询前10条订单的详细匹配过程
    console.log('\n' + '='.repeat(100));
    console.log('🔍 【Plan匹配详细过程 - 前10条订单】');
    console.log('='.repeat(100));
    
    const detailQuery = `
      SELECT 
        t.ORDER_NO,
        t.BRAND_CODE,
        t.CARRIERID,
        ba.AREA_NAME as CITY_NAME,
        ba.AREA_ID as CITY_AREA_ID,
        t.DEST_CITY as DEST_CITY_ID,
        t.DIS_STATUS,
        t.SUM_SEND_TIME2 as ACTUAL_S2D_HOURS,
        sla.TIME_VALUE as PLAN_S2D_HOURS,
        sla.CARRIER_NAME as MATCHED_CARRIER,
        sla.CITY_NAME as MATCHED_CITY,
        sla.AREA_ID as MATCHED_AREA_ID,
        sla.BRAND_CODE as MATCHED_BRAND,
        CASE 
          WHEN sla.TIME_VALUE IS NOT NULL THEN 'MATCHED'
          ELSE 'NOT_MATCHED'
        END as MATCH_STATUS
      FROM APP_CMS.TSK_LIST_TASK t
      LEFT JOIN APP_CMS.BAS_AREA ba ON t.DEST_CITY = ba.AREA_ID
      LEFT JOIN APP_CMS.TSK_TIMELINESS_DATA sla ON (
        sla.BRAND_CODE = t.BRAND_CODE
        AND sla.CARRIER_NAME = t.CARRIERID
        AND (sla.AREA_ID = ba.AREA_ID OR sla.CITY_NAME = ba.AREA_NAME)
      )
      ${whereClause}
      AND ROWNUM <= 10
      ORDER BY t.WMS_OUTBOUND_TIME DESC
    `;
    
    try {
      const detailResult = await executeQuery(detailQuery, params);
      const detailRows = detailResult.rows;
      
      detailRows.forEach((row, index) => {
        console.log(`\n📦 订单 ${index + 1}: ${row.ORDER_NO}`);
        console.log(`   订单信息:`);
        console.log(`   ├─ 品牌代码: ${row.BRAND_CODE}`);
        console.log(`   ├─ 快递商: ${row.CARRIERID}`);
        console.log(`   ├─ 目标城市: ${row.CITY_NAME} (区域ID: ${row.CITY_AREA_ID}, DEST_CITY: ${row.DEST_CITY_ID})`);
        console.log(`   ├─ 订单状态: ${row.DIS_STATUS}`);
        console.log(`   └─ Actual时效: ${row.ACTUAL_S2D_HOURS ? row.ACTUAL_S2D_HOURS + 'h' : 'NULL'}`);
        
        console.log(`   匹配条件:`);
        console.log(`   ├─ JOIN条件1: sla.BRAND_CODE = '${row.BRAND_CODE}'`);
        console.log(`   ├─ JOIN条件2: sla.CARRIER_NAME = '${row.CARRIERID}'`);
        console.log(`   └─ JOIN条件3: sla.AREA_ID = '${row.CITY_AREA_ID}' OR sla.CITY_NAME = '${row.CITY_NAME}'`);
        
        console.log(`   匹配结果: ${row.MATCH_STATUS}`);
        if (row.MATCH_STATUS === 'MATCHED') {
          console.log(`   ✅ 匹配成功!`);
          console.log(`   ├─ 匹配的品牌: ${row.MATCHED_BRAND}`);
          console.log(`   ├─ 匹配的快递商: ${row.MATCHED_CARRIER}`);
          console.log(`   ├─ 匹配的城市: ${row.MATCHED_CITY} (区域ID: ${row.MATCHED_AREA_ID || 'NULL'})`);
          console.log(`   └─ Plan时效: ${row.PLAN_S2D_HOURS}h`);
        } else {
          console.log(`   ❌ 未匹配到Plan时效`);
          console.log(`   排查步骤:`);
          console.log(`   1️⃣ 检查时效表中是否有品牌='${row.BRAND_CODE}'的记录`);
          console.log(`   2️⃣ 检查时效表中快递商名称是否为'${row.CARRIERID}'（注意大小写和空格）`);
          console.log(`   3️⃣ 检查时效表中城市是否为'${row.CITY_NAME}'或区域ID='${row.CITY_AREA_ID}'`);
          console.log(`   💡 在上面的【时效表数据检查】中查看时效表的实际数据格式`);
        }
      });
      
      console.log('\n' + '='.repeat(100));
      console.log('📊 匹配统计:');
      const matchedCount = detailRows.filter(r => r.MATCH_STATUS === 'MATCHED').length;
      const notMatchedCount = detailRows.filter(r => r.MATCH_STATUS === 'NOT_MATCHED').length;
      console.log(`   ✅ 匹配成功: ${matchedCount}/${detailRows.length}`);
      console.log(`   ❌ 未匹配: ${notMatchedCount}/${detailRows.length}`);
      console.log(`   📈 匹配率: ${((matchedCount / detailRows.length) * 100).toFixed(2)}%`);
      console.log('='.repeat(100) + '\n');
      
    } catch (error) {
      console.error('❌ 获取详细匹配信息失败:', error.message);
    }
    
    // 调试：显示前3条统计数据
    if (stats.length > 0) {
      console.log('📋 统计数据示例（前3条）:');
      stats.slice(0, 3).forEach((stat, index) => {
        console.log(`  [${index + 1}] 品牌: ${stat.BRAND_CODE}, 快递商: ${stat.CARRIER_ID}, 城市: ${stat.CITY_NAME}`);
        console.log(`      总订单: ${stat.TOTAL_S2D_ORDERS}`);
        console.log(`      Actual: 24H=${stat.ACTUAL_24H_COUNT}, 48H=${stat.ACTUAL_48H_COUNT}, 72H=${stat.ACTUAL_72H_COUNT}, 72H+=${stat.ACTUAL_72H_PLUS_COUNT}`);
        console.log(`      Plan: 24H=${stat.PLAN_24H_COUNT}, 48H=${stat.PLAN_48H_COUNT}, 72H=${stat.PLAN_72H_COUNT}, 72H+=${stat.PLAN_72H_PLUS_COUNT}`);
        console.log(`      平均时效: Actual=${stat.AVG_ACTUAL_HOURS}h, Plan=${stat.AVG_PLAN_HOURS}h`);
      });
    }

    // 执行S2D分析（只针对S2D，不查询详细订单）
    let s2dAnalysis = null;
    if (analysisType === 'S2D' || analysisType === 'both') {
      s2dAnalysis = analyzeS2DPerformanceFromStats(stats);
    }

    // 执行C2D分析（暂时不实现，因为需要单独的查询）
    let c2dAnalysis = null;
    if (analysisType === 'C2D') {
      console.log('⚠️ C2D分析暂未在聚合模式下实现，请使用S2D分析');
    }

    // 匹配统计
    const matchingStats = calculateMatchingStatisticsFromStats(stats);

    const totalOrdersFromStats = stats.reduce((sum, s) => sum + (Number(s.TOTAL_S2D_ORDERS) || 0), 0);
    
    const result = {
      totalOrders: totalOrdersFromStats,
      analysisType,
      dateRange,
      selectedBrand,
      selectedCarrier,
      s2dAnalysis,
      c2dAnalysis,
      matchingStats,
      timestamp: new Date().toISOString()
    };

    console.log('✅ 时效分析计算完成（优化聚合模式）');
    console.log('📊 最终结果汇总:', {
      totalOrders: result.totalOrders,
      s2dTotalOrders: result.s2dAnalysis?.totalS2DOrders,
      matchingRate: result.matchingStats?.overallMatchingRate,
      slaMatchedOrders: result.matchingStats?.slaMatchedOrders
    });
    return result;

  } catch (error) {
    console.error('❌ 时效分析计算失败:', error);
    throw new Error(`时效分析计算失败: ${error.message}`);
  }
}

/**
 * 从聚合统计数据生成S2D时效分析
 * 优化版本：直接使用聚合后的统计数据，避免处理大量订单行
 * 
 * ✅ 状态码逻辑（已修正 2025-01-09）:
 * - Actual时效: 只统计 DIS_STATUS='95'（已签收）的订单
 * - Plan时效: 不受订单状态限制，所有匹配到SLA的订单都统计
 * - totalS2DOrders: 已签收订单总数（DIS_STATUS='95'）
 * 
 * 数据来源:
 * - ACTUAL_*_COUNT: COUNT(DIS_STATUS='95' AND SUM_SEND_TIME2在对应区间)
 * - PLAN_*_COUNT: COUNT(TIME_VALUE在对应区间) ← 不检查DIS_STATUS
 * - TOTAL_S2D_ORDERS: COUNT(DIS_STATUS='95' AND SUM_SEND_TIME2 IS NOT NULL)
 * - AVG_ACTUAL_HOURS: AVG(SUM_SEND_TIME2 WHERE DIS_STATUS='95')
 * - AVG_PLAN_HOURS: AVG(TIME_VALUE) ← 不检查DIS_STATUS
 * 
 * 详见文档: /S2D_FRONTEND_BACKEND_DATA_MAPPING.md
 */
function analyzeS2DPerformanceFromStats(stats) {
  console.log('🚚 执行S2D时效分析（Plan vs Actual对比优化版本）...');
  console.log(`📊 输入统计数据条数: ${stats.length}`);
  
  // Actual时效累计
  let actualTotal24H = 0, actualTotal48H = 0, actualTotal72H = 0, actualTotal72HPlus = 0;
  // Plan时效累计
  let planTotal24H = 0, planTotal48H = 0, planTotal72H = 0, planTotal72HPlus = 0;
  let totalOrders = 0;
  
  const brandStats = {};
  const carrierStats = {};
  const brandCarrierStats = {}; // 新增：品牌×快递商交叉统计
  
  stats.forEach((stat, index) => {
    // 使用String()确保品牌和快递商代码是字符串类型
    const brandCode = String(stat.BRAND_CODE || '');
    const carrierId = String(stat.CARRIER_ID || '');
    
    // Actual时效统计（基于SUM_SEND_TIME2）
    const actualCount24H = Number(stat.ACTUAL_24H_COUNT) || 0;
    const actualCount48H = Number(stat.ACTUAL_48H_COUNT) || 0;
    const actualCount72H = Number(stat.ACTUAL_72H_COUNT) || 0;
    const actualCount72HPlus = Number(stat.ACTUAL_72H_PLUS_COUNT) || 0;
    
    // Plan时效统计（基于TIME_VALUE）
    const planCount24H = Number(stat.PLAN_24H_COUNT) || 0;
    const planCount48H = Number(stat.PLAN_48H_COUNT) || 0;
    const planCount72H = Number(stat.PLAN_72H_COUNT) || 0;
    const planCount72HPlus = Number(stat.PLAN_72H_PLUS_COUNT) || 0;
    
    const orders = Number(stat.TOTAL_S2D_ORDERS) || 0;
    const avgActualHours = Number(stat.AVG_ACTUAL_HOURS) || 0;
    const avgPlanHours = Number(stat.AVG_PLAN_HOURS) || 0;
    
    // 调试第一条数据
    if (index === 0) {
      console.log('🔍 第一条统计数据解析（Plan vs Actual）:');
      console.log(`  原始数据:`, {
        BRAND_CODE: stat.BRAND_CODE,
        CARRIER_ID: stat.CARRIER_ID,
        ACTUAL: `24H:${stat.ACTUAL_24H_COUNT}, 48H:${stat.ACTUAL_48H_COUNT}, 72H:${stat.ACTUAL_72H_COUNT}, 72H+:${stat.ACTUAL_72H_PLUS_COUNT}`,
        PLAN: `24H:${stat.PLAN_24H_COUNT}, 48H:${stat.PLAN_48H_COUNT}, 72H:${stat.PLAN_72H_COUNT}, 72H+:${stat.PLAN_72H_PLUS_COUNT}`,
        TOTAL_S2D_ORDERS: stat.TOTAL_S2D_ORDERS,
        AVG_ACTUAL_HOURS: stat.AVG_ACTUAL_HOURS,
        AVG_PLAN_HOURS: stat.AVG_PLAN_HOURS
      });
      console.log(`  解析后数值:`, {
        brandCode, 
        carrierId, 
        actual: { '24H': actualCount24H, '48H': actualCount48H, '72H': actualCount72H, '72H+': actualCount72HPlus },
        plan: { '24H': planCount24H, '48H': planCount48H, '72H': planCount72H, '72H+': planCount72HPlus },
        orders,
        avgActualHours,
        avgPlanHours
      });
    }
    
    // 累计总数
    actualTotal24H += actualCount24H;
    actualTotal48H += actualCount48H;
    actualTotal72H += actualCount72H;
    actualTotal72HPlus += actualCount72HPlus;
    
    planTotal24H += planCount24H;
    planTotal48H += planCount48H;
    planTotal72H += planCount72H;
    planTotal72HPlus += planCount72HPlus;
    
    totalOrders += orders;
    
    // 品牌统计
    if (!brandStats[brandCode]) {
      brandStats[brandCode] = {
        total: 0,
        actualCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        planCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        avgActualHours: 0,
        avgPlanHours: 0,
        slaMatchedCount: 0,
        totalActualHours: 0,
        totalPlanHours: 0
      };
    }
    brandStats[brandCode].total += orders;
    brandStats[brandCode].actualCategories['24H'] += actualCount24H;
    brandStats[brandCode].actualCategories['48H'] += actualCount48H;
    brandStats[brandCode].actualCategories['72H'] += actualCount72H;
    brandStats[brandCode].actualCategories['72H+'] += actualCount72HPlus;
    brandStats[brandCode].planCategories['24H'] += planCount24H;
    brandStats[brandCode].planCategories['48H'] += planCount48H;
    brandStats[brandCode].planCategories['72H'] += planCount72H;
    brandStats[brandCode].planCategories['72H+'] += planCount72HPlus;
    brandStats[brandCode].totalActualHours += avgActualHours * orders;
    brandStats[brandCode].totalPlanHours += avgPlanHours * orders;
    if (avgPlanHours > 0) {
      brandStats[brandCode].slaMatchedCount += orders;
    }
    
    // 快递商统计
    if (!carrierStats[carrierId]) {
      carrierStats[carrierId] = {
        total: 0,
        actualCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        planCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        avgActualHours: 0,
        avgPlanHours: 0,
        slaMatchedCount: 0,
        totalActualHours: 0,
        totalPlanHours: 0
      };
    }
    carrierStats[carrierId].total += orders;
    carrierStats[carrierId].actualCategories['24H'] += actualCount24H;
    carrierStats[carrierId].actualCategories['48H'] += actualCount48H;
    carrierStats[carrierId].actualCategories['72H'] += actualCount72H;
    carrierStats[carrierId].actualCategories['72H+'] += actualCount72HPlus;
    carrierStats[carrierId].planCategories['24H'] += planCount24H;
    carrierStats[carrierId].planCategories['48H'] += planCount48H;
    carrierStats[carrierId].planCategories['72H'] += planCount72H;
    carrierStats[carrierId].planCategories['72H+'] += planCount72HPlus;
    carrierStats[carrierId].totalActualHours += avgActualHours * orders;
    carrierStats[carrierId].totalPlanHours += avgPlanHours * orders;
    if (avgPlanHours > 0) {
      carrierStats[carrierId].slaMatchedCount += orders;
    }
    
    // 新增：品牌×快递商交叉统计
    const crossKey = `${brandCode}|${carrierId}`;
    if (!brandCarrierStats[crossKey]) {
      brandCarrierStats[crossKey] = {
        brandCode,
        carrierId,
        total: 0,
        actualCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        planCategories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        avgActualHours: 0,
        avgPlanHours: 0,
        slaMatchedCount: 0,
        totalActualHours: 0,
        totalPlanHours: 0
      };
    }
    brandCarrierStats[crossKey].total += orders;
    brandCarrierStats[crossKey].actualCategories['24H'] += actualCount24H;
    brandCarrierStats[crossKey].actualCategories['48H'] += actualCount48H;
    brandCarrierStats[crossKey].actualCategories['72H'] += actualCount72H;
    brandCarrierStats[crossKey].actualCategories['72H+'] += actualCount72HPlus;
    brandCarrierStats[crossKey].planCategories['24H'] += planCount24H;
    brandCarrierStats[crossKey].planCategories['48H'] += planCount48H;
    brandCarrierStats[crossKey].planCategories['72H'] += planCount72H;
    brandCarrierStats[crossKey].planCategories['72H+'] += planCount72HPlus;
    brandCarrierStats[crossKey].totalActualHours += avgActualHours * orders;
    brandCarrierStats[crossKey].totalPlanHours += avgPlanHours * orders;
    if (avgPlanHours > 0) {
      brandCarrierStats[crossKey].slaMatchedCount += orders;
    }
  });
  
  // 计算平均值
  Object.keys(brandStats).forEach(brand => {
    if (brandStats[brand].total > 0) {
      brandStats[brand].avgActualHours = Math.round((brandStats[brand].totalActualHours / brandStats[brand].total) * 100) / 100;
      brandStats[brand].avgPlanHours = Math.round((brandStats[brand].totalPlanHours / brandStats[brand].total) * 100) / 100;
    }
  });
  
  Object.keys(carrierStats).forEach(carrier => {
    if (carrierStats[carrier].total > 0) {
      carrierStats[carrier].avgActualHours = Math.round((carrierStats[carrier].totalActualHours / carrierStats[carrier].total) * 100) / 100;
      carrierStats[carrier].avgPlanHours = Math.round((carrierStats[carrier].totalPlanHours / carrierStats[carrier].total) * 100) / 100;
    }
  });
  
  // 新增：计算品牌×快递商交叉统计的平均值
  Object.keys(brandCarrierStats).forEach(key => {
    if (brandCarrierStats[key].total > 0) {
      brandCarrierStats[key].avgActualHours = Math.round((brandCarrierStats[key].totalActualHours / brandCarrierStats[key].total) * 100) / 100;
      brandCarrierStats[key].avgPlanHours = Math.round((brandCarrierStats[key].totalPlanHours / brandCarrierStats[key].total) * 100) / 100;
    }
  });
  
  console.log(`📋 S2D统计完成（Plan vs Actual）:`);
  console.log(`  总订单: ${totalOrders}`);
  console.log(`  Actual时效分布: 24H:${actualTotal24H}, 48H:${actualTotal48H}, 72H:${actualTotal72H}, 72H+:${actualTotal72HPlus}`);
  console.log(`  Plan时效分布: 24H:${planTotal24H}, 48H:${planTotal48H}, 72H:${planTotal72H}, 72H+:${planTotal72HPlus}`);
  console.log(`📊 品牌统计: ${Object.keys(brandStats).length}个品牌`);
  console.log(`🚚 快递商统计: ${Object.keys(carrierStats).length}个快递商`);
  console.log(`📊×🚚 品牌×快递商交叉统计: ${Object.keys(brandCarrierStats).length}个组合`);
  
  const result = {
    totalS2DOrders: totalOrders,
    categories: {
      '24H': { 
        actualCount: actualTotal24H, 
        planCount: planTotal24H,
        label: '≤24小时' 
      },
      '48H': { 
        actualCount: actualTotal48H, 
        planCount: planTotal48H,
        label: '24-48小时' 
      },
      '72H': { 
        actualCount: actualTotal72H, 
        planCount: planTotal72H,
        label: '48-72小时' 
      },
      '72H+': { 
        actualCount: actualTotal72HPlus, 
        planCount: planTotal72HPlus,
        label: '72小时以上' 
      }
    },
    brandStats,
    carrierStats,
    brandCarrierStats, // 新增：品牌×快递商交叉统计
    overallAvgActualHours: totalOrders > 0 ? Math.round((
      (actualTotal24H * 12 + actualTotal48H * 36 + actualTotal72H * 60 + actualTotal72HPlus * 96) / totalOrders
    ) * 100) / 100 : 0,
    overallAvgPlanHours: totalOrders > 0 ? Math.round((
      (planTotal24H * 12 + planTotal48H * 36 + planTotal72H * 60 + planTotal72HPlus * 96) / totalOrders
    ) * 100) / 100 : 0
  };
  
  console.log('✅ S2D分析结果（Plan vs Actual）:', {
    totalS2DOrders: result.totalS2DOrders,
    actualCategoryCounts: {
      '24H': result.categories['24H'].actualCount,
      '48H': result.categories['48H'].actualCount,
      '72H': result.categories['72H'].actualCount,
      '72H+': result.categories['72H+'].actualCount
    },
    planCategoryCounts: {
      '24H': result.categories['24H'].planCount,
      '48H': result.categories['48H'].planCount,
      '72H': result.categories['72H'].planCount,
      '72H+': result.categories['72H+'].planCount
    },
    overallAvgActualHours: result.overallAvgActualHours,
    overallAvgPlanHours: result.overallAvgPlanHours
  });
  
  return result;
}

/**
 * S2D时效分析（发运到签收）- 原始版本
 * 分类：≤24小时、24-48小时、48-72小时、72小时以上
 */
function analyzeS2DPerformance(orders) {
  console.log('🚚 执行S2D时效分析（原始版本）...');
  
  const s2dOrders = orders.filter(order => 
    order.S2D_ACTUAL_HOURS !== null && order.S2D_ACTUAL_HOURS >= 0
  );

  console.log(`📋 有效S2D订单数量: ${s2dOrders.length}`);

  const categories = {
    '24H': { count: 0, orders: [], label: '≤24小时' },
    '48H': { count: 0, orders: [], label: '24-48小时' },
    '72H': { count: 0, orders: [], label: '48-72小时' },
    '72H+': { count: 0, orders: [], label: '72小时以上' }
  };

  // 按品牌和快递商统计
  const brandStats = {};
  const carrierStats = {};

  s2dOrders.forEach(order => {
    const hours = order.S2D_ACTUAL_HOURS;
    let category;

    if (hours <= 24) {
      category = '24H';
    } else if (hours <= 48) {
      category = '48H';
    } else if (hours <= 72) {
      category = '72H';
    } else {
      category = '72H+';
    }

    categories[category].count++;
    categories[category].orders.push(order);

    // 品牌统计
    const brand = order.BRAND_CODE;
    if (!brandStats[brand]) {
      brandStats[brand] = { 
        total: 0, 
        categories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        avgHours: 0,
        slaMatchedCount: 0
      };
    }
    brandStats[brand].total++;
    brandStats[brand].categories[category]++;
    
    // 快递商统计
    const carrier = order.CARRIER_NAME;
    if (!carrierStats[carrier]) {
      carrierStats[carrier] = { 
        total: 0, 
        categories: { '24H': 0, '48H': 0, '72H': 0, '72H+': 0 },
        avgHours: 0,
        slaMatchedCount: 0
      };
    }
    carrierStats[carrier].total++;
    carrierStats[carrier].categories[category]++;

    // SLA匹配统计
    if (order.SLA_HOURS) {
      brandStats[brand].slaMatchedCount++;
      carrierStats[carrier].slaMatchedCount++;
    }
  });

  // 计算平均时长
  Object.keys(brandStats).forEach(brand => {
    const brandOrders = s2dOrders.filter(o => o.BRAND_CODE === brand);
    const totalHours = brandOrders.reduce((sum, o) => sum + o.S2D_ACTUAL_HOURS, 0);
    brandStats[brand].avgHours = brandOrders.length > 0 ? 
      Math.round((totalHours / brandOrders.length) * 100) / 100 : 0;
  });

  Object.keys(carrierStats).forEach(carrier => {
    const carrierOrders = s2dOrders.filter(o => o.CARRIER_NAME === carrier);
    const totalHours = carrierOrders.reduce((sum, o) => sum + o.S2D_ACTUAL_HOURS, 0);
    carrierStats[carrier].avgHours = carrierOrders.length > 0 ? 
      Math.round((totalHours / carrierOrders.length) * 100) / 100 : 0;
  });

  return {
    totalS2DOrders: s2dOrders.length,
    categories,
    brandStats,
    carrierStats,
    overallAvgHours: s2dOrders.length > 0 ? 
      Math.round((s2dOrders.reduce((sum, o) => sum + o.S2D_ACTUAL_HOURS, 0) / s2dOrders.length) * 100) / 100 : 0
  };
}

/**
 * C2D时效分析（付款到签收）
 * 分类：0天、1天、2天、2天以上
 */
function analyzeC2DPerformance(orders) {
  console.log('💳 执行C2D时效分析...');
  
  const c2dOrders = orders.filter(order => 
    order.C2D_ACTUAL_DAYS !== null && order.C2D_ACTUAL_DAYS >= 0
  );

  console.log(`📋 有效C2D订单数量: ${c2dOrders.length}`);

  const categories = {
    '0d': { count: 0, orders: [], label: '当天完成' },
    '1d': { count: 0, orders: [], label: '1天内完成' },
    '2d': { count: 0, orders: [], label: '2天内完成' },
    '2d+': { count: 0, orders: [], label: '2天以上' }
  };

  // 按品牌和快递商统计
  const brandStats = {};
  const carrierStats = {};

  c2dOrders.forEach(order => {
    const days = order.C2D_ACTUAL_DAYS;
    let category;

    if (days < 1) {
      category = '0d';
    } else if (days < 2) {
      category = '1d';
    } else if (days <= 2) {
      category = '2d';
    } else {
      category = '2d+';
    }

    categories[category].count++;
    categories[category].orders.push(order);

    // 品牌统计
    const brand = order.BRAND_CODE;
    if (!brandStats[brand]) {
      brandStats[brand] = { 
        total: 0, 
        categories: { '0d': 0, '1d': 0, '2d': 0, '2d+': 0 },
        avgDays: 0,
        slaMatchedCount: 0
      };
    }
    brandStats[brand].total++;
    brandStats[brand].categories[category]++;
    
    // 快递商统计
    const carrier = order.CARRIER_NAME;
    if (!carrierStats[carrier]) {
      carrierStats[carrier] = { 
        total: 0, 
        categories: { '0d': 0, '1d': 0, '2d': 0, '2d+': 0 },
        avgDays: 0,
        slaMatchedCount: 0
      };
    }
    carrierStats[carrier].total++;
    carrierStats[carrier].categories[category]++;

    // SLA匹配统计
    if (order.SLA_HOURS) {
      brandStats[brand].slaMatchedCount++;
      carrierStats[carrier].slaMatchedCount++;
    }
  });

  // 计算平均天数
  Object.keys(brandStats).forEach(brand => {
    const brandOrders = c2dOrders.filter(o => o.BRAND_CODE === brand);
    const totalDays = brandOrders.reduce((sum, o) => sum + o.C2D_ACTUAL_DAYS, 0);
    brandStats[brand].avgDays = brandOrders.length > 0 ? 
      Math.round((totalDays / brandOrders.length) * 100) / 100 : 0;
  });

  Object.keys(carrierStats).forEach(carrier => {
    const carrierOrders = c2dOrders.filter(o => o.CARRIER_NAME === carrier);
    const totalDays = carrierOrders.reduce((sum, o) => sum + o.C2D_ACTUAL_DAYS, 0);
    carrierStats[carrier].avgDays = carrierOrders.length > 0 ? 
      Math.round((totalDays / carrierOrders.length) * 100) / 100 : 0;
  });

  return {
    totalC2DOrders: c2dOrders.length,
    categories,
    brandStats,
    carrierStats,
    overallAvgDays: c2dOrders.length > 0 ? 
      Math.round((c2dOrders.reduce((sum, o) => sum + o.C2D_ACTUAL_DAYS, 0) / c2dOrders.length) * 100) / 100 : 0
  };
}

/**
 * 从聚合统计数据计算SLA匹配统计信息
 */
function calculateMatchingStatisticsFromStats(stats) {
  let totalOrders = 0;
  let slaMatchedOrders = 0;
  let completedOrders = 0;
  
  const brandMatching = {};
  const carrierMatching = {};
  
  stats.forEach(stat => {
    const brandCode = String(stat.BRAND_CODE || '');
    const carrierId = String(stat.CARRIER_ID || '');
    const orders = Number(stat.TOTAL_S2D_ORDERS) || 0;
    const hasSLA = stat.PLAN_S2D_HOURS && Number(stat.PLAN_S2D_HOURS) > 0;
    
    totalOrders += orders;
    completedOrders += orders; // 聚合查询只包含已完成订单(DIS_STATUS=99)
    if (hasSLA) slaMatchedOrders += orders;
    
    // 品牌匹配统计
    if (!brandMatching[brandCode]) {
      brandMatching[brandCode] = { total: 0, matched: 0, completed: 0 };
    }
    brandMatching[brandCode].total += orders;
    brandMatching[brandCode].completed += orders;
    if (hasSLA) brandMatching[brandCode].matched += orders;
    
    // 快递商匹配统计
    if (!carrierMatching[carrierId]) {
      carrierMatching[carrierId] = { total: 0, matched: 0, completed: 0 };
    }
    carrierMatching[carrierId].total += orders;
    carrierMatching[carrierId].completed += orders;
    if (hasSLA) carrierMatching[carrierId].matched += orders;
  });
  
  return {
    totalOrders,
    slaMatchedOrders,
    completedOrders,
    overallMatchingRate: totalOrders > 0 ? Math.round((slaMatchedOrders / totalOrders) * 100) : 0,
    completionRate: 100, // 聚合查询只包含已完成订单
    brandMatching,
    carrierMatching
  };
}

/**
 * 计算SLA匹配统计信息 - 原始版本
 */
function calculateMatchingStatistics(orders) {
  const totalOrders = orders.length;
  const slaMatchedOrders = orders.filter(order => order.SLA_HOURS !== null).length;
  const completedOrders = orders.filter(order => order.DIS_STATUS === '99').length;
  
  // 按品牌统计匹配率
  const brandMatching = {};
  const carrierMatching = {};
  
  orders.forEach(order => {
    const brand = order.BRAND_CODE;
    const carrier = order.CARRIER_NAME;
    
    // 品牌匹配统计
    if (!brandMatching[brand]) {
      brandMatching[brand] = { total: 0, matched: 0, completed: 0 };
    }
    brandMatching[brand].total++;
    if (order.SLA_HOURS !== null) brandMatching[brand].matched++;
    if (order.DIS_STATUS === '99') brandMatching[brand].completed++;
    
    // 快递商匹配统计
    if (!carrierMatching[carrier]) {
      carrierMatching[carrier] = { total: 0, matched: 0, completed: 0 };
    }
    carrierMatching[carrier].total++;
    if (order.SLA_HOURS !== null) carrierMatching[carrier].matched++;
    if (order.DIS_STATUS === '99') carrierMatching[carrier].completed++;
  });

  return {
    totalOrders,
    slaMatchedOrders,
    completedOrders,
    overallMatchingRate: totalOrders > 0 ? Math.round((slaMatchedOrders / totalOrders) * 100) : 0,
    completionRate: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
    brandMatching,
    carrierMatching
  };
}

/**
 * 获取SLA匹配状态
 */
export async function getSLAMatchingStatus(options = {}) {
  const { brand, dateRange } = options;
  
  try {
    const { executeQuery } = await import('../config/database.js');
    
    // VF品牌映射 - 只分析这5个品牌
    const VF_BRAND_MAPPING = {
      'DICKIES': '18405',
      'TNF': '18405-1', 
      'ICEBREAKER': '18405-2',
      'VANS': '18405-3',
      'TIMBERLAND': '18405-4'
    };
    
    // VF品牌代码数组
    const VF_BRAND_CODES = Object.values(VF_BRAND_MAPPING);
    
    // 查询时效SLA数据覆盖情况
    const slaQuery = `
      SELECT 
        sla.BRAND_CODE,
        sla.CARRIER_NAME,
        ba.AREA_NAME as CITY_NAME,
        sla.TIME_VALUE,
        sla.IS_OVERTIME,
        COUNT(*) as SLA_RECORD_COUNT
      FROM APP_CMS.TSK_TIMELINESS_DATA sla
      LEFT JOIN APP_CMS.BAS_AREA ba ON sla.AREA_ID = ba.AREA_ID
      ${brand ? 'WHERE sla.BRAND_CODE = :brand' : ''}
      GROUP BY sla.BRAND_CODE, sla.CARRIER_NAME, ba.AREA_NAME, sla.TIME_VALUE, sla.IS_OVERTIME
      ORDER BY sla.BRAND_CODE, sla.CARRIER_NAME
    `;
    
    const params = brand ? { brand } : {};
    const slaResult = await executeQuery(slaQuery, params);
    
    // 统计SLA覆盖情况 - 只统计VF品牌数据
    const brandCoverage = {};
    const carrierCoverage = {};
    
    slaResult.rows.forEach(row => {
      const brandCode = row.BRAND_CODE;
      const carrierName = row.CARRIER_NAME;
      
      // 只处理VF的5个品牌数据
      if (!VF_BRAND_CODES.includes(brandCode)) {
        return;
      }
      
      if (!brandCoverage[brandCode]) {
        brandCoverage[brandCode] = { carriers: new Set(), cities: new Set(), totalRecords: 0 };
      }
      brandCoverage[brandCode].carriers.add(carrierName);
      brandCoverage[brandCode].cities.add(row.CITY_NAME);
      brandCoverage[brandCode].totalRecords += parseInt(row.SLA_RECORD_COUNT);
      
      if (!carrierCoverage[carrierName]) {
        carrierCoverage[carrierName] = { brands: new Set(), cities: new Set(), totalRecords: 0 };
      }
      carrierCoverage[carrierName].brands.add(brandCode);
      carrierCoverage[carrierName].cities.add(row.CITY_NAME);
      carrierCoverage[carrierName].totalRecords += parseInt(row.SLA_RECORD_COUNT);
    });

    // 转换Set为数组便于前端显示
    Object.keys(brandCoverage).forEach(brand => {
      brandCoverage[brand].carriers = Array.from(brandCoverage[brand].carriers);
      brandCoverage[brand].cities = Array.from(brandCoverage[brand].cities);
    });
    
    Object.keys(carrierCoverage).forEach(carrier => {
      carrierCoverage[carrier].brands = Array.from(carrierCoverage[carrier].brands);
      carrierCoverage[carrier].cities = Array.from(carrierCoverage[carrier].cities);
    });

    return {
      totalSLARecords: slaResult.rows.length,
      brandCoverage,
      carrierCoverage,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('获取SLA匹配状态失败:', error);
    throw error;
  }
}