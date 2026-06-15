# VF Logistics Backend API Guide

本文件描述当前生效的后端接口，基于 CommonJS 运行时 `src/backend/src/api-server.js`。

## 1. Scope

- Active backend entry: `src/backend/src/api-server.js`
- Runtime package: `src/backend/package.json`
- Protected routes use JWT bearer token by default
- Brand authorization is enforced by backend token scope, not by frontend `userBrands` request parameters

## 2. Base URLs

- Local frontend: `http://localhost:5173`
- Local backend: `http://localhost:3001`
- Health check: `GET /api/health`
- Redis ops health: `GET /api/health/redis`
- Redis Prometheus metrics: `GET /api/health/redis/metrics`
- API info: `GET /api/info`

说明：

- `GET /api/health` does not require authentication
- `GET /api/health/redis` requires authentication and admin role
- `GET /api/health/redis/metrics` requires authentication and admin role
- `GET /api/info` requires authentication in the active backend
- In production, backend can enforce HTTPS and HSTS depending on environment variables

## 3. Authentication

### 3.1 Login

- Endpoint: `POST /api/auth/login`
- Auth: no
- Content-Type: `application/json`

Request body:

```json
{
  "userId": "your_username",
  "password": "your_password"
}
```

Successful response (MFA challenge):

```json
{
  "success": true,
  "mfaRequired": true,
  "challengeId": "<challenge-id>",
  "expiresIn": 300,
  "maskedEmail": "ab***@example.com",
  "message": "验证码已发送到您的邮箱"
}
```

### 3.1.1 Verify MFA OTP

- Endpoint: `POST /api/auth/login/verify-otp`
- Auth: no
- Content-Type: `application/json`

Request body:

```json
{
  "challengeId": "<challenge-id>",
  "otpCode": "123456"
}
```

Successful response (login completed):

```json
{
  "success": true,
  "user": {
    "userId": "EZO010",
    "userName": "Example User",
    "customerNo": "18405,18405-1"
  },
  "token": "<access-token>",
  "refreshToken": "<refresh-token>",
  "mfaVerified": true
}
```

### 3.2 Refresh Token

- Endpoint: `POST /api/auth/refresh`
- Auth: no
- Content-Type: `application/json`

说明：

- Refresh token 现在带有独立 `jti`，并保存在 Redis 或内存回退存储中
- 每次成功调用 `POST /api/auth/refresh` 都会轮换 refresh token
- 旧 refresh token 在刷新成功后立即失效，不能重复使用

Request body:

```json
{
  "refreshToken": "<refresh-token>"
}
```

### 3.3 Logout

- Endpoint: `POST /api/auth/logout`
- Auth: yes

Request body:

```json
{
  "refreshToken": "<refresh-token>"
}
```

说明：

- `Authorization` 头中的 access token 会被撤销
- 如果 body 中携带 `refreshToken`，后端会同时撤销该 refresh token

### 3.4 Validate Session

- Endpoint: `POST /api/auth/validate`
- Auth: no
- Content-Type: `application/json`

Request body:

```json
{
  "userId": "EZO010"
}
```

## 4. Common Protected Request Headers

All protected endpoints require:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

For upload endpoints using multipart:

```http
Authorization: Bearer <access-token>
Content-Type: multipart/form-data
```

## 5. Common Query Parameters

### 5.1 Date parameters

- `dateFrom`, `dateTo`: used by overview, regional, trends, logistics, exception-analysis
- `startDate`, `endDate`: used by forwarding, interception, order-details export
- Format: `YYYY-MM-DD`

### 5.2 Business filters

- `brand`: single brand code or mapped brand key depending on endpoint implementation
- `platform`: platform key such as `tmall`, `jd`, `douyin`, `pdd`, `official`
- `selfFlag`: `Y`, `N`, or `all`

### 5.3 Authorization behavior

- Backend trusts token brand scope from JWT payload
- Frontend-supplied `userBrands` is not part of active authorization anymore
- If the caller requests a `brand` outside token scope, backend returns `403`

## 6. Standard Error Contract

QA / 联调固定样例见 `src/backend/API_ERROR_CASES.md`。

