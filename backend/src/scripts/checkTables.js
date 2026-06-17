#!/usr/bin/env node

const { createRequire } = require('module');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function title(message) {
  console.log(`${colors.bold}${colors.cyan}${message}${colors.reset}`);
}

/**
 * VF物流数据分析平台 - Oracle数据库表结构检测
 * 检测APP_CMS Schema下的核心业务表结构
 */

// 定义期望的表结构
const EXPECTED_TABLES = {
  BAS_CODES: {
    description: '基础代码表',
    fields: [
      { name: 'CODE', type: 'VARCHAR2', nullable: 'N', description: '业务代码ID，作为外键被其他表引用' },
      { name: 'CODENAME_C', type: 'VARCHAR2', nullable: 'Y', description: '业务代码中文名称' },
      { name: 'CODEID', type: 'VARCHAR2', nullable: 'Y', description: '代码类别标识' }
    ]
  },
  TSK_LIST_TASK: {
    description: '快递任务表 - 核心数据表',
    fields: [
      { name: 'TSK_MERGE_NO', type: 'VARCHAR2', nullable: 'N', description: '快递单号（主键）' },
      { name: 'CUSTOMERNO', type: 'VARCHAR2', nullable: 'Y', description: '项目名称/品牌标识' },
      { name: 'CARRIERID', type: 'VARCHAR2', nullable: 'Y', description: '快递商标识' },
      { name: 'DIS_STATUS', type: 'VARCHAR2', nullable: 'Y', description: '快递单状态（外键，关联BAS_CODES.CODE）' },
      { name: 'PAYMENTDATE_D', type: 'DATE', nullable: 'Y', description: '消费者付款时间' },
      { name: 'WMS_OUTBOUND_TIME', type: 'DATE', nullable: 'Y', description: '出库时间' },
      { name: 'DELIVERY_TIME', type: 'DATE', nullable: 'Y', description: '签收时间' },
      { name: 'DISP_TIME', type: 'DATE', nullable: 'Y', description: '首派时间' },
      { name: 'TRACKING_TIME', type: 'DATE', nullable: 'Y', description: '最后跟踪时间' },
      { name: 'ETA', type: 'DATE', nullable: 'Y', description: '预计送达时间' },
      { name: 'SUM_SEND_TIME2', type: 'NUMBER', nullable: 'Y', description: '配送时长(小时)' },
      { name: 'DEST_CITY', type: 'VARCHAR2', nullable: 'Y', description: '目的地城市' },
      { name: 'PLATFORM', type: 'VARCHAR2', nullable: 'Y', description: '店铺名称' },
      { name: 'T_GROSSWEIGHT', type: 'NUMBER', nullable: 'Y', description: '重量' },
      { name: 'T_CUBIC', type: 'NUMBER', nullable: 'Y', description: '体积' },
      { name: 'CAL_TON_AR', type: 'NUMBER', nullable: 'Y', description: '应收计费重量' },
      { name: 'CAL_TON_AP', type: 'NUMBER', nullable: 'Y', description: '应付计费重量' },
      { name: 'DIS_TYPE', type: 'VARCHAR2', nullable: 'Y', description: '快递单类型' },
      { name: 'IS48H_FLAG', type: 'VARCHAR2', nullable: 'Y', description: '超48H未更新标识' },
      { name: 'PATCH_REASON_NOTES1', type: 'VARCHAR2', nullable: 'Y', description: '一级警告原因' },
      { name: 'PATCH_REASON_NOTES2', type: 'VARCHAR2', nullable: 'Y', description: '二级警告原因' }
    ]
  },
  DOC_COMPLAINT: {
    description: '工单表',
    fields: [
      { name: 'TSK_MERGE_NO', type: 'VARCHAR2', nullable: 'N', description: '快递单号（外键，关联TSK_LIST_TASK.TSK_MERGE_NO）' },
      { name: 'CPL_REQUEST_NO', type: 'VARCHAR2', nullable: 'Y', description: '工单ID' },
      { name: 'REQUEST_STATUS', type: 'VARCHAR2', nullable: 'Y', description: '工单状态（外键，关联BAS_CODES.CODE）' },
      { name: 'REQUEST_TIME', type: 'DATE', nullable: 'Y', description: '工单创建时间' },
      { name: 'PROCESS_DATE2', type: 'DATE', nullable: 'Y', description: '工单完结时间' },
      { name: 'PROCESS_FLAG', type: 'VARCHAR2', nullable: 'Y', description: '是否拦截成功' }
    ]
  }
};

// 用户配置参数
const SCHEMA_NAME = 'APP_CMS';

