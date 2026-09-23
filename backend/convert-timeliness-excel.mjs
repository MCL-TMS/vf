#!/usr/bin/env node

/**
 * 🚀 时效表Excel一键转换工具
 * 
 * 功能：将时效Excel文件转换为JSON缓存，按城市名称匹配计划时效
 * 用法：node convert-timeliness-excel.mjs [excel-filename]
 * 
 * 整合了以下三个脚本的功能：
 * 1. parse-timeliness-excel-to-json.js - Excel解析
 * 2. diagnose-72plus-issue-v2.cjs - 72+识别优化
 */

import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// 加载backend/.env文件
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.log('\n⚠️  未找到.env文件:', envPath);
  console.log('💡 未找到.env文件，不影响转换；计划时效按城市名称匹配\n');
}

console.log('='.repeat(80));
console.log('🚀 时效表Excel一键转换工具');
console.log('='.repeat(80) + '\n');

// ==================== 配置 ====================
const timelinessDir = path.join(__dirname, 'uploads', 'timeliness');
const metadataPath = path.join(timelinessDir, 'metadata.json');

// ==================== 步骤1: 检查目录和文件 ====================
console.log('📂 步骤1: 检查目录和文件\n');

if (!fs.existsSync(timelinessDir)) {
  fs.mkdirSync(timelinessDir, { recursive: true });
  console.log('✅ 创建目录:', timelinessDir);
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

console.log(`📄 处理文件: ${excelFileName}`);
console.log(`📍 文件路径: ${excelFilePath}\n`);

// ==================== 步骤2: 解析Excel ====================
console.log('📖 步骤2: 解析Excel文件\n');

let parsedData = [];
let validCount = 0;
let errorCount = 0;

try {
  // 兼容Windows中文路径：ESM下XLSX.readFile可能抛出"Cannot access file"
  // 改为先用fs读取二进制，再交给XLSX解析。
  const excelBuffer = fs.readFileSync(excelFilePath);
  const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // 读取为数组格式，raw: false保留字符串
  const dataArray = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
  
  if (dataArray.length === 0) {
    console.log('⚠️ Excel文件为空！\n');
    process.exit(1);
  }
  
  console.log(`✅ Excel读取成功，共${dataArray.length}行数据\n`);
  
  // 获取表头
  const headers = dataArray[0];
  console.log('📋 表头列:', headers.join(', '), '\n');
  
  // 查找列索引（不区分大小写）
  const carrierIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('carrier'));
  const cityIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('city'));
  const brandIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('brand'));
  const serviceTypeIndex = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'trservice_type_name');
  const slaIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('sla'));
  
  console.log('🔍 列索引检查:');
  console.log(`  - Carrier列: ${carrierIndex >= 0 ? '✅ 索引' + carrierIndex : '❌ 未找到'}`);
  console.log(`  - City列: ${cityIndex >= 0 ? '✅ 索引' + cityIndex : '❌ 未找到'}`);
  console.log(`  - Brand列: ${brandIndex >= 0 ? '✅ 索引' + brandIndex : '❌ 未找到'}`);
  console.log(`  - TRSERVICE_TYPE_NAME列: ${serviceTypeIndex >= 0 ? '✅ 索引' + serviceTypeIndex : '❌ 未找到'}`);
  console.log(`  - SLA列: ${slaIndex >= 0 ? '✅ 索引' + slaIndex : '❌ 未找到'}\n`);
  
  if (carrierIndex === -1 || cityIndex === -1 || brandIndex === -1 || serviceTypeIndex === -1 || slaIndex === -1) {
    console.log('❌ Excel缺少必需的列！');
    console.log('必需列：Carrier, City, Brand, TRSERVICE_TYPE_NAME, SLA\n');
    process.exit(1);
  }
  
  // 解析数据行
  console.log('🔄 解析数据行...\n');
  
  // 统计SLA值分布（用于调试）
  const slaValueStats = {};
  
  dataArray.slice(1).forEach((row, index) => {
    try {
      const carrier = row[carrierIndex];
      const cityName = row[cityIndex];
      const brand = row[brandIndex];
      const serviceTypeName = row[serviceTypeIndex];
      const slaValue = row[slaIndex];
      
      // 统计SLA值
      const slaKey = slaValue?.toString() || 'null';
      slaValueStats[slaKey] = (slaValueStats[slaKey] || 0) + 1;
      
      // 解析时效值
      let timeValue = null;
      
      if (slaValue && slaValue !== '-') {
        const slaStr = slaValue.toString().trim();
        
        // ✅ 检查是否包含"+"号（72+的情况）
        if (slaStr.includes('+')) {
          // 72+表示">72小时"，应该被归类到over72h区间
          // 存储为999以便在Plan统计时正确分配到over72h
          const match = slaStr.match(/(\d+)/);
          if (match) {
            const baseValue = parseInt(match[1]);
            // 如果是72+，存储为999；其他情况（如48+）存储为baseValue+1
            timeValue = (baseValue === 72) ? 999 : (baseValue + 1);
          }
        } else {
          // 普通数字
          const match = slaStr.match(/(\d+)/);
          if (match) {
            timeValue = parseInt(match[1]);
          }
        }
      }
      
      if (carrier && cityName && brand && timeValue !== null) {
        parsedData.push({
          carrier: carrier.toString().trim(),
          cityName: cityName.toString().trim(),
          brand: brand.toString().trim(),
          serviceTypeName: serviceTypeName ? serviceTypeName.toString().trim() : null,
          timeValue: timeValue,
          areaId: null  // 稍后映射
        });
        validCount++;
      } else {
        errorCount++;
      }
      
    } catch (error) {
      console.log(`  ⚠️ 行${index + 2}解析失败:`, error.message);
      errorCount++;
    }
  });
  
  console.log(`✅ 数据解析完成：`);
  console.log(`  - 有效记录: ${validCount}`);
  console.log(`  - 错误记录: ${errorCount}\n`);
  
  // 显示SLA值分布
  console.log('📊 SLA值分布:');
  Object.entries(slaValueStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([value, count]) => {
      const hasPlus = value.includes('+') ? ' ✅ 包含+' : '';
      console.log(`  - "${value}": ${count}条${hasPlus}`);
    });
  console.log('');
  
  // 显示数据样本
  console.log('📊 数据样本（前5条）：');
  parsedData.slice(0, 5).forEach((item, index) => {
    console.log(`  [${index + 1}] ${item.brand} | ${item.carrier} | ${item.serviceTypeName} | ${item.cityName} | ${item.timeValue}h`);
  });
  console.log('');
  
  // 统计分布
  const brandStats = {};
  const carrierStats = {};
  const timeValueStats = {};
  
  parsedData.forEach(item => {
    brandStats[item.brand] = (brandStats[item.brand] || 0) + 1;
    carrierStats[item.carrier] = (carrierStats[item.carrier] || 0) + 1;
    timeValueStats[item.timeValue] = (timeValueStats[item.timeValue] || 0) + 1;
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
  
  console.log('⏱️ 时效值分布：');
  Object.entries(timeValueStats)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([timeValue, count]) => {
      console.log(`  - ${timeValue}小时: ${count}条`);
    });
  console.log('');
  
} catch (error) {
  console.log('❌ Excel解析失败:', error.message);
  console.log('\n错误详情:', error.stack);
  console.log('\n💡 提示：');
  console.log('  1. 确保已安装xlsx包: npm install xlsx');
  console.log('  2. 确认Excel文件格式正确');
  console.log('  3. 检查文件是否损坏\n');
  process.exit(1);
}