All active backend errors should now converge to the same flat payload shape:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "error": "用户名和密码不能为空",
  "requestId": "c6df04d7-1c41-4e87-8f4d-2f6d2878fa1d",
  "timestamp": "2026-04-03T09:31:12.415Z",
  "details": {
    "missingFields": ["userId", "password"]
  }
}
```

Field rules:

- `success`: always `false`
- `code`: stable machine-readable error code for frontend branching and monitoring
- `error`: user-facing error message safe to display
- `requestId`: request trace id, also returned in `X-Request-Id`
- `timestamp`: backend response time in ISO format
- `details`: optional structured context for recoverable client errors

Typical status mappings:

- `400`: missing or invalid parameters
- `401`: token missing, invalid, expired, revoked, or session invalid
- `403`: forbidden brand scope or HTTPS required in production
- `404`: route not found
- `408`: request timeout
- `429`: rate limited
- `500`: internal server error
- `503`: database unavailable or health check failed

Recommended core error codes:

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Request parameters/body validation failed |
| 400 | `MISSING_USER_ID` | Login request missing `userId` before rate-limit evaluation |
| 401 | `AUTH_TOKEN_MISSING` | Missing bearer token |
| 401 | `AUTH_TOKEN_INVALID_FORMAT` | Authorization header is not `Bearer <token>` |
| 401 | `AUTH_TOKEN_REVOKED` | Access token has been revoked |
| 401 | `AUTH_TOKEN_EXPIRED` | Access token expired |
| 401 | `AUTH_TOKEN_INVALID` | Access token is malformed or unverifiable |
| 401 | `AUTH_REFRESH_TOKEN_MISSING` | Refresh token not provided |
| 401 | `AUTH_REFRESH_TOKEN_INVALID` | Refresh token invalid or expired |
| 401 | `AUTH_INVALID_CREDENTIALS` | Username/password mismatch |
| 401 | `AUTH_USER_INACTIVE` | User no longer valid during refresh |
| 401 | `AUTH_SESSION_INVALID` | Session restore/validate failed |
| 403 | `AUTH_USER_DISABLED` | Account disabled |
| 403 | `HTTPS_REQUIRED` | Production API requires HTTPS |
| 403 | `BRAND_SCOPE_FORBIDDEN` | Requested brand exceeds token scope |
| 403 | `EMPTY_BRAND_SCOPE` | Authenticated account has no accessible brands |
| 404 | `RESOURCE_NOT_FOUND` | Route or resource not found |
| 408 | `REQUEST_TIMEOUT` | Query exceeded timeout budget |
| 429 | `RATE_LIMITED` | General API rate limit hit |
| 429 | `LOGIN_RATE_LIMITED` | Login attempt lock triggered |
| 500 | `INTERNAL_ERROR` | Unexpected backend failure |
| 503 | `DB_UNAVAILABLE` | Oracle dependency unavailable |
| 503 | `HEALTH_CHECK_FAILED` | Health check dependency failed |

## 7. Endpoint Inventory

### 7.1 System

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | No | Health check and database connectivity status |
| GET | `/api/health/redis` | Yes (admin) | Redis health, key namespace metrics, fallback telemetry (supports `?format=prometheus`) |
| GET | `/api/health/redis/metrics` | Yes (admin) | Prometheus scrape format for Redis health and fallback metrics |
| GET | `/api/info` | Yes | API metadata and supported configuration summary |

### 7.2 Auth

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/auth/login` | No | Returns usage hint for browser access |
| POST | `/api/auth/login` | No | User login |
| POST | `/api/auth/refresh` | No | Refresh access token and rotate refresh token |
| POST | `/api/auth/logout` | Yes | Logout and revoke current access token and optional refresh token |
| POST | `/api/auth/validate` | No | Validate session by userId |

### 7.3 Overview

| Method | Path | Auth | Purpose | Main Params |
| --- | --- | --- | --- | --- |
| GET | `/api/overview/kpi` | Yes | KPI summary for overview dashboard | `dateFrom`, `dateTo`, `brand`, `platform`, `selfFlag` |
| GET | `/api/overview/status-flow-analysis` | Yes | Order status flow and exception category summary | `dateFrom`, `dateTo`, `brand`, `platform`, `selfFlag` |
| GET | `/api/overview/flow-analysis` | Yes | Brand x courier x exception flow analysis | `dateFrom`, `dateTo`, `brand`, `platform`, `selfFlag` |

Example response for `GET /api/overview/kpi`:

