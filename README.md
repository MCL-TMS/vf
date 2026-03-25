VF物流分析仪表板
基于马士基设计系统的React+TypeScript物流数据分析仪表板，集成Oracle数据库，支持品牌筛选、地域分析、异常监控等功能。
🚀 快速启动
方法一：一键启动（推荐）
Linux/macOS 用户：
```bash
# 使用 Node.js 启动脚本（跨平台）
npm run start

# 或使用 Shell 脚本
chmod +x start.sh
./start.sh
```
Windows 用户：
```cmd
# 双击运行批处理文件
start.bat

# 或在命令行中运行
npm run start

# 或使用并发启动
npm run dev:all
```
方法二：分别启动
1. 启动后端：
```bash
cd backend
npm install  # 首次运行
npm start     # 启动 API 服务 (端口 3001)
```
2. 启动前端：（新终端窗口）
```bash
npm install   # 首次运行
npm run dev   # 启动开发服务器 (端口 5173)
```
方法三：并发启动
```bash
npm install concurrently --save-dev  # 安装并发工具
npm run dev:all                      # 同时启动前后端
```
📋 启动前检查清单
[ ] Node.js 版本 16.0.0 或更高
[ ] Oracle Instant Client 已安装并配置环境变量
[ ] 后端配置 `backend/.env` 已从 `backend/.env.example` 复制并配置
[ ] 数据库连接 可正常访问 Oracle 数据库
[ ] 端口可用 3001 和 5173 端口未被占用
[ ] 依赖安装 前后端 npm 包已安装
🔧 环境配置
1. Oracle 数据库配置
编辑 `backend/.env` 文件：
```env
# Oracle 数据库连接配置
DB_USER=your_username
DB_PASSWORD=your_password  
DB_CONNECTION_STRING=localhost:1521/XE
DB_SCHEMA=APP_CMS

# API 服务配置
PORT=3001
NODE_ENV=development
```
2. 数据库表结构
应用连接到 `APP_CMS` Schema 下的三张核心表：
BAS_CODES - 基础代码表
TSK_LIST_TASK - 快递任务表（21个字段）
DOC_COMPLAINT - 工单表
📊 功能特性
核心功能模块
📈 总览仪表板 - 品牌KPI、平台分析、异常监控
🗺️ 地域分析 - 中国地图可视化、省份数据钻取
📦 重量分析 - 重量分布、成本分析、趋势预测
🚚 物流监控 - 全程节点追踪、异常预警
📉 趋势分析 - 时间序列分析、预测建模
⚠️ 异常管理 - 智能异常检测、根因分析
技术特性
🎨 马士基设计系统 - 完整的色彩规范和组件库
🔄 智能数据降级 - API断连自动切换模拟数据
📱 响应式设计 - 适配桌面端和移动端
🔍 多维度筛选 - 品牌、平台、时间、异常类型
💾 Oracle集成 - 原生数据库连接和查询优化
🔐 类型安全 - 完整的TypeScript类型定义
🏗️ 项目架构
```
├── 🎨 前端应用 (React + TypeScript + Tailwind CSS)
│   ├── components/     # 可复用组件
│   ├── pages/         # 页面组件  
│   ├── hooks/         # 自定义Hook
│   ├── services/      # API服务层
│   ├── data/          # 数据模型和模拟数据
│   └── utils/         # 工具函数
│
└── 🔧 后端服务 (Node.js + Oracle)
    ├── src/
    │   ├── routes/    # API路由
    │   ├── config/    # 数据库配置
    │   └── scripts/   # 工具脚本
    └── package.json
```
🌐 访问地址
启动成功后访问以下地址：
前端应用: http://localhost:5173
后端API: http://localhost:3001
健康检查: http://localhost:3001/health
API文档: http://localhost:3001/api-docs
📈 连接状态监控
应用顶部会显示实时连接状态：
🟢 API服务已连接 - 使用Oracle真实数据
🟡 模拟数据模式 - 后端未连接，使用演示数据
🔴 连接异常 - API调用失败，支持一键重试
🔍 故障排除
常见问题
1. npm install 依赖安装失败
```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules 重新安装
npm run clean
npm run install:all
```
2. 后端启动失败
```bash
# 检查 Oracle Client
cd backend && node quick-test.js

# 检查数据库连接
node src/scripts/testConnection.js

# 查看详细错误
npm run check:backend
```
3. 前端连接问题
检查浏览器控制台是否有CORS错误
确认后端服务运行在正确端口
验证 `services/apiService.ts` 中的API地址
4. 端口占用问题（Windows）
```cmd
# 查找占用进程
netstat -ano | findstr :3001
netstat -ano | findstr :5173

# 终止进程
taskkill /PID <PID> /F
```
5. 端口占用问题（Linux/macOS）
```bash
# 查找占用进程
lsof -i :3001
lsof -i :5173

# 终止进程
kill -9 <PID>
```
6. Oracle Client 问题
```bash
# Windows 环境变量设置
set PATH=%PATH%;C:\path\to\instantclient
set ORACLE_HOME=C:\path\to\instantclient

# Linux/macOS 环境变量设置
export LD_LIBRARY_PATH=/path/to/instantclient:$LD_LIBRARY_PATH
export ORACLE_HOME=/path/to/instantclient
```
开发工具
```bash
# 快速检查服务状态
npm run check:api

# 重新安装依赖
npm run clean && npm run install:all

# 项目初始化
npm run setup

# 检查后端数据库连接
cd backend && node quick-test.js
```
📚 文档资源
🚀 QUICK_START.md - 后端快速启动指南
🔌 INTEGRATION_GUIDE.md - API集成指南
🛠️ TROUBLESHOOTING.md - 故障排除手册
📊 VF_LOGISTICS_SCHEMA.md - 数据库结构文档
🎯 开发指南
代码风格
遵循马士基设计系统色彩规范
使用TypeScript严格模式
组件名采用PascalCase
文件名采用kebab-case
Git工作流
```bash
# 功能开发
git checkout -b feature/新功能名称
git commit -m "feat: 添加新功能描述"

# 问题修复  
git checkout -b fix/问题描述
git commit -m "fix: 修复问题描述"
```
部署准备
```bash
# 构建生产版本
npm run build

# 检查构建输出
ls -la dist/
```
🏆 品牌支持
支持以下VF集团品牌的物流数据分析：
TNF (The North Face)
DICKIES
VANS
TIMBERLAND
ICEBREAKER
KIPLING
⚡ 性能优化
开发环境
使用 Vite 构建工具实现快速热重载
TypeScript 增量编译
懒加载路由和组件
生产环境
代码分割和按需加载
资源压缩和缓存优化
CDN 加速静态资源
🔒 安全考虑
环境变量管理敏感信息
Oracle 数据库连接加密
API 请求防护和限流
XSS 和 CSRF 防护
📱 响应式设计
桌面端: >= 1024px - 完整功能体验
平板端: 768px - 1023px - 适配布局
移动端: < 768px - 简化交互
🌟 最佳实践
开发时
代码规范: 使用 ESLint 和 TypeScript 检查
组件设计: 遵循单一职责原则
状态管理: 合理使用 React Hooks
性能监控: 定期检查包大小和性能指标
数据处理
缓存策略: 合理使用内存和磁盘缓存
错误处理: 完整的错误边界和用户反馈
数据验证: 前后端双重验证
日志记录: 完整的操作和错误日志
📄 许可证
Copyright © 2026 VF Logistics Analytics Team
---
💡 提示: 如果是首次运行，建议先查看 启动前检查清单 确保环境配置正确。
🔗 快速链接: 启动指南 | 功能特性 | 故障排除 | 开发指南