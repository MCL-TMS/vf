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
 * 智能启动脚本
 * 检查配置状态，如果未配置则自动引导配置
 */
async function smartStart() {
  console.clear();
  
  log('cyan', '🚀 VF物流数据分析平台启动检查');
  console.log('='.repeat(50));
  
  // 检查配置状态
  const configExists = fs.existsSync('.env');
  
  if (!configExists) {
    log('yellow', '\n⚠️  检测到首次运行，需要配置数据库连接');
    console.log('');
    log('blue', '正在启动配置向导...');
    console.log('');
    
    // 动态导入并运行配置
    try {
      const { spawn } = await import('child_process');
      const setupProcess = spawn('node', ['setup.js'], { 
        stdio: 'inherit',
        shell: true 
      });
      
      setupProcess.on('close', (code) => {
        if (code === 0) {
          console.log('\n');
          log('green', '✅ 配置完成！正在启动服务...');
          startServer();
        } else {
          log('red', '❌ 配置失败');
          process.exit(1);
        }
      });
      
    } catch (error) {
      log('red', `配置启动失败: ${error.message}`);
      console.log('\n请手动运行配置: npm run setup');
      process.exit(1);
    }
    
  } else {
    // 配置已存在，进行快速验证
    log('blue', '\n🔍 检查配置状态...');
    
    try {
      // 加载环境变量
      const dotenv = await import('dotenv');
      dotenv.config();
      
      const requiredVars = ['ORACLE_USER', 'ORACLE_PASSWORD', 'ORACLE_CONNECT_STRING'];
      const missing = requiredVars.filter(v => !process.env[v]);
      
      if (missing.length > 0) {
        log('red', `❌ 配置不完整，缺少: ${missing.join(', ')}`);
        console.log('\n请运行重新配置: npm run setup');
        process.exit(1);
      }
      
      log('green', '✅ 配置检查通过');
      
      // 快速连接测试
      log('blue', '🧪 快速连接测试...');
      
      try {
        const require = createRequire(import.meta.url);
        const oracledb = require('oracledb');
        
        const connection = await oracledb.getConnection({
          user: process.env.ORACLE_USER,
          password: process.env.ORACLE_PASSWORD,
          connectString: process.env.ORACLE_CONNECT_STRING
        });
        
        await connection.execute('SELECT 1 FROM DUAL');
        await connection.close();
        
        log('green', '✅ 数据库连接正常');
        
      } catch (dbError) {
        log('yellow', '⚠️  数据库连接测试失败');
        console.log(`   ${dbError.message}`);
        console.log('\n如需重新配置: npm run setup');
        console.log('如需详细诊断: npm run diagnose');
      }
      
      // 启动服务器
      console.log('');
      log('green', '🚀 启动开发服务器...');
      startServer();
      
    } catch (error) {
      log('red', `启动检查失败: ${error.message}`);
      console.log('\n请运行: npm run setup');
      process.exit(1);
    }
  }
}

/**
 * 启动服务器
 */
function startServer() {
  try {
    const { spawn } = require('child_process');
    
    const serverProcess = spawn('node', ['src/server.js'], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' }
    });
    
    // 监听进程退出
    serverProcess.on('close', (code) => {
      if (code !== 0) {
        log('red', `服务器异常退出，代码: ${code}`);
      }
    });
    
    // 处理中断信号
    process.on('SIGINT', () => {
      console.log('\n正在关闭服务器...');
      serverProcess.kill('SIGINT');
      process.exit(0);
    });
    
  } catch (error) {
    log('red', `服务器启动失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行智能启动
smartStart().catch(error => {
  log('red', `启动失败: ${error.message}`);
  process.exit(1);
});