```json
{
  "success": true,
  "data": {
    "totalOrders": 12846,
    "timeout48hOrders": 412,
    "pickedOrders": 12031,
    "shippedOrders": 11684,
    "deliveredOrders": 10972,
    "forwardedOrders": 164,
    "returnedOrders": 91,
    "cancelledOrders": 37,
    "avgDeliveryHours": 41.27,
    "avgFirstDispatchHours": 7.91,
    "firstDispatchSuccessRate": 86.43,
    "pickedRate": 93.66,
    "shippedRate": 90.96,
    "deliveryRate": 85.42,
    "exceptionRate": 6.38,
    "timeout48hRate": 3.21,
    "momGrowthRates": {
      "totalOrders": 4.82,
      "forwardedOrders": -1.2,
      "returnedOrders": 2.35,
      "cancelledOrders": -8.64,
      "avgDeliveryHours": -3.14,
      "avgFirstDispatchHours": -1.75,
      "firstDispatchSuccessRate": 1.92
    },
    "yoyGrowthRates": {
      "totalOrders": 11.56,
      "forwardedOrders": 6.49,
      "returnedOrders": -4.21,
      "cancelledOrders": -12.08,
      "avgDeliveryHours": -7.04,
      "avgFirstDispatchHours": -5.33,
      "firstDispatchSuccessRate": 3.46
    },
    "historicalData": {
      "lastMonth": {
        "totalOrders": 12254,
        "forwardedOrders": 166,
        "returnedOrders": 89,
        "cancelledOrders": 41,
        "avgDeliveryHours": 42.61,
        "avgFirstDispatchHours": 8.05,
        "firstDispatchSuccessRate": 84.8,
        "statusDistribution": [
          { "statusCode": 40, "orderCount": 166 },
          { "statusCode": 100, "orderCount": 89 },
          { "statusCode": 90, "orderCount": 41 }
        ],
        "performanceMetrics": {
          "avgDeliveryHours": 42.61,
          "avgFirstDispatchHours": 8.05,
          "firstDispatchSuccessRate": 84.8
        }
      },
      "lastYear": {
        "totalOrders": 11515,
        "forwardedOrders": 154,
        "returnedOrders": 95,
        "cancelledOrders": 42,
        "avgDeliveryHours": 44.39,
        "avgFirstDispatchHours": 8.36,
        "firstDispatchSuccessRate": 83.54,
        "statusDistribution": [
          { "statusCode": 40, "orderCount": 154 },
          { "statusCode": 100, "orderCount": 95 },
          { "statusCode": 90, "orderCount": 42 }
        ],
        "performanceMetrics": {
          "avgDeliveryHours": 44.39,
          "avgFirstDispatchHours": 8.36,
          "firstDispatchSuccessRate": 83.54
        }
      }
    }
  },
  "filters": {
    "dateFrom": "2026-03-01",
    "dateTo": "2026-03-31",
    "brand": "all",
    "platform": "all",
    "selfFlag": "Y"
  },
  "timestamp": "2026-04-03T10:20:30.000Z"
}
```

### 7.4 Regional

| Method | Path | Auth | Purpose | Main Params |
| --- | --- | --- | --- | --- |
| GET | `/api/regional/provinces` | Yes | Province distribution summary | `dateFrom`, `dateTo`, `brand`, `selfFlag` |
| GET | `/api/regional/cities` | Yes | City distribution ranking | `dateFrom`, `dateTo`, `brand`, `province`, `selfFlag` |

### 7.5 Trends

| Method | Path | Auth | Purpose | Main Params |
| --- | --- | --- | --- | --- |
| GET | `/api/trends/orders` | Yes | Order trend time series | `dateFrom`, `dateTo`, `brand`, `granularity`, `selfFlag` |
| GET | `/api/trends/performance` | Yes | Performance metric trend | `dateFrom`, `dateTo`, `brand`, `metric`, `selfFlag` |

Supported values:

- `granularity`: `day`, `week`, `month`
- `metric`: `delivery_rate`, `exception_rate`, `avg_delivery_time`, `first_dispatch_success_rate`

### 7.6 Logistics

