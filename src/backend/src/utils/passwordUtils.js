/**
 * 密码加密工具
 * 使用Node内置crypto进行密码哈希、验证和旧口令迁移
 */

const crypto = require('crypto');

const SCRYPT_PREFIX = 'scrypt';
const SCRYPT_KEY_LENGTH = 64;

// 🔥 安全加固：增加计算消耗，防止暴力破解 (OWASP 推荐)
const SCRYPT_PARAMS = {
  N: 32768, // Cost factor (power of 2)
  r: 8,     // Block size
  p: 1,     // Parallelization
  maxmem: 64 * 1024 * 1024 // 增加内存限制到 64MB，防止 ERR_CRYPTO_INVALID_SCRYPT_PARAMS
};

function timingSafeEqualHex(leftHex, rightHex) {
  try {
    const left = Buffer.from(leftHex, 'hex');
    const right = Buffer.from(rightHex, 'hex');

    if (left.length !== right.length) {
      return false;
    }

    return crypto.timingSafeEqual(left, right);
  } catch (error) {
    return false;
  }
}

function isScryptHash(password) {
  return typeof password === 'string' && password.startsWith(`${SCRYPT_PREFIX}$`);
}

function isBcryptHash(password) {
  return typeof password === 'string' && password.startsWith('$2');
}

function isLegacyMd5Hash(password) {
  return typeof password === 'string' && /^[a-f0-9]{32}$/i.test(password);
}

function hashLegacyMd5(plainPassword) {
  return crypto.createHash('md5').update(plainPassword, 'utf8').digest('hex');
}

function verifyScryptPassword(plainPassword, storedPassword) {
  const [, salt, derivedKey] = storedPassword.split('$');

  if (!salt || !derivedKey) {
    return false;
  }

  // 首先尝试使用高强度参数验证 (新生成的哈希)
  let computed = crypto.scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH, SCRYPT_PARAMS).toString('hex');
  if (timingSafeEqualHex(computed, derivedKey)) {
    return true;
  }

  // 兼容旧版参数 (Node.js 默认值: N=16384, r=8, p=1)
  // 此处保留兼容性，以便后续 verifyAndUpgradePassword 可以自动升级旧账号
  computed = crypto.scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH, { N: 16384, r: 8, p: 1 }).toString('hex');
  return timingSafeEqualHex(computed, derivedKey);
}

async function verifyBcryptPassword(plainPassword, storedPassword) {
  try {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(plainPassword, storedPassword);
  } catch (error) {
    console.error('bcrypt校验失败或依赖缺失:', error.message);
    return false;
  }
}

/**
 * 加密密码
 * @param {String} plainPassword - 明文密码
 * @returns {Promise<String>} - 加密后的密码哈希
 */
async function hashPassword(plainPassword) {
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    // 使用增强版 SCRYPT_PARAMS
    const derivedKey = crypto.scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH, SCRYPT_PARAMS).toString('hex');
    return `${SCRYPT_PREFIX}$${salt}$${derivedKey}`;
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
    if (!hashedPassword) {
      return false;
    }

    if (isScryptHash(hashedPassword)) {
      return verifyScryptPassword(plainPassword, hashedPassword);
    }

    if (isBcryptHash(hashedPassword)) {
      return verifyBcryptPassword(plainPassword, hashedPassword);
    }

    return false;
  } catch (error) {
    console.error('密码验证失败:', error);
    return false;
  }
}

/**
 * 验证密码并在命中旧格式时返回升级后的哈希
 * 旧格式兼容：明文、MD5
 */
async function verifyAndUpgradePassword(plainPassword, storedPassword) {
  if (!storedPassword) {
    return { isValid: false, needsUpgrade: false, upgradedHash: null, legacyFormat: null };
  }

  if (isScryptHash(storedPassword) || isBcryptHash(storedPassword)) {
    const isValid = await verifyPassword(plainPassword, storedPassword);
    return {
      isValid,
      needsUpgrade: false,
      upgradedHash: null,
      legacyFormat: null
    };
  }

  const plainMatch = storedPassword === plainPassword;
  const md5Match = isLegacyMd5Hash(storedPassword) && timingSafeEqualHex(hashLegacyMd5(plainPassword), storedPassword.toLowerCase());

  if (!plainMatch && !md5Match) {
    return { isValid: false, needsUpgrade: false, upgradedHash: null, legacyFormat: null };
  }

  return {
    isValid: true,
    needsUpgrade: true,
    upgradedHash: await hashPassword(plainPassword),
    legacyFormat: plainMatch ? 'plain' : 'md5'
  };
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
        if (isScryptHash(user.PASSWORD) || isBcryptHash(user.PASSWORD)) {
          console.log(`⏩ 跳过用户 ${user.USERID}（密码已加密）`);
          continue;
        }
        
        // 加密明文密码
        const hashedPassword = await hashPassword(user.PASSWORD);
        
        // 更新数据库
        await connection.execute(
          `UPDATE APP_CMS.RWSYS_USER 
           SET PASSWORD = :hashedPassword
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
  verifyAndUpgradePassword,
  updateAllPasswords,
  validatePasswordStrength,
  isScryptHash,
  isLegacyMd5Hash
};
