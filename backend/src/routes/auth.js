const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, logAudit } = require('../db/supabaseService');
const { authMiddleware, requireMasterAdmin, JWT_SECRET } = require('../middleware/auth');

// In-memory sliding window rate limiter for login protection
const loginAttempts = new Map();
function rateLimitLogin(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxAttempts = 5;

  const attempts = (loginAttempts.get(ip) || []).filter(t => now - t < windowMs);
  loginAttempts.set(ip, attempts);

  if (attempts.length >= maxAttempts) {
    return res.status(429).json({
      error: 'Muitas tentativas de login incorretas. Por segurança, aguarde 1 minuto para tentar novamente.'
    });
  }

  req.recordFailedAttempt = () => {
    const list = loginAttempts.get(ip) || [];
    list.push(Date.now());
    loginAttempts.set(ip, list);
  };

  req.clearFailedAttempts = () => {
    loginAttempts.delete(ip);
  };

  next();
}

// POST /api/auth/login
router.post('/login', rateLimitLogin, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  try {
    const cleanUsername = String(username).trim();
    const { data: admins, error } = await supabase
      .from('administrators')
      .select('*')
      .ilike('username', cleanUsername)
      .limit(1);

    if (error) {
      console.error('Supabase admin login query error:', error);
      return res.status(500).json({ error: 'Erro ao consultar banco de dados.' });
    }

    const admin = admins && admins[0];
    if (!admin) {
      req.recordFailedAttempt();
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const isMatch = bcrypt.compareSync(password, admin.password_hash);
    if (!isMatch) {
      req.recordFailedAttempt();
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    req.clearFailedAttempts();

    const role = admin.role || 'admin';
    const isMaster = role === 'master';

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        role,
        is_master: isMaster
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAudit(admin.username, 'LOGIN', 'administrators', String(admin.id), null, 'Login realizado com sucesso');

    return res.json({
      token,
      user: {
        id: admin.id,
        username: admin.username,
        role,
        isMaster
      }
    });
  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ error: 'Erro interno no servidor ao tentar login.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role || 'admin',
      isMaster: req.user.role === 'master' || !!req.user.is_master
    }
  });
});

// PUT /api/auth/change-password (User alters own password)
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

    await logAudit(req.user.username, 'CHANGE_PASSWORD', 'administrators', String(req.user.id), null, 'Senha alterada com sucesso');

    return res.json({ message: 'Senha alterada com sucesso!' });
  } catch (err) {
    console.error('Error changing password:', err);
    return res.status(500).json({ error: 'Falha ao alterar senha.' });
  }
});

// ============================================================================
// GESTÃO DE ADMINISTRADORES (Master Admin)
// ============================================================================

// GET /api/auth/users - List all administrators
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('administrators')
      .select('id, username, role, created_at, updated_at')
      .order('id', { ascending: true });

    if (error) throw error;

    return res.json(users || []);
  } catch (err) {
    console.error('Error fetching admin users:', err);
    return res.status(500).json({ error: 'Erro ao carregar lista de administradores.' });
  }
});

// POST /api/auth/users - Create new administrator (Master Admin only)
router.post('/users', authMiddleware, requireMasterAdmin, async (req, res) => {
  const { username, password, role } = req.body;

  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '');
  const chosenRole = (role === 'master') ? 'master' : 'admin';

  if (!cleanUsername || cleanUsername.length < 3) {
    return res.status(400).json({ error: 'O nome de usuário deve ter pelo menos 3 caracteres.' });
  }

  // Username validation: letters, numbers, underscores and dots only
  if (!/^[a-z0-9._-]+$/.test(cleanUsername)) {
    return res.status(400).json({ error: 'O nome de usuário deve conter apenas letras minúsculas, números, pontos e hífens.' });
  }

  if (!cleanPassword || cleanPassword.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
  }

  try {
    // Check duplicate
    const { data: existing } = await supabase
      .from('administrators')
      .select('id')
      .ilike('username', cleanUsername)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: `O usuário "${cleanUsername}" já está cadastrado.` });
    }

    const password_hash = bcrypt.hashSync(cleanPassword, 10);
    const now = new Date().toISOString();

    const { data: inserted, error: insErr } = await supabase
      .from('administrators')
      .insert([{
        username: cleanUsername,
        password_hash,
        role: chosenRole,
        created_at: now,
        updated_at: now
      }])
      .select('id, username, role, created_at, updated_at');

    if (insErr) throw insErr;

    const createdAdmin = inserted && inserted[0];

    await logAudit(
      req.user.username,
      'CREATE_ADMIN',
      'administrators',
      String(createdAdmin.id),
      null,
      `Administrador ${cleanUsername} (${chosenRole}) criado por ${req.user.username}`
    );

    return res.status(201).json({
      message: `Administrador "${cleanUsername}" criado com sucesso!`,
      user: createdAdmin
    });
  } catch (err) {
    console.error('Error creating admin user:', err);
    return res.status(500).json({ error: 'Erro ao criar novo administrador.' });
  }
});

// PUT /api/auth/users/:id/password - Master Admin resets another administrator's password
router.put('/users/:id/password', authMiddleware, requireMasterAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  try {
    const { data: admins } = await supabase
      .from('administrators')
      .select('id, username, role')
      .eq('id', targetId)
      .limit(1);

    const targetAdmin = admins && admins[0];
    if (!targetAdmin) {
      return res.status(404).json({ error: 'Administrador não encontrado.' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await supabase.from('administrators').update({
      password_hash: newHash,
      updated_at: new Date().toISOString()
    }).eq('id', targetId);

    await logAudit(
      req.user.username,
      'RESET_ADMIN_PASSWORD',
      'administrators',
      String(targetId),
      null,
      `Senha do administrador ${targetAdmin.username} redefinida pelo Master Admin ${req.user.username}`
    );

    return res.json({ message: `Senha do usuário "${targetAdmin.username}" redefinida com sucesso!` });
  } catch (err) {
    console.error('Error resetting admin password:', err);
    return res.status(500).json({ error: 'Erro ao redefinir senha do administrador.' });
  }
});

// DELETE /api/auth/users/:id - Master Admin deletes an administrator
router.delete('/users/:id', authMiddleware, requireMasterAdmin, async (req, res) => {
  const targetId = Number(req.params.id);

  if (req.user.id === targetId) {
    return res.status(400).json({ error: 'Você não pode excluir sua própria conta de administrador.' });
  }

  try {
    const { data: admins } = await supabase
      .from('administrators')
      .select('id, username, role')
      .eq('id', targetId)
      .limit(1);

    const targetAdmin = admins && admins[0];
    if (!targetAdmin) {
      return res.status(404).json({ error: 'Administrador não encontrado.' });
    }

    if (targetAdmin.username === 'admin' || (targetAdmin.role === 'master' && targetAdmin.id === 1)) {
      return res.status(400).json({ error: 'O Administrador Master principal do sistema não pode ser excluído.' });
    }

    const { error: delErr } = await supabase
      .from('administrators')
      .delete()
      .eq('id', targetId);

    if (delErr) throw delErr;

    await logAudit(
      req.user.username,
      'DELETE_ADMIN',
      'administrators',
      String(targetId),
      targetAdmin,
      `Administrador ${targetAdmin.username} removido por ${req.user.username}`
    );

    return res.json({ message: `Administrador "${targetAdmin.username}" removido com sucesso.` });
  } catch (err) {
    console.error('Error deleting admin user:', err);
    return res.status(500).json({ error: 'Erro ao excluir administrador.' });
  }
});

module.exports = router;
