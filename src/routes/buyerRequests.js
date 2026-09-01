const express = require('express');
const crypto = require('crypto');
const db = require('../store/db');
const { requireAdmin } = require('../middleware/adminAuth');
const { isPhoneVerified } = require('../verification/phoneVerification');

const router = express.Router();

const REQUIRED_FIELDS = ['agentBrand', 'agentPhone', 'district', 'propertyType'];

function ensureCollection(data) {
  if (!Array.isArray(data.buyerRequests)) data.buyerRequests = [];
  return data;
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// GET /api/buyer-requests?district=&type=&minBudget=&maxBudget=&keyword=&status=
// status=all（含已下架）僅供後台使用，需 ADMIN_TOKEN
router.get('/', (req, res, next) => {
  if (req.query.status === 'all') return requireAdmin(req, res, next);
  next();
}, (req, res) => {
  const data = ensureCollection(db.read());
  const { district, type, minBudget, maxBudget, keyword, status } = req.query;

  let list = data.buyerRequests;

  // 公開瀏覽預設只看已上架的客需，後台管理端可加 ?status=all 看全部
  if (status === 'all') {
    // 不過濾
  } else if (status) {
    list = list.filter((r) => r.status === status);
  } else {
    list = list.filter((r) => r.status !== 'hidden');
  }

  if (district) list = list.filter((r) => r.district === district);
  if (type) list = list.filter((r) => r.propertyType === type);

  const min = toNumberOrNull(minBudget);
  const max = toNumberOrNull(maxBudget);
  if (min !== null) list = list.filter((r) => r.budgetMax === null || r.budgetMax >= min);
  if (max !== null) list = list.filter((r) => r.budgetMin === null || r.budgetMin <= max);

  if (keyword) {
    const kw = String(keyword).trim().toLowerCase();
    list = list.filter((r) =>
      [r.agentBrand, r.clientCode, r.conditions, r.remark]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(kw))
    );
  }

  list = list.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ ok: true, total: list.length, buyerRequests: list });
});

// POST /api/buyer-requests  -> 房仲刊登新客需（公開，不需 ADMIN_TOKEN）
router.post('/', (req, res) => {
  const body = req.body || {};

  const missing = REQUIRED_FIELDS.filter((field) => !String(body[field] || '').trim());
  if (missing.length) {
    return res.status(400).json({ ok: false, error: `缺少必填欄位：${missing.join('、')}` });
  }

  const agentPhone = String(body.agentPhone).trim();
  if (!isPhoneVerified(agentPhone)) {
    return res.status(403).json({ ok: false, error: '請先完成手機門號驗證後再刊登' });
  }

  const now = new Date().toISOString();
  const item = {
    id: `br_${crypto.randomUUID()}`,
    agentBrand: String(body.agentBrand).trim(),
    agentPhone,
    agentLine: String(body.agentLine || '').trim(),
    clientCode: String(body.clientCode || '').trim(),
    district: String(body.district).trim(),
    propertyType: String(body.propertyType).trim(),
    budgetMin: toNumberOrNull(body.budgetMin),
    budgetMax: toNumberOrNull(body.budgetMax),
    conditions: String(body.conditions || '').trim(),
    remark: String(body.remark || '').trim(),
    status: 'published',
    createdAt: now,
    updatedAt: now
  };

  const data = ensureCollection(db.read());
  data.buyerRequests.push(item);
  db.write(data);

  res.status(201).json({ ok: true, buyerRequest: item });
});

// PATCH /api/buyer-requests/:id -> 編輯內容 / 上架下架（後台）
router.patch('/:id', requireAdmin, (req, res) => {
  const data = ensureCollection(db.read());
  const item = data.buyerRequests.find((r) => r.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: '找不到該筆客需' });

  const editable = [
    'agentBrand',
    'agentPhone',
    'agentLine',
    'clientCode',
    'district',
    'propertyType',
    'conditions',
    'remark'
  ];
  for (const field of editable) {
    if (typeof req.body[field] === 'string') item[field] = req.body[field].trim();
  }
  if ('budgetMin' in req.body) item.budgetMin = toNumberOrNull(req.body.budgetMin);
  if ('budgetMax' in req.body) item.budgetMax = toNumberOrNull(req.body.budgetMax);
  if (req.body.status === 'published' || req.body.status === 'hidden') {
    item.status = req.body.status;
  }
  item.updatedAt = new Date().toISOString();

  db.write(data);
  res.json({ ok: true, buyerRequest: item });
});

// DELETE /api/buyer-requests/:id -> 刪除（後台）
router.delete('/:id', requireAdmin, (req, res) => {
  const data = ensureCollection(db.read());
  const before = data.buyerRequests.length;
  data.buyerRequests = data.buyerRequests.filter((r) => r.id !== req.params.id);
  if (data.buyerRequests.length === before) {
    return res.status(404).json({ ok: false, error: '找不到該筆客需' });
  }
  db.write(data);
  res.json({ ok: true });
});

module.exports = router;
