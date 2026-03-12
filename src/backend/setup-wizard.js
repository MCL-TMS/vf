/**
 * VF物流数据分析平台 - 交互式安装向导
 * 
 * 提供向导式的环境配置和数据库连接设置
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 创建交互式界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorLog(color, message) {
  console.log(color + message + colors.reset);
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// 配置项 - 使用现有的环境变量格式
let config = {
  ORACLE_CONNECT_STRING: 'localhost:1521/XE',
  ORACLE_USER: '',
  ORACLE_PASSWORD: '',
  ORACLE_POOL_MIN: '2',
  ORACLE_POOL_MAX: '10',
  ORACLE_POOL_INCREMENT: '2',
  ORACLE_POOL_TIMEOUT: '60',
  API_PORT: '3001',
  NODE_ENV: 'development'
};

/**
 * 显示欢迎信息
 */
function showWelcome() {
  console.clear();
  colorLog(colors.cyan, '================================================================================');
  colorLog(colors.bright + colors.blue, '🏢 VF物流数据分析平台 - 安装向导');
  colorLog(colors.cyan, '================================================================================');
  console.log();
  colorLog(colors.green, '欢迎使用VF物流数据分析平台！');
  console.log('本向导将帮助您完成环境配置和数据库连接设置。');
  console.log();
}

/**
 * 检查前置条件
 */
async function checkPrerequisites() {
  colorLog(colors.yellow, '🔍 检查前置条件...');
  console.log();
  
  // 检查Node.js版本
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
  
  if (majorVersion >= 16) {
    colorLog(colors.green, `✅ Node.js版本: ${nodeVersion} (满足要求)`);
  } else {
    colorLog(colors.red, `❌ Node.js版本: ${nodeVersion} (需要 >=16.0.0)`);
    console.log('请升级Node.js版本后重新运行安装向导。');
    process.exit(1);
  }
  
  // 检查Oracle客户端
  try {
    const oracledb = require('oracledb');
    colorLog(colors.green, `✅ Oracle客户端: ${oracledb.versionString}`);
  } catch (error) {
    colorLog(colors.red, '❌ Oracle客户端未安装或配置错误');
    console.log('请参考 LOCAL_SETUP.md 安装Oracle Instant Client。');
    
    const continueSetup = await question('\n是否继续配置（稍后手动安装Oracle客户端）？ (y/N): ');
    if (continueSetup.toLowerCase() !== 'y') {
      process.exit(1);
    }
  }
  
  console.log();
}

/**
 * 检查现有配置
 */
function checkExistingConfig() {
  const envPath = path.join(__dirname, '.env');
  
  if (fs.existsSync(envPath)) {
    colorLog(colors.yellow, '⚠️  检测到现有的.env配置文件');
    
    // 读取现有配置
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    envLines.forEach(line => {
      const [key, value] = line.split('=');
      if (key && value && config.hasOwnProperty(key)) {
        config[key] = value.trim();
      }
    });
    
    return true;
  }
  
  return false;
}

/**
 * 数据库配置向导
 */
async function databaseConfiguration() {
  colorLog(colors.bright + colors.blue, '🗃️  数据库配置');
  console.log('请提供Oracle数据库连接信息：');
  console.log();
  
  // 连接字符串
  const connectString = await question(`Oracle连接字符串 [${config.ORACLE_CONNECT_STRING}]: `);
  if (connectString.trim()) config.ORACLE_CONNECT_STRING = connectString.trim();
  
  // 用户名
  let dbUser;
  do {
    dbUser = await question(`数据库用户名${config.ORACLE_USER ? ` [${config.ORACLE_USER}]` : ''}: `);
    if (dbUser.trim()) {
      config.ORACLE_USER = dbUser.trim();
    } else if (!config.ORACLE_USER) {
      colorLog(colors.red, '❌ 用户名不能为空');
    }
  } while (!config.ORACLE_USER);
  
  // 密码
  let dbPassword;
  do {
    dbPassword = await question(`数据库密码${config.ORACLE_PASSWORD ? ' [已配置，按Enter跳过]' : ''}: `);
    if (dbPassword.trim()) {
      config.ORACLE_PASSWORD = dbPassword.trim();
    } else if (!config.ORACLE_PASSWORD) {
      colorLog(colors.red, '❌ 密码不能为空');
    }
  } while (!config.ORACLE_PASSWORD);
  
  console.log();
}

/**
 * API服务器配置
 */
async function apiConfiguration() {
  colorLog(colors.bright + colors.blue, '🚀 API服务器配置');
  console.log();
  
  // API端口
  const apiPort = await question(`API服务器端口 [${config.API_PORT}]: `);
  if (apiPort.trim()) config.API_PORT = apiPort.trim();
  
  // 环境模式
  console.log('\n环境模式选择:');
  console.log('1. development (开发模式，详细日志)');
  console.log('2. production (生产模式，优化性能)');
  
  const envChoice = await question(`请选择环境模式 [1]: `);
  if (envChoice === '2') {
    config.NODE_ENV = 'production';
  }
  
  console.log();
}

