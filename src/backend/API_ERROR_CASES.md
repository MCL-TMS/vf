# VF Logistics API Error Cases

本文件用于测试、联调和回归验证统一错误码与错误响应格式。

## 1. Standard Error Payload

所有错误响应应使用以下结构：

```json
{
  "success": false,
  "code": "AUTH_TOKEN_MISSING",
  "error": "未提供认证令牌，请先登录",
  "requestId": "4c4f7fc7-6f44-470b-b36b-c9ea4b7f8860",
  "timestamp": "2026-04-03T12:18:35.221Z"
}
```

校验点：

- `success` 必须为 `false`
- `code` 必须稳定且可机读
- `error` 必须为前端可直接展示的中文文案
- `requestId` 必须存在，且响应头 `X-Request-Id` 也应存在
- `timestamp` 必须为 ISO 8601 时间字符串
- `details` 仅在需要补充结构化上下文时出现

## 2. Fixed Cases For QA

### 2.1 401 未登录访问受保护接口

- Purpose: 验证缺失 token 的统一错误格式
- Request:

```bash
curl -i "http://localhost:3001/api/overview/kpi?dateFrom=2026-03-01&dateTo=2026-03-31"
```

- Expected:
  - HTTP `401`
  - `code = AUTH_TOKEN_MISSING`
  - `error = 未提供认证令牌，请先登录`

### 2.2 401 Access Token 已过期

- Purpose: 验证已过期 token 的统一错误码，供前端自动刷新逻辑联调
- Request:

```bash
curl -i \
  -H "Authorization: Bearer <expired-access-token>" \
  "http://localhost:3001/api/logistics/couriers?dateFrom=2026-03-01&dateTo=2026-03-31"
```

- Expected:
  - HTTP `401`
  - `code = AUTH_TOKEN_EXPIRED`
  - `error = 认证令牌已过期，请重新登录`

### 2.3 403 品牌权限越权

- Purpose: 验证后端只信任登录态品牌范围
- Precondition: 使用仅有单品牌权限的账号登录
- Request:

```bash
curl -i \
  -H "Authorization: Bearer <limited-scope-token>" \
  "http://localhost:3001/api/order-details/export?startDate=2026-03-01&endDate=2026-03-31&brand=18405-4"
```

- Expected:
  - HTTP `403`
  - `code = BRAND_SCOPE_FORBIDDEN`
  - `error = 请求的品牌超出当前账号权限范围`
  - `details.unauthorizedBrands` 存在

### 2.4 403 生产环境强制 HTTPS

- Purpose: 验证生产环境非 HTTPS 请求被拒绝
- Precondition:
  - `NODE_ENV=production`
  - `FORCE_HTTPS=true`
  - 未开启 `HTTPS_REDIRECT`，或反向代理未转发 HTTPS
- Request:

```bash
curl -i "http://your-host/api/health"
```

- Expected:
  - HTTP `403`
  - `code = HTTPS_REQUIRED`
  - `error = 当前环境仅允许通过 HTTPS 访问 API`

### 2.5 429 登录限流

- Purpose: 验证登录防暴力破解返回统一格式
- Steps:
  1. 连续多次用同一 `userId` 提交错误密码
  2. 超过锁定阈值后再次请求
- Request:

```bash
curl -i \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"EZO010\",\"password\":\"wrong-password\"}" \
  "http://localhost:3001/api/auth/login"
```

- Expected:
  - HTTP `429`
  - `code = LOGIN_RATE_LIMITED`
  - `error` 包含锁定提示
  - `details.remainingTimeMinutes` 存在

### 2.6 429 全局 API 限流

- Purpose: 验证通用限流的统一格式
- Method: 用压测工具短时间内重复请求受保护接口
- Example target:

```bash
curl -i \
  -H "Authorization: Bearer <access-token>" \
  "http://localhost:3001/api/info"
```

- Expected:
  - HTTP `429`
  - `code = RATE_LIMITED`
  - `error = 请求过于频繁，请稍后再试`

### 2.7 503 数据库不可用

- Purpose: 验证 Oracle 不可用时的统一错误格式
- Precondition: 断开数据库、提供错误连接串，或让连接池初始化失败
- Request:

```bash
curl -i \
  -H "Authorization: Bearer <access-token>" \
  "http://localhost:3001/api/overview/kpi?dateFrom=2026-03-01&dateTo=2026-03-31"
```

- Expected:
  - HTTP `503`
  - `code = DB_UNAVAILABLE`
  - `error = 暂时无法连接到数据库，请稍后重试`

### 2.8 503 健康检查失败

- Purpose: 验证健康检查依赖失败时的统一错误格式
- Precondition: 数据库不可连接
- Request:

```bash
curl -i "http://localhost:3001/api/health"
```

- Expected:
  - HTTP `503`
  - `code = HEALTH_CHECK_FAILED`
  - `error = 健康检查失败`

## 3. Regression Checklist

- 受保护接口 `401` 时前端应按 `code` 触发自动刷新或重新登录
- `BRAND_SCOPE_FORBIDDEN` 时前端应提示权限范围不足，不应误跳转登录
- `RATE_LIMITED` 和 `LOGIN_RATE_LIMITED` 应统一走限流提示
- `DB_UNAVAILABLE` 和 `HEALTH_CHECK_FAILED` 应统一走服务不可用提示
- 所有错误响应都应返回 `requestId`
