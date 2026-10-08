const { createClient } = require('redis');
const fs = require('fs');

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
  const protocol = parseBooleanEnv(process.env.REDIS_TLS) ? 'rediss' : 'redis';

  if (password) {
    return `${protocol}://:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  return `${protocol}://${host}:${port}/${database}`;
}

function getRedisCa() {
  const caPath = String(
    process.env.REDIS_CA_PATH || process.env.REDIS_TLS_CA_PATH || ''
  ).trim();
  if (caPath) {
    return fs.readFileSync(caPath, 'utf8');
  }

  const ca = String(process.env.REDIS_CA || process.env.REDIS_TLS_CA || '').trim();
  return ca || undefined;
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
    const ca = getRedisCa();
    redisClient = createClient({
      url: buildRedisUrl(),
      socket: {
        ...(ca ? { ca } : {}),
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
    // Try connecting but do not block indefinitely — use a short timeout and
    // fallback to in-memory store if Redis is unreachable. This prevents
    // login or token generation requests from hanging when Redis/network is down.
    const CONNECT_TIMEOUT_MS = Number.parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '2000', 10);

    const connectWithTimeout = async () => {
      try {
        const connectPromise = redisClient.connect();

        // race between connect and timeout
        await Promise.race([
          connectPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connect timeout')), CONNECT_TIMEOUT_MS))
        ]);

        // If connect succeeded
        redisAvailable = true;
        return redisClient;
      } catch (error) {
        // Ensure the client is cleaned up if partially initialized
        try {
          if (redisClient && typeof redisClient.disconnect === 'function') {
            // best-effort disconnect
            redisClient.disconnect().catch(() => {});
          }
        } catch (_) {
          // ignore
        }

        redisAvailable = false;
        markRedisFallback('connectFailed', error);
        logRedisUnavailable(error);
        return null;
      } finally {
        redisConnectPromise = null;
      }
    };

    redisConnectPromise = connectWithTimeout();
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