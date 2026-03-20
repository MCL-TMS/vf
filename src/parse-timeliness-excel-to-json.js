/**
 * 将现有Excel文件解析为JSON缓存
 * 
 * 用法：node parse-timeliness-excel-to-json.js [excel-filename]
 * 如果不指定文件名，自动查找目录中的第一个Excel文件
 */

import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📂 解析时效Excel文件为JSON\n');

// 目录路径
const timelinessDir = path.join(__dirname, 'backend', 'uploads', 'timeliness');
const metadataPath = path.join(timelinessDir, 'metadata.json');

// 检查目录
if (!fs.existsSync(timelinessDir)) {
  console.log('❌ 目录不存在:', timelinessDir);
  console.log('\n请先运行: node initialize-existing-timeliness-file.js\n');
  process.exit(1);
}

// 获取Excel文件
let excelFileName = process.argv[2];
let excelFilePath;

if (excelFileName) {
  excelFilePath = path.join(timelinessDir, excelFileName);
  if (!fs.existsSync(excelFilePath)) {
    console.log(`❌ 文件不存在: ${excelFilePath}\n`);
    process.exit(1);
  }
} else {
  // 自动查找第一个Excel文件
  const files = fs.readdirSync(timelinessDir);
  const excelFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  
  if (excelFiles.length === 0) {
    console.log('❌ 未找到Excel文件\n');
    console.log('请将Excel文件放入:', timelinessDir, '\n');
    process.exit(1);
  }
  
  excelFileName = excelFiles[0];
  excelFilePath = path.join(timelinessDir, excelFileName);
  console.log(`✅ 自动选择文件: ${excelFileName}\n`);
}

console.log(`📄 解析文件: ${excelFileName}`);
console.log(`📍 文件路径: ${excelFilePath}\n`);

