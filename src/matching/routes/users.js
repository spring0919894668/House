const express = require('express');
const crypto = require('crypto');
const store = require('../store');
const { authenticate, requireAdmin, publicUser } = require('../auth');

const router = express.Router();
router.use(authenticate);

// GET /api/matching/me -> 目前登入者資訊
router.get('/me', (req, res) => {
  res.json({ ok: true, user: publicUser(req.matchingUser) });
});

// GET /api/matching/users -> 同事清單（不含權杖，管理者操作另有管理頁）
router.get('/', (req, res) => {
  const data = store.read();
  res.json({ ok: true, users: data.users.map(publicUser) });
});

// POST /api/matching/users -> 管理者新增同事帳號，回傳一次性權杖供交付本人
router.post('/', requireAdmin, (req, res) => {
  const { name, email, role, agentType } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: '請輸入姓名' });

  const data = store.read();
  const token = crypto.randomBytes(24).toString('hex');
  const user = {
    id: crypto.randomUUID(),
    name,
    email: email || '',
    role: role === 'admin' ? 'admin' : 'broker',
    agentType: ['buyer', 'seller', 'both'].includes(agentType) ? agentType : 'both',
    token,
    active: true,
    createdAt: new Date().toISOString()
  };
  data.users.push(user);
  store.write(data);
  res.json({ ok: true, user: publicUser(user), token });
});

// PATCH /api/matching/users/:id -> 管理者調整角色/類型/啟用狀態
router.patch('/:id', requireAdmin, (req, res) => {
  const data = store.read();
  const user = data.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: '找不到該使用者' });

  const { role, agentType, active, name, email } = req.body || {};
  if (role === 'admin' || role === 'broker') user.role = role;
  if (['buyer', 'seller', 'both'].includes(agentType)) user.agentType = agentType;
  if (typeof active === 'boolean') user.active = active;
  if (typeof name === 'string' && name.trim()) user.name = name.trim();
  if (typeof email === 'string') user.email = email;

  store.write(data);
  res.json({ ok: true, user: publicUser(user) });
});

// POST /api/matching/users/:id/reset-token -> 重新產生權杖（帳號權杖外流時使用）
router.post('/:id/reset-token', requireAdmin, (req, res) => {
  const data = store.read();
  const user = data.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: '找不到該使用者' });

  user.token = crypto.randomBytes(24).toString('hex');
  store.write(data);
  res.json({ ok: true, token: user.token });
});

module.exports = router;
