/**
 * HTTPS强制中间件
 * 生产环境下强制使用HTTPS，防止中间人攻击
 */

/**
 * 检查是否为HTTPS请求
 * @param {Object} req - Express请求对象
 * @returns {boolean}
 */
function isSecure(req) {
  // 检查协议
  if (req.protocol === 'https') {
    return true;
  }
  
  // 检查代理头（用于反向代理场景，如Nginx）
  if (req.headers['x-forwarded-proto'] === 'https') {
    return true;
  }
  
  // 检查其他可能的HTTPS标识
  if (req.headers['x-forwarded-ssl'] === 'on') {
    return true;
  }
  
  return false;
}

/**
 * HTTPS强制中间件
 * 生产环境下强制使用HTTPS
 * 
 * 配置环境变量：
 * - NODE_ENV=production 启用HTTPS强制
 * - FORCE_HTTPS=true 强制启用（无论环境）
 * - FORCE_HTTPS=false 强制禁用（无论环境）
 */
export function forceHttps(req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';
  const forceHttpsConfig = process.env.FORCE_HTTPS;
  
  // 确定是否需要强制HTTPS
  let shouldForceHttps = false;
  
  if (forceHttpsConfig === 'true') {
    // 显式启用
    shouldForceHttps = true;
  } else if (forceHttpsConfig === 'false') {
    // 显式禁用
    shouldForceHttps = false;
  } else {
    // 根据环境自动判断
    shouldForceHttps = isProduction;
  }
  
  // 如果不需要强制HTTPS，直接通过
  if (!shouldForceHttps) {
    return next();
  }
  
  // 检查是否已经是HTTPS
  if (isSecure(req)) {
    // 添加安全响应头
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    return next();
  }
  
  // 不是HTTPS，拒绝请求
  console.warn(`🔒 [HTTPS] 拒绝非HTTPS请求: ${req.method} ${req.originalUrl} from ${req.ip}`);
  
  return res.status(403).json({
    success: false,
    error: '生产环境必须使用HTTPS访问',
    code: 'HTTPS_REQUIRED',
    message: 'This endpoint requires HTTPS connection in production environment'
  });
}

/**
 * 可选的HTTPS重定向中间件
 * 将HTTP请求重定向到HTTPS（适用于有自己的HTTPS服务器的场景）
 */
export function redirectToHttps(req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';
  const enableRedirect = process.env.HTTPS_REDIRECT === 'true';
  
  // 只在生产环境且显式启用重定向时工作
  if (!isProduction || !enableRedirect) {
    return next();
  }
  
  if (!isSecure(req)) {
    const httpsUrl = `https://${req.hostname}${req.originalUrl}`;
    console.log(`🔀 [HTTPS] 重定向到HTTPS: ${httpsUrl}`);
    return res.redirect(301, httpsUrl);
  }
  
  next();
}

/**
 * 安全响应头中间件
 * 添加各种安全相关的HTTP响应头
 */
export function securityHeaders(req, res, next) {
  // HSTS - 强制浏览器使用HTTPS（1年）
  if (isSecure(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY');
  
  // 防止MIME类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS保护
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // 引用策略
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 内容安全策略（根据需要调整）
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // 根据实际需求调整
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  // 权限策略
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
}

/**
 * 获取HTTPS状态信息
 */
export function getHttpsStatus(req) {
  return {
    isSecure: isSecure(req),
    protocol: req.protocol,
    forwardedProto: req.headers['x-forwarded-proto'],
    environment: process.env.NODE_ENV,
    forceHttpsEnabled: process.env.FORCE_HTTPS === 'true' || process.env.NODE_ENV === 'production'
  };
}
