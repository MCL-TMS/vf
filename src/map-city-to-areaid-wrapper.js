/**
 * areaId映射工具 - 包装脚本
 * 
 * 功能：调用后端的CommonJS映射脚本
 * 用法：node map-city-to-areaid-wrapper.js
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 启动areaId映射工具...\n');

// 调用后端的CommonJS脚本
const scriptPath = path.join(__dirname, 'backend', 'src', 'scripts', 'mapCityToAreaId.js');

const child = spawn('node', [scriptPath], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error('❌ 启动脚本失败:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`\n❌ 脚本执行失败，退出码: ${code}`);
    process.exit(code);
  }
});