/**
 * 检查表结构主函数
 */
async function checkTableStructure() {
  console.clear();
  
  title('🔍 VF物流数据分析平台 - Oracle表结构检测');
  console.log('='.repeat(80));
  console.log('');
  log('blue', `正在检测 ${SCHEMA_NAME} Schema 下的核心业务表结构...`);
  console.log('');

  let connection;
  
  try {
    // 检查环境配置
    if (!process.env.ORACLE_USER || !process.env.ORACLE_PASSWORD || !process.env.ORACLE_CONNECT_STRING) {
      throw new Error('数据库连接信息不完整，请先运行: npm run setup');
    }

    // const require = createRequire(import.meta.url); // 已经在CommonJS环境中，不需要createRequire
    const oracledb = require('oracledb');
    
    // 建立数据库连接
    log('blue', '📡 正在连接Oracle数据库...');
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });
    
    log('green', '✅ 数据库连接成功');
    console.log('');

    // 检查Schema是否存在
    await checkSchemaExists(connection);
    
    // 检查每个表的结构
    const tableResults = [];
    
    for (const [tableName, tableConfig] of Object.entries(EXPECTED_TABLES)) {
      console.log('-'.repeat(60));
      log('cyan', `📋 检测表: ${tableName} (${tableConfig.description})`);
      
      const result = await checkSingleTable(connection, tableName, tableConfig);
      tableResults.push({ tableName, ...result });
      
      console.log('');
    }
    
    // 生成总结报告
    console.log('='.repeat(80));
    generateSummaryReport(tableResults);
    
  } catch (error) {
    log('red', `❌ 检测失败: ${error.message}`);
    
    if (error.message.includes('ORA-00942')) {
      console.log('');
      log('yellow', '💡 可能的原因:');
      console.log('   • 表不存在或用户无权限访问');
      console.log('   • Schema名称不正确');
      console.log('   • 当前用户没有访问APP_CMS Schema的权限');
    }
    
    if (error.message.includes('ORA-01017')) {
      console.log('');
      log('yellow', '💡 数据库认证失败，请检查用户名和密码');
    }
    
    process.exit(1);
    
  } finally {
    if (connection) {
      try {
        await connection.close();
        log('blue', '📡 数据库连接已关闭');
      } catch (closeError) {
        log('yellow', `⚠️  关闭连接时出错: ${closeError.message}`);
      }
    }
  }
}

/**
 * 检查Schema是否存在
 */
async function checkSchemaExists(connection) {
  try {
    log('blue', `🔍 检查Schema: ${SCHEMA_NAME}`);
    
    const result = await connection.execute(
      `SELECT USERNAME FROM ALL_USERS WHERE USERNAME = :schema`,
      [SCHEMA_NAME]
    );
    
    if (result.rows && result.rows.length > 0) {
      log('green', `✅ Schema ${SCHEMA_NAME} 存在`);
    } else {
      log('yellow', `⚠️  Schema ${SCHEMA_NAME} 不存在或无访问权限`);
      
      // 列出用户可访问的Schema
      const accessibleSchemas = await connection.execute(
        `SELECT DISTINCT OWNER FROM ALL_TABLES WHERE ROWNUM <= 20 ORDER BY OWNER`
      );
      
      if (accessibleSchemas.rows && accessibleSchemas.rows.length > 0) {
        console.log('   可访问的Schema列表:');
        accessibleSchemas.rows.forEach(row => {
          console.log(`     - ${row[0]}`);
        });
      }
    }
    
  } catch (error) {
    log('yellow', `⚠️  Schema检查失败: ${error.message}`);
  }
  
  console.log('');
}

/**
 * 检查单个表的结构
 */
