/**
 * 用户认证路由
 * 连接 APP_CMS.RWSYS_USER 表进行用户登录验证
 */

const express = require('express');
const router = express.Router();
const oracledb = require('oracledb');
const { randomInt } = require('crypto');
const { getConnection, releaseConnection } = require('../config/database-api');
const { generateToken, generateRefreshToken, verifyRefreshToken, verifyToken, revokeToken, revokeRefreshToken, rotateRefreshToken } = require('../middleware/authMiddleware'); // 🔥 JWT生成函数
const { loginRateLimit } = require('../middleware/rateLimitMiddleware'); // 🔥 防暴力破解中间件
const { ERROR_CODES, sendError } = require('../utils/apiError');
const { verifyAndUpgradePassword } = require('../utils/passwordUtils');
const { createOtpChallenge, verifyOtpChallenge, deleteChallenge, maskEmailAddress } = require('../utils/mfaOtpStore');
const { sendOtpEmail, isEmailMfaEnabled } = require('../utils/emailSender');

function isDatabaseUnavailableError(error) {
  if (!error) {
    return false;
  }

  const code = String(error.code || '').toUpperCase();
  return code === 'NJS-040' || code === 'NJS-510' || code.startsWith('ORA-');
}

function getCustomerNoScopeForUser(rawCustomerNo, isAdmin) {
  // 管理员用显式 all 表示“全量品牌可见”，避免空字符串被误解为“无权限”。
  if (isAdmin) {
    return 'all';
  }

  return rawCustomerNo || '';
}

function generateNumericOtpCode() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

function buildAuthPayload(user) {
  const customerNos = user.CUSTOMERNO ? user.CUSTOMERNO.split(',').map(c => c.trim()).filter(Boolean) : [];
  const isAdmin = customerNos.length === 0 || customerNos.includes('all') || customerNos.includes('ALL');
  const customerNoScope = getCustomerNoScopeForUser(user.CUSTOMERNO, isAdmin);

  return {
    tokenPayload: {
      userId: user.USERID,
      userName: user.USER_NAME_C,
      roleId: user.ROLE_ID || '',
      customerNo: customerNoScope,
      customerNos: isAdmin ? [] : customerNos,
      isAdmin
    },
    customerNoScope
  };
}

/**
 * GET /api/auth/login
 * 返回端点使用说明（浏览器直接访问）
 */
router.get('/login', (req, res) => {
  res.status(200).json({
    message: '✅ 认证端点工作正常（邮箱MFA已启用）',
    method: 'POST',
    endpoint: '/api/auth/login',
    usage: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        userId: 'your_username',
        password: 'your_password'
      }
    },
    mfa: {
      verifyEndpoint: '/api/auth/login/verify-otp',
      requestBody: {
        challengeId: 'from login response',
        otpCode: '6-digit numeric code'
      }
    },
    example: `
fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'your_username', password: 'your_password' })
})
.then(r => r.json())
.then(console.log)
    `.trim()
  });
});

/**
 * POST /api/auth/login
 * 用户登录接口
 * 
 * Request Body:
 * {
 *   userId: string,    // 登录账号
 *   password: string   // 明文密码（仅通过HTTPS传输）
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   user: {
 *     userId: string,
 *     userName: string,
 *     customerNo: string  // 可查看的品牌范围（逗号分隔）
 *   },
 *   token: string,         // 🔥 Access Token
 *   refreshToken: string,  // 🔥 Refresh Token
 *   error?: string
 * }
 */
