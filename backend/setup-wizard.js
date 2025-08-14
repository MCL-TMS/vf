#!/usr/bin/env node

import fs from 'fs';
import readline from 'readline';

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * VF物流后端快速设置向导
 */
async function setupWizard() {
  log('cyan', '🚀 VF物流数据分析平台后端设置向导');
  log('cyan', '=' .repeat(60));
  
  console.log('\n欢迎使用VF物流后端设置向导！');
  console.log('本向导将帮助您快速配置Oracle数据库连接。\n');
  
  // 检查.env文件
  if (fs.existsSync('.env')) {
    log('yellow', '⚠️  检测到已存在.env文件');
    const overwrite = await question('是否要重新配置？(y/n): ');
    if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
      console.log('设置取消。');
      rl.close();
      return;
    }
  }
  
  console.log('\n请提供以下Oracle数据库连接信息：');
  console.log('-'.repeat(40));
  
  // 收集数据库连接信息
  const dbUser = await question('数据库用户名 [hr]: ') || 'hr';
  const dbPassword = await question('数据库密码 [hr123]: ') || 'hr123';
  
  console.log('\n请选择连接字符串格式：');
  console.log('1. 本地Oracle XE (localhost:1521/XE)');
  console.log('2. 本地Oracle标准版 (localhost:1521/ORCL)');
  console.log('3. 远程数据库');
  console.log('4. 自定义');
  
  const formatChoice = await question('选择 [1]: ') || '1';
  
  let connectString;
  switch (formatChoice) {
    case '1':
      connectString = 'localhost:1521/XE';
      break;
    case '2':
      connectString = 'localhost:1521/ORCL';
      break;
    case '3':
      const remoteHost = await question('远程主机地址: ');
      const remotePort = await question('端口 [1521]: ') || '1521';
      const remoteService = await question('服务名: ');
      connectString = `${remoteHost}:${remotePort}/${remoteService}`;
      break;
    case '4':
      connectString = await question('自定义连接字符串: ');
      break;
    default:
      connectString = 'localhost:1521/XE';
  }
  
  // 其他配置
  const serverPort = await question('服务器端口 [3001]: ') || '3001';
  const corsOrigin = await question('CORS允许的前端地址 [http://localhost:3000]: ') || 'http://localhost:3000';
  
  // 生成.env内容
  const envContent = `# VF物流数据分析平台后端配置
# 生成时间: ${new Date().toLocaleString()}

# 服务器配置
NODE_ENV=development
PORT=${serverPort}
HOST=localhost

# Oracle数据库配置
ORACLE_USER=${dbUser}
ORACLE_PASSWORD=${dbPassword}
ORACLE_CONNECT_STRING=${connectString}

# 连接池配置
ORACLE_POOL_MIN=2
ORACLE_POOL_MAX=10
ORACLE_POOL_INCREMENT=2
ORACLE_POOL_TIMEOUT=60

# CORS配置
CORS_ORIGIN=${corsOrigin}

# 日志配置
LOG_LEVEL=info

# 安全配置
JWT_SECRET=vf_logistics_${Date.now()}
API_RATE_LIMIT=100
`;
  
  // 写入.env文件
  try {
    fs.writeFileSync('.env', envContent);
    log('green', '\n✅ .env文件创建成功！');
  } catch (error) {
    log('red', '\n❌ .env文件创建失败:', error.message);
    rl.close();
    return;
  }
  
  // 显示配置总结
  console.log('\n📋 配置总结:');
  console.log('-'.repeat(30));
  console.log(`数据库用户: ${dbUser}`);
  console.log(`连接字符串: ${connectString}`);
  console.log(`服务器端口: ${serverPort}`);
  console.log(`CORS源: ${corsOrigin}`);
  
  // 下一步指导
  console.log('\n🎯 下一步操作:');
  console.log('-'.repeat(30));
  console.log('1. 确保Oracle数据库服务正在运行');
  console.log('2. 确保Oracle Instant Client已正确安装');
  
  const platform = process.platform;
  if (platform === 'win32') {
    console.log('3. Windows用户: 检查PATH环境变量包含Oracle路径');
  } else if (platform === 'linux') {
    console.log('3. Linux用户: 检查LD_LIBRARY_PATH和libaio1依赖');
  } else if (platform === 'darwin') {
    console.log('3. macOS用户: 检查DYLD_LIBRARY_PATH环境变量');
  }
  
  console.log('4. 运行测试命令验证连接:');
  console.log('   npm run check-env     # 检查环境配置');
  console.log('   npm run check-oracle  # 检查Oracle Client');
  console.log('   npm run test-simple   # 测试数据库连接');
  
  // 询问是否立即测试
  const testNow = await question('\n是否立即运行环境检查？(y/n): ');
  if (testNow.toLowerCase() === 'y' || testNow.toLowerCase() === 'yes') {
    console.log('\n正在运行环境检查...');
    
    try {
      const { checkEnvironmentFile } = await import('./src/scripts/checkEnv.js');
      await checkEnvironmentFile();
    } catch (error) {
      log('red', '环境检查失败:', error.message);
      console.log('请手动运行: npm run check-env');
    }
  }
  
  console.log('\n🎉 设置完成！');
  console.log('如果遇到问题，请查看 TROUBLESHOOTING.md 文件');
  
  rl.close();
}

// 处理Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 设置已取消');
  rl.close();
  process.exit(0);
});

// 运行设置向导
setupWizard().catch(error => {
  log('red', '💥 设置向导执行失败:', error);
  rl.close();
  process.exit(1);
});