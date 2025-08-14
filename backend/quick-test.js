#!/usr/bin/env node

import fs from 'fs';
import { createRequire } from 'module';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 极简Oracle数据库连接快速测试
 */
async function quickTest() {
  console.clear();
  
  log('cyan', '⚡ VF物流 - Oracle数据库快速测试');
  console.log('='.repeat(50));
  
  let passed = 0;
  let total = 0;
  
  // 测试1: 检查.env文件
  total++;
  log('blue', '\n1️⃣ 检查配置文件...');
  if (fs.existsSync('.env')) {
    log('green', '✅ .env文件存在');
    passed++;
  } else {
    log('red', '❌ .env文件不存在');
    log('yellow', '   解决: 运行 npm run setup');
  }
  
  // 测试2: 检查环境变量
  total++;
  log('blue', '\n2️⃣ 检查环境变量...');
  try {
    const dotenv = await import('dotenv');
    dotenv.config();
    
    const requiredVars = ['ORACLE_USER', 'ORACLE_PASSWORD', 'ORACLE_CONNECT_STRING'];
    const missing = requiredVars.filter(v => !process.env[v]);
    
    if (missing.length === 0) {
      log('green', '✅ 环境变量配置完整');
      passed++;
    } else {
      log('red', `❌ 缺少环境变量: ${missing.join(', ')}`);
      log('yellow', '   解决: 运行 npm run setup 重新配置');
    }
  } catch (error) {
    log('red', '❌ 环境变量加载失败');
  }
  
  // 测试3: 检查Oracle模块
  total++;
  log('blue', '\n3️⃣ 检查Oracle模块...');
  try {
    const require = createRequire(import.meta.url);
    const oracledb = require('oracledb');
    log('green', '✅ Oracle模块加载成功');
    
    if (oracledb.thin) {
      log('green', '   📦 使用Thin模式 (无需额外配置)');
    } else {
      log('blue', '   🏛️  使用标准模式 (需要Instant Client)');
    }
    passed++;
  } catch (error) {
    log('red', '❌ Oracle模块加载失败');
    if (error.message.includes('DPI-1047')) {
      log('yellow', '   解决: 安装Oracle Instant Client');
    } else {
      log('yellow', '   解决: npm install oracledb');
    }
  }
  
  // 测试4: 数据库连接测试
  total++;
  log('blue', '\n4️⃣ 测试数据库连接...');
  try {
    const require = createRequire(import.meta.url);
    const oracledb = require('oracledb');
    
    if (!process.env.ORACLE_USER) {
      throw new Error('数据库配置不完整');
    }
    
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });
    
    const result = await connection.execute('SELECT 1 as TEST FROM DUAL');
    await connection.close();
    
    if (result.rows && result.rows.length > 0) {
      log('green', '✅ 数据库连接成功');
      passed++;
    } else {
      log('red', '❌ 数据库查询异常');
    }
    
  } catch (error) {
    log('red', '❌ 数据库连接失败');
    
    if (error.message.includes('ORA-12154')) {
      log('yellow', '   解决: 检查连接字符串格式');
    } else if (error.message.includes('ORA-01017')) {
      log('yellow', '   解决: 检查用户名和密码');
    } else if (error.message.includes('ORA-12541')) {
      log('yellow', '   解决: 检查数据库服务是否运行');
    } else {
      log('yellow', `   错误: ${error.message}`);
    }
  }
  
  // 显示测试结果
  console.log('\n' + '='.repeat(50));
  
  if (passed === total) {
    log('green', `🎉 全部测试通过! (${passed}/${total})`);
    console.log('\n✅ 系统已准备就绪，可以启动服务:');
    console.log('   npm run dev');
  } else {
    log('red', `❌ 测试失败 (${passed}/${total})`);
    console.log('\n🔧 建议修复操作:');
    
    if (passed === 0) {
      console.log('   npm run setup     # 重新配置');
    } else if (passed < 3) {
      console.log('   npm install       # 安装依赖');
      console.log('   npm run setup     # 重新配置');
    } else {
      console.log('   检查数据库服务是否运行');
      console.log('   验证连接参数是否正确');
    }
  }
  
  console.log('\n📚 更多帮助:');
  console.log('   npm run diagnose   # 详细诊断');
  console.log('   npm run setup      # 重新配置');
  
  process.exit(passed === total ? 0 : 1);
}

// 运行快速测试
quickTest().catch(error => {
  log('red', `\n💥 测试执行失败: ${error.message}`);
  process.exit(1);
});