router.post('/login', loginRateLimit, async (req, res) => {
  let connection;
  
  try {
    const { userId, password } = req.body;

    // 验证输入
    if (!userId || !password) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '用户名和密码不能为空',
        details: {
          missingFields: [!userId ? 'userId' : null, !password ? 'password' : null].filter(Boolean)
        }
      });
    }

    // 获取数据库连接（从连接池）
    connection = await getConnection();

    // 查询用户信息
    const query = `
      SELECT 
        USERID,
        USER_NAME_C,
        ROLE_ID,
        CUSTOMERNO,
        USER_EMAIL,
        PASSWORD,
        ACTIVE_FLAG
      FROM APP_CMS.RWSYS_USER
      WHERE UPPER(USERID) = UPPER(:userId)
    `;

    const result = await connection.execute(
      query,
      { userId: userId }, // 不转换大小写，让SQL处理
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // 检查用户是否存在
    if (result.rows.length === 0) {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        error: '用户名或密码错误'
      });
    }

    const user = result.rows[0];

    // 检查账号是否启用
    if (user.ACTIVE_FLAG !== 'Y') {
      return sendError(res, req, {
        status: 403,
        code: ERROR_CODES.AUTH_USER_DISABLED,
        error: '该账号已被停用，请联系管理员'
      });
    }

    const passwordCheck = await verifyAndUpgradePassword(password, user.PASSWORD);

    if (!passwordCheck.isValid) {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        error: '用户名或密码错误'
      });
    }

    if (passwordCheck.needsUpgrade) {
      // 🔥 安全修复：避免在日志中直接输出敏感信息
      console.warn(`⚠️ [Auth] 该账号使用${passwordCheck.legacyFormat}密码格式登录，需执行密码升级`);
    }

    // 邮箱MFA流程（默认启用）。
    if (isEmailMfaEnabled()) {
      if (!user.USER_EMAIL) {
        return sendError(res, req, {
          status: 403,
          code: ERROR_CODES.AUTH_FAILED,
          error: '当前账号未配置邮箱，无法完成二次验证，请联系管理员'
        });
      }

      const otpCode = generateNumericOtpCode();
      const { challengeId, ttlSeconds } = await createOtpChallenge(
        {
          userId: user.USERID,
          email: user.USER_EMAIL,
          purpose: 'login'
        },
        otpCode
      );

      try {
        await sendOtpEmail({
          to: user.USER_EMAIL,
          code: otpCode,
          userId: user.USERID
        });
      } catch (mailError) {
        console.error('❌ [Auth] MFA邮件发送失败:', mailError.message);
        await deleteChallenge(challengeId);
        return sendError(res, req, {
          status: 500,
          code: ERROR_CODES.INTERNAL_ERROR,
          error: '验证码发送失败，请稍后重试'
        });
      }

      console.log('✅ [Auth] 用户密码验证通过，已发送MFA验证码:', {
        challengeId,
        expiresInSeconds: ttlSeconds
      });

      return res.json({
        success: true,
        mfaRequired: true,
        challengeId,
        expiresIn: ttlSeconds,
        maskedEmail: maskEmailAddress(user.USER_EMAIL),
        message: '验证码已发送到您的邮箱'
      });
    }

    // 若MFA未启用，保持原登录行为（兼容环境开关）
    const { tokenPayload, customerNoScope } = buildAuthPayload(user);
    const token = generateToken(tokenPayload);
    const refreshToken = await generateRefreshToken(tokenPayload);

    if (req.clearLoginAttempts) {
      await req.clearLoginAttempts();
    }

    return res.json({
      success: true,
      user: {
        userId: user.USERID,
        userName: user.USER_NAME_C,
        roleId: user.ROLE_ID || '',
        customerNo: customerNoScope
      },
      token,
      refreshToken
    });

  } catch (error) {
    console.error('❌ Login API Error:', error);

    if (isDatabaseUnavailableError(error)) {
      if (req.clearLoginAttempts) {
        await req.clearLoginAttempts('数据库不可用，不计入失败次数');
      }

      return sendError(res, req, {
        status: 503,
        code: ERROR_CODES.DB_UNAVAILABLE,
        error: '数据库连接不可用，请稍后重试'
      });
    }

    return sendError(res, req, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      error: '服务器错误，请稍后重试'
    });
  } finally {
    if (connection) {
      try {
        await releaseConnection(connection);
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

/**
 * POST /api/auth/login/verify-otp
 * 校验邮箱验证码并完成登录
 */
router.post('/login/verify-otp', loginRateLimit, async (req, res) => {
  let connection;

  try {
    const { challengeId, otpCode } = req.body || {};

    if (!challengeId || !otpCode) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: 'challengeId和otpCode不能为空',
        details: {
          missingFields: [!challengeId ? 'challengeId' : null, !otpCode ? 'otpCode' : null].filter(Boolean)
        }
      });
    }

    const verifyResult = await verifyOtpChallenge(challengeId, String(otpCode).trim());
    if (!verifyResult.success) {
      if (verifyResult.reason === 'TOO_MANY_ATTEMPTS') {
        return sendError(res, req, {
          status: 429,
          code: ERROR_CODES.LOGIN_RATE_LIMITED,
          error: '验证码错误次数过多，请重新登录获取新验证码'
        });
      }

      if (verifyResult.reason === 'NOT_FOUND') {
        return sendError(res, req, {
          status: 401,
          code: ERROR_CODES.AUTH_FAILED,
          error: '验证码已过期，请重新登录获取新验证码'
        });
      }

      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_FAILED,
        error: '验证码错误',
        details: {
          attemptsLeft: verifyResult.attemptsLeft
        }
      });
    }

    connection = await getConnection();
    const query = `
      SELECT 
        USERID,
        USER_NAME_C,
        ROLE_ID,
        CUSTOMERNO,
        ACTIVE_FLAG
      FROM APP_CMS.RWSYS_USER
      WHERE UPPER(USERID) = UPPER(:userId)
        AND ACTIVE_FLAG = 'Y'
    `;

    const result = await connection.execute(
      query,
      { userId: verifyResult.challenge.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_USER_INACTIVE,
        error: '用户不存在或已被停用，请重新登录'
      });
    }

    const user = result.rows[0];
    const { tokenPayload, customerNoScope } = buildAuthPayload(user);
    const token = generateToken(tokenPayload);
    const refreshToken = await generateRefreshToken(tokenPayload);

    if (req.clearLoginAttempts) {
      await req.clearLoginAttempts();
    }

    console.log('✅ [Auth] 用户MFA验证通过并登录成功');

    return res.json({
      success: true,
      user: {
        userId: user.USERID,
        userName: user.USER_NAME_C,
        roleId: user.ROLE_ID || '',
        customerNo: customerNoScope
      },
      token,
      refreshToken,
      mfaVerified: true
    });
  } catch (error) {
    console.error('❌ [Auth] MFA验证码校验失败:', error);
    return sendError(res, req, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      error: '服务器错误，请稍后重试'
    });
  } finally {
    if (connection) {
      try {
        await releaseConnection(connection);
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

/**
 * POST /api/auth/refresh
 * 刷新Access Token
 */
router.post('/refresh', async (req, res) => {
  let connection;

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.AUTH_REFRESH_TOKEN_MISSING,
        error: '未提供刷新令牌'
      });
    }

    let decoded;
    try {
      decoded = await verifyRefreshToken(refreshToken);
    } catch (error) {
      console.error('❌ [Auth] Refresh token验证失败:', error.message);
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID,
        error: '刷新令牌无效或已过期，请重新登录'
      });
    }

    connection = await getConnection();

    const query = `
      SELECT 
        USERID,
        USER_NAME_C,
        ROLE_ID,
        CUSTOMERNO,
        ACTIVE_FLAG
      FROM APP_CMS.RWSYS_USER
      WHERE UPPER(USERID) = UPPER(:userId)
        AND ACTIVE_FLAG = 'Y'
    `;

    const result = await connection.execute(
      query,
      { userId: decoded.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_USER_INACTIVE,
        error: '用户不存在或已被停用，请重新登录'
      });
    }

    const user = result.rows[0];
    const customerNos = user.CUSTOMERNO ? user.CUSTOMERNO.split(',').map(c => c.trim()).filter(Boolean) : [];
    const isAdmin = customerNos.length === 0 || customerNos.includes('all') || customerNos.includes('ALL');
    const customerNoScope = getCustomerNoScopeForUser(user.CUSTOMERNO, isAdmin);

    const tokenPayload = {
      userId: user.USERID,
      userName: user.USER_NAME_C,
      roleId: user.ROLE_ID || '',
      customerNo: customerNoScope,
      customerNos: isAdmin ? [] : customerNos,
      isAdmin: isAdmin
    };

    const newToken = generateToken(tokenPayload);
    const newRefreshToken = await rotateRefreshToken(refreshToken, tokenPayload);

    console.log('🔄 [Auth] Token刷新成功:', {
      userId: user.USERID
    });

    return res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('❌ [Auth] Token刷新失败:', error);
    return sendError(res, req, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      error: '服务器错误，请稍后重试'
    });
  } finally {
    if (connection) {
      try {
        await releaseConnection(connection);
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

/**
 * POST /api/auth/logout
 * 登出并撤销当前 access token / refresh token
 */
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const { refreshToken } = req.body || {};

    if (req.token) {
      await revokeToken(req.token);
      console.log('👋 [Auth] 用户登出，token已撤销:', { userId: req.user.userId });
    }

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
      console.log('👋 [Auth] Refresh token已撤销:', { userId: req.user.userId });
    }

    return res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('❌ [Auth] 登出失败:', error);
    return sendError(res, req, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      error: '登出失败，请稍后重试'
    });
  }
});

