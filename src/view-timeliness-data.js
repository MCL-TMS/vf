#!/usr/bin/env node

/**
 * 时效数据查看工具
 * 
 * 用途：快速查看上传的时效表数据
 * 运行：node view-timeliness-data.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n📊 VF物流时效数据查看工具\n');
console.log('='.repeat(80));

const TIMELINESS_DIR = path.join(__dirname, 'backend/uploads/timeliness');
const METADATA_FILE = path.join(TIMELINESS_DIR, 'metadata.json');

/**
 * 检查目录是否存在
 */
function checkDirectory() {
  console.log('\n📁 检查存储目录...');
  
  if (!fs.existsSync(TIMELINESS_DIR)) {
    console.log(`   ❌ 时效数据目录不存在: ${TIMELINESS_DIR}`);
    console.log('\n💡 提示：');
    console.log('   - 该目录在首次上传时效表格时自动创建');
    console.log('   - 请先在前端上传时效Excel表格');
    console.log('   - 上传成功后再运行此脚本查看数据\n');
    return false;
  }
  
  console.log(`   ✅ 目录存在: ${TIMELINESS_DIR}`);
  
  // 列出目录中的所有文件
  const files = fs.readdirSync(TIMELINESS_DIR);
  console.log(`   📂 目录包含 ${files.length} 个文件:`);
  files.forEach(file => {
    const filePath = path.join(TIMELINESS_DIR, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`      - ${file} (${sizeKB} KB)`);
  });
  
  return true;
}

/**
 * 读取并显示元数据
 */
function displayMetadata() {
  console.log('\n📋 元数据信息...');
  
  if (!fs.existsSync(METADATA_FILE)) {
    console.log('   ⚠️  metadata.json 文件不存在');
    console.log('   💡 该文件应该在上传时效表格时自动创建\n');
    return null;
  }
  
  try {
    const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
    
    console.log(`   ✅ 元数据文件读取成功`);
    console.log(`   📅 最后更新: ${metadata.lastUpdated || '未知'}`);
    console.log(`   🎯 当前活跃版本: ${metadata.activeFileId || '未设置'}`);
    console.log(`   📦 历史版本总数: ${metadata.files?.length || 0}`);
    
    return metadata;
  } catch (error) {
    console.log(`   ❌ 读取元数据失败: ${error.message}`);
    return null;
  }
}

/**
 * 显示所有版本列表
 */
function displayVersions(metadata) {
  if (!metadata || !metadata.files || metadata.files.length === 0) {
    console.log('\n⚠️  未找到任何时效数据文件\n');
    return;
  }
  
  console.log('\n📚 时效数据文件列表:\n');
  
  metadata.files.forEach((file, index) => {
    const isActive = file.fileId === metadata.activeFileId;
    const statusIcon = isActive ? '✅' : '⏸️ ';
    const statusText = isActive ? '当前使用' : '历史版本';
    
    console.log(`${index + 1}. ${statusIcon} ${file.fileName}`);
    console.log(`   文件ID: ${file.fileId}`);
    console.log(`   上传时间: ${new Date(file.uploadTime).toLocaleString('zh-CN')}`);
    console.log(`   记录数量: ${file.recordCount?.toLocaleString() || '未知'} 条`);
    console.log(`   状态: ${statusText}`);
    console.log(`   文件路径: ${file.filePath}`);
    console.log('');
  });
}

/**
 * 显示活跃数据的详细信息
 */
function displayActiveData(metadata) {
  if (!metadata || !metadata.activeFileId) {
    console.log('\n⚠️  未设置活跃版本\n');
    return;
  }
  
  const activeFile = metadata.files.find(f => f.fileId === metadata.activeFileId);
  
  if (!activeFile) {
    console.log(`\n⚠️  未找到活跃文件: ${metadata.activeFileId}\n`);
    return;
  }
  
  console.log('\n🎯 当前活跃数据详情:\n');
  console.log(`文件名: ${activeFile.fileName}`);
  console.log(`上传时间: ${new Date(activeFile.uploadTime).toLocaleString('zh-CN')}`);
  console.log(`记录总数: ${activeFile.recordCount?.toLocaleString() || '未知'} 条\n`);
  
  // 读取数据文件
  const dataFilePath = path.join(__dirname, activeFile.filePath);
  
  if (!fs.existsSync(dataFilePath)) {
    console.log(`❌ 数据文件不存在: ${dataFilePath}\n`);
    return;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
    
    console.log('📊 数据统计分析:\n');
    
    // 统计品牌分布
    const brandCounts = {};
    const carrierCounts = {};
    const cityCounts = {};
    
    data.data.forEach(record => {
      // 品牌统计
      brandCounts[record.BRAND_CODE] = (brandCounts[record.BRAND_CODE] || 0) + 1;
      // 快递商统计
      carrierCounts[record.CARRIER_NAME] = (carrierCounts[record.CARRIER_NAME] || 0) + 1;
      // 城市统计
      cityCounts[record.CITY_NAME] = (cityCounts[record.CITY_NAME] || 0) + 1;
    });
    
    console.log('📦 品牌分布:');
    Object.entries(brandCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([brand, count]) => {
        console.log(`   ${brand}: ${count} 条`);
      });
    
    console.log('\n🚚 快递商分布 (Top 10):');
    Object.entries(carrierCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([carrier, count]) => {
        console.log(`   ${carrier}: ${count} 条`);
      });
    
    console.log(`\n🌍 城市覆盖: ${Object.keys(cityCounts).length} 个城市`);
    
    // 时效值统计
    const timeValues = data.data.map(r => r.TIME_VALUE).filter(v => v != null);
    if (timeValues.length > 0) {
      const minTime = Math.min(...timeValues);
      const maxTime = Math.max(...timeValues);
      const avgTime = timeValues.reduce((a, b) => a + b, 0) / timeValues.length;
      
      console.log(`\n⏱️  时效值范围:`);
      console.log(`   最小值: ${minTime} 小时`);
      console.log(`   最大值: ${maxTime} 小时`);
      console.log(`   平均值: ${avgTime.toFixed(1)} 小时`);
    }
    
    // 显示前10条记录
    console.log('\n📝 数据预览（前10条）:\n');
    data.data.slice(0, 10).forEach((record, index) => {
      console.log(`${index + 1}. ${record.CARRIER_NAME} → ${record.CITY_NAME} (${record.BRAND_CODE}): ${record.TIME_VALUE}小时`);
    });
    
    if (data.data.length > 10) {
      console.log(`\n... 还有 ${data.data.length - 10} 条记录未显示`);
    }
    
    // 元数据
    if (data.metadata) {
      console.log('\n📌 文件元信息:');
      console.log(`   上传者: ${data.metadata.uploader || '未知'}`);
      console.log(`   备注: ${data.metadata.remarks || '无'}`);
      console.log(`   版本: ${data.metadata.version || '未知'}`);
    }
    
  } catch (error) {
    console.log(`❌ 读取数据文件失败: ${error.message}\n`);
  }
}

