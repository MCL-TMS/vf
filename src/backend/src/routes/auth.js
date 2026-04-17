/**
 * 用户认证路由
 * 连接 APP_CMS.RWSYS_USER 表进行用户登录验证
 */

const express = require('express');
const router = express.Router();
const oracledb = require('oracledb');
const { getConnection, releaseConnection } = require('../config/database-api');
const { generateToken, generateRefreshToken, verifyRefreshToken, verifyToken, revokeToken, revokeRefreshToken, rotateRefreshToken } = require('../middleware/authMiddleware'); // 🔥 JWT生成函数
const { loginRateLimit } = require('../middleware/rateLimitMiddleware'); // 🔥 防暴力破解中间件
const { ERROR_CODES, sendError } = require('../utils/apiError');
const { verifyAndUpgradePassword } = require('../utils/passwordUtils');

function getCustomerNoScopeForUser(rawCustomerNo, isAdmin) {
  // 管理员用显式 all 表示“全量品牌可见”，避免空字符串被误解为“无权限”。
  if (isAdmin) {
    return 'all';
  }

  return rawCustomerNo || '';
}

/**
 * GET /api/auth/login
 * 返回端点使用说明（浏览器直接访问）
 */
router.get('/login', (req, res) => {
  res.status(200).json({
    message: '✅ 认证端点工作正常',
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
      console.warn(`⚠️ [Auth] 用户 ${user.USERID} 使用${passwordCheck.legacyFormat}密码格式登录，当前账号仅具备查询权限，未执行密码升级`);
    }

    // 🔥 登录成功，清除尝试记录
    if (req.clearLoginAttempts) {
      await req.clearLoginAttempts();
    }

    // 🔥 准备JWT载荷
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

    // 🔥 生成JWT token
    const token = generateToken(tokenPayload);
    const refreshToken = await generateRefreshToken(tokenPayload);

    console.log('✅ [Auth] 用户登录成功，生成token:', {
      userId: user.USERID,
      isAdmin: isAdmin,
      tokenLength: token.length,
      refreshTokenLength: refreshToken.length
    });

    // 登录成功，返回用户信息和token
    return res.json({
      success: true,
      user: {
        userId: user.USERID,
        userName: user.USER_NAME_C,
        roleId: user.ROLE_ID || '',
        customerNo: customerNoScope // 可查看的品牌范围（管理员返回 all）
      },
      token: token, // 🔥 返回JWT token
      refreshToken: refreshToken
    });

  } catch (error) {
    console.error('❌ Login API Error:', error);
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