/**
 * POST /api/auth/validate
 * 验证用户会话是否有效（可选，用于前端恢复会话）
 */
router.post('/validate', async (req, res) => {
  let connection;
  
  try {
    const { userId } = req.body;

    if (!userId) {
      return sendError(res, req, {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        error: '用户ID不能为空',
        details: {
          missingFields: ['userId']
        }
      });
    }

    // 获取数据库连接（从连接池）
    connection = await getConnection();

    const query = `
      SELECT 
        USERID,
        USER_NAME_C,
        CUSTOMERNO,
        ACTIVE_FLAG
      FROM APP_CMS.RWSYS_USER
      WHERE USERID = :userId
        AND ACTIVE_FLAG = 'Y'
    `;

    const result = await connection.execute(
      query,
      { userId: userId.toUpperCase() },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return sendError(res, req, {
        status: 401,
        code: ERROR_CODES.AUTH_SESSION_INVALID,
        error: '会话已失效，请重新登录'
      });
    }

    const user = result.rows[0];
    const customerNos = user.CUSTOMERNO ? user.CUSTOMERNO.split(',').map(c => c.trim()).filter(Boolean) : [];
    const isAdmin = customerNos.length === 0 || customerNos.includes('all') || customerNos.includes('ALL');
    const customerNoScope = getCustomerNoScopeForUser(user.CUSTOMERNO, isAdmin);

    return res.json({
      success: true,
      user: {
        userId: user.USERID,
        userName: user.USER_NAME_C,
        customerNo: customerNoScope
      }
    });

  } catch (error) {
    console.error('❌ Validate API Error:', error);
    return sendError(res, req, {
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      error: '服务器错误'
    });
  } finally {
    if (connection) {
      try {
        await releaseConnection(connection);
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

module.exports = router;