const express = require('express');
const router = express.Router();
const { db, logAudit, syncOperatorTickets } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Helper to check campaign lock state
function checkCampaignLock() {
  const campaign = db.prepare('SELECT status FROM campaigns WHERE id = 1').get();
  return campaign && campaign.status === 'locked';
}

// Helper to compute period_ref key (e.g., '2026-09-05', '2026-W37', '2026-09')
function getPeriodRef(dateStr, periodicity) {
  if (!dateStr) return null;
  if (periodicity === 'diario') {
    return dateStr; // YYYY-MM-DD
  }
  if (periodicity === 'semanal') {
    const d = new Date(`${dateStr}T12:00:00-03:00`);
    const janFirst = new Date(d.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((d - janFirst) / 86400000);
    const weekNum = Math.ceil((dayOfYear + janFirst.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }
  if (periodicity === 'mensal') {
    return dateStr.substring(0, 7); // YYYY-MM
  }
  return null;
}

// POST /api/points/check-duplicate - Check if launch would duplicate an existing rule entry
router.post('/check-duplicate', authMiddleware, (req, res) => {
  const { operatorIds, ruleId, eventDate } = req.body;

  if (!Array.isArray(operatorIds) || !ruleId || !eventDate) {
    return res.status(400).json({ error: 'Dados incompletos para verificação de duplicidade.' });
  }

  const rule = db.prepare('SELECT * FROM point_rules WHERE id = ?').get(ruleId);
  if (!rule || rule.periodicity === 'monitoria' || rule.periodicity === 'avulso') {
    return res.json({ hasDuplicates: false, duplicates: [] });
  }

  const periodRef = getPeriodRef(eventDate, rule.periodicity);
  if (!periodRef) {
    return res.json({ hasDuplicates: false, duplicates: [] });
  }

  const duplicates = [];
  const checkStmt = db.prepare(`
    SELECT pt.id, o.name, o.registration
    FROM point_transactions pt
    JOIN operators o ON pt.operator_id = o.id
    WHERE pt.operator_id = ? AND pt.rule_id = ? AND pt.period_ref = ?
  `);

  for (const opId of operatorIds) {
    const existing = checkStmt.get(opId, ruleId, periodRef);
    if (existing) {
      duplicates.push({
        operatorId: opId,
        name: existing.name,
        registration: existing.registration,
        ruleName: rule.name,
        periodRef
      });
    }
  }

  return res.json({
    hasDuplicates: duplicates.length > 0,
    periodicity: rule.periodicity,
    periodRef,
    duplicates
  });
});

// POST /api/points/single - Launch points for a single operator
router.post('/single', authMiddleware, (req, res) => {
  if (checkCampaignLock()) {
    return res.status(403).json({ error: 'A campanha está ENCERRADA. Novos lançamentos de pontos estão bloqueados.' });
  }

  const { operatorId, ruleId, points, eventDate, observation, indicatorValue, isAdjustment, forceDuplicate } = req.body;

  if (!operatorId || !eventDate) {
    return res.status(400).json({ error: 'Operador e data do evento são obrigatórios.' });
  }

  const operator = db.prepare('SELECT * FROM operators WHERE id = ?').get(operatorId);
  if (!operator) {
    return res.status(404).json({ error: 'Operador não encontrado.' });
  }

  let finalPoints = Number(points);
  let ruleName = isAdjustment ? 'Ajuste Administrativo' : 'Lançamento Manual';
  let periodicity = 'avulso';
  let targetRule = null;

  if (ruleId) {
    targetRule = db.prepare('SELECT * FROM point_rules WHERE id = ?').get(ruleId);
    if (targetRule) {
      ruleName = targetRule.name;
      periodicity = targetRule.periodicity;
      if (points === undefined || points === null || points === '') {
        finalPoints = targetRule.points;
      }
    }
  }

  if (isNaN(finalPoints)) {
    return res.status(400).json({ error: 'Quantidade de pontos inválida.' });
  }

  const periodRef = getPeriodRef(eventDate, periodicity);

  // Check duplicate unless forceDuplicate is true
  if (targetRule && !forceDuplicate && ['diario', 'semanal', 'mensal'].includes(periodicity)) {
    const existing = db.prepare(`
      SELECT id FROM point_transactions 
      WHERE operator_id = ? AND rule_id = ? AND period_ref = ?
    `).get(operatorId, ruleId, periodRef);

    if (existing) {
      return res.status(409).json({
        error: `O operador ${operator.name} já possui um lançamento da regra "${ruleName}" para este período (${periodRef}).`,
        isDuplicate: true
      });
    }
  }

  // Check double points status if points > 0
  let isDoublePoints = 0;
  let description = ruleName;
  if (finalPoints > 0) {
    const doubleEntry = db.prepare('SELECT active FROM operator_double_points WHERE operator_id = ? AND active = 1').get(operatorId);
    if (doubleEntry) {
      finalPoints = finalPoints * 2;
      isDoublePoints = 1;
      description = `${ruleName} — Pontos em dobro`;
      // Consume double points
      db.prepare('DELETE FROM operator_double_points WHERE operator_id = ?').run(operatorId);
    }
  }

  // Insert transaction
  const result = db.prepare(`
    INSERT INTO point_transactions (
      operator_id, campaign_id, rule_id, points, event_date, description, observation, indicator_value, is_adjustment, is_double_points, period_ref, created_by
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    operatorId,
    ruleId || null,
    finalPoints,
    eventDate,
    description,
    observation || null,
    indicatorValue || null,
    isAdjustment ? 1 : 0,
    isDoublePoints,
    periodRef,
    req.user.username
  );

  // Sync tickets & check for ticket unlock alert
  const syncResult = syncOperatorTickets(operatorId, 1);

  logAudit(req.user.username, 'ADD_POINTS', 'point_transactions', result.lastInsertRowid, null, {
    operatorName: operator.name,
    points: finalPoints,
    eventDate,
    ruleName,
    isDoublePoints
  });

  return res.status(201).json({
    message: 'Pontos lançados com sucesso.',
    transactionId: result.lastInsertRowid,
    pointsAwarded: finalPoints,
    isDoublePoints: !!isDoublePoints,
    totalPoints: syncResult.totalPoints,
    totalTickets: syncResult.totalTickets,
    newlyEarnedTickets: syncResult.newlyEarned,
    newTicketCodes: syncResult.newTicketCodes,
    operatorName: operator.name
  });
});

// POST /api/points/mass - Mass launch points for multiple operators
router.post('/mass', authMiddleware, (req, res) => {
  if (checkCampaignLock()) {
    return res.status(403).json({ error: 'A campanha está ENCERRADA. Lançamentos em massa estão bloqueados.' });
  }

  const { operatorIds, ruleId, points, eventDate, observation, indicatorValue, forceDuplicate } = req.body;

  if (!Array.isArray(operatorIds) || operatorIds.length === 0) {
    return res.status(400).json({ error: 'Selecione pelo menos um operador.' });
  }

  if (!eventDate) {
    return res.status(400).json({ error: 'A data do evento é obrigatória.' });
  }

  let targetRule = null;
  let ruleName = 'Lançamento em Massa';
  let defaultPts = Number(points);
  let periodicity = 'avulso';

  if (ruleId) {
    targetRule = db.prepare('SELECT * FROM point_rules WHERE id = ?').get(ruleId);
    if (targetRule) {
      ruleName = targetRule.name;
      periodicity = targetRule.periodicity;
      if (points === undefined || points === null || points === '') {
        defaultPts = targetRule.points;
      }
    }
  }

  if (isNaN(defaultPts)) {
    return res.status(400).json({ error: 'Quantidade de pontos inválida.' });
  }

  const periodRef = getPeriodRef(eventDate, periodicity);

  // Perform mass transaction
  let totalDistributed = 0;
  let operatorsCount = 0;
  const ticketAlerts = [];

  const insertTx = db.prepare(`
    INSERT INTO point_transactions (
      operator_id, campaign_id, rule_id, points, event_date, description, observation, indicator_value, is_adjustment, is_double_points, period_ref, created_by
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `);

  const doubleStmt = db.prepare('SELECT active FROM operator_double_points WHERE operator_id = ? AND active = 1');
  const consumeDoubleStmt = db.prepare('DELETE FROM operator_double_points WHERE operator_id = ?');

  const checkDupStmt = db.prepare(`
    SELECT id FROM point_transactions WHERE operator_id = ? AND rule_id = ? AND period_ref = ?
  `);

  const runBatch = db.transaction((ids) => {
    for (const opId of ids) {
      const op = db.prepare('SELECT name FROM operators WHERE id = ?').get(opId);
      if (!op) continue;

      // Duplicate check per operator
      if (targetRule && !forceDuplicate && ['diario', 'semanal', 'mensal'].includes(periodicity)) {
        const dup = checkDupStmt.get(opId, ruleId, periodRef);
        if (dup) continue; // skip duplicates unless forced
      }

      let opPts = defaultPts;
      let isDouble = 0;
      let desc = ruleName;

      if (opPts > 0 && doubleStmt.get(opId)) {
        opPts = opPts * 2;
        isDouble = 1;
        desc = `${ruleName} — Pontos em dobro`;
        consumeDoubleStmt.run(opId);
      }

      insertTx.run(
        opId,
        ruleId || null,
        opPts,
        eventDate,
        desc,
        observation || null,
        indicatorValue || null,
        isDouble,
        periodRef,
        req.user.username
      );

      const sync = syncOperatorTickets(opId, 1);
      if (sync.newlyEarned > 0) {
        ticketAlerts.push({
          operatorName: op.name,
          totalPoints: sync.totalPoints,
          totalTickets: sync.totalTickets,
          newlyEarned: sync.newlyEarned,
          newTicketCodes: sync.newTicketCodes
        });
      }

      totalDistributed += opPts;
      operatorsCount++;
    }
  });

  runBatch(operatorIds);

  logAudit(req.user.username, 'MASS_ADD_POINTS', 'point_transactions', null, null, {
    ruleName,
    operatorsCount,
    totalDistributed,
    eventDate
  });

  return res.json({
    message: `${operatorsCount} lançamentos realizados com sucesso! Total distribuído: ${totalDistributed > 0 ? '+' : ''}${totalDistributed} pontos.`,
    operatorsCount,
    totalDistributed,
    ticketAlerts
  });
});

// DELETE /api/points/:id - Delete transaction (Admin audit safety check)
router.delete('/:id', authMiddleware, (req, res) => {
  if (checkCampaignLock()) {
    return res.status(403).json({ error: 'A campanha está ENCERRADA. Exclusão de lançamentos está bloqueada.' });
  }

  const tx = db.prepare('SELECT * FROM point_transactions WHERE id = ?').get(req.params.id);
  if (!tx) {
    return res.status(404).json({ error: 'Lançamento não encontrado.' });
  }

  db.prepare('DELETE FROM point_transactions WHERE id = ?').run(req.params.id);
  syncOperatorTickets(tx.operator_id, 1);

  logAudit(req.user.username, 'DELETE_TRANSACTION', 'point_transactions', req.params.id, tx, null);

  return res.json({ message: 'Lançamento excluído com sucesso.' });
});

module.exports = router;
