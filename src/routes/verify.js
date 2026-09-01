const express = require('express');
const { sendCode, confirmCode } = require('../verification/phoneVerification');

const router = express.Router();

// POST /api/verify/send { phone } -> 發送手機驗證碼（公開，刊登前置作業）
router.post('/send', async (req, res) => {
  const { status, ...body } = await sendCode(String((req.body || {}).phone || '').trim());
  res.status(status).json(body);
});

// POST /api/verify/confirm { phone, code } -> 驗證手機驗證碼
router.post('/confirm', (req, res) => {
  const { phone, code } = req.body || {};
  const { status, ...body } = confirmCode(String(phone || '').trim(), code);
  res.status(status).json(body);
});

module.exports = router;
