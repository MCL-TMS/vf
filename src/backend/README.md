# VF物流数据分析平台 - 完整开发指南

## 📋 项目概述

VF物流数据分析平台是一个综合性的物流分析仪表板，专为VF(威富)集团旗下DICKIES、TNF、VANS、TIMBERLAND、ICEBREAKER等品牌提供实时物流数据分析服务。

### 🏗️ 技术架构

- **前端**: React + TypeScript + Tailwind CSS + shadcn/ui
- **后端**: Node.js + Express.js + Oracle数据库
- **设计系统**: 马士基设计规范
- **数据库**: Oracle Database（本地开发环境）

### 🎯 核心功能

- 📊 **总览分析**: KPI指标统计、状态分布、异常监控
- 🗺️ **地域分析**: 省份分布、城市排名、配送效率  
- 📈 **时间趋势**: 订单趋势、品牌对比、效率分析
- 🚚 **物流监控**: 快递商性能、重量分布、节点监控

---

## 🚀 快速开始

### ⚡ 一键启动流程

```bash
# 1. 克隆项目
git clone <repository-url>
cd vf-logistics-platform

# 2. 安装前端依赖
npm install

# 3. 安装后端依赖
cd backend
npm install

# 4. 配置数据库连接（交互式向导）
npm run setup-wizard

# 5. 验证环境配置
npm run check-tables

# 6. 启动后端API服务器
npm start

# 7. 启动前端应用（新终端）
cd ..
npm run dev
```

### 📋 系统要求

- **Node.js**: >= 16.0.0
- **Oracle Database**: 11g XE或更高版本
- **Oracle Instant Client**: 必须安装
- **操作系统**: Windows, macOS, Linux

---

## 🔧 环境配置

### 1. Oracle Instant Client 安装

#### Windows
```bash
# 1. 下载Oracle Instant Client Basic Package
# 从 https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html

# 2. 解压到 C:\oracle\instantclient_19_8

# 3. 添加到系统PATH环境变量
# 系统属性 -> 环境变量 -> Path -> 新建 -> C:\oracle\instantclient_19_8
```

#### macOS
```bash
# 使用Homebrew安装
brew tap InstantClientTap/instantclient
brew install instantclient-basic

# 或手动下载安装
# https://www.oracle.com/database/technologies/instant-client/macos-intel-x86-downloads.html
```

#### Linux (Ubuntu/Debian)
```bash
# 安装依赖
sudo apt-get update
sudo apt-get install alien libaio1

# 下载并安装Oracle Instant Client
# https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html
```

### 2. 数据库配置

#### 方式一：交互式向导（推荐）
```bash
cd backend
npm run setup-wizard
```

向导将引导您完成：
- ✅ 前置条件检查
- 🗃️ 数据库连接配置  
- 🚀 API服务器设置
- 🔗 连接测试验证

#### 方式二：手动配置
```bash
# 1. 复制环境变量模板
cd backend
cp .env.example .env

# 2. 编辑 .env 文件
nano .env
```

**.env 配置示例**:
```env
# Oracle数据库配置（必需）
ORACLE_USER=your_username
ORACLE_PASSWORD=your_password  
ORACLE_CONNECT_STRING=localhost:1521/XE

# 连接池配置（可选）
ORACLE_POOL_MIN=2
ORACLE_POOL_MAX=10
ORACLE_POOL_INCREMENT=2
ORACLE_POOL_TIMEOUT=60

# API服务器配置（可选）
API_PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### 3. 支持的Oracle连接字符串格式

```bash
# 1. 简单连接字符串（推荐）
ORACLE_CONNECT_STRING=localhost:1521/XE

# 2. 完整连接描述符
ORACLE_CONNECT_STRING=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=XE)))

# 3. 使用SID
ORACLE_CONNECT_STRING=localhost:1521:XE

