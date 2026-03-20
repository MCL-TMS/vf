#!/usr/bin/env node

/**
 * 🔧 修复JSON文件中的72+时效数据
 * 
 * 问题：Excel中的"72+"被错误解析为72存储到JSON
 * 解决：从Excel原文件重新读取，识别"72+"并更新JSON
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

console.log('\n' + '='.repeat(80));
console.log('🔧 修复JSON文件中的72+时效数据');
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
const jsonData = JSON.parse(fs.readFileSync(activeFile.jsonFilePath, 'utf8'));
console.log(`   - 记录数: ${jsonData.length}\n`);

// 6. 读取Excel文件，构建原始值映射
console.log('📖 读取Excel文件，查找原始值...');
const workbook = XLSX.readFile(activeFile.excelFilePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// 转换为JSON（保留原始格式）
const excelData = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
  raw: false, // ✅ 保留原始字符串格式
  defval: ''
});

console.log(`   - Excel总行数: ${excelData.length}`);

const headers = excelData[0];
const dataRows = excelData.slice(1);

// 查找列索引
const carrierIndex = headers.findIndex(h => 
  h && h.toString().toLowerCase().includes('carrier')
);
const cityIndex = headers.findIndex(h => 
  h && h.toString().toLowerCase().includes('city')
);

console.log(`   - Carrier列索引: ${carrierIndex}`);
console.log(`   - City列索引: ${cityIndex}`);

// 查找品牌列
const brandColumns = [];
const brandNames = ['DICKIES', 'ICEBREAKER', 'TNF', 'VANS', 'TIMBERLAND'];

headers.forEach((header, index) => {
  if (header && brandNames.some(brand => 
    header.toString().toUpperCase().includes(brand)
  )) {
    const brandCode = getBrandCode(header.toString());
    brandColumns.push({
      index,
      name: header.toString().trim(),
      brandCode
    });
  }
});

console.log(`   - 品牌列数量: ${brandColumns.length}`);
console.log(`   - 品牌列: ${brandColumns.map(c => c.name).join(', ')}\n`);

// 7. 构建Excel原始值映射表 (carrier + city + brand -> 原始值)
console.log('🔍 构建Excel原始值映射表...');
const excelRawValueMap = new Map();

dataRows.forEach((row, rowIndex) => {
  const carrier = row[carrierIndex]?.toString().trim();
  const cityName = row[cityIndex]?.toString().trim();
  
  if (!carrier || !cityName) return;
  
  brandColumns.forEach(brandCol => {
    const rawValue = row[brandCol.index];
    if (rawValue && rawValue !== '-') {
      const key = `${carrier}|${cityName}|${brandCol.brandCode}`;
      excelRawValueMap.set(key, rawValue.toString().trim());
    }
  });
});

console.log(`   - 原始值映射条目: ${excelRawValueMap.size}\n`);

// 8. 查找"72+"的原始值
let count72Plus = 0;
excelRawValueMap.forEach((value, key) => {
  if (value.includes('+')) {
    count72Plus++;
  }
});

console.log(`📊 Excel中包含"+"的时效值数量: ${count72Plus}\n`);

if (count72Plus === 0) {
  console.log('✅ Excel中没有"72+"数据，无需修复\n');
  process.exit(0);
}

// 9. 更新JSON数据
console.log('🔧 开始修复JSON数据...');
let fixedCount = 0;
let unchangedCount = 0;

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
    
    if (fixedCount <= 5) {
      console.log(`   [${fixedCount}] ${item.carrier} × ${item.cityName} × ${item.brand}`);
      console.log(`       - Excel原始值: "${rawValue}"`);
      console.log(`       - 旧JSON值: ${oldValue}`);
      console.log(`       - 新JSON值: ${item.timeValue} (999=超时区间)`);
    }
  } else {
    unchangedCount++;
  }
});

console.log(`\n✅ 修复完成:`);
console.log(`   - 修复记录数: ${fixedCount}`);
console.log(`   - 未改变记录数: ${unchangedCount}`);
console.log(`   - JSON总记录数: ${jsonData.length}\n`);

// 10. 备份原JSON文件
const backupPath = activeFile.jsonFilePath + '.before-72plus-fix';
fs.copyFileSync(activeFile.jsonFilePath, backupPath);
console.log(`💾 已备份原JSON文件: ${backupPath}\n`);

// 11. 写入修复后的JSON
fs.writeFileSync(activeFile.jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8');
console.log(`✅ 已写入修复后的JSON文件: ${activeFile.jsonFilePath}\n`);

// 12. 验证修复结果
console.log('🔍 验证修复结果...');
const verifyData = JSON.parse(fs.readFileSync(activeFile.jsonFilePath, 'utf8'));
const verify72Plus = verifyData.filter(item => item.timeValue === 999).length;
const verify72 = verifyData.filter(item => item.timeValue === 72 && !item.rawValue?.includes('+')).length;

console.log(`   - timeValue=999的记录数（72+超时区间）: ${verify72Plus}`);
console.log(`   - timeValue=72的记录数（正常72小时）: ${verify72}\n`);

console.log('='.repeat(80));
console.log('✅ 修复完成！请重启后端服务器并重新执行时效分析');
console.log('='.repeat(80) + '\n');

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
  
  return header.trim();
}
