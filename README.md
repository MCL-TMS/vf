# CMS 物流分析仪表板 | MCL DATA COMPASS

> 基于 **Courier Management System** 的物流数据分析平台
> Logistics analytics platform based on **Courier Management System (provided by FLUX)**

> 技术栈：**React + TypeScript + Node.js + Oracle Database**
> Tech Stack: **React + TypeScript + Node.js + Oracle Database**

---

## 📌 项目简介 | Project Overview

CMS 物流分析仪表板是为 Courier Management System（由 FLUX 提供）​ 构建的数据可视化与分析平台，服务于客户与内部运营团队。
The CMS Logistics Analytics Dashboard is a data visualization and analysis platform built for **Courier Management System (provided by FLUX)**, serving both customers and internal operations teams.


该系统通过对FLUX CMS 核心业务数据进行分析，提供：
By analyzing core business data from FLUX CMS, the system provides:
- 📦 全链路物流可视化 | End-to-end logistics visibility
- 📈 多维度运营分析 | Multi-dimensional operational analytics
- ⚠️ 异常监控与预警 | Anomaly monitoring and early warning
- 🧠 数据驱动的决策支持 | Data-driven decision support
---

## 🏗️ 项目架构| Project Architecture

### 总体结构| Overall Structure

```text
mcl-cms_dashboard/
├── frontend/                # 前端应用（React + Vite + TypeScript）
├── backend/                 # 后端服务（Node.js + Express + Oracle）
├── docs/                    # 技术文档与接口说明
├── start.sh / start.bat     # 一键启动脚本
└── README.md
```

---

### 前端架构| Frontend Architecture

```text
/
├── index.html                       # 单页应用挂载点 SPA entry point
├── package.json                     # 项目依赖与构建脚本  Dependencies & build scripts
├── vite.config.ts                   # Vite 自动化构建配置 Vite build configuration
│
├── src/
│   ├── main.tsx                     # 应用程序启动渲染入口 Application bootstrap entry
│   ├── App.tsx                      # 根组件，定义全局路由分发与基础 UI 框架 Root component with routing & layout
│   │
│   ├── components/                  # UI 业务组件（图表、对话框、分析工具等） # Business UI components
│   ├── contexts/                    # 全局状态管理（如身份认证、系统配置上下文）# Global state management
│   ├── services/                    # 后端 API 请求封装层（基于 axios）  # API service layer (Axios)
│   ├── hooks/                       # 自定义 React Hooks，封装通用逻辑│    # Custom React Hooks
│   ├── utils/                       # 前端辅助工具类（数据转换、格式化等） # Frontend utilities
│   └── styles/                      # 全局与组件级样式定义 # Global & component styles
│
└── build/                           # 生产环境编译产物目录# Production build output
```

**设计特点：** Design Highlights**

- 强类型约束（TypeScript）| Strong typing with TypeScript
- UI 与业务逻辑解耦| Decoupled UI and business logic
- API 调用统一收敛至 `services` 层 | Centralized API calls via `services`

---

### 后端架构

```text
src/backend/
├── src/
│   ├── api-server.js       # Express 服务主入口，处理中间件注册与路由分发# Express server entry point
│   │
│   ├── config/
│   │   └── database-api.js   # Oracle 数据库连接池配置与生命周期管理# Oracle connection pool configuration
│   │
│   ├── routes/
│   │   ├── auth.js                  # 身份认证路由（登录验证、令牌签发与管理 Authentication routes
│   │   ├── brands.js                # 品牌与业务数据相关接口 Brand & business data APIs
│   │   └── ...                      # 模块化业务路由 Modular business routes
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js        # JWT 权限核验与访问控制安全中间件  JWT authentication & authorization
│   │   └── rateLimitMiddleware.js   # API 限频保护，抵御自动化扫描  API rate limiting
│   │
│   ├── utils/
│   │   ├── passwordUtils.js         # 高强度密码哈希处理（基于 scrypt 算法）Strong password hashing (scrypt)
│   │   ├── apiError.js              # 规范化异常处理，定义统一错误响应格式 Unified error response format
│   │   ├── mfaOtpStore.js(To be implemented)           # 多因素认证（MFA）挑战存储逻辑 MFA challenge storage logic
│   │   └── emailSender.js(To be implemented)           # 系统级邮件分发服务System email service
│   │
│   └── services/                    # 业务逻辑服务层，负责与数据库连接交互Business logic & DB interaction layer
│
├── .env                             # 系统配置与敏感环境变量  Environment variables (not committed)
└── API_GUIDE.md                     # 后端 API 接口设计与开发规范  Backend API specification
```

