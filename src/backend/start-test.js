#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    log('red', '❌ 未找到.env文件');
    log('yellow', '📋 请先复制.env.example为.env并配置数据库连接信息');
    log('cyan', 'cp .env.example .env');
    return false;
  }
  return true;
}

function checkPackageJson() {
  const packagePath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packagePath)) {
    log('red', '❌ 未找到package.json文件');
    log('yellow', '请确保在backend目录下运行此脚本');
    return false;
  }
  return true;
}

function checkNodeModules() {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    log('yellow', '⚠️  未找到node_modules，正在安装依赖...');
    try {
      execSync('npm install', { stdio: 'inherit' });
      log('green', '✅ 依赖安装完成');
    } catch (error) {
      log('red', '❌ 依赖安装失败');
      process.exit(1);
    }
  }
  return true;
}

async function runTests() {
  log('cyan', '🧪 开始运行数据库连接测试...');
  log('blue', '='.repeat(50));
  
  try {
    // 运行基本连接测试
    log('cyan', '📡 执行基本连接测试...');
    execSync('npm run test', { stdio: 'inherit' });
    
    log('green', '✅ 基本连接测试通过');
    
    // 询问是否运行综合测试
    log('yellow', '\n是否运行综合测试套件？(y/n)');
    
    // 简单的用户输入处理
    process.stdout.write('请选择: ');
    
    const response = await new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim().toLowerCase());
      });
    });
    
    if (response === 'y' || response === 'yes') {
      log('cyan', '🧪 执行综合测试套件...');
      execSync('npm run test-db', { stdio: 'inherit' });
      log('green', '✅ 综合测试通过');
    }
    
    log('blue', '='.repeat(50));
    log('green', '🎉 所有测试完成！');
    
    // 询问是否启动开发服务器
    log('yellow', '\n是否启动开发服务器？(y/n)');
    process.stdout.write('请选择: ');
    
    const startServer = await new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim().toLowerCase());
      });
    });
    
    if (startServer === 'y' || startServer === 'yes') {
      log('cyan', '🚀 启动开发服务器...');
      execSync('npm run dev', { stdio: 'inherit' });
    } else {
      log('blue', '👋 测试完成，可以使用 npm run dev 启动服务器');
    }
    
  } catch (error) {
    log('red', '❌ 测试执行失败');
    log('red', error.message);
    
    log('yellow', '\n🔧 可能的解决方案:');
    log('white', '1. 检查.env文件中的数据库配置');
    log('white', '2. 确认Oracle数据库服务正在运行');
    log('white', '3. 验证网络连接和防火墙设置');
    log('white', '4. 确认Oracle Client已正确安装');
    
    process.exit(1);
  }
}

async function main() {
  log('cyan', '🔧 VF物流后端快速测试工具');
  log('blue', '='.repeat(50));
  
  // 检查环境
  if (!checkPackageJson()) return;
  if (!checkEnvFile()) return;
  checkNodeModules();
  
  log('green', '✅ 环境检查通过');
  
  // 运行测试
  await runTests();
}

// 处理Ctrl+C
process.on('SIGINT', () => {
  log('yellow', '\n\n👋 用户中断，退出程序');
  process.exit(0);
});

// 运行主程序
main().catch(error => {
  log('red', '💥 程序执行失败:', error.message);
  process.exit(1);
});