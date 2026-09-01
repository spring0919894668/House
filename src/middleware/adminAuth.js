// 共用的後台驗證：未設定 ADMIN_TOKEN 時預設放行（僅供本機測試），
// 有設定時需帶 Authorization: Bearer <ADMIN_TOKEN>。
function requireAdmin(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN || '';
  if (!adminToken) return next();
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${adminToken}`) return next();
  res.status(401).json({ ok: false, error: '未授權，請提供正確的 ADMIN_TOKEN' });
}

module.exports = { requireAdmin };
