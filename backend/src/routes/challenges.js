const express = require('express');
const router = express.Router();
const { db, logAudit, syncOperatorTickets } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/challenges - List all challenges
router.get('/', authMiddleware, (req, res) => {
  const challenges = db.prepare('SELECT * FROM challenges ORDER BY created_at DESC').all();

  const result = challenges.map(ch => {
    const participants = db.prepare(`
      SELECT cr.*, o.name as operator_name, o.registration
      FROM challenge_results cr
      JOIN operators o ON cr.operator_id = o.id
      WHERE cr.challenge_id = ?
    `).all(ch.id);

    return {
      ...ch,
      participants
    };
  });

  return res.json(result);
});

// POST /api/challenges - Create new challenge
router.post('/', authMiddleware, (req, res) => {
  const { name, description, startDate, endDate, rewardPoints, operatorIds } = req.body;

  if (!name || !description || !rewardPoints) {
    return res.status(400).json({ error: 'Nome, descrição e pontuação da recompensa são obrigatórios.' });
  }

  const result = db.prepare(`
    INSERT INTO challenges (name, description, start_date, end_date, reward_points, status)
    VALUES (?, ?, ?, ?, ?, 'ativo')
  `).run(name, description, startDate || '2026-09-01', endDate || '2026-12-11', Number(rewardPoints));

  const challengeId = result.lastInsertRowid;

  // Enroll operators if provided
  if (Array.isArray(operatorIds) && operatorIds.length > 0) {
    const enrollStmt = db.prepare(`
      INSERT INTO challenge_results (challenge_id, operator_id, completed, points_awarded)
      VALUES (?, ?, 0, 0)
    `);
    for (const opId of operatorIds) {
      enrollStmt.run(challengeId, opId);
    }
  }

  logAudit(req.user.username, 'CREATE_CHALLENGE', 'challenges', challengeId, null, { name, rewardPoints });

  return res.status(201).json({ message: 'Desafio especial criado com sucesso!', challengeId });
});

// PUT /api/challenges/:id/conclude - Conclude challenge & award reward points to completed participants
router.put('/:id/conclude', authMiddleware, (req, res) => {
  const { completedOperatorIds } = req.body;

  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!challenge) {
    return res.status(404).json({ error: 'Desafio não encontrado.' });
  }

  if (challenge.status === 'concluido') {
    return res.status(400).json({ error: 'Este desafio já foi concluído anteriormente.' });
  }

  const dateToday = new Date().toISOString().split('T')[0];
  let awardedCount = 0;

  if (Array.isArray(completedOperatorIds) && completedOperatorIds.length > 0) {
    const txStmt = db.prepare(`
      INSERT INTO point_transactions (operator_id, campaign_id, points, event_date, description, observation, created_by)
      VALUES (?, 1, ?, ?, ?, ?, ?)
    `);

    const updateResStmt = db.prepare(`
      INSERT INTO challenge_results (challenge_id, operator_id, completed, points_awarded, completed_at)
      VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(challenge_id, operator_id) DO UPDATE SET
        completed = 1,
        points_awarded = excluded.points_awarded,
        completed_at = CURRENT_TIMESTAMP
    `);

    for (const opId of completedOperatorIds) {
      const op = db.prepare('SELECT name FROM operators WHERE id = ?').get(opId);
      if (op) {
        txStmt.run(
          opId,
          challenge.reward_points,
          dateToday,
          `Desafio Especial — ${challenge.name}`,
          `Desafio concluído com sucesso: ${challenge.name}`,
          req.user.username
        );
        updateResStmt.run(challenge.id, opId, challenge.reward_points);
        syncOperatorTickets(opId, 1);
        awardedCount++;
      }
    }
  }

  // Update challenge status
  db.prepare("UPDATE challenges SET status = 'concluido' WHERE id = ?").run(req.params.id);

  logAudit(req.user.username, 'CONCLUDE_CHALLENGE', 'challenges', req.params.id, null, {
    challengeName: challenge.name,
    awardedCount,
    rewardPoints: challenge.reward_points
  });

  return res.json({
    message: `Desafio "${challenge.name}" concluído! Pontuação de +${challenge.reward_points} pontos concedida a ${awardedCount} operadores.`
  });
});

module.exports = router;
