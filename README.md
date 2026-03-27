# CMS 物流分析仪表板
基于马士基设计系统的 React + TypeScript 物流数据分析仪表板，集成 Oracle 数据库，支持品牌筛选、地域分析、异常监控等功能。

---

## 🚀 快速启动

### 方法一：一键启动（推荐）
**Linux / macOS**
```bash
npm run start
chmod +x start.sh
./start.sh
Windows
cmd
start.bat
npm run start
npm run dev:all
方法二：分别启动
启动后端
bash
运行
cd backend
npm install
npm start
启动前端
bash
运行
npm install
npm run dev
方法三：并发启动
bash
运行
npm install concurrently --save-dev
npm run dev:all
📋 启动前检查清单
 Node.js 版本 ≥ 16.0.0
 Oracle Instant Client 已安装并配置环境变量
 已从 backend/.env.example 复制并配置 backend/.env
 Oracle 数据库连接正常
 端口 3001 和 5173 未被占用
 前后端依赖已安装完成
🔧 环境配置
Oracle 数据库配置
env
DB_USER=your_username
DB_PASSWORD=your_password
DB_CONNECTION_STRING=localhost:1521/XE
DB_SCHEMA=APP_CMS
PORT=3001
NODE_ENV=development
数据库表结构
BAS_CODES - 基础代码表
TSK_LIST_TASK - 快递任务表
DOC_COMPLAINT - 工单表
📊 功能特性
核心功能模块
📈 总览仪表板：品牌 KPI、平台分析、异常监控
🗺️ 地域分析：中国地图可视化、省份数据钻取
📦 重量分析：重量分布、成本分析、趋势预测
🚚 物流监控：全程节点追踪、异常预警
📉 趋势分析：时间序列分析、预测建模
⚠️ 异常管理：智能异常检测、根因分析
技术特性
🎨 马士基设计系统
🔄 智能数据降级
📱 响应式设计
🔍 多维度筛选
💾 Oracle 数据库集成
🔐 TypeScript 类型安全
🏗️ 项目架构
plaintext
├── 🎨 前端应用 (React + TypeScript + Tailwind CSS)
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   ├── data/
│   └── utils/
│
└── 🔧 后端服务 (Node.js + Oracle)
    ├── src/
    │   ├── routes/
    │   ├── config/
    │   └── scripts/
    └── package.json
🌐 访问地址
前端应用：http://localhost:5173
后端 API：http://localhost:3001
健康检查：http://localhost:3001/health
API 文档：http://localhost:3001/api-docs
📈 连接状态监控
🟢 API 服务已连接：使用 Oracle 真实数据
🟡 模拟数据模式：后端未连接，使用演示数据
🔴 连接异常：API 调用失败，支持一键重试
🔍 故障排除
依赖安装失败
bash
运行
npm cache clean --force
npm run clean
npm run install:all
后端启动失败
bash
运行
cd backend && node quick-test.js
node src/scripts/testConnection.js
端口占用（Windows）
cmd
netstat -ano | findstr :3001
netstat -ano | findstr :5173
taskkill /PID <PID> /F
端口占用（Linux/macOS）
bash
运行
lsof -i :3001
lsof -i :5173
kill -9 <PID>
🎯 开发指南
组件命名：PascalCase
文件命名：kebab-case
Git 分支：feature/、fix/
生产构建
bash
运行
npm run build
## 许可证
本项目采用 MIT 许可证，自由使用、修改、分发，无需授权。
Copyright © 2026 MCL Logistics Analytics Team