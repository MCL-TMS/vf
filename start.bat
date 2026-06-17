@echo off
echo ==========================================
echo   CMS-Dashboard One-Click Starter
echo ==========================================

echo [1/2] Starting Backend Service...
start cmd /k "cd backend && npm start"

echo [2/2] Starting Frontend Application...
start cmd /k "cd frontend && npm run dev"

echo Done. Both services are starting in separate windows.
