#!/bin/bash

# VF物流分析仪表板 - Shell版本启动脚本
# 适用于 Linux/macOS 系统

set -e  # 遇到错误时立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${MAGENTA}🎯 VF物流分析仪表板 - 开发环境启动器${NC}"
echo -e "${BLUE}=================================================${NC}"

# 检查必要文件
echo -e "${CYAN}🔍 执行启动前检查...${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 未找到 package.json${NC}"
    exit 1
fi

if [ ! -f "backend/package.json" ]; then
    echo -e "${RED}❌ 未找到 backend/package.json${NC}"
    exit 1
fi

if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  未找到 backend/.env 配置文件${NC}"
    echo -e "${YELLOW}💡 正在从模板创建...${NC}"
    cd backend && cp .env.example .env
    echo -e "${YELLOW}📝 请编辑 backend/.env 配置数据库连接信息${NC}"
    cd ..
fi

echo -e "${GREEN}✅ 启动前检查完成${NC}"

# 检查端口占用
echo -e "${CYAN}🔍 检查端口占用情况...${NC}"

if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  端口 3001 已被占用${NC}"
    read -p "是否终止占用进程并继续? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        lsof -ti:3001 | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✅ 已清理端口 3001${NC}"
    else
        echo -e "${RED}❌ 取消启动${NC}"
        exit 1
    fi
fi

if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  端口 5173 已被占用${NC}"
    read -p "是否终止占用进程并继续? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        lsof -ti:5173 | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✅ 已清理端口 5173${NC}"
    else
        echo -e "${RED}❌ 取消启动${NC}"
        exit 1
    fi
fi

# 安装依赖（如果需要）
if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ]; then
    echo -e "${CYAN}📦 安装依赖包...${NC}"
    npm install
    cd backend && npm install && cd ..
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
fi

# 创建日志目录
mkdir -p logs

echo -e "${CYAN}🚀 启动服务...${NC}"

# 使用 trap 处理 Ctrl+C
cleanup() {
    echo -e "\n${YELLOW}🛑 正在关闭服务...${NC}"
    jobs -p | xargs -r kill
    exit 0
}
trap cleanup INT

# 启动后端服务
echo -e "${BLUE}🔧 启动后端 API 服务...${NC}"
cd backend
npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 等待后端启动
echo -e "${YELLOW}⏳ 等待后端服务启动...${NC}"
sleep 5

# 检查后端是否启动成功
if kill -0 $BACKEND_PID 2>/dev/null; then
    # 尝试访问健康检查端点
    if curl -s http://localhost:3001/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ 后端服务启动成功: http://localhost:3001${NC}"
    else
        echo -e "${YELLOW}⏳ 后端服务正在启动中...${NC}"
    fi
else
    echo -e "${RED}❌ 后端服务启动失败${NC}"
    echo -e "${YELLOW}📋 后端日志:${NC}"
    cat logs/backend.log
    exit 1
fi

# 启动前端服务
echo -e "${BLUE}🎨 启动前端开发服务器...${NC}"
npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待前端启动
echo -e "${YELLOW}⏳ 等待前端服务启动...${NC}"
sleep 8

# 检查前端是否启动成功
if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${GREEN}✅ 前端服务启动成功: http://localhost:5173${NC}"
else
    echo -e "${RED}❌ 前端服务启动失败${NC}"
    echo -e "${YELLOW}📋 前端日志:${NC}"
    cat logs/frontend.log
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# 启动成功提示
echo
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}🎉 VF物流分析仪表板启动成功！${NC}"
echo
echo -e "${CYAN}📊 后端 API:    http://localhost:3001${NC}"
echo -e "${CYAN}🌐 前端应用:    http://localhost:5173${NC}"
echo -e "${CYAN}🔍 健康检查:    http://localhost:3001/health${NC}"
echo
echo -e "${YELLOW}💡 使用提示:${NC}"
echo -e "   - 查看前端连接状态指示器验证 API 连接"
echo -e "   - 使用 Ctrl+C 停止所有服务"
echo -e "   - 日志文件: logs/backend.log, logs/frontend.log"
echo -e "${GREEN}============================================================${NC}"

# 保持脚本运行，监控进程
echo -e "${BLUE}🔄 监控服务状态... (Ctrl+C 退出)${NC}"

while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${RED}❌ 后端服务异常退出${NC}"
        kill $FRONTEND_PID 2>/dev/null || true
        exit 1
    fi
    
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${RED}❌ 前端服务异常退出${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    
    sleep 10
done