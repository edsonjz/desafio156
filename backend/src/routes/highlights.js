const express = require('express');
const router = express.Router();
const { supabase, logAudit, syncOperatorTickets } = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/highlights/suggestions - Automated engine suggestions for highlights
router.get('/suggestions', authMiddleware, async (req, res) => {
  const { week } = req.query;
  const weekRef = week || '2026-W37';

  const categories = [
    { key: 'Qualidade', icon: '🎧', ruleMatch: 'Monitoria' },
    { key: 'NPS', icon: '💬', ruleMatch: 'NPS' },
    { key: 'TMA', icon: '⏱️', ruleMatch: 'TMA' },
    { key: 'Aderência', icon: '⭐', ruleMatch: 'aderência' },
    { key: 'Evolução', icon: '📈', ruleMatch: 'Evolução' },
    { key: 'Colaboração', icon: '🤝', ruleMatch: 'Colaboração' },
    { key: 'Performance geral', icon: '🏅', ruleMatch: 'all' }
  ];

  try {
    const { data: operators } = await supabase.from('operators').select('id, name').eq('status', 'active');
    const { data: txs } = await supabase.from('point_transactions').select('*');

    const suggestions = categories.map((cat, idx) => {
      let topOp = null;
      if (operators && operators.length > 0) {
        // Find best operator or distribute across categories
        topOp = operators[idx % operators.length];
      }

      return {
        category: cat.key,
        icon: cat.icon,
        operatorId: topOp ? topOp.id : null,
        operatorName: topOp ? topOp.name : 'Operador',
        weekReference: weekRef,
        points: 10
      };
    });

    return res.json(suggestions);
  } catch (err) {
    console.error('Error generating highlight suggestions:', err);
    return res.status(500).json({ error: 'Erro ao sugerir destaques.' });
  }
});

// GET /api/highlights - List confirmed highlights from Supabase
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data: highlights, error } = await supabase
      .from('weekly_highlights')
      .select('*, operators(name, registration)')
      .order('created_at', { ascending: false });

    if (error) {
      const { data: rawHl } = await supabase.from('weekly_highlights').select('*').order('created_at', { ascending: false });
      const { data: ops } = await supabase.from('operators').select('id, name, registration');
      const opMap = {};
      (ops || []).forEach(o => { opMap[o.id] = o; });

      return res.json((rawHl || []).map(h => ({
        ...h,
        operator_name: opMap[h.operator_id] ? opMap[h.operator_id].name : 'Operador',
        registration: opMap[h.operator_id] ? opMap[h.operator_id].registration : '-'
      })));
    }

    const formatted = (highlights || []).map(h => ({
      ...h,
      operator_name: h.operators ? h.operators.name : 'Operador',
      registration: h.operators ? h.operators.registration : '-'
    }));

    return res.json(formatted);
  } catch (err) {
    console.error('Error fetching highlights from Supabase:', err);
    return res.status(500).json({ error: 'Erro ao carregar destaques.' });
  }
});

// POST /api/highlights/confirm - Admin confirms highlight and awards +10 points in Supabase
router.post('/confirm', authMiddleware, async (req, res) => {
  const { operatorId, category, weekReference } = req.body;

  if (!operatorId || !category) {
    return res.status(400).json({ error: 'Operador e categoria são obrigatórios.' });
  }

  try {
    const { data: opList } = await supabase.from('operators').select('*').eq('id', operatorId).limit(1);
    const operator = opList && opList[0];
    if (!operator) {
      return res.status(404).json({ error: 'Operador não encontrado.' });
    }

    const weekRef = weekReference || '2026-W37';

    const { data: hlData, error: hlErr } = await supabase.from('weekly_highlights').insert([{
      operator_id: operatorId,
      category,
      points: 10,
      week_reference: weekRef,
      status: 'confirmed'
    }]).select();

    if (hlErr) throw hlErr;

    const dateToday = new Date().toISOString().split('T')[0];
    await supabase.from('point_transactions').insert([{
      operator_id: operatorId,
      campaign_id: 1,
      points: 10,
      event_date: dateToday,
      description: `Destaque da Semana — Categoria: ${category}`,
      observation: `Destaque da Semana (${weekRef}) confirmado pela supervisão`,
      created_by: req.user.username
    }]);

    await syncOperatorTickets(operatorId, 1);

    await logAudit(req.user.username, 'GRANT_HIGHLIGHT', 'weekly_highlights', hlData[0].id, null, {
      operatorName: operator.name,
      category,
      weekRef,
      points: 10
    });

    return res.status(201).json({
      message: `Destaque da Semana (${category}) confirmado para ${operator.name}! +10 pontos creditados.`,
      highlightId: hlData[0].id
    });
  } catch (err) {
    console.error('Error confirming highlight in Supabase:', err);
    return res.status(500).json({ error: 'Falha ao confirmar destaque.' });
  }
});

module.exports = router;
