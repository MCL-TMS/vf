# CMS 物流分析仪表板

> 基于 **马士基设计系统（Maersk Design System）** 的企业级物流数据分析平台  
> 技术栈：**React + TypeScript + Node.js + Oracle Database**

---

## 📌 项目简介

CMS 物流分析仪表板用于展示CMS全链路数据，支持品牌/平台筛选、地域分析、异常监控，并与 Oracle 数据库深度集成，适用于企业级物流可视化场景。

---

## 🚀 快速启动

### ✅ 推荐方式（一键启动）

#### Linux / macOS
bash
npm run install:all
npm run dev:all


或：

bash
chmod +x start.sh
./start.sh


#### Windows
bat
start.bat


---

### 🔹 分别启动

#### 后端
bash
cd backend
npm install
npm start


#### 前端
bash
npm install
npm run dev


---

### 🔹 并发启动
bash
npm install concurrently --save-dev
npm run dev:all


---

## ✅ 启动前检查清单

- [ ] Node.js ≥ **16.0.0**
- [ ] Oracle Instant Client 已安装并配置环境变量
- [ ] 已从 `backend/.env.example` 复制为 `backend/.env`
- [ ] Oracle 数据库连接正常
- [ ] 端口 `3001`（后端）与 `5173`（前端）未被占用
- [ ] 前后端依赖已安装完成

---

## ⚙️ 环境配置

### Oracle 数据库（`backend/.env`）
env
DB_USER=your_username
DB_PASSWORD=your_password
DB_CONNECTION_STRING=localhost:1521/XE
DB_SCHEMA=YOUR_CMS
PORT=3001
NODE_ENV=development


### 数据库表结构
| 表名 | 说明 |
|------|------|
| `BAS_CODES` | 基础代码表 |
| `TSK_LIST_TASK` | 快递任务表 |
| `DOC_COMPLAINT` | 工单表 |

---

## 🧩 功能特性

### 核心功能
- 📈 总览仪表板：KPI、平台分析、异常监控
- 📦 重量分析：重量分布、成本分析
- 🚚 物流监控：全链路节点追踪、异常预警
- 📉 趋势分析：时间序列分析、预测建模
- ⚠️ 异常管理：异常检测、根因分析

### 技术特性
- 🎨 马士基设计系统（Maersk Design System）
- 🔄 智能数据降级（API 异常自动切换模拟数据）
- 📱 响应式布局
- 🔍 多维度筛选
- 💾 Oracle 数据库集成
- 🔐 TypeScript 类型安全

---

## 🏗️ 项目架构


.
├── frontend/                # React + TypeScript + Tailwind CSS
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   ├── data/
│   └── utils/
│
├── backend/                 # Node.js + Oracle
│   ├── src/
│   │   ├── routes/
│   │   ├── config/
│   │   └── scripts/
│   └── package.json


---

## 🌐 访问地址

| 服务 | 地址 |
|------|------|
| 前端应用 | http://localhost:5173 |
| 后端 API | http://localhost:3001 |
| 健康检查 | http://localhost:3001/api/health |
| API 信息 | http://localhost:3001/api/info |
| API 文档 | [`backend/API_GUIDE.md`](backend/API_GUIDE.md) |

---

## 📶 连接状态说明

| 状态 | 含义 |
|------|------|
| 🟢 API 服务已连接 | 使用 Oracle 真实数据 |
| 🟡 模拟数据模式 | 后端未连接，使用演示数据 |
| 🔴 连接异常 | API 调用失败，支持一键重试 |

---

## 🛠️ 常见问题排查

### 依赖安装失败
bash
npm cache clean --force
npm run clean
npm run install:all


### 后端启动失败
bash
cd backend
node quick-test.js
node src/scripts/testConnection.js


### 端口被占用

#### Windows
bat
netstat -ano | findstr :3001
netstat -ano | findstr :5173
taskkill /PID <PID> /F


#### Linux / macOS
bash
lsof -i :3001
lsof -i :5173
kill -9 <PID>


---

## 🎯 开发规范

- **组件命名**：PascalCase（`DashboardCard.tsx`）
- **文件命名**：kebab-case（`use-dashboard-data.ts`）
- **Git 分支**：
  - `feature/*`
  - `fix/*`
- **生产构建**：
bash
npm run build


---

## 📄 许可证

MIT License  
© 2026 MCL Logistics Analytics Team

---

## ✨ 贡献指南（可选）

欢迎提交 Issue 或 Pull Request，建议遵循 Conventional Commits 规范。