| Method | Path | Auth | Purpose | Main Params |
| --- | --- | --- | --- | --- |
| GET | `/api/logistics/brands` | Yes | Brand-level logistics exception stats | `dateFrom`, `dateTo`, `brand`, `platform`, `selfFlag` |
| GET | `/api/logistics/couriers` | Yes | Courier performance statistics | `dateFrom`, `dateTo`, `brand`, `platform`, `selfFlag` |
| GET | `/api/logistics/status-distribution` | Yes | Logistics status distribution | `dateFrom`, `dateTo`, `brand`, `platform`, `selfFlag` |
| GET | `/api/logistics/weight-distribution` | Yes | Weight distribution analysis | `dateFrom`, `dateTo`, `brand`, `platform`, `selfFlag` |
| GET | `/api/logistics/forwarding` | Yes | Forwarding analysis | `startDate`, `endDate`, `brand`, `platform`, `selfFlag` |
| GET | `/api/logistics/interception` | Yes | Interception analysis | `startDate`, `endDate`, `brand`, `platform`, `selfFlag`, `interceptionStatus`, `interceptLocation` |
| GET | `/api/logistics/order-details/export` | Yes | Nested export route mounted via logistics router | Same as order details export |

Example response for `GET /api/logistics/couriers`:

```json
{
  "success": true,
  "data": [
    {
      "carrierId": "ZTO",
      "orderCount": 4620,
      "pickedCount": 4388,
      "shippedCount": 4277,
      "deliveredCount": 4015,
      "forwardedCount": 51,
      "returnedCount": 22,
      "cancelledCount": 14,
      "pickupTimeout": 63,
      "shippingTimeout": 41,
      "deliveryTimeout": 56,
      "noUpdate48h": 108,
      "exceptionCount": 268,
      "avgDeliveryTime": 39.82,
      "pickupRate": 94.98,
      "shippingRate": 92.58,
      "deliveryRate": 86.9,
      "exceptionRate": 5.8,
      "totalOrders": 4620,
      "pickedOrders": 4388,
      "shippedOrders": 4277,
      "deliveredOrders": 4015,
      "exceptionOrders": 268,
      "avgDeliveryHours": 39.82,
      "pickup_timeout": 63,
      "shipping_timeout": 41,
      "delivery_timeout": 56,
      "no_update_48h": 108,
      "timeout48hOrders": 108,
      "notPickedOver2h": 63,
      "notShippedOver12h": 41,
      "notUpdatedOver48h": 108,
      "notDeliveredOver3days": 56
    },
    {
      "carrierId": "SF",
      "orderCount": 3184,
      "pickedCount": 3050,
      "shippedCount": 2998,
      "deliveredCount": 2864,
      "forwardedCount": 19,
      "returnedCount": 15,
      "cancelledCount": 7,
      "pickupTimeout": 21,
      "shippingTimeout": 16,
      "deliveryTimeout": 22,
      "noUpdate48h": 34,
      "exceptionCount": 93,
      "avgDeliveryTime": 28.45,
      "pickupRate": 95.79,
      "shippingRate": 94.16,
      "deliveryRate": 89.95,
      "exceptionRate": 2.92
    }
  ],
  "filters": {
    "dateFrom": "2026-03-01",
    "dateTo": "2026-03-31",
    "brand": "all",
    "platform": "all",
    "selfFlag": "Y"
  },
  "timestamp": "2026-04-03T10:22:10.000Z"
}
```

### 7.7 Order Details Export

| Method | Path | Auth | Purpose | Main Params |
| --- | --- | --- | --- | --- |
| GET | `/api/order-details/export` | Yes | Export raw order details for Excel/reporting | `startDate`, `endDate`, `brand`, `platform`, `selfFlag`, `limit`, `offset` |

Notes:

- `limit`: 1 to 50000
- `offset`: 0 to 1000000
- Backend validates date order, integer ranges, and token brand scope

### 7.8 Exception Analysis

| Method | Path | Auth | Purpose | Main Params |
| --- | --- | --- | --- | --- |
| GET | `/api/exception-analysis/overview` | Yes | Exception overview by responsibility, carrier, reason | `dateFrom`, `dateTo`, `brand`, `platform`, `selfFlag` |
| GET | `/api/exception-analysis/carrier/:carrierName` | Yes | Detailed exception reasons for a specific carrier | `dateFrom`, `dateTo`, `brand`, `platform`, `selfFlag` |