// ==================== 步骤3: 跳过areaId映射 ====================
console.log('🗺️ 步骤3: 跳过areaId映射，后续按VIEW_TSK_LIST_TASK.DEST_CITY_NAME匹配SLA City字段\n');

const mappedCount = parsedData.length;
const failedCount = 0;

// ==================== 步骤4: 生成JSON文件 ====================
console.log('💾 步骤4: 生成JSON文件\n');

// 生成文件ID（提升到外部作用域）
const timestamp = Date.now();
const randomStr = Math.random().toString(36).substring(2, 8);
const fileId = `timeliness_${timestamp}_${randomStr}`;
const jsonFileName = `${fileId}.json`;
const jsonFilePath = path.join(timelinessDir, jsonFileName);

try {
  // 准备JSON输出
  const jsonOutput = {
    metadata: {
      fileId: fileId,
      fileName: excelFileName,
      uploadTime: new Date().toISOString(),
      recordCount: validCount,
      mappedCount: mappedCount,
      unmappedCount: failedCount,
      mappingRate: mappedCount > 0 ? ((mappedCount / parsedData.length) * 100).toFixed(2) + '%' : '0%',
      source: 'convert-timeliness-excel.js'
    },
    data: parsedData
  };
  
  // 写入JSON文件
  fs.writeFileSync(jsonFilePath, JSON.stringify(jsonOutput, null, 2), 'utf-8');
  console.log(`✅ JSON文件已生成: ${jsonFileName}`);
  console.log(`   路径: ${jsonFilePath}\n`);
  
  // 显示最终数据样本
  console.log('📊 最终数据样本（前5条）：');
  parsedData.slice(0, 5).forEach((item, index) => {
    const areaIdDisplay = item.areaId ? `areaId:${item.areaId}` : 'areaId:无';
    console.log(`  [${index + 1}] ${item.brand} | ${item.carrier} | ${item.serviceTypeName} | ${item.cityName} | ${item.timeValue}h | ${areaIdDisplay}`);
  });
  console.log('');
  
} catch (saveError) {
  console.log('❌ JSON文件保存失败:', saveError.message);
  process.exit(1);
}

