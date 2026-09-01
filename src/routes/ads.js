const express = require('express');
const crypto = require('crypto');
const db = require('../store/db');
const { requireAdmin } = require('../middleware/adminAuth');

const router = express.Router();

function ensureCollection(data) {
  if (!Array.isArray(data.ads)) data.ads = [];
  return data;
}

function isActiveNow(ad, now = new Date()) {
  if (ad.status !== 'active') return false;
  if (ad.startDate && now < new Date(ad.startDate)) return false;
  if (ad.endDate && now > new Date(`${ad.endDate}T23:59:59`)) return false;
  return true;
}

// GET /api/ads -> 前台目前有效的廣告（依 position 排序），並累計曝光數
router.get('/', (req, res) => {
  const data = ensureCollection(db.read());
  const now = new Date();
  const activeAds = data.ads.filter((ad) => isActiveNow(ad, now));

  activeAds.forEach((ad) => {
    ad.impressions = (ad.impressions || 0) + 1;
  });
  if (activeAds.length) db.write(data);

  const list = activeAds
    .slice()
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .map(({ id, title, imageUrl, linkUrl, sponsor }) => ({ id, title, imageUrl, linkUrl, sponsor }));

  res.json({ ok: true, ads: list });
});

// GET /api/ads/all -> 後台：全部廣告（含下架/過期）
router.get('/all', requireAdmin, (req, res) => {
  const data = ensureCollection(db.read());
  const list = data.ads.slice().sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  res.json({ ok: true, ads: list });
});

// POST /api/ads -> 後台新增廣告
router.post('/', requireAdmin, (req, res) => {
  const body = req.body || {};
  if (!String(body.title || '').trim() || !String(body.imageUrl || '').trim()) {
    return res.status(400).json({ ok: false, error: '缺少必填欄位：title、imageUrl' });
  }

  const data = ensureCollection(db.read());
  const item = {
    id: `ad_${crypto.randomUUID()}`,
    title: String(body.title).trim(),
    imageUrl: String(body.imageUrl).trim(),
    linkUrl: String(body.linkUrl || '').trim(),
    sponsor: String(body.sponsor || '').trim(),
    position: Number.isFinite(Number(body.position)) ? Number(body.position) : data.ads.length + 1,
    startDate: String(body.startDate || '').trim(),
    endDate: String(body.endDate || '').trim(),
    paidStatus: body.paidStatus === 'paid' ? 'paid' : 'unpaid',
    status: body.status === 'inactive' ? 'inactive' : 'active',
    impressions: 0,
    clicks: 0,
    createdAt: new Date().toISOString()
  };

  data.ads.push(item);
  db.write(data);
  res.status(201).json({ ok: true, ad: item });
});

// PATCH /api/ads/:id -> 後台編輯廣告（含上下架、收費狀態）
router.patch('/:id', requireAdmin, (req, res) => {
  const data = ensureCollection(db.read());
  const ad = data.ads.find((a) => a.id === req.params.id);
  if (!ad) return res.status(404).json({ ok: false, error: '找不到該則廣告' });

  const stringFields = ['title', 'imageUrl', 'linkUrl', 'sponsor', 'startDate', 'endDate'];
  for (const field of stringFields) {
    if (typeof req.body[field] === 'string') ad[field] = req.body[field].trim();
  }
  if ('position' in req.body && Number.isFinite(Number(req.body.position))) {
    ad.position = Number(req.body.position);
  }
  if (req.body.paidStatus === 'paid' || req.body.paidStatus === 'unpaid') {
    ad.paidStatus = req.body.paidStatus;
  }
  if (req.body.status === 'active' || req.body.status === 'inactive') {
    ad.status = req.body.status;
  }

  db.write(data);
  res.json({ ok: true, ad });
});

// DELETE /api/ads/:id -> 後台刪除廣告
router.delete('/:id', requireAdmin, (req, res) => {
  const data = ensureCollection(db.read());
  const before = data.ads.length;
  data.ads = data.ads.filter((a) => a.id !== req.params.id);
  if (data.ads.length === before) return res.status(404).json({ ok: false, error: '找不到該則廣告' });
  db.write(data);
  res.json({ ok: true });
});

// POST /api/ads/:id/click -> 前台點擊廣告時記錄一次點擊（公開）
router.post('/:id/click', (req, res) => {
  const data = ensureCollection(db.read());
  const ad = data.ads.find((a) => a.id === req.params.id);
  if (!ad) return res.status(404).json({ ok: false, error: '找不到該則廣告' });
  ad.clicks = (ad.clicks || 0) + 1;
  db.write(data);
  res.json({ ok: true });
});

module.exports = router;
