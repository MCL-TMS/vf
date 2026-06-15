/**
 * 🔐 防暴力破解中间件 (CommonJS版本)
 * 
 * 功能：
 * 1. 限制同一IP或用户名的登录尝试次数
 * 2. 超过5次失败后锁定账号15分钟
 * 3. 登录成功后清除尝试记录
 */

const { ERROR_CODES, sendError } = require('../utils/apiError');
const { getRedisClient, buildRedisKey } = require('../utils/redisStore');

/**
 * 登录尝试记录存储
 * Key: `${ip}:${userId}`
 * Value: { count: number, lockedUntil: Date | null }
 */
const loginAttempts = new Map();

/**
 * 最大尝试次数配置
 */
const MAX_ATTEMPTS = Number.parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
const LOCK_TIME = Number.parseInt(process.env.LOGIN_LOCK_TIME || `${15 * 60 * 1000}`, 10);
const API_RATE_LIMIT_MAX = Number.parseInt(process.env.API_RATE_LIMIT_MAX || '1000', 10);
const API_RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);
const globalRequestCounters = new Map();

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
 * 获取尝试记录的Key
 */
function getAttemptKey(ip, userId) {
  return `${ip}:${userId}`;
}

/**
 * 检查并记录登录尝试
 * 
 * @param {string} ip - 客户端IP
 * @param {string} userId - 用户名
 * @returns {{ blocked: boolean, remainingTime?: number }}
 */
function cleanupExpiredAttempts() {
  const now = Date.now();

  for (const [key, record] of loginAttempts.entries()) {
    if (record.lockedUntil && record.lockedUntil.getTime() <= now) {
      loginAttempts.delete(key);
    }
  }
}

async function loadAttemptRecord(key) {
  const redisClient = await getRedisClient();

  if (redisClient) {
    const rawRecord = await redisClient.get(buildRedisKey('login-attempt', key));
    if (!rawRecord) {
      return { source: 'redis', record: { count: 0, lockedUntil: null } };
    }

    const parsed = JSON.parse(rawRecord);
    return {
      source: 'redis',
      record: {
        count: parsed.count || 0,
        lockedUntil: parsed.lockedUntil ? new Date(parsed.lockedUntil) : null
      }
    };
  }

  cleanupExpiredAttempts();
  return {
    source: 'memory',
    record: loginAttempts.get(key) || { count: 0, lockedUntil: null }
  };
}

async function saveAttemptRecord(key, source, record) {
  const ttlSeconds = Math.max(60, Math.ceil(LOCK_TIME / 1000));

  if (source === 'redis') {
    const redisClient = await getRedisClient();
    if (redisClient) {
      await redisClient.set(
        buildRedisKey('login-attempt', key),
        JSON.stringify({
          count: record.count,
          lockedUntil: record.lockedUntil ? record.lockedUntil.toISOString() : null
        }),
        { EX: ttlSeconds }
      );
      return;
    }
  }

  loginAttempts.set(key, record);
}

async function deleteAttemptRecord(key) {
  const redisClient = await getRedisClient();

  if (redisClient) {
    await redisClient.del(buildRedisKey('login-attempt', key));
    return;
  }

  loginAttempts.delete(key);
}

function cleanupExpiredGlobalCounters() {
  const now = Date.now();

  for (const [key, record] of globalRequestCounters.entries()) {
    if (!record || record.resetAt <= now) {
      globalRequestCounters.delete(key);
    }
  }
}

async function incrementGlobalCounter(ip) {
  const key = buildRedisKey('api-rate-limit', ip);
  const windowSeconds = Math.max(1, Math.ceil(API_RATE_LIMIT_WINDOW_MS / 1000));
  const redisClient = await getRedisClient();

  if (redisClient) {
    const count = await redisClient.incr(key);
    let ttl = await redisClient.ttl(key);

    if (ttl < 0) {
      await redisClient.expire(key, windowSeconds);
      ttl = windowSeconds;
    }

    return {
      count,
      remainingSeconds: ttl,
      resetAt: Date.now() + (ttl * 1000)
    };
  }

  cleanupExpiredGlobalCounters();

  const now = Date.now();
  let record = globalRequestCounters.get(key);

  if (!record || record.resetAt <= now) {
    record = {
      count: 0,
      resetAt: now + API_RATE_LIMIT_WINDOW_MS
    };
  }

  record.count += 1;
  globalRequestCounters.set(key, record);

  return {
    count: record.count,
    remainingSeconds: Math.max(0, Math.ceil((record.resetAt - now) / 1000)),
    resetAt: record.resetAt
  };
}

