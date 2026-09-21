const express = require('express');
const db = require('../store/db');
const { CATEGORIES, CATEGORY_ORDER } = require('../config/categories');
const { fetchAll } = require('../news/fetcher');

const router = express.Router();

// GET /api/news?category=A&status=pending
router.get('/', (req, res) => {
  const data = db.read();
  let list = data.news;

  if (req.query.category) list = list.filter((n) => n.category === req.query.category);
  if (req.query.status) list = list.filter((n) => n.status === req.query.status);

  list = list
    .slice()
    .sort((a, b) => new Date(b.publishedAt || b.fetchedAt) - new Date(a.publishedAt || a.fetchedAt));

  res.json({ categories: CATEGORIES, order: CATEGORY_ORDER, news: list });
});

// POST /api/news/fetch  -> 立即觸發一次新聞擷取（也可交給外部 cron 定時打這支）
router.post('/fetch', async (req, res) => {
  try {
    const result = await fetchAll();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/news/:id  -> 勾選/取消勾選要發到哪些頻道、修正分類、改狀態
router.patch('/:id', (req, res) => {
  const data = db.read();
  const item = data.news.find((n) => n.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: '找不到該則新聞' });

  const { category, selectedForBot, status } = req.body;

  if (category && CATEGORIES[category]) item.category = category;

  if (selectedForBot && typeof selectedForBot === 'object') {
    item.selectedForBot = { ...item.selectedForBot, ...selectedForBot };
    const anySelected = Object.values(item.selectedForBot).some(Boolean);
    if (anySelected && item.status === 'pending') item.status = 'selected';
    if (!anySelected && item.status === 'selected') item.status = 'pending';
  }

  if (status) item.status = status;

  db.write(data);
  res.json({ ok: true, news: item });
});

module.exports = router;
