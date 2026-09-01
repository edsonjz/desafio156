const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, logAudit } = require('../db/supabaseService');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  try {
    const { data: admins, error } = await supabase
      .from('administrators')
      .select('*')
      .eq('username', username.trim())
      .limit(1);

    if (error) {
      console.error('Supabase admin login query error:', error);
      return res.status(500).json({ error: 'Erro ao consultar banco de dados.' });
    }

    const admin = admins && admins[0];
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

    await logAudit(admin.username, 'LOGIN', 'administrators', admin.id, null, 'Login realizado com sucesso');

    return res.json({
      token,
      user: { id: admin.id, username: admin.username }
    });
  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ error: 'Erro interno no servidor ao tentar login.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  try {
    const { data: admins } = await supabase.from('administrators').select('*').eq('id', req.user.id).limit(1);
    const admin = admins && admins[0];
    if (!admin) {
      return res.status(404).json({ error: 'Administrador não encontrado.' });
    }

    const isMatch = bcrypt.compareSync(currentPassword, admin.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await supabase.from('administrators').update({
      password_hash: newHash,
      updated_at: new Date().toISOString()
    }).eq('id', req.user.id);

    await logAudit(req.user.username, 'CHANGE_PASSWORD', 'administrators', req.user.id, null, 'Senha alterada com sucesso');

    return res.json({ message: 'Senha alterada com sucesso!' });
  } catch (err) {
    console.error('Error changing password:', err);
    return res.status(500).json({ error: 'Falha ao alterar senha.' });
  }
});

module.exports = router;
