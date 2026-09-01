const express = require('express');
const router = express.Router();
const { db, logAudit, syncOperatorTickets } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/highlights/suggestions - Automated engine suggestions for highlights
router.get('/suggestions', authMiddleware, (req, res) => {
  const { week } = req.query; // e.g. 2026-W37
  const weekRef = week || '2026-W37';

  // Find top performers by rule category
  const categories = [
    { key: 'Qualidade', icon: '🎧', ruleMatch: 'Monitoria' },
    { key: 'NPS', icon: '💬', ruleMatch: 'NPS' },
    { key: 'TMA', icon: '⏱️', ruleMatch: 'TMA' },
    { key: 'Aderência', icon: '⭐', ruleMatch: 'aderência' },
    { key: 'Evolução', icon: '📈', ruleMatch: 'Evolução' },
    { key: 'Colaboração', icon: '🤝', ruleMatch: 'Colaboração' },
    { key: 'Performance geral', icon: '🏅', ruleMatch: 'all' }
  ];

  const suggestions = [];

  for (const cat of categories) {
    let topOp = null;

    if (cat.ruleMatch === 'all') {
      topOp = db.prepare(`
        SELECT o.id, o.name, COALESCE(SUM(pt.points), 0) as score
        FROM operators o
        JOIN point_transactions pt ON o.id = pt.operator_id
        WHERE o.status = 'active'
        GROUP BY o.id
        ORDER BY score DESC LIMIT 1
      `).get();
    } else {
      topOp = db.prepare(`
        SELECT o.id, o.name, COALESCE(SUM(pt.points), 0) as score
        FROM operators o
        JOIN point_transactions pt ON o.id = pt.operator_id
        JOIN point_rules pr ON pt.rule_id = pr.id
        WHERE o.status = 'active' AND (pr.name LIKE '%' || ? || '%' OR pt.description LIKE '%' || ? || '%')
        GROUP BY o.id
        ORDER BY score DESC LIMIT 1
      `).get(cat.ruleMatch, cat.ruleMatch);
    }

    if (!topOp) {
      topOp = db.prepare('SELECT id, name FROM operators WHERE status = "active" ORDER BY RANDOM() LIMIT 1').get();
    }

    if (topOp) {
      suggestions.push({
        category: cat.key,
        icon: cat.icon,
        operatorId: topOp.id,
        operatorName: topOp.name,
        weekReference: weekRef,
        points: 10
      });
    }
  }

  return res.json(suggestions);
});

// GET /api/highlights - List confirmed highlights
router.get('/', authMiddleware, (req, res) => {
  const highlights = db.prepare(`
    SELECT wh.*, o.name as operator_name, o.registration
    FROM weekly_highlights wh
    JOIN operators o ON wh.operator_id = o.id
    ORDER BY wh.created_at DESC
  `).all();

  return res.json(highlights);
});

// POST /api/highlights/confirm - Admin confirms highlight and awards +10 points
router.post('/confirm', authMiddleware, (req, res) => {
  const { operatorId, category, weekReference } = req.body;

  if (!operatorId || !category) {
    return res.status(400).json({ error: 'Operador e categoria são obrigatórios.' });
  }

  const operator = db.prepare('SELECT * FROM operators WHERE id = ?').get(operatorId);
  if (!operator) {
    return res.status(404).json({ error: 'Operador não encontrado.' });
  }

  const weekRef = weekReference || '2026-W37';

  // Save highlight
  const hlResult = db.prepare(`
    INSERT INTO weekly_highlights (operator_id, category, points, week_reference, status)
    VALUES (?, ?, 10, ?, 'confirmed')
  `).run(operatorId, category, weekRef);

  // Add +10 points to operator extrato
  const dateToday = new Date().toISOString().split('T')[0];
  const txResult = db.prepare(`
    INSERT INTO point_transactions (operator_id, campaign_id, points, event_date, description, observation, created_by)
    VALUES (?, 1, 10, ?, ?, ?, ?)
  `).run(
    operatorId,
    dateToday,
    `Destaque da Semana — Categoria: ${category}`,
    `Destaque da Semana (${weekRef}) confirmado pela supervisão`,
    req.user.username
  );

  syncOperatorTickets(operatorId, 1);

  logAudit(req.user.username, 'GRANT_HIGHLIGHT', 'weekly_highlights', hlResult.lastInsertRowid, null, {
    operatorName: operator.name,
    category,
    weekRef,
    points: 10
  });

  return res.status(201).json({
    message: `Destaque da Semana (${category}) confirmado para ${operator.name}! +10 pontos creditados.`,
    highlightId: hlResult.lastInsertRowid
  });
});

module.exports = router;
