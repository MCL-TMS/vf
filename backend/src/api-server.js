/**
 * VF物流数据分析平台 - API服务器
 * 
 * 提供RESTful API服务，支持Oracle数据库连接
 * 为前端React应用提供数据接口
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const dotenv = require('dotenv');

// 优先加载 backend 根目录 .env；随后兜底当前工作目录 .env。
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { randomUUID } = require('crypto');
const { testConnection, initializeDatabase } = require('./config/database-api');
const { ERROR_CODES, normalizeError, sendError } = require('./utils/apiError');
const { getRedisStatus, getRedisKeyPrefix } = require('./utils/redisStore');

// 路由导入
const overviewRoutes = require('./routes/overview');
const regionalRoutes = require('./routes/regional');
const trendsRoutes = require('./routes/trends-esm');
const logisticsRoutes = require('./routes/logistics');
const weightAnalysisRoutes = require('./routes/weight-analysis-esm');
const uploadRoutes = require('./routes/upload-commonjs');
const diagnosticRoutes = require('./routes/bas-area-diagnostic');
const authRoutes = require('./routes/auth'); // 新增认证路由
const brandsRoutes = require('./routes/brands');
const platformRoutes = require('./routes/platforms');
const orderDetailsRoutes = require('./routes/order-details'); // 🔥 订单明细导出路由
const exceptionAnalysisRoutes = require('./routes/exception-analysis'); // 🔥 异常监控分析路由
const { verifyToken } = require('./middleware/authMiddleware');
const { globalRateLimiter } = require('./middleware/rateLimitMiddleware');

// 🔍 调试：检查 authRoutes 是否正确导入
console.log('🔍 调试信息:');
console.log('   authRoutes 类型:', typeof authRoutes);
console.log('   authRoutes 是否为 undefined:', authRoutes === undefined);
console.log('   authRoutes 是否为 null:', authRoutes === null);
if (authRoutes && authRoutes.stack) {
  console.log('   authRoutes 路由数量:', authRoutes.stack.length);
}

const app = express();
const PORT = process.env.API_PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const BACKEND_HTTPS_ENABLED = process.env.BACKEND_HTTPS_ENABLED === 'true';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '/etc/nginx/ssl/fullchain.crt';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || '/etc/nginx/ssl/cms-dashboard.ocf.fulfillment.maersk.com.cn.key';
let httpServer = null;

const logsDir = path.resolve(__dirname, '../logs');
const LOG_RETENTION_DAYS = Number.parseInt(process.env.LOG_RETENTION_DAYS || '30', 10);

try {
  fs.mkdirSync(logsDir, { recursive: true });
} catch (error) {
  console.error('初始化日志目录失败:', error.message);
}

function appendRequestLog(line) {
  const requestLogFile = path.join(logsDir, `api-requests-${getDateString(new Date())}.log`);
  fs.promises.appendFile(requestLogFile, `${line}\n`, 'utf8').catch((error) => {
    console.error('写入请求日志失败:', error.message);
  });
}

function getDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function purgeExpiredRequestLogs() {
  if (!Number.isFinite(LOG_RETENTION_DAYS) || LOG_RETENTION_DAYS <= 0) {
    return;
  }

  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  fs.promises.readdir(logsDir).then((files) => {
    const dailyLogRegex = /^api-requests-(\d{4}-\d{2}-\d{2})\.log$/;

    files.forEach((fileName) => {
      const match = fileName.match(dailyLogRegex);
      if (!match) {
        return;
      }

      const fileDate = Date.parse(`${match[1]}T00:00:00Z`);
      if (!Number.isFinite(fileDate) || fileDate >= cutoff) {
        return;
      }

      const filePath = path.join(logsDir, fileName);
      fs.promises.unlink(filePath).catch((error) => {
        console.error(`清理过期日志失败: ${fileName}`, error.message);
      });
    });
  }).catch((error) => {
    console.error('扫描日志目录失败:', error.message);
  });
}

purgeExpiredRequestLogs();
const cleanupTimer = setInterval(purgeExpiredRequestLogs, 24 * 60 * 60 * 1000);
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return Boolean(value);
}

function parseTrustProxySetting(value) {
  if (value === undefined || value === null || value === '') {
    return false;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return 1;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
    if (/^\d+$/.test(normalized)) {
      return Number.parseInt(normalized, 10);
    }
    return value.trim();
  }

  return value;
}

function parseCorsOrigins(rawOrigins) {
  if (!rawOrigins) {
    return [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
  }

  return String(rawOrigins)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function sanitizeRedisUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.password) {
      parsedUrl.password = '***';
    }
    return parsedUrl.toString();
  } catch (_error) {
    return url.replace(/:(.*?)@/, ':***@');
  }
}

function toPrometheusLabelValue(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
}

function buildRedisPrometheusMetrics(redisStatus) {
  const env = process.env.NODE_ENV || 'development';
  const service = 'vf_logistics_api';
  const keyPrefix = getRedisKeyPrefix();
  const labels = `service="${toPrometheusLabelValue(service)}",env="${toPrometheusLabelValue(env)}",key_prefix="${toPrometheusLabelValue(keyPrefix)}"`;
  const metrics = redisStatus.metrics || {};
  const fallbackReasons = metrics.fallbackReasons || {};
  const lastFallbackTimestamp = metrics.lastFallbackAt
    ? Date.parse(metrics.lastFallbackAt) / 1000
    : 0;

  return [
    '# HELP vf_logistics_redis_enabled Redis feature flag status (1 enabled, 0 disabled).',
    '# TYPE vf_logistics_redis_enabled gauge',
    `vf_logistics_redis_enabled{${labels}} ${redisStatus.enabled ? 1 : 0}`,
    '# HELP vf_logistics_redis_up Redis connectivity status (1 available, 0 unavailable).',
    '# TYPE vf_logistics_redis_up gauge',
    `vf_logistics_redis_up{${labels}} ${redisStatus.available ? 1 : 0}`,
    '# HELP vf_logistics_redis_fallback_total Total fallback count from Redis to memory.',
    '# TYPE vf_logistics_redis_fallback_total counter',
    `vf_logistics_redis_fallback_total{${labels}} ${metrics.fallbackCount || 0}`,
    '# HELP vf_logistics_redis_fallback_reason_total Fallback count by reason.',
    '# TYPE vf_logistics_redis_fallback_reason_total counter',
    `vf_logistics_redis_fallback_reason_total{${labels},reason="disabled"} ${fallbackReasons.disabled || 0}`,
    `vf_logistics_redis_fallback_reason_total{${labels},reason="connect_failed"} ${fallbackReasons.connectFailed || 0}`,
    `vf_logistics_redis_fallback_reason_total{${labels},reason="error_event"} ${fallbackReasons.errorEvent || 0}`,
    '# HELP vf_logistics_redis_connection_error_total Redis connection error event count.',
    '# TYPE vf_logistics_redis_connection_error_total counter',
    `vf_logistics_redis_connection_error_total{${labels}} ${metrics.connectionErrorCount || 0}`,
    '# HELP vf_logistics_redis_last_fallback_timestamp_seconds Unix timestamp for the last fallback event.',
    '# TYPE vf_logistics_redis_last_fallback_timestamp_seconds gauge',
    `vf_logistics_redis_last_fallback_timestamp_seconds{${labels}} ${Number.isFinite(lastFallbackTimestamp) ? lastFallbackTimestamp : 0}`
  ].join('\n');
}

function ensureAdminForOps(req, res) {
  if (!req.user?.isAdmin) {
    sendError(res, req, {
      status: 403,
      code: ERROR_CODES.AUTH_FAILED,
      error: '仅管理员可访问Redis运维指标'
    });
    return false;
  }

  return true;
}

function handleRedisHealthOps(req, res) {
  if (!ensureAdminForOps(req, res)) {
    return;
  }

  const redisStatus = getRedisStatus();
  const requestedFormat = String(req.query?.format || '').trim().toLowerCase();

  if (requestedFormat === 'prometheus') {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return res.send(buildRedisPrometheusMetrics(redisStatus));
  }

  return res.json({
    success: true,
    status: redisStatus.available ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    redis: {
      enabled: redisStatus.enabled,
      available: redisStatus.available,
      keyPrefix: getRedisKeyPrefix(),
      url: sanitizeRedisUrl(redisStatus.url),
      metrics: redisStatus.metrics
    }
  });
}

/**
 * 中间件配置
 */
