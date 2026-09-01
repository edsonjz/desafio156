const express = require('express');
const router = express.Router();
const { db, logAudit } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/rules - List all rules
router.get('/', authMiddleware, (req, res) => {
  const rules = db.prepare('SELECT * FROM point_rules ORDER BY type DESC, id ASC').all();
  return res.json(rules);
});

// PUT /api/rules/:id - Edit rule (points, active, description, periodicity)
router.put('/:id', authMiddleware, (req, res) => {
  const { points, active, description, periodicity, name } = req.body;

  const rule = db.prepare('SELECT * FROM point_rules WHERE id = ?').get(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: 'Regra não encontrada.' });
  }

  const updatedName = name !== undefined ? name : rule.name;
  const updatedPoints = points !== undefined ? Number(points) : rule.points;
  const updatedActive = active !== undefined ? (active ? 1 : 0) : rule.active;
  const updatedDescription = description !== undefined ? description : rule.description;
  const updatedPeriodicity = periodicity !== undefined ? periodicity : rule.periodicity;

  db.prepare(`
    UPDATE point_rules
    SET name = ?, points = ?, active = ?, description = ?, periodicity = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(updatedName, updatedPoints, updatedActive, updatedDescription, updatedPeriodicity, req.params.id);

  logAudit(req.user.username, 'UPDATE_RULE', 'point_rules', req.params.id, rule, {
    name: updatedName,
    points: updatedPoints,
    active: updatedActive,
    description: updatedDescription,
    periodicity: updatedPeriodicity
  });

  return res.json({ message: 'Regra atualizada com sucesso!' });
});

module.exports = router;
