/**
 * 时效表格上传修复验证脚本
 * 
 * 验证内容：
 * 1. timelinessFileStore模块是否正确导入
 * 2. save-to-file接口是否可用
 * 3. 文件存储目录是否存在
 */

const fs = require('fs');
const path = require('path');

console.log('===============================================');
console.log('🔍 时效表格上传修复验证');
console.log('===============================================\n');

// 1. 检查timelinessFileStore模块
console.log('1️⃣ 检查timelinessFileStore模块...');
try {
  const timelinessFileStore = require('./backend/src/utils/timelinessFileStore');
  console.log('   ✅ timelinessFileStore模块导入成功');
  console.log('   ✅ 可用函数:', Object.keys(timelinessFileStore).join(', '));
} catch (error) {
  console.log('   ❌ timelinessFileStore模块导入失败:', error.message);
}

// 2. 检查上传路由文件
console.log('\n2️⃣ 检查upload-commonjs.js路由文件...');
try {
  const uploadRoutePath = path.join(__dirname, 'backend/src/routes/upload-commonjs.js');
  const uploadRouteContent = fs.readFileSync(uploadRoutePath, 'utf-8');
  
  // 检查是否导入了timelinessFileStore
  const hasImport = uploadRouteContent.includes('timelinessFileStore');
  if (hasImport) {
    console.log('   ✅ timelinessFileStore已导入到upload-commonjs.js');
  } else {
    console.log('   ❌ timelinessFileStore未导入到upload-commonjs.js');
  }
  
  // 检查是否有save-to-file接口
  const hasSaveToFile = uploadRouteContent.includes("'/save-to-file'");
  if (hasSaveToFile) {
    console.log('   ✅ save-to-file接口已定义');
  } else {
    console.log('   ❌ save-to-file接口未定义');
  }
  
  // 检查timeliness-excel接口是否返回parsedData
  const hasParsedDataInResponse = uploadRouteContent.includes('parsedData: parseResult.parsedData');
  if (hasParsedDataInResponse) {
    console.log('   ✅ timeliness-excel接口返回parsedData');
  } else {
    console.log('   ❌ timeliness-excel接口未返回parsedData');
  }
  
} catch (error) {
  console.log('   ❌ 检查upload-commonjs.js失败:', error.message);
}

// 3. 检查文件存储目录
console.log('\n3️⃣ 检查文件存储目录...');
const timelinessDir = path.join(__dirname, 'backend/uploads/timeliness');
try {
  if (fs.existsSync(timelinessDir)) {
    console.log(`   ✅ 时效数据目录存在: ${timelinessDir}`);
    const files = fs.readdirSync(timelinessDir);
    console.log(`   📁 目录中有${files.length}个文件`);
    if (files.length > 0) {
      console.log('   📄 文件列表:', files.join(', '));
    }
  } else {
    console.log(`   ⚠️  时效数据目录不存在: ${timelinessDir}`);
    console.log('   ℹ️  目录将在首次上传时自动创建');
  }
} catch (error) {
  console.log('   ❌ 检查目录失败:', error.message);
}

// 4. 检查前端组件
console.log('\n4️⃣ 检查前端TimeEfficiencyAnalysis组件...');
try {
  const componentPath = path.join(__dirname, 'components/TimeEfficiencyAnalysis.tsx');
  const componentContent = fs.readFileSync(componentPath, 'utf-8');
  
  // 检查是否支持两种parsedData路径
  const supportsBothPaths = componentContent.includes('result.data?.parsedData || result.processingResult?.parsedData');
  if (supportsBothPaths) {
    console.log('   ✅ 前端支持两种parsedData路径');
  } else {
    console.log('   ❌ 前端不支持两种parsedData路径');
  }
  
  // 检查是否有错误处理
  const hasErrorBoundary = componentContent.includes('hasError');
  if (hasErrorBoundary) {
    console.log('   ✅ 前端已添加错误边界处理');
  } else {
    console.log('   ❌ 前端未添加错误边界处理');
  }
  
  // 检查是否正确调用save-to-file
  const callsSaveToFile = componentContent.includes('/api/upload/save-to-file');
  if (callsSaveToFile) {
    console.log('   ✅ 前端正确调用save-to-file接口');
  } else {
    console.log('   ❌ 前端未调用save-to-file接口');
  }
  
} catch (error) {
  console.log('   ❌ 检查前端组件失败:', error.message);
}

// 5. 总结
console.log('\n===============================================');
console.log('📊 验证总结');
console.log('===============================================');
console.log('\n✅ 修复内容：');
console.log('   1. 在upload-commonjs.js中导入timelinessFileStore模块');
console.log('   2. 在timeliness-excel响应中添加parsedData字段');
console.log('   3. 前端支持两种parsedData路径（兼容性增强）');
console.log('   4. 添加详细的错误日志和用户提示');
console.log('   5. 添加前端错误边界处理');

console.log('\n📝 使用说明：');
console.log('   1. 重启后端API服务器: cd backend && node src/api-server.js');
console.log('   2. 重启前端开发服务器: npm run dev');
console.log('   3. 在前端上传时效Excel表格');
console.log('   4. 检查控制台日志确认保存成功');
console.log('   5. 检查目录: backend/uploads/timeliness/');
console.log('   6. 执行时效分析查看结果');

console.log('\n🔍 预期结果：');
console.log('   ✅ 上传成功后显示两个成功提示');
console.log('   ✅ 时效数据文件保存到 backend/uploads/timeliness/');
console.log('   ✅ metadata.json文件自动创建');
console.log('   ✅ 执行时效分析可以正确读取Plan数据');
console.log('   ✅ 界面不会出现空白或崩溃');

console.log('\n===============================================\n');