# 4. 远程数据库
ORACLE_CONNECT_STRING=192.168.1.100:1521/PROD
```

---

## 🗃️ 数据库设置

### 核心表结构

项目依赖以下Oracle数据库表：

| 表名 | Schema | 用途 | 字段数 |
|------|--------|------|--------|
| `TSK_LIST_TASK` | APP_CMS | 快递任务表 | 21个核心字段 |
| `BAS_CODES` | APP_CMS | 基础代码表 | 业务字典数据 |
| `DOC_COMPLAINT` | APP_CMS | 工单表 | 投诉工单数据 |

### 数据库权限要求

```sql
-- 用户需要以下权限
GRANT SELECT ON APP_CMS.TSK_LIST_TASK TO your_username;
GRANT SELECT ON APP_CMS.BAS_CODES TO your_username;
GRANT SELECT ON APP_CMS.DOC_COMPLAINT TO your_username;
```

### 验证数据库连接

```bash
# 1. 快速环境检查
npm run quick:check

# 2. 测试API数据库连接
npm run test:api  

# 3. 检查表结构和权限
npm run check-tables

# 4. 详细数据库诊断
npm run db:diagnose
```

---

## 🚀 启动服务

### 后端API服务器

```bash
cd backend

# 开发模式（推荐）
npm run dev

# 生产模式
npm start

# 后台运行
nohup npm start > api.log 2>&1 &
```

### 前端应用

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

### 验证服务状态

```bash
# 1. 检查API服务器健康状态
curl http://localhost:3001/api/health

# 2. 获取API文档信息
curl http://localhost:3001/api/info

# 3. 测试KPI数据API
curl "http://localhost:3001/api/overview/kpi?dateFrom=2024-01-01&dateTo=2024-12-31"

# 4. 访问前端应用
# 浏览器打开 http://localhost:3000
```

---

## 📊 API端点文档

### 总览分析 API

| 端点 | 方法 | 描述 | 参数 |
|------|------|------|------|
| `/api/health` | GET | 健康检查 | 无 |
| `/api/overview/kpi` | GET | KPI指标统计 | dateFrom, dateTo, brand?, platform? |
| `/api/overview/status-distribution` | GET | 状态分布统计 | dateFrom, dateTo, brand?, platform? |
| `/api/overview/exceptions` | GET | 异常监控数据 | dateFrom, dateTo, brand?, type? |

### 地域分析 API

| 端点 | 方法 | 描述 | 参数 |
|------|------|------|------|
| `/api/regional/provinces` | GET | 省份订单分布 | dateFrom, dateTo, brand? |
| `/api/regional/cities` | GET | 城市排名数据 | dateFrom, dateTo, brand?, limit? |
| `/api/regional/efficiency` | GET | 地域配送效率 | dateFrom, dateTo, brand? |

### 时间趋势 API

| 端点 | 方法 | 描述 | 参数 |
|------|------|------|------|
| `/api/trends/orders` | GET | 订单量趋势 | dateFrom, dateTo, brand?, granularity? |
| `/api/trends/brands` | GET | 品牌趋势对比 | dateFrom, dateTo |
| `/api/trends/efficiency` | GET | 配送效率趋势 | dateFrom, dateTo, brand? |
| `/api/trends/platforms` | GET | 平台趋势数据 | dateFrom, dateTo, brand? |

### 物流监控 API

| 端点 | 方法 | 描述 | 参数 |
|------|------|------|------|
| `/api/logistics/couriers` | GET | 快递商性能统计 | dateFrom, dateTo, brand? |
| `/api/logistics/weight-distribution` | GET | 重量分布分析 | dateFrom, dateTo, brand? |
| `/api/logistics/nodes` | GET | 物流节点监控 | dateFrom, dateTo, brand? |

### API使用示例

```bash
# 获取2024年DICKIES品牌KPI数据
curl "http://localhost:3001/api/overview/kpi?dateFrom=2024-01-01&dateTo=2024-12-31&brand=DICKIES"

# 获取省份分布数据
curl "http://localhost:3001/api/regional/provinces?dateFrom=2024-01-01&dateTo=2024-12-31"

