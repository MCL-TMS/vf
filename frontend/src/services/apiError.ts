export interface BackendErrorPayload {
  success?: boolean;
  code?: string;
  error?: string;
  requestId?: string;
  timestamp?: string;
  details?: unknown;
}

const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  AUTH_TOKEN_MISSING: '登录状态无效，请重新登录',
  AUTH_TOKEN_INVALID_FORMAT: '登录状态无效，请重新登录',
  AUTH_TOKEN_REVOKED: '登录状态已失效，请重新登录',
  AUTH_TOKEN_EXPIRED: '登录状态已过期，请重新登录',
  AUTH_TOKEN_INVALID: '登录状态无效，请重新登录',
  AUTH_FAILED: '认证失败，请重新登录',
  AUTH_REFRESH_TOKEN_MISSING: '登录状态已失效，请重新登录',
  AUTH_REFRESH_TOKEN_INVALID: '登录状态已失效，请重新登录',
  AUTH_SESSION_INVALID: '当前会话已失效，请重新登录',
  AUTH_INVALID_CREDENTIALS: '用户名或密码错误',
  AUTH_USER_DISABLED: '该账号已被停用，请联系管理员',
  AUTH_USER_INACTIVE: '用户不存在或已被停用，请重新登录',
  BRAND_SCOPE_FORBIDDEN: '当前账号无权访问所选品牌数据',
  EMPTY_BRAND_SCOPE: '当前账号未配置可访问品牌',
  HTTPS_REQUIRED: '当前环境仅允许通过 HTTPS 访问 API',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  LOGIN_RATE_LIMITED: '登录尝试次数过多，请稍后再试',
  DB_UNAVAILABLE: '数据库暂时不可用，请稍后重试',
  HEALTH_CHECK_FAILED: '服务健康检查失败，请稍后重试',
  RESOURCE_NOT_FOUND: '请求的接口或资源不存在',
  REQUEST_TIMEOUT: '请求超时，请缩小范围后重试',
  VALIDATION_ERROR: '请求参数有误，请检查后重试',
  INTERNAL_ERROR: '服务器内部错误，请稍后重试'
};

const LOGOUT_ERROR_CODES = new Set([
  'AUTH_TOKEN_REVOKED',
  'AUTH_TOKEN_INVALID',
  'AUTH_FAILED',
  'AUTH_REFRESH_TOKEN_INVALID',
  'AUTH_REFRESH_TOKEN_MISSING',
  'AUTH_SESSION_INVALID',
  'AUTH_USER_INACTIVE'
]);

export class ApiClientError extends Error {
  status: number;
  code: string;
  requestId?: string;
  details?: unknown;

  constructor(message: string, options: { status: number; code: string; requestId?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.details = options.details;
  }
}

export function shouldLogoutForErrorCode(code?: string): boolean {
  return Boolean(code && LOGOUT_ERROR_CODES.has(code));
}

export function getFriendlyErrorMessage(code: string | undefined, status: number, fallbackError: string): string {
  if (code && FRIENDLY_ERROR_MESSAGES[code]) {
    return FRIENDLY_ERROR_MESSAGES[code];
  }

  if (status === 401) {
    return '登录状态无效，请重新登录';
  }

  if (status === 403) {
    return '当前请求被拒绝，请检查权限范围';
  }

  if (status === 429) {
    return '请求过于频繁，请稍后再试';
  }

  if (status === 503) {
    return '服务暂时不可用，请稍后重试';
  }

  return fallbackError;
}

export function createApiClientError(options: {
  status: number;
  payload?: BackendErrorPayload | null;
  fallbackError: string;
}): ApiClientError {
  const { status, payload, fallbackError } = options;
  const code = payload?.code || `HTTP_${status}`;
  const message = getFriendlyErrorMessage(code, status, payload?.error || fallbackError);

  return new ApiClientError(message, {
    status,
    code,
    requestId: payload?.requestId,
    details: payload?.details
  });
}