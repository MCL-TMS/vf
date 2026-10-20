const DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

function isValidDateTime(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_TIME_PATTERN.exec(value);
  if (!match) return false;
  const [, date, hour = '00', minute = '00', second = '00'] = match;
  const parsed = new Date(`${date}T${hour}:${minute}:${second}Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 19) === `${date}T${hour}:${minute}:${second}`;
}

function normalizeDateTime(value, endOfDay = false) {
  if (!isValidDateTime(value)) {
    const error = new Error('日期时间格式无效，请使用 YYYY-MM-DD HH:mm:ss');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    error.exposeMessage = error.message;
    throw error;
  }
  if (value.length === 10) return `${value} ${endOfDay ? '23:59:59' : '00:00:00'}`;
  const normalized = value.replace('T', ' ');
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}

// Date-only callers retain whole-day semantics; datetime callers retain the selected second.
function dateBoundarySql(parameter, endOfDay = false) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(parameter)) throw new Error('Invalid date bind parameter');
  const bind = `:${parameter}`;
  return `TO_DATE(REPLACE(${bind}, 'T', ' ') || CASE WHEN LENGTH(${bind}) = 10 THEN ' ${endOfDay ? '23:59:59' : '00:00:00'}' WHEN LENGTH(${bind}) = 16 THEN ':00' END, 'YYYY-MM-DD HH24:MI:SS')`;
}

function dateEndExclusiveSql(parameter) {
  return `(${dateBoundarySql(parameter, true)} + INTERVAL '1' SECOND)`;
}

function validateRequestDateRange(req, res, next) {
  const { ERROR_CODES, sendError } = require('./apiError');
  const ranges = [
    [req.query?.dateFrom, req.query?.dateTo],
    [req.query?.startDate, req.query?.endDate],
    [req.body?.dateRange?.from, req.body?.dateRange?.to]
  ];
  for (const [from, to] of ranges) {
    const normalizedFrom = from == null ? undefined : (typeof from === 'string' ? from : null);
    const normalizedTo = to == null ? undefined : (typeof to === 'string' ? to : null);
    if (normalizedFrom === null || normalizedTo === null ||
      (normalizedFrom !== undefined && !isValidDateTime(normalizedFrom)) ||
      (normalizedTo !== undefined && !isValidDateTime(normalizedTo))) {
      return sendError(res, req, {
        status: 400, code: ERROR_CODES.VALIDATION_ERROR,
        error: '日期时间格式无效，请使用 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss'
      });
    }
    if (normalizedFrom && normalizedTo && normalizeDateTime(normalizedFrom) > normalizeDateTime(normalizedTo, true)) {
      return sendError(res, req, {
        status: 400, code: ERROR_CODES.VALIDATION_ERROR,
        error: '开始时间不能晚于结束时间'
      });
    }
  }
  next();
}

module.exports = {
  isValidDateTime, normalizeDateTime, dateBoundarySql, dateEndExclusiveSql, validateRequestDateRange
};
