/**
 * 用户认证路由
 * 连接 APP_CMS.RWSYS_USER 表进行用户登录验证
 */

const express = require('express');
const router = express.Router();
const oracledb = require('oracledb');
const { getConnection, releaseConnection } = require('../config/database-api');
const { generateToken } = require('../middleware/authMiddleware'); // 🔥 JWT生成函数
const { loginRateLimit } = require('../middleware/rateLimitMiddleware'); // 🔥 防暴力破解中间件

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
  body: JSON.stringify({ userId: 'admin', password: 'admin123' })
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
 *   password: string   // 密码
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
 *   token: string,  // 🔥 JWT token
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

    // 获取数据库连接（从连接池）
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
      { userId: userId }, // 不转换大小写，让SQL处理
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

    // 验证密码
    if (user.PASSWORD !== password) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    // 🔥 登录成功，清除尝试记录
    if (req.clearLoginAttempts) {
      req.clearLoginAttempts();
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

    // 🔥 生成JWT token
    const token = generateToken(tokenPayload);

    console.log('✅ [Auth] 用户登录成功，生成token:', {
      userId: user.USERID,
      isAdmin: isAdmin,
      tokenLength: token.length
    });

    // 登录成功，返回用户信息和token
    return res.json({
      success: true,
      user: {
        userId: user.USERID,
        userName: user.USER_NAME_C,
        customerNo: user.CUSTOMERNO || '' // 可查看的品牌范围
      },
      token: token // 🔥 返回JWT token
    });

  } catch (error) {
    console.error('❌ Login API Error:', error);
    return res.status(500).json({
      success: false,
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
    console.error('❌ Validate API Error:', error);
    return res.status(500).json({
      success: false,
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