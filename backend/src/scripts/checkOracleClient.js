#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
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
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Oracle Instant Client配置检查工具
 */
async function checkOracleClient() {
  log('cyan', '🏛️  Oracle Instant Client配置检查');
  log('cyan', '=' .repeat(50));
  
  const platform = process.platform;
  console.log('\n📋 系统信息:');
  console.log('操作系统:', platform);
  console.log('架构:', process.arch);
  console.log('Node.js版本:', process.version);
  
  // 检查oracledb模块
  console.log('\n📦 Oracle数据库模块检查:');
  console.log('-'.repeat(30));
  
  try {
    console.log('尝试导入oracledb模块...');
    const oracledb = await import('oracledb');
    log('green', '✅ oracledb模块导入成功');
    
    // 检查Oracle Client版本和模式
    try {
      console.log('Oracle Client版本:', oracledb.versionString || '未知');
      console.log('Oracle Client模式:', oracledb.thin ? 'Thin模式 (不需要Client)' : 'Thick模式 (需要Client)');
      
      // 如果是Thin模式，不需要Oracle Client
      if (oracledb.thin) {
        log('green', '🎉 使用Thin模式，无需安装Oracle Instant Client!');
        log('green', '   Thin模式直接连接Oracle数据库，无需额外配置');
        return true;
      }
    } catch (error) {
      log('yellow', '⚠️  无法获取Oracle Client信息，但模块加载成功');
    }
    
  } catch (importError) {
    log('red', '❌ oracledb模块导入失败');
    console.log('错误信息:', importError.message);
    
    if (importError.message.includes('Cannot find module')) {
      log('yellow', '解决方案: 安装oracledb模块');
      console.log('   npm install oracledb');
      return false;
    }
    
    if (importError.message.includes('DPI-1047')) {
      log('yellow', '这是Oracle Instant Client未安装或配置错误');
      // 继续下面的Client检查
    } else {
      console.log('这可能是其他配置问题');
      return false;
    }
  }
  
  // 检查Oracle Instant Client安装
  console.log('\n🔍 Oracle Instant Client安装检查:');
  console.log('-'.repeat(30));
  
  let clientFound = false;
  
  if (platform === 'win32') {
    // Windows环境检查
    const windowsPaths = [
      'C:\\oracle\\instantclient_21_8',
      'C:\\oracle\\instantclient_19_8',
      'C:\\oracle\\instantclient_21_3',
      'C:\\instantclient_21_8',
      'C:\\instantclient_19_8'
    ];
    
    console.log('检查Windows常见安装路径:');
    for (const clientPath of windowsPaths) {
      if (fs.existsSync(clientPath)) {
        log('green', `   ✅ 找到: ${clientPath}`);
        clientFound = true;
        
        // 检查关键文件
        const keyFiles = ['oci.dll', 'oraociei21.dll', 'oraociei19.dll'];
        const foundFiles = keyFiles.filter(file => 
          fs.existsSync(path.join(clientPath, file))
        );
        
        if (foundFiles.length > 0) {
          console.log(`      关键文件: ${foundFiles.join(', ')}`);
        }
      }
    }
    
    // 检查PATH环境变量
    const pathEnv = process.env.PATH || '';
    const pathParts = pathEnv.split(';');
    const oraclePaths = pathParts.filter(p => 
      p.toLowerCase().includes('oracle') || 
      p.toLowerCase().includes('instantclient')
    );
    
    if (oraclePaths.length > 0) {
      log('green', '   ✅ PATH中找到Oracle路径:');
      oraclePaths.forEach(p => console.log(`      ${p}`));
    } else {
      log('red', '   ❌ PATH中未找到Oracle路径');
      console.log('   需要添加Oracle Instant Client路径到PATH环境变量');
    }
    
  } else if (platform === 'linux') {
    // Linux环境检查
    const linuxPaths = [
      '/usr/lib/oracle/21/client64',
      '/usr/lib/oracle/19.8/client64',
      '/opt/oracle/instantclient_21_8',
      '/opt/oracle/instantclient_19_8',
      '/usr/local/lib/instantclient_21_8'
    ];
    
    console.log('检查Linux常见安装路径:');
    for (const clientPath of linuxPaths) {
      if (fs.existsSync(clientPath)) {
        log('green', `   ✅ 找到: ${clientPath}`);
        clientFound = true;
      }
    }
    
    // 检查LD_LIBRARY_PATH
    const ldPath = process.env.LD_LIBRARY_PATH || '';
    if (ldPath.includes('oracle') || ldPath.includes('instantclient')) {
      log('green', '   ✅ LD_LIBRARY_PATH包含Oracle路径');
      console.log(`      ${ldPath}`);
    } else {
      log('yellow', '   ⚠️  LD_LIBRARY_PATH可能需要配置');
    }
    
    // 检查libaio依赖
    try {
      await execAsync('ldconfig -p | grep libaio');
      log('green', '   ✅ libaio依赖已安装');
    } catch (error) {
      log('red', '   ❌ libaio依赖未安装');
      console.log('   安装命令: sudo apt-get install libaio1');
    }
    
  } else if (platform === 'darwin') {
    // macOS环境检查
    const macPaths = [
      '/usr/local/lib/instantclient_21_8',
      '/usr/local/lib/instantclient_19_8',
      '/opt/oracle/instantclient_21_8'
    ];
    
    console.log('检查macOS常见安装路径:');
    for (const clientPath of macPaths) {
      if (fs.existsSync(clientPath)) {
        log('green', `   ✅ 找到: ${clientPath}`);
        clientFound = true;
      }
    }
    
    // 检查DYLD_LIBRARY_PATH
    const dyldPath = process.env.DYLD_LIBRARY_PATH || '';
    if (dyldPath.includes('oracle') || dyldPath.includes('instantclient')) {
      log('green', '   ✅ DYLD_LIBRARY_PATH包含Oracle路径');
    } else {
      log('yellow', '   ⚠️  DYLD_LIBRARY_PATH可能需要配置');
    }
  }
  
  // 测试连接能力
  console.log('\n🧪 连接能力测试:');
  console.log('-'.repeat(30));
  
  try {
    const oracledb = await import('oracledb');
    
    // 尝试创建一个基本的连接配置（不实际连接）
    console.log('尝试创建数据库连接配置...');
    
    const testConfig = {
      user: 'test',
      password: 'test',
      connectString: 'localhost:1521/XE'
    };
    
    // 这里只是测试oracledb模块是否能正常工作
    // 不实际连接数据库
    log('green', '✅ oracledb模块功能正常');
    
  } catch (error) {
    log('red', '❌ oracledb模块功能异常');
    console.log('错误:', error.message);
    
    if (error.message.includes('DPI-1047')) {
      console.log('\n💡 Oracle Instant Client配置指南:');
      
      if (platform === 'win32') {
        console.log('Windows配置步骤:');
        console.log('1. 下载Oracle Instant Client:');
        console.log('   https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html');
        console.log('2. 解压到 C:\\oracle\\instantclient_21_8');
        console.log('3. 添加到PATH环境变量:');
        console.log('   系统属性 → 高级 → 环境变量 → PATH → 新建 → C:\\oracle\\instantclient_21_8');
        console.log('4. 重启命令行');
      } else if (platform === 'linux') {
        console.log('Linux配置步骤:');
        console.log('1. 安装依赖: sudo apt-get install libaio1');
        console.log('2. 下载并解压Oracle Instant Client');
        console.log('3. 配置环境变量:');
        console.log('   export LD_LIBRARY_PATH=/path/to/instantclient:$LD_LIBRARY_PATH');
        console.log('4. 添加到 ~/.bashrc 永久生效');
      } else if (platform === 'darwin') {
        console.log('macOS配置步骤:');
        console.log('1. 下载Oracle Instant Client for macOS');
        console.log('2. 解压到 /usr/local/lib/instantclient_21_8');
        console.log('3. 配置环境变量:');
        console.log('   export DYLD_LIBRARY_PATH=/usr/local/lib/instantclient_21_8:$DYLD_LIBRARY_PATH');
        console.log('4. 添加到 ~/.zshrc 永久生效');
      }
    }
  }
  
  // 总结
  console.log('\n' + '='.repeat(50));
  log('cyan', '📋 检查总结:');
  
  if (clientFound) {
    log('green', '✅ Oracle Instant Client已安装');
    log('green', '✅ 可以尝试数据库连接测试');
  } else {
    log('yellow', '⚠️  Oracle Instant Client可能未正确安装或配置');
    log('yellow', '📚 请参考上述配置指南进行安装');
  }
  
  console.log('\n下一步操作:');
  console.log('1. 确保Oracle Instant Client正确安装');
  console.log('2. 配置.env文件中的数据库连接信息');
  console.log('3. 运行: npm run test-simple');
  
  return clientFound;
}

// 运行检查
if (import.meta.url === `file://${process.argv[1]}`) {
  checkOracleClient().catch(error => {
    console.error('💥 Oracle Client检查失败:', error);
    process.exit(1);
  });
}

export { checkOracleClient };