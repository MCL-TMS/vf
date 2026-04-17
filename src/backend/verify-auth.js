/**
 * 完整认证流程测试脚本
 * 用于验证数据库连接、用户表和登录API是否正常工作
 */

const oracledb = require('oracledb');
const { getConnection, releaseConnection } = require('./src/config/database-api');
const { verifyAndUpgradePassword } = require('./src/utils/passwordUtils');

// 测试账号列表示例
// 使用 AUTH_TEST_ACCOUNTS 环境变量传入 JSON 数组，避免在仓库中硬编码账号口令。
const TEST_ACCOUNTS = (() => {
  const rawValue = process.env.AUTH_TEST_ACCOUNTS;

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('❌ AUTH_TEST_ACCOUNTS 解析失败，请提供合法的JSON数组');
    return [];
  }
})();

async function testDatabaseConnection() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 步骤1: 测试数据库连接');
  console.log('='.repeat(60));
  
  let connection;
  try {
    connection = await getConnection();
    console.log('✅ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  } finally {
    if (connection) {
      await releaseConnection(connection);
    }
  }
}

async function testUserTable() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 步骤2: 检查用户表结构');
  console.log('='.repeat(60));
  
  let connection;
  try {
    connection = await getConnection();
    
    // 检查表是否存在
    const tableCheck = await connection.execute(
      `SELECT COUNT(*) as CNT FROM USER_TABLES WHERE TABLE_NAME = 'RWSYS_USER'`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (tableCheck.rows[0].CNT === 0) {
      console.error('❌ RWSYS_USER 表不存在');
      return false;
    }
    
    console.log('✅ RWSYS_USER 表存在');
    
    // 查询表中的记录数
    const countResult = await connection.execute(
      `SELECT COUNT(*) as CNT FROM APP_CMS.RWSYS_USER`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    const userCount = countResult.rows[0].CNT;
    console.log(`✅ 表中共有 ${userCount} 个用户`);
    
    if (userCount === 0) {
      console.log('⚠️  表是空的，请运行 setup-test-users.sql 创建测试账号');
      return false;
    }
    
    // 列出所有用户
    const usersResult = await connection.execute(
      `SELECT USERID, USER_NAME_C, CUSTOMERNO, ACTIVE_FLAG 
       FROM APP_CMS.RWSYS_USER 
       ORDER BY USERID`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    console.log('\n📝 现有用户列表:');
    console.log('-'.repeat(60));
    usersResult.rows.forEach(user => {
      const status = user.ACTIVE_FLAG === 'Y' ? '✅' : '❌';
      const brands = user.CUSTOMERNO || '全部品牌（管理员）';
      console.log(`${status} ${user.USERID.padEnd(15)} | ${user.USER_NAME_C.padEnd(20)} | ${brands}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ 检查用户表失败:', error.message);
    return false;
  } finally {
    if (connection) {
      await releaseConnection(connection);
    }
  }
}

async function testLoginLogic(userId, password) {
  let connection;
  try {
    connection = await getConnection();
    
    // 模拟登录逻辑
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
      { userId: userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (result.rows.length === 0) {
      return { success: false, error: '用户不存在' };
    }
    
    const user = result.rows[0];
    
    if (user.ACTIVE_FLAG !== 'Y') {
      return { success: false, error: '账号已停用' };
    }
    
    const passwordCheck = await verifyAndUpgradePassword(password, user.PASSWORD);

    if (!passwordCheck.isValid) {
      return { success: false, error: '密码错误' };
    }
    
    return {
      success: true,
      user: {
        userId: user.USERID,
        userName: user.USER_NAME_C,
        customerNo: user.CUSTOMERNO || ''
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    if (connection) {
      await releaseConnection(connection);
    }
  }
}

async function testAllAccounts() {
  console.log('\n' + '='.repeat(60));
  console.log('🔐 步骤3: 测试所有测试账号');
  console.log('='.repeat(60));

  if (TEST_ACCOUNTS.length === 0) {
    console.log('⚠️ 未配置 AUTH_TEST_ACCOUNTS，跳过账号登录测试');
    return;
  }
  
  for (const account of TEST_ACCOUNTS) {
    const result = await testLoginLogic(account.userId, account.password);
    
    if (result.success) {
      console.log(`✅ ${account.userId.padEnd(15)} | ${account.desc.padEnd(20)} | 登录成功`);
      console.log(`   └─ 用户名: ${result.user.userName}`);
      console.log(`   └─ 品牌权限: ${result.user.customerNo || '全部（管理员）'}`);
    } else {
      console.log(`❌ ${account.userId.padEnd(15)} | ${account.desc.padEnd(20)} | ${result.error}`);
    }
  }
}

async function main() {
  console.log('\n🚀 VF物流系统 - 认证功能完整测试');
  console.log('时间:', new Date().toLocaleString('zh-CN'));
  
  try {
    // 步骤1: 测试数据库连接
    const dbOk = await testDatabaseConnection();
    if (!dbOk) {
      console.log('\n❌ 数据库连接失败，无法继续测试');
      process.exit(1);
    }
    
    // 步骤2: 检查用户表
    const tableOk = await testUserTable();
    if (!tableOk) {
      console.log('\n⚠️  用户表检查未通过，但会继续测试登录逻辑');
    }
    
    // 步骤3: 测试所有账号
    await testAllAccounts();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 测试完成');
    console.log('='.repeat(60));
    console.log('\n💡 下一步操作:');
    console.log('   1. 如果有失败的账号，运行: sqlplus user/pass@db @setup-test-users.sql');
    console.log('   2. 启动API服务器: npm start');
    console.log('   3. 使用调试工具测试登录: 访问前端的 "🔧 Dev Tools" -> "认证调试"');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试过程出错:', error);
    process.exit(1);
  }
}

// 运行测试
main();
