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
 * 环境修复工具
 * 自动检测并修复.env文件配置问题
 */
async function fixEnvironment() {
  log('cyan', '🔧 VF物流后端环境修复工具');
  log('cyan', '=' .repeat(50));
  
  console.log('\n📍 当前信息:');
  console.log('工作目录:', process.cwd());
  console.log('脚本位置:', import.meta.url);
  
  // 检查.env文件
  console.log('\n🔍 检查.env文件...');
  
  const envPath = '.env';
  const envExamplePath = '.env.example';
  
  if (fs.existsSync(envPath)) {
    log('green', '✅ .env文件已存在');
    
    // 检查文件内容
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n').filter(line => 
        line.trim() && !line.startsWith('#') && line.includes('=')
      );
      
      console.log(`   配置项数量: ${lines.length}`);
      
      // 检查必需的Oracle配置
      const requiredVars = ['ORACLE_USER', 'ORACLE_PASSWORD', 'ORACLE_CONNECT_STRING'];
      const missingVars = [];
      
      requiredVars.forEach(varName => {
        const hasVar = lines.some(line => line.startsWith(`${varName}=`));
        if (!hasVar) {
          missingVars.push(varName);
        }
      });
      
      if (missingVars.length > 0) {
        log('yellow', '⚠️  缺少必需的配置项:');
        missingVars.forEach(varName => {
          console.log(`     - ${varName}`);
        });
        
        console.log('\n🔧 修复建议:');
        console.log('请在.env文件中添加以下配置:');
        missingVars.forEach(varName => {
          if (varName === 'ORACLE_USER') {
            console.log(`${varName}=your_username`);
          } else if (varName === 'ORACLE_PASSWORD') {
            console.log(`${varName}=your_password`);
          } else if (varName === 'ORACLE_CONNECT_STRING') {
            console.log(`${varName}=localhost:1521/XE`);
          }
        });
      } else {
        log('green', '✅ 所有必需配置项都已存在');
      }
      
    } catch (error) {
      log('red', '❌ 读取.env文件失败:', error.message);
    }
    
  } else {
    log('yellow', '⚠️  .env文件不存在');
    
    if (fs.existsSync(envExamplePath)) {
      log('blue', '📋 发现.env.example文件，准备复制...');
      
      try {
        fs.copyFileSync(envExamplePath, envPath);
        log('green', '✅ .env文件创建成功！');
        
        console.log('\n📝 下一步操作:');
        console.log('1. 编辑.env文件');
        console.log('2. 配置以下数据库连接信息:');
        console.log('   - ORACLE_USER (数据库用户名)');
        console.log('   - ORACLE_PASSWORD (数据库密码)');
        console.log('   - ORACLE_CONNECT_STRING (连接字符串)');
        
      } catch (error) {
        log('red', '❌ 复制.env.example文件失败:', error.message);
      }
    } else {
      log('red', '❌ .env.example文件也不存在');
      
      console.log('\n🔧 手动创建.env文件:');
      const defaultEnvContent = `# VF物流数据分析平台后端配置
NODE_ENV=development
PORT=3001
HOST=localhost

# Oracle数据库配置 - 请修改为您的实际配置
ORACLE_USER=hr
ORACLE_PASSWORD=hr123
ORACLE_CONNECT_STRING=localhost:1521/XE

# 连接池配置
ORACLE_POOL_MIN=2
ORACLE_POOL_MAX=10
ORACLE_POOL_INCREMENT=2
ORACLE_POOL_TIMEOUT=60

# CORS配置
CORS_ORIGIN=http://localhost:3000

# 日志配置
LOG_LEVEL=info
`;
      
      try {
        fs.writeFileSync(envPath, defaultEnvContent);
        log('green', '✅ 默认.env文件创建成功！');
        
        console.log('\n📝 请编辑.env文件，配置您的Oracle数据库连接信息');
      } catch (error) {
        log('red', '❌ 创建默认.env文件失败:', error.message);
      }
    }
  }
  
  // 测试环境变量加载
  console.log('\n🧪 测试环境变量加载...');
  
  try {
    const dotenv = await import('dotenv');
    const result = dotenv.config({ path: envPath });
    
    if (result.error) {
      log('red', '❌ 环境变量加载失败:', result.error.message);
    } else {
      log('green', '✅ 环境变量加载成功');
      
      // 显示当前配置
      console.log('\n📋 当前数据库配置:');
      console.log('  ORACLE_USER:', process.env.ORACLE_USER || '❌ 未设置');
      console.log('  ORACLE_PASSWORD:', process.env.ORACLE_PASSWORD ? '✅ 已设置' : '❌ 未设置');
      console.log('  ORACLE_CONNECT_STRING:', process.env.ORACLE_CONNECT_STRING || '❌ 未设置');
      
      if (process.env.ORACLE_USER && process.env.ORACLE_PASSWORD && process.env.ORACLE_CONNECT_STRING) {
        log('green', '\n🎉 数据库配置完整，可以进行连接测试');
        console.log('\n🚀 下一步操作:');
        console.log('npm run test-simple  # 测试数据库连接');
      } else {
        log('yellow', '\n⚠️  数据库配置不完整');
        console.log('\n🔧 请编辑.env文件，确保所有Oracle配置项都已正确设置');
      }
    }
    
  } catch (error) {
    log('red', '❌ 环境变量测试失败:', error.message);
  }
  
  console.log('\n' + '='.repeat(50));
  log('cyan', '🏁 环境修复完成');
  console.log('');
  console.log('如果仍有问题，请运行:');
  console.log('npm run check-env     # 详细环境检查');
  console.log('npm run diagnose      # 综合诊断');
}

// 运行修复工具
fixEnvironment().catch(error => {
  console.error('💥 环境修复工具执行失败:', error);
  process.exit(1);
});