#!/bin/bash

# VF物流后端服务启动脚本
# 自动检查端口占用并启动服务

echo "🔍 VF物流后端服务启动检查..."
echo "================================"

# 检查3001端口是否被占用
PORT=3001
PID=$(lsof -ti:$PORT)

if [ -z "$PID" ]; then
  echo "✅ 端口 $PORT 未被占用"
else
  echo "⚠️  端口 $PORT 被占用，PID: $PID"
  echo ""
  echo "占用进程信息："
  lsof -i:$PORT
  echo ""
  read -p "是否杀死该进程并继续启动？(y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔪 正在杀死进程 $PID..."
    kill -9 $PID
    sleep 1
    echo "✅ 进程已终止"
  else
    echo "❌ 用户取消操作"
    exit 1
  fi
fi

echo ""
echo "================================"
echo "🚀 启动VF物流后端服务..."
echo "================================"
echo ""

# 检查是否在backend目录
if [ ! -f "package.json" ]; then
  echo "❌ 错误: 请在 backend 目录下运行此脚本"
  echo "   cd backend && bash check-and-start.sh"
  exit 1
fi

# 检查.env文件
if [ ! -f ".env" ]; then
  echo "⚠️  警告: 未找到 .env 文件"
  echo "   请确保已配置数据库连接信息"
  echo ""
fi

# 启动服务器
npm start
