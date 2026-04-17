require('dotenv').config();

const jwt = require('jsonwebtoken');
const { createClient } = require('redis');

const API_BASE_URL = process.env.TEST_API_BASE_URL || `http://localhost:${process.env.API_PORT || 3001}`;

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const bodyText = await response.text();

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch (_error) {
    body = bodyText;
  }

  return {
    status: response.status,
    body
  };
}

async function runRateLimitTest(redisClient) {
  const testUser = `redis_rate_test_${Date.now()}`;
  const attempts = [];

  for (let index = 1; index <= 6; index += 1) {
    const result = await requestJson('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: testUser,
        password: 'wrong-password'
      })
    });

    attempts.push({
      attempt: index,
      status: result.status,
      code: result.body?.code,
      error: result.body?.error
    });
  }

  const matchedKeys = (await redisClient.keys('auth:login-attempt:*'))
    .filter(key => key.includes(testUser));

  const redisRecords = [];
  for (const key of matchedKeys) {
    redisRecords.push({
      key,
      value: await redisClient.get(key),
      ttl: await redisClient.ttl(key)
    });
  }

  return {
    testUser,
    attempts,
    redisRecords
  };
}

async function runLogoutRevocationTest(redisClient) {
  const token = jwt.sign({
    userId: 'redis_logout_test',
    userName: 'Redis Logout Test',
    customerNo: '',
    customerNos: [],
    isAdmin: true
  }, process.env.JWT_SECRET, { expiresIn: '10m' });

  const headers = {
    Authorization: `Bearer ${token}`
  };

  const infoBefore = await requestJson('/api/info', { headers });
  const logout = await requestJson('/api/auth/logout', {
    method: 'POST',
    headers
  });
  const infoAfter = await requestJson('/api/info', { headers });

  const redisKey = `auth:revoked:${token}`;
  const redisRecord = {
    exists: await redisClient.exists(redisKey),
    ttl: await redisClient.ttl(redisKey)
  };

  return {
    infoBefore: {
      status: infoBefore.status,
      code: infoBefore.body?.code,
      error: infoBefore.body?.error,
      success: infoBefore.body?.success
    },
    logout: {
      status: logout.status,
      code: logout.body?.code,
      error: logout.body?.error,
      success: logout.body?.success
    },
    infoAfter: {
      status: infoAfter.status,
      code: infoAfter.body?.code,
      error: infoAfter.body?.error,
      success: infoAfter.body?.success
    },
    redisRecord
  };
}

async function runRefreshRotationTest(redisClient) {
  const login = await requestJson('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: 'vf_user',
      password: '654321'
    })
  });

  if (!login.body?.refreshToken || !login.body?.token) {
    return {
      login
    };
  }

  const firstRefresh = await requestJson('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken: login.body.refreshToken })
  });

  const secondRefreshUsingOldToken = await requestJson('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken: login.body.refreshToken })
  });

  const logout = await requestJson('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${firstRefresh.body?.token}`
    },
    body: JSON.stringify({ refreshToken: firstRefresh.body?.refreshToken })
  });

  const refreshAfterLogout = await requestJson('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken: firstRefresh.body?.refreshToken })
  });

  const revokedKey = firstRefresh.body?.refreshToken ? `auth:revoked:${firstRefresh.body.token}` : null;

  return {
    login: {
      status: login.status,
      success: login.body?.success
    },
    firstRefresh: {
      status: firstRefresh.status,
      success: firstRefresh.body?.success,
      hasNewRefreshToken: Boolean(firstRefresh.body?.refreshToken)
    },
    secondRefreshUsingOldToken: {
      status: secondRefreshUsingOldToken.status,
      code: secondRefreshUsingOldToken.body?.code,
      error: secondRefreshUsingOldToken.body?.error
    },
    logout: {
      status: logout.status,
      success: logout.body?.success
    },
    refreshAfterLogout: {
      status: refreshAfterLogout.status,
      code: refreshAfterLogout.body?.code,
      error: refreshAfterLogout.body?.error
    },
    revokedAccessTokenStillStored: revokedKey ? await redisClient.exists(revokedKey) : 0
  };
}

async function main() {
  const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379/0'
  });

  await redisClient.connect();

  try {
    const rateLimit = await runRateLimitTest(redisClient);
    const logoutRevocation = await runLogoutRevocationTest(redisClient);
    const refreshRotation = await runRefreshRotationTest(redisClient);

    console.log(JSON.stringify({
      apiBaseUrl: API_BASE_URL,
      redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379/0',
      rateLimit,
      logoutRevocation,
      refreshRotation
    }, null, 2));
  } finally {
    await redisClient.quit();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});