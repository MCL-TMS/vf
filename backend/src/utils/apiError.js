const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_USER_ID: 'MISSING_USER_ID',
  HTTPS_REQUIRED: 'HTTPS_REQUIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  LOGIN_RATE_LIMITED: 'LOGIN_RATE_LIMITED',
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID_FORMAT: 'AUTH_TOKEN_INVALID_FORMAT',
  AUTH_TOKEN_REVOKED: 'AUTH_TOKEN_REVOKED',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_USER_DISABLED: 'AUTH_USER_DISABLED',
  AUTH_USER_INACTIVE: 'AUTH_USER_INACTIVE',
  AUTH_REFRESH_TOKEN_MISSING: 'AUTH_REFRESH_TOKEN_MISSING',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
  AUTH_SESSION_INVALID: 'AUTH_SESSION_INVALID',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  BRAND_SCOPE_FORBIDDEN: 'BRAND_SCOPE_FORBIDDEN',
  EMPTY_BRAND_SCOPE: 'EMPTY_BRAND_SCOPE',
  HEALTH_CHECK_FAILED: 'HEALTH_CHECK_FAILED',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  DB_UNAVAILABLE: 'DB_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
});

class ApiError extends Error {
  constructor({
    status = 500,
    code = ERROR_CODES.INTERNAL_ERROR,
    error = '服务器内部错误',
    details,
    expose = status < 500,
    cause
  } = {}) {
    super(error);
    this.name = 'ApiError';
    this.statusCode = status;
    this.code = code;
    this.details = details;
    this.expose = expose;
    this.exposeMessage = error;
    this.cause = cause;
  }
}

function hasDetails(details) {
  if (details == null) {
    return false;
  }

  if (Array.isArray(details)) {
    return details.length > 0;
  }

  if (typeof details === 'object') {
    return Object.keys(details).length > 0;
  }

  return true;
}

function getRequestId(req) {
  return req?.requestId || req?.headers?.['x-request-id'] || 'unknown';
}

function buildErrorResponse({ code, error, requestId, details, timestamp }) {
  const payload = {
    success: false,
    code,
    error,
    requestId: requestId || 'unknown',
    timestamp: timestamp || new Date().toISOString()
  };

  if (hasDetails(details)) {
    payload.details = details;
  }

  return payload;
}

function sendError(res, req, { status = 500, code = ERROR_CODES.INTERNAL_ERROR, error = '服务器内部错误', details, headers } = {}) {
  if (headers && typeof headers === 'object') {
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  return res.status(status).json(buildErrorResponse({
    code,
    error,
    details,
    requestId: getRequestId(req)
  }));
}

function sendRouteError(res, req, error, {
  fallbackError = '服务器内部错误',
  fallbackCode = ERROR_CODES.INTERNAL_ERROR,
  isProduction = process.env.NODE_ENV === 'production'
} = {}) {
  const normalizedError = normalizeError(error, { isProduction });

  if (normalizedError.status >= 500 && normalizedError.code === ERROR_CODES.INTERNAL_ERROR) {
    normalizedError.error = fallbackError;
    normalizedError.code = fallbackCode;
  }

  return sendError(res, req, normalizedError);
}

function normalizeError(error, { isProduction = false } = {}) {
  if (error?.code === 'NJS-040' || error?.code === 'NJS-510' || error?.code === 'DB_CIRCUIT_OPEN') {
    return {
      status: 503,
      code: ERROR_CODES.DB_UNAVAILABLE,
      error: '数据库连接繁忙，请稍后重试'
    };
  }

  if (error?.code && typeof error.code === 'string' && error.code.startsWith('ORA-')) {
    return {
      status: 503,
      code: ERROR_CODES.DB_UNAVAILABLE,
      error: '暂时无法连接到数据库，请稍后重试'
    };
  }

  if (error?.code === 'TIMEOUT') {
    return {
      status: 408,
      code: ERROR_CODES.REQUEST_TIMEOUT,
      error: '数据查询超时，请缩小查询范围后重试'
    };
  }

  const status = error?.statusCode || error?.status || 500;
  const defaultCode = status === 400
    ? ERROR_CODES.VALIDATION_ERROR
    : status === 401
      ? ERROR_CODES.AUTH_FAILED
      : status === 403
        ? ERROR_CODES.BRAND_SCOPE_FORBIDDEN
        : status === 404
          ? ERROR_CODES.RESOURCE_NOT_FOUND
          : ERROR_CODES.INTERNAL_ERROR;

  const response = {
    status,
    code: error?.code || defaultCode,
    error: error?.exposeMessage || error?.publicMessage || error?.message || '服务器内部错误'
  };

  if (!isProduction || status < 500) {
    response.details = error?.details;
  }

  if (isProduction && status >= 500) {
    response.code = error?.code && error.code !== 'INTERNAL_ERROR' ? error.code : ERROR_CODES.INTERNAL_ERROR;
    response.error = '服务器内部错误，请稍后重试';
    delete response.details;
  }

  return response;
}

module.exports = {
  ERROR_CODES,
  ApiError,
  buildErrorResponse,
  sendError,
  sendRouteError,
  normalizeError
};