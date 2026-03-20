/**
 * 用户认证路由 (ES6 Module版本)
 * 连接 APP_CMS.RWSYS_USER 表进行用户登录验证
 */

import express from 'express';
import oracledb from 'oracledb';

const router = express.Router();

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
 *   error?: string
 * }
 */
router.post('/login', async (req, res) => {
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

    // 验证密码（简单字符串对比，实际生产环境应该使用加密）
    if (user.PASSWORD !== password) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    // 登录成功，返回用户信息
    return res.json({
      success: true,
      user: {
        userId: user.USERID,
        userName: user.USER_NAME_C,
        customerNo: user.CUSTOMERNO || '' // 可查看的品牌范围
      }
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
