function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ erro: 'Você precisa estar logado.' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ erro: 'Acesso restrito ao administrador.' });
}

module.exports = { requireAuth, requireAdmin };
