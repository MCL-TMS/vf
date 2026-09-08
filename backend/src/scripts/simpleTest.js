#!/usr/bin/env node

/**
 * 简化的Oracle数据库连接测试脚本
 * 用于诊断连接问题，提供详细的调试输出
 */

console.log('🔧 开始简化的Oracle数据库连接测试...');
console.log('当前时间:', new Date().toLocaleString());
console.log('Node.js版本:', process.version);
console.log('工作目录:', process.cwd());
console.log('='.repeat(60));

// 步骤1: 检查环境变量加载
console.log('\n📋 步骤1: 加载环境变量...');
try {
  const dotenv = require('dotenv');
  
  // 显式指定.env文件路径
  const envPath = './backend/.env';
  const fs = require('fs');
  
  // 检查.env文件是否存在
  if (fs.existsSync('.env')) {
    console.log('✅ 找到.env文件在当前目录');
    const result = dotenv.config();
    if (result.error) {
      console.log('⚠️  .env文件加载警告:', result.error.message);
    } else {
      console.log('✅ .env文件加载成功');
    }
  } else if (fs.existsSync(envPath)) {
    console.log('✅ 找到.env文件在backend目录');
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      console.log('⚠️  .env文件加载警告:', result.error.message);
    } else {
      console.log('✅ .env文件加载成功');
    }
  } else {
    console.log('❌ 未找到.env文件');
    console.log('请确保.env文件存在于以下位置之一:');
    console.log('  - ./backend/.env');
    console.log('  - ./.env');
    console.log('\n建议执行: cp .env.example .env');
    process.exit(1);
  }
  
  // 显示数据库配置（隐藏敏感信息）
  const dbUser = process.env.ORACLE_USER;
  const dbPassword = process.env.ORACLE_PASSWORD;
  const dbConnectString = process.env.ORACLE_CONNECT_STRING;
  
  console.log('数据库配置检查:');
  console.log('  ORACLE_USER:', dbUser || '❌ 未设置');
  console.log('  ORACLE_PASSWORD:', dbPassword ? '✅ 已设置' : '❌ 未设置');
  console.log('  ORACLE_CONNECT_STRING:', dbConnectString || '❌ 未设置');
  
  if (!dbUser || !dbPassword || !dbConnectString) {
    console.log('\n❌ 数据库配置不完整，请检查.env文件');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ 环境变量加载失败:', error.message);
  process.exit(1);
}

// 步骤2: 加载Oracle数据库模块
console.log('\n📋 步骤2: 加载Oracle数据库模块...');
let oracledb;
try {
  oracledb = require('oracledb');
  console.log('✅ oracledb模块加载成功');
  console.log('Oracle版本:', oracledb.versionString || '未知');
  
  // 设置输出格式
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  console.log('✅ 输出格式设置为对象模式');
  
} catch (error) {
  console.error('❌ oracledb模块加载失败:', error.message);
  
  if (error.message.includes('DPI-1047')) {
    console.error('\n💡 解决方案:');
    console.error('需要安装Oracle Instant Client:');
    console.error('Windows: https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html');
    console.error('Linux: sudo apt-get install libaio1');
    console.error('macOS: https://www.oracle.com/database/technologies/instant-client/macos-intel-x86-downloads.html');
  }
  
  process.exit(1);
}

async function main() {
// 步骤3: 创建数据库连接
console.log('\n📋 步骤3: 创建数据库连接...');
let connection;
try {
  const dbConfig = {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
    // 添加连接超时
    connectTimeout: 30000, // 30秒超时
    // 禁用连接池以简化测试
    poolMin: 0,
    poolMax: 1
  };
  
  console.log('尝试连接到数据库...');
  console.log('连接配置:');
  console.log('  用户名:', dbConfig.user);
  console.log('  连接字符串:', dbConfig.connectString);
  console.log('  连接超时:', dbConfig.connectTimeout + 'ms');
  
  const startTime = Date.now();
  connection = await oracledb.getConnection(dbConfig);
  const connectTime = Date.now() - startTime;
  
  console.log(`✅ 数据库连接成功！耗时: ${connectTime}ms`);
  
} catch (error) {
  console.error('❌ 数据库连接失败:', error.message);
  
  // 提供具体的错误解决建议
  if (error.message.includes('ORA-12154')) {
    console.error('\n💡 ORA-12154 解决方案:');
    console.error('1. 检查ORACLE_CONNECT_STRING格式');
    console.error('2. 尝试格式: localhost:1521/XE 或 localhost:1521:ORCL');
  } else if (error.message.includes('ORA-01017')) {
    console.error('\n💡 ORA-01017 解决方案:');
    console.error('1. 检查用户名和密码是否正确');
    console.error('2. 确认用户账户没有被锁定');
  } else if (error.message.includes('ORA-12541')) {
    console.error('\n💡 ORA-12541 解决方案:');
    console.error('1. 检查Oracle数据库服务是否正在运行');
    console.error('2. 确认端口1521是否正确');
  }
  
  process.exit(1);
}

// 步骤4: 执行简单查询
console.log('\n📋 步骤4: 执行数据库查询测试...');
try {
  console.log('执行查询: SELECT SYSDATE, USER FROM DUAL');
  
  const startTime = Date.now();
  const result = await connection.execute('SELECT SYSDATE as CURRENT_TIME, USER as CURRENT_USER FROM DUAL');
  const queryTime = Date.now() - startTime;
  
  console.log(`✅ 查询执行成功！耗时: ${queryTime}ms`);
  console.log('查询结果:');
  
  if (result.rows && result.rows.length > 0) {
    const row = result.rows[0];
    console.log('  当前时间:', row.CURRENT_TIME);
    console.log('  当前用户:', row.CURRENT_USER);
  } else {
    console.log('  无数据返回');
  }
  
} catch (error) {
  console.error('❌ 查询执行失败:', error.message);
}

// 步骤5: 获取数据库版本信息
console.log('\n📋 步骤5: 获取数据库版本信息...');
try {
  const versionResult = await connection.execute('SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1');
  
  if (versionResult.rows && versionResult.rows.length > 0) {
    console.log('✅ 数据库版本:', versionResult.rows[0].BANNER);
  } else {
    console.log('⚠️  无法获取版本信息');
  }
} catch (error) {
  console.log('⚠️  版本信息获取失败:', error.message);
}

// 步骤6: 清理资源
console.log('\n📋 步骤6: 清理资源...');
try {
  if (connection) {
    await connection.close();
    console.log('✅ 数据库连接已关闭');
  }
} catch (error) {
  console.error('⚠️  关闭连接时出错:', error.message);
}

// 测试总结
console.log('\n' + '='.repeat(60));
console.log('🎉 Oracle数据库连接测试完成！');
console.log('✅ 如果看到这条消息，说明数据库连接基本正常');
console.log('');
console.log('下一步可以执行:');
console.log('1. npm run test-db  # 运行完整测试套件');
console.log('2. npm run dev      # 启动开发服务器');
console.log('='.repeat(60));

process.exit(0);
}

main().catch((error) => {
  console.error('❌ 简化数据库测试未完成:', error);
  process.exit(1);
});