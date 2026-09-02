/**
 * JWT认证中间件
 * 验证请求中的JWT token，确保只有已登录用户才能访问受保护的API
 */

const { randomUUID, createHash } = require('crypto');
const jwt = require('jsonwebtoken');
const { ERROR_CODES, sendError } = require('../utils/apiError');
const { getRedisClient, buildRedisKey } = require('../utils/redisStore');

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

// Helper: try verifying token with primary secret, then fallback to an old secret if present.
function verifyTokenWithFallback(token, primarySecretEnv, oldSecretEnv) {
  const primary = process.env[primarySecretEnv];
  const old = process.env[oldSecretEnv];

  if (!primary && !old) {
    throw new Error(primarySecretEnv + ' is required but not configured');
  }

  try {
    return jwt.verify(token, primary || old);
  } catch (err) {
    // If primary exists and failed, and an old secret exists, try old secret before failing
    if (old && primary) {
      return jwt.verify(token, old);
    }
    throw err;
  }
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'; // Token有效期
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const tokenBlacklist = new Map();
const refreshTokenStore = new Map();
const REDIS_REFRESH_ROTATE_LUA = `
local oldKey = KEYS[1]
local newKey = KEYS[2]
local newValue = ARGV[1]
local newTtl = tonumber(ARGV[2])

if redis.call('EXISTS', oldKey) == 0 then
  return 0
end

redis.call('SET', newKey, newValue, 'EX', newTtl)
redis.call('DEL', oldKey)
return 1
`;

function getTokenRemainingSeconds(token) {
  const decoded = jwt.decode(token);

  if (!decoded?.exp) {
    return null;
  }

  const remainingSeconds = decoded.exp - Math.floor(Date.now() / 1000);
  return remainingSeconds > 0 ? remainingSeconds : 0;
}

// SSO: set user -> session mapping in Redis
async function setUserSession(userId, sessionId, ttlSeconds) {
  try {
    const redisClient = await getRedisClient();
    if (redisClient && sessionId && ttlSeconds && ttlSeconds > 0) {
      await redisClient.set(buildRedisKey('session', userId), sessionId, { EX: ttlSeconds });
    }
  } catch (e) {
    // best-effort
  }
}

// SSO: check whether decoded token's session matches the current session for user
async function isSessionValidForToken(decoded) {
  if (!decoded || !decoded.userId) return true;
  try {
    const redisClient = await getRedisClient();
    if (!redisClient) return true;
    const current = await redisClient.get(buildRedisKey('session', decoded.userId));
    if (!current) return true; // no mapping -> allow
    // Require token to have sessionId and match
    if (!decoded.sessionId) return false;
    return decoded.sessionId === current;
  } catch (e) {
    return true; // on error, be permissive (avoid denial of service)
  }
}

function cleanupExpiredEntries(store) {
  const now = Date.now();

  for (const [token, expiresAt] of store.entries()) {
    if (expiresAt <= now) {
      store.delete(token);
    }
  }
}

function hashTokenForStorage(token) {
  return createHash('sha256').update(token).digest('hex');
}

function getRevokedTokenStorageKey(token) {
  return buildRedisKey('revoked', hashTokenForStorage(token));
}

function getRefreshTokenStorageKey(jti) {
  return buildRedisKey('refresh', jti);
}

async function persistRefreshTokenRecord(token, payload) {
  const decoded = jwt.decode(token);
  const remainingSeconds = getTokenRemainingSeconds(token);

  if (!decoded?.jti || !remainingSeconds || remainingSeconds <= 0) {
    throw new Error('Unable to persist refresh token without jti/ttl');
  }

  const record = {
    userId: payload.userId,
    type: 'refresh',
    issuedAt: new Date().toISOString()
  };

  const redisClient = await getRedisClient();

  if (redisClient) {
    await redisClient.set(getRefreshTokenStorageKey(decoded.jti), JSON.stringify(record), { EX: remainingSeconds });
    return;
  }

  cleanupExpiredEntries(refreshTokenStore);
  refreshTokenStore.set(decoded.jti, {
    ...record,
    expiresAt: Date.now() + (remainingSeconds * 1000)
  });
}

async function getRefreshTokenRecord(jti) {
  const redisClient = await getRedisClient();

  if (redisClient) {
    const record = await redisClient.get(getRefreshTokenStorageKey(jti));
    return record ? JSON.parse(record) : null;
  }

  cleanupExpiredEntries(refreshTokenStore);
  return refreshTokenStore.get(jti) || null;
}

async function deleteRefreshTokenRecord(jti) {
  const redisClient = await getRedisClient();

  if (redisClient) {
    await redisClient.del(getRefreshTokenStorageKey(jti));
    return;
  }

  refreshTokenStore.delete(jti);
}

async function clearUserSession(userId) {
  try {
    const redisClient = await getRedisClient();
    if (redisClient) {
      await redisClient.del(buildRedisKey('session', userId));
    }
  } catch (e) {
    // best-effort
  }
}

/**
 * 生成JWT Token
 * @param {Object} payload - Token载荷（用户信息）
 * @returns {string} JWT Token
 */
function generateToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

async function generateRefreshToken(payload) {
  const refreshPayload = {
    userId: payload.userId,
    type: 'refresh',
    jti: randomUUID()
  };
  if (payload.sessionId) refreshPayload.sessionId = payload.sessionId;

  const token = jwt.sign(refreshPayload, getJwtRefreshSecret(), { expiresIn: JWT_REFRESH_EXPIRES_IN });
  await persistRefreshTokenRecord(token, payload);
  return token;
}

async function verifyRefreshToken(token) {
  const decoded = verifyTokenWithFallback(token, 'JWT_REFRESH_SECRET', 'JWT_REFRESH_SECRET_OLD');

  if (decoded?.type !== 'refresh' || !decoded?.jti) {
    const error = new Error('Refresh token payload is invalid');
    error.name = 'JsonWebTokenError';
    throw error;
  }

  const record = await getRefreshTokenRecord(decoded.jti);
  if (!record || record.userId !== decoded.userId || record.type !== 'refresh') {
    const error = new Error('Refresh token has been revoked or rotated');
    error.name = 'JsonWebTokenError';
    throw error;
  }

  return decoded;
}

async function revokeRefreshToken(token) {
  const decoded = jwt.decode(token);

  if (!decoded?.jti) {
    return false;
  }

  await deleteRefreshTokenRecord(decoded.jti);
  return true;
}

async function rotateRefreshToken(currentRefreshToken, payload) {
  const currentDecoded = jwt.decode(currentRefreshToken);
  if (!currentDecoded?.jti) {
    const error = new Error('Current refresh token is missing jti');
    error.name = 'JsonWebTokenError';
    throw error;
  }

  const newRefreshPayload = {
    userId: payload.userId,
    type: 'refresh',
    jti: randomUUID()
  };
  if (payload.sessionId) newRefreshPayload.sessionId = payload.sessionId;
  const newRefreshToken = jwt.sign(newRefreshPayload, getJwtRefreshSecret(), { expiresIn: JWT_REFRESH_EXPIRES_IN });
  const newRemainingSeconds = getTokenRemainingSeconds(newRefreshToken);

  if (!newRemainingSeconds || newRemainingSeconds <= 0) {
    throw new Error('Unable to rotate refresh token without ttl');
  }

  const newRecord = {
    userId: payload.userId,
    type: 'refresh',
    issuedAt: new Date().toISOString()
  };

  const redisClient = await getRedisClient();
  if (redisClient) {
    const rotateResult = await redisClient.eval(REDIS_REFRESH_ROTATE_LUA, {
      keys: [
        getRefreshTokenStorageKey(currentDecoded.jti),
        getRefreshTokenStorageKey(newRefreshPayload.jti)
      ],
      arguments: [
        JSON.stringify(newRecord),
        String(newRemainingSeconds)
      ]
    });

    if (rotateResult !== 1) {
      const error = new Error('Refresh token has been revoked or rotated');
      error.name = 'JsonWebTokenError';
      throw error;
    }

    return newRefreshToken;
  }

  cleanupExpiredEntries(refreshTokenStore);
  if (!refreshTokenStore.has(currentDecoded.jti)) {
    const error = new Error('Refresh token has been revoked or rotated');
    error.name = 'JsonWebTokenError';
    throw error;
  }

  refreshTokenStore.set(newRefreshPayload.jti, {
    ...newRecord,
    expiresAt: Date.now() + (newRemainingSeconds * 1000)
  });
  refreshTokenStore.delete(currentDecoded.jti);

  return newRefreshToken;
}

async function revokeToken(token) {
  const remainingSeconds = getTokenRemainingSeconds(token);
  const redisClient = await getRedisClient();

  if (redisClient && remainingSeconds && remainingSeconds > 0) {
    await redisClient.set(getRevokedTokenStorageKey(token), '1', { EX: remainingSeconds });
    console.log('🔒 [Auth] Token已写入Redis黑名单');
    return;
  }

  const expiresAt = Date.now() + Math.max((remainingSeconds || 0) * 1000, 60 * 1000);
  cleanupExpiredEntries(tokenBlacklist);
  tokenBlacklist.set(hashTokenForStorage(token), expiresAt);
  console.log(`🔒 [Auth] Token已加入内存黑名单，当前黑名单大小: ${tokenBlacklist.size}`);
}

async function isTokenRevoked(token) {
  const redisClient = await getRedisClient();

  if (redisClient) {
    const revoked = await redisClient.exists(getRevokedTokenStorageKey(token));
    return revoked === 1;
  }

  cleanupExpiredEntries(tokenBlacklist);
  return tokenBlacklist.has(hashTokenForStorage(token));
}

/**
 * 验证JWT Token中间件
 * 从请求头的Authorization字段提取token并验证
 */
async function verifyToken(req, res, next) {
  try {
    // 从请求头获取token
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_TOKEN_MISSING,
        error: '未提供认证令牌，请先登录'
      });
    }

    // 验证格式：Bearer <token>
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_TOKEN_INVALID_FORMAT,
        error: '认证令牌格式错误'
      });
    }

    const token = parts[1];

    if (await isTokenRevoked(token)) {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_TOKEN_REVOKED,
        error: '认证令牌已被撤销，请重新登录'
      });
    }

    // 验证token（支持平滑轮换：优先用 JWT_SECRET，再尝试 JWT_SECRET_OLD）
    const decoded = verifyTokenWithFallback(token, 'JWT_SECRET', 'JWT_SECRET_OLD');

    // SSO校验：确保token的sessionId与Redis中的当前会话一致
    if (!(await isSessionValidForToken(decoded))) {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_SESSION_INVALID,
        error: '会话已在其他设备登录，被挤下线'
      });
    }
    
    // 将解码后的用户信息附加到请求对象上
    req.user = {
      userId: decoded.userId,
      userName: decoded.userName,
      roleId: decoded.roleId || '',
      customerNo: decoded.customerNo,
      customerNos: Array.isArray(decoded.customerNos) ? decoded.customerNos : [],
      isAdmin: decoded.isAdmin
    };
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
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
        error: '认证令牌已过期，请重新登录'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_TOKEN_INVALID,
        error: '认证令牌无效'
      });
    }

    return sendError(res, req, {
      status: 401,
      code: ERROR_CODES.AUTH_FAILED,
      error: '认证失败'
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
  return verifyToken(req, res, next);
}

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  revokeToken,
  isTokenRevoked,
  verifyToken,
  optionalVerifyToken,
  setUserSession,
  clearUserSession,
  getJwtSecret,
  getJwtRefreshSecret,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN
};
