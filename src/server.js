require('dotenv').config();
const express = require('express');
const path = require('path');

const { registerWebhook } = require('./line/webhook');
const scheduler = require('./scheduler');
const newsRoutes = require('./routes/news');
const scheduleRoutes = require('./routes/schedule');
const matchingRoutes = require('./matching/routes');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

// LINE webhook 必須在 express.json() 之前掛載，因為 @line/bot-sdk 的
// middleware 需要用原始 body 驗證簽章。
for (const botKey of ['A', 'B', 'C', 'D']) {
  registerWebhook(app, botKey);
}

app.use(express.json());

// 案件媒合社群模組使用自己的每位使用者權杖驗證（見 src/matching/auth.js），
// 需掛在下方全站 ADMIN_TOKEN 檢查之前，避免被單一 token 的規則擋下。
app.use('/api/matching', matchingRoutes);

// 簡易後台驗證：非本機請求需帶 Authorization: Bearer <ADMIN_TOKEN>
app.use('/api', (req, res, next) => {
  if (!ADMIN_TOKEN) return next(); // 未設定 token 時預設僅供本機測試使用
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${ADMIN_TOKEN}`) return next();
  res.status(401).json({ ok: false, error: '未授權，請提供正確的 ADMIN_TOKEN' });
});

app.use('/api/news', newsRoutes);
app.use('/api/schedules', scheduleRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`房地產新聞 LINE 發文助理已啟動：http://localhost:${PORT}`);
  scheduler.reload();
});
