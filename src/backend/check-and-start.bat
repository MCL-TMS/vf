@echo off
REM VF物流后端服务启动脚本 (Windows版本)
REM 自动检查端口占用并启动服务

echo ========================================
echo VF物流后端服务启动检查...
echo ========================================
echo.

REM 检查3001端口是否被占用
echo 检查端口 3001 占用情况...
netstat -ano | findstr :3001 > nul

if %ERRORLEVEL% EQU 0 (
    echo ⚠️  端口 3001 被占用
    echo.
    echo 占用进程信息：
    netstat -ano | findstr :3001
    echo.
    
    REM 提取PID (这部分在批处理中比较复杂，简化处理)
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
        set PID=%%a
        goto :found
    )
    
    :found
    echo 进程PID: %PID%
    echo.
    set /p CONFIRM="是否杀死该进程并继续启动？(Y/N): "
    
    if /i "%CONFIRM%"=="Y" (
        echo 正在杀死进程 %PID%...
        taskkill /PID %PID% /F
        timeout /t 2 /nobreak > nul
        echo ✅ 进程已终止
    ) else (
        echo ❌ 用户取消操作
        exit /b 1
    )
) else (
    echo ✅ 端口 3001 未被占用
)

echo.
echo ========================================
echo 启动VF物流后端服务...
echo ========================================
echo.

REM 检查是否在backend目录
if not exist "package.json" (
    echo ❌ 错误: 请在 backend 目录下运行此脚本
    echo    cd backend
    echo    check-and-start.bat
    exit /b 1
)

REM 检查.env文件
if not exist ".env" (
    echo ⚠️  警告: 未找到 .env 文件
    echo    请确保已配置数据库连接信息
    echo.
)

REM 启动服务器
npm start
