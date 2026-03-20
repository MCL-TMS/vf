/**
 * MD5兼容的安全认证路由
 * 适用于只读数据库权限的场景
 * 
 * 特点：
 * - 前端发送MD5哈希后的密码
 * - 后端直接对比MD5哈希
 * - 不需要数据库写入权限
 * - 集成JWT Token、速率限制、输入验证
 */

const express = require('express');
const router = express.Router();
const oracledb = require('oracledb');
const { getConnection, releaseConnection } = require('../config/database-api');
const { 
  generateToken,
  refreshToken,
  authenticateToken,
  loginRateLimiter,
  validateLogin,
  checkValidationResult
} = require('../middleware/security');

/**
 * GET /api/auth/login
 * 返回端点使用说明
 */
router.get('/login', (req, res) => {
  res.status(200).json({
    message: '✅ MD5认证端点工作正常',
    method: 'POST',
    endpoint: '/api/auth/login',
    security: {
      encryption: 'MD5 (frontend)',
      authentication: 'JWT',
      rateLimit: '5 attempts per 5 minutes'
    },
    usage: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        userId: 'your_username',
        password: 'md5_hashed_password (32-char hex)'
      }
    },
    note: '⚠️ Password should be MD5-hashed on frontend before sending'
  });
});

/**
 * POST /api/auth/login
 * MD5密码登录（安全增强版）
 * 
 * Features:
 * - MD5密码验证（前端已加密）
 * - JWT Token生成
 * - 速率限制（5次/5分钟）
 * - 输入验证
 * - 安全日志记录
 * 
 * Request Body:
 * {
 *   userId: string,
 *   password: string  // MD5哈希值（32位十六进制）
 * }
 */
router.post('/login',
  loginRateLimiter,          // 速率限制
  validateLogin,             // 输入验证
  checkValidationResult,     // 验证结果检查
  async (req, res) => {
    let connection;
    
    try {
      const { userId, password } = req.body; // password已是MD5哈希
      
      // 记录登录尝试（不记录密码）
      console.log(`🔐 [AUTH-MD5] 登录尝试: ${userId} from ${req.ip}`);
      
      // ✅ 验证MD5格式（32位十六进制字符串）
      if (!/^[a-f0-9]{32}$/i.test(password)) {
        console.log(`❌ [AUTH-MD5] 密码格式错误: ${userId} (非MD5格式)`);
        return res.status(400).json({
          success: false,
          error: '密码格式错误',
          code: 'INVALID_PASSWORD_FORMAT',
          hint: '前端应发送MD5哈希后的密码（32位十六进制）'
        });
      }
      
      // 获取数据库连接
      connection = await getConnection();
      
      // 查询用户信息
      const query = `
        SELECT 
          USERID,
          USER_NAME_C,
          CUSTOMERNO,
          PASSWORD,
          ACTIVE_FLAG
        FROM APP_CMS.RWSYS_USER
        WHERE UPPER(USERID) = UPPER(:userId)
      `;
      
      const result = await connection.execute(
        query,
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      
      // 检查用户是否存在
      if (result.rows.length === 0) {
        console.log(`❌ [AUTH-MD5] 用户不存在: ${userId}`);
        return res.status(401).json({
          success: false,
          error: '用户名或密码错误',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      const user = result.rows[0];
      
      // 检查账号是否启用
      if (user.ACTIVE_FLAG !== 'Y') {
        console.log(`⚠️ [AUTH-MD5] 账号已停用: ${userId}`);
        return res.status(403).json({
          success: false,
          error: '该账号已被停用，请联系管理员',
          code: 'ACCOUNT_DISABLED'
        });
      }
      
      // ✅ 对比MD5哈希（不区分大小写）
      if (user.PASSWORD.toLowerCase() !== password.toLowerCase()) {
        console.log(`❌ [AUTH-MD5] 密码错误: ${userId}`);
        return res.status(401).json({
          success: false,
          error: '用户名或密码错误',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      // ✅ 登录成功，生成JWT Token
      const token = generateToken({
        userId: user.USERID,
        userName: user.USER_NAME_C,
        customerNo: user.CUSTOMERNO || ''
      }, '8h'); // Token有效期8小时
      
      console.log(`✅ [AUTH-MD5] 登录成功: ${userId}`);
      
      // 返回成功响应
      return res.json({
        success: true,
        token,
        user: {
          userId: user.USERID,
          userName: user.USER_NAME_C,
          customerNo: user.CUSTOMERNO || ''
        },
        expiresIn: '8h'
      });
      
    } catch (error) {
      console.error('❌ [AUTH-MD5] Login Error:', error);
      return res.status(500).json({
        success: false,
        error: '服务器错误，请稍后重试',
        code: 'SERVER_ERROR'
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
  }
);

/**
 * POST /api/auth/validate
 * 验证Token是否有效
 * 
 * Request Headers:
 * Authorization: Bearer <token>
 */
router.post('/validate',
  authenticateToken, // JWT验证中间件
  async (req, res) => {
    let connection;
    
    try {
      const { userId } = req.user; // 从Token中获取
      
      // 从数据库验证用户状态
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
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: '会话已失效，请重新登录',
          code: 'SESSION_INVALID'
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
      console.error('❌ [AUTH-MD5] Validate Error:', error);
      return res.status(500).json({
        success: false,
        error: '服务器错误',
        code: 'SERVER_ERROR'
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
  }
);

/**
 * POST /api/auth/refresh
 * 刷新Token（Token快过期时使用）
 * 
 * Request Headers:
 * Authorization: Bearer <old_token>
 */
router.post('/refresh',
  authenticateToken,
  (req, res) => {
    try {
      const oldToken = req.headers.authorization.split(' ')[1];
      const newToken = refreshToken(oldToken);
      
      console.log(`🔄 [AUTH-MD5] Token刷新: ${req.user.userId}`);
      
      return res.json({
        success: true,
        token: newToken,
        expiresIn: '8h'
      });
    } catch (error) {
      console.error('❌ [AUTH-MD5] Refresh Token Error:', error);
      return res.status(401).json({
        success: false,
        error: 'Token刷新失败，请重新登录',
        code: 'REFRESH_FAILED'
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * 登出（可选，主要用于记录日志）
 * 
 * Request Headers:
 * Authorization: Bearer <token>
 */
router.post('/logout',
  authenticateToken,
  (req, res) => {
    console.log(`🔓 [AUTH-MD5] 用户登出: ${req.user.userId}`);
    
    // 注意：JWT是无状态的，无法真正"删除"Token
    // 前端需要清除本地存储的Token
    // 如需实现真正的登出，需要维护Token黑名单（Redis）
    
    return res.json({
      success: true,
      message: '登出成功'
    });
  }
);

module.exports = router;
