#!/usr/bin/env node
/**
 * VF物流数据分析平台 - 后端服务器启动脚本（修复版）
 * 
 * 解决了404错误和JSON解析错误的问题
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 启动VF物流数据分析平台后端服务器...');
console.log('📁 当前目录:', __dirname);
console.log('🔧 使用修复版服务器: src/server.js');

// 启动服务器
const serverProcess = spawn('node', ['src/server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development'
  }
});

serverProcess.on('error', (error) => {
  console.error('❌ 启动服务器失败:', error);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ 服务器异常退出，退出码: ${code}`);
  } else {
    console.log('✅ 服务器正常关闭');
  }
  process.exit(code);
});

// 处理终止信号
process.on('SIGINT', () => {
  console.log('\n🛑 接收到终止信号，正在关闭服务器...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 接收到终止信号，正在关闭服务器...');
  serverProcess.kill('SIGTERM');
});