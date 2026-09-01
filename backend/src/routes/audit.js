const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/audit - List audit logs with filters from Supabase
router.get('/', authMiddleware, async (req, res) => {
  const { action, entity, user } = req.query;

  try {
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);

    if (action) {
      query = query.eq('action', action);
    }
    if (entity) {
      query = query.eq('entity', entity);
    }
    if (user) {
      query = query.ilike('user_id', `%${user}%`);
    }

    const { data: logs, error } = await query;
    if (error) throw error;

    return res.json(logs || []);
  } catch (err) {
    console.error('Error fetching audit logs from Supabase:', err);
    return res.status(500).json({ error: 'Erro ao carregar logs de auditoria.' });
  }
});

module.exports = router;
