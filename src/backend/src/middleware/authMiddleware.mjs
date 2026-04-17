/**
 * JWT认证中间件 (ES6模块版本)
 * 验证请求中的JWT token，确保只有已登录用户才能访问受保护的API
 */

import jwt from 'jsonwebtoken';

// JWT密钥必须通过环境变量配置，禁止使用代码中的默认回退
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required but not configured');
  }
  return secret;
}

function getJwtRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is required but not configured');
  }
  return secret;
}

// Token有效期
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // Access token: 15分钟
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'; // Refresh token: 7天

// 🔥 Token黑名单（生产环境应使用Redis）
const tokenBlacklist = new Set();

/**
 * 生成Access Token（短期有效）
 * @param {Object} payload - Token载荷（用户信息）
 * @returns {string} JWT Token
 */
export function generateToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 生成Refresh Token（长期有效）
 * @param {Object} payload - Token载荷（用户信息）
 * @returns {string} Refresh Token
 */
export function generateRefreshToken(payload) {
  // Refresh token只包含userId，减少信息泄露风险
  const refreshPayload = {
    userId: payload.userId,
    type: 'refresh'
  };
  return jwt.sign(refreshPayload, getJwtRefreshSecret(), { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

/**
 * 验证Refresh Token
 * @param {string} token - Refresh Token
 * @returns {Object} 解码后的payload
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, getJwtRefreshSecret());
}

/**
 * 将Token加入黑名单
 * @param {string} token - 要撤销的token
 */
export function revokeToken(token) {
  tokenBlacklist.add(token);
  console.log(`🔒 [Auth] Token已加入黑名单，当前黑名单大小: ${tokenBlacklist.size}`);
}

/**
 * 检查Token是否在黑名单中
 * @param {string} token - 要检查的token
 * @returns {boolean}
 */
export function isTokenRevoked(token) {
  return tokenBlacklist.has(token);
}

/**
 * 清理过期的黑名单token（定期执行）
 */
export function cleanupBlacklist() {
  // 简单实现：清空所有（因为过期的token验证时会自动失败）
  // 生产环境应该用Redis的TTL自动过期
  const oldSize = tokenBlacklist.size;
  tokenBlacklist.clear();
  console.log(`🧹 [Auth] 黑名单清理完成，清理了 ${oldSize} 个token`);
}

// 每24小时清理一次黑名单
setInterval(cleanupBlacklist, 24 * 60 * 60 * 1000);

/**
 * 验证JWT Token中间件
 * 从请求头的Authorization字段提取token并验证
 */
export function verifyToken(req, res, next) {
  try {
    // 从请求头获取token
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: '未提供认证令牌，请先登录',
        code: 'NO_TOKEN'
      });
    }

    // 验证格式：Bearer <token>
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        error: '认证令牌格式错误',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    const token = parts[1];

    // 🔥 检查token是否在黑名单中
    if (isTokenRevoked(token)) {
      return res.status(401).json({
        success: false,
        error: '认证令牌已被撤销，请重新登录',
        code: 'TOKEN_REVOKED'
      });
    }

    // 验证token
    const decoded = jwt.verify(token, getJwtSecret());
    
    // 将解码后的用户信息附加到请求对象上
    req.user = {
      userId: decoded.userId,
      userName: decoded.userName,
      customerNo: decoded.customerNo,
      isAdmin: decoded.isAdmin
    };

    // 将原始token也附加上（用于后续撤销）
    req.token = token;

    console.log('✅ [Auth Middleware] Token验证成功:', {
      userId: req.user.userId,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    console.error('❌ [Auth Middleware] Token验证失败:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: '认证令牌已过期，请刷新令牌',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: '认证令牌无效',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(401).json({
      success: false,
      error: '认证失败',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * 可选的JWT验证中间件
 * 如果提供了token则验证，否则继续执行（用于可选认证的端点）
 */
export function optionalVerifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // 没有token，继续执行
    req.user = null;
    return next();
  }

  // 有token，执行验证
  verifyToken(req, res, next);
}

export {
  getJwtSecret,
  JWT_EXPIRES_IN,
  getJwtRefreshSecret,
  JWT_REFRESH_EXPIRES_IN
};