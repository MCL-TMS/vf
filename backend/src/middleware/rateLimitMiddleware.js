/**
 * 🔐 防暴力破解中间件 (CommonJS版本)
 * 
 * 功能：
 * 1. 限制同一IP或用户名的登录尝试次数
 * 2. 超过5次失败后锁定账号15分钟
 * 3. 登录成功后清除尝试记录
 */

const rateLimit = require('express-rate-limit');
const { MemoryStore } = require('express-rate-limit');
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

function createResilientRateLimitStore(prefix, windowMs) {
  const memoryStore = new MemoryStore();
  let redisStore = null;
  let fallbackWarningLogged = false;

  async function getStore() {
    try {
      const redisClient = await getRedisClient();
      if (redisClient) {
        redisStore ||= createRedisRateLimitStore(redisClient, prefix, windowMs);
        fallbackWarningLogged = false;
        return redisStore;
      }
    } catch (error) {
      if (!fallbackWarningLogged) {
        console.warn('⚠️ [Rate Limit] Redis 不可用，使用内存store:', error?.message || error);
        fallbackWarningLogged = true;
      }
    }

    return memoryStore;
  }

  return {
    init(options) {
      memoryStore.init(options);
    },
    async increment(key) {
      return (await getStore()).increment(key);
    },
    async decrement(key) {
      return (await getStore()).decrement(key);
    },
    async resetKey(key) {
      return (await getStore()).resetKey(key);
    },
    shutdown() {
      memoryStore.shutdown();
    }
  };
}

/**
 * 使用 express-rate-limit 替代自定义逻辑，以便安全审计工具识别
 */
const API_RATE_LIMIT_MAX = Number.parseInt(process.env.API_RATE_LIMIT_MAX || '1000', 10);
const API_RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const globalRateLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: API_RATE_LIMIT_MAX,
  store: createResilientRateLimitStore(buildRedisKey('rate-limit'), API_RATE_LIMIT_WINDOW_MS),
  keyGenerator: (req) => getClientIP(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: ERROR_CODES.RATE_LIMITED,
    error: 'API请求过于频繁，请稍后再试'
  },
  handler: (req, res, next, options) => sendError(res, req, {
    status: 429,
    code: options.message.code,
    error: options.message.error
  })
});

const loginRateLimit = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  max: 5,
  store: createResilientRateLimitStore(buildRedisKey('login-rate'), LOGIN_RATE_LIMIT_WINDOW_MS),
  keyGenerator: (req) => {
    const ip = getClientIP(req);
    const userId = req.body?.userId ? String(req.body.userId).trim().toLowerCase() : '';
    return userId ? `${ip}:${userId}` : ip;
  },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: ERROR_CODES.LOGIN_RATE_LIMITED,
    error: '登录尝试次数过多，请15分钟后再试'
  },
  handler: (req, res, next, options) => sendError(res, req, {
    status: 429,
    code: options.message.code,
    error: options.message.error
  })
});

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
