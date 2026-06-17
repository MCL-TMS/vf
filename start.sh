#!/bin/bash
echo "=========================================="
echo "  CMS-Dashboard One-Click Starter"
echo "=========================================="

echo "[1/2] Starting Backend Service..."
(cd backend && npm start) &

echo "[2/2] Starting Frontend Application..."
(cd frontend && npm run dev)
