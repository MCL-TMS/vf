/**
 * JWT认证中间件
 * 验证请求中的JWT token，确保只有已登录用户才能访问受保护的API
 */

const jwt = require('jsonwebtoken');

// JWT密钥（从环境变量读取，开发环境使用默认值）
const JWT_SECRET = process.env.JWT_SECRET || 'vf-logistics-default-secret-key-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'; // Token有效期

/**
 * 生成JWT Token
 * @param {Object} payload - Token载荷（用户信息）
 * @returns {string} JWT Token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 验证JWT Token中间件
 * 从请求头的Authorization字段提取token并验证
 */
function verifyToken(req, res, next) {
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

    // 验证token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 将解码后的用户信息附加到请求对象上
    req.user = {
      userId: decoded.userId,
      userName: decoded.userName,
      customerNo: decoded.customerNo,
      isAdmin: decoded.isAdmin
    };

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
        error: '认证令牌已过期，请重新登录',
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
function optionalVerifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // 没有token，继续执行
    req.user = null;
    return next();
  }

  // 有token，执行验证
  verifyToken(req, res, next);
}

module.exports = {
  generateToken,
  verifyToken,
  optionalVerifyToken,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
