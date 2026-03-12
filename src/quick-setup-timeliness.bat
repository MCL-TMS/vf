@echo off
REM VF物流时效数据快速配置脚本（Windows版）
REM 用法：quick-setup-timeliness.bat [Excel文件路径]

echo 🚀 VF物流时效数据快速配置
echo ================================
echo.

set TIMELINESS_DIR=backend\uploads\timeliness
set EXCEL_FILE=%1

REM 创建目录
if not exist "%TIMELINESS_DIR%" (
  echo 📂 创建时效数据目录...
  mkdir "%TIMELINESS_DIR%"
  echo ✅ 目录已创建
  echo.
)

REM 复制Excel文件（如果提供了路径）
if not "%EXCEL_FILE%"=="" (
  if exist "%EXCEL_FILE%" (
    echo 📄 复制Excel文件...
    copy "%EXCEL_FILE%" "%TIMELINESS_DIR%\"
    echo ✅ 文件已复制
    echo.
  ) else (
    echo ❌ 文件不存在: %EXCEL_FILE%
    exit /b 1
  )
)

REM 运行自动配置
echo 🔧 运行自动配置...
node setup-existing-timeliness-data.js
echo.

REM 询问是否生成JSON缓存
set /p REPLY="是否立即生成JSON缓存？(y/n) "

if /i "%REPLY%"=="y" (
  echo 📊 生成JSON缓存...
  
  REM 检查是否安装了xlsx
  node -e "require('xlsx')" 2>nul
  if errorlevel 1 (
    echo ⚠️  xlsx包未安装，正在安装...
    cd backend && npm install xlsx && cd ..
  )
  
  node parse-timeliness-excel-to-json.js
  echo.
  
  echo ✅ 配置完成！
  echo.
  echo 🧪 运行验证测试：
  echo    node test-file-based-timeliness.js
  echo.
  echo 🚀 启动服务：
  echo    cd backend ^&^& npm start
  echo.
) else (
  echo.
  echo 📝 请稍后手动生成JSON缓存：
  echo    node parse-timeliness-excel-to-json.js
  echo.
)

pause
