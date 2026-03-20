#!/usr/bin/env node

/**
 * 时效表上传文件存储诊断工具
 * 
 * 检查为什么上传后没有文件保存到 /backend/uploads/timeliness/
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 时效表上传文件存储诊断工具\n');
console.log('='.repeat(80));

const TIMELINESS_DIR = path.join(__dirname, 'backend/uploads/timeliness');
const UPLOADS_DIR = path.join(__dirname, 'backend/uploads');
const UPLOAD_ROUTE_FILE = path.join(__dirname, 'backend/src/routes/upload-commonjs.js');
const FILE_STORE_FILE = path.join(__dirname, 'backend/src/utils/timelinessFileStore.js');
const API_SERVER_FILE = path.join(__dirname, 'backend/src/api-server.js');

/**
 * 1. 检查目录结构
 */
function checkDirectories() {
  console.log('\n📁 检查目录结构...\n');
  
  const checks = [
    { path: UPLOADS_DIR, name: 'uploads目录' },
    { path: TIMELINESS_DIR, name: 'timeliness子目录' }
  ];
  
  checks.forEach(({ path: dirPath, name }) => {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      console.log(`   ✅ ${name} 存在: ${dirPath}`);
      console.log(`      包含 ${files.length} 个文件/目录`);
      if (files.length > 0) {
        files.forEach(file => {
          const fullPath = path.join(dirPath, file);
          const stats = fs.statSync(fullPath);
          const type = stats.isDirectory() ? '📂' : '📄';
          const size = stats.isFile() ? ` (${(stats.size / 1024).toFixed(2)} KB)` : '';
          console.log(`      ${type} ${file}${size}`);
        });
      }
    } else {
      console.log(`   ❌ ${name} 不存在: ${dirPath}`);
    }
  });
}

/**
 * 2. 检查关键文件是否存在
 */