const isProduction = process.env.NODE_ENV === 'production';
const forceHttpsEnv = process.env.FORCE_HTTPS ?? process.env.ENFORCE_HTTPS;
const shouldEnforceHttps = parseBooleanEnv(forceHttpsEnv, isProduction);
const shouldRedirectToHttps = isProduction && parseBooleanEnv(process.env.HTTPS_REDIRECT, false);
const trustProxySetting = parseTrustProxySetting(process.env.TRUST_PROXY);
const hstsMaxAge = Number.parseInt(process.env.HSTS_MAX_AGE || '31536000', 10);
const hstsIncludeSubDomains = parseBooleanEnv(process.env.HSTS_INCLUDE_SUBDOMAINS, true);
const hstsPreload = parseBooleanEnv(process.env.HSTS_PRELOAD, true);

if (trustProxySetting !== false) {
  app.set('trust proxy', trustProxySetting);
}

function isSecureRequest(req) {
  if (req.secure || req.protocol === 'https') {
    return true;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    const firstProto = forwardedProto.split(',')[0].trim().toLowerCase();
    if (firstProto === 'https') {
      return true;
    }
  }

  return req.headers['x-forwarded-ssl'] === 'on';
}

function getHttpsRedirectUrl(req) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = (typeof forwardedHost === 'string' && forwardedHost.trim()) || req.headers.host;

  if (!host) {
    return null;
  }

  return `https://${host}${req.originalUrl}`;
}