**设计特点：**| Design Highlights**

- 分层清晰（Route → Middleware → Service）| Clear layering (Route → Middleware → Service)
- 安全策略内建（JWT + Rate Limit + 密码加固）| Built-in security (JWT + Rate Limit + Password hardening)
- 可扩展的模块化路由体系| Scalable modular routing architecture

---

### API 架构  | API Architecture

#### RESTful API 设计 | RESTful API Design

| 方法 Method   | 用途 Description                                       |
| ------ | ------------------------------------------------------ |
| `GET`  | 用于获取各类物流分析指标及系统资源 <br>Retrieve logistics metrics & system resources                     |
| `POST` | 用于提交敏感数据及执行状态变更操作（如身份验证）<br>Submit sensitive data & perform state changes  |

#### 统一响应格式| Unified Response Format

```json
{
  "success": true,               // 请求执行状态
  "data": { ... },               // 成功时返回的业务数据载体
  "error": null,                 // 失败时提供的详细错误信息
  "code": "SUCCESS"              // 后端预定义的业务错误码或状态码
}
```

#### 典型错误码 | Common Error Codes

| 错误码           | 含义                     |
| ---------------- | ------------------------ |
| `TOKEN_EXPIRED`  | Token 已过期             |
| `UNAUTHORIZED`   | 未授权访问               |
| `LEGACY_ACCOUNT` | 账户需升级（安全策略要求） |
| `DB_UNAVAILABLE` | 数据库不可用             |

---

### 系统数据流| System Data Flow

```text
用户操作User Action
   ↓
前端 Component → services（API 调用）
   ↓
后端 Middleware（限流 → JWT 校验Rate Limit → JWT verification）
   ↓
Route → Service（SQL 执行）
   ↓
Oracle 数据库
   ↓
统一响应（apiError）
   ↓
前端渲染 / 异常处理 Frontend rendering / exception handling
```


---

## 🚀 快速启动| Quick Start

### ✅ 推荐方式（一键启动）| Recommended (One-Click)

#### Windows
双击根目录下的 `start.bat`。
Double-click `start.bat` in the project root directory.
#### Linux / macOS
```bash
chmod +x start.sh
./start.sh
```

---

### 🔹 手动启动（开发环境）| Manual Start (Development)

#### 1. 安装依赖 | Install Dependencies
```bash
# 根目录下执行| Run in project root
cd frontend && npm install
cd ../backend && npm install
```

#### 2. 启动服务| Start Services
```bash
# 后端 (端口 3001)| Backend (port 3001)
cd backend && npm start

# 前端 (端口 5173)| Frontend (port 5173)
cd frontend && npm run dev
```

---

## ✅ 启动前检查清单| Pre-Start Checklist

- [ ] Node.js ≥ **16.0.0**
- [ ] Oracle Instant Client 已安装并配置环境变量 
      Oracle Instant Client installed & environment variables configured
- [ ] 已从 `backend/.env.example` 复制为 `backend/.env`
      Copied `backend/.env.example` to `backend/.env`
- [ ] Oracle 数据库连接正常
      Oracle database connection verified
- [ ] 端口 `3001`（后端）与 `5173`（前端）未被占用
      Ports `3001` (backend) and `5173` (frontend) are free
- [ ] 前后端依赖已安装完成
      Frontend & backend dependencies installed
- [ ] Oracle 用户具备 `SELECT` 权限（BAS_CODES / TSK_LIST_TASK / DOC_COMPLAINT）
      Oracle user has `SELECT` permission on required tables

---

## ⚙️ 环境配置| Environment Configuration

### Oracle 数据库（`backend/.env`）

```env
DB_USER=your_username
DB_PASSWORD=your_password
DB_CONNECTION_STRING=localhost:1521/XE
DB_SCHEMA=YOUR_CMS
PORT=3001
NODE_ENV=development
```

### 数据库表结构| Database Schema

