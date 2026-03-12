/**
 * 城市名称到areaId映射工具（CommonJS版本）
 * 
 * 功能：读取已生成的时效JSON文件，通过数据库查询补充areaId字段
 * 用法：node backend/src/scripts/mapCityToAreaId.js
 */

const fs = require('fs');
const path = require('path');
const { initializeDatabase, executeQuery, closeDatabase } = require('../config/database');

console.log('🗺️  城市名称到areaId映射工具\n');
console.log('='.repeat(60));
console.log('');

const timelinessDir = path.join(__dirname, '..', '..', 'uploads', 'timeliness');
const metadataPath = path.join(timelinessDir, 'metadata.json');

async function main() {
  // 步骤1: 检查metadata.json
  console.log('📋 步骤1: 加载元数据\n');

  if (!fs.existsSync(metadataPath)) {
    console.log('❌ 未找到metadata.json');
    console.log('💡 请先运行: node parse-timeliness-excel-to-json.js\n');
    process.exit(1);
  }

  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  } catch (error) {
    console.log('❌ 读取metadata.json失败:', error.message);
    process.exit(1);
  }

  if (!metadata.activeFileId) {
    console.log('❌ 未找到活跃的时效数据文件');
    process.exit(1);
  }

  const activeFile = metadata.files.find(f => f.isActive);
  if (!activeFile || !activeFile.jsonFilePath) {
    console.log('❌ 活跃文件记录不完整');
    process.exit(1);
  }

  console.log(`✅ 找到活跃文件: ${activeFile.fileName}`);
  console.log(`   JSON路径: ${activeFile.jsonFilePath}\n`);

  // 步骤2: 加载JSON数据
  console.log('📂 步骤2: 加载时效数据\n');

  let timelinessData;
  try {
    const jsonContent = fs.readFileSync(activeFile.jsonFilePath, 'utf-8');
    timelinessData = JSON.parse(jsonContent);
  } catch (error) {
    console.log('❌ 读取JSON文件失败:', error.message);
    process.exit(1);
  }

  if (!timelinessData.data || timelinessData.data.length === 0) {
    console.log('❌ JSON文件中没有数据');
    process.exit(1);
  }

  console.log(`✅ 成功加载: ${timelinessData.data.length}条记录\n`);

  // 统计当前areaId情况
  const currentMappedCount = timelinessData.data.filter(item => item.areaId !== null).length;
  console.log(`📊 当前状态:`);
  console.log(`   - 已映射: ${currentMappedCount}条`);
  console.log(`   - 未映射: ${timelinessData.data.length - currentMappedCount}条\n`);

  if (currentMappedCount === timelinessData.data.length) {
    console.log('✅ 所有记录都已有areaId，无需映射\n');
    process.exit(0);
  }

  // 步骤3: 连接数据库获取城市映射
  console.log('🔍 步骤3: 连接数据库获取城市映射\n');

  let cityMappingCache = new Map();

  try {
    console.log('📡 初始化数据库连接池...');
    
    // 初始化数据库连接池
    await initializeDatabase();
    
    console.log('📡 正在查询BAS_AREA表...');
    
    // 查询所有城市映射（直接通过AREA_NAME匹配，不需要AREA_LEVEL字段）
    const cityMappingQuery = `
      SELECT AREA_ID, AREA_NAME 
      FROM APP_CMS.BAS_AREA 
      ORDER BY AREA_ID
    `;
    
    const result = await executeQuery(cityMappingQuery, {});
    
    if (!result || !result.rows || result.rows.length === 0) {
      throw new Error('查询结果为空');
    }
    
    console.log(`✅ 查询成功: ${result.rows.length}个城市\n`);
    
    // 构建映射缓存（支持多种格式）
    console.log('🔨 构建映射缓存...');
    result.rows.forEach(row => {
      // ✅ 使用字段名访问（因为 outFormat: OUT_FORMAT_OBJECT）
      const areaId = row.AREA_ID;
      const areaName = row.AREA_NAME;
      
      if (areaName) {
        // 原始名称
        cityMappingCache.set(areaName, areaId);
        
        // 去掉"市"
        if (areaName.includes('市')) {
          cityMappingCache.set(areaName.replace('市', ''), areaId);
        }
        
        // 去掉"区"
        if (areaName.includes('区')) {
          cityMappingCache.set(areaName.replace('区', ''), areaId);
        }
        
        // 去掉"县"
        if (areaName.includes('县')) {
          cityMappingCache.set(areaName.replace('县', ''), areaId);
        }
        
        // 去掉"自治州"
        if (areaName.includes('自治州')) {
          cityMappingCache.set(areaName.replace('自治州', ''), areaId);
        }
        
        // 去掉"地区"
        if (areaName.includes('地区')) {
          cityMappingCache.set(areaName.replace('地区', ''), areaId);
        }
        
        // 去掉"盟"
        if (areaName.includes('盟')) {
          cityMappingCache.set(areaName.replace('盟', ''), areaId);
        }
      }
    });
    
    console.log(`✅ 缓存构建完成: ${cityMappingCache.size}个映射键\n`);
    
  } catch (dbError) {
    console.log('❌ 数据库连接失败:', dbError.message);
    console.log('\n💡 可能的原因：');
    console.log('   1. 数据库未启动或不可访问');
    console.log('   2. backend/.env 配置不正确');
    console.log('   3. Oracle客户端未正确安装\n');
    console.log('💡 建议：');
    console.log('   1. 检查 backend/.env 文件');
    console.log('   2. 运行 npm run db:test');
    console.log('   3. 如果数据库不可用，仍可使用城市名称匹配\n');
    process.exit(1);
  }

  // 步骤4: 执行映射
  console.log('🔄 步骤4: 执行areaId映射\n');

  let mappedCount = 0;
  let alreadyMappedCount = 0;
  let failedCount = 0;
  const unmappedCities = new Set();

  timelinessData.data.forEach((item, index) => {
    if (item.areaId !== null) {
      alreadyMappedCount++;
      return;
    }
    
    const cityName = item.cityName;
    
    // 尝试多种匹配方式
    const areaId = cityMappingCache.get(cityName) ||
                   cityMappingCache.get(cityName.replace('市', '')) ||
                   cityMappingCache.get(cityName.replace('区', '')) ||
                   cityMappingCache.get(cityName.replace('县', '')) ||
                   cityMappingCache.get(cityName.replace('自治州', '')) ||
                   cityMappingCache.get(cityName.replace('地区', '')) ||
                   cityMappingCache.get(cityName.replace('盟', '')) ||
                   null;
    
    if (areaId) {
      item.areaId = areaId;
      mappedCount++;
    } else {
      failedCount++;
      unmappedCities.add(cityName);
    }
  });

  console.log('✅ 映射完成：');
  console.log(`   - 本次新映射: ${mappedCount}条`);
  console.log(`   - 已有映射: ${alreadyMappedCount}条`);
  console.log(`   - 映射失败: ${failedCount}条`);
  console.log(`   - 总计: ${timelinessData.data.length}条\n`);

  const totalMapped = mappedCount + alreadyMappedCount;
  const mappingRate = ((totalMapped / timelinessData.data.length) * 100).toFixed(2);
  console.log(`📊 总体映射率: ${totalMapped}/${timelinessData.data.length} (${mappingRate}%)\n`);

  if (unmappedCities.size > 0) {
    console.log('⚠️  未能映射的城市（前10个）：');
    const unmappedArray = Array.from(unmappedCities).slice(0, 10);
    unmappedArray.forEach((city, index) => {
      console.log(`   [${index + 1}] ${city}`);
    });
    if (unmappedCities.size > 10) {
      console.log(`   ... 还有${unmappedCities.size - 10}个\n`);
    } else {
      console.log('');
    }
  }

  // 步骤5: 保存更新后的数据
  if (mappedCount > 0) {
    console.log('💾 步骤5: 保存更新\n');
    
    try {
      // 备份原文件
      const backupPath = activeFile.jsonFilePath + '.backup';
      fs.copyFileSync(activeFile.jsonFilePath, backupPath);
      console.log(`✅ 原文件已备份: ${path.basename(backupPath)}`);
      
      // 保存更新后的数据
      fs.writeFileSync(
        activeFile.jsonFilePath,
        JSON.stringify(timelinessData, null, 2),
        'utf-8'
      );
      console.log(`✅ 更新已保存: ${path.basename(activeFile.jsonFilePath)}\n`);
      
      // 显示样本
      console.log('📊 更新后的数据样本（前5条）：');
      timelinessData.data.slice(0, 5).forEach((item, index) => {
        const areaIdDisplay = item.areaId ? `areaId:${item.areaId}` : 'areaId:无';
        console.log(`  [${index + 1}] ${item.brand} | ${item.carrier} | ${item.cityName} | ${item.timeValue}h | ${areaIdDisplay}`);
      });
      console.log('');
      
    } catch (saveError) {
      console.log('❌ 保存失败:', saveError.message);
      await closeDatabase();
      process.exit(1);
    }
  } else {
    console.log('ℹ️  步骤5: 无需保存（没有新映射）\n');
  }

  console.log('='.repeat(60));
  console.log('');
  console.log('🎉 映射完成！\n');

  if (mappingRate >= 90) {
    console.log('✅ 映射率优秀（≥90%），可以直接使用');
  } else if (mappingRate >= 70) {
    console.log('⚠️  映射率一般（70-90%），建议检查未映射的城市');
  } else {
    console.log('❌ 映射率较低（<70%），建议手动补充映射');
  }

  console.log('\n🚀 下一步：');
  console.log('   1. 测试数据加载: node test-file-based-timeliness.js');
  console.log('   2. 启动API服务: npm start');
  console.log('   3. 执行时效分析: 前端选择日期范围后点击"分析"\n');

  // 关闭数据库连接
  console.log('🔄 关闭数据库连接...');
  await closeDatabase();
  console.log('✅ 数据库连接已关闭\n');
}

// 运行主函数
main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});