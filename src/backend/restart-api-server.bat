@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   重启VF物流API服务器
echo ========================================
echo.

echo [1/4] 停止现有Node进程...
taskkill /F /IM node.exe 2>nul
if errorlevel 1 (
  echo     没有运行中的Node进程
) else (
  echo     ✓ 已停止Node进程
)

echo.
echo [2/4] 等待端口释放...
timeout /t 2 /nobreak >nul
echo     ✓ 完成

echo.
echo [3/4] 检查依赖包...
if not exist "node_modules\" (
  echo     ! 依赖包未安装，正在安装...
  call npm install
) else (
  echo     ✓ 依赖包已安装
)

echo.
echo [4/4] 启动API服务器...
echo.
echo ========================================
echo   API服务器日志输出
echo ========================================
echo.

node src\api-server.js

pause