| 表名              | 说明             |
| ----------------- | ---------------- |
| `BAS_CODES`       | 基础代码表<br>Base code table        |
| `TSK_LIST_TASK`   | 快递订单表<br>Courier task table      |
| `DOC_COMPLAINT`   | 工单表<br>Complaint ticket table          |

---

## 🧩 功能特性| Features

### 核心功能| Core Features

- 📈 **总览仪表板**：KPI、订单数量、订单状态  
  📈 **Overview Dashboard**: KPIs, order volume, order status
- 📦 **重量分析**：重量分布、成本分析  
  📦 **Weight Analysis**: Weight distribution, cost analysis
- 🚚 **物流监控**：全链路节点追踪、异常预警  
  🚚 **Logistics Monitoring**: End-to-end tracking, anomaly alerts
- 📉 **趋势分析**：时间序列分析、预测建模  
  📉 **Trend Analysis**: Time-series analysis, forecasting
- ⚠️ **异常分析**：异常检测、根因分析  
  ⚠️ **Anomaly Analysis**: Detection & root cause analysis

### 技术特性 | Technical Features
- 📱 响应式布局 | Responsive layout
- 🔍 多维度筛选 | Multi-dimensional filtering
- 💾 Oracle 数据库集成 | Oracle database integration
- 🔐 TypeScript 类型安全 | TypeScript type safety

---

## 🌐 访问地址

| 服务         | 地址                              |
| ------------ | --------------------------------- |
| 前端应用     | http://localhost:5173             |
| 后端 API     | http://localhost:3001             |
| 健康检查     | http://localhost:3001/api/health  |
| API 信息     | http://localhost:3001/api/info    |
| API 文档     | [`docs/API_GUIDE.md`](docs/API_GUIDE.md) |

---

## 📶 连接状态说明 | Connection Status

| 状态 Status | 含义 Description |
| ------------------ | -------------------------------- |
| 🟢 API 服务已连接  | 使用 Oracle 真实数据<br>Using real Oracle data |
| 🟡 模拟数据模式    | 后端未连接，使用演示数据<br>Fallback to mock data |
| 🔴 连接异常        | API 调用失败，支持一键重试<br>API call failed, retry supported |
---

## 🛠️ 常见问题排查| Troubleshooting

### 依赖安装失败| Dependency Installation Failed

```bash
# 清理并重新安装| Clean and reinstall
cd frontend && rm -rf node_modules && npm install
cd ../backend && rm -rf node_modules && npm install
```

### 后端启动失败 | Backend Startup Failed

```bash
cd backend
# 检查数据库连接
node src/scripts/testConnection.js
```

### 端口被占用| Port Already in Use

#### Windows

```bat
netstat -ano | findstr :3001
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

#### Linux / macOS

```bash
lsof -i :3001
lsof -i :5173
kill -9 <PID>
```

---

## 📊 日志与监控 | Logging & Monitoring

- 后端请求日志：`backend/logs/`  
  Backend request logs: `backend/logs/`
- 健康检查接口：`/api/health`  
  Health check endpoint: `/api/health`
- 异常状态码统一返回 `{ code, message }`  
  Unified error response format `{ code, message }`
---

## 🔒 安全说明 | Security Notes

- API 限流防护（防暴力破解）  
  API rate limiting (brute-force protection)
- JWT Token 校验与吊销机制  
  JWT token validation & revocation mechanism


---

## 🎯 开发规范 | Development Standards

- **组件命名**：PascalCase（`DashboardCard.tsx`）  
  **Component naming**: PascalCase (`DashboardCard.tsx`)
- **文件命名**：kebab-case（`use-dashboard-data.ts`）  
  **File naming**: kebab-case (`use-dashboard-data.ts`)
- **Git 分支 | Git Branches**：
  - `feature/*`
  - `fix/*`
- **生产构建 | Production Build**：


```bash
npm run build
```
---

## 📄 关于 Courier Management System

> **Courier Management System（CMS）由 FLUX 提供**  
> **Courier Management System (CMS) is provided by FLUX**  
> 本系统为 FLUX CMS 的官方数据分析与可视化扩展平台  
> This dashboard is the official analytics extension of FLUX CMS.
---

## 📄 许可证|License

MIT License
© 2026 MCL Logistics Analytics Team

---

## ✨ 贡献指南| Contributing

欢迎提交 Issue 或 Pull Request，建议遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。
