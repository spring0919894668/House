const express = require('express');
const crypto = require('crypto');
const store = require('../store');
const { authenticate, canView } = require('../auth');

const router = express.Router();
router.use(authenticate);

function getCaseOr404(data, caseId, res) {
  const caseItem = data.cases.find((c) => c.id === caseId);
  if (!caseItem) {
    res.status(404).json({ ok: false, error: '找不到該案件' });
    return null;
  }
  return caseItem;
}

// GET /api/matching/cases/:caseId/comments -> 案件專屬討論區留言
router.get('/cases/:caseId/comments', (req, res) => {
  const data = store.read();
  const caseItem = getCaseOr404(data, req.params.caseId, res);
  if (!caseItem) return;
  if (!canView(req.matchingUser, caseItem)) {
    return res.status(403).json({ ok: false, error: '沒有權限檢視此案件討論區' });
  }
  const comments = data.comments
    .filter((c) => c.caseId === caseItem.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((c) => ({ ...c, authorName: (data.users.find((u) => u.id === c.authorId) || {}).name || '未知使用者' }));
  res.json({ ok: true, comments });
});

// POST /api/matching/cases/:caseId/comments -> 發表留言（討論對案件的了解、疑問等）
router.post('/cases/:caseId/comments', (req, res) => {
  const data = store.read();
  const caseItem = getCaseOr404(data, req.params.caseId, res);
  if (!caseItem) return;
  if (!canView(req.matchingUser, caseItem)) {
    return res.status(403).json({ ok: false, error: '沒有權限在此案件討論區留言' });
  }
  const { content } = req.body || {};
  if (!content || !content.trim()) {
    return res.status(400).json({ ok: false, error: '留言內容不可為空' });
  }
  const comment = {
    id: crypto.randomUUID(),
    caseId: caseItem.id,
    authorId: req.matchingUser.id,
    content: content.trim(),
    createdAt: new Date().toISOString()
  };
  data.comments.push(comment);
  store.write(data);
  res.json({ ok: true, comment: { ...comment, authorName: req.matchingUser.name } });
});

// DELETE /api/matching/comments/:id -> 留言者本人或管理者可刪除
router.delete('/comments/:id', (req, res) => {
  const data = store.read();
  const comment = data.comments.find((c) => c.id === req.params.id);
  if (!comment) return res.status(404).json({ ok: false, error: '找不到該留言' });
  if (comment.authorId !== req.matchingUser.id && req.matchingUser.role !== 'admin') {
    return res.status(403).json({ ok: false, error: '僅留言者本人或管理者可刪除' });
  }
  data.comments = data.comments.filter((c) => c.id !== comment.id);
  store.write(data);
  res.json({ ok: true });
});

module.exports = router;
