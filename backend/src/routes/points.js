const express = require('express');
const router = express.Router();
const { supabase, logAudit, syncOperatorTickets, getCampaign } = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

// Helper to check campaign lock state
async function isCampaignLocked() {
  const campaign = await getCampaign();
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
router.post('/check-duplicate', authMiddleware, async (req, res) => {
  const { operatorIds, ruleId, eventDate } = req.body;

  if (!Array.isArray(operatorIds) || !ruleId || !eventDate) {
    return res.status(400).json({ error: 'Dados incompletos para verificação de duplicidade.' });
  }

  try {
    const { data: rules } = await supabase.from('point_rules').select('*').eq('id', ruleId).limit(1);
    const rule = rules && rules[0];
    if (!rule || rule.periodicity === 'monitoria' || rule.periodicity === 'avulso') {
      return res.json({ hasDuplicates: false, duplicates: [] });
    }

    const periodRef = getPeriodRef(eventDate, rule.periodicity);
    if (!periodRef) {
      return res.json({ hasDuplicates: false, duplicates: [] });
    }

    const { data: existingTxs } = await supabase
      .from('point_transactions')
      .select('id, operator_id, operators(name, registration)')
      .in('operator_id', operatorIds)
      .eq('rule_id', ruleId)
      .eq('period_ref', periodRef);

    const duplicates = (existingTxs || []).map(tx => ({
      operatorId: tx.operator_id,
      name: tx.operators ? tx.operators.name : 'Operador',
      registration: tx.operators ? tx.operators.registration : '-',
      ruleName: rule.name,
      periodRef
    }));

    return res.json({
      hasDuplicates: duplicates.length > 0,
      periodicity: rule.periodicity,
      periodRef,
      duplicates
    });
  } catch (err) {
    console.error('Error checking duplicate points:', err);
    return res.json({ hasDuplicates: false, duplicates: [] });
  }
});

// POST /api/points/single - Launch points for a single operator
router.post('/single', authMiddleware, async (req, res) => {
  if (await isCampaignLocked()) {
    return res.status(403).json({ error: 'A campanha está ENCERRADA. Novos lançamentos de pontos estão bloqueados.' });
  }

  const { operatorId, ruleId, points, eventDate, observation, indicatorValue, isAdjustment, forceDuplicate } = req.body;

  if (!operatorId || !eventDate) {
    return res.status(400).json({ error: 'Operador e data do evento são obrigatórios.' });
  }

  try {
    const { data: opList } = await supabase.from('operators').select('*').eq('id', operatorId).limit(1);
    const operator = opList && opList[0];
    if (!operator) {
      return res.status(404).json({ error: 'Operador não encontrado.' });
    }

    let finalPoints = Number(points);
    let ruleName = isAdjustment ? 'Ajuste Administrativo' : 'Lançamento Manual';
    let periodicity = 'avulso';
    let targetRule = null;

    if (ruleId) {
      const { data: ruleList } = await supabase.from('point_rules').select('*').eq('id', ruleId).limit(1);
      targetRule = ruleList && ruleList[0];
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

    // Duplicate check
    if (targetRule && !forceDuplicate && ['diario', 'semanal', 'mensal'].includes(periodicity)) {
      const { data: dupList } = await supabase
        .from('point_transactions')
        .select('id')
        .eq('operator_id', operatorId)
        .eq('rule_id', ruleId)
        .eq('period_ref', periodRef)
        .limit(1);

      if (dupList && dupList.length > 0) {
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
      const { data: dblList } = await supabase
        .from('operator_double_points')
        .select('active')
        .eq('operator_id', operatorId)
        .eq('active', 1)
        .limit(1);

      if (dblList && dblList.length > 0) {
        finalPoints = finalPoints * 2;
        isDoublePoints = 1;
        description = `${ruleName} — Pontos em dobro`;
        await supabase.from('operator_double_points').delete().eq('operator_id', operatorId);
      }
    }

    // Insert transaction
    const { data: insData, error: insErr } = await supabase.from('point_transactions').insert([{
      operator_id: operatorId,
      campaign_id: 1,
      rule_id: ruleId || null,
      points: finalPoints,
      event_date: eventDate,
      description,
      observation: observation || null,
      indicator_value: indicatorValue || null,
      is_adjustment: isAdjustment ? 1 : 0,
      is_double_points: isDoublePoints,
      period_ref: periodRef,
      created_by: req.user.username
    }]).select();

    if (insErr) throw insErr;
    const newTx = insData[0];

    // Sync tickets
    const syncResult = await syncOperatorTickets(operatorId, 1);

    await logAudit(req.user.username, 'ADD_POINTS', 'point_transactions', newTx.id, null, {
      operatorName: operator.name,
      points: finalPoints,
      eventDate,
      ruleName,
      isDoublePoints
    });

    return res.status(201).json({
      message: 'Pontos lançados com sucesso.',
      transactionId: newTx.id,
      pointsAwarded: finalPoints,
      isDoublePoints: !!isDoublePoints,
      totalPoints: syncResult.totalPoints,
      totalTickets: syncResult.totalTickets,
      newlyEarnedTickets: syncResult.newlyEarned,
      newTicketCodes: syncResult.newTicketCodes,
      operatorName: operator.name
    });
  } catch (err) {
    console.error('Error adding single point transaction:', err);
    return res.status(500).json({ error: 'Erro ao registrar pontos.' });
  }
});

// POST /api/points/mass - Mass launch points for multiple operators
router.post('/mass', authMiddleware, async (req, res) => {
  if (await isCampaignLocked()) {
    return res.status(403).json({ error: 'A campanha está ENCERRADA. Lançamentos em massa estão bloqueados.' });
  }

  const { operatorIds, ruleId, points, eventDate, observation, indicatorValue, forceDuplicate } = req.body;

  if (!Array.isArray(operatorIds) || operatorIds.length === 0) {
    return res.status(400).json({ error: 'Selecione pelo menos um operador.' });
  }

  if (!eventDate) {
    return res.status(400).json({ error: 'A data do evento é obrigatória.' });
  }

  try {
    let targetRule = null;
    let ruleName = 'Lançamento em Massa';
    let defaultPts = Number(points);
    let periodicity = 'avulso';

    if (ruleId) {
      const { data: ruleList } = await supabase.from('point_rules').select('*').eq('id', ruleId).limit(1);
      targetRule = ruleList && ruleList[0];
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

    // Get double points entries
    const { data: doubleList } = await supabase.from('operator_double_points').select('operator_id').eq('active', 1);
    const doubleSet = new Set((doubleList || []).map(d => d.operator_id));

    // Get existing duplicate transactions
    const { data: dupList } = await supabase
      .from('point_transactions')
      .select('operator_id')
      .in('operator_id', operatorIds)
      .eq('rule_id', ruleId)
      .eq('period_ref', periodRef);

    const dupSet = new Set((dupList || []).map(d => d.operator_id));

    // Get operators info
    const { data: ops } = await supabase.from('operators').select('id, name').in('id', operatorIds);
    const opMap = {};
    (ops || []).forEach(o => { opMap[o.id] = o; });

    const transactionsToInsert = [];
    const opsToConsumeDouble = [];
    let totalDistributed = 0;
    let operatorsCount = 0;

    for (const opId of operatorIds) {
      const op = opMap[opId];
      if (!op) continue;

      if (targetRule && !forceDuplicate && ['diario', 'semanal', 'mensal'].includes(periodicity) && dupSet.has(opId)) {
        continue; // skip duplicate
      }

      let opPts = defaultPts;
      let isDouble = 0;
      let desc = ruleName;

      if (opPts > 0 && doubleSet.has(opId)) {
        opPts = opPts * 2;
        isDouble = 1;
        desc = `${ruleName} — Pontos em dobro`;
        opsToConsumeDouble.push(opId);
      }

      transactionsToInsert.push({
        operator_id: opId,
        campaign_id: 1,
        rule_id: ruleId || null,
        points: opPts,
        event_date: eventDate,
        description: desc,
        observation: observation || null,
        indicator_value: indicatorValue || null,
        is_adjustment: 0,
        is_double_points: isDouble,
        period_ref: periodRef,
        created_by: req.user.username
      });

      totalDistributed += opPts;
      operatorsCount++;
    }

    if (transactionsToInsert.length > 0) {
      await supabase.from('point_transactions').insert(transactionsToInsert);

      // Consume double points
      if (opsToConsumeDouble.length > 0) {
        await supabase.from('operator_double_points').delete().in('operator_id', opsToConsumeDouble);
      }

      // Sync tickets for all affected operators
      for (const opId of operatorIds) {
        await syncOperatorTickets(opId, 1);
      }
    }

    await logAudit(req.user.username, 'MASS_ADD_POINTS', 'point_transactions', null, null, {
      ruleName,
      operatorsCount,
      totalDistributed,
      eventDate
    });

    return res.json({
      message: `${operatorsCount} lançamentos realizados com sucesso! Total distribuído: ${totalDistributed > 0 ? '+' : ''}${totalDistributed} pontos.`,
      operatorsCount,
      totalDistributed
    });
  } catch (err) {
    console.error('Error during mass point launch:', err);
    return res.status(500).json({ error: 'Falha ao processar lançamento em massa.' });
  }
});

// DELETE /api/points/:id - Delete transaction
router.delete('/:id', authMiddleware, async (req, res) => {
  if (await isCampaignLocked()) {
    return res.status(403).json({ error: 'A campanha está ENCERRADA. Exclusão de lançamentos está bloqueada.' });
  }

  try {
    const { data: txList } = await supabase.from('point_transactions').select('*').eq('id', req.params.id).limit(1);
    const tx = txList && txList[0];
    if (!tx) {
      return res.status(404).json({ error: 'Lançamento não encontrado.' });
    }

    await supabase.from('point_transactions').delete().eq('id', req.params.id);
    await syncOperatorTickets(tx.operator_id, 1);

    await logAudit(req.user.username, 'DELETE_TRANSACTION', 'point_transactions', req.params.id, tx, null);

    return res.json({ message: 'Lançamento excluído com sucesso.' });
  } catch (err) {
    console.error('Error deleting point transaction:', err);
    return res.status(500).json({ error: 'Falha ao excluir lançamento.' });
  }
});

module.exports = router;