/**
 * 数据完整性检查
 */
function validateData(metadata) {
  if (!metadata || !metadata.files || metadata.files.length === 0) {
    return;
  }
  
  console.log('\n🔍 数据完整性检查:\n');
  
  let hasIssues = false;
  
  metadata.files.forEach((file, index) => {
    const dataFilePath = path.join(__dirname, file.filePath);
    
    if (!fs.existsSync(dataFilePath)) {
      console.log(`   ❌ 文件${index + 1}: 数据文件缺失 (${file.fileName})`);
      hasIssues = true;
    } else {
      try {
        const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
        
        if (!data.data || !Array.isArray(data.data)) {
          console.log(`   ⚠️  文件${index + 1}: 数据格式异常 (${file.fileName})`);
          hasIssues = true;
        } else if (data.data.length !== file.recordCount) {
          console.log(`   ⚠️  文件${index + 1}: 记录数不匹配 (${file.fileName})`);
          console.log(`      元数据: ${file.recordCount}, 实际: ${data.data.length}`);
          hasIssues = true;
        } else {
          console.log(`   ✅ 文件${index + 1}: 数据完整 (${file.fileName})`);
        }
      } catch (error) {
        console.log(`   ❌ 文件${index + 1}: 读取失败 - ${error.message}`);
        hasIssues = true;
      }
    }
  });
  
  if (!hasIssues) {
    console.log('\n   🎉 所有文件数据完整，无异常！');
  }
}

/**
 * 提供操作建议
 */
function provideGuidance(metadata) {
  console.log('\n' + '='.repeat(80));
  console.log('\n💡 操作建议:\n');
  
  if (!metadata || !metadata.files || metadata.files.length === 0) {
    console.log('   📤 尚未上传时效数据，建议：');
    console.log('      1. 在前端访问"物流" → "时效分析"');
    console.log('      2. 点击"上传时效表格"按钮');
    console.log('      3. 选择符合格式要求的Excel文件上传');
    console.log('      4. 上传成功后重新运行此脚本查看数据\n');
  } else {
    console.log('   ✅ 已有时效数据，可以进行以下操作：');
    console.log('      1. 在前端点击"执行时效分析"开始分析');
    console.log('      2. 上传新版本的时效表格（会自动替换为活跃版本）');
    console.log('      3. 查看分析结果中的Plan vs Actual对比\n');
    
    console.log('   📂 数据文件位置：');
    console.log(`      ${TIMELINESS_DIR}\n`);
    
    console.log('   📖 相关文档：');
    console.log('      - 详细说明: /TIMELINESS_DATA_STORAGE_LOCATION.md');
    console.log('      - 完整指南: /S2D_TIMELINESS_ANALYSIS_COMPLETE_GUIDE.md');
    console.log('      - 上传指南: /TIMELINESS_UPLOAD_FIX_COMPLETE.md\n');
  }
}

/**
 * 主函数
 */
function main() {
  try {
    // 检查目录
    if (!checkDirectory()) {
      console.log('='.repeat(80) + '\n');
      return;
    }
    
    // 读取元数据
    const metadata = displayMetadata();
    
    // 显示版本列表
    displayVersions(metadata);
    
    // 显示活跃数据详情
    displayActiveData(metadata);
    
    // 数据完整性检查
    validateData(metadata);
    
    // 提供操作建议
    provideGuidance(metadata);
    
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ 发生错误:', error.message);
    console.error('\n请检查：');
    console.error('   1. 项目目录结构是否正确');
    console.error('   2. 是否有文件读取权限');
    console.error('   3. JSON文件格式是否正确\n');
    process.exit(1);
  }
}

// 运行主函数
main();