const helmetConfig = isProduction
  ? {
      // 在生产环境启用内容安全策略，尽量减少 XSS 等风险
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'"],
          "img-src": ["'self'", "data:"],
          "connect-src": ["'self'"],
          "frame-ancestors": ["'self'"]
        }
      },
      strictTransportSecurity: {
        maxAge: Number.isFinite(hstsMaxAge) && hstsMaxAge > 0 ? hstsMaxAge : 31536000,
        includeSubDomains: hstsIncludeSubDomains,
        preload: hstsPreload
      },
      // 如需兼容跨源资源（如 WebAssembly、SharedArrayBuffer），可根据需要调整该配置
      crossOriginEmbedderPolicy: false
    }
  : {
      // 开发环境下放宽 CSP（如需完全禁用可将 contentSecurityPolicy 设为 false）
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'", "*"],
          "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "*"],
          "style-src": ["'self'", "'unsafe-inline'", "*"],
          "img-src": ["'self'", "data:", "*"],
          "connect-src": ["'self'", "*"],
          "frame-ancestors": ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false
    };

app.use(helmet(helmetConfig));
app.disable('x-powered-by');

if (shouldEnforceHttps) {
  app.use((req, res, next) => {
    if (isSecureRequest(req)) {
      return next();
    }

    if (shouldRedirectToHttps) {
      const redirectUrl = getHttpsRedirectUrl(req);
      if (redirectUrl) {
        return res.redirect(308, redirectUrl);
      }
    }

    return sendError(res, req, {
      status: 403,
      code: ERROR_CODES.HTTPS_REQUIRED,
      error: '当前环境仅允许通过 HTTPS 访问 API'
    });
  });
}

app.use(compression()); // 启用Gzip压缩

