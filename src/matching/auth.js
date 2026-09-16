const store = require('./store');

// 以權杖（token）辨識使用者，取代新聞系統單一 ADMIN_TOKEN 的作法，
// 讓每位經紀同事都能有各自的登入身份，才能做到「可設定權限」。

function authenticate(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ ok: false, error: '請先登入（缺少存取權杖）' });
  }
  const data = store.read();
  const user = data.users.find((u) => u.token === token);
  if (!user || user.active === false) {
    return res.status(401).json({ ok: false, error: '權杖無效或帳號已停用，請聯絡管理者' });
  }
  req.matchingUser = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.matchingUser.role !== 'admin') {
    return res.status(403).json({ ok: false, error: '僅系統管理者可執行此操作' });
  }
  next();
}

// 回傳使用者對某案件的權限："owner" | "edit" | "view" | null
function getCasePermission(user, caseItem) {
  if (!caseItem) return null;
  if (user.role === 'admin' || caseItem.createdBy === user.id) return 'owner';
  const member = (caseItem.members || []).find((m) => m.userId === user.id);
  if (member) return member.permission === 'edit' ? 'edit' : 'view';
  if (caseItem.visibility === 'team') return 'view';
  return null;
}

function canView(user, caseItem) {
  return getCasePermission(user, caseItem) !== null;
}

function canEdit(user, caseItem) {
  const perm = getCasePermission(user, caseItem);
  return perm === 'owner' || perm === 'edit';
}

function isOwner(user, caseItem) {
  return getCasePermission(user, caseItem) === 'owner';
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    agentType: user.agentType,
    active: user.active !== false
  };
}

module.exports = {
  authenticate,
  requireAdmin,
  getCasePermission,
  canView,
  canEdit,
  isOwner,
  publicUser
};
