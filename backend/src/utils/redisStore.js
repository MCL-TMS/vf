const { createClient } = require('redis');

let redisClient = null;
let redisConnectPromise = null;
let redisAvailable = false;
let redisWarningPrinted = false;
const DEFAULT_REDIS_KEY_PREFIX = 'auth';
const redisMetrics = {
  fallbackCount: 0,
  fallbackReasons: {
    disabled: 0,
    connectFailed: 0,
    errorEvent: 0
  },
  connectionErrorCount: 0,
  lastFallbackReason: null,
  lastFallbackAt: null,
  lastErrorMessage: null
};

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return Boolean(value);
}

function isRedisEnabled() {
  return parseBooleanEnv(process.env.REDIS_ENABLED, true);
}

function getRedisKeyPrefix() {
  const rawPrefix = (process.env.REDIS_KEY_PREFIX || DEFAULT_REDIS_KEY_PREFIX).trim();
  if (!rawPrefix) {
    return DEFAULT_REDIS_KEY_PREFIX;
  }

  return rawPrefix.endsWith(':') ? rawPrefix.slice(0, -1) : rawPrefix;
}

function buildRedisKey(...parts) {
  const normalizedParts = parts
    .filter(part => part !== undefined && part !== null && part !== '')
    .map(part => String(part));

  return [getRedisKeyPrefix(), ...normalizedParts].join(':');
}

function buildRedisUrl() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD;
  const database = process.env.REDIS_DB || '0';

  if (password) {
    return `redis://:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  return `redis://${host}:${port}/${database}`;
}

function logRedisUnavailable(error) {
  if (redisWarningPrinted) {
    return;
  }

  redisWarningPrinted = true;
  console.warn(`⚠️ [Redis] Redis不可用，回退到内存存储: ${error.message}`);
}

function markRedisFallback(reason, error = null) {
  redisMetrics.fallbackCount += 1;
  redisMetrics.lastFallbackReason = reason;
  redisMetrics.lastFallbackAt = new Date().toISOString();

  if (error?.message) {
    redisMetrics.lastErrorMessage = error.message;
  }

  if (reason === 'disabled') {
    redisMetrics.fallbackReasons.disabled += 1;
  } else if (reason === 'connectFailed') {
    redisMetrics.fallbackReasons.connectFailed += 1;
  } else if (reason === 'errorEvent') {
    redisMetrics.fallbackReasons.errorEvent += 1;
  }
}

function getRedisMetrics() {
  return {
    fallbackCount: redisMetrics.fallbackCount,
    fallbackReasons: { ...redisMetrics.fallbackReasons },
    connectionErrorCount: redisMetrics.connectionErrorCount,
    lastFallbackReason: redisMetrics.lastFallbackReason,
    lastFallbackAt: redisMetrics.lastFallbackAt,
    lastErrorMessage: redisMetrics.lastErrorMessage
  };
}

async function getRedisClient() {
  if (!isRedisEnabled()) {
    markRedisFallback('disabled');
    return null;
  }

  if (redisClient?.isOpen && redisAvailable) {
    return redisClient;
  }

  if (!redisClient) {
    redisClient = createClient({
      url: buildRedisUrl(),
      socket: {
        reconnectStrategy(retries) {
          return Math.min(retries * 200, 2000);
        }
      }
    });

    redisClient.on('error', error => {
      redisAvailable = false;
      redisMetrics.connectionErrorCount += 1;
      markRedisFallback('errorEvent', error);
      logRedisUnavailable(error);
    });

    redisClient.on('ready', () => {
      redisAvailable = true;
      redisWarningPrinted = false;
      console.log('✅ [Redis] 已连接');
    });

    redisClient.on('end', () => {
      redisAvailable = false;
    });
  }

  if (!redisConnectPromise) {
    redisConnectPromise = redisClient.connect()
      .then(() => {
        redisAvailable = true;
        return redisClient;
      })
      .catch(error => {
        redisAvailable = false;
        markRedisFallback('connectFailed', error);
        logRedisUnavailable(error);
        return null;
      })
      .finally(() => {
        redisConnectPromise = null;
      });
  }

  return redisConnectPromise;
}

function getRedisStatus() {
  return {
    enabled: isRedisEnabled(),
    available: redisAvailable,
    url: buildRedisUrl(),
    metrics: getRedisMetrics()
  };
}

module.exports = {
  getRedisClient,
  getRedisStatus,
  isRedisEnabled,
  buildRedisKey,
  getRedisKeyPrefix,
  getRedisMetrics
};