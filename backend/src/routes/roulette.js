const express = require('express');
const router = express.Router();
const { db, logAudit, syncOperatorTickets } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// List of official prizes on Roleta 156
const ROULETTE_PRIZES = [
  { id: 'pts10', name: '+10 pontos', icon: '🎁', prize_type: 'points', points: 10 },
  { id: 'pts20', name: '+20 pontos', icon: '🎁', prize_type: 'points', points: 20 },
  { id: 'pausa', name: 'Pausa extra', icon: '☕', prize_type: 'extra_break', points: 0 },
  { id: 'saida', name: 'Saída 30 minutos mais cedo', icon: '⏰', prize_type: 'early_leave', points: 0 },
  { id: 'tkt1', name: '+1 bilhete', icon: '🎟️', prize_type: 'ticket', points: 50 },
  { id: 'tkt2', name: '+2 bilhetes', icon: '🎟️', prize_type: 'ticket', points: 100 },
  { id: 'dobro', name: 'Pontos em dobro', icon: '🔥', prize_type: 'double_points', points: 0 },
  { id: 'surpresa', name: 'Prêmio surpresa', icon: '😄', prize_type: 'surprise', points: 0 },
  { id: 'nada', name: 'Nada', icon: '❌', prize_type: 'nothing', points: 0 },
  { id: 'desafio', name: 'Desafio especial', icon: '🎯', prize_type: 'special_challenge', points: 0 }
];

// GET /api/roulette/prizes - List wheel options
router.get('/prizes', authMiddleware, (req, res) => {
  return res.json(ROULETTE_PRIZES);
});

// GET /api/roulette/history - List spin history
router.get('/history', authMiddleware, (req, res) => {
  const history = db.prepare(`
    SELECT rs.*, o.name as operator_name, o.registration
    FROM roulette_spins rs
    JOIN operators o ON rs.operator_id = o.id
    ORDER BY rs.created_at DESC
  `).all();

  return res.json(history);
});

// POST /api/roulette/spin - Execute spin for operator
router.post('/spin', authMiddleware, (req, res) => {
  const { operatorId, selectedPrizeId } = req.body;

  if (!operatorId) {
    return res.status(400).json({ error: 'Selecione um operador para girar a roleta.' });
  }

  const operator = db.prepare('SELECT * FROM operators WHERE id = ?').get(operatorId);
  if (!operator) {
    return res.status(404).json({ error: 'Operador não encontrado.' });
  }

  // Pick prize randomly if not manually determined
  let prizeObj = null;
  if (selectedPrizeId) {
    prizeObj = ROULETTE_PRIZES.find(p => p.id === selectedPrizeId);
  }
  if (!prizeObj) {
    const randomIndex = Math.floor(Math.random() * ROULETTE_PRIZES.length);
    prizeObj = ROULETTE_PRIZES[randomIndex];
  }

  // Insert spin record
  const spinResult = db.prepare(`
    INSERT INTO roulette_spins (operator_id, prize, prize_type, points, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(operatorId, prizeObj.name, prizeObj.prize_type, prizeObj.points, req.user.username);

  const dateToday = new Date().toISOString().split('T')[0];
  let pointsAwarded = prizeObj.points;
  let newlyEarnedTickets = 0;
  let newTicketCodes = [];

  // Handle prize effects
  if (prizeObj.prize_type === 'points' || prizeObj.prize_type === 'ticket') {
    db.prepare(`
      INSERT INTO point_transactions (operator_id, campaign_id, points, event_date, description, observation, created_by)
      VALUES (?, 1, ?, ?, ?, ?, ?)
    `).run(
      operatorId,
      pointsAwarded,
      dateToday,
      `Roleta 156 — Prêmio: ${prizeObj.name}`,
      'Ganhador da Roleta 156',
      req.user.username
    );

    const sync = syncOperatorTickets(operatorId, 1);
    newlyEarnedTickets = sync.newlyEarned;
    newTicketCodes = sync.newTicketCodes;
  } else if (prizeObj.prize_type === 'double_points') {
    // Activate double points status
    db.prepare(`
      INSERT INTO operator_double_points (operator_id, active)
      VALUES (?, 1)
      ON CONFLICT(operator_id) DO UPDATE SET active = 1, granted_at = CURRENT_TIMESTAMP
    `).run(operatorId);
  } else if (['extra_break', 'early_leave', 'surprise'].includes(prizeObj.prize_type)) {
    // Create operational prize record with status 'Pendente'
    let category = 'outros';
    if (prizeObj.prize_type === 'extra_break') category = 'pausa_extra';
    if (prizeObj.prize_type === 'early_leave') category = 'saida_mais_cedo';
    if (prizeObj.prize_type === 'surprise') category = 'surpresa';

    db.prepare(`
      INSERT INTO prizes (operator_id, name, category, status, observation, created_by)
      VALUES (?, ?, ?, 'Pendente', 'Conquistado na Roleta 156', ?)
    `).run(operatorId, prizeObj.name, category, req.user.username);
  }

  logAudit(req.user.username, 'SPIN_ROULETTE', 'roulette_spins', spinResult.lastInsertRowid, null, {
    operatorName: operator.name,
    prize: prizeObj.name,
    prizeType: prizeObj.prize_type
  });

  return res.json({
    message: `🎉 PARABÉNS, ${operator.name}! Você ganhou: ${prizeObj.name}`,
    prize: prizeObj,
    operatorName: operator.name,
    pointsAwarded,
    newlyEarnedTickets,
    newTicketCodes
  });
});

module.exports = router;
