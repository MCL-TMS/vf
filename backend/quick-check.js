#!/usr/bin/env node

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

/**
 * 快速检查工具
 * 用于快速诊断最常见的配置问题
 */
function quickCheck() {
  log('cyan', '⚡ VF物流后端快速检查');
  log('cyan', '=' .repeat(40));
  
  console.log('\n📍 基本信息:');
  console.log('工作目录:', process.cwd());
  console.log('Node.js版本:', process.version);
  
  let issueCount = 0;
  const suggestions = [];
  
  // 检查1: .env文件
  console.log('\n1️⃣ 检查.env文件...');
  if (fs.existsSync('.env')) {
    log('green', '✅ .env文件存在');
    
    // 检查文件大小
    const stats = fs.statSync('.env');
    if (stats.size < 50) {
      log('yellow', '⚠️  .env文件较小，可能配置不完整');
      issueCount++;
      suggestions.push('检查.env文件内容，确保包含Oracle数据库配置');
    }
    
    // 检查内容
    const content = fs.readFileSync('.env', 'utf8');
    const hasOracleUser = content.includes('ORACLE_USER=');
    const hasOraclePassword = content.includes('ORACLE_PASSWORD=');
    const hasOracleConnect = content.includes('ORACLE_CONNECT_STRING=');
    
    if (!hasOracleUser || !hasOraclePassword || !hasOracleConnect) {
      log('red', '❌ .env文件缺少Oracle配置');
      issueCount++;
      suggestions.push('运行: npm run fix-env 修复配置');
    } else {
      log('green', '✅ .env文件包含Oracle配置');
    }
    
  } else {
    log('red', '❌ .env文件不存在');
    issueCount++;
    suggestions.push('运行: npm run create-env 创建配置文件');
  }
  
  // 检查2: .env.example文件
  console.log('\n2️⃣ 检查.env.example文件...');
  if (fs.existsSync('.env.example')) {
    log('green', '✅ .env.example文件存在');
  } else {
    log('yellow', '⚠️  .env.example文件不存在');
  }
  
  // 检查3: package.json
  console.log('\n3️⃣ 检查package.json...');
  if (fs.existsSync('package.json')) {
    log('green', '✅ package.json文件存在');
  } else {
    log('red', '❌ package.json文件不存在');
    issueCount++;
    suggestions.push('确保在正确的backend目录下运行');
  }
  
  // 检查4: node_modules
  console.log('\n4️⃣ 检查依赖安装...');
  if (fs.existsSync('node_modules')) {
    log('green', '✅ node_modules存在');
  } else {
    log('red', '❌ node_modules不存在');
    issueCount++;
    suggestions.push('运行: npm install 安装依赖');
  }
  
  // 检查5: 脚本文件
  console.log('\n5️⃣ 检查核心脚本...');
  const coreScripts = [
    'src/scripts/simpleTest.js',
    'src/scripts/checkEnv.js',
    'fix-env.js'
  ];
  
  let missingScripts = 0;
  coreScripts.forEach(script => {
    if (!fs.existsSync(script)) {
      missingScripts++;
    }
  });
  
  if (missingScripts === 0) {
    log('green', '✅ 所有核心脚本存在');
  } else {
    log('yellow', `⚠️  ${missingScripts}个脚本缺失`);
  }
  
  // 总结
  console.log('\n' + '='.repeat(40));
  if (issueCount === 0) {
    log('green', '🎉 快速检查通过！');
    console.log('\n🚀 建议下一步操作:');
    console.log('npm run test-simple  # 测试数据库连接');
  } else {
    log('red', `❌ 发现 ${issueCount} 个问题`);
    console.log('\n🔧 建议修复步骤:');
    suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion}`);
    });
    
    console.log('\n⚡ 快速修复命令:');
    if (!fs.existsSync('.env')) {
      console.log('npm run fix-env      # 修复.env配置');
    }
    if (!fs.existsSync('node_modules')) {
      console.log('npm install          # 安装依赖');
    }
    console.log('npm run check-env    # 详细检查');
  }
  
  console.log('\n📚 更多帮助:');
  console.log('npm run diagnose     # 完整诊断');
  console.log('查看 TROUBLESHOOTING.md 文件');
}

// 运行快速检查
quickCheck();