const { ERROR_CODES } = require('./apiError');

const VF_BRAND_CODES = ['18405', '18405-1', '18405-2', '18405-3', '18405-4', '18405-5'];

function normalizeBrandValues(value) {
  if (value == null || value === '' || value === 'all') {
    return null;
  }

  let brandList;
  if (Array.isArray(value)) {
    brandList = value;
  } else if (typeof value === 'string') {
    brandList = value.split(',');
  } else {
    return null;
  }

  const normalized = [...new Set(
    brandList
      .map((item) => String(item).trim())
      .filter(Boolean)
      .filter((item) => item !== 'all' && item !== 'ALL')
  )];

  return normalized.length > 0 ? normalized : null;
}

function getAuthorizedCustomerNos(user) {
  if (!user || user.isAdmin) {
    return null;
  }

  const authorized = normalizeBrandValues(user.customerNos || user.customerNo);
  return authorized || [];
}

function createForbiddenBrandError(unauthorizedBrands) {
  const error = new Error(`Unauthorized brand scope: ${unauthorizedBrands.join(', ')}`);
  error.statusCode = 403;
  error.code = ERROR_CODES.BRAND_SCOPE_FORBIDDEN;
  error.exposeMessage = '请求的品牌超出当前账号权限范围';
  error.details = { unauthorizedBrands };
  return error;
}

function mapToCustomerNo(value, brandMapping = {}, reverseBrandMapping = {}) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  // 1) 直接命中（品牌名 -> 品牌编码）
  if (brandMapping[raw]) {
    return brandMapping[raw];
  }

  // 2) 大小写不敏感命中（品牌名 -> 品牌编码）
  const upperRaw = raw.toUpperCase();
  if (brandMapping[upperRaw]) {
    return brandMapping[upperRaw];
  }

  // 3) 已经是编码，保持原样
  if (reverseBrandMapping[raw]) {
    return raw;
  }

  return raw;
}

function normalizeCustomerNos(value, brandMapping = {}) {
  const normalizedValues = normalizeBrandValues(value);
  if (!normalizedValues) {
    return null;
  }

  const reverseBrandMapping = Object.values(brandMapping).reduce((acc, customerNo) => {
    const key = String(customerNo || '').trim();
    if (key) {
      acc[key] = true;
    }
    return acc;
  }, {});

  const mappedValues = normalizedValues
    .map((item) => mapToCustomerNo(item, brandMapping, reverseBrandMapping))
    .filter(Boolean);

  return mappedValues.length > 0 ? [...new Set(mappedValues)] : null;
}

function buildScopedBrandFilter({
  queryParams,
  requestedBrands,
  authorizedCustomerNos,
  brandMapping = {},
  fieldName = 't.CUSTOMERNO',
  paramPrefix = 'brand',
  fallbackCustomerNos = null
}) {
  const requestedCustomerNos = normalizeCustomerNos(requestedBrands, brandMapping);
  const authorizedCustomerNosNormalized = normalizeCustomerNos(authorizedCustomerNos, brandMapping);

  let effectiveCustomerNos;

  if (Array.isArray(authorizedCustomerNosNormalized)) {
    if (authorizedCustomerNosNormalized.length === 0) {
      const error = new Error('Current user has no authorized brands');
      error.statusCode = 403;
      error.code = ERROR_CODES.EMPTY_BRAND_SCOPE;
      error.exposeMessage = '当前账号未配置可访问品牌';
      throw error;
    }

    if (requestedCustomerNos) {
      const unauthorizedBrands = requestedCustomerNos.filter(
        (customerNo) => !authorizedCustomerNosNormalized.includes(customerNo)
      );

      if (unauthorizedBrands.length > 0) {
        throw createForbiddenBrandError(unauthorizedBrands);
      }

      effectiveCustomerNos = requestedCustomerNos;
    } else {
      effectiveCustomerNos = authorizedCustomerNosNormalized;
    }
  } else if (requestedCustomerNos) {
    effectiveCustomerNos = requestedCustomerNos;
  } else {
    // 管理员或未提供登录态范围时，默认不限制 CUSTOMERNO，允许查看全部数据。
    effectiveCustomerNos = null;
  }

  // 🔥 关键日志：打印最终生效的客户编号
  console.log("🔥 最终生效的客户编号:", effectiveCustomerNos);

  if (!effectiveCustomerNos || effectiveCustomerNos.length === 0) {
    return '';
  }

  if (effectiveCustomerNos.length === 1) {
    queryParams[`${paramPrefix}0`] = effectiveCustomerNos[0];
    return ` AND ${fieldName} = :${paramPrefix}0`;
  }

  effectiveCustomerNos.forEach((customerNo, index) => {
    queryParams[`${paramPrefix}${index}`] = customerNo;
  });

  const placeholders = effectiveCustomerNos.map((_, index) => `:${paramPrefix}${index}`).join(', ');
  return ` AND ${fieldName} IN (${placeholders})`;
}

module.exports = {
  VF_BRAND_CODES,
  normalizeBrandValues,
  getAuthorizedCustomerNos,
  buildScopedBrandFilter
};