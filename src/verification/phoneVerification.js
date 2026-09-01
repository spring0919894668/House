const crypto = require('crypto');
const db = require('../store/db');
const { sendVerificationCode } = require('../sms/provider');

const CODE_TTL_MS = 5 * 60 * 1000; // 驗證碼有效 5 分鐘
const VERIFIED_TTL_MS = 30 * 60 * 1000; // 驗證通過後，30 分鐘內完成刊登皆算已驗證
const RESEND_COOLDOWN_MS = 60 * 1000; // 同一手機重新發送需間隔 60 秒
const MAX_ATTEMPTS = 5; // 同一組驗證碼最多可嘗試 5 次

const PHONE_RE = /^09\d{8}$/;

function ensureCollection(data) {
  if (!Array.isArray(data.phoneVerifications)) data.phoneVerifications = [];
  return data;
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function isValidPhone(phone) {
  return PHONE_RE.test(String(phone || '').trim());
}

function findRecord(data, phone) {
  return data.phoneVerifications.find((v) => v.phone === phone);
}

// 供其他模組（如刊登 API）查驗：該手機是否在有效期限內完成過驗證
function isPhoneVerified(phone) {
  const data = ensureCollection(db.read());
  const record = findRecord(data, phone);
  return Boolean(record && record.verified && record.verifiedUntil && Date.now() <= record.verifiedUntil);
}

async function sendCode(phone) {
  if (!isValidPhone(phone)) {
    return { ok: false, status: 400, error: '手機格式錯誤，請輸入 09 開頭的 10 碼手機號碼' };
  }

  const data = ensureCollection(db.read());
  let record = findRecord(data, phone);
  const now = Date.now();

  if (record && record.lastSentAt && now - record.lastSentAt < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - record.lastSentAt)) / 1000);
    return { ok: false, status: 429, error: `請稍候 ${wait} 秒再重新發送驗證碼` };
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

  if (!record) {
    record = { phone };
    data.phoneVerifications.push(record);
  }
  Object.assign(record, {
    codeHash: hashCode(code),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    lastSentAt: now,
    verified: false,
    verifiedUntil: null
  });
  db.write(data);

  const result = await sendVerificationCode(phone, code);

  return {
    ok: true,
    status: 200,
    message: '驗證碼已發送，5 分鐘內有效',
    // 尚未串接正式簡訊商時，回傳驗證碼供測試使用；設定 SMS_WEBHOOK_URL 後就不會回傳
    devCode: result.sent ? undefined : code
  };
}

function confirmCode(phone, code) {
  if (!isValidPhone(phone)) {
    return { ok: false, status: 400, error: '手機格式錯誤' };
  }

  const data = ensureCollection(db.read());
  const record = findRecord(data, phone);
  const now = Date.now();

  if (!record || !record.codeHash || !record.expiresAt) {
    return { ok: false, status: 400, error: '請先發送驗證碼' };
  }
  if (now > record.expiresAt) {
    return { ok: false, status: 400, error: '驗證碼已過期，請重新發送' };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: '驗證失敗次數過多，請重新發送驗證碼' };
  }
  if (hashCode(String(code || '').trim()) !== record.codeHash) {
    record.attempts += 1;
    db.write(data);
    return { ok: false, status: 400, error: '驗證碼錯誤' };
  }

  record.verified = true;
  record.verifiedUntil = now + VERIFIED_TTL_MS;
  record.codeHash = null;
  db.write(data);

  return { ok: true, status: 200, message: '手機驗證成功，30 分鐘內可完成刊登' };
}

module.exports = { isValidPhone, isPhoneVerified, sendCode, confirmCode, VERIFIED_TTL_MS };
