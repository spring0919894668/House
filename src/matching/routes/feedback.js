const express = require('express');
const crypto = require('crypto');
const store = require('../store');
const { authenticate, requireAdmin } = require('../auth');

const router = express.Router();
router.use(authenticate);

function decorate(item, data) {
  return {
    ...item,
    authorName: (data.users.find((u) => u.id === item.authorId) || {}).name || '未知使用者'
  };
}

// POST /api/matching/feedback -> 任何已登入使用者都可以針對某個畫面留下意見回饋
router.post('/', (req, res) => {
  const { page, rating, content } = req.body || {};
  const trimmedContent = (content || '').trim();
  const ratingNum = Number(rating);
  const hasRating = Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 5;

  if (!trimmedContent && !hasRating) {
    return res.status(400).json({ ok: false, error: '請至少填寫評分或意見內容' });
  }

  const data = store.read();
  const item = {
    id: crypto.randomUUID(),
    authorId: req.matchingUser.id,
    page: page || '',
    rating: hasRating ? ratingNum : null,
    content: trimmedContent,
    status: 'new',
    createdAt: new Date().toISOString()
  };
  data.feedback.push(item);
  store.write(data);
  res.json({ ok: true, feedback: decorate(item, data) });
});

// GET /api/matching/feedback -> 僅管理者可檢視所有回饋，供彙整同事試用意見
router.get('/', requireAdmin, (req, res) => {
  const data = store.read();
  const list = data.feedback
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((f) => decorate(f, data));
  res.json({ ok: true, feedback: list });
});

// PATCH /api/matching/feedback/:id -> 管理者標記某則回饋已處理/未處理
router.patch('/:id', requireAdmin, (req, res) => {
  const data = store.read();
  const item = data.feedback.find((f) => f.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: '找不到該筆回饋' });

  const { status } = req.body || {};
  if (!['new', 'reviewed'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'status 需為 new 或 reviewed' });
  }
  item.status = status;
  store.write(data);
  res.json({ ok: true, feedback: decorate(item, data) });
});

module.exports = router;
