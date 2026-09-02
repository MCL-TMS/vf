/**
 * 🔐 防暴力破解中间件 (CommonJS版本)
 * 
 * 功能：
 * 1. 限制同一IP或用户名的登录尝试次数
 * 2. 超过5次失败后锁定账号15分钟
 * 3. 登录成功后清除尝试记录
 */

const rateLimit = require('express-rate-limit');
const { ERROR_CODES, sendError } = require('../utils/apiError');
const { getRedisClient, buildRedisKey } = require('../utils/redisStore');
function normalizeRedisReply(value) {
  // ioredis-like pipeline replies may be [err, value]
  if (Array.isArray(value) && value.length >= 2) {
    return value[1];
  }

  return value;
}

function createRedisRateLimitStore(redisClient, prefix, windowMs) {
  if (!redisClient) {
    return null;
  }

  const keyPrefix = prefix.endsWith(':') ? prefix : `${prefix}:`;

  return {
    async increment(key) {
      const redisKey = `${keyPrefix}${key}`;

      const replies = await redisClient.multi()
        .incr(redisKey)
        .pTTL(redisKey)
        .exec();

      const totalHits = Number(normalizeRedisReply(replies?.[0]) || 0);
      let ttlMs = Number(normalizeRedisReply(replies?.[1]) || -1);

      // If key is new or has no ttl, attach current limiter window ttl.
      if (ttlMs < 0) {
        await redisClient.pExpire(redisKey, windowMs);
        ttlMs = windowMs;
      }

      return {
        totalHits,
        resetTime: new Date(Date.now() + ttlMs)
      };
    },

    async decrement(key) {
      const redisKey = `${keyPrefix}${key}`;
      const replies = await redisClient.multi()
        .decr(redisKey)
        .pTTL(redisKey)
        .exec();

      const ttlMs = Number(normalizeRedisReply(replies?.[1]) || -1);
      if (ttlMs < 0) {
        await redisClient.pExpire(redisKey, windowMs);
      }
    },

    async resetKey(key) {
      const redisKey = `${keyPrefix}${key}`;
      await redisClient.del(redisKey);
    }
  };
}

/**
 * 使用 express-rate-limit 替代自定义逻辑，以便安全审计工具识别
 */
// We'll lazily create rate-limit middlewares so we can attach a Redis-backed store
// when Redis is available. The wrapper functions below initialise the real
// limiter once and then forward requests to it.

let _globalLimiter = null;
let _globalInitPromise = null;

async function _initGlobalLimiter() {
  if (_globalLimiter) return _globalLimiter;

  const opts = {
    windowMs: Number.parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10),
    max: Number.parseInt(process.env.API_RATE_LIMIT_MAX || '1000', 10),
    // Use explicit client IP extraction to avoid depending solely on Express' trust proxy
    keyGenerator: (req /*, res*/) => getClientIP(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      code: ERROR_CODES.RATE_LIMITED,
      error: 'API请求过于频繁，请稍后再试'
    },
    handler: (req, res, next, options) => {
      return sendError(res, req, {
        status: 429,
        code: options.message.code,
        error: options.message.error
      });
    }
  };

  try {
    const redisClient = await getRedisClient();
    if (redisClient) {
      const store = createRedisRateLimitStore(redisClient, buildRedisKey('rate-limit'), opts.windowMs);
      if (store) {
        opts.store = store;
        console.log('✅ [Rate Limit] 使用 Redis-backed store');
      }
    }
  } catch (err) {
    console.warn('⚠️ [Rate Limit] Redis store 初始化失败，回退到内存store', err?.message || err);
  }

  _globalLimiter = rateLimit(opts);
  return _globalLimiter;
}

function globalRateLimiter(req, res, next) {
  if (!_globalInitPromise) {
    _globalInitPromise = _initGlobalLimiter();
  }

  _globalInitPromise.then((limiter) => limiter(req, res, next)).catch((err) => {
    console.error('[Rate Limit] 初始化失败，忽略限流:', err?.message || err);
    next();
  });
}

let _loginLimiter = null;
let _loginInitPromise = null;

async function _initLoginLimiter() {
  if (_loginLimiter) return _loginLimiter;

  const opts = {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 5, // 5次尝试
    // For login attempts we combine client IP and provided userId (if any)
    keyGenerator: (req /*, res*/) => {
      const ip = getClientIP(req);
      const userId = (req.body && req.body.userId) ? String(req.body.userId).trim().toLowerCase() : '';
      return userId ? `${ip}:${userId}` : ip;
    },
    // Do not count successful (e.g. 200) login requests toward the limit
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      code: ERROR_CODES.LOGIN_RATE_LIMITED,
      error: '登录尝试次数过多，请15分钟后再试'
    },
    handler: (req, res, next, options) => {
      return sendError(res, req, {
        status: 429,
        code: options.message.code,
        error: options.message.error
      });
    }
  };

  try {
    const redisClient = await getRedisClient();
    if (redisClient) {
      const store = createRedisRateLimitStore(redisClient, buildRedisKey('login-rate'), opts.windowMs);
      if (store) {
        opts.store = store;
        console.log('✅ [Rate Limit] 登录速率限制使用 Redis-backed store');
      }
    }
  } catch (err) {
    console.warn('⚠️ [Rate Limit] 登录 Redis store 初始化失败，回退到内存store', err?.message || err);
  }

  _loginLimiter = rateLimit(opts);
  return _loginLimiter;
}

function loginRateLimit(req, res, next) {
  if (!_loginInitPromise) {
    _loginInitPromise = _initLoginLimiter();
  }

  _loginInitPromise.then((limiter) => limiter(req, res, next)).catch((err) => {
    console.error('[Rate Limit] 登录限流初始化失败，忽略限流:', err?.message || err);
    next();
  });
}

const API_RATE_LIMIT_MAX = Number.parseInt(process.env.API_RATE_LIMIT_MAX || '1000', 10);
const API_RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);

/**
 * 获取客户端真实IP地址
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * 清除登录尝试记录（登录成功后调用）
 * ⚠️ 保留此函数以兼容已有的业务逻辑，虽然现在主路由由 express-rate-limit 处理请求限流
 */
async function clearAttempts(ip, userId, reason = '登录成功') {
  console.log(`✅ [Rate Limit] ${ip}:${userId} ${reason}`);
}

module.exports = {
  loginRateLimit,
  clearAttempts,
  globalRateLimiter,
  API_RATE_LIMIT_MAX,
  API_RATE_LIMIT_WINDOW_MS
};
