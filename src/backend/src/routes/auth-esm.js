/**
 * 用户认证路由 (ES6 Module版本)
 * 连接 APP_CMS.RWSYS_USER 表进行用户登录验证
 */

import express from 'express';
import oracledb from 'oracledb';
import { generateToken, generateRefreshToken, verifyRefreshToken, revokeToken, verifyToken } from '../middleware/authMiddleware.mjs';
import { loginRateLimit, clearAttempts } from '../middleware/rateLimitMiddleware.mjs';

const router = express.Router();

/**
 * POST /api/auth/login
 * 用户登录接口
 * 
 * Request Body:
 * {
 *   userId: string,    // 登录账号
 *   password: string   // 密码（MD5哈希）
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
 *   token: string,         // 🔥 Access Token（15分钟）
 *   refreshToken: string,  // 🔥 Refresh Token（7天）
 *   error?: string
 * }
 */
router.post('/login', loginRateLimit, async (req, res) => {
  let connection;
  
  try {
    const { userId, password } = req.body;

    // 验证输入
    if (!userId || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码不能为空'
      });
    }

    // 获取数据库连接
    const dbConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    };

    connection = await oracledb.getConnection(dbConfig);

    // 查询用户信息
    const query = `
      SELECT 
        USERID,
        USER_NAME_C,
        CUSTOMERNO,
        PASSWORD,
        ACTIVE_FLAG
      FROM APP_CMS.RWSYS_USER
      WHERE USERID = :userId
    `;

    const result = await connection.execute(
      query,
      { userId: userId.toUpperCase() }, // Oracle 通常使用大写字段值
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // 检查用户是否存在
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    const user = result.rows[0];

    // 检查账号是否启用
    if (user.ACTIVE_FLAG !== 'Y') {
      return res.status(403).json({
        success: false,
        error: '该账号已被停用，请联系管理员'
      });
    }

    // 验证密码（MD5哈希对比）
    if (user.PASSWORD !== password) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    // 🔥 准备JWT载荷
    const customerNos = user.CUSTOMERNO ? user.CUSTOMERNO.split(',').map(c => c.trim()).filter(Boolean) : [];
    const isAdmin = customerNos.length === 0 || customerNos.includes('all') || customerNos.includes('ALL');

    const tokenPayload = {
      userId: user.USERID,
      userName: user.USER_NAME_C,
      customerNo: user.CUSTOMERNO || '',
      customerNos: isAdmin ? [] : customerNos,
      isAdmin: isAdmin
    };

    // 🔥 生成Access Token和Refresh Token
    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // 🔥 登录成功，清除速率限制记录
    if (req.rateLimitIdentifier) {
      clearAttempts(req.rateLimitIdentifier);
    }

    console.log('✅ [Auth] 用户登录成功，生成tokens:', {
      userId: user.USERID,
      isAdmin: isAdmin,
      tokenLength: token.length,
      refreshTokenLength: refreshToken.length
    });

    // 登录成功，返回用户信息和tokens
    return res.json({
      success: true,
      user: {
        userId: user.USERID,
        userName: user.USER_NAME_C,
        customerNo: user.CUSTOMERNO || '' // 可查看的品牌范围
      },
      token: token,                 // Access Token（15分钟）
      refreshToken: refreshToken    // Refresh Token（7天）
    });

  } catch (error) {
    console.error('Login API Error:', error);
    return res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

/**
 * POST /api/auth/refresh
 * 刷新Access Token
 * 
 * Request Body:
 * {
 *   refreshToken: string  // Refresh Token
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   token: string,         // 新的Access Token
 *   refreshToken: string,  // 新的Refresh Token（可选：轮换策略）
 *   error?: string
 * }
 */
router.post('/refresh', async (req, res) => {
  let connection;
  
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: '未提供刷新令牌',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    // 验证Refresh Token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      console.error('❌ [Auth] Refresh token验证失败:', error.message);
      return res.status(401).json({
        success: false,
        error: '刷新令牌无效或已过期，请重新登录',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // 从数据库重新获取用户信息（确保用户状态是最新的）
    const dbConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    };

    connection = await oracledb.getConnection(dbConfig);

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
      { userId: decoded.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: '用户不存在或已被停用，请重新登录',
        code: 'USER_INACTIVE'
      });
    }

    const user = result.rows[0];

    // 准备新的token载荷
    const customerNos = user.CUSTOMERNO ? user.CUSTOMERNO.split(',').map(c => c.trim()).filter(Boolean) : [];
    const isAdmin = customerNos.length === 0 || customerNos.includes('all') || customerNos.includes('ALL');

    const tokenPayload = {
      userId: user.USERID,
      userName: user.USER_NAME_C,
      customerNo: user.CUSTOMERNO || '',
      customerNos: isAdmin ? [] : customerNos,
      isAdmin: isAdmin
    };

    // 生成新的Access Token
    const newToken = generateToken(tokenPayload);
    
    // 🔥 可选：实施Refresh Token轮换（更安全）
    // const newRefreshToken = generateRefreshToken(tokenPayload);

    console.log('🔄 [Auth] Token刷新成功:', {
      userId: user.USERID
    });

    return res.json({
      success: true,
      token: newToken
      // refreshToken: newRefreshToken  // 如果启用轮换策略，返回新的refresh token
    });

  } catch (error) {
    console.error('❌ [Auth] Token刷新失败:', error);
    return res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

/**
 * POST /api/auth/logout
 * 登出并撤销Token
 * 需要认证
 * 
 * Request Headers:
 * {
 *   Authorization: Bearer <token>
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
router.post('/logout', verifyToken, (req, res) => {
  try {
    // 将当前token加入黑名单
    if (req.token) {
      revokeToken(req.token);
      console.log('👋 [Auth] 用户登出，token已撤销:', { userId: req.user.userId });
    }

    return res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('❌ [Auth] 登出失败:', error);
    return res.status(500).json({
      success: false,
      error: '登出失败，请稍后重试'
    });
  }
});

/**
 * POST /api/auth/revoke
 * 管理员撤销指定用户的所有Token
 * 需要管理员权限
 * 
 * Request Body:
 * {
 *   userId: string  // 要撤销的用户ID
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
router.post('/revoke', verifyToken, (req, res) => {
  try {
    // 检查是否为管理员
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: '权限不足，仅管理员可执行此操作',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '未指定用户ID'
      });
    }

    // 注意：当前实现使用内存黑名单，无法撤销特定用户的所有token
    // 生产环境应使用Redis，可以通过用户ID查询所有token并撤销
    // 这里只是一个示例接口
    
    console.log(`🔒 [Auth] 管理员 ${req.user.userId} 尝试撤销用户 ${userId} 的token`);
    
    return res.json({
      success: true,
      message: `用户 ${userId} 的token撤销请求已处理`,
      note: '生产环境应配合Redis实现完整的token撤销功能'
    });

  } catch (error) {
    console.error('❌ [Auth] Token撤销失败:', error);
    return res.status(500).json({
      success: false,
      error: '撤销失败，请稍后重试'
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
      return res.status(400).json({
        success: false,
        error: '用户ID不能为空'
      });
    }

    const dbConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    };

    connection = await oracledb.getConnection(dbConfig);

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
      return res.status(401).json({
        success: false,
        error: '会话已失效，请重新登录'
      });
    }

    const user = result.rows[0];

    return res.json({
      success: true,
      user: {
        userId: user.USERID,
        userName: user.USER_NAME_C,
        customerNo: user.CUSTOMERNO || ''
      }
    });

  } catch (error) {
    console.error('Validate API Error:', error);
    return res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

export default router;