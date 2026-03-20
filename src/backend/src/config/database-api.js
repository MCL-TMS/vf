/**
 * VF物流数据分析平台 - API数据库连接配置
 * 
 * 为API路由提供兼容的CommonJS格式数据库连接
 * 使用与现有配置完全相同的连接参数
 */

const oracledb = require('oracledb');
require('dotenv').config();

// 使用与现有配置相同的环境变量
const dbConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
  poolMin: parseInt(process.env.ORACLE_POOL_MIN) || 2,
  poolMax: parseInt(process.env.ORACLE_POOL_MAX) || 10,
  poolIncrement: parseInt(process.env.ORACLE_POOL_INCREMENT) || 2,
  poolTimeout: parseInt(process.env.ORACLE_POOL_TIMEOUT) || 60,
  stmtCacheSize: 23,
  outFormat: oracledb.OUT_FORMAT_OBJECT,
  autoCommit: false,
  // 🔥 增加超时配置（解决大数据查询超时）
  fetchArraySize: 1000,  // 每次获取1000行
  queueTimeout: 60000,   // 队列超时60秒
  _enableStats: true      // 启用连接池统计
};

let pool = null;

/**
 * 初始化数据库连接池
 */
async function initializeDatabase() {
  try {
    if (!pool) {
      console.log('正在初始化Oracle数据库连接池...');
      pool = await oracledb.createPool(dbConfig);
      console.log('✅ Oracle数据库连接池创建成功');
      console.log(`📊 连接池配置: Min=${dbConfig.poolMin}, Max=${dbConfig.poolMax}, Increment=${dbConfig.poolIncrement}`);
    }
    return pool;
  } catch (error) {
    console.error('❌ 数据库连接池创建失败:', error);
    throw error;
  }
}

/**
 * 获取数据库连接
 */
async function getConnection() {
  try {
    if (!pool) {
      await initializeDatabase();
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
async function releaseConnection(connection) {
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
 * 测试数据库连接
 */
async function testConnection() {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute(
      `SELECT 'Database connection successful' as message, 
              SYSDATE as current_time, 
              USER as current_user 
       FROM DUAL`
    );
    
    console.log('✅ 数据库连接测试成功:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ 数据库连接测试失败:', error);
    return false;
  } finally {
    if (connection) {
      await releaseConnection(connection);
    }
  }
}

/**
 * 执行查询 - 简化的查询方法
 */
async function executeQuery(sql, params = [], options = {}) {
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
 * 关闭数据库连接池
 */
async function closeDatabase() {
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
 * 测试DateHelper功能的单元测试
 */
function testDateHelper() {
  console.log('\n🧪 开始测试DateHelper功能...');
  
  // 测试安全日期格式化
  const testDate = new Date('2024-03-31');
  const formatted = DateHelper.formatDateSafe(testDate);
  console.log(`✅ 日期格式化测试: ${testDate.toISOString()} -> ${formatted}`);
  
  // 测试环比计算 - 跨月场景
  const momResult = DateHelper.calculateMoMDateRange('2024-03-31', '2024-03-31');
  console.log(`✅ 环比计算测试 (3月31日): ${momResult.lastMonthFrom} - ${momResult.lastMonthTo}`);
  
  // 测试环比计算 - 2月场景
  const febMomResult = DateHelper.calculateMoMDateRange('2024-03-29', '2024-03-31');
  console.log(`✅ 环比计算测试 (3月29-31日): ${febMomResult.lastMonthFrom} - ${febMomResult.lastMonthTo}`);
  
  // 测试同比计算 - 闰年场景
  const yoyResult = DateHelper.calculateYoYDateRange('2024-02-29', '2024-02-29');
  console.log(`✅ 同比计算测试 (闰年2月29日): ${yoyResult.lastYearFrom} - ${yoyResult.lastYearTo}`);
  
  // 测试日期验证
  const validDate = DateHelper.isValidDateString('2024-03-31');
  const invalidDate = DateHelper.isValidDateString('2024-13-32');
  console.log(`✅ 日期验证测试: 2024-03-31 -> ${validDate}, 2024-13-32 -> ${invalidDate}`);
  
  console.log('✅ DateHelper功能测试完成\n');
}

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

/**
 * 日期处理工具函数 - 解决时区和跨月计算问题
 */
class DateHelper {
  /**
   * 安全的本地日期格式化，避免时区偏移问题
   * @param {Date} date - 要格式化的日期
   * @returns {string} YYYY-MM-DD格式的日期字符串
   */
  static formatDateSafe(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 安全的月份减法，正确处理跨月场景
   * @param {Date} date - 原始日期
   * @param {number} months - 要减去的月数
   * @returns {Date} 计算后的日期
   */
  static subtractMonthsSafe(date, months) {
    const result = new Date(date);
    const originalDay = result.getDate();
    
    // 先设置为当月1号，避免跨月时的日期溢出
    result.setDate(1);
    result.setMonth(result.getMonth() - months);
    
    // 获取目标月份的最后一天
    const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    
    // 设置为原日期或目标月份的最后一天（取较小值）
    result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
    
    return result;
  }

  /**
   * 安全的年份减法
   * @param {Date} date - 原始日期
   * @param {number} years - 要减去的年数
   * @returns {Date} 计算后的日期
   */
  static subtractYearsSafe(date, years) {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() - years);
    
    // 处理闰年2月29日的特殊情况
    if (result.getMonth() === 1 && result.getDate() === 29) {
      // 如果目标年份不是闰年，调整为2月28日
      const targetYear = result.getFullYear();
      const isLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
      if (!isLeapYear) {
        result.setDate(28);
      }
    }
    
    return result;
  }

  /**
   * 计算环比日期范围（上月同期）
   * @param {string} dateFrom - 开始日期字符串
   * @param {string} dateTo - 结束日期字符串
   * @returns {object} 包含lastMonthFrom和lastMonthTo的对象
   */
  static calculateMoMDateRange(dateFrom, dateTo) {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    
    const lastMonthFrom = this.subtractMonthsSafe(fromDate, 1);
    const lastMonthTo = this.subtractMonthsSafe(toDate, 1);
    
    return {
      lastMonthFrom: this.formatDateSafe(lastMonthFrom),
      lastMonthTo: this.formatDateSafe(lastMonthTo)
    };
  }

  /**
   * 计算同比日期范围（去年同期）
   * @param {string} dateFrom - 开始日期字符串
   * @param {string} dateTo - 结束日期字符串
   * @returns {object} 包含lastYearFrom和lastYearTo的对象
   */
  static calculateYoYDateRange(dateFrom, dateTo) {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    
    const lastYearFrom = this.subtractYearsSafe(fromDate, 1);
    const lastYearTo = this.subtractYearsSafe(toDate, 1);
    
    return {
      lastYearFrom: this.formatDateSafe(lastYearFrom),
      lastYearTo: this.formatDateSafe(lastYearTo)
    };
  }

  /**
   * 验证日期字符串格式
   * @param {string} dateStr - 日期字符串
   * @returns {boolean} 是否为有效的YYYY-MM-DD格式
   */
  static isValidDateString(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date) && this.formatDateSafe(date) === dateStr;
  }

  /**
   * 获取当前日期的安全格式
   * @returns {string} 当前日期的YYYY-MM-DD格式
   */
  static getCurrentDateSafe() {
    return this.formatDateSafe(new Date());
  }
}

// CommonJS导出
module.exports = {
  initializeDatabase,
  getConnection,
  releaseConnection,
  testConnection,
  executeQuery,
  closeDatabase,
  dbConfig,
  DateHelper,
  testDateHelper
};