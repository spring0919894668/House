const express = require('express');
const crypto = require('crypto');
const store = require('../store');
const {
  authenticate,
  getCasePermission,
  canView,
  canEdit,
  isOwner
} = require('../auth');

const router = express.Router();
router.use(authenticate);

const OWNERSHIP_STATUSES = ['confirmed', 'pending', 'disputed'];
const CURRENT_STATUSES = ['inUse', 'vacant', 'seized', 'other'];

function withPermission(caseItem, user) {
  return { ...caseItem, myPermission: getCasePermission(user, caseItem) };
}

function findCaseOr404(data, id, res) {
  const item = data.cases.find((c) => c.id === id);
  if (!item) {
    res.status(404).json({ ok: false, error: '找不到該案件' });
    return null;
  }
  return item;
}

// GET /api/matching/cases -> 只列出使用者看得到的案件（自己建立/被授權/團隊共享）
router.get('/', (req, res) => {
  const data = store.read();
  const visible = data.cases.filter((c) => canView(req.matchingUser, c));
  const list = visible
    .map((c) => withPermission(c, req.matchingUser))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  res.json({ ok: true, cases: list });
});

// POST /api/matching/cases -> 建立新案件（建立者自動為 owner）
router.post('/', (req, res) => {
  const {
    title,
    address,
    region,
    propertyType,
    area,
    unit,
    askingPrice,
    ownerName,
    ownerContact,
    ownershipStatus,
    ownershipNote,
    currentStatus,
    currentStatusNote,
    visibility
  } = req.body || {};

  if (!title) return res.status(400).json({ ok: false, error: '請輸入案件名稱' });

  const now = new Date().toISOString();
  const caseItem = {
    id: crypto.randomUUID(),
    title,
    address: address || '',
    region: region || '',
    propertyType: propertyType || '',
    area: Number(area) || 0,
    unit: unit || '坪',
    askingPrice: Number(askingPrice) || 0,
    ownerName: ownerName || '',
    ownerContact: ownerContact || '',
    ownershipStatus: OWNERSHIP_STATUSES.includes(ownershipStatus) ? ownershipStatus : 'pending',
    ownershipNote: ownershipNote || '',
    currentStatus: CURRENT_STATUSES.includes(currentStatus) ? currentStatus : 'other',
    currentStatusNote: currentStatusNote || '',
    viewings: [],
    comparables: [],
    visibility: visibility === 'team' ? 'team' : 'private',
    members: [],
    createdBy: req.matchingUser.id,
    createdAt: now,
    updatedAt: now
  };

  const data = store.read();
  data.cases.push(caseItem);
  store.write(data);
  res.json({ ok: true, case: withPermission(caseItem, req.matchingUser) });
});

// GET /api/matching/cases/:id -> 案件詳情
router.get('/:id', (req, res) => {
  const data = store.read();
  const caseItem = findCaseOr404(data, req.params.id, res);
  if (!caseItem) return;
  if (!canView(req.matchingUser, caseItem)) {
    return res.status(403).json({ ok: false, error: '沒有權限檢視此案件' });
  }
  res.json({ ok: true, case: withPermission(caseItem, req.matchingUser) });
});

// PATCH /api/matching/cases/:id -> 更新案件資料（產權確認、現況、價格等）
router.patch('/:id', (req, res) => {
  const data = store.read();
  const caseItem = findCaseOr404(data, req.params.id, res);
  if (!caseItem) return;
  if (!canEdit(req.matchingUser, caseItem)) {
    return res.status(403).json({ ok: false, error: '沒有編輯權限' });
  }

  const fields = req.body || {};
  const stringFields = [
    'title',
    'address',
    'region',
    'propertyType',
    'unit',
    'ownerName',
    'ownerContact',
    'ownershipNote',
    'currentStatusNote'
  ];
  for (const f of stringFields) {
    if (typeof fields[f] === 'string') caseItem[f] = fields[f];
  }
  if (fields.area !== undefined) caseItem.area = Number(fields.area) || caseItem.area;
  if (fields.askingPrice !== undefined) caseItem.askingPrice = Number(fields.askingPrice) || 0;
  if (OWNERSHIP_STATUSES.includes(fields.ownershipStatus)) caseItem.ownershipStatus = fields.ownershipStatus;
  if (CURRENT_STATUSES.includes(fields.currentStatus)) caseItem.currentStatus = fields.currentStatus;

  caseItem.updatedAt = new Date().toISOString();
  store.write(data);
  res.json({ ok: true, case: withPermission(caseItem, req.matchingUser) });
});

