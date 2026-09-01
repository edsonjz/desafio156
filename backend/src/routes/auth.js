const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, logAudit } = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  const admin = db.prepare('SELECT * FROM administrators WHERE username = ?').get(username);
  if (!admin) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  const isMatch = bcrypt.compareSync(password, admin.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  logAudit(admin.username, 'LOGIN', 'administrators', admin.id, null, 'Login realizado com sucesso');

  return res.json({
    token,
    user: { id: admin.id, username: admin.username }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  const admin = db.prepare('SELECT * FROM administrators WHERE id = ?').get(req.user.id);
  if (!admin) {
    return res.status(404).json({ error: 'Administrador não encontrado.' });
  }

  const isMatch = bcrypt.compareSync(currentPassword, admin.password_hash);
  if (!isMatch) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE administrators SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newHash, req.user.id);

  logAudit(req.user.username, 'CHANGE_PASSWORD', 'administrators', req.user.id, null, 'Senha alterada com sucesso');

  return res.json({ message: 'Senha alterada com sucesso!' });
});

module.exports = router;