Example response for `GET /api/exception-analysis/overview`:

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalExceptions": 428,
      "totalCarriers": 9,
      "totalResponsibilityTypes": 4,
      "totalReasonTypes": 18,
      "carrierResponsibilityCount": 271,
      "otherResponsibilityCount": 157,
      "carrierResponsibilityPercentage": 63.32,
      "otherResponsibilityPercentage": 36.68
    },
    "byResponsibility": [
      {
        "responsibility": "快递责任",
        "exceptionCount": 271,
        "percentage": 63.32,
        "affectedCarriers": 9,
        "reasonTypes": 10
      },
      {
        "responsibility": "仓库责任",
        "exceptionCount": 94,
        "percentage": 21.96,
        "affectedCarriers": 6,
        "reasonTypes": 5
      }
    ],
    "byCarrier": [
      {
        "carrierName": "中通",
        "exceptionCount": 156,
        "percentage": 36.45,
        "responsibilityTypes": 4,
        "reasonTypes": 9,
        "carrierFaultCount": 101,
        "otherFaultCount": 55
      },
      {
        "carrierName": "顺丰",
        "exceptionCount": 92,
        "percentage": 21.5,
        "responsibilityTypes": 3,
        "reasonTypes": 7,
        "carrierFaultCount": 61,
        "otherFaultCount": 31
      }
    ],
    "byReason": [
      {
        "reasonName": "超48小时未更新",
        "responsibility": "快递责任",
        "exceptionCount": 118,
        "percentage": 27.57,
        "affectedCarriers": 8
      },
      {
        "reasonName": "超时未签收",
        "responsibility": "快递责任",
        "exceptionCount": 74,
        "percentage": 17.29,
        "affectedCarriers": 7
      }
    ],
    "crossAnalysis": [
      {
        "carrierName": "中通",
        "responsibility": "快递责任",
        "reasonName": "超48小时未更新",
        "exceptionCount": 46,
        "carrierPercentage": 29.49
      },
      {
        "carrierName": "中通",
        "responsibility": "仓库责任",
        "reasonName": "出库延迟",
        "exceptionCount": 22,
        "carrierPercentage": 14.1
      }
    ]
  },
  "filters": {
    "dateFrom": "2026-03-01",
    "dateTo": "2026-03-31",
    "brand": "all",
    "platform": "all",
    "selfFlag": "all"
  },
  "timestamp": "2026-04-03T10:26:40.000Z"
}
```

### 7.9 Upload and Timeliness

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/upload/timeliness-excel` | Yes | Upload and parse timeliness Excel file |
| GET | `/api/upload/history` | Yes | Upload history |
| GET | `/api/upload/city-mapping` | Yes | City mapping lookup |
| GET | `/api/upload/dest-city-lookup` | Yes | Resolve DEST_CITY codes |
| POST | `/api/upload/validate-format` | Yes | Validate uploaded Excel format |
| POST | `/api/upload/analyze-timeliness` | Yes | Run timeliness analysis |
| GET | `/api/upload/sla-matching-status` | Yes | SLA matching coverage summary |
| POST | `/api/upload/save-to-file` | Yes | Save parsed timeliness data to file storage |
| GET | `/api/upload/file-history` | Yes | Stored timeliness file history |
| POST | `/api/upload/set-active-version` | Yes | Set active timeliness file version |
| DELETE | `/api/upload/file/:fileId` | Yes | Delete stored timeliness file |
| GET | `/api/upload/file-statistics` | Yes | Timeliness file statistics |
| POST | `/api/upload/load-default-timeliness` | Yes | Auto-load preloaded timeliness Excel file |
| POST | `/api/upload/export-timeliness-rawdata` | Yes | Export raw timeliness analysis data |

Important upload request patterns:

#### Upload timeliness Excel

- Method: `POST /api/upload/timeliness-excel`
- Content-Type: `multipart/form-data`
- Form fields:
  - `file`: Excel file
  - `type`: optional business type
  - `brand`: optional preferred brand

#### Analyze timeliness

- Method: `POST /api/upload/analyze-timeliness`
- Content-Type: `application/json`

Request body:

```json
{
  "dateRange": {
    "from": "2026-03-01",
    "to": "2026-03-31"
  },
  "selectedBrand": "DICKIES",
  "selectedSelfFlag": "Y",
  "selectedCarrier": null,
  "analysisType": "S2D"
}
```

