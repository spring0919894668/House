// 簡訊發送抽象層。尚未串接正式簡訊商前，只在伺服器記錄驗證碼供測試；
// 設定 SMS_WEBHOOK_URL 後（可指向任何簡訊閘道的 HTTP 介面），會實際發送。
async function sendVerificationCode(phone, code) {
  const webhookUrl = process.env.SMS_WEBHOOK_URL;
  const message = `【相信共好大聯盟】您的手機驗證碼為 ${code}，5 分鐘內有效，請勿提供他人。`;

  if (!webhookUrl) {
    console.log(`[sms] 尚未設定 SMS_WEBHOOK_URL，僅記錄驗證碼供測試：${phone} -> ${code}`);
    return { sent: false };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` } : {})
      },
      body: JSON.stringify({ phone, code, message })
    });
    if (!res.ok) throw new Error(`簡訊閘道回應 HTTP ${res.status}`);
    return { sent: true };
  } catch (err) {
    console.error('[sms] 簡訊發送失敗，改記錄於伺服器供測試：', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendVerificationCode };
