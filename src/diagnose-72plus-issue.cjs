#!/usr/bin/env node

/**
 * 🔍 诊断72+识别问题
 * 
 * 检查：
 * 1. Excel原文件中"72+"如何存储
 * 2. JSON文件中"72+"如何被解析
 * 3. XLSX库不同读取模式的效果
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

console.log('\n' + '='.repeat(80));
console.log('🔍 诊断72+数据识别问题');
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

console.log('📖 读取Excel文件...\n');
const workbook = XLSX.readFile(activeFile.excelFilePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// 测试3种不同的读取方式
console.log('🧪 测试1: raw=true (数字模式)');
const data1 = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
console.log(`   - 总行数: ${data1.length}`);
if (data1.length > 1) {
  console.log(`   - 第2行样例: ${JSON.stringify(data1[1].slice(0, 5))}`);
}

console.log('\n🧪 测试2: raw=false (字符串模式)');
const data2 = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
console.log(`   - 总行数: ${data2.length}`);
if (data2.length > 1) {
  console.log(`   - 第2行样例: ${JSON.stringify(data2[1].slice(0, 5))}`);
}

console.log('\n🧪 测试3: 直接读取单元格对象');
// 获取单元格地址列表
const cellAddresses = Object.keys(worksheet).filter(k => !k.startsWith('!'));
console.log(`   - 总单元格数: ${cellAddresses.length}`);

// 查找包含"72"的单元格
let found72Plus = [];
cellAddresses.forEach(addr => {
  const cell = worksheet[addr];
  if (cell && cell.v) {
    const value = cell.v.toString();
    if (value.includes('72')) {
      found72Plus.push({
        address: addr,
        type: cell.t, // 单元格类型: s=字符串, n=数字
        value: cell.v,
        formatted: cell.w // 格式化后的值
      });
    }
  }
});

console.log(`\n📊 包含"72"的单元格（前10个）:`);
found72Plus.slice(0, 10).forEach(cell => {
  console.log(`   ${cell.address}: type=${cell.type}, value="${cell.value}", formatted="${cell.formatted}"`);
});

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
    console.log(`   - timeValue=${val}: ${count}条记录`);
  });

// 查找可能是"72+"的记录
const possible72Plus = jsonData.filter(item => 
  item.timeValue === 72 || item.timeValue === 999 || item.rawValue?.includes('+')
);

console.log(`\n🔍 可能是"72+"的记录（前5条）:`);
possible72Plus.slice(0, 5).forEach((item, index) => {
  console.log(`   [${index + 1}] ${item.carrier} × ${item.cityName} × ${item.brand}`);
  console.log(`       timeValue: ${item.timeValue}`);
  if (item.rawValue) {
    console.log(`       rawValue: "${item.rawValue}"`);
  }
});

// 4. 重新解析Excel，使用完整的单元格信息
console.log('\n🔧 尝试精确匹配...');

// 获取表头
const headers = data2[0];
const carrierIndex = headers.findIndex(h => 
  h && h.toString().toLowerCase().includes('carrier')
);
const cityIndex = headers.findIndex(h => 
  h && h.toString().toLowerCase().includes('city')
);

console.log(`   - Carrier列: ${carrierIndex} (${headers[carrierIndex]})`);
console.log(`   - City列: ${cityIndex} (${headers[cityIndex]})`);

// 查找品牌列
const brandColumns = [];
const brandNames = ['DICKIES', 'ICEBREAKER', 'TNF', 'VANS', 'TIMBERLAND'];

headers.forEach((header, index) => {
  if (header && brandNames.some(brand => 
    header.toString().toUpperCase().includes(brand)
  )) {
    brandColumns.push({
      index,
      name: header.toString().trim()
    });
  }
});

console.log(`   - 品牌列数量: ${brandColumns.length}`);
console.log(`   - 品牌列: ${brandColumns.map(c => c.name).join(', ')}\n`);

// 遍历数据行，查找"+"号
console.log('🔍 搜索包含"+"的时效值...\n');
let foundPlusCount = 0;

data2.slice(1).forEach((row, rowIndex) => {
  brandColumns.forEach(brandCol => {
    const cellValue = row[brandCol.index];
    if (cellValue) {
      const strValue = cellValue.toString();
      if (strValue.includes('+')) {
        foundPlusCount++;
        if (foundPlusCount <= 5) {
          console.log(`   [${foundPlusCount}] 行${rowIndex + 2}, ${brandCol.name}: "${strValue}"`);
        }
      }
    }
  });
});

console.log(`\n📊 结果: 找到${foundPlusCount}个包含"+"的时效值\n`);

if (foundPlusCount === 0) {
  console.log('⚠️ 可能的原因:');
  console.log('   1. Excel中"72+"被存储为数字72（单元格格式为数字）');
  console.log('   2. Excel上传时已经被转换为数字');
  console.log('   3. 单元格中没有"+"符号，可能是其他字符（如中文"＋"）\n');
  
  console.log('💡 解决方案:');
  console.log('   1. 打开Excel文件，检查"72+"单元格的格式');
  console.log('   2. 将单元格格式设置为"文本"');
  console.log('   3. 重新输入"72+"（英文加号）');
  console.log('   4. 保存后重新上传\n');
}

console.log('='.repeat(80));
console.log('✅ 诊断完成');
console.log('='.repeat(80) + '\n');
