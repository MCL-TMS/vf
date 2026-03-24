/**
 * 为现有Excel文件快速创建metadata.json
 * 
 * 用法：node create-timeliness-metadata.js <excel-filename> [record-count]
 * 示例：node create-timeliness-metadata.js 时效标准表.xlsx 1500
 */

const fs = require('fs');
const path = require('path');

// 获取命令行参数
const excelFileName = process.argv[2];
const recordCount = parseInt(process.argv[3]) || 0;

if (!excelFileName) {
  console.log('❌ 请指定Excel文件名！\n');
  console.log('用法：node create-timeliness-metadata.js <excel-filename> [record-count]\n');
  console.log('示例：');
  console.log('  node create-timeliness-metadata.js 时效标准表.xlsx 1500\n');
  process.exit(1);
}

const timelinessDir = path.join(__dirname, 'backend', 'uploads', 'timeliness');
const excelFilePath = path.join(timelinessDir, excelFileName);
const metadataPath = path.join(timelinessDir, 'metadata.json');

// 检查Excel文件是否存在
if (!fs.existsSync(excelFilePath)) {
  console.log(`❌ Excel文件不存在: ${excelFilePath}\n`);
  console.log('请确认文件路径是否正确。\n');
  
  if (fs.existsSync(timelinessDir)) {
    const files = fs.readdirSync(timelinessDir);
    const excelFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    if (excelFiles.length > 0) {
      console.log('目录中的Excel文件：');
      excelFiles.forEach(file => console.log(`  - ${file}`));
    }
  }
  
  process.exit(1);
}

console.log('📝 创建metadata.json配置\n');
console.log(`Excel文件: ${excelFileName}`);
console.log(`记录数: ${recordCount || '未指定（将设为0）'}\n`);

// 生成文件ID
const timestamp = Date.now();
const randomStr = Math.random().toString(36).substring(2, 8);
const fileId = `timeliness_${timestamp}_${randomStr}`;

// 获取文件信息
const stats = fs.statSync(excelFilePath);
const uploadTime = stats.mtime.toISOString();

// 创建metadata
const metadata = {
  activeFileId: fileId,
  files: [
    {
      fileId: fileId,
      fileName: excelFileName,
      uploadTime: uploadTime,
      recordCount: recordCount,
      excelFilePath: excelFilePath,
      jsonFilePath: null,  // JSON文件稍后生成
      isActive: true,
      note: '由create-timeliness-metadata.js自动生成'
    }
  ]
};

// 保存metadata.json
try {
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log('✅ metadata.json创建成功！\n');
  
  console.log('📋 配置内容：');
  console.log(JSON.stringify(metadata, null, 2));
  console.log('');
  
  console.log('🎯 下一步操作：\n');
  console.log('1. 生成JSON缓存（二选一）：\n');
  console.log('   方式A - 通过API上传：');

  console.log('     curl -X POST http://localhost:3001/api/upload/timeliness-excel \\');

  console.log('     curl -X POST /api/upload/timeliness-excel \\');

  console.log(`       -F "file=@${excelFilePath}" \\`);
  console.log('       -F "brand=all"\n');
  console.log('   方式B - 运行解析脚本：');
  console.log('     node parse-timeliness-excel-to-json.js\n');
  
  console.log('2. 启动API服务：');
  console.log('     cd backend && npm start\n');
  
  console.log('3. 测试时效分析：');
  console.log('     node test-file-based-timeliness.js\n');
  
} catch (error) {
  console.log('❌ 创建失败:', error.message);
  process.exit(1);
}