// DELETE /api/matching/cases/:id -> 僅 owner／管理者可刪除
router.delete('/:id', (req, res) => {
  const data = store.read();
  const caseItem = findCaseOr404(data, req.params.id, res);
  if (!caseItem) return;
  if (!isOwner(req.matchingUser, caseItem)) {
    return res.status(403).json({ ok: false, error: '僅案件建立者或管理者可刪除' });
  }
  data.cases = data.cases.filter((c) => c.id !== caseItem.id);
  data.comments = data.comments.filter((c) => c.caseId !== caseItem.id);
  data.referrals = data.referrals.filter((r) => r.caseId !== caseItem.id);
  store.write(data);
  res.json({ ok: true });
});

// PUT /api/matching/cases/:id/visibility -> 設定案件是否對團隊全體可見
router.put('/:id/visibility', (req, res) => {
  const data = store.read();
  const caseItem = findCaseOr404(data, req.params.id, res);
  if (!caseItem) return;
  if (!isOwner(req.matchingUser, caseItem)) {
    return res.status(403).json({ ok: false, error: '僅案件建立者或管理者可設定可見範圍' });
  }
  const { visibility } = req.body || {};
  if (!['private', 'team'].includes(visibility)) {
    return res.status(400).json({ ok: false, error: 'visibility 需為 private 或 team' });
  }
  caseItem.visibility = visibility;
  caseItem.updatedAt = new Date().toISOString();
  store.write(data);
  res.json({ ok: true, case: withPermission(caseItem, req.matchingUser) });
});

// PUT /api/matching/cases/:id/members -> 設定指定同事對此案件的檢視／編輯權限
router.put('/:id/members', (req, res) => {
  const data = store.read();
  const caseItem = findCaseOr404(data, req.params.id, res);
  if (!caseItem) return;
  if (!isOwner(req.matchingUser, caseItem)) {
    return res.status(403).json({ ok: false, error: '僅案件建立者或管理者可設定成員權限' });
  }
  const { members } = req.body || {};
  if (!Array.isArray(members)) {
    return res.status(400).json({ ok: false, error: 'members 需為陣列' });
  }
  const validUserIds = new Set(data.users.map((u) => u.id));
  caseItem.members = members
    .filter((m) => m && validUserIds.has(m.userId) && m.userId !== caseItem.createdBy)
    .map((m) => ({ userId: m.userId, permission: m.permission === 'edit' ? 'edit' : 'view' }));

  caseItem.updatedAt = new Date().toISOString();
  store.write(data);
  res.json({ ok: true, case: withPermission(caseItem, req.matchingUser) });
});

// POST /api/matching/cases/:id/viewings -> 新增帶看紀錄
router.post('/:id/viewings', (req, res) => {
  const data = store.read();
  const caseItem = findCaseOr404(data, req.params.id, res);
  if (!caseItem) return;
  if (!canEdit(req.matchingUser, caseItem)) {
    return res.status(403).json({ ok: false, error: '沒有編輯權限' });
  }
  const { date, attendee, note } = req.body || {};
  const viewing = {
    id: crypto.randomUUID(),
    date: date || new Date().toISOString().slice(0, 10),
    agentId: req.matchingUser.id,
    attendee: attendee || '',
    note: note || '',
    createdAt: new Date().toISOString()
  };
  caseItem.viewings.push(viewing);
  caseItem.updatedAt = new Date().toISOString();
  store.write(data);
  res.json({ ok: true, case: withPermission(caseItem, req.matchingUser) });
});

// POST /api/matching/cases/:id/comparables -> 新增比較案例（供實價分析試算使用）
router.post('/:id/comparables', (req, res) => {
  const data = store.read();
  const caseItem = findCaseOr404(data, req.params.id, res);
  if (!caseItem) return;
  if (!canEdit(req.matchingUser, caseItem)) {
    return res.status(403).json({ ok: false, error: '沒有編輯權限' });
  }
  const { date, price, area, note } = req.body || {};
  if (!price || !area) {
    return res.status(400).json({ ok: false, error: '請輸入成交/開價與面積' });
  }
  caseItem.comparables.push({
    id: crypto.randomUUID(),
    date: date || '',
    price: Number(price),
    area: Number(area),
    note: note || ''
  });
  caseItem.updatedAt = new Date().toISOString();
  store.write(data);
  res.json({ ok: true, case: withPermission(caseItem, req.matchingUser) });
});

module.exports = router;
