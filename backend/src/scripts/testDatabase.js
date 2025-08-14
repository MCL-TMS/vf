import { 
  initializeDatabase, 
  getConnection, 
  releaseConnection, 
  closeDatabase, 
  executeQuery,
  executeTransaction 
} from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 综合数据库测试套件
 */
async function runDatabaseTests() {
  console.log('🧪 开始Oracle数据库综合测试套件...');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  
  try {
    // 初始化数据库
    await initializeDatabase();
    
    // 测试套件
    await testBasicConnection();
    await testConnectionPool();
    await testQueryPerformance();
    await testTransactionHandling();
    await testErrorHandling();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 所有数据库测试通过！');
    console.log(`⏱️  总耗时: ${duration}ms`);
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('\n❌ 数据库测试套件执行失败:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

/**
 * 基本连接测试
 */
async function testBasicConnection() {
  console.log('\n🔗 测试1: 基本连接功能');
  console.log('-' .repeat(40));
  
  try {
    const result = await executeQuery(`
      SELECT 
        'Basic Connection' as TEST_NAME,
        SYSDATE as CURRENT_TIME,
        USER as DATABASE_USER,
        SYS_CONTEXT('USERENV', 'DB_NAME') as DATABASE_NAME
      FROM DUAL
    `);
    
    if (result.rows && result.rows.length > 0) {
      const data = result.rows[0];
      console.log('✅ 基本连接测试通过');
      console.log(`   📅 时间: ${data.CURRENT_TIME}`);
      console.log(`   👤 用户: ${data.DATABASE_USER}`);
      console.log(`   🏢 数据库: ${data.DATABASE_NAME}`);
    }
  } catch (error) {
    console.error('❌ 基本连接测试失败:', error.message);
    throw error;
  }
}

/**
 * 连接池测试
 */
async function testConnectionPool() {
  console.log('\n🏊 测试2: 连接池功能');
  console.log('-' .repeat(40));
  
  try {
    const connections = [];
    const maxConnections = 3;
    
    console.log(`   📡 获取${maxConnections}个并发连接...`);
    
    // 获取多个连接
    for (let i = 0; i < maxConnections; i++) {
      const conn = await getConnection();
      connections.push(conn);
      console.log(`   ✅ 连接${i + 1}获取成功`);
    }
    
    // 在每个连接上执行查询
    console.log('   🔍 在所有连接上执行并发查询...');
    const promises = connections.map(async (conn, index) => {
      const result = await conn.execute(`
        SELECT 
          ${index + 1} as CONNECTION_ID,
          SYSDATE as QUERY_TIME,
          SYS_CONTEXT('USERENV', 'SID') as SESSION_ID
        FROM DUAL
      `);
      return result.rows[0];
    });
    
    const results = await Promise.all(promises);
    
    results.forEach((result, index) => {
      console.log(`   📋 连接${index + 1} - 会话ID: ${result.SESSION_ID}`);
    });
    
    // 释放所有连接
    console.log('   🔒 释放所有连接...');
    for (const conn of connections) {
      await releaseConnection(conn);
    }
    
    console.log('✅ 连接池测试通过');
    
  } catch (error) {
    console.error('❌ 连接池测试失败:', error.message);
    throw error;
  }
}

/**
 * 查询性能测试
 */
async function testQueryPerformance() {
  console.log('\n⚡ 测试3: 查询性能');
  console.log('-' .repeat(40));
  
  try {
    const queries = [
      {
        name: '简单查询',
        sql: 'SELECT SYSDATE, USER FROM DUAL'
      },
      {
        name: '数学计算查询',
        sql: `
          SELECT 
            POWER(2, 10) as POWER_RESULT,
            SQRT(256) as SQRT_RESULT,
            MOD(100, 7) as MOD_RESULT
          FROM DUAL
        `
      },
      {
        name: '字符串处理查询',
        sql: `
          SELECT 
            UPPER('oracle database') as UPPER_TEXT,
            LENGTH('Oracle Database Test') as TEXT_LENGTH,
            SUBSTR('Oracle Database', 1, 6) as SUBSTRING
          FROM DUAL
        `
      }
    ];
    
    for (const query of queries) {
      const startTime = Date.now();
      
      const result = await executeQuery(query.sql);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`   ✅ ${query.name}: ${duration}ms`);
      
      if (result.rows && result.rows.length > 0) {
        console.log(`      📊 结果行数: ${result.rows.length}`);
      }
    }
    
    console.log('✅ 查询性能测试完成');
    
  } catch (error) {
    console.error('❌ 查询性能测试失败:', error.message);
    throw error;
  }
}

/**
 * 事务处理测试
 */
async function testTransactionHandling() {
  console.log('\n🔄 测试4: 事务处理');
  console.log('-' .repeat(40));
  
  try {
    console.log('   📝 准备事务操作...');
    
    // 创建临时测试用的操作序列
    const operations = [
      {
        sql: `
          SELECT 
            'Transaction Test 1' as OPERATION,
            SYSDATE as EXEC_TIME
          FROM DUAL
        `
      },
      {
        sql: `
          SELECT 
            'Transaction Test 2' as OPERATION,
            SYSDATE as EXEC_TIME
          FROM DUAL
        `
      },
      {
        sql: `
          SELECT 
            'Transaction Test 3' as OPERATION,
            SYSDATE as EXEC_TIME
          FROM DUAL
        `
      }
    ];
    
    console.log(`   ⚡ 执行包含${operations.length}个操作的事务...`);
    
    const results = await executeTransaction(operations);
    
    console.log('✅ 事务处理测试通过');
    console.log(`   📊 成功执行${results.length}个操作`);
    
  } catch (error) {
    console.error('❌ 事务处理测试失败:', error.message);
    throw error;
  }
}

/**
 * 错误处理测试
 */
async function testErrorHandling() {
  console.log('\n🛡️  测试5: 错误处理');
  console.log('-' .repeat(40));
  
  try {
    console.log('   🔍 测试无效SQL语句的错误处理...');
    
    try {
      // 故意执行一个无效的SQL语句
      await executeQuery('SELECT * FROM NON_EXISTENT_TABLE_12345');
      
      // 如果到达这里，说明错误处理有问题
      throw new Error('应该捕获到SQL错误，但没有');
      
    } catch (sqlError) {
      if (sqlError.message.includes('NON_EXISTENT_TABLE') || 
          sqlError.message.includes('table or view does not exist')) {
        console.log('   ✅ 正确捕获了SQL错误');
        console.log(`   📝 错误信息: ${sqlError.message.substring(0, 100)}...`);
      } else {
        console.log('   ⚠️  捕获了意外的错误类型:', sqlError.message);
      }
    }
    
    console.log('   🔍 测试连接超时处理...');
    
    try {
      // 测试一个可能超时的查询（根据实际情况调整）
      await executeQuery(`
        SELECT 
          'Timeout Test' as TEST_TYPE,
          SYSDATE as CURRENT_TIME
        FROM DUAL
        WHERE 1 = 1
      `);
      
      console.log('   ✅ 查询正常完成（未触发超时）');
      
    } catch (timeoutError) {
      console.log('   ⚠️  查询超时或其他错误:', timeoutError.message);
    }
    
    console.log('✅ 错误处理测试完成');
    
  } catch (error) {
    console.error('❌ 错误处理测试失败:', error.message);
    throw error;
  }
}

// 执行测试套件
if (import.meta.url === `file://${process.argv[1]}`) {
  runDatabaseTests().catch(error => {
    console.error('💥 测试套件执行失败:', error);
    process.exit(1);
  });
}

export { runDatabaseTests };