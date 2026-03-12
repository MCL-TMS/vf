#!/bin/bash

echo ""
echo "========================================"
echo "  重启VF物流API服务器"
echo "========================================"
echo ""

echo "[1/4] 停止现有Node进程..."
if pkill node 2>/dev/null; then
  echo "    ✓ 已停止Node进程"
else
  echo "    没有运行中的Node进程"
fi

echo ""
echo "[2/4] 等待端口释放..."
sleep 2

# 强制释放端口3001（如果仍被占用）
if lsof -i :3001 >/dev/null 2>&1; then
  echo "    ! 端口3001仍被占用，尝试强制释放..."
  kill -9 $(lsof -t -i:3001) 2>/dev/null || echo "    无法强制释放"
  sleep 1
fi
echo "    ✓ 完成"

echo ""
echo "[3/4] 检查依赖包..."
if [ ! -d "node_modules" ]; then
  echo "    ! 依赖包未安装，正在安装..."
  npm install
else
  echo "    ✓ 依赖包已安装"
fi

# 进入脚本所在目录
cd "$(dirname "$0")"

echo ""
echo "[4/4] 启动API服务器..."
echo ""
echo "========================================"
echo "  API服务器日志输出"
echo "========================================"
echo ""

node src/api-server.js