async function checkSingleTable(connection, tableName, tableConfig) {
  const fullTableName = `${SCHEMA_NAME}.${tableName}`;
  
  try {
    // 检查表是否存在
    log('blue', `   🔍 检查表是否存在...`);
    
    const tableExistResult = await connection.execute(`
      SELECT COUNT(*) as TABLE_COUNT 
      FROM ALL_TABLES 
      WHERE OWNER = :schema AND TABLE_NAME = :tableName
    `, [SCHEMA_NAME, tableName]);
    
    const tableExists = tableExistResult.rows[0][0] > 0;
    
    if (!tableExists) {
      log('red', `   ❌ 表 ${fullTableName} 不存在`);
      return {
        exists: false,
        fieldsChecked: 0,
        fieldsMatched: 0,
        missingFields: tableConfig.fields.map(f => f.name),
        extraFields: [],
        fieldMismatches: []
      };
    }
    
    log('green', `   ✅ 表 ${fullTableName} 存在`);
    
    // 获取表的字段信息
    log('blue', `   📋 获取表字段信息...`);
    
    const columnsResult = await connection.execute(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        NULLABLE,
        DATA_LENGTH,
        DATA_PRECISION,
        DATA_SCALE,
        COLUMN_ID
      FROM ALL_TAB_COLUMNS 
      WHERE OWNER = :schema AND TABLE_NAME = :tableName
      ORDER BY COLUMN_ID
    `, [SCHEMA_NAME, tableName]);
    
    const actualFields = {};
    columnsResult.rows.forEach(row => {
      actualFields[row[0]] = {
        name: row[0],
        type: row[1],
        nullable: row[2],
        length: row[3],
        precision: row[4],
        scale: row[5],
        position: row[6]
      };
    });
    
    // 检查字段匹配情况
    const fieldResults = checkFieldMatches(tableConfig.fields, actualFields);
    
    // 显示字段检查结果
    displayFieldResults(fieldResults);
    
    return {
      exists: true,
      ...fieldResults
    };
    
  } catch (error) {
    log('red', `   ❌ 检查表 ${fullTableName} 失败: ${error.message}`);
    return {
      exists: false,
      error: error.message,
      fieldsChecked: 0,
      fieldsMatched: 0,
      missingFields: [],
      extraFields: [],
      fieldMismatches: []
    };
  }
}

/**
 * 检查字段匹配情况
 */
function checkFieldMatches(expectedFields, actualFields) {
  const missingFields = [];
  const fieldMismatches = [];
  const extraFields = [];
  let fieldsMatched = 0;
  
  // 检查期望字段是否存在
  expectedFields.forEach(expectedField => {
    const actualField = actualFields[expectedField.name];
    
    if (!actualField) {
      missingFields.push(expectedField.name);
    } else {
      // 检查字段类型匹配
      const typeMatch = checkFieldTypeMatch(expectedField, actualField);
      if (typeMatch.matches) {
        fieldsMatched++;
      } else {
        fieldMismatches.push({
          fieldName: expectedField.name,
          expected: expectedField.type,
          actual: actualField.type,
          issue: typeMatch.issue
        });
      }
    }
  });
  
  // 检查是否有额外字段
  Object.keys(actualFields).forEach(actualFieldName => {
    const isExpected = expectedFields.some(ef => ef.name === actualFieldName);
    if (!isExpected) {
      extraFields.push(actualFieldName);
    }
  });
  
  return {
    fieldsChecked: expectedFields.length,
    fieldsMatched,
    missingFields,
    extraFields,
    fieldMismatches
  };
}

/**
 * 检查字段类型匹配
 */
function checkFieldTypeMatch(expectedField, actualField) {
  // 简化的类型匹配逻辑
  const expectedType = expectedField.type.toUpperCase();
  const actualType = actualField.type.toUpperCase();
  
  // VARCHAR2类型匹配
  if (expectedType === 'VARCHAR2' && (actualType === 'VARCHAR2' || actualType === 'CHAR')) {
    return { matches: true };
  }
  
  // NUMBER类型匹配
  if (expectedType === 'NUMBER' && actualType === 'NUMBER') {
    return { matches: true };
  }
  
  // DATE类型匹配
  if (expectedType === 'DATE' && (actualType === 'DATE' || actualType === 'TIMESTAMP')) {
    return { matches: true };
  }
  
  // 精确匹配
  if (expectedType === actualType) {
    return { matches: true };
  }
  
  return {
    matches: false,
    issue: `类型不匹配: 期望 ${expectedType}, 实际 ${actualType}`
  };
}

/**
 * 显示字段检查结果
 */
function displayFieldResults(results) {
  const { fieldsChecked, fieldsMatched, missingFields, extraFields, fieldMismatches } = results;
  
  // 显示匹配统计
  if (fieldsMatched === fieldsChecked && missingFields.length === 0) {
    log('green', `   ✅ 字段检查通过: ${fieldsMatched}/${fieldsChecked} 字段完全匹配`);
  } else {
    log('yellow', `   ⚠️  字段检查: ${fieldsMatched}/${fieldsChecked} 字段匹配`);
  }
  
  // 显示缺失字段
  if (missingFields.length > 0) {
    log('red', `   ❌ 缺失字段 (${missingFields.length}个):`);
    missingFields.forEach(field => {
      const expectedField = EXPECTED_TABLES[Object.keys(EXPECTED_TABLES).find(tableName => 
        EXPECTED_TABLES[tableName].fields.some(f => f.name === field)
      )].fields.find(f => f.name === field);
      console.log(`      • ${field} (${expectedField.type}) - ${expectedField.description}`);
    });
  }
  
  // 显示类型不匹配字段
  if (fieldMismatches.length > 0) {
    log('yellow', `   ⚠️  类型不匹配字段 (${fieldMismatches.length}个):`);
    fieldMismatches.forEach(mismatch => {
      console.log(`      • ${mismatch.fieldName}: ${mismatch.issue}`);
    });
  }
  
  // 显示额外字段
  if (extraFields.length > 0) {
    log('blue', `   ℹ️  额外字段 (${extraFields.length}个): ${extraFields.slice(0, 5).join(', ')}${extraFields.length > 5 ? '...' : ''}`);
  }
}

/**
 * 生成总结报告
 */
function generateSummaryReport(tableResults) {
  title('📊 表结构检测总结报告');
  console.log('');
  
  const totalTables = tableResults.length;
  const existingTables = tableResults.filter(r => r.exists).length;
  const totalFields = tableResults.reduce((sum, r) => sum + r.fieldsChecked, 0);
  const matchedFields = tableResults.reduce((sum, r) => sum + r.fieldsMatched, 0);
  const totalMissingFields = tableResults.reduce((sum, r) => sum + r.missingFields.length, 0);
  
  // 总体统计
  console.log('📋 整体统计:');
  console.log(`   • 检测表数量: ${totalTables}`);
  console.log(`   • 存在表数量: ${existingTables} (${((existingTables/totalTables)*100).toFixed(1)}%)`);
  console.log(`   • 字段匹配率: ${matchedFields}/${totalFields} (${((matchedFields/totalFields)*100).toFixed(1)}%)`);
  console.log(`   • 缺失字段数: ${totalMissingFields}`);
  console.log('');
  
  // 表级别详情
  console.log('📋 表级别详情:');
  tableResults.forEach(result => {
    const statusIcon = result.exists ? 
      (result.missingFields.length === 0 && result.fieldMismatches.length === 0 ? '✅' : '⚠️ ') : '❌';
    const matchRate = result.fieldsChecked > 0 ? 
      ((result.fieldsMatched / result.fieldsChecked) * 100).toFixed(1) : '0';
    
    console.log(`   ${statusIcon} ${result.tableName}: ${result.exists ? 
      `${result.fieldsMatched}/${result.fieldsChecked} 字段匹配 (${matchRate}%)` : 
      '表不存在'}`);
  });
  
  console.log('');
  
  // 建议和下一步操作
  if (existingTables === totalTables && totalMissingFields === 0) {
    log('green', '🎉 恭喜！所有表结构检查通过，VF物流数据分析平台数据库准备就绪！');
    console.log('');
    console.log('✅ 后续操作:');
    console.log('   • 可以启动VF物流数据分析平台');
    console.log('   • 建议运行数据完整性测试');
    console.log('   • 检查业务数据是否存在');
  } else {
    log('yellow', '⚠️  发现表结构问题，需要进行数据库调整');
    console.log('');
    console.log('🔧 建议操作:');
    
    if (existingTables < totalTables) {
      console.log('   • 创建缺失的表');
      console.log('   • 检查Schema权限配置');
    }
    
    if (totalMissingFields > 0) {
      console.log('   • 添加缺失的字段');
      console.log('   • 检查表结构DDL脚��');
    }
    
    console.log('   • 联系数据���管理员进行表结构调整');
    console.log('   • 确认当前Schema是否为正确的业务Schema');
  }
  
  console.log('');
  console.log('📚 详细信息:');
  console.log(`   • 检测Schema: ${SCHEMA_NAME}`);
  console.log(`   • 检测字段数: BAS_CODES(3) + TSK_LIST_TASK(21) + DOC_COMPLAINT(6) = 30个`);
  console.log(`   • 检测时间: ${new Date().toLocaleString()}`);
  console.log(`   • 数据库用户: ${process.env.ORACLE_USER}`);
  console.log(`   • 字段规范版本: 2025-01-14 (移除PLATFORM_CLASS衍生字段，修正PATCH_REASON_NOTES*，完善业务代码字典，修正PLATFORM逻辑，更新CPL_STATUS，优化业务逻辑规则)`);
  
  // 如果检查完全通过，返回成功状态码
  if (existingTables === totalTables && totalMissingFields === 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// 运行检测
checkTableStructure().catch(error => {
  log('red', `\n💥 检测执行失败: ${error.message}`);
  process.exit(1);
});