import oracledb from 'oracledb';
import dotenv from 'dotenv';

dotenv.config();

// Oracle数据库连接配置
const dbConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
  poolMin: parseInt(process.env.ORACLE_POOL_MIN) || 2,
  poolMax: parseInt(process.env.ORACLE_POOL_MAX) || 10,
  poolIncrement: parseInt(process.env.ORACLE_POOL_INCREMENT) || 2,
  poolTimeout: parseInt(process.env.ORACLE_POOL_TIMEOUT) || 60,
  stmtCacheSize: 23,
  // 设置获取结果为对象格式而不是数组
  outFormat: oracledb.OUT_FORMAT_OBJECT,
  // 启用自动提交（根据需要调整）
  autoCommit: false
};

let pool = null;

/**
 * 初始化数据库连接池
 */
export async function initializeDatabase() {
  try {
    console.log('正在初始化Oracle数据库连接池...');
    
    // 创建连接池
    pool = await oracledb.createPool(dbConfig);
    
    console.log('✅ Oracle数据库连接池创建成功');
    console.log(`📊 连接池配置: Min=${dbConfig.poolMin}, Max=${dbConfig.poolMax}, Increment=${dbConfig.poolIncrement}`);
    
    return pool;
  } catch (error) {
    console.error('❌ 数据库连接池创建失败:', error);
    throw error;
  }
}

/**
 * 获取数据库连接
 */
export async function getConnection() {
  try {
    if (!pool) {
      throw new Error('数据库连接池未初始化，请先调用 initializeDatabase()');
    }
    
    const connection = await pool.getConnection();
    console.log('🔗 获取数据库连接成功');
    
    return connection;
  } catch (error) {
    console.error('❌ 获取数据库连接失败:', error);
    throw error;
  }
}

/**
 * 释放数据库连接
 */
export async function releaseConnection(connection) {
  try {
    if (connection) {
      await connection.close();
      console.log('🔒 数据库连接已释放');
    }
  } catch (error) {
    console.error('❌ 释放数据库连接时出错:', error);
  }
}

/**
 * 关闭数据库连接池
 */
export async function closeDatabase() {
  try {
    if (pool) {
      await pool.close(0);
      pool = null;
      console.log('✅ 数据库连接池已关闭');
    }
  } catch (error) {
    console.error('❌ 关闭数据库连接池时出错:', error);
  }
}

/**
 * 执行查询 - 简化的查询方法
 */
export async function executeQuery(sql, params = [], options = {}) {
  let connection;
  
  try {
    connection = await getConnection();
    
    console.log('🔍 执行SQL查询:', sql.substring(0, 100) + (sql.length > 100 ? '...' : ''));
    if (params.length > 0) {
      console.log('📝 查询参数:', params);
    }
    
    const result = await connection.execute(sql, params, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: options.autoCommit || false,
      ...options
    });
    
    console.log(`✅ 查询执行成功，返回 ${result.rows ? result.rows.length : 0} 行数据`);
    
    return result;
  } catch (error) {
    console.error('❌ SQL查询执行失败:', error);
    console.error('🔍 SQL语句:', sql);
    console.error('📝 参数:', params);
    throw error;
  } finally {
    if (connection) {
      await releaseConnection(connection);
    }
  }
}

/**
 * 执行事务 - 支持多个操作的事务处理
 */
export async function executeTransaction(operations) {
  let connection;
  
  try {
    connection = await getConnection();
    
    console.log('🔄 开始执行事务，包含', operations.length, '个操作');
    
    const results = [];
    
    for (const operation of operations) {
      const { sql, params = [], options = {} } = operation;
      
      console.log('📋 执行事务操作:', sql.substring(0, 80) + '...');
      
      const result = await connection.execute(sql, params, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: false,
        ...options
      });
      
      results.push(result);
    }
    
    // 提交事务
    await connection.commit();
    console.log('✅ 事务提交成功');
    
    return results;
  } catch (error) {
    console.error('❌ 事务执行失败:', error);
    
    // 回滚事务
    if (connection) {
      try {
        await connection.rollback();
        console.log('🔙 事务已回滚');
      } catch (rollbackError) {
        console.error('❌ 事务回滚失败:', rollbackError);
      }
    }
    
    throw error;
  } finally {
    if (connection) {
      await releaseConnection(connection);
    }
  }
}

// 导出数据库配置供其他模块使用
export { dbConfig };

// 处理进程退出时关闭数据库连接
process.on('SIGINT', async () => {
  console.log('\n🛑 接收到SIGINT信号，正在关闭数据库连接...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 接收到SIGTERM信号，正在关闭数据库连接...');
  await closeDatabase();
  process.exit(0);
});