#!/usr/bin/env node

/**
 * 🔍 诊断72+识别问题（V2 - 长表格式）
 * 
 * Excel格式：Carrier | City | Brand | SLA
 * 检查SLA列中的"72+"值
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

console.log('\n' + '='.repeat(80));
console.log('🔍 诊断72+数据识别问题（V2 - 长表格式）');
console.log('='.repeat(80) + '\n');

const timelinessDir = path.join(__dirname, 'backend', 'uploads', 'timeliness');
const metadataPath = path.join(timelinessDir, 'metadata.json');

// 1. 读取metadata
if (!fs.existsSync(metadataPath)) {
  console.error('❌ metadata.json不存在\n');
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const activeFile = metadata.files.find(f => f.isActive);

if (!activeFile) {
  console.error('❌ 未找到活动文件\n');
  process.exit(1);
}

console.log('📁 活动文件:');
console.log(`   - 文件名: ${activeFile.fileName}`);
console.log(`   - Excel路径: ${activeFile.excelFilePath}`);
console.log(`   - JSON路径: ${activeFile.jsonFilePath}\n`);

// 2. 检查Excel文件
if (!activeFile.excelFilePath || !fs.existsSync(activeFile.excelFilePath)) {
  console.error('❌ Excel文件不存在\n');
  process.exit(1);
}

console.log('📖 读取Excel文件（长表格式）...\n');
const workbook = XLSX.readFile(activeFile.excelFilePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// 测试不同的读取方式
console.log('🧪 测试1: raw=false (字符串模式，推荐)');
const dataRawFalse = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
console.log(`   - 总行数: ${dataRawFalse.length}`);

const headers = dataRawFalse[0];
console.log(`   - 表头: ${headers.join(', ')}\n`);

// 查找SLA列索引
const slaIndex = headers.findIndex(h => 
  h && h.toString().toLowerCase().includes('sla')
);

console.log(`📊 SLA列索引: ${slaIndex}\n`);

if (slaIndex === -1) {
  console.error('❌ 未找到SLA列\n');
  process.exit(1);
}

// 统计SLA列的值
console.log('📊 SLA列值分布（前20条数据）:');
const slaValues = {};
dataRawFalse.slice(1, 21).forEach((row, index) => {
  const slaValue = row[slaIndex];
  console.log(`   行${index + 2}: "${slaValue}" (类型: ${typeof slaValue})`);
  
  const key = slaValue?.toString() || 'null';
  slaValues[key] = (slaValues[key] || 0) + 1;
});

console.log('\n📊 全部SLA值统计:');
const allSlaValues = {};
dataRawFalse.slice(1).forEach(row => {
  const slaValue = row[slaIndex];
  const key = slaValue?.toString() || 'null';
  allSlaValues[key] = (allSlaValues[key] || 0) + 1;
});

Object.entries(allSlaValues)
  .sort((a, b) => b[1] - a[1])
  .forEach(([value, count]) => {
    const hasPlus = value.includes('+') ? ' ✅ 包含+' : '';
    console.log(`   "${value}": ${count}条${hasPlus}`);
  });

// 查找包含"+"的值
console.log('\n🔍 搜索包含"+"的SLA值...');
const rowsWithPlus = [];
dataRawFalse.slice(1).forEach((row, index) => {
  const slaValue = row[slaIndex];
  if (slaValue && slaValue.toString().includes('+')) {
    rowsWithPlus.push({
      rowNum: index + 2,
      carrier: row[0],
      city: row[1],
      brand: row[2],
      sla: slaValue
    });
  }
});

console.log(`   - 找到${rowsWithPlus.length}条包含"+"的记录\n`);

if (rowsWithPlus.length > 0) {
  console.log('📋 样例（前10条）:');
  rowsWithPlus.slice(0, 10).forEach(item => {
    console.log(`   行${item.rowNum}: ${item.carrier} × ${item.city} × ${item.brand} → "${item.sla}"`);
  });
} else {
  console.log('⚠️ 未找到包含"+"的SLA值！');
  console.log('   可能原因:');
  console.log('   1. Excel单元格格式为数字，"72+"被自动转换为72');
  console.log('   2. 使用了全角"＋"而不是半角"+"');
  console.log('   3. XLSX库读取时自动转换了格式\n');
  
  // 尝试直接读取单元格对象
  console.log('🧪 测试2: 直接读取单元格对象...');
  const cellAddresses = Object.keys(worksheet).filter(k => !k.startsWith('!'));
  const slaColumnLetter = String.fromCharCode(65 + slaIndex); // A=65, B=66, ...
  
  console.log(`   - SLA列字母: ${slaColumnLetter}`);
  
  const slaCells = cellAddresses.filter(addr => addr.startsWith(slaColumnLetter));
  console.log(`   - SLA列单元格数: ${slaCells.length}\n`);
  
  console.log('📋 SLA列单元格详情（前10个）:');
  slaCells.slice(1, 11).forEach(addr => {
    const cell = worksheet[addr];
    console.log(`   ${addr}: type=${cell.t}, value="${cell.v}", formatted="${cell.w}"`);
  });
}

// 3. 检查JSON文件
console.log('\n📖 读取JSON文件...');
if (!activeFile.jsonFilePath || !fs.existsSync(activeFile.jsonFilePath)) {
  console.error('❌ JSON文件不存在\n');
  process.exit(1);
}

const jsonData = JSON.parse(fs.readFileSync(activeFile.jsonFilePath, 'utf8'));
console.log(`   - 总记录数: ${jsonData.length}\n`);

// 统计timeValue分布
const timeValueStats = {};
jsonData.forEach(item => {
  const val = item.timeValue;
  timeValueStats[val] = (timeValueStats[val] || 0) + 1;
});

console.log('📊 JSON中timeValue分布:');
Object.entries(timeValueStats)
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .forEach(([val, count]) => {
    const is72Plus = val == 999 ? ' ✅ (应该是72+)' : '';
    console.log(`   - timeValue=${val}: ${count}条${is72Plus}`);
  });

// 检查是否有rawValue字段
const hasRawValue = jsonData.filter(item => item.rawValue).length;
console.log(`\n📋 JSON中包含rawValue字段的记录: ${hasRawValue}条`);

if (hasRawValue > 0) {
  console.log('   样例（前5条）:');
  jsonData.filter(item => item.rawValue).slice(0, 5).forEach((item, index) => {
    console.log(`   [${index + 1}] rawValue="${item.rawValue}", timeValue=${item.timeValue}`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('✅ 诊断完成');
console.log('='.repeat(80) + '\n');
