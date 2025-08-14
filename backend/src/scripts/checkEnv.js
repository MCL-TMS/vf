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
 * 专门检查.env文件配置的工具
 */
async function checkEnvironmentFile() {
  log('cyan', '🔍 .env文件配置检查工具');
  log('cyan', '=' .repeat(50));
  
  // 检查当前工作目录
  console.log('\n📍 当前工作目录:', process.cwd());
  
  // 检查.env文件是否存在
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  console.log('\n📋 文件检查:');
  console.log('-'.repeat(30));
  
  if (fs.existsSync(envPath)) {
    log('green', '✅ .env文件存在');
    console.log('   路径:', envPath);
    
    try {
      const stats = fs.statSync(envPath);
      console.log('   大小:', stats.size, 'bytes');
      console.log('   修改时间:', stats.mtime.toLocaleString());
    } catch (error) {
      log('yellow', '   ⚠️  无法获取文件信息');
    }
  } else {
    log('red', '❌ .env文件不存在');
    console.log('   预期路径:', envPath);
  }
  
  if (fs.existsSync(envExamplePath)) {
    log('green', '✅ .env.example文件存在');
  } else {
    log('yellow', '⚠️  .env.example文件不存在');
  }
  
  // 读取并分析.env文件内容
  if (fs.existsSync(envPath)) {
    console.log('\n📄 .env文件内容分析:');
    console.log('-'.repeat(30));
    
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      console.log('原始内容长度:', envContent.length);
      
      const lines = envContent.split('\n');
      console.log('总行数:', lines.length);
      
      const configLines = [];
      const commentLines = [];
      const emptyLines = [];
      
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();
        
        if (!trimmedLine) {
          emptyLines.push(lineNumber);
        } else if (trimmedLine.startsWith('#')) {
          commentLines.push(lineNumber);
        } else if (trimmedLine.includes('=')) {
          configLines.push({ line: lineNumber, content: trimmedLine });
        } else {
          console.log(`⚠️  第${lineNumber}行格式异常: ${trimmedLine}`);
        }
      });
      
      console.log(`配置行: ${configLines.length}个`);
      console.log(`注释行: ${commentLines.length}个`);
      console.log(`空行: ${emptyLines.length}个`);
      
      // 显示所有配置项
      if (configLines.length > 0) {
        console.log('\n📝 配置项详情:');
        configLines.forEach(({ line, content }) => {
          const [key, ...valueParts] = content.split('=');
          const value = valueParts.join('=');
          
          console.log(`   第${line}行: ${key} = ${value ? '***已设置***' : '❌未设置'}`);
          
          // 特别检查Oracle相关配置
          if (key.startsWith('ORACLE_')) {
            if (!value || value.trim() === '') {
              log('red', `     ❌ ${key} 值为空`);
            } else {
              log('green', `     ✅ ${key} 已配置`);
            }
          }
        });
      }
      
    } catch (error) {
      log('red', '❌ 读取.env文件失败:', error.message);
    }
  }
  
  // 尝试加载dotenv并检查环境变量
  console.log('\n🔧 环境变量加载测试:');
  console.log('-'.repeat(30));
  
  try {
    // 手动加载dotenv
    const dotenv = await import('dotenv');
    const result = dotenv.config({ path: envPath });
    
    if (result.error) {
      log('red', '❌ dotenv加载失败:', result.error.message);
    } else {
      log('green', '✅ dotenv加载成功');
      
      // 检查关键的Oracle环境变量
      const oracleVars = [
        'ORACLE_USER',
        'ORACLE_PASSWORD',
        'ORACLE_CONNECT_STRING',
        'ORACLE_POOL_MIN',
        'ORACLE_POOL_MAX'
      ];
      
      console.log('\n Oracle环境变量检查:');
      oracleVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
          if (varName === 'ORACLE_PASSWORD') {
            log('green', `   ✅ ${varName}: ***已设置***`);
          } else {
            log('green', `   ✅ ${varName}: ${value}`);
          }
        } else {
          log('red', `   ❌ ${varName}: 未设置`);
        }
      });
    }
    
  } catch (error) {
    log('red', '❌ 环境变量加载测试失败:', error.message);
  }
  
  // 检查process.env中的Oracle变量（在加载后）
  console.log('\n🌍 当前进程环境变量:');
  console.log('-'.repeat(30));
  
  const currentOracleVars = Object.keys(process.env)
    .filter(key => key.startsWith('ORACLE_'))
    .sort();
  
  if (currentOracleVars.length > 0) {
    currentOracleVars.forEach(key => {
      const value = process.env[key];
      if (key === 'ORACLE_PASSWORD') {
        log('green', `   ${key}: ***已设置***`);
      } else {
        log('green', `   ${key}: ${value}`);
      }
    });
  } else {
    log('red', '   ❌ 未找到任何ORACLE_*环境变量');
    log('yellow', '   这可能表示.env文件未被正确加载');
  }
  
  // Oracle Instant Client检查
  console.log('\n🏛️  Oracle Instant Client环境检查:');
  console.log('-'.repeat(30));
  
  // 检查常见的Oracle Client路径
  const commonPaths = [
    'C:\\oracle\\instantclient_21_8',
    'C:\\oracle\\instantclient_19_8',
    '/usr/lib/oracle/21/client64',
    '/usr/lib/oracle/19.8/client64',
    '/opt/oracle/instantclient_21_8',
    '/usr/local/lib/instantclient_21_8'
  ];
  
  console.log('检查常见Oracle Client安装路径:');
  let foundClient = false;
  
  commonPaths.forEach(clientPath => {
    if (fs.existsSync(clientPath)) {
      log('green', `   ✅ 找到Oracle Client: ${clientPath}`);
      foundClient = true;
    }
  });
  
  if (!foundClient) {
    log('yellow', '   ⚠️  未在常见路径找到Oracle Client');
  }
  
  // 检查PATH环境变量
  const pathEnv = process.env.PATH || '';
  const pathContainsOracle = pathEnv.toLowerCase().includes('oracle');
  
  if (pathContainsOracle) {
    log('green', '   ✅ PATH环境变量包含Oracle路径');
  } else {
    log('yellow', '   ⚠️  PATH环境变量可能不包含Oracle路径');
  }
  
  // 检查特定于操作系统的环境变量
  const platform = process.platform;
  console.log(`\n操作系统: ${platform}`);
  
  if (platform === 'win32') {
    // Windows检查
    log('blue', '   Windows环境Oracle配置检查:');
    console.log('   - 检查PATH是否包含instantclient路径');
    console.log('   - 确认下载了正确的64位版本');
  } else if (platform === 'linux') {
    // Linux检查
    log('blue', '   Linux环境Oracle配置检查:');
    const ldLibraryPath = process.env.LD_LIBRARY_PATH || '';
    console.log(`   - LD_LIBRARY_PATH: ${ldLibraryPath || '未设置'}`);
    console.log('   - 确认安装了libaio1依赖');
  } else if (platform === 'darwin') {
    // macOS检查
    log('blue', '   macOS环境Oracle配置检查:');
    const dyldLibraryPath = process.env.DYLD_LIBRARY_PATH || '';
    console.log(`   - DYLD_LIBRARY_PATH: ${dyldLibraryPath || '未设置'}`);
  }
  
  // 总结和建议
  console.log('\n' + '='.repeat(50));
  log('cyan', '📋 诊断总结和建议:');
  
  if (!fs.existsSync(envPath)) {
    log('red', '1. 首先创建.env文件:');
    console.log('   cp .env.example .env');
  }
  
  if (currentOracleVars.length === 0) {
    log('red', '2. .env文件未被正确加载，请检查:');
    console.log('   - 文件是否在正确位置 (backend/.env)');
    console.log('   - 文件格式是否正确 (KEY=VALUE)');
    console.log('   - 是否有特殊字符或空格问题');
  }
  
  if (!foundClient) {
    log('yellow', '3. Oracle Instant Client安装:');
    console.log('   - 下载适合您操作系统的版本');
    console.log('   - 配置PATH环境变量');
    console.log('   - 重启命令行工具');
  }
  
  log('green', '4. 下一步操作:');
  console.log('   - 修复上述问题后');
  console.log('   - 重新运行: npm run test-simple');
  
  console.log('='.repeat(50));
}

// 运行检查
if (import.meta.url === `file://${process.argv[1]}`) {
  checkEnvironmentFile().catch(error => {
    console.error('💥 环境检查工具执行失败:', error);
    process.exit(1);
  });
}

export { checkEnvironmentFile };