Example response for `POST /api/upload/analyze-timeliness`:

```json
{
  "success": true,
  "message": "时效分析计算完成",
  "data": {
    "s2dAnalysis": {
      "brandStats": {
        "DICKIES": {
          "brandCode": "DICKIES",
          "actualTotal": 1824,
          "plan24h": 620,
          "plan48h": 711,
          "plan72h": 312,
          "planOver72h": 181,
          "actual24h": 598,
          "actual48h": 734,
          "actual72h": 301,
          "actualOver72h": 191,
          "achievementRate": 92.4,
          "total": 1824,
          "actualCategories": {
            "24H": 598,
            "48H": 734,
            "72H": 301,
            "72H+": 191
          },
          "planCategories": {
            "24H": 620,
            "48H": 711,
            "72H": 312,
            "72H+": 181
          },
          "avgActualHours": 43.18,
          "avgPlanHours": 41.72
        }
      },
      "carrierStats": {
        "ZTO": {
          "carrierId": "ZTO",
          "actualTotal": 2215,
          "actual24h": 744,
          "actual48h": 913,
          "actual72h": 336,
          "actualOver72h": 222,
          "total": 2215,
          "actualCategories": {
            "24H": 744,
            "48H": 913,
            "72H": 336,
            "72H+": 222
          },
          "planCategories": {
            "24H": 770,
            "48H": 880,
            "72H": 352,
            "72H+": 213
          },
          "avgActualHours": 40.56,
          "avgPlanHours": 39.77
        }
      },
      "brandCarrierStats": {
        "DICKIES|ZTO": {
          "brandCode": "DICKIES",
          "carrierId": "ZTO",
          "actualTotal": 862,
          "actual24h": 302,
          "actual48h": 341,
          "actual72h": 131,
          "actualOver72h": 88,
          "total": 862,
          "actualCategories": {
            "24H": 302,
            "48H": 341,
            "72H": 131,
            "72H+": 88
          },
          "planCategories": {
            "24H": 318,
            "48H": 329,
            "72H": 126,
            "72H+": 89
          },
          "avgActualHours": 41.03,
          "avgPlanHours": 39.95
        }
      },
      "categories": {
        "24H": { "actualCount": 2318, "planCount": 2394 },
        "48H": { "actualCount": 3197, "planCount": 3110 },
        "72H": { "actualCount": 1274, "planCount": 1302 },
        "72H+": { "actualCount": 886, "planCount": 869 }
      },
      "totalS2DOrders": 7675,
      "avgS2DTime": 41.83,
      "achievementRate": 93.17
    },
    "raw": {
      "byBrand": [],
      "byCourier": [],
      "byBrandCourier": [],
      "actualStats": {
        "total": 7675,
        "within24h": 2318,
        "within48h": 3197,
        "within72h": 1274,
        "over72h": 886
      },
      "planStats": {
        "within24h": 2394,
        "within48h": 3110,
        "within72h": 1302,
        "over72h": 869
      },
      "avgS2DTime": 41.83,
      "achievementRate": 93.17
    }
  },
  "timestamp": "2026-04-03T10:24:20.000Z"
}
```

### 7.10 Diagnostic

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/diagnostic/bas-area` | Yes | Full BAS_AREA diagnostics |
| GET | `/api/diagnostic/bas-area/simple` | Yes | Simple BAS_AREA data dump |

说明：这些接口主要用于排障和数据检查，不建议向普通业务用户暴露。

## 8. Security and Deployment Notes

- Production can enforce HTTPS and HSTS through backend configuration
- JWT secret and refresh secret must come from environment variables
- Protected endpoints rely on token authorization scope
- Logout revokes current access token in backend memory
- `/api/info` is protected and intentionally reduced in production disclosure

Relevant production variables:

- `NODE_ENV=production`
- `FORCE_HTTPS=true`
- `HTTPS_REDIRECT=false`
- `TRUST_PROXY=1`
- `HSTS_MAX_AGE=31536000`
- `HSTS_INCLUDE_SUBDOMAINS=true`
- `HSTS_PRELOAD=true`

## 9. Known Documentation Limits

- This guide documents the active CommonJS backend only
- It does not treat `src/backend/src/server.js` as the active runtime
- Some response payloads are large and highly business-specific; examples above keep only stable top-level fields
- If a route behavior changes, update this file together with the route implementation