// CORS配置 - 允许前端域名访问
const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 请求解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${req.requestId}] ${req.method} ${req.path} - ${req.ip}`;
  console.log(logLine);
  appendRequestLog(logLine);
  next();
});

// API速率限制（Redis优先，内存回退）
app.use('/api/', globalRateLimiter);

/**
 * API路由注册
 */
console.log('🔧 注册API路由...');
app.use('/api/auth', authRoutes); // 注册认证路由
console.log('✅ 已注册: /api/auth');
app.use('/api/brands', brandsRoutes); // 品牌映射（无需认证）
console.log('✅ 已注册: /api/brands');
app.use('/api/platform', platformRoutes); // 平台映射（无需认证）
console.log('✅ 已注册: /api/platform');
app.use('/api/overview', verifyToken, overviewRoutes);
console.log('✅ 已注册: /api/overview');
app.use('/api/regional', verifyToken, regionalRoutes);
console.log('✅ 已注册: /api/regional');
app.use('/api/trends', verifyToken, trendsRoutes);
console.log('✅ 已注册: /api/trends');
app.use('/api/logistics', verifyToken, logisticsRoutes);
console.log('✅ 已注册: /api/logistics');
app.use('/api/logistics', verifyToken, weightAnalysisRoutes);
console.log('✅ 已注册: /api/logistics (weight-analysis)');
app.use('/api/upload', verifyToken, uploadRoutes);
console.log('✅ 已注册: /api/upload');
app.use('/api/diagnostic', verifyToken, diagnosticRoutes);
console.log('✅ 已注册: /api/diagnostic');
app.use('/api/order-details', verifyToken, orderDetailsRoutes); // 注册订单明细导出路由
console.log('✅ 已注册: /api/order-details');
app.use('/api/exception-analysis', verifyToken, exceptionAnalysisRoutes); // 注册异常监控分析路由
console.log('✅ 已注册: /api/exception-analysis');
console.log('📋 所有路由注册完成\n');

/**
 * 健康检查端点
 */
app.get('/api/health', async (req, res) => {
  try {
    // 测试数据库连接
    const dbStatus = await testConnection();

    const healthPayload = {
      status: dbStatus ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: dbStatus ? 'connected' : 'disconnected',
      requestId: req.requestId
    };

    if (!isProduction) {
      healthPayload.uptime = process.uptime();
      healthPayload.memory = process.memoryUsage();
      healthPayload.environment = process.env.NODE_ENV || 'development';
    }

    return res.status(dbStatus ? 200 : 503).json(healthPayload);
  } catch (error) {
    console.error('健康检查失败:', error);
    return sendError(res, req, {
      status: 503,
      code: ERROR_CODES.HEALTH_CHECK_FAILED,
      error: '健康检查失败',
      details: isProduction
        ? { database: 'error' }
        : { database: 'error', cause: error.message }
    });
  }
});

/**
 * Redis健康检查与指标（运维）
 */
app.get('/api/health/redis', verifyToken, (req, res) => {
  return handleRedisHealthOps(req, res);
});

/**
 * Redis监控抓取端点（Prometheus）
 */
app.get('/api/health/redis/metrics', verifyToken, (req, res) => {
  req.query.format = 'prometheus';
  return handleRedisHealthOps(req, res);
});

/**
 * API信息端点
 */
app.get('/api/info', verifyToken, (req, res) => {
  const payload = {
    name: 'VF物流数据分析平台API',
    version: '1.0.0',
    description: 'VF物流数据分析平台后端API服务',
    requestId: req.requestId,
    supportedBrands: ['DICKIES', 'TNF', 'ICEBREAKER', 'VANS', 'TIMBERLAND', 'SMARTWOOL'],
    supportedDateFormats: ['YYYY-MM-DD'],
    rateLimits: {
      requests: '1000 per 15 minutes per IP',
      window: '15 minutes'
    }
  };

  if (!isProduction) {
    payload.endpoints = {
      overview: {
        '/api/overview/kpi': '获取总览KPI指标',
        '/api/overview/status-distribution': '获取状态分布统计',
        '/api/overview/exceptions': '获取实时异常监控数据'
      },
      regional: {
        '/api/regional/provinces': '获取省份订单分布数据',
        '/api/regional/cities': '获取城市排名数据',
        '/api/regional/efficiency': '获取地域配送效率分析'
      },
      trends: {
        '/api/trends/orders': '获取订单量趋势数据',
        '/api/trends/brands': '获取品牌趋势对比数据',
        '/api/trends/efficiency': '获取配送效率趋势',
        '/api/trends/platforms': '获取平台趋势数据'
      },
      logistics: {
        '/api/logistics/couriers': '获取快递商性能统计',
        '/api/logistics/weight-distribution': '获取重量分布分析',
        '/api/logistics/nodes': '获取物流节点监控数据'
      },
      upload: {
        '/api/upload/timeliness-excel': '上传时效Excel表格 (POST)',
        '/api/upload/city-mapping': '获取城市映射信息 (GET)',
        '/api/upload/dest-city-lookup': '查询DEST_CITY代码对应城市 (GET)',
        '/api/upload/validate-format': '验证Excel文件格式 (POST)',
        '/api/upload/analyze-timeliness': '执行时效分析计算 (POST)',
        '/api/upload/sla-matching-status': '获取SLA匹配状态 (GET)',
        '/api/upload/history': '获取上传历史记录 (GET)'
      },
      exceptionAnalysis: {
        '/api/exception-analysis/overview': '获取异常监控分析总览 (GET)',
        '/api/exception-analysis/carrier/:name': '获取指定快递商的异常明细 (GET)'
      },
      system: {
        '/api/health': '健康检查',
        '/api/health/redis': 'Redis健康与回退指标（管理员，支持format=prometheus）',
        '/api/health/redis/metrics': 'Redis Prometheus抓取端点（管理员）',
        '/api/info': 'API信息'
      }
    };
    payload.database = {
      type: 'Oracle',
      schema: 'APP_CMS',
      tables: ['TSK_LIST_TASK', 'BAS_CODES', 'DOC_COMPLAINT']
    };
  }

  res.json(payload);
});

/**
 * 404处理
 */
app.use('/api/*', (req, res) => {
  return sendError(res, req, {
    status: 404,
    code: ERROR_CODES.RESOURCE_NOT_FOUND,
    error: `路径 ${req.path} 未找到`
  });
});

/**
 * 全局错误处理中间件
 */
app.use((error, req, res, next) => {
  console.error('API错误:', {
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    message: error.message,
    stack: error.stack
  });

  const normalizedError = normalizeError(error, { isProduction });
  return sendError(res, req, normalizedError);
});

/**
 * 优雅关闭处理
 */
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，开始优雅关闭...');

  if (!httpServer) {
    console.log('HTTP服务器未运行，直接退出');
    process.exit(0);
    return;
  }

  httpServer.close(() => {
    console.log('HTTP服务器已关闭');
    process.exit(0);
  });
  
  // 强制关闭超时
  setTimeout(() => {
    console.error('强制关闭服务器');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，开始优雅关闭...');
  process.exit(0);
});

/**
 * 启动服务器
 */
async function startServer() {
  try {
    // ✅ 初始化数据库连接池
    console.log('================================================================================');
    console.log('🔧 正在初始化数据库连接池...');
    await initializeDatabase();
    
    // 测试数据库连接
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.warn('⚠️  数据库连接失败，API服务器将在有限功能模式下启动');
    } else {
      console.log('✅ 数据库连接成功');
    }
    console.log('================================================================================');
    
    const serverOptions = BACKEND_HTTPS_ENABLED
      ? {
          key: fs.readFileSync(SSL_KEY_PATH),
          cert: fs.readFileSync(SSL_CERT_PATH)
        }
      : undefined;
    const createServer = BACKEND_HTTPS_ENABLED
      ? https.createServer
      : (options, handler) => require('http').createServer(handler);
    httpServer = createServer(serverOptions, app).listen(PORT, HOST, () => {
      console.log('🚀 VF物流数据分析平台API服务器启动成功');
      const protocol = BACKEND_HTTPS_ENABLED ? 'https' : 'http';
      console.log(`📡 监听地址: ${protocol}://${HOST}:${PORT}`);
      console.log(`📊 API文档: ${protocol}://${HOST}:${PORT}/api/info`);
      console.log(`🔒 HTTPS强制: ${shouldEnforceHttps ? 'enabled' : 'disabled'}`);
      console.log(`🔀 HTTPS重定向: ${shouldRedirectToHttps ? 'enabled' : 'disabled'}`);
      console.log(`🛡️ HSTS: max-age=${Number.isFinite(hstsMaxAge) && hstsMaxAge > 0 ? hstsMaxAge : 31536000}; includeSubDomains=${hstsIncludeSubDomains}; preload=${hstsPreload}`);
      console.log(`🌐 trust proxy: ${trustProxySetting === false ? 'disabled' : trustProxySetting}`);
      console.log(`🌍 CORS Origins: ${allowedOrigins.join(', ')}`);
      console.log(`💓 健康检查: ${protocol}://${HOST}:${PORT}/api/health`);
      console.log(`🔍 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📦 版本: 1.0.0`);
      console.log('================================================================================');
    });

    httpServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${PORT} 已被占用，请检查是否有其他服务正在运行`);
      } else {
        console.error('❌ 服务器启动失败:', error);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ 启动服务器时发生错误:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  startServer();
}

module.exports = app;