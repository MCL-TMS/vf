/**
 * 安全增强版用户认证路由
 * 包含：bcrypt密码加密、JWT Token、速率限制、输入验证
 */

const express = require('express');
const router = express.Router();
const oracledb = require('oracledb');
const { getConnection, releaseConnection } = require('../config/database-api');
const { hashPassword, verifyPassword, validatePasswordStrength } = require('../utils/passwordUtils');
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
    message: '✅ 安全认证端点工作正常',
    method: 'POST',
    endpoint: '/api/auth/login',
    security: {
      encryption: 'bcrypt',
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
        password: 'your_password'
      }
    }
  });
});

/**
 * POST /api/auth/login
 * 用户登录接口（安全增强版）
 * 
 * Features:
 * - bcrypt密码验证
 * - JWT Token生成
 * - 速率限制（5次/5分钟）
 * - 输入验证
 * - 安全日志记录
 */
router.post('/login',
  loginRateLimiter,          // 速率限制
  validateLogin,             // 输入验证
  checkValidationResult,     // 验证结果检查
  async (req, res) => {
    let connection;
    
    try {
      const { userId, password } = req.body;
      
      // 记录登录尝试（不记录密码）
      console.log(`🔐 [AUTH] 登录尝试: ${userId} from ${req.ip}`);
      
      // 获取数据库连接
      connection = await getConnection();
      
      // 查询用户信息
      const query = `
        SELECT 
          USERID,
          USER_NAME_C,
          CUSTOMERNO,
          PASSWORD,
          ACTIVE_FLAG,
          LAST_LOGIN_TIME
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
        console.log(`❌ [AUTH] 用户不存在: ${userId}`);
        return res.status(401).json({
          success: false,
          error: '用户名或密码错误',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      const user = result.rows[0];
      
      // 检查账号是否启用
      if (user.ACTIVE_FLAG !== 'Y') {
        console.log(`⚠️ [AUTH] 账号已停用: ${userId}`);
        return res.status(403).json({
          success: false,
          error: '该账号已被停用，请联系管理员',
          code: 'ACCOUNT_DISABLED'
        });
      }
      
      // ✅ 验证密码（使用bcrypt）
      const isPasswordValid = await verifyPassword(password, user.PASSWORD);
      
      if (!isPasswordValid) {
        console.log(`❌ [AUTH] 密码错误: ${userId}`);
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
      
      // 更新最后登录时间
      await connection.execute(
        `UPDATE APP_CMS.RWSYS_USER 
         SET LAST_LOGIN_TIME = SYSDATE 
         WHERE USERID = :userId`,
        { userId: user.USERID },
        { autoCommit: true }
      );
      
      console.log(`✅ [AUTH] 登录成功: ${userId}`);
      
      // 返回成功响应
      return res.json({
        success: true,
        token,
        user: {
          userId: user.USERID,
          userName: user.USER_NAME_C,
          customerNo: user.CUSTOMERNO || '',
          lastLogin: user.LAST_LOGIN_TIME
        },
        expiresIn: '8h'
      });
      
    } catch (error) {
      console.error('❌ [AUTH] Login Error:', error);
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
      console.error('❌ [AUTH] Validate Error:', error);
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
      
      return res.json({
        success: true,
        token: newToken,
        expiresIn: '8h'
      });
    } catch (error) {
      console.error('❌ [AUTH] Refresh Token Error:', error);
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
    console.log(`🔓 [AUTH] 用户登出: ${req.user.userId}`);
    
    // 注意：JWT是无状态的，无法真正"删除"Token
    // 前端需要清除本地存储的Token
    // 如需实现真正的登出，需要维护Token黑名单（Redis）
    
    return res.json({
      success: true,
      message: '登出成功'
    });
  }
);

/**
 * POST /api/auth/change-password
 * 修改密码
 * 
 * Request Headers:
 * Authorization: Bearer <token>
 * 
 * Request Body:
 * {
 *   oldPassword: string,
 *   newPassword: string
 * }
 */
router.post('/change-password',
  loginRateLimiter,
  authenticateToken,
  async (req, res) => {
    let connection;
    
    try {
      const { userId } = req.user;
      const { oldPassword, newPassword } = req.body;
      
      // 验证输入
      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: '请提供旧密码和新密码',
          code: 'MISSING_PARAMS'
        });
      }
      
      // 验证新密码强度
      const strengthCheck = validatePasswordStrength(newPassword);
      if (!strengthCheck.valid) {
        return res.status(400).json({
          success: false,
          error: strengthCheck.message,
          code: 'WEAK_PASSWORD'
        });
      }
      
      // 获取数据库连接
      connection = await getConnection();
      
      // 查询当前密码
      const result = await connection.execute(
        `SELECT PASSWORD FROM APP_CMS.RWSYS_USER WHERE USERID = :userId`,
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: '用户不存在',
          code: 'USER_NOT_FOUND'
        });
      }
      
      // 验证旧密码
      const isOldPasswordValid = await verifyPassword(
        oldPassword,
        result.rows[0].PASSWORD
      );
      
      if (!isOldPasswordValid) {
        return res.status(401).json({
          success: false,
          error: '旧密码错误',
          code: 'INVALID_OLD_PASSWORD'
        });
      }
      
      // 加密新密码
      const hashedNewPassword = await hashPassword(newPassword);
      
      // 更新密码
      await connection.execute(
        `UPDATE APP_CMS.RWSYS_USER 
         SET PASSWORD = :newPassword
         WHERE USERID = :userId`,
        {
          newPassword: hashedNewPassword,
          userId
        },
        { autoCommit: true }
      );
      
      console.log(`✅ [AUTH] 密码修改成功: ${userId}`);
      
      return res.json({
        success: true,
        message: '密码修改成功',
        passwordStrength: strengthCheck.strength
      });
      
    } catch (error) {
      console.error('❌ [AUTH] Change Password Error:', error);
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

module.exports = router;
