#!/usr/bin/env node
/**
 * 🧪 订单导出路由诊断测试工具
 * 
 * 用途：快速诊断订单导出API为什么404
 * 使用：node test-export-route.mjs
 */

console.log('\n🧪 ========================================');
console.log('📋 订单导出路由诊断测试');
console.log('========================================\n');

// 测试1: 检查路由文件是否存在
console.log('测试1: 检查路由文件是否存在');
console.log('----------------------------------------');
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const routeFilePath = join(__dirname, 'src/routes/order-details-esm.js');
const serverFilePath = join(__dirname, 'src/server.js');
const databaseFilePath = join(__dirname, 'src/config/database.js');

console.log('检查文件路径:');
console.log(`  - 路由文件: ${routeFilePath}`);
console.log(`  - 服务器文件: ${serverFilePath}`);
console.log(`  - 数据库配置: ${databaseFilePath}`);
console.log('');

const routeExists = existsSync(routeFilePath);
const serverExists = existsSync(serverFilePath);
const databaseExists = existsSync(databaseFilePath);

console.log('文件存在性检查:');
console.log(`  ${routeExists ? '✅' : '❌'} 路由文件 ${routeExists ? '存在' : '不存在'}`);
console.log(`  ${serverExists ? '✅' : '❌'} 服务器文件 ${serverExists ? '存在' : '不存在'}`);
console.log(`  ${databaseExists ? '✅' : '❌'} 数据库配置 ${databaseExists ? '存在' : '不存在'}`);
console.log('');

if (!routeExists) {
  console.error('❌ 错误: 路由文件不存在！');
  console.error('   请确认文件已创建: src/routes/order-details-esm.js');
  process.exit(1);
}

// 测试2: 尝试导入路由文件
console.log('\n测试2: 尝试导入路由文件');
console.log('----------------------------------------');
try {
  const orderDetailsRouter = await import('./src/routes/order-details-esm.js');
  console.log('✅ 路由文件导入成功');
  console.log(`   默认导出类型: ${typeof orderDetailsRouter.default}`);
  
  if (typeof orderDetailsRouter.default === 'function') {
    console.log('✅ 路由对象有效（是一个函数）');
  } else {
    console.error('❌ 路由对象无效（不是函数）');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ 路由文件导入失败！');
  console.error('   错误信息:', error.message);
  console.error('   错误堆栈:', error.stack);
  process.exit(1);
}

// 测试3: 检查server.js中的路由注册
console.log('\n测试3: 检查server.js中的路由注册');
console.log('----------------------------------------');

try {
  const serverContent = readFileSync(serverFilePath, 'utf-8');
  
  const importMatch = serverContent.includes("import orderDetailsRouter from './routes/order-details-esm.js'");
  const registerMatch = serverContent.includes("app.use('/api/order-details', orderDetailsRouter)");
  
  console.log('路由注册检查:');
  console.log(`  ${importMatch ? '✅' : '❌'} 路由已导入 (import orderDetailsRouter)`);
  console.log(`  ${registerMatch ? '✅' : '❌'} 路由已注册 (app.use('/api/order-details'))`);
  
  if (!importMatch || !registerMatch) {
    console.error('\n❌ 错误: 路由未在server.js中正确注册！');
    console.error('   请在server.js中添加:');
    console.error('   1. import orderDetailsRouter from \'./routes/order-details-esm.js\';');
    console.error('   2. app.use(\'/api/order-details\', orderDetailsRouter);');
    process.exit(1);
  }
  
  console.log('✅ 路由已正确注册');
} catch (error) {
  console.error('❌ 无法读取server.js文件');
  console.error('   错误信息:', error.message);
  process.exit(1);
}

// 测试4: 测试API端点
console.log('\n测试4: 测试后端服务器健康检查');
console.log('----------------------------------------');

try {
  const response = await fetch('http://localhost:3001/api/health');
  
  if (response.ok) {
    const data = await response.json();
    console.log('✅ 后端服务器正在运行');
    console.log(`   状态: ${data.status}`);
    console.log(`   运行时间: ${Math.floor(data.uptime)}秒`);
  } else {
    console.error('⚠️  后端服务器响应异常');
    console.error(`   HTTP状态: ${response.status}`);
  }
} catch (error) {
  console.error('❌ 无法连接到后端服务器！');
  console.error('   错误信息:', error.message);
  console.error('\n   可能的原因:');
  console.error('   1. 后端服务器未启动');
  console.error('   2. 端口3001被占用');
  console.error('   3. 防火墙阻止连接');
  console.error('\n   解决方法:');
  console.error('   cd backend && npm start');
  process.exit(1);
}

// 测试5: 测试订单导出API
console.log('\n测试5: 测试订单导出API端点');
console.log('----------------------------------------');

const testUrl = 'http://localhost:3001/api/order-details/export?startDate=2026-01-01&endDate=2026-02-25&limit=5';
console.log(`测试URL: ${testUrl}`);

try {
  const response = await fetch(testUrl);
  
  console.log(`\nHTTP状态: ${response.status} ${response.statusText}`);
  
  if (response.status === 404) {
    console.error('❌ 404错误 - 端点不存在！');
    console.error('\n   这意味着:');
    console.error('   1. 路由文件存在 ✅');
    console.error('   2. 路由文件可以导入 ✅');
    console.error('   3. server.js中已注册 ✅');
    console.error('   4. 但后端服务器没有重启 ❌');
    console.error('\n   ⚠️  解决方法: 必须重启后端服务器！');
    console.error('   步骤:');
    console.error('   1. 在后端终端按 Ctrl+C');
    console.error('   2. 运行: npm start');
    console.error('   3. 等待看到 "服务已启动" 消息');
    console.error('   4. 重新运行此测试脚本');
    process.exit(1);
  }
  
  if (response.ok) {
    const data = await response.json();
    console.log('✅ 订单导出API正常工作！');
    console.log(`   返回记录数: ${data.data?.length || 0}`);
    console.log(`   导出限制: ${data.metadata?.exportLimit || 'N/A'}`);
    console.log('\n   示例数据:');
    if (data.data && data.data[0]) {
      console.log(`   - 订单号: ${data.data[0].orderNo}`);
      console.log(`   - 品牌: ${data.data[0].brandName}`);
      console.log(`   - 快递: ${data.data[0].carrierName}`);
    }
  } else {
    const text = await response.text();
    console.error(`❌ API返回错误: ${response.status}`);
    console.error(`   响应内容: ${text.substring(0, 200)}`);
  }
} catch (error) {
  console.error('❌ API请求失败！');
  console.error('   错误信息:', error.message);
}

// 总结
console.log('\n========================================');
console.log('📊 诊断总结');
console.log('========================================');
console.log('');
console.log('如果所有测试都通过（✅），说明一切正常！');
console.log('如果有任何测试失败（❌），请按照错误提示解决。');
console.log('');
console.log('最常见的问题: 后端服务器没有重启');
console.log('解决方法: 在后端终端按 Ctrl+C，然后运行 npm start');
console.log('');
console.log('========================================\n');
