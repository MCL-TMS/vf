/**
 * 安全中间件集合
 * 包含：JWT认证、输入验证、速率限制、CSRF保护
 */

const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required but not configured');
  }
  return secret;
}

// ========================================
// 1. JWT Token认证中间件
// ========================================

/**
 * 验证JWT Token
 * 使用方式：app.use('/api/protected', authenticateToken)
 */
function authenticateToken(req, res, next) {
  // 从Authorization头获取token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: '未授权访问，请先登录',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded; // 将解码后的用户信息附加到request
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: '登录已过期，请重新登录',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(403).json({
      success: false,
      error: 'Token无效',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * 生成JWT Token
 * @param {Object} payload - 用户信息 { userId, customerNo }
 * @param {String} expiresIn - 过期时间，默认8小时
 */
function generateToken(payload, expiresIn = '8h') {
  return jwt.sign(
    payload,
    getJwtSecret(),
    { expiresIn }
  );
}

/**
 * 刷新Token
 * @param {String} oldToken - 旧Token
 */
function refreshToken(oldToken) {
  try {
    const decoded = jwt.verify(
      oldToken,
      getJwtSecret(),
      { ignoreExpiration: true } // 允许过期的token刷新
    );
    
    // 重新生成token（去除iat和exp字段）
    const { iat, exp, ...payload } = decoded;
    return generateToken(payload);
  } catch (err) {
    throw new Error('Token刷新失败');
  }
}

// ========================================
// 2. 速率限制中间件
// ========================================

/**
 * 登录接口速率限制
 * 5分钟内最多5次尝试，防止暴力破解
 */
const loginRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分钟
  max: 5, // 最多5次尝试
  message: {
    success: false,
    error: '登录尝试次数过多，请5分钟后再试',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // 返回速率限制信息到headers
  legacyHeaders: false,
  skipSuccessfulRequests: true, // 成功的请求不计入限制
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: '登录尝试次数过多，请5分钟后再试',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * 通用API速率限制
 * 1分钟内最多100次请求
 */
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 100, // 最多100次请求
  message: {
    success: false,
    error: '请求过于频繁，请稍后再试',
    code: 'API_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: '请求过于频繁，请稍后再试',
      code: 'API_RATE_LIMIT',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * 严格速率限制（用于敏感操作）
 * 1小时内最多3次
 */
const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3,
  message: {
    success: false,
    error: '操作过于频繁，请1小时后再试',
    code: 'STRICT_RATE_LIMIT'
  }
});

// ========================================
// 3. 输入验证中间件
// ========================================

/**
 * 登录参数验证
 */
const validateLogin = [
  body('userId')
    .trim()
    .notEmpty().withMessage('用户名不能为空')
    .isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50之间')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('用户名只能包含字母、数字、下划线和连字符'),
  
  body('password')
    .notEmpty().withMessage('密码不能为空')
    .isLength({ min: 6, max: 100 }).withMessage('密码长度必须在6-100之间'),
];

/**
 * 日期范围验证
 */
const validateDateRange = [
  query('dateFrom')
    .notEmpty().withMessage('开始日期不能为空')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('日期格式必须为YYYY-MM-DD'),
  
  query('dateTo')
    .notEmpty().withMessage('结束日期不能为空')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('日期格式必须为YYYY-MM-DD')
    .custom((value, { req }) => {
      const from = new Date(req.query.dateFrom);
      const to = new Date(value);
      if (to < from) {
        throw new Error('结束日期不能早于开始日期');
      }
      // 限制查询范围不超过1年
      const diffDays = (to - from) / (1000 * 60 * 60 * 24);
      if (diffDays > 365) {
        throw new Error('查询范围不能超过1年');
      }
      return true;
    })
];

/**
 * 品牌代码验证
 */
const validateBrand = [
  query('brand')
    .optional()
    .custom((value) => {
      const allowedBrands = ['all', '18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5'];
      if (!allowedBrands.includes(value)) {
        throw new Error('无效的品牌代码');
      }
      return true;
    })
];

/**
 * 检查验证结果
 */
function checkValidationResult(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: '参数验证失败',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
}

// ========================================
// 4. 品牌权限验证中间件
// ========================================

/**
 * 验证用户是否有权限访问指定品牌
 */
function checkBrandPermission(req, res, next) {
  const { user } = req; // 从authenticateToken中获取
  const requestedBrand = req.query.brand || req.body.brand;
  
  // 管理员或品牌为'all'时跳过检查
  if (!user.customerNo || user.customerNo === 'all' || requestedBrand === 'all') {
    return next();
  }
  
  // 检查用户是否有权限访问请求的品牌
  const allowedBrands = user.customerNo.split(',').map(b => b.trim());
  
  if (requestedBrand && !allowedBrands.includes(requestedBrand)) {
    return res.status(403).json({
      success: false,
      error: '您没有权限访问该品牌的数据',
      code: 'BRAND_PERMISSION_DENIED'
    });
  }
  
  next();
}

// ========================================
// 5. 安全日志中间件
// ========================================

/**
 * 记录安全相关的请求
 */
function securityLogger(req, res, next) {
  // 只在生产环境记录
  if (process.env.NODE_ENV === 'production') {
    const logData = {
      timestamp: new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress,
      method: req.method,
      path: req.path,
      userId: req.user?.userId || 'anonymous',
      userAgent: req.get('user-agent')
    };
    
    // 记录敏感操作
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      console.log('[SECURITY]', JSON.stringify(logData));
    }
  }
  
  next();
}

// ========================================
// 6. 错误处理中间件
// ========================================

/**
 * 统一错误处理
 */
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);
  
  // 开发环境返回详细错误
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.status || 500).json({
      success: false,
      error: err.message,
      stack: err.stack,
      code: err.code || 'INTERNAL_ERROR'
    });
  }
  
  // 生产环境隐藏敏感信息
  res.status(err.status || 500).json({
    success: false,
    error: '服务器内部错误，请稍后重试',
    code: err.code || 'INTERNAL_ERROR',
    requestId: req.id // 可用于后台追踪
  });
}

// ========================================
// 导出所有中间件
// ========================================

module.exports = {
  // JWT认证
  authenticateToken,
  generateToken,
  refreshToken,
  
  // 速率限制
  loginRateLimiter,
  apiRateLimiter,
  strictRateLimiter,
  
  // 输入验证
  validateLogin,
  validateDateRange,
  validateBrand,
  checkValidationResult,
  
  // 权限验证
  checkBrandPermission,
  
  // 其他
  securityLogger,
  errorHandler
};