// 解析Excel
try {
  const workbook = XLSX.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`✅ Excel读取成功，共${jsonData.length}行数据\n`);
  
  if (jsonData.length === 0) {
    console.log('⚠️  Excel文件为空！\n');
    process.exit(1);
  }
  
  // 检查必需的列
  const firstRow = jsonData[0];
  const hasCarrier = Object.keys(firstRow).some(key => key.toLowerCase().includes('carrier'));
  const hasCity = Object.keys(firstRow).some(key => key.toLowerCase().includes('city'));
  const hasBrand = Object.keys(firstRow).some(key => key.toLowerCase().includes('brand'));
  
  console.log('📋 列检查：');
  console.log(`  - Carrier: ${hasCarrier ? '✅' : '❌'}`);
  console.log(`  - City: ${hasCity ? '✅' : '❌'}`);
  console.log(`  - Brand: ${hasBrand ? '✅' : '❌'}\n`);
  
  if (!hasCarrier || !hasCity || !hasBrand) {
    console.log('❌ Excel缺少必需的列！');
    console.log('必需列：Carrier, City, Brand\n');
    console.log('实际列名：', Object.keys(firstRow).join(', '), '\n');
    process.exit(1);
  }
  
  // 转换数据格式
  console.log('🔄 转换数据格式...\n');
  
  const parsedData = [];
  let validCount = 0;
  let errorCount = 0;
  
  jsonData.forEach((row, index) => {
    try {
      // 查找列名（不区分大小写）
      const carrierKey = Object.keys(row).find(k => k.toLowerCase().includes('carrier'));
      const cityKey = Object.keys(row).find(k => k.toLowerCase().includes('city'));
      const brandKey = Object.keys(row).find(k => k.toLowerCase().includes('brand'));
      
      const carrier = row[carrierKey];
      const cityName = row[cityKey];
      const brand = row[brandKey];
      
      // 查找时效值列（可能是品牌名）
      let timeValue = null;
      for (const key of Object.keys(row)) {
        if (key !== carrierKey && key !== cityKey && key !== brandKey) {
          const val = row[key];
          if (val && val !== '-') {
            const match = val.toString().match(/(\d+)/);
            if (match) {
              timeValue = parseInt(match[1]);
              break;
            }
          }
        }
      }
      
      if (carrier && cityName && brand && timeValue !== null) {
        parsedData.push({
          carrier: carrier.toString().trim(),
          cityName: cityName.toString().trim(),
          brand: brand.toString().trim(),
          timeValue: timeValue,
          areaId: null  // 将通过单独的映射脚本补充
        });
        validCount++;
      } else {
        errorCount++;
      }
      
    } catch (error) {
      console.log(`  ⚠️  行${index + 2}解析失败:`, error.message);
      errorCount++;
    }
  });
  
  console.log(`✅ 数据转换完成：`);
  console.log(`  - 有效记录: ${validCount}`);
  console.log(`  - 错误记录: ${errorCount}`);
  console.log(`  - areaId状态: 需要后续映射（运行 node map-city-to-areaid.js）\n`);
  
  // 显示数据样本
  console.log('📊 数据样本（前5条）：');
  parsedData.slice(0, 5).forEach((item, index) => {
    console.log(`  [${index + 1}] ${item.brand} | ${item.carrier} | ${item.cityName} | ${item.timeValue}h`);
  });
  console.log('');
  
  // 统计分布
  const brandStats = {};
  const carrierStats = {};
  parsedData.forEach(item => {
    brandStats[item.brand] = (brandStats[item.brand] || 0) + 1;
    carrierStats[item.carrier] = (carrierStats[item.carrier] || 0) + 1;
  });
  
  console.log('📈 品牌分布：');
  Object.entries(brandStats).forEach(([brand, count]) => {
    console.log(`  - ${brand}: ${count}条`);
  });
  console.log('');
  
  console.log('📦 快递商分布：');
  Object.entries(carrierStats).forEach(([carrier, count]) => {
    console.log(`  - ${carrier}: ${count}条`);
  });
  console.log('');
  
  // 生成JSON文件
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const fileId = `timeliness_${timestamp}_${randomStr}`;
  const jsonFileName = `${fileId}.json`;
  const jsonFilePath = path.join(timelinessDir, jsonFileName);
  
  const jsonOutput = {
    metadata: {
      fileId: fileId,
      fileName: excelFileName,
      uploadTime: new Date().toISOString(),
      recordCount: validCount,
      source: 'parse-timeliness-excel-to-json.js'
    },
    data: parsedData
  };
  
  fs.writeFileSync(jsonFilePath, JSON.stringify(jsonOutput, null, 2), 'utf-8');
  console.log(`✅ JSON文件已生成: ${jsonFileName}\n`);
  
  // 更新metadata.json
  let metadata = {
    activeFileId: fileId,
    files: []
  };
  
  if (fs.existsSync(metadataPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    } catch (error) {
      console.log('⚠️  读取metadata.json失败，创建新的\n');
    }
  }
  
  // 添加新文件记录
  const fileRecord = {
    fileId: fileId,
    fileName: excelFileName,
    uploadTime: new Date().toISOString(),
    recordCount: validCount,
    excelFilePath: excelFilePath,
    jsonFilePath: jsonFilePath,
    isActive: true
  };
  
  // 将旧文件设为非活跃
  metadata.files.forEach(file => {
    file.isActive = false;
  });
  
  metadata.files.push(fileRecord);
  metadata.activeFileId = fileId;
  
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`✅ metadata.json已更新\n`);
  
  console.log('🎉 解析完成！\n');
  console.log('📁 生成的文件：');
  console.log(`  - JSON缓存: ${jsonFilePath}`);
  console.log(`  - 元数据: ${metadataPath}\n`);
  
  console.log('🚀 下一步：');
  console.log('  1. 映射areaId: node map-city-to-areaid.js  ⭐ 推荐（提升匹配率）');
  console.log('  2. 测试数据加载: node test-file-based-timeliness.js');
  console.log('  3. 启动API服务: cd backend && npm start\n');
  console.log('💡 提示：不运行步骤1也可以，但会使用城市名称匹配（匹配率可能较低）\n');
  
} catch (error) {
  console.log('❌ 解析失败:', error.message);
  console.log('\n错误详情:', error.stack);
  console.log('\n💡 提示：');
  console.log('  1. 确保已安装xlsx包: npm install xlsx');
  console.log('  2. 确认Excel文件格式正确');
  console.log('  3. 检查文件是否损坏\n');
  process.exit(1);
}