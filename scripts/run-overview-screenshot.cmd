@echo off
setlocal
cd /d %~dp0\..
node scripts\capture-overview.cjs
endlocal
