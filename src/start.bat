@echo off
chcp 65001 > nul
echo.
echo 🎯 VF物流分析仪表板 - Windows 启动脚本
echo ================================================
echo.

REM 检查 Node.js
node --version > nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查必要文件
if not exist "package.json" (
    echo ❌ 未找到 package.json 文件
    pause
    exit /b 1
)

if not exist "backend\package.json" (
    echo ❌ 未找到 backend\package.json 文件
    pause
    exit /b 1
)

REM 检查 backend/.env
if not exist "backend\.env" (
    echo ⚠️  未找到 backend\.env 配置文件
    if exist "backend\.env.example" (
        echo 💡 正在从模板创建 .env 文件...
        copy "backend\.env.example" "backend\.env" > nul
        echo ✅ 已创建 backend\.env 文件，请编辑其中的数据库连接配置
    ) else (
        echo 💡 请在 backend 目录创建 .env 配置文件
    )
)

REM 检查依赖是否安装
if not exist "node_modules" (
    echo 📦 正在安装前端依赖...
    call npm install
    if errorlevel 1 (
        echo ❌ 前端依赖安装失败
        pause
        exit /b 1
    )
)

if not exist "backend\node_modules" (
    echo 📦 正在安装后端依赖...
    cd backend
    call npm install
    if errorlevel 1 (
        echo ❌ 后端依赖安装失败
        pause
        exit /b 1
    )
    cd ..
)

echo.
echo 🚀 启动开发服务器...
echo.
echo 💡 提示：使用 Ctrl+C 停止服务
echo.

REM 检查是否安装了 concurrently
npm list concurrently > nul 2>&1
if errorlevel 1 (
    echo 📦 正在安装 concurrently...
    call npm install concurrently --save-dev
)

REM 使用 concurrently 同时启动前后端
call npm run dev:all

echo.
echo 🛑 服务已停止
pause