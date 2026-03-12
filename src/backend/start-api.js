/**
 * VF物流数据分析平台 - API服务启动脚本
 * 
 * 用于启动API服务器，包含环境检查和数据库连接测试
 */

const path = require('path');
const fs = require('fs');

// 设置环境变量路径
const envPath = path.join(__dirname, '.env');

// 检查.env文件是否存在
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('✅ 环境配置文件已加载');
} else {
  console.warn('⚠️  未找到.env文件，使用默认配置');
}

// 导入数据库测试模块
const { testConnection } = require('./src/config/database-api');

/**
 * 启动前环境检查
 */
async function preStartupCheck() {
  console.log('🔍 正在进行启动前检查...');
  
  // 检查Oracle客户端
  try {
    const oracledb = require('oracledb');
    console.log(`✅ Oracle客户端版本: ${oracledb.versionString}`);
  } catch (error) {
    console.error('❌ Oracle客户端未安装或配置错误:', error.message);
    console.log('💡 请参考 LOCAL_SETUP.md 文档安装Oracle Instant Client');
    process.exit(1);
  }
  
  // 检查必需的环境变量
  const requiredEnvVars = ['ORACLE_USER', 'ORACLE_PASSWORD', 'ORACLE_CONNECT_STRING'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 缺少必需的环境变量:', missingVars.join(', '));
    console.log('💡 请检查.env文件或设置环境变量');
    process.exit(1);
  }
  
  console.log('✅ 环境变量配置完整');
  
  // 测试数据库连接
  console.log('🔗 正在测试数据库连接...');
  try {
    const dbConnected = await testConnection();
    if (dbConnected) {
      console.log('✅ 数据库连接成功');
    } else {
      console.warn('⚠️  数据库连接失败，API将在有限功能模式下启动');
    }
  } catch (error) {
    console.warn('⚠️  数据库连接测试失败:', error.message);
    console.log('💡 API将在有限功能模式下启动');
  }
  
  console.log('🚀 启动前检查完成，正在启动API服务器...\n');
}

/**
 * 主启动函数
 */
async function main() {
  try {
    console.log('================================================================================');
    console.log('🏢 VF物流数据分析平台 - API服务器启动');
    console.log('================================================================================\n');
    
    // 执行启动前检查
    await preStartupCheck();
    
    // 启动API服务器
    require('./src/api-server');
    
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 启动应用
main();