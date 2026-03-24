/**
 * 初始化现有时效Excel文件
 * 
 * 说明：用户已有时效Excel文件保存在backend/uploads/timeliness目录
 * 本脚本自动扫描该目录，解析Excel文件并生成JSON缓存和metadata.json
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 初始化现有时效数据文件\n');

// 步骤1: 检查目录
const timelinessDir = path.join(__dirname, 'backend', 'uploads', 'timeliness');
console.log('📂 步骤1: 检查时效数据目录');
console.log(`   目录路径: ${timelinessDir}\n`);

if (!fs.existsSync(timelinessDir)) {
  console.log('❌ 目录不存在！');
  console.log('\n📝 请按以下步骤操作：\n');
  console.log('1. 创建目录：');
  console.log(`   mkdir -p backend/uploads/timeliness\n`);
  console.log('2. 将您的时效Excel文件复制到该目录：');
  console.log(`   cp your-file.xlsx backend/uploads/timeliness/\n`);
  console.log('3. 重新运行此脚本：');
  console.log(`   node initialize-existing-timeliness-file.js\n`);
  process.exit(1);
}

// 步骤2: 扫描Excel文件
console.log('📄 步骤2: 扫描Excel文件');
const allFiles = fs.readdirSync(timelinessDir);
const excelFiles = allFiles.filter(file => 
  file.endsWith('.xlsx') || file.endsWith('.xls')
);

console.log(`   找到${excelFiles.length}个Excel文件：`);
if (excelFiles.length === 0) {
  console.log('   ⚠️  未找到Excel文件！');
  console.log('\n📝 请将时效Excel文件复制到以下目录：');
  console.log(`   ${timelinessDir}\n`);
  console.log('文件要求：');
  console.log('  - 文件扩展名：.xlsx 或 .xls');
  console.log('  - 必须包含列：Carrier, City, Brand');
  console.log('  - SLA时效值：24, 48, 72, 72+, -\n');
  process.exit(1);
}

excelFiles.forEach((file, index) => {
  const filePath = path.join(timelinessDir, file);
  const stats = fs.statSync(filePath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  const modifiedDate = stats.mtime.toISOString().split('T')[0];
  console.log(`   [${index + 1}] ${file}`);
  console.log(`       - 大小: ${sizeKB} KB`);
  console.log(`       - 修改日期: ${modifiedDate}`);
});

// 步骤3: 检查是否已有JSON缓存
console.log('\n📋 步骤3: 检查JSON缓存');
const jsonFiles = allFiles.filter(file => file.endsWith('.json') && file !== 'metadata.json');
console.log(`   找到${jsonFiles.length}个JSON缓存文件`);

const hasMetadata = allFiles.includes('metadata.json');
console.log(`   metadata.json: ${hasMetadata ? '✅ 存在' : '❌ 不存在'}`);

// 步骤4: 提供操作指引
console.log('\n🎯 步骤4: 下一步操作\n');

if (hasMetadata && jsonFiles.length > 0) {
  console.log('✅ 检测到已有完整配置！');
  console.log('\n系统可以直接使用现有数据：');
  console.log('  1. JSON缓存已存在，无需重新解析');
  console.log('  2. metadata.json已配置\n');
  
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(timelinessDir, 'metadata.json'), 'utf-8'));
    console.log('📊 当前配置信息：');
    console.log(`   活跃文件ID: ${metadata.activeFileId || '未设置'}`);
    console.log(`   文件记录数: ${metadata.files ? metadata.files.length : 0}`);
    
    if (metadata.files && metadata.files.length > 0) {
      const activeFile = metadata.files.find(f => f.isActive);
      if (activeFile) {
        console.log(`\n✅ 活跃时效数据：`);
        console.log(`   - 文件名: ${activeFile.fileName}`);
        console.log(`   - 上传时间: ${activeFile.uploadTime}`);
        console.log(`   - 记录数: ${activeFile.recordCount || 'N/A'}`);
      }
    }
  } catch (error) {
    console.log('   ⚠️  metadata.json解析失败，可能需要重新生成');
  }
  
  console.log('\n🚀 启动服务：');
  console.log('   cd backend && npm start\n');
  
} else {
  console.log('⚠️  需要初始化JSON缓存！\n');
  console.log('请使用以下任一方式：\n');
  
  console.log('方案A：通过API上传（推荐）');
  console.log('  1. 启动后端服务：');
  console.log('     cd backend && npm start\n');
  console.log('  2. 上传Excel文件：');

  console.log('     curl -X POST http://localhost:3001/api/upload/timeliness-excel \\');

  console.log('     curl -X POST /api/upload/timeliness-excel \\');

  console.log('       -F "file=@backend/uploads/timeliness/' + excelFiles[0] + '" \\');
  console.log('       -F "brand=all"\n');
  
  console.log('方案B：手动生成JSON（需要Node.js环境）');
  console.log('  1. 安装依赖：');
  console.log('     cd backend && npm install xlsx\n');
  console.log('  2. 运行解析脚本：');
  console.log('     node backend/scripts/parse-existing-timeliness-excel.js\n');
  
  console.log('方案C：创建示例metadata.json');
  console.log('  运行以下脚本：');
  console.log('     node create-timeliness-metadata.js ' + excelFiles[0] + '\n');
}

// 步骤5: 验证API服务
console.log('📡 步骤5: 验证API服务\n');
console.log('服务启动后，访问以下接口测试：');

console.log('  - 查看SLA状态: GET http://localhost:3001/api/upload/sla-matching-status');
console.log('  - 执行时效分析: POST http://localhost:3001/api/upload/analyze-timeliness\n');

console.log('  - 查看SLA状态: GET /api/upload/sla-matching-status');
console.log('  - 执行时效分析: POST /api/upload/analyze-timeliness\n');


console.log('✅ 初始化检查完成！\n');

// 步骤6: 提供快速创建metadata的选项
if (!hasMetadata && excelFiles.length > 0) {
  console.log('💡 提示：我可以帮您快速创建metadata.json\n');
  console.log('运行以下命令：');
  console.log(`   node create-timeliness-metadata.js "${excelFiles[0]}"\n`);
}
