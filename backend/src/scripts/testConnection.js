import { initializeDatabase, getConnection, releaseConnection, closeDatabase, executeQuery } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 测试Oracle数据库连接
 */
async function testDatabaseConnection() {
  console.log('🔧 开始测试Oracle数据库连接...');
  console.log('=' .repeat(50));
  
  // 显示连接配置信息（隐藏密码）
  console.log('📋 数据库连接配置:');
  console.log(`   用户名: ${process.env.ORACLE_USER || '未配置'}`);
  console.log(`   连接字符串: ${process.env.ORACLE_CONNECT_STRING || '未配置'}`);
  console.log(`   密码: ${process.env.ORACLE_PASSWORD ? '已配置' : '未配置'}`);
  console.log('=' .repeat(50));
  
  try {
    // 步骤 1: 初始化连接池
    console.log('📡 步骤 1: 初始化数据库连接池...');
    await initializeDatabase();
    console.log('✅ 连接池初始化成功\n');
    
    // 步骤 2: 获取单个连接并测试
    console.log('🔗 步骤 2: 获取数据库连接...');
    const connection = await getConnection();
    console.log('✅ 数据库连接获取成功\n');
    
    // 步骤 3: 执行基本查询测试
    console.log('🔍 步骤 3: 执行基本查询测试...');
    
    // 测试查询 1: 获取当前时间和数据库版本
    console.log('   🕐 测试查询 1: 获取数据库基本信息...');
    const basicInfoResult = await connection.execute(`
      SELECT 
        SYSDATE as CURRENT_TIME,
        USER as CURRENT_USER,
        SYS_CONTEXT('USERENV', 'DB_NAME') as DATABASE_NAME,
        SYS_CONTEXT('USERENV', 'SERVER_HOST') as SERVER_HOST,
        SYS_CONTEXT('USERENV', 'SESSION_USER') as SESSION_USER
      FROM DUAL
    `);
    
    if (basicInfoResult.rows && basicInfoResult.rows.length > 0) {
      const info = basicInfoResult.rows[0];
      console.log('   ✅ 数据库基本信息获取成功:');
      console.log(`      📅 当前时间: ${info.CURRENT_TIME}`);
      console.log(`      👤 当前用户: ${info.CURRENT_USER}`);
      console.log(`      🏢 数据库名: ${info.DATABASE_NAME}`);
      console.log(`      🖥️  服务器主机: ${info.SERVER_HOST}`);
      console.log(`      👥 会话用户: ${info.SESSION_USER}`);
    }
    
    // 测试查询 2: 获取数据库版本信息
    console.log('\n   📊 测试查询 2: 获取数据库版本信息...');
    const versionResult = await connection.execute(`
      SELECT BANNER as VERSION_INFO FROM V$VERSION WHERE ROWNUM = 1
    `);
    
    if (versionResult.rows && versionResult.rows.length > 0) {
      console.log(`   ✅ 数据库版本: ${versionResult.rows[0].VERSION_INFO}`);
    }
    
    // 测试查询 3: 检查表空间信息
    console.log('\n   💾 测试查询 3: 检查用户表空间信息...');
    try {
      const tablespaceResult = await connection.execute(`
        SELECT 
          TABLESPACE_NAME,
          STATUS,
          CONTENTS,
          LOGGING
        FROM USER_TABLESPACES
        WHERE ROWNUM <= 5
      `);
      
      if (tablespaceResult.rows && tablespaceResult.rows.length > 0) {
        console.log('   ✅ 用户表空间信息:');
        tablespaceResult.rows.forEach((ts, index) => {
          console.log(`      ${index + 1}. ${ts.TABLESPACE_NAME} (${ts.STATUS}, ${ts.CONTENTS})`);
        });
      } else {
        console.log('   ℹ️  当前用户没有可访问的表空间信息');
      }
    } catch (tablespaceError) {
      console.log('   ⚠️  无法获取表空间信息（可能是权限限制）');
    }
    
    // 测试查询 4: 列出用户的表
    console.log('\n   📋 测试查询 4: 列出用户表...');
    try {
      const tablesResult = await connection.execute(`
        SELECT 
          TABLE_NAME,
          NUM_ROWS,
          LAST_ANALYZED,
          STATUS
        FROM USER_TABLES
        ORDER BY TABLE_NAME
      `);
      
      if (tablesResult.rows && tablesResult.rows.length > 0) {
        console.log(`   ✅ 找到 ${tablesResult.rows.length} 个用户表:`);
        tablesResult.rows.slice(0, 10).forEach((table, index) => {
          console.log(`      ${index + 1}. ${table.TABLE_NAME} (行数: ${table.NUM_ROWS || 'N/A'})`);
        });
        
        if (tablesResult.rows.length > 10) {
          console.log(`      ... 以及其他 ${tablesResult.rows.length - 10} 个表`);
        }
      } else {
        console.log('   ℹ️  当前用户没有创建任何表');
      }
    } catch (tablesError) {
      console.log('   ⚠️  无法获取用户表信息:', tablesError.message);
    }
    
    // 步骤 4: 释放连接
    console.log('\n🔒 步骤 4: 释放数据库连接...');
    await releaseConnection(connection);
    console.log('✅ 数据库连接已释放\n');
    
    // 步骤 5: 测试executeQuery辅助方法
    console.log('⚡ 步骤 5: 测试executeQuery辅助方法...');
    const helperResult = await executeQuery(`
      SELECT 
        'Connection Test' as TEST_TYPE,
        SYSDATE as TEST_TIME,
        'SUCCESS' as TEST_STATUS
      FROM DUAL
    `);
    
    if (helperResult.rows && helperResult.rows.length > 0) {
      console.log('✅ executeQuery方法测试成功:', helperResult.rows[0]);
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 所有数据库连接测试通过！');
    console.log('✅ Oracle数据库连接配置正确，可以正常使用');
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('\n' + '=' .repeat(50));
    console.error('❌ 数据库连接测试失败!');
    console.error('错误详情:', error.message);
    
    // 提供常见问题的解决建议
    console.error('\n🔧 可能的解决方案:');
    console.error('1. 检查.env文件中的数据库连接配置');
    console.error('2. 确认Oracle数据库服务正在运行');
    console.error('3. 验证用户名和密码是否正确');
    console.error('4. 检查网络连接和防火墙设置');
    console.error('5. 确认Oracle Client已正确安装');
    console.error('=' .repeat(50));
    
    process.exit(1);
  } finally {
    // 确保关闭数据库连接池
    console.log('\n🛑 关闭数据库连接池...');
    await closeDatabase();
    console.log('✅ 测试完成，程序退出');
  }
}

// 执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testDatabaseConnection().catch(error => {
    console.error('💥 测试程序执行失败:', error);
    process.exit(1);
  });
}

export { testDatabaseConnection };