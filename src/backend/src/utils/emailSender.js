const nodemailer = require('nodemailer');

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

function isEmailMfaEnabled() {
  // 默认关闭邮箱MFA，避免在SMTP未就绪时阻断登录。
  return parseBooleanEnv(process.env.MFA_EMAIL_ENABLED, false);
}

function getEmailTransportConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();

  if (!host) {
    return null;
  }

  const transportConfig = {
    host,
    port,
    secure: parseBooleanEnv(process.env.SMTP_SECURE, port === 465)
  };

  // 企业内网中继常见场景：25端口 + 无账号密码。
  if (user && pass) {
    transportConfig.auth = {
      user,
      pass
    };
  }

  return transportConfig;
}

function getFromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@vf-logistics.local';
}

async function sendOtpEmail({ to, code, userId }) {
  if (!isEmailMfaEnabled()) {
    throw new Error('MFA email is disabled by configuration');
  }

  const transportConfig = getEmailTransportConfig();
  if (!transportConfig) {
    throw new Error('SMTP_HOST is not configured');
  }

  const transporter = nodemailer.createTransport(transportConfig);

  const subject = 'VF Logistics 登录验证码';
  const text = [
    `您好，${userId}:`,
    '',
    `您的登录验证码为：${code}`,
    '验证码5分钟内有效，请勿泄露给他人。',
    '',
    '如果这不是您本人操作，请尽快联系管理员。'
  ].join('\n');

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text
  });
}

module.exports = {
  sendOtpEmail,
  isEmailMfaEnabled
};
