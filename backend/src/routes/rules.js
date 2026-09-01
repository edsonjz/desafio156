const express = require('express');
const router = express.Router();
const { supabase, logAudit } = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/rules - List all rules from Supabase
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data: rules, error } = await supabase.from('point_rules').select('*').order('type', { ascending: false }).order('id', { ascending: true });
    if (error) throw error;
    return res.json(rules || []);
  } catch (err) {
    console.error('Error fetching rules from Supabase:', err);
    return res.status(500).json({ error: 'Erro ao carregar regras.' });
  }
});

// PUT /api/rules/:id - Edit rule in Supabase
router.put('/:id', authMiddleware, async (req, res) => {
  const { points, active, description, periodicity, name } = req.body;

  try {
    const { data: ruleList } = await supabase.from('point_rules').select('*').eq('id', req.params.id).limit(1);
    const rule = ruleList && ruleList[0];
    if (!rule) {
      return res.status(404).json({ error: 'Regra não encontrada.' });
    }

    const updateFields = {
      updated_at: new Date().toISOString()
    };
    if (name !== undefined) updateFields.name = name;
    if (points !== undefined) updateFields.points = Number(points);
    if (active !== undefined) updateFields.active = active ? 1 : 0;
    if (description !== undefined) updateFields.description = description;
    if (periodicity !== undefined) updateFields.periodicity = periodicity;

    await supabase.from('point_rules').update(updateFields).eq('id', req.params.id);

    await logAudit(req.user.username, 'UPDATE_RULE', 'point_rules', req.params.id, rule, updateFields);

    return res.json({ message: 'Regra atualizada com sucesso!' });
  } catch (err) {
    console.error('Error updating rule in Supabase:', err);
    return res.status(500).json({ error: 'Falha ao atualizar regra.' });
  }
});

module.exports = router;
