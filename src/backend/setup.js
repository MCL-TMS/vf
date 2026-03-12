#!/usr/bin/env node

import fs from 'fs';
import readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function title(message) {
  console.log(`${colors.bold}${colors.cyan}${message}${colors.reset}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * VF物流数据分析平台 - Oracle数据库一键配置系统
 * 极简化配置流程，支持多种Oracle环境
 */
async function setupOracle() {
  console.clear();
  
  title('🚀 VF物流数据分析平台 - Oracle数据库一键配置');
  console.log('='.repeat(60));
  console.log('');
  
  log('blue', '欢迎使用Oracle数据库自动配置工具！');
  console.log('本工具将引导您快速完成Oracle数据库连接配置。\n');
  
  try {
    // 步骤1: 环境预检
    await environmentPreCheck();
    
    // 步骤2: 数据库配置
    const dbConfig = await databaseConfiguration();
    
    // 步骤3: 生成配置文件
    await generateConfigFiles(dbConfig);
    
    // 步骤4: 测试连接
    await testConnection(dbConfig);
    
    // 步骤5: 完成配置
    await finalizeSetup();
    
  } catch (error) {
    log('red', `\n❌ 配置过程中出现错误: ${error.message}`);
    await showTroubleshooting();
  } finally {
    rl.close();
  }
}

/**
 * 环境预检
 */
async function environmentPreCheck() {
  title('\n📋 步骤 1/5: 环境预检');
  console.log('-'.repeat(40));
  
  // 检查Node.js版本
  const nodeVersion = process.version;
  log('green', `✅ Node.js版本: ${nodeVersion}`);
  
  // 检查依赖安装
  if (fs.existsSync('node_modules')) {
    log('green', '✅ 项目依赖已安装');
  } else {
    log('yellow', '⚠️  正在安装项目依赖...');
    try {
      await execAsync('npm install');
      log('green', '✅ 依赖安装完成');
    } catch (error) {
      throw new Error('依赖安装失败，请手动运行: npm install');
    }
  }
  
  // 检查Oracle Client
  await checkOracleClient();
  
  console.log('');
  await question('按Enter键继续下一步... ');
}

/**
 * 检查Oracle Client
 */
async function checkOracleClient() {
  log('blue', '🔍 检查Oracle Instant Client...');
  
  try {
    // 尝试导入oracledb模块
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    
    try {
      const oracledb = require('oracledb');
      
      if (oracledb.thin) {
        log('green', '✅ 使用Oracle Thin模式 (无需额外配置)');
      } else {
        log('green', '✅ Oracle Client已安装');
      }
    } catch (importError) {
      if (importError.message.includes('DPI-1047')) {
        log('yellow', '⚠️  需要安装Oracle Instant Client');
        await promptOracleClientInstall();
      } else {
        throw importError;
      }
    }
  } catch (error) {
    log('yellow', '⚠️  Oracle模块检查失败，将使用基础配置');
  }
}

/**
 * 提示Oracle Client安装
 */
async function promptOracleClientInstall() {
  console.log('\n💡 Oracle Instant Client安装指南:');
  
  const platform = process.platform;
  if (platform === 'win32') {
    console.log('Windows用户:');
    console.log('1. 访问: https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html');
    console.log('2. 下载 "Basic Package"');
    console.log('3. 解压到 C:\\oracle\\instantclient_21_8');
    console.log('4. 添加到PATH环境变量');
  } else if (platform === 'linux') {
    console.log('Linux用户:');
    console.log('1. sudo apt-get install libaio1');
    console.log('2. 下载Oracle Instant Client Basic包');
    console.log('3. 配置LD_LIBRARY_PATH环境变量');
  } else if (platform === 'darwin') {
    console.log('macOS用户:');
    console.log('1. 下载Oracle Instant Client for macOS');
    console.log('2. 配置DYLD_LIBRARY_PATH环境变量');
  }
  
  const skip = await question('\n是否跳过Oracle Client安装？(回车跳过，输入n继续): ');
  if (skip.toLowerCase() === 'n') {
    throw new Error('请先安装Oracle Instant Client后重新运行配置');
  }
}

/**
 * 数据库配置
 */
async function databaseConfiguration() {
  title('\n🛠️  步骤 2/5: 数据库配置');
  console.log('-'.repeat(40));
  
  log('blue', '请选择您的Oracle数据库环境类型:');
  console.log('1. 本地Oracle XE数据库 (推荐新手)');
  console.log('2. 本地Oracle标准版数据库');
  console.log('3. 远程Oracle数据库');
  console.log('4. Oracle云数据库');
  console.log('5. 自定义配置');
  
  const choice = await question('\n请选择 [1]: ') || '1';
  
  let config = {};
  
  switch (choice) {
    case '1':
      config = await configureLocalXE();
      break;
    case '2':
      config = await configureLocalStandard();
      break;
    case '3':
      config = await configureRemote();
      break;
    case '4':
      config = await configureCloud();
      break;
    case '5':
      config = await configureCustom();
      break;
    default:
      config = await configureLocalXE();
  }
  
  return config;
}

/**
 * 配置本地Oracle XE
 */
async function configureLocalXE() {
  log('green', '\n📦 配置本地Oracle XE数据库');
  
  const user = await question('数据库用户名 [hr]: ') || 'hr';
  const password = await question('数据库密码 [hr]: ') || 'hr';
  const port = await question('数据库端口 [1521]: ') || '1521';
  
  return {
    type: 'Local XE',
    user,
    password,
    connectString: `localhost:${port}/XE`,
    host: 'localhost',
    port,
    service: 'XE'
  };
}

/**
 * 配置本地Oracle标准版
 */
async function configureLocalStandard() {
  log('green', '\n🏢 配置本地Oracle标准版数据库');
  
  const user = await question('数据库用户名: ');
  const password = await question('数据库密码: ');
  const port = await question('数据库端口 [1521]: ') || '1521';
  const service = await question('服务名 [ORCL]: ') || 'ORCL';
  
  return {
    type: 'Local Standard',
    user,
    password,
    connectString: `localhost:${port}/${service}`,
    host: 'localhost',
    port,
    service
  };
}

/**
 * 配置远程Oracle数据库
 */
async function configureRemote() {
  log('green', '\n🌐 配置远程Oracle数据库');
  
  const host = await question('数据库主机地址: ');
  const port = await question('数据库端口 [1521]: ') || '1521';
  const service = await question('服务名: ');
  const user = await question('数据库用户名: ');
  const password = await question('数据库密码: ');
  
  return {
    type: 'Remote',
    user,
    password,
    connectString: `${host}:${port}/${service}`,
    host,
    port,
    service
  };
}

/**
 * 配置Oracle云数据库
 */
async function configureCloud() {
  log('green', '\n☁️  配置Oracle云数据库');
  
  const host = await question('云数据库主机地址: ');
  const port = await question('数据库端口 [1521]: ') || '1521';
  const service = await question('服务名: ');
  const user = await question('数据库用户名: ');
  const password = await question('数据库密码: ');
  
  console.log('\n💡 提示: Oracle云数据库可能需要SSL连接和钱包文件');
  const ssl = await question('是否使用SSL连接？(y/n) [n]: ') || 'n';
  
  return {
    type: 'Cloud',
    user,
    password,
    connectString: `${host}:${port}/${service}`,
    host,
    port,
    service,
    ssl: ssl.toLowerCase() === 'y'
  };
}

/**
 * 自定义配置
 */
async function configureCustom() {
  log('green', '\n⚙️  自定义配置');
  
  const user = await question('数据库用户名: ');
  const password = await question('数据库密码: ');
  
  console.log('\n请选择连接字符串格式:');
  console.log('1. 简单格式: host:port/service');
  console.log('2. 完整格式: (DESCRIPTION=...)');
  
  const format = await question('选择格式 [1]: ') || '1';
  
  let connectString;
  if (format === '2') {
    console.log('\n请输入完整的连接描述符:');
    connectString = await question('连接字符串: ');
  } else {
    const host = await question('主机地址: ');
    const port = await question('端口 [1521]: ') || '1521';
    const service = await question('服务名: ');
    connectString = `${host}:${port}/${service}`;
  }
  
  return {
    type: 'Custom',
    user,
    password,
    connectString
  };
}

/**
 * 生成配置文件
 */
async function generateConfigFiles(config) {
  title('\n📄 步骤 3/5: 生成配置文件');
  console.log('-'.repeat(40));
  
  // 生成.env文件
  const envContent = generateEnvContent(config);
  
  try {
    fs.writeFileSync('.env', envContent);
    log('green', '✅ .env配置文件已生成');
  } catch (error) {
    throw new Error(`配置文件生成失败: ${error.message}`);
  }
  
  // 生成数据库配置文件
  const dbConfigContent = generateDatabaseConfig(config);
  
  try {
    // 确保目录存在
    if (!fs.existsSync('src/config')) {
      fs.mkdirSync('src/config', { recursive: true });
    }
    
    fs.writeFileSync('src/config/database.js', dbConfigContent);
    log('green', '✅ 数据库配置文件已生成');
  } catch (error) {
    log('yellow', `⚠️  数据库配置文件生成失败: ${error.message}`);
  }
  
  // 显示配置总结
  console.log('\n📋 配置总结:');
  console.log(`   数据库类型: ${config.type}`);
  console.log(`   用户名: ${config.user}`);
  console.log(`   连接字符串: ${config.connectString}`);
  
  console.log('');
  await question('按Enter键继续测试连接... ');
}

/**
 * 生成.env文件内容
 */
function generateEnvContent(config) {
  const timestamp = new Date().toLocaleString();
  
  return `# VF物流数据分析平台 Oracle数据库配置
# 自动生成时间: ${timestamp}
# 数据库类型: ${config.type}

# 服务器配置
NODE_ENV=development
PORT=3001
HOST=localhost

# Oracle数据库配置
ORACLE_USER=${config.user}
ORACLE_PASSWORD=${config.password}
ORACLE_CONNECT_STRING=${config.connectString}

# 连接池配置 (优化性能)
ORACLE_POOL_MIN=1
ORACLE_POOL_MAX=5
ORACLE_POOL_INCREMENT=1
ORACLE_POOL_TIMEOUT=60

# 应用配置
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info

# 安全配置
JWT_SECRET=vf_logistics_${Date.now()}
API_RATE_LIMIT=100

# Oracle Client配置提示
# 确保Oracle Instant Client已正确安装并配置环境变量
${config.ssl ? '# SSL_MODE=true  # Oracle云数据库SSL连接' : ''}
`;
}

/**
 * 生成数据库配置文件内容
 */
function generateDatabaseConfig(config) {
  return `// VF物流数据分析平台 Oracle数据库配置
// 自动生成 - 请勿手动编辑

import oracledb from 'oracledb';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// Oracle数据库连接配置
const dbConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
  poolMin: parseInt(process.env.ORACLE_POOL_MIN) || 1,
  poolMax: parseInt(process.env.ORACLE_POOL_MAX) || 5,
  poolIncrement: parseInt(process.env.ORACLE_POOL_INCREMENT) || 1,
  poolTimeout: parseInt(process.env.ORACLE_POOL_TIMEOUT) || 60,
  // 启用自动提交
  autoCommit: true,
  // 设置输出格式为对象
  outFormat: oracledb.OUT_FORMAT_OBJECT
};

let pool = null;

/**
 * 初始化数据库连接池
 */
export async function initializeDatabase() {
  try {
    if (pool) {
      console.log('数据库连接池已存在');
      return pool;
    }
    
    console.log('正在初始化Oracle数据库连接池...');
    pool = await oracledb.createPool(dbConfig);
    console.log('✅ Oracle数据库连接池初始化成功');
    
    return pool;
  } catch (error) {
    console.error('❌ 数据库连接池初始化失败:', error.message);
    throw error;
  }
}

/**
 * 获取数据库连接
 */
export async function getConnection() {
  try {
    if (!pool) {
      await initializeDatabase();
    }
    
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error('❌ 获取数据库连接失败:', error.message);
    throw error;
  }
}

/**
 * 释放数据库连接
 */
export async function releaseConnection(connection) {
  try {
    if (connection) {
      await connection.close();
    }
  } catch (error) {
    console.error('⚠️  释放数据库连接时出错:', error.message);
  }
}

/**
 * 执行查询
 */
export async function executeQuery(sql, binds = [], options = {}) {
  let connection;
  
  try {
    connection = await getConnection();
    const result = await connection.execute(sql, binds, options);
    return result;
  } catch (error) {
    console.error('❌ 查询执行失败:', error.message);
    throw error;
  } finally {
    if (connection) {
      await releaseConnection(connection);
    }
  }
}

/**
 * 关闭数据库连接池
 */
export async function closeDatabase() {
  try {
    if (pool) {
      await pool.close(10);
      pool = null;
      console.log('✅ 数据库连接池已关闭');
    }
  } catch (error) {
    console.error('⚠️  关闭数据库连接池时出错:', error.message);
  }
}

// 进程退出时自动关闭连接池
process.on('SIGINT', async () => {
  console.log('\\n正在关闭数据库连接池...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\\n正在关闭数据库连接池...');
  await closeDatabase();
  process.exit(0);
});

export default {
  initializeDatabase,
  getConnection,
  releaseConnection,
  executeQuery,
  closeDatabase
};
`;
}

/**
 * 测试连接
 */
async function testConnection(config) {
  title('\n🧪 步骤 4/5: 测试数据库连接');
  console.log('-'.repeat(40));
  
  log('blue', '正在测试数据库连接...');
  
  try {
    // 加载环境变量
    const dotenv = await import('dotenv');
    dotenv.config();
    
    // 尝试连接数据库
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    
    try {
      const oracledb = require('oracledb');
      
      // 设置输出格式
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      
      const connection = await oracledb.getConnection({
        user: config.user,
        password: config.password,
        connectString: config.connectString
      });
      
      // 执行测试查询
      const result = await connection.execute('SELECT SYSDATE as CURRENT_TIME, USER as CURRENT_USER FROM DUAL');
      
      if (result.rows && result.rows.length > 0) {
        log('green', '✅ 数据库连接测试成功！');
        console.log(`   当前时间: ${result.rows[0].CURRENT_TIME}`);
        console.log(`   当前用户: ${result.rows[0].CURRENT_USER}`);
      }
      
      await connection.close();
      
    } catch (dbError) {
      throw new Error(`数据库连接失败: ${dbError.message}`);
    }
    
  } catch (error) {
    log('red', `❌ 连接测试失败: ${error.message}`);
    
    const retry = await question('\n是否重新配置数据库？(y/n) [n]: ');
    if (retry.toLowerCase() === 'y') {
      return await setupOracle();
    } else {
      throw error;
    }
  }
  
  console.log('');
  await question('按Enter键完成配置... ');
}

/**
 * 完成配置
 */
async function finalizeSetup() {
  title('\n🎉 步骤 5/5: 配置完成');
  console.log('-'.repeat(40));
  
  log('green', '✅ Oracle数据库配置已完成！');
  
  console.log('\n📋 后续操作:');
  console.log('1. 启动开发服务器:');
  console.log('   npm run dev');
  console.log('');
  console.log('2. 运行完整测试:');
  console.log('   npm run test');
  console.log('');
  console.log('3. 检查连接状态:');
  console.log('   npm run quick-test');
  
  console.log('\n📚 帮助文档:');
  console.log('- README.md: 项目说明');
  console.log('- TROUBLESHOOTING.md: 问题排查');
  
  console.log('\n🚀 VF物流数据分析平台已准备就绪！');
}

/**
 * 显示故障排除信息
 */
async function showTroubleshooting() {
  console.log('\n🔧 故障排除建议:');
  console.log('-'.repeat(40));
  
  console.log('\n1. 常见问题解决:');
  console.log('   - 检查Oracle数据库服务是否运行');
  console.log('   - 验证用户名和密码是否正确');
  console.log('   - 确认网络连接和防火墙设置');
  
  console.log('\n2. Oracle Client问题:');
  console.log('   - 确保Oracle Instant Client已安装');
  console.log('   - 检查环境变量配置');
  console.log('   - 重启终端/命令行');
  
  console.log('\n3. 获取帮助:');
  console.log('   - 查看 TROUBLESHOOTING.md 文件');
  console.log('   - 运行诊断工具: npm run diagnose');
  
  const restart = await question('\n是否重新开始配置？(y/n) [n]: ');
  if (restart.toLowerCase() === 'y') {
    return await setupOracle();
  }
}

// 处理Ctrl+C中断
process.on('SIGINT', () => {
  console.log('\n\n👋 配置已取消');
  rl.close();
  process.exit(0);
});

// 运行配置
setupOracle().catch(error => {
  log('red', `\n💥 配置失败: ${error.message}`);
  rl.close();
  process.exit(1);
});