# 获取订单趋势（按月）
curl "http://localhost:3001/api/trends/orders?dateFrom=2024-01-01&dateTo=2024-12-31&granularity=month"
```

---

## 📋 可用脚本

### 🏃‍♂️ 服务器管理
```bash
npm start                  # 启动API服务器
npm run dev                # 开发模式（自动重启）
npm run api:test           # 测试API服务器状态
```

### 🔧 环境配置
```bash
npm run setup-wizard       # 交互式配置向导（推荐）
npm run setup              # 基础设置脚本
npm run quick:check        # 快速环境检查
npm run env:check          # 检查环境变量
npm run oracle:check       # 检查Oracle客户端
```

### 🗃️ 数据库相关
```bash
npm run check-tables       # 检查数据库表结构 ✅
npm run check              # 同上（别名）
npm run db:test            # 测试数据库连接
npm run db:check           # 数据库表检查（别名）
npm run db:diagnose        # 数据库诊断工具
npm run test:api           # API数据库连接测试
```

### 🔍 测试和诊断
```bash
npm run quick:test         # 快速功能测试
npm test                   # 运行测试套件
```

---

## 🚨 常见问题解决

### ❌ "Missing script: check-tables"

**问题**: 运行 `npm run check-tables` 时出错

**解决方案**:
```bash
# 确保在backend目录下
cd backend

# 重新安装依赖
npm install

# 现在可以运行
npm run check-tables
```

### ❌ Oracle客户端未安装

**问题**: `Error: Oracle client library not found`

**解决方案**:
```bash
# 1. 检查Oracle客户端
npm run oracle:check

# 2. 根据上述"Oracle Instant Client 安装"部分安装

# 3. 验证安装
npm run quick:check
```

### ❌ 数据库连接失败

**常见错误码及解决方案**:

#### ORA-12154: TNS:could not resolve the connect identifier
```bash
# 检查连接字符串格式
# 正确格式: localhost:1521/XE
# 错误格式: localhost/XE
```

#### ORA-01017: invalid username/password
```bash
# 1. 验证用户名密码
# 2. 检查用户是否被锁定
# 3. 重新运行配置向导
npm run setup-wizard
```

#### ORA-00942: table or view does not exist
```bash
# 检查表权限
npm run db:diagnose

# 确认用户有SELECT权限
```

### ❌ 端口占用问题

**问题**: 端口3001或3000已被占用

**解决方案**:
```bash
# 查找占用端口的进程
# Windows
netstat -ano | findstr :3001

# macOS/Linux  
lsof -i :3001

# 杀死进程或修改端口
# 在.env中设置其他端口
API_PORT=3002
```

### ❌ 依赖安装失败

```bash
# 清除缓存重新安装
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# 如果仍失败，尝试yarn
npm install -g yarn
yarn install
```

---

## 🏗️ 项目结构

```
vf-logistics-platform/
├── frontend/                    # React前端应用
│   ├── components/             # React组件
│   │   ├── pages/             # 页面组件
│   │   ├── ui/                # shadcn/ui组件库
│   │   └── ...                # 其他组件
│   ├── data/                  # 模拟数据和类型定义
│   ├── hooks/                 # React Hooks
│   ├── utils/                 # 工具函数
│   ├── styles/                # 样式文件
│   └── ...
│
├── backend/                     # Node.js后端API
│   ├── src/
│   │   ├── api-server.js      # Express服务器入口
│   │   ├── config/
│   │   │   ├── database.js    # 原有数据库配置
│   │   │   └── database-api.js # API专用数据库配置
│   │   ├── routes/            # API路由
│   │   │   ├── overview.js    # 总览分析API
│   │   │   ├── regional.js    # 地域分析API
│   │   │   ├── trends.js      # 趋势分析API
│   │   │   └── logistics.js   # 物流监控API
│   │   └── scripts/           # 工具脚本
│   ├── package.json           # 后端依赖配置
│   ├── .env.example           # 环境变量模板
│   └── ...
│
└── docs/                        # 项目文档
    ├── VF_LOGISTICS_SCHEMA.md  # 数据库表结构规范
    └── ...
