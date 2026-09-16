const express = require('express');
const crypto = require('crypto');
const store = require('../store');
const { authenticate, canView } = require('../auth');

const router = express.Router();
router.use(authenticate);

function decorateNeed(need, data) {
  return {
    ...need,
    createdByName: (data.users.find((u) => u.id === need.createdBy) || {}).name || '未知使用者'
  };
}

function decorateReferral(referral, data) {
  const caseItem = data.cases.find((c) => c.id === referral.caseId);
  return {
    ...referral,
    recommendedByName: (data.users.find((u) => u.id === referral.recommendedBy) || {}).name || '未知使用者',
    case: caseItem
      ? { id: caseItem.id, title: caseItem.title, region: caseItem.region, propertyType: caseItem.propertyType }
      : null
  };
}

// GET /api/matching/buyer-needs -> 客需牆（買方經紀張貼的買方需求）
router.get('/', (req, res) => {
  const data = store.read();
  const needs = data.buyerNeeds
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((n) => decorateNeed(n, data));
  res.json({ ok: true, buyerNeeds: needs });
});

// POST /api/matching/buyer-needs -> 張貼買方客需，讓同事推薦手上案件
router.post('/', (req, res) => {
  const { title, requirement } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, error: '請輸入客需標題' });

  const data = store.read();
  const need = {
    id: crypto.randomUUID(),
    title,
    requirement: {
      propertyType: (requirement && requirement.propertyType) || '',
      region: (requirement && requirement.region) || '',
      minArea: Number(requirement && requirement.minArea) || 0,
      maxBudget: Number(requirement && requirement.maxBudget) || 0,
      note: (requirement && requirement.note) || ''
    },
    createdBy: req.matchingUser.id,
    status: 'open',
    createdAt: new Date().toISOString()
  };
  data.buyerNeeds.push(need);
  store.write(data);
  res.json({ ok: true, buyerNeed: decorateNeed(need, data) });
});

// PATCH /api/matching/buyer-needs/:id -> 客需張貼者調整狀態（open/matched/closed）
router.patch('/:id', (req, res) => {
  const data = store.read();
  const need = data.buyerNeeds.find((n) => n.id === req.params.id);
  if (!need) return res.status(404).json({ ok: false, error: '找不到該客需' });
  if (need.createdBy !== req.matchingUser.id && req.matchingUser.role !== 'admin') {
    return res.status(403).json({ ok: false, error: '僅張貼者或管理者可調整此客需' });
  }
  const { status } = req.body || {};
  if (!['open', 'matched', 'closed'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'status 需為 open/matched/closed' });
  }
  need.status = status;
  store.write(data);
  res.json({ ok: true, buyerNeed: decorateNeed(need, data) });
});

// GET /api/matching/buyer-needs/:id/referrals -> 該客需目前收到的案件推薦
router.get('/:id/referrals', (req, res) => {
  const data = store.read();
  const need = data.buyerNeeds.find((n) => n.id === req.params.id);
  if (!need) return res.status(404).json({ ok: false, error: '找不到該客需' });
  const referrals = data.referrals
    .filter((r) => r.buyerNeedId === need.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => decorateReferral(r, data));
  res.json({ ok: true, referrals });
});

// POST /api/matching/buyer-needs/:id/referrals -> 同事推薦手上案件媒合此客需
router.post('/:id/referrals', (req, res) => {
  const data = store.read();
  const need = data.buyerNeeds.find((n) => n.id === req.params.id);
  if (!need) return res.status(404).json({ ok: false, error: '找不到該客需' });

  const { caseId, note } = req.body || {};
  const caseItem = data.cases.find((c) => c.id === caseId);
  if (!caseItem) return res.status(404).json({ ok: false, error: '找不到該案件' });
  if (!canView(req.matchingUser, caseItem)) {
    return res.status(403).json({ ok: false, error: '沒有權限推薦此案件（請先確認自己有檢視權限）' });
  }

  const referral = {
    id: crypto.randomUUID(),
    buyerNeedId: need.id,
    caseId: caseItem.id,
    recommendedBy: req.matchingUser.id,
    note: note || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  data.referrals.push(referral);
  store.write(data);
  res.json({ ok: true, referral: decorateReferral(referral, data) });
});

// PATCH /api/matching/buyer-needs/referrals/:id -> 客需張貼者接受/婉拒推薦；接受時自動授與案件檢視權限
router.patch('/referrals/:id', (req, res) => {
  const data = store.read();
  const referral = data.referrals.find((r) => r.id === req.params.id);
  if (!referral) return res.status(404).json({ ok: false, error: '找不到該筆推薦' });
  const need = data.buyerNeeds.find((n) => n.id === referral.buyerNeedId);
  if (!need) return res.status(404).json({ ok: false, error: '找不到對應客需' });
  if (need.createdBy !== req.matchingUser.id && req.matchingUser.role !== 'admin') {
    return res.status(403).json({ ok: false, error: '僅客需張貼者或管理者可回應推薦' });
  }

  const { status } = req.body || {};
  if (!['accepted', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'status 需為 accepted/rejected/pending' });
  }
  referral.status = status;

  if (status === 'accepted') {
    const caseItem = data.cases.find((c) => c.id === referral.caseId);
    if (caseItem && caseItem.createdBy !== need.createdBy) {
      const already = (caseItem.members || []).some((m) => m.userId === need.createdBy);
      if (!already) {
        caseItem.members = [...(caseItem.members || []), { userId: need.createdBy, permission: 'view' }];
        caseItem.updatedAt = new Date().toISOString();
      }
    }
    need.status = 'matched';
  }

  store.write(data);
  res.json({ ok: true, referral: decorateReferral(referral, data) });
});

module.exports = router;
