/**
 * 🔐 防暴力破解中间件 (CommonJS版本)
 * 
 * 功能：
 * 1. 限制同一IP或用户名的登录尝试次数
 * 2. 超过5次失败后锁定账号15分钟
 * 3. 登录成功后清除尝试记录
 */

const rateLimit = require('express-rate-limit');

/**
 * 登录尝试记录存储
 * Key: `${ip}:${userId}`
 * Value: { count: number, lockedUntil: Date | null }
 */
const loginAttempts = new Map();

/**
 * 最大尝试次数配置
 */
const MAX_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15分钟（毫秒）

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
function checkLoginAttempt(ip, userId) {
  const key = getAttemptKey(ip, userId);
  const now = new Date();
  
  let record = loginAttempts.get(key);
  
  if (!record) {
    record = { count: 0, lockedUntil: null };
    loginAttempts.set(key, record);
  }
  
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
    return { blocked: true, remainingTime: Math.ceil(LOCK_TIME / 60000) };
  }
  
  return { blocked: false };
}

/**
 * 清除登录尝试记录（登录成功后调用）
 * 
 * @param {string} ip - 客户端IP
 * @param {string} userId - 用户名
 */
function clearAttempts(ip, userId) {
  const key = getAttemptKey(ip, userId);
  if (loginAttempts.has(key)) {
    loginAttempts.delete(key);
    console.log(`✅ [Rate Limit] ${key} 登录成功，清除尝试记录`);
  }
}

/**
 * 登录限流中间件
 * 
 * 在登录接口中使用：
 * router.post('/login', loginRateLimit, async (req, res) => { ... });
 */
function loginRateLimit(req, res, next) {
  const ip = getClientIP(req);
  const userId = req.body.userId;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: '缺少用户名',
      code: 'MISSING_USER_ID'
    });
  }
  
  const result = checkLoginAttempt(ip, userId);
  
  if (result.blocked) {
    return res.status(429).json({
      success: false,
      error: `登录尝试次数过多，账号已被锁定${result.remainingTime}分钟`,
      code: 'TOO_MANY_ATTEMPTS',
      remainingTime: result.remainingTime
    });
  }
  
  // 将清除函数附加到req对象，供登录成功后调用
  req.clearLoginAttempts = () => clearAttempts(ip, userId);
  
  next();
}

/**
 * 全局API限流器（可选）
 * 防止单个IP疯狂请求API
 */
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每15分钟最多1000个请求
  message: {
    success: false,
    error: 'API请求过于频繁，请稍后再试',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginRateLimit,
  clearAttempts,
  globalRateLimiter,
  // 导出配置供测试使用
  MAX_ATTEMPTS,
  LOCK_TIME
};
