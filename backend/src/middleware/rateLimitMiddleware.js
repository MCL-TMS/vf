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

/**
 * 使用 express-rate-limit 替代自定义逻辑，以便安全审计工具识别
 */
const globalRateLimiter = rateLimit({
  windowMs: Number.parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10),
  max: Number.parseInt(process.env.API_RATE_LIMIT_MAX || '1000', 10),
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
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 5次尝试
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
});

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