```

---

## 🔐 安全配置

### API安全

- **CORS配置**: 限制跨域访问
- **请求速率限制**: 防止API滥用（15分钟1000次/IP）
- **输入验证**: SQL注入防护
- **错误信息过滤**: 避免敏感信息泄露

### 数据库安全

- **参数化查询**: 防止SQL注入
- **最小权限原则**: 仅授予必需的SELECT权限
- **连接加密**: 建议使用SSL/TLS连接
- **环境变量**: 敏感信息不直接写入代码

---

## 📈 性能优化

### API性能

- **连接池管理**: 自动管理数据库连接
- **查询优化**: 使用索引和分页查询
- **缓存策略**: 适当的查询结果缓存
- **监控指标**: 响应时间、错误率、吞吐量

### 前端性能

- **代码分割**: 按需加载组件
- **图像优化**: 使用ImageWithFallback组件
- **状态管理**: useAppState统一状态管理
- **马士基设计系统**: 统一的样式和组件

---

## 🧪 测试指南

### 后端测试

```bash
# 环境检查
npm run quick:check

# 数据库连接测试
npm run test:api

# API端点测试
npm run api:test

# 完整诊断
npm run db:diagnose
```

### 前端测试

```bash
# 启动开发服务器
npm run dev

# 访问测试页面
# http://localhost:3000

# 检查控制台错误
# 浏览器开发者工具 -> Console
```

### 集成测试

```bash
# 1. 启动后端API
cd backend && npm start

# 2. 启动前端应用
cd .. && npm run dev

# 3. 验证数据加载
# 访问 http://localhost:3000
# 检查是否显示真实数据而非模拟数据
```

---

## 🤝 开发指南

### 代码规范

- **TypeScript**: 严格类型检查
- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化
- **马士基设计系统**: 统一的UI组件和颜色

### 提交规范

```bash
# 功能开发
git commit -m "feat: 添加新的API端点"

# 问题修复
git commit -m "fix: 修复数据库连接问题"

# 文档更新
git commit -m "docs: 更新README文档"
```

### 开发工作流

1. **创建功能分支**: `git checkout -b feature/new-feature`
2. **开发和测试**: 本地验证功能
3. **提交代码**: 遵循提交规范
4. **合并请求**: 创建Pull Request
5. **代码审查**: 团队成员审查
6. **部署**: 合并到主分支

---

## 📞 获取帮助

### 日志查看

```bash
# API服务器日志
cd backend
npm start 2>&1 | tee api.log

# 前端开发日志
npm run dev

# 数据库连接日志
npm run db:test > db.log 2>&1
```

### 环境信息收集

```bash
# 系统信息
node --version
npm --version

# 环境检查
npm run quick:check > system-info.txt

# 数据库诊断
npm run db:diagnose > db-info.txt
```

### 联系支持

如果问题无法解决，请提供：

1. **系统信息**: 操作系统、Node.js版本、npm版本
2. **错误信息**: 完整的错误堆栈和执行命令
3. **环境配置**: .env文件内容（隐藏敏感信息）
4. **日志文件**: API服务器日志、数据库连接日志

---

## 📄 版本信息

- **项目版本**: 1.0.0
- **Node.js要求**: >= 16.0.0  
- **Oracle支持**: 11g XE及以上
- **更新日期**: 2025年1月15日
- **维护团队**: VF物流数据分析团队

---

## 🎉 快速启动检查清单

- [ ] ✅ Node.js >= 16.0.0 已安装
- [ ] ✅ Oracle Instant Client 已安装并配置PATH
- [ ] ✅ Oracle数据库服务正在运行
- [ ] ✅ 前端依赖已安装 (`npm install`)
- [ ] ✅ 后端依赖已安装 (`cd backend && npm install`)
- [ ] ✅ 数据库连接已配置 (`npm run setup-wizard`)
- [ ] ✅ 环境检查通过 (`npm run quick:check`)
- [ ] ✅ 数据库表访问正常 (`npm run check-tables`)
- [ ] ✅ 后端API服务器已启动 (`npm start`)
- [ ] ✅ 前端应用已启动 (`npm run dev`)
- [ ] ✅ 浏览器访问 http://localhost:3000 正常
- [ ] ✅ API健康检查通过 (http://localhost:3001/api/health)

**🎯 所有检查通过后，您的VF物流数据分析平台就可以正常使用了！**

---

**💡 提示**: 首次使用建议直接运行 `npm run setup-wizard`，向导会自动引导您完成所有配置步骤。