/**
 * 一键配置现有时效数据
 * 
 * 自动完成：
 * 1. 检查目录和文件
 * 2. 创建metadata.json（如需要）
 * 3. 解析Excel生成JSON缓存（如需要）
 * 4. 验证配置完整性
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 VF物流时效数据自动配置工具\n');
console.log('='.repeat(60));
console.log('');

const timelinessDir = path.join(__dirname, 'backend', 'uploads', 'timeliness');
const metadataPath = path.join(timelinessDir, 'metadata.json');

// ==================== 步骤1: 检查目录 ====================
console.log('📂 步骤1/4: 检查数据目录\n');

if (!fs.existsSync(timelinessDir)) {
  console.log('❌ 时效数据目录不存在\n');
  console.log('正在创建目录...');
  fs.mkdirSync(timelinessDir, { recursive: true });
  console.log(`✅ 目录已创建: ${timelinessDir}\n`);
  
  console.log('⚠️  目录为空，请将您的时效Excel文件复制到此目录：');
  console.log(`   ${timelinessDir}\n`);
  console.log('然后重新运行此脚本。\n');
  process.exit(0);
}

console.log(`✅ 目录存在: ${timelinessDir}\n`);

// ==================== 步骤2: 扫描文件 ====================
console.log('📄 步骤2/4: 扫描Excel文件\n');

const allFiles = fs.readdirSync(timelinessDir);
const excelFiles = allFiles.filter(file => 
  file.endsWith('.xlsx') || file.endsWith('.xls')
);

if (excelFiles.length === 0) {
  console.log('❌ 未找到Excel文件\n');
  console.log('请将时效Excel文件复制到以下目录：');
  console.log(`   ${timelinessDir}\n`);
  console.log('文件要求：');
  console.log('  - 扩展名: .xlsx 或 .xls');
  console.log('  - 必需列: Carrier, City, Brand');
  console.log('  - SLA值: 24, 48, 72, 72+, -\n');
  process.exit(0);
}

console.log(`找到${excelFiles.length}个Excel文件：`);
excelFiles.forEach((file, index) => {
  const filePath = path.join(timelinessDir, file);
  const stats = fs.statSync(filePath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`  [${index + 1}] ${file} (${sizeKB} KB)`);
});

const targetExcel = excelFiles[0];
const targetExcelPath = path.join(timelinessDir, targetExcel);
console.log(`\n✅ 使用文件: ${targetExcel}\n`);

// ==================== 步骤3: 检查配置 ====================
console.log('📋 步骤3/4: 检查配置文件\n');

const jsonFiles = allFiles.filter(file => 
  file.endsWith('.json') && file !== 'metadata.json'
);
const hasMetadata = fs.existsSync(metadataPath);
const hasJSON = jsonFiles.length > 0;

console.log(`metadata.json: ${hasMetadata ? '✅ 存在' : '❌ 不存在'}`);
console.log(`JSON缓存文件: ${hasJSON ? `✅ ${jsonFiles.length}个` : '❌ 不存在'}\n`);

let needsSetup = false;

if (hasMetadata && hasJSON) {
  console.log('✅ 配置完整，检查元数据...\n');
  
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    
    if (!metadata.activeFileId) {
      console.log('⚠️  未设置活跃文件ID');
      needsSetup = true;
    } else {
      console.log(`✅ 活跃文件ID: ${metadata.activeFileId}`);
    }
    
    if (!metadata.files || metadata.files.length === 0) {
      console.log('⚠️  文件记录为空');
      needsSetup = true;
    } else {
      console.log(`✅ 文件记录: ${metadata.files.length}个\n`);
      
      const activeFile = metadata.files.find(f => f.isActive);
      if (activeFile) {
        console.log('📊 活跃数据信息：');
        console.log(`  - 文件名: ${activeFile.fileName}`);
        console.log(`  - 记录数: ${activeFile.recordCount || 'N/A'}`);
        console.log(`  - 上传时间: ${activeFile.uploadTime}`);
        console.log(`  - JSON路径: ${activeFile.jsonFilePath ? '✅' : '❌'}`);
        console.log(`  - Excel路径: ${activeFile.excelFilePath ? '✅' : '❌'}\n`);
      } else {
        console.log('⚠️  未找到活跃文件记录');
        needsSetup = true;
      }
    }
  } catch (error) {
    console.log(`❌ metadata.json损坏: ${error.message}`);
    needsSetup = true;
  }
} else {
  console.log('⚠️  配置不完整，需要初始化\n');
  needsSetup = true;
}

// ==================== 步骤4: 自动配置 ====================
if (needsSetup) {
  console.log('🔧 步骤4/4: 自动配置\n');
  
  console.log('正在执行自动配置...\n');
  
  // 生成fileId
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const fileId = `timeliness_${timestamp}_${randomStr}`;
  
  // 创建metadata
  const newMetadata = {
    activeFileId: fileId,
    files: [
      {
        fileId: fileId,
        fileName: targetExcel,
        uploadTime: new Date().toISOString(),
        recordCount: 0,  // 将在解析后更新
        excelFilePath: targetExcelPath,
        jsonFilePath: null,  // 将在解析后更新
        isActive: true,
        note: '由setup-existing-timeliness-data.js自动生成'
      }
    ]
  };
  
  fs.writeFileSync(metadataPath, JSON.stringify(newMetadata, null, 2), 'utf-8');
  console.log('✅ metadata.json已创建\n');
  
  console.log('📝 下一步需要生成JSON缓存：\n');
  console.log('请运行以下命令：');
  console.log(`  node parse-timeliness-excel-to-json.js "${targetExcel}"\n`);
  console.log('或通过API上传：');
  console.log('  curl -X POST http://localhost:3001/api/upload/timeliness-excel \\');
  console.log(`    -F "file=@${targetExcelPath}" \\`);
  console.log('    -F "brand=all"\n');
  
} else {
  console.log('🎉 步骤4/4: 配置验证通过\n');
  console.log('✅ 所有配置已就绪！\n');
  
  console.log('🚀 可以直接启动服务：');
  console.log('   cd backend && npm start\n');
  
  console.log('🧪 或运行测试：');
  console.log('   node test-file-based-timeliness.js\n');
}

console.log('='.repeat(60));
console.log('');
console.log('📚 相关文档：');
console.log('  - 快速启动: QUICK_START_FILE_BASED_TIMELINESS.md');
console.log('  - 实施报告: EXCEL_FILE_STORAGE_IMPLEMENTATION_COMPLETE.md');
console.log('  - 测试脚本: test-file-based-timeliness.js\n');