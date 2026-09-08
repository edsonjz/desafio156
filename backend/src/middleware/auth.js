const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'desafio156_secret_key_2026_supervisores';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login para continuar.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
}

function requireMasterAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'master') {
    return res.status(403).json({ error: 'Acesso negado. Apenas o Administrador Master tem permissão para gerenciar usuários administradores.' });
  }
  next();
}


module.exports = {
  authMiddleware,
  requireMasterAdmin,
  JWT_SECRET
};
