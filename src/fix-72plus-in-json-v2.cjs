#!/usr/bin/env node

/**
 * 🔧 修复JSON文件中的72+时效数据（V2 - 长表格式）
 * 
 * Excel格式：Carrier | City | Brand | SLA
 * 问题：SLA列中的"72+"被错误解析为72存储到JSON
 * 解决：从Excel原文件重新读取SLA列，识别"72+"并更新JSON
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

console.log('\n' + '='.repeat(80));
console.log('🔧 修复JSON文件中的72+时效数据（V2 - 长表格式）');
console.log('='.repeat(80) + '\n');

const timelinessDir = path.join(__dirname, 'backend', 'uploads', 'timeliness');
const metadataPath = path.join(timelinessDir, 'metadata.json');

// 1. 读取metadata.json
if (!fs.existsSync(metadataPath)) {
  console.error('❌ 未找到metadata.json文件');
  console.log(`   预期路径: ${metadataPath}\n`);
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
console.log('📋 Metadata信息:');
console.log(`   - 文件数量: ${metadata.files.length}`);
console.log(`   - 活动文件ID: ${metadata.activeFileId}\n`);

// 2. 找到活动的Excel文件
const activeFile = metadata.files.find(f => f.isActive && f.excelFilePath);

if (!activeFile) {
  console.error('❌ 未找到活动的Excel文件');
  console.log('   请确保已上传时效Excel文件\n');
  process.exit(1);
}

console.log('📁 活动Excel文件:');
console.log(`   - 文件名: ${activeFile.fileName}`);
console.log(`   - Excel路径: ${activeFile.excelFilePath}`);
console.log(`   - JSON路径: ${activeFile.jsonFilePath}\n`);

// 3. 检查Excel文件是否存在
if (!fs.existsSync(activeFile.excelFilePath)) {
  console.error(`❌ Excel文件不存在: ${activeFile.excelFilePath}\n`);
  process.exit(1);
}

// 4. 检查JSON文件是否存在
if (!fs.existsSync(activeFile.jsonFilePath)) {
  console.error(`❌ JSON文件不存在: ${activeFile.jsonFilePath}\n`);
  process.exit(1);
}

// 5. 读取现有JSON文件
console.log('📖 读取现有JSON文件...');
const jsonContent = fs.readFileSync(activeFile.jsonFilePath, 'utf8');
let jsonRoot; // ✅ 保存完整的JSON结构
let jsonData; // ✅ data数组

try {
  jsonRoot = JSON.parse(jsonContent);
} catch (error) {
  console.error('❌ JSON解析失败:', error.message);
  console.log(`   文件路径: ${activeFile.jsonFilePath}\n`);
  process.exit(1);
}

// ✅ 检查JSON数据结构
if (!jsonRoot) {
  console.error('❌ JSON文件为空\n');
  process.exit(1);
}

// ✅ 提取data数组，但保持原有结构
if (Array.isArray(jsonRoot)) {
  // 纯数组格式
  console.log(`   - 记录数: ${jsonRoot.length} (纯数组格式)\n`);
  jsonData = jsonRoot;
} else if (typeof jsonRoot === 'object' && jsonRoot.data && Array.isArray(jsonRoot.data)) {
  // { metadata, data } 格式
  console.log(`   - JSON格式: { metadata, data }`);
  console.log(`   - metadata: ${JSON.stringify(jsonRoot.metadata)}`);
  console.log(`   - data记录数: ${jsonRoot.data.length}\n`);
  jsonData = jsonRoot.data; // ✅ 只修改data数组
} else {
  console.error('❌ JSON格式不符合预期\n');
  console.log('   JSON结构预览:');
  console.log(JSON.stringify(jsonRoot, null, 2).slice(0, 500));
  process.exit(1);
}

console.log(`   - 最终数据记录数: ${jsonData.length}\n`);

// 6. 读取Excel文件（长表格式）
console.log('📖 读取Excel文件（长表格式）...');
const workbook = XLSX.readFile(activeFile.excelFilePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// 转换为JSON（保留原始格式）
const excelData = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
  raw: false, // ✅ 保留原始字符串格式，不转换为数字
  defval: ''
});

console.log(`   - Excel总行数: ${excelData.length}`);

const headers = excelData[0];
const dataRows = excelData.slice(1);

console.log(`   - 表头: ${headers.join(', ')}\n`);

// 7. 查找列索引（长表格式）
const carrierIndex = headers.findIndex(h => 
  h && h.toString().toLowerCase().includes('carrier')
);
const cityIndex = headers.findIndex(h => 
  h && h.toString().toLowerCase().includes('city')
);
const brandIndex = headers.findIndex(h => 
  h && h.toString().toLowerCase().includes('brand')
);
const slaIndex = headers.findIndex(h => 
  h && h.toString().toLowerCase().includes('sla')
);

console.log('📊 列索引:');
console.log(`   - Carrier列: ${carrierIndex}`);
console.log(`   - City列: ${cityIndex}`);
console.log(`   - Brand列: ${brandIndex}`);
console.log(`   - SLA列: ${slaIndex}\n`);

if (carrierIndex === -1 || cityIndex === -1 || brandIndex === -1 || slaIndex === -1) {
  console.error('❌ 无法找到必要的列（Carrier/City/Brand/SLA）\n');
  process.exit(1);
}

// 8. 构建Excel原始值映射表 (carrier + city + brand -> 原始SLA值)
console.log('🔍 构建Excel原始值映射表...');
const excelRawValueMap = new Map();

dataRows.forEach((row, rowIndex) => {
  const carrier = row[carrierIndex]?.toString().trim();
  const cityName = row[cityIndex]?.toString().trim();
  const brand = row[brandIndex]?.toString().trim();
  const slaValue = row[slaIndex]; // ✅ 不要立即toString，保留原始值
  
  if (!carrier || !cityName || !brand) return;
  if (!slaValue || slaValue === '-') return;
  
  const key = `${carrier}|${cityName}|${brand}`;
  const rawValue = slaValue.toString().trim();
  excelRawValueMap.set(key, rawValue);
});

console.log(`   - 原始值映射条目: ${excelRawValueMap.size}\n`);

// 9. 查找包含"+"的SLA值
console.log('🔍 搜索包含"+"的SLA值...');
let count72Plus = 0;
const plusSamples = [];

excelRawValueMap.forEach((value, key) => {
  if (value.includes('+')) {
    count72Plus++;
    if (plusSamples.length < 5) {
      const [carrier, city, brand] = key.split('|');
      plusSamples.push({ carrier, city, brand, value });
    }
  }
});

console.log(`   - 包含"+"的SLA值数量: ${count72Plus}\n`);

if (plusSamples.length > 0) {
  console.log('📋 样例（前5条）:');
  plusSamples.forEach((sample, index) => {
    console.log(`   [${index + 1}] ${sample.carrier} × ${sample.city} × ${sample.brand} → "${sample.value}"`);
  });
  console.log('');
}

if (count72Plus === 0) {
  console.log('✅ Excel中没有包含"+"的SLA值，无需修复\n');
  console.log('⚠️ 可能的原因:');
  console.log('   1. Excel中"72+"被存储为数字72（单元格格式为数字）');
  console.log('   2. 使用了全角"＋"而不是半角"+"');
  console.log('   3. XLSX库读取时自动转换了格式\n');
  process.exit(0);
}

// 10. 更新JSON数据
console.log('🔧 开始修复JSON数据...');
let fixedCount = 0;
let unchangedCount = 0;
const fixedSamples = [];

jsonData.forEach((item, index) => {
  const key = `${item.carrier}|${item.cityName}|${item.brand}`;
  const rawValue = excelRawValueMap.get(key);
  
  if (rawValue && rawValue.includes('+')) {
    // 发现需要修复的数据
    const oldValue = item.timeValue;
    item.timeValue = 999;  // ✅ 设置为999标识超时区间
    item.rawValue = rawValue;
    item.isOvertime = true;
    
    fixedCount++;
    
    if (fixedSamples.length < 5) {
      fixedSamples.push({
        carrier: item.carrier,
        city: item.cityName,
        brand: item.brand,
        oldValue,
        newValue: 999,
        rawValue
      });
    }
  } else {
    unchangedCount++;
  }
});

console.log(`\n📊 修复结果:`);
console.log(`   - 修复记录数: ${fixedCount}`);
console.log(`   - 未改变记录数: ${unchangedCount}`);
console.log(`   - JSON总记录数: ${jsonData.length}\n`);

if (fixedSamples.length > 0) {
  console.log('📋 修复样例（前5条）:');
  fixedSamples.forEach((sample, index) => {
    console.log(`   [${index + 1}] ${sample.carrier} × ${sample.city} × ${sample.brand}`);
    console.log(`       - Excel原始值: "${sample.rawValue}"`);
    console.log(`       - 旧JSON值: ${sample.oldValue}`);
    console.log(`       - 新JSON值: ${sample.newValue} (999=超时区间)`);
  });
  console.log('');
}

// 11. 备份原JSON文件
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = activeFile.jsonFilePath + `.backup-${timestamp}`;
fs.copyFileSync(activeFile.jsonFilePath, backupPath);
console.log(`💾 已备份原JSON文件:`);
console.log(`   ${backupPath}\n`);

// 12. 写入修复后的JSON（✅ 保持原有结构）
let outputJson;
if (Array.isArray(jsonRoot)) {
  // 纯数组格式
  outputJson = jsonData;
} else {
  // { metadata, data } 格式 - ✅ 保持原有结构
  outputJson = {
    metadata: jsonRoot.metadata, // ✅ 保留metadata
    data: jsonData // ✅ 使用修复后的data
  };
}

fs.writeFileSync(activeFile.jsonFilePath, JSON.stringify(outputJson, null, 2), 'utf8');
console.log(`✅ 已写入修复后的JSON文件:`);
console.log(`   ${activeFile.jsonFilePath}`);
console.log(`   ✅ 保持原有JSON结构: { metadata, data }\n`);

// 13. 验证修复结果
console.log('🔍 验证修复结果...');
const verifyContent = JSON.parse(fs.readFileSync(activeFile.jsonFilePath, 'utf8'));
const verifyData = Array.isArray(verifyContent) ? verifyContent : verifyContent.data;

const verify72Plus = verifyData.filter(item => item.timeValue === 999).length;
const verify72 = verifyData.filter(item => item.timeValue === 72 && !item.rawValue?.includes('+')).length;
const verify48 = verifyData.filter(item => item.timeValue === 48).length;
const verify24 = verifyData.filter(item => item.timeValue === 24).length;

console.log('📊 JSON中timeValue分布:');
console.log(`   - timeValue=24（24小时达）: ${verify24}条`);
console.log(`   - timeValue=48（48小时达）: ${verify48}条`);
console.log(`   - timeValue=72（72小时达）: ${verify72}条`);
console.log(`   - timeValue=999（72+超时区间）: ${verify72Plus}条 ✅`);
console.log(`   - 总计: ${verifyData.length}条\n`);

console.log('='.repeat(80));
console.log('✅ 修复完成！');
console.log('📋 下一步:');
console.log('   1. 重启后端服务器: cd backend && npm run dev');
console.log('   2. 前端重新执行时效分析（无需重新上传Excel）');
console.log('   3. 检查Plan >72h区间是否有数据');
console.log('='.repeat(80) + '\n');