# VF物流数据分析平台 - API使用指南

## 📋 概述

VF物流数据分析平台后端API提供了完整的RESTful接口，支持总览KPI、地域分析、时间趋势、物流监控等功能。

## 🚀 快速启动

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并配置Oracle数据库连接：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# Oracle数据库配置
DB_HOST=localhost
DB_PORT=1521
DB_SERVICE_NAME=XE
DB_USER=your_username
DB_PASSWORD=your_password

# API服务器配置
API_PORT=3001
NODE_ENV=development
```

### 3. 启动API服务器

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start

# 使用启动脚本（推荐）
node start-api.js
```

### 4. 验证启动

```bash
# 健康检查
curl http://localhost:3001/api/health

# API信息
curl http://localhost:3001/api/info
```

## 📊 API端点详情

### 总览分析 (`/api/overview`)

#### 获取KPI指标
```http
GET /api/overview/kpi?dateFrom=2024-01-01&dateTo=2024-12-31&brand=TNF
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "kpi": {
      "totalOrders": 150000,
      "deliveredOrders": 142500,
      "exceptionOrders": 4500,
      "timeout48hOrders": 750,
      "avgDeliveryHours": 52.3,
      "avgFirstDispatchHours": 6.8,
      "firstDispatchSuccessRate": 87.5,
      "deliveryRate": 95.0,
      "exceptionRate": 3.0,
      "timeout48hRate": 0.5
    },
    "brandDistribution": [...],
    "platformDistribution": [...]
  }
}
```

#### 获取状态分布
```http
GET /api/overview/status-distribution?dateFrom=2024-01-01&dateTo=2024-12-31
```

#### 获取异常监控数据
```http
GET /api/overview/exceptions?dateFrom=2024-01-01&dateTo=2024-12-31&type=pickup_timeout
```

### 地域分析 (`/api/regional`)

#### 获取省份分布
```http
GET /api/regional/provinces?dateFrom=2024-01-01&dateTo=2024-12-31&brand=VANS
```

#### 获取城市排名
```http
GET /api/regional/cities?dateFrom=2024-01-01&dateTo=2024-12-31&limit=20
```

#### 获取地域配送效率
```http
GET /api/regional/efficiency?dateFrom=2024-01-01&dateTo=2024-12-31
```

### 时间趋势 (`/api/trends`)

#### 获取订单趋势
```http
GET /api/trends/orders?dateFrom=2024-01-01&dateTo=2024-12-31&granularity=day
```

**支持的时间粒度：**
- `day`: 按天统计
- `week`: 按周统计  
- `month`: 按月统计

#### 获取品牌趋势对比
```http
GET /api/trends/brands?dateFrom=2024-01-01&dateTo=2024-12-31&granularity=week
```

#### 获取配送效率趋势
```http
GET /api/trends/efficiency?dateFrom=2024-01-01&dateTo=2024-12-31&brand=DICKIES
```

#### 获取平台趋势
```http
GET /api/trends/platforms?dateFrom=2024-01-01&dateTo=2024-12-31&granularity=month
```

### 物流监控 (`/api/logistics`)

#### 获取快递商性能
```http
GET /api/logistics/couriers?dateFrom=2024-01-01&dateTo=2024-12-31&brand=TNF
```

#### 获取重量分布分析
```http
GET /api/logistics/weight-distribution?dateFrom=2024-01-01&dateTo=2024-12-31
```

**响应包含：**
- `weightDistribution`: 重量区间分布
- `volumeDistribution`: 体积区间分布

#### 获取快递商状态分布 🆕
```http
GET /api/logistics/status-distribution?dateFrom=2024-01-01&dateTo=2024-12-31&brand=TNF&platform=tmall
```

**⚠️ 重要说明：**
- 如果揽收(状态55)和发运(状态70)数据缺失，接口将返回422错误
- 不再进行数据推算，确保数据准确性
- 建议检查数据库DIS_STATUS字段完整性

#### 获取物流节点监控
```http
GET /api/logistics/nodes?dateFrom=2024-01-01&dateTo=2024-12-31&status=70&brand=TIMBERLAND
```

## 🔧 查询参数说明

### 通用参数

| 参数 | 类型 | 必需 | 说明 | 示例 |
|------|------|------|------|------|
| `dateFrom` | string | ✅ | 开始日期 | `2024-01-01` |
| `dateTo` | string | ✅ | 结束日期 | `2024-12-31` |
| `brand` | string | ❌ | 品牌筛选 | `TNF`, `DICKIES`, `VANS`, `TIMBERLAND`, `ICEBREAKER` |

### 特定参数

| 参数 | 适用端点 | 说明 | 可选值 |
|------|----------|------|--------|
| `platform` | overview | 平台筛选 | 具体平台名称 |
| `granularity` | trends | 时间粒度 | `day`, `week`, `month` |
| `limit` | regional/cities | 结果数量限制 | 数字，默认20 |
| `type` | overview/exceptions | 异常类型 | `pickup_timeout`, `shipping_timeout`, `delivery_timeout`, `48h_no_update`, `exception_orders` |
| `status` | logistics/nodes | 订单状态 | 状态码如`00`, `55`, `70`, `95` |

## ⚠️ 错误处理

### 常见错误码

| 状态码 | 说明 | 解决方案 |
|--------|------|----------|
| `400` | 请求参数错误 | 检查必需参数是否提供 |
| `404` | API端点不存在 | 访问 `/api/info` 查看可用端点 |
| `408` | 请求超时 | 缩小查询时间范围 |
| `422` | 数据完整性验证失败 | 检查数据库数据完整性，特别是DIS_STATUS字段 |
| `429` | 请求过于频繁 | 等待后重试 |
| `500` | 服务器内部错误 | 检查日志或联系管理员 |
| `503` | 数据库连接错误 | 检查数据库配置和连接 |

### 错误响应格式

```json
{
  "error": "错误类型",
  "message": "详细错误信息",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🚀 性能优化

### 1. 查询优化
- 使用合适的时间范围（建议不超过3个月）
- 合理使用品牌和状态筛选
- 分页查询大量数据

### 2. 缓存策略
- API响应包含时间戳，支持缓存验证
- 建议对历史数据进行客户端缓存

### 3. 速率限制
- 每IP 15分钟内最多1000次请求
- 超出限制将返回429错误

## 🔍 监控和调试

### 健康检查
```bash
curl http://localhost:3001/api/health
```

### API信息
```bash
curl http://localhost:3001/api/info
```

### 数据库连接测试
```bash
npm run db:test
```

### 表结构检查
```bash
npm run db:check
```

## 📝 开发说明

### 代码结构
```
src/
├── api-server.js       # 主服务器文件
├── config/
│   └── database.js     # 数据库配置
└── routes/
    ├── overview.js     # 总览API
    ├── regional.js     # 地域分析API
    ├── trends.js       # 趋势分析API
    └── logistics.js    # 物流监控API
```

### 数据库表映射
- `TSK_LIST_TASK`: 快递任务表（核心订单数据）
- `BAS_CODES`: 基础代码表（状态码、平台分类等）
- `DOC_COMPLAINT`: 工单表（异常处理记录）

### 品牌代码映射
| 品牌名称 | 系统代码 |
|----------|----------|
| DICKIES | 18405 |
| TNF | 18405-1 |
| ICEBREAKER | 18405-2 |
| VANS | 18405-3 |
| TIMBERLAND | 18405-4 |

---

**🔗 相关文档：**
- [数据库表结构规范](./VF_LOGISTICS_SCHEMA.md)
- [本地开发环境搭建](./LOCAL_SETUP.md)
- [故障排除指南](./TROUBLESHOOTING.md)