/**
 * 测试数据库连接
 */
async function testDatabaseConnection() {
  colorLog(colors.yellow, '🔗 测试数据库连接...');
  
  try {
    // 动态导入数据库配置
    process.env.ORACLE_CONNECT_STRING = config.ORACLE_CONNECT_STRING;
    process.env.ORACLE_USER = config.ORACLE_USER;
    process.env.ORACLE_PASSWORD = config.ORACLE_PASSWORD;
    process.env.ORACLE_POOL_MIN = config.ORACLE_POOL_MIN;
    process.env.ORACLE_POOL_MAX = config.ORACLE_POOL_MAX;
    
    const { testConnection } = require('./src/config/database-api');
    const isConnected = await testConnection();
    
    if (isConnected) {
      colorLog(colors.green, '✅ 数据库连接成功！');
      return true;
    } else {
      colorLog(colors.red, '❌ 数据库连接失败');
      return false;
    }
  } catch (error) {
    colorLog(colors.red, `❌ 数据库连接错误: ${error.message}`);
    return false;
  }
}

/**
 * 保存配置到.env文件
 */
function saveConfiguration() {
  const envContent = Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  const envPath = path.join(__dirname, '.env');
  fs.writeFileSync(envPath, envContent + '\n');
  
  colorLog(colors.green, '✅ 配置已保存到 .env 文件');
}

/**
 * 显示配置摘要
 */
function showConfigSummary() {
  colorLog(colors.bright + colors.blue, '📋 配置摘要');
  console.log();
  
  console.log('数据库配置:');
  console.log(`  连接字符串: ${config.ORACLE_CONNECT_STRING}`);
  console.log(`  用户名: ${config.ORACLE_USER}`);
  console.log(`  密码: ${'*'.repeat(config.ORACLE_PASSWORD.length)}`);
  
  console.log('\nAPI服务器配置:');
  console.log(`  端口: ${config.API_PORT}`);
  console.log(`  环境: ${config.NODE_ENV}`);
  
  console.log();
}

/**
 * 显示后续步骤
 */
function showNextSteps() {
  colorLog(colors.bright + colors.green, '🎉 安装配置完成！');
  console.log();
  
  colorLog(colors.bright, '📋 后续操作步骤:');
  console.log();
  
  console.log('1. 检查数据库表结构:');
  colorLog(colors.cyan, '   npm run check-tables');
  
  console.log('\n2. 启动API服务器:');
  colorLog(colors.cyan, '   npm start');
  
  console.log('\n3. 验证服务运行:');
  colorLog(colors.cyan, `   curl http://localhost:${config.API_PORT}/api/health`);
  
  console.log('\n4. 查看API文档:');
  colorLog(colors.cyan, `   http://localhost:${config.API_PORT}/api/info`);
  
  console.log('\n📚 相关文档:');
  console.log('  - API使用指南: API_GUIDE.md');
  console.log('  - 故障排除: TROUBLESHOOTING.md');
  console.log('  - 表结构规范: VF_LOGISTICS_SCHEMA.md');
  
  console.log();
  colorLog(colors.green, '感谢使用VF物流数据分析平台！');
}

/**
 * 主安装流程
 */
async function main() {
  try {
    showWelcome();
    
    await checkPrerequisites();
    
    const hasExistingConfig = checkExistingConfig();
    if (hasExistingConfig) {
      const useExisting = await question('是否使用现有配置？ (Y/n): ');
      if (useExisting.toLowerCase() === 'n') {
        config = {
          DB_HOST: 'localhost',
          DB_PORT: '1521',
          DB_SERVICE_NAME: 'XE',
          DB_USER: '',
          DB_PASSWORD: '',
          API_PORT: '3001',
          NODE_ENV: 'development'
        };
      }
    }
    
    await databaseConfiguration();
    await apiConfiguration();
    
    showConfigSummary();
    
    const confirm = await question('确认以上配置并继续？ (Y/n): ');
    if (confirm.toLowerCase() === 'n') {
      console.log('配置已取消。');
      process.exit(0);
    }
    
    // 测试数据库连接
    const dbTestResult = await testDatabaseConnection();
    if (!dbTestResult) {
      const continueAnyway = await question('\n数据库连接失败，是否仍要保存配置？ (y/N): ');
      if (continueAnyway.toLowerCase() !== 'y') {
        console.log('配置已取消。');
        process.exit(1);
      }
    }
    
    saveConfiguration();
    showNextSteps();
    
  } catch (error) {
    colorLog(colors.red, `❌ 安装过程中发生错误: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// 运行安装向导
main();