/**
 * 密码加密工具
 * 使用bcrypt进行密码哈希和验证
 */

const bcrypt = require('bcrypt');

/**
 * 加密密码
 * @param {String} plainPassword - 明文密码
 * @returns {Promise<String>} - 加密后的密码哈希
 */
async function hashPassword(plainPassword) {
  try {
    // 使用10轮加密（安全性和性能的平衡）
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    return hashedPassword;
  } catch (error) {
    console.error('密码加密失败:', error);
    throw new Error('密码加密失败');
  }
}

/**
 * 验证密码
 * @param {String} plainPassword - 用户输入的明文密码
 * @param {String} hashedPassword - 数据库中存储的密码哈希
 * @returns {Promise<Boolean>} - 是否匹配
 */
async function verifyPassword(plainPassword, hashedPassword) {
  try {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    console.error('密码验证失败:', error);
    return false;
  }
}

/**
 * 批量更新数据库中的明文密码为加密密码
 * ⚠️ 仅用于数据迁移，生产环境慎用！
 * 
 * 使用方法：
 * const { updateAllPasswords } = require('./utils/passwordUtils');
 * await updateAllPasswords(connection);
 * 
 * @param {Object} connection - Oracle数据库连接对象
 */
async function updateAllPasswords(connection) {
  try {
    console.log('🔄 开始批量更新密码...');
    
    // 1. 获取所有用户
    const result = await connection.execute(
      `SELECT USERID, PASSWORD FROM APP_CMS.RWSYS_USER WHERE ACTIVE_FLAG = 'Y'`,
      [],
      { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
    );
    
    if (result.rows.length === 0) {
      console.log('⚠️ 没有找到需要更新的用户');
      return;
    }
    
    console.log(`📊 找到 ${result.rows.length} 个用户，开始更新...`);
    
    // 2. 逐个更新密码
    let successCount = 0;
    let failCount = 0;
    
    for (const user of result.rows) {
      try {
        // 检查密码是否已经是bcrypt哈希（以$2开头）
        if (user.PASSWORD.startsWith('$2')) {
          console.log(`⏩ 跳过用户 ${user.USERID}（密码已加密）`);
          continue;
        }
        
        // 加密明文密码
        const hashedPassword = await hashPassword(user.PASSWORD);
        
        // 更新数据库
        await connection.execute(
          `UPDATE APP_CMS.RWSYS_USER 
           SET PASSWORD = :hashedPassword, 
               UPDATE_TIME = SYSDATE
           WHERE USERID = :userId`,
          {
            hashedPassword,
            userId: user.USERID
          },
          { autoCommit: false } // 先不提交
        );
        
        successCount++;
        console.log(`✅ 成功更新用户: ${user.USERID}`);
        
      } catch (error) {
        failCount++;
        console.error(`❌ 更新用户 ${user.USERID} 失败:`, error.message);
      }
    }
    
    // 3. 提交事务
    if (successCount > 0) {
      await connection.commit();
      console.log(`\n🎉 批量更新完成！`);
      console.log(`   ✅ 成功: ${successCount} 个用户`);
      console.log(`   ❌ 失败: ${failCount} 个用户`);
    } else {
      console.log('⚠️ 没有用户需要更新');
    }
    
  } catch (error) {
    console.error('❌ 批量更新密码失败:', error);
    await connection.rollback();
    throw error;
  }
}

/**
 * 验证密码强度
 * @param {String} password - 待验证的密码
 * @returns {Object} - { valid: boolean, message: string, strength: string }
 */
function validatePasswordStrength(password) {
  const result = {
    valid: true,
    message: '',
    strength: 'weak'
  };
  
  // 基本长度检查
  if (password.length < 8) {
    result.valid = false;
    result.message = '密码长度至少8个字符';
    return result;
  }
  
  if (password.length > 100) {
    result.valid = false;
    result.message = '密码长度不能超过100个字符';
    return result;
  }
  
  // 强度评分
  let score = 0;
  
  // 包含小写字母
  if (/[a-z]/.test(password)) score++;
  
  // 包含大写字母
  if (/[A-Z]/.test(password)) score++;
  
  // 包含数字
  if (/\d/.test(password)) score++;
  
  // 包含特殊字符
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  
  // 长度加分
  if (password.length >= 12) score++;
  
  // 判断强度
  if (score <= 2) {
    result.strength = 'weak';
    result.message = '密码强度：弱（建议包含大小写字母、数字和特殊字符）';
  } else if (score === 3) {
    result.strength = 'medium';
    result.message = '密码强度：中等';
  } else {
    result.strength = 'strong';
    result.message = '密码强度：强';
  }
  
  return result;
}

module.exports = {
  hashPassword,
  verifyPassword,
  updateAllPasswords,
  validatePasswordStrength
};
