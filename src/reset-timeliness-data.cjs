#!/usr/bin/env node

/**
 * 🗑️ 清理时效数据，准备重新上传
 * 
 * 用途：删除所有已存储的时效JSON文件，保留Excel原文件
 * 下一步：重新上传时效Excel，触发新的解析逻辑（已修复的parseTimeValue）
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('🗑️ 清理时效数据文件');
console.log('='.repeat(80) + '\n');

const timelinessDir = path.join(__dirname, 'backend', 'uploads', 'timeliness');
const metadataPath = path.join(timelinessDir, 'metadata.json');

// 1. 检查目录是否存在
if (!fs.existsSync(timelinessDir)) {
  console.log('✅ 时效数据目录不存在，无需清理\n');
  process.exit(0);
}

// 2. 读取metadata.json
if (!fs.existsSync(metadataPath)) {
  console.log('⚠️ metadata.json不存在，跳过元数据清理\n');
} else {
  console.log('📋 读取metadata.json...');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  console.log(`   - 当前文件数: ${metadata.files.length}\n`);
  
  // 3. 列出所有文件
  console.log('📁 当前时效数据文件:');
  metadata.files.forEach((file, index) => {
    console.log(`   [${index + 1}] ${file.fileName} (${file.isActive ? '活动' : '非活动'})`);
    if (file.excelFilePath) {
      console.log(`       Excel: ${fs.existsSync(file.excelFilePath) ? '✅存在' : '❌不存在'}`);
    }
    if (file.jsonFilePath) {
      console.log(`       JSON: ${fs.existsSync(file.jsonFilePath) ? '✅存在' : '❌不存在'}`);
    }
  });
  console.log('');
}

// 4. 询问用户确认
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️ 此操作将:');
console.log('   1. 删除所有JSON缓存文件（.json）');
console.log('   2. 保留Excel原文件（.xlsx）');
console.log('   3. 清空metadata.json\n');

rl.question('是否继续？(y/n): ', (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log('\n❌ 操作已取消\n');
    rl.close();
    process.exit(0);
  }
  
  console.log('\n🗑️ 开始清理...\n');
  
  // 5. 删除JSON文件
  const files = fs.readdirSync(timelinessDir);
  let deletedJsonCount = 0;
  let preservedExcelCount = 0;
  
  files.forEach(file => {
    const filePath = path.join(timelinessDir, file);
    
    if (file.endsWith('.json') && file !== 'metadata.json') {
      fs.unlinkSync(filePath);
      console.log(`   ✅ 删除JSON: ${file}`);
      deletedJsonCount++;
    } else if (file.endsWith('.xlsx') || file.endsWith('.xls')) {
      console.log(`   ⏸️ 保留Excel: ${file}`);
      preservedExcelCount++;
    }
  });
  
  // 6. 重置metadata.json
  const newMetadata = {
    files: [],
    activeFileId: null,
    latestFileId: null,
    lastUpdated: new Date().toISOString()
  };
  
  fs.writeFileSync(metadataPath, JSON.stringify(newMetadata, null, 2), 'utf8');
  console.log(`   ✅ 重置metadata.json\n`);
  
  console.log('📊 清理结果:');
  console.log(`   - 删除JSON文件: ${deletedJsonCount}个`);
  console.log(`   - 保留Excel文件: ${preservedExcelCount}个\n`);
  
  console.log('='.repeat(80));
  console.log('✅ 清理完成！');
  console.log('📋 下一步: 重新上传时效Excel文件');
  console.log('   - 修复后的parseTimeValue函数会正确识别"72+"');
  console.log('   - 新生成的JSON文件将包含正确的timeValue=999');
  console.log('='.repeat(80) + '\n');
  
  rl.close();
});
