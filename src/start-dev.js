#!/usr/bin/env node

/**
 * VF物流分析仪表板 - 开发环境一键启动脚本 (ES Module版本)
 * 自动检查环境、启动后端API服务和前端开发服务器
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath) {
  return fs.existsSync(filePath);
}

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({ port, timeout: 1000 }, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

async function preflightCheck() {
  log('\n🔍 执行启动前检查...', 'cyan');
  
  // 检查项目结构
  const requiredFiles = [
    'package.json',
    'backend/package.json',
    'App.tsx'
  ];
  
  for (const file of requiredFiles) {
    if (!checkFile(file)) {
      log(`❌ 缺少必要文件: ${file}`, 'red');
      process.exit(1);
    }
  }
  
  // 检查 backend/.env 文件
  if (!checkFile('backend/.env')) {
    log('⚠️  未找到 backend/.env 配置文件', 'yellow');
    if (checkFile('backend/.env.example')) {
      log('💡 正在从模板创建 .env 文件...', 'yellow');
      try {
        const envExample = fs.readFileSync('backend/.env.example', 'utf8');
        fs.writeFileSync('backend/.env', envExample);
        log('✅ 已创建 backend/.env 文件，请编辑其中的数据库连接配置', 'green');
      } catch (error) {
        log('❌ 创建 .env 文件失败，请手动复制', 'red');
        log('💡 请从 backend/.env.example 复制并配置数据库连接', 'yellow');
      }
    } else {
      log('💡 请在 backend 目录创建 .env 配置文件', 'yellow');
    }
  }
  
  // 检查端口占用
  const backendPortInUse = await checkPort(3001);
  const frontendPortInUse = await checkPort(5173);
  
  if (backendPortInUse) {
    log('⚠️  端口 3001 已被占用，将尝试终止现有进程', 'yellow');
  }
  
  if (frontendPortInUse) {
    log('⚠️  端口 5173 已被占用，将尝试终止现有进程', 'yellow');
  }
  
  log('✅ 启动前检查完成', 'green');
}

function startBackend() {
  return new Promise((resolve, reject) => {
    log('\n🚀 启动后端 API 服务...', 'cyan');
    
    const backend = spawn('npm', ['start'], {
      cwd: path.join(__dirname, 'backend'),
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });
    
    backend.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('API 服务器已启动') || 
          output.includes('Server running') || 
          output.includes('listening on')) {
        log('✅ 后端服务启动成功: http://127.0.0.1:3001', 'green');
        resolve(backend);
      }
      // 显示后端日志
      process.stdout.write(`[后端] ${output}`);
    });
    
    backend.stderr.on('data', (data) => {
      const error = data.toString();
      // 过滤掉一些常见的警告信息
      if (!error.includes('deprecated') && 
          !error.includes('punycode') && 
          !error.includes('ExperimentalWarning')) {
        process.stderr.write(`[后端错误] ${colors.red}${error}${colors.reset}`);
        
        if (error.includes('EADDRINUSE') || error.includes('端口')) {
          log('❌ 端口 3001 已被占用，请手动终止占用进程', 'red');
          reject(new Error('Backend port in use'));
        }
      }
    });
    
    backend.on('close', (code) => {
      if (code !== 0) {
        log(`❌ 后端服务异常退出，代码: ${code}`, 'red');
        reject(new Error(`Backend exited with code ${code}`));
      }
    });
    
    // 超时处理
    setTimeout(() => {
      log('✅ 后端服务已启动（超时检测）', 'yellow');
      resolve(backend);
    }, 10000);
  });
}

function startFrontend() {
  return new Promise((resolve, reject) => {
    log('\n🎨 启动前端开发服务器...', 'cyan');
    
    const frontend = spawn('npm', ['run', 'dev'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });
    
    frontend.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local:') || 
          output.includes('localhost:5173') ||
          output.includes('ready in')) {
        log('✅ 前端服务启动成功: http://localhost:5173', 'green');
        resolve(frontend);
      }
      // 显示前端日志
      process.stdout.write(`[前端] ${output}`);
    });
    
    frontend.stderr.on('data', (data) => {
      const error = data.toString();
      // Vite 的警告信息通常不是错误
      if (!error.includes('deprecated') && 
          !error.includes('punycode') &&
          !error.includes('ExperimentalWarning')) {
        process.stderr.write(`[前端错误] ${colors.yellow}${error}${colors.reset}`);
      }
    });
    
    frontend.on('close', (code) => {
      if (code !== 0) {
        log(`❌ 前端服务异常退出，代码: ${code}`, 'red');
        reject(new Error(`Frontend exited with code ${code}`));
      }
    });
    
    // 超时处理
    setTimeout(() => {
      log('✅ 前端服务已启动（超时检测）', 'yellow');
      resolve(frontend);
    }, 15000);
  });
}

async function main() {
  log('🎯 VF物流分析仪表板 - 开发环境启动器', 'magenta');
  log('=' .repeat(50), 'blue');
  
  try {
    // 启动前检查
    await preflightCheck();
    
    // 启动服务
    const backendProcess = await startBackend();
    await new Promise(resolve => setTimeout(resolve, 3000)); // 等待后端完全启动
    
    const frontendProcess = await startFrontend();
    await new Promise(resolve => setTimeout(resolve, 2000)); // 等待前端启动
    
    // 启动成功提示
    log('\n' + '='.repeat(60), 'green');
    log('🎉 服务启动成功！', 'green');
    log('', 'reset');
    log('📊 后端 API:    http://127.0.0.1:3001', 'cyan');
    log('🌐 前端应用:    http://localhost:5173', 'cyan');
    log('🔍 健康检查:    http://127.0.0.1:3001/health', 'cyan');
    log('', 'reset');
    log('💡 提示:', 'yellow');
    log('  - 查看前端连接状态指示器验证 API 连接', 'reset');
    log('  - 使用 Ctrl+C 停止所有服务', 'reset');
    log('  - 修改代码会自动热重载', 'reset');
    log('=' .repeat(60), 'green');
    
    // 优雅关闭处理
    process.on('SIGINT', () => {
      log('\n🛑 正在关闭服务...', 'yellow');
      try {
        backendProcess.kill();
        frontendProcess.kill();
      } catch (error) {
        // 忽略关闭错误
      }
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      log('\n🛑 收到终止信号，正在关闭服务...', 'yellow');
      try {
        backendProcess.kill();
        frontendProcess.kill();
      } catch (error) {
        // 忽略关闭错误
      }
      process.exit(0);
    });
    
    // 保持进程运行
    await new Promise(() => {});
    
  } catch (error) {
    log(`❌ 启动失败: ${error.message}`, 'red');
    log('\n🔧 故障排除建议:', 'yellow');
    log('1. 检查 backend/.env 配置', 'reset');
    log('2. 确认 Oracle Instant Client 已安装', 'reset');
    log('3. 检查端口 3001 和 5173 是否被占用', 'reset');
    log('4. 运行 backend/quick-test.js 测试数据库连接', 'reset');
    log('5. 查看详细错误信息:', 'reset');
    console.error(error);
    process.exit(1);
  }
}

// 运行主程序
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { startBackend, startFrontend, preflightCheck };