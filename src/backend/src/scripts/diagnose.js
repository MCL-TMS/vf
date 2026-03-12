#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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
 * 环境诊断工具
 */
async function diagnoseEnvironment() {
  log('cyan', '🔍 VF物流后端环境诊断工具');
  log('cyan', '=' .repeat(50));
  
  let allChecksPass = true;
  
  // 检查1: Node.js版本
  console.log('\n📋 检查1: Node.js环境');
  console.log('-'.repeat(30));
  
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion >= 18) {
    log('green', `✅ Node.js版本: ${nodeVersion} (符合要求 >=18)`);
  } else {
    log('red', `❌ Node.js版本: ${nodeVersion} (需要 >=18)`);
    allChecksPass = false;
  }
  
  // 检查2: package.json
  console.log('\n📋 检查2: 项目文件');
  console.log('-'.repeat(30));
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    log('green', '✅ package.json 存在');
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      log('white', `   项目名称: ${packageJson.name}`);
      log('white', `   项目版本: ${packageJson.version}`);
    } catch (error) {
      log('yellow', '⚠️  package.json 解析错误');
    }
  } else {
    log('red', '❌ package.json 不存在');
    allChecksPass = false;
  }
  
  // 检查3: node_modules
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    log('green', '✅ node_modules 存在');
  } else {
    log('red', '❌ node_modules 不存在，请运行 npm install');
    allChecksPass = false;
  }
  
  // 检查4: .env文件
  console.log('\n📋 检查3: 环境配置');
  console.log('-'.repeat(30));
  
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    log('green', '✅ .env 文件存在');
    
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n').filter(line => 
        line.trim() && !line.trim().startsWith('#')
      );
      
      const requiredVars = [
        'ORACLE_USER',
        'ORACLE_PASSWORD', 
        'ORACLE_CONNECT_STRING'
      ];
      
      const presentVars = [];
      const missingVars = [];
      
      requiredVars.forEach(varName => {
        const hasVar = envLines.some(line => line.startsWith(`${varName}=`));
        if (hasVar) {
          presentVars.push(varName);
        } else {
          missingVars.push(varName);
        }
      });
      
      if (presentVars.length > 0) {
        log('green', `   已配置变量: ${presentVars.join(', ')}`);
      }
      
      if (missingVars.length > 0) {
        log('yellow', `   ⚠️  缺少变量: ${missingVars.join(', ')}`);
        allChecksPass = false;
      }
      
    } catch (error) {
      log('yellow', '⚠️  .env 文件读取错误');
    }
  } else {
    log('red', '❌ .env 文件不存在');
    log('yellow', '   请执行: cp .env.example .env');
    log('yellow', '   然后编辑 .env 文件配置数据库连接信息');
    allChecksPass = false;
  }
  
  // 检查5: Oracle客户端
  console.log('\n📋 检查4: Oracle数据库模块');
  console.log('-'.repeat(30));
  
  try {
    // 尝试导入oracledb模块
    const oracledb = require('oracledb');
    log('green', '✅ oracledb 模块加载成功');
    
    // 检查Oracle Client
    try {
      log('white', `   Oracle Client 版本: ${oracledb.versionString || '未知'}`);
      log('white', `   Oracle Client 模式: ${oracledb.thin ? 'Thin模式' : 'Thick模式'}`);
    } catch (clientError) {
      log('yellow', '   ⚠️  Oracle Client 信息获取失败');
    }
    
  } catch (importError) {
    log('red', '❌ oracledb 模块加载失败');
    log('red', `   错误: ${importError.message}`);
    
    if (importError.message.includes('DPI-1047')) {
      log('yellow', '   💡 解决方案: 需要安装Oracle Instant Client');
      log('yellow', '      Windows: 下载Oracle Instant Client并配置PATH');
      log('yellow', '      Linux: sudo apt-get install libaio1 或 yum install libaio');
      log('yellow', '      macOS: 下载Oracle Instant Client');
    }
    
    allChecksPass = false;
  }
  
  // 检查6: 基本数据库配置测试
  if (allChecksPass) {
    console.log('\n📋 检查5: 数据库配置验证');
    console.log('-'.repeat(30));
    
    try {
      // 尝试加载环境变量
      const dotenv = require('dotenv');
      dotenv.config();
      
      const dbConfig = {
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectString: process.env.ORACLE_CONNECT_STRING
      };
      
      if (dbConfig.user && dbConfig.password && dbConfig.connectString) {
        log('green', '✅ 数据库配置参数完整');
        log('white', `   用户名: ${dbConfig.user}`);
        log('white', `   连接字符串: ${dbConfig.connectString}`);
        log('white', `   密码: ${dbConfig.password ? '已设置' : '未设置'}`);
      } else {
        log('red', '❌ 数据库配置参数不完整');
        allChecksPass = false;
      }
      
    } catch (configError) {
      log('red', '❌ 环境配置加载失败');
      log('red', `   错误: ${configError.message}`);
      allChecksPass = false;
    }
  }
  
  // 总结
  console.log('\n' + '='.repeat(50));
  if (allChecksPass) {
    log('green', '🎉 环境检查全部通过！可以尝试数据库连接测试');
    log('cyan', '');
    log('cyan', '下一步操作:');
    log('white', '1. 确保Oracle数据库服务正在运行');
    log('white', '2. 执行: npm run test');
    log('white', '3. 如果还有问题，检查网络连接和防火墙设置');
  } else {
    log('red', '❌ 环境检查发现问题，请根据上述提示进行修复');
    log('cyan', '');
    log('cyan', '修复步骤:');
    log('white', '1. 确保Node.js版本 >= 18');
    log('white', '2. 运行 npm install 安装依赖');
    log('white', '3. 复制并配置 .env 文件');
    log('white', '4. 安装Oracle Instant Client');
    log('white', '5. 重新运行诊断: node src/scripts/diagnose.js');
  }
  log('cyan', '='.repeat(50));
}

// 运行诊断
diagnoseEnvironment().catch(error => {
  console.error('\n💥 诊断工具执行失败:');
  console.error(error);
  console.error('\n这通常表示严重的环境问题，请检查:');
  console.error('1. Node.js版本是否符合要求');
  console.error('2. 是否在正确的目录下执行');
  console.error('3. package.json是否存在');
  process.exit(1);
});