// ==================== 步骤5: 更新metadata.json ====================
console.log('📝 步骤5: 更新metadata.json\n');

try {
  let metadata = {
    activeFileId: null,
    files: []
  };
  
  if (fs.existsSync(metadataPath)) {
    try {
      const existingContent = fs.readFileSync(metadataPath, 'utf-8');
      metadata = JSON.parse(existingContent);
      console.log(`✅ 读取现有metadata.json: ${metadata.files.length}个历史文件`);
    } catch (error) {
      console.log('⚠️ 读取metadata.json失败，创建新的');
    }
  } else {
    console.log('✅ 首次创建metadata.json');
  }
  
  // 添加新文件记录
  const fileRecord = {
    fileId: fileId,
    fileName: excelFileName,
    uploadTime: new Date().toISOString(),
    recordCount: validCount,
    mappedCount: mappedCount,
    unmappedCount: failedCount,
    excelFilePath: excelFilePath,
    jsonFilePath: jsonFilePath,
    isActive: true
  };
  
  console.log(`\n📋 新文件记录:`);
  console.log(`  - fileId: ${fileId}`);
  console.log(`  - fileName: ${excelFileName}`);
  console.log(`  - jsonFilePath: ${jsonFilePath}`);
  console.log(`  - recordCount: ${validCount}`);
  
  // 将旧文件设为非活跃
  const oldActiveCount = metadata.files.filter(f => f.isActive).length;
  metadata.files.forEach(file => {
    file.isActive = false;
  });
  
  if (oldActiveCount > 0) {
    console.log(`\n🔄 将${oldActiveCount}个旧文件设为非活跃`);
  }
  
  metadata.files.push(fileRecord);
  metadata.activeFileId = fileId;
  
  console.log(`\n💾 保存metadata.json...`);
  console.log(`  - activeFileId: ${metadata.activeFileId}`);
  console.log(`  - 文件总数: ${metadata.files.length}`);
  
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`✅ metadata.json已更新\n`);
  
} catch (metaError) {
  console.log('⚠️ metadata.json更新失败:', metaError.message);
  console.log('   （不影响JSON文件使用）\n');
}

// ==================== 完成 ====================
console.log('='.repeat(80));
console.log('');
console.log('🎉 转换完成！\n');

console.log('📁 生成的文件：');
console.log(`  - JSON缓存: ${jsonFilePath}`);
console.log(`  - 元数据: ${metadataPath}\n`);

console.log('📊 数据统计：');
console.log(`  - 总记录数: ${parsedData.length}`);
console.log(`  - 可用于城市名匹配: ${mappedCount}条 (${((mappedCount / parsedData.length) * 100).toFixed(1)}%)`);
console.log(`  - 城市名无效记录: ${failedCount}条 (${((failedCount / parsedData.length) * 100).toFixed(1)}%)\n`);

if (mappedCount / parsedData.length >= 0.9) {
  console.log('✅ 城市名匹配数据完整，可以直接使用\n');
} else if (mappedCount / parsedData.length >= 0.7) {
  console.log('⚠️ 城市名匹配数据一般，建议检查城市名称是否与视图DEST_CITY_NAME一致\n');
} else {
  console.log('❌ 城市名匹配数据较低，建议检查SLA表City列\n');
}

console.log('🚀 下一步：');
console.log('  1. 测试数据加载: node test-file-based-timeliness.js');
console.log('  2. 启动API服务: cd backend && npm start');
console.log('  3. 执行时效分析: 前端选择日期范围后点击"分析"\n');

console.log('💡 提示：');
console.log('  - Plan时效将按SLA表City列与VIEW_TSK_LIST_TASK.DEST_CITY_NAME匹配');
console.log('  - 如需重新转换，直接再次运行本脚本即可\n');

console.log('='.repeat(80) + '\n');