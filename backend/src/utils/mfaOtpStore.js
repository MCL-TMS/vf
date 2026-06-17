const { randomUUID, createHash, pbkdf2Sync } = require('crypto');
const { getRedisClient, buildRedisKey } = require('./redisStore');

const memoryChallengeStore = new Map();
const DEFAULT_OTP_TTL_SECONDS = Number.parseInt(process.env.MFA_OTP_TTL_SECONDS || '300', 10);
const MAX_VERIFY_ATTEMPTS = Number.parseInt(process.env.MFA_MAX_VERIFY_ATTEMPTS || '5', 10);

function getOtpPepper() {
  return process.env.MFA_OTP_PEPPER || 'default_otp_pepper_2025';
}

/**
 * 使用 PBKDF2 增加计算量，防止针对 OTP 的暴力破解
 */
function hashOtpCode(code) {
  // 使用 PBKDF2 迭代 1000 次
  return pbkdf2Sync(code, getOtpPepper(), 1000, 64, 'sha512').toString('hex');
}

function getChallengeStorageKey(challengeId) {
  return buildRedisKey('mfa', 'challenge', challengeId);
}

function cleanupExpiredChallenges() {
  const now = Date.now();
  for (const [challengeId, record] of memoryChallengeStore.entries()) {
    if (record.expiresAt <= now) {
      memoryChallengeStore.delete(challengeId);
    }
  }
}

async function createOtpChallenge({ userId, email, purpose = 'login' }, otpCode) {
  const challengeId = randomUUID();
  const ttlSeconds = Number.isFinite(DEFAULT_OTP_TTL_SECONDS) && DEFAULT_OTP_TTL_SECONDS > 0
    ? DEFAULT_OTP_TTL_SECONDS
    : 300;

  const record = {
    userId,
    email,
    purpose,
    codeHash: hashOtpCode(otpCode),
    attempts: 0,
    createdAt: new Date().toISOString()
  };

  const redisClient = await getRedisClient();
  if (redisClient) {
    await redisClient.set(getChallengeStorageKey(challengeId), JSON.stringify(record), { EX: ttlSeconds });
    return { challengeId, ttlSeconds };
  }

  cleanupExpiredChallenges();
  memoryChallengeStore.set(challengeId, {
    ...record,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });

  return { challengeId, ttlSeconds };
}

async function getChallengeRecord(challengeId) {
  const redisClient = await getRedisClient();

  if (redisClient) {
    const raw = await redisClient.get(getChallengeStorageKey(challengeId));
    return raw ? JSON.parse(raw) : null;
  }

  cleanupExpiredChallenges();
  return memoryChallengeStore.get(challengeId) || null;
}

async function saveChallengeRecord(challengeId, record, ttlSeconds) {
  const redisClient = await getRedisClient();

  if (redisClient) {
    await redisClient.set(getChallengeStorageKey(challengeId), JSON.stringify(record), { EX: ttlSeconds });
    return;
  }

  memoryChallengeStore.set(challengeId, {
    ...record,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
}

async function deleteChallenge(challengeId) {
  const redisClient = await getRedisClient();

  if (redisClient) {
    await redisClient.del(getChallengeStorageKey(challengeId));
    return;
  }

  memoryChallengeStore.delete(challengeId);
}

function maskEmailAddress(email) {
  if (!email || !email.includes('@')) {
    return '';
  }

  const [namePart, domainPart] = email.split('@');
  if (!namePart || !domainPart) {
    return '';
  }

  if (namePart.length <= 2) {
    return `${namePart[0]}***@${domainPart}`;
  }

  return `${namePart.slice(0, 2)}***@${domainPart}`;
}

async function verifyOtpChallenge(challengeId, otpCode) {
  const record = await getChallengeRecord(challengeId);
  if (!record) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  if (!otpCode || !/^\d{6}$/.test(otpCode)) {
    return { success: false, reason: 'INVALID_CODE_FORMAT' };
  }

  const nextAttempts = (record.attempts || 0) + 1;
  if (nextAttempts > MAX_VERIFY_ATTEMPTS) {
    await deleteChallenge(challengeId);
    return { success: false, reason: 'TOO_MANY_ATTEMPTS' };
  }

  const providedHash = hashOtpCode(otpCode);
  if (providedHash !== record.codeHash) {
    const ttlSeconds = Number.isFinite(DEFAULT_OTP_TTL_SECONDS) && DEFAULT_OTP_TTL_SECONDS > 0
      ? DEFAULT_OTP_TTL_SECONDS
      : 300;

    await saveChallengeRecord(challengeId, {
      ...record,
      attempts: nextAttempts
    }, ttlSeconds);

    return { success: false, reason: 'CODE_MISMATCH', attemptsLeft: Math.max(MAX_VERIFY_ATTEMPTS - nextAttempts, 0) };
  }

  await deleteChallenge(challengeId);
  return {
    success: true,
    challenge: {
      userId: record.userId,
      email: record.email,
      purpose: record.purpose
    }
  };
}

module.exports = {
  createOtpChallenge,
  verifyOtpChallenge,
  deleteChallenge,
  maskEmailAddress
};