async function checkLoginAttempt(ip, userId) {
  const key = getAttemptKey(ip, userId);
  const now = new Date();
  const { source, record } = await loadAttemptRecord(key);
  
  // 检查是否在锁定期内
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingTime = Math.ceil((record.lockedUntil - now) / 60000); // 转换为分钟
    console.log(`🔒 [Rate Limit] ${key} 账号已锁定，剩余时间: ${remainingTime}分钟`);
    return { blocked: true, remainingTime };
  }
  
  // 锁定时间已过，重置计数
  if (record.lockedUntil && record.lockedUntil <= now) {
    console.log(`🔓 [Rate Limit] ${key} 锁定时间已过，重置计数`);
    record.count = 0;
    record.lockedUntil = null;
  }
  
  // 增加尝试次数
  record.count++;
  console.log(`📊 [Rate Limit] ${key} 登录尝试: ${record.count}/${MAX_ATTEMPTS}`);
  
  // 检查是否超过最大尝试次数
  if (record.count > MAX_ATTEMPTS) {
    record.lockedUntil = new Date(now.getTime() + LOCK_TIME);
    console.log(`🔒 [Rate Limit] ${key} 超过最大登录尝试次数，锁定至: ${record.lockedUntil.toLocaleString('zh-CN')}`);
    await saveAttemptRecord(key, source, record);
    return { blocked: true, remainingTime: Math.ceil(LOCK_TIME / 60000) };
  }

  await saveAttemptRecord(key, source, record);
  
  return { blocked: false };
}

/**
 * 清除登录尝试记录（登录成功后调用）
 * 
 * @param {string} ip - 客户端IP
 * @param {string} userId - 用户名
 */
async function clearAttempts(ip, userId, reason = '登录成功') {
  const key = getAttemptKey(ip, userId);
  await deleteAttemptRecord(key);
  console.log(`✅ [Rate Limit] ${key} ${reason}，清除尝试记录`);
}

/**
 * 登录限流中间件
 * 
 * 在登录接口中使用：
 * router.post('/login', loginRateLimit, async (req, res) => { ... });
 */
async function loginRateLimit(req, res, next) {
  const ip = getClientIP(req);
  const userId = req.body.userId;
  
  if (!userId) {
    return sendError(res, req, {
      status: 400,
      code: ERROR_CODES.MISSING_USER_ID,
      error: '缺少用户名'
    });
  }
  
  const result = await checkLoginAttempt(ip, userId);
  
  if (result.blocked) {
    return sendError(res, req, {
      status: 429,
      code: ERROR_CODES.LOGIN_RATE_LIMITED,
      error: `登录尝试次数过多，账号已被锁定${result.remainingTime}分钟`,
      details: {
        remainingTimeMinutes: result.remainingTime
      }
    });
  }
  
  // 将清除函数附加到req对象，供登录成功后调用
  req.clearLoginAttempts = (reason) => clearAttempts(ip, userId, reason);
  
  next();
}

/**
 * 全局API限流器（可选）
 * 防止单个IP疯狂请求API
 */
async function globalRateLimiter(req, res, next) {
  const ip = getClientIP(req);
  const result = await incrementGlobalCounter(ip);
  const remaining = Math.max(0, API_RATE_LIMIT_MAX - result.count);

  res.setHeader('X-RateLimit-Limit', String(API_RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)));

  if (result.count > API_RATE_LIMIT_MAX) {
    res.setHeader('Retry-After', String(result.remainingSeconds));
    return sendError(res, req, {
      status: 429,
      code: ERROR_CODES.RATE_LIMITED,
      error: 'API请求过于频繁，请稍后再试',
      details: {
        retryAfterSeconds: result.remainingSeconds,
        limit: API_RATE_LIMIT_MAX,
        windowMs: API_RATE_LIMIT_WINDOW_MS
      }
    });
  }

  return next();
}

module.exports = {
  loginRateLimit,
  clearAttempts,
  globalRateLimiter,
  // 导出配置供测试使用
  MAX_ATTEMPTS,
  LOCK_TIME,
  API_RATE_LIMIT_MAX,
  API_RATE_LIMIT_WINDOW_MS
};
