#!/usr/bin/env node
/**
 * VF物流数据分析平台 - 依赖安装脚本
 * 解决ES6模块转换后的依赖问题
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 VF物流数据分析平台 - 依赖安装脚本');
console.log('📁 当前目录:', __dirname);

// 检查关键依赖
const requiredPackages = [
  'express',
  'cors', 
  'helmet',
  'compression',
  'morgan',
  'multer',
  'xlsx',
  'oracledb',
  'dotenv'
];

console.log('\n📦 需要安装的关键依赖:');
requiredPackages.forEach(pkg => console.log(`   - ${pkg}`));

// 检查node_modules是否存在
const nodeModulesPath = join(__dirname, 'node_modules');
if (existsSync(nodeModulesPath)) {
  console.log('\n🗂️  node_modules 目录已存在，将进行重新安装...');
} else {
  console.log('\n📂 node_modules 目录不存在，开始全新安装...');
}

// 运行npm install
console.log('\n🚀 开始安装依赖...');
const npmProcess = spawn('npm', ['install'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

npmProcess.on('error', (error) => {
  console.error('\n❌ npm install 失败:', error.message);
  console.log('\n💡 请尝试手动运行:');
  console.log('   cd backend');
  console.log('   npm install');
  process.exit(1);
});

npmProcess.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ 依赖安装成功！');
    console.log('\n🔍 验证关键依赖...');
    
    // 验证关键包是否安装成功
    let allPackagesFound = true;
    for (const pkg of requiredPackages) {
      const pkgPath = join(__dirname, 'node_modules', pkg);
      if (existsSync(pkgPath)) {
        console.log(`   ✅ ${pkg}`);
      } else {
        console.log(`   ❌ ${pkg} - 未找到`);
        allPackagesFound = false;
      }
    }
    
    if (allPackagesFound) {
      console.log('\n🎉 所有依赖验证通过！');
      console.log('\n🚀 现在可以启动服务器:');
      console.log('   npm start');
    } else {
      console.log('\n⚠️  某些依赖缺失，请检查npm install输出');
    }
  } else {
    console.error(`\n❌ npm install 失败，退出码: ${code}`);
    console.log('\n💡 故障排除建议:');
    console.log('   1. 检查网络连接');
    console.log('   2. 清理npm缓存: npm cache clean --force');
    console.log('   3. 删除node_modules和package-lock.json后重试');
    process.exit(1);
  }
});