function checkKeyFiles() {
  console.log('\n📄 检查关键文件...\n');
  
  const files = [
    { path: UPLOAD_ROUTE_FILE, name: 'upload-commonjs.js (上传路由)' },
    { path: FILE_STORE_FILE, name: 'timelinessFileStore.js (文件存储管理器)' },
    { path: API_SERVER_FILE, name: 'api-server.js (API服务器)' }
  ];
  
  files.forEach(({ path: filePath, name }) => {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`   ✅ ${name}`);
      console.log(`      路径: ${filePath}`);
      console.log(`      大小: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.log(`   ❌ ${name} 不存在`);
    }
  });
}

/**
 * 3. 检查API路由注册
 */
function checkAPIRoutes() {
  console.log('\n🔌 检查API路由注册...\n');
  
  if (!fs.existsSync(API_SERVER_FILE)) {
    console.log('   ❌ API服务器文件不存在');
    return;
  }
  
  const apiServerContent = fs.readFileSync(API_SERVER_FILE, 'utf-8');
  
  // 检查upload路由是否注册
  const uploadRoutePattern = /app\.use\(['"](\/api\/upload|\/upload)['"]/;
  const uploadRouteMatch = apiServerContent.match(uploadRoutePattern);
  
  if (uploadRouteMatch) {
    console.log('   ✅ Upload路由已注册');
    console.log(`      模式: ${uploadRouteMatch[0]}`);
  } else {
    console.log('   ❌ Upload路由可能未注册');
  }
  
  // 检查使用的文件
  const uploadFilePattern = /require\(['"]\.(\/routes\/upload[^'"]*)['"]\)/;
  const uploadFileMatch = apiServerContent.match(uploadFilePattern);
  
  if (uploadFileMatch) {
    console.log('   ✅ Upload路由文件引用');
    console.log(`      文件: ${uploadFileMatch[1]}`);
  } else {
    console.log('   ⚠️  未找到upload路由文件引用');
  }
}

/**
 * 4. 检查save-to-file端点实现
 */
function checkSaveToFileEndpoint() {
  console.log('\n🔧 检查 save-to-file 端点实现...\n');
  
  if (!fs.existsSync(UPLOAD_ROUTE_FILE)) {
    console.log('   ❌ upload-commonjs.js 文件不存在');
    return;
  }
  
  const content = fs.readFileSync(UPLOAD_ROUTE_FILE, 'utf-8');
  
  // 检查是否引入了timelinessFileStore
  if (content.includes("require('../utils/timelinessFileStore')")) {
    console.log('   ✅ timelinessFileStore 已引入');
  } else {
    console.log('   ❌ timelinessFileStore 未引入');
  }
  
  // 检查save-to-file端点
  if (content.includes("router.post('/save-to-file'")) {
    console.log('   ✅ save-to-file 端点已定义');
    
    // 检查是否调用了saveTimelinessData
    if (content.includes('timelinessFileStore.saveTimelinessData')) {
      console.log('   ✅ 调用了 saveTimelinessData 函数');
    } else {
      console.log('   ❌ 未找到 saveTimelinessData 函数调用');
    }
  } else {
    console.log('   ❌ save-to-file 端点未定义');
  }
}

/**
 * 5. 检查timelinessFileStore实现
 */
function checkFileStoreImplementation() {
  console.log('\n📦 检查文件存储管理器实现...\n');
  
  if (!fs.existsSync(FILE_STORE_FILE)) {
    console.log('   ❌ timelinessFileStore.js 文件不存在');
    return;
  }
  
  const content = fs.readFileSync(FILE_STORE_FILE, 'utf-8');
  
  // 检查关键函数
  const functions = [
    'saveTimelinessData',
    'getActiveTimelinessData',
    'ensureDirectoryExists',
    'updateMetadataIndex'
  ];
  
  functions.forEach(funcName => {
    if (content.includes(`function ${funcName}`) || content.includes(`async function ${funcName}`)) {
      console.log(`   ✅ ${funcName} 函数已定义`);
    } else {
      console.log(`   ❌ ${funcName} 函数未找到`);
    }
  });
  
  // 检查存储目录配置
  const dirPattern = /TIMELINESS_DATA_DIR\s*=\s*path\.join\(__dirname,\s*['"](.*)['"]\)/;
  const dirMatch = content.match(dirPattern);
  
  if (dirMatch) {
    console.log(`\n   📂 存储目录配置: ${dirMatch[1]}`);
    const actualPath = path.join(path.dirname(FILE_STORE_FILE), dirMatch[1]);
    console.log(`   📂 解析后路径: ${actualPath}`);
  }
}

/**
 * 6. 测试API端点可用性
 */
async function testAPIEndpoints() {
  console.log('\n🌐 测试API端点可用性...\n');
  
  const endpoints = [
    { url: 'http://localhost:3001/api/upload/save-to-file', method: 'POST', name: 'save-to-file端点' },
    { url: 'http://localhost:3001/api/upload/file-history', method: 'GET', name: 'file-history端点' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`   🔍 测试 ${endpoint.name}...`);
      
      const options = {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (endpoint.method === 'POST') {
        options.body = JSON.stringify({ parsedData: [], metadata: {} });
      }
      
      const response = await fetch(endpoint.url, options);
      
      if (response.status === 404) {
        console.log(`   ❌ ${endpoint.name} - 404 未找到`);
      } else if (response.status >= 200 && response.status < 300) {
        console.log(`   ✅ ${endpoint.name} - ${response.status} 可访问`);
      } else if (response.status === 400) {
        console.log(`   ⚠️  ${endpoint.name} - ${response.status} 可访问（参数错误预期）`);
      } else {
        console.log(`   ⚠️  ${endpoint.name} - ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ ${endpoint.name} - 无法连接`);
      console.log(`      错误: ${error.message}`);
    }
  }
}

/**
 * 7. 提供修复建议
 */
function provideSuggestions() {
  console.log('\n' + '='.repeat(80));
  console.log('\n💡 诊断建议:\n');
  
  const timelinessExists = fs.existsSync(TIMELINESS_DIR);
  const metadataExists = fs.existsSync(path.join(TIMELINESS_DIR, 'metadata.json'));
  const hasDataFiles = timelinessExists && 
    fs.readdirSync(TIMELINESS_DIR).some(f => f.startsWith('timeliness_') && f.endsWith('.json'));
  
  if (!timelinessExists) {
    console.log('   ⚠️  时效数据目录不存在');
    console.log('      → 该目录应该在首次调用 saveTimelinessData 时自动创建');
    console.log('      → 可能原因：save-to-file 端点未被调用');
    console.log('');
  }
  
  if (timelinessExists && !metadataExists) {
    console.log('   ⚠️  metadata.json 文件不存在');
    console.log('      → 该文件应该在首次保存数据时自动创建');
    console.log('      → 可能原因：saveTimelinessData 函数未被正确调用');
    console.log('');
  }
  
  if (timelinessExists && !hasDataFiles) {
    console.log('   ⚠️  没有找到时效数据文件');
    console.log('      → 应该有类似 timeliness_xxxx.json 的文件');
    console.log('      → 可能原因：文件保存失败或被删除');
    console.log('');
  }
  
  console.log('   📋 排查步骤：');
  console.log('');
  console.log('   1️⃣  检查后端API服务器是否正在运行');
  console.log('      cd backend');
  console.log('      node src/api-server.js');
  console.log('');
  console.log('   2️⃣  检查浏览器控制台日志');
  console.log('      打开开发者工具 → Console');
  console.log('      查找上传相关的错误信息');
  console.log('');
  console.log('   3️⃣  检查后端控制台日志');
  console.log('      查找 "保存时效数据" 相关的日志');
  console.log('      查找是否有错误或异常');
  console.log('');
  console.log('   4️⃣  手动测试save-to-file端点');
  console.log('      运行测试脚本: node test-file-storage-solution.js');
  console.log('');
  console.log('   5️⃣  检查文件权限');
  console.log('      确保Node.js进程有权限在 backend/uploads/ 目录创建文件');
  console.log('');
  
  console.log('   📖 相关文档：');
  console.log('      - /TIMELINESS_DATA_STORAGE_LOCATION.md');
  console.log('      - /TIMELINESS_UPLOAD_FIX_COMPLETE.md');
  console.log('      - /FILE_STORAGE_TIMELINESS_SOLUTION.md');
  console.log('');
}

/**
 * 主函数
 */
async function main() {
  try {
    checkDirectories();
    checkKeyFiles();
    checkAPIRoutes();
    checkSaveToFileEndpoint();
    checkFileStoreImplementation();
    await testAPIEndpoints();
    provideSuggestions();
    
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ 诊断过程中发生错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行诊断
main();
