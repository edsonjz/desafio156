const express = require('express');
const router = express.Router();
const { db, logAudit } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/prizes - List operational prizes with status filter
router.get('/', authMiddleware, (req, res) => {
  const { status, operatorId } = req.query;

  let query = `
    SELECT p.*, o.name as operator_name, o.registration
    FROM prizes p
    JOIN operators o ON p.operator_id = o.id
  `;

  const where = [];
  const params = [];

  if (status) {
    where.push('p.status = ?');
    params.push(status);
  }

  if (operatorId) {
    where.push('p.operator_id = ?');
    params.push(Number(operatorId));
  }

  if (where.length > 0) {
    query += ' WHERE ' + where.join(' AND ');
  }

  query += ' ORDER BY p.awarded_at DESC';

  const prizes = db.prepare(query).all(...params);
  return res.json(prizes);
});

// POST /api/prizes - Manually grant an operational prize
router.post('/', authMiddleware, (req, res) => {
  const { operatorId, name, category, observation } = req.body;

  if (!operatorId || !name) {
    return res.status(400).json({ error: 'Operador e nome do prêmio são obrigatórios.' });
  }

  const operator = db.prepare('SELECT name FROM operators WHERE id = ?').get(operatorId);
  if (!operator) {
    return res.status(404).json({ error: 'Operador não encontrado.' });
  }

  const result = db.prepare(`
    INSERT INTO prizes (operator_id, name, category, status, observation, created_by)
    VALUES (?, ?, ?, 'Pendente', ?, ?)
  `).run(operatorId, name, category || 'outros', observation || null, req.user.username);

  logAudit(req.user.username, 'CREATE_PRIZE', 'prizes', result.lastInsertRowid, null, {
    operatorName: operator.name,
    prizeName: name
  });

  return res.status(201).json({ message: 'Prêmio registrado com sucesso (Status: Pendente).' });
});

// PUT /api/prizes/:id/status - Update prize status (Utilizado / Cancelado / Pendente)
router.put('/:id/status', authMiddleware, (req, res) => {
  const { status, observation } = req.body;

  if (!['Pendente', 'Utilizado', 'Cancelado'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Escolha: Pendente, Utilizado ou Cancelado.' });
  }

  const prize = db.prepare('SELECT * FROM prizes WHERE id = ?').get(req.params.id);
  if (!prize) {
    return res.status(404).json({ error: 'Prêmio não encontrado.' });
  }

  const usedAt = status === 'Utilizado' ? new Date().toISOString().replace('T', ' ').substring(0, 19) : (status === 'Pendente' ? null : prize.used_at);

  db.prepare(`
    UPDATE prizes
    SET status = ?, used_at = ?, observation = COALESCE(?, observation)
    WHERE id = ?
  `).run(status, usedAt, observation || null, req.params.id);

  logAudit(req.user.username, 'UPDATE_PRIZE_STATUS', 'prizes', req.params.id, prize.status, { newStatus: status, observation });

  return res.json({ message: `Status do prêmio atualizado para ${status}.` });
});

module.exports = router;
