const express = require('express');
const router = express.Router();
const { supabase, logAudit } = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/prizes - List operational prizes with status filter from Supabase
router.get('/', authMiddleware, async (req, res) => {
  const { status, operatorId } = req.query;

  try {
    let query = supabase.from('prizes').select('*, operators(name, registration)').order('awarded_at', { ascending: false });
    if (status) {
      query = query.eq('status', status);
    }
    if (operatorId) {
      query = query.eq('operator_id', Number(operatorId));
    }

    const { data: prizes, error } = await query;
    if (error) {
      // Fallback manual join if needed
      const { data: rawPrizes } = await supabase.from('prizes').select('*').order('awarded_at', { ascending: false });
      const { data: ops } = await supabase.from('operators').select('id, name, registration');
      const opMap = {};
      (ops || []).forEach(o => { opMap[o.id] = o; });

      let filtered = (rawPrizes || []).map(p => ({
        ...p,
        operator_name: opMap[p.operator_id] ? opMap[p.operator_id].name : 'Operador',
        registration: opMap[p.operator_id] ? opMap[p.operator_id].registration : '-'
      }));
      if (status) filtered = filtered.filter(p => p.status === status);
      if (operatorId) filtered = filtered.filter(p => p.operator_id === Number(operatorId));
      return res.json(filtered);
    }

    const formatted = (prizes || []).map(p => ({
      ...p,
      operator_name: p.operators ? p.operators.name : 'Operador',
      registration: p.operators ? p.operators.registration : '-'
    }));

    return res.json(formatted);
  } catch (err) {
    console.error('Error fetching prizes from Supabase:', err);
    return res.status(500).json({ error: 'Erro ao carregar prêmios.' });
  }
});

// POST /api/prizes - Manually grant an operational prize in Supabase
router.post('/', authMiddleware, async (req, res) => {
  const { operatorId, name, category, observation } = req.body;

  if (!operatorId || !name) {
    return res.status(400).json({ error: 'Operador e nome do prêmio são obrigatórios.' });
  }

  try {
    const { data: opList } = await supabase.from('operators').select('name').eq('id', operatorId).limit(1);
    const operator = opList && opList[0];
    if (!operator) {
      return res.status(404).json({ error: 'Operador não encontrado.' });
    }

    const { data, error } = await supabase.from('prizes').insert([{
      operator_id: operatorId,
      name,
      category: category || 'outros',
      status: 'Pendente',
      observation: observation || null,
      created_by: req.user.username
    }]).select();

    if (error) throw error;

    await logAudit(req.user.username, 'CREATE_PRIZE', 'prizes', data[0].id, null, {
      operatorName: operator.name,
      prizeName: name
    });

    return res.status(201).json({ message: 'Prêmio registrado com sucesso (Status: Pendente).' });
  } catch (err) {
    console.error('Error creating prize in Supabase:', err);
    return res.status(500).json({ error: 'Falha ao registrar prêmio.' });
  }
});

// PUT /api/prizes/:id/status - Update prize status in Supabase
router.put('/:id/status', authMiddleware, async (req, res) => {
  const { status, observation } = req.body;

  if (!['Pendente', 'Utilizado', 'Cancelado'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Escolha: Pendente, Utilizado ou Cancelado.' });
  }

  try {
    const { data: pList } = await supabase.from('prizes').select('*').eq('id', req.params.id).limit(1);
    const prize = pList && pList[0];
    if (!prize) {
      return res.status(404).json({ error: 'Prêmio não encontrado.' });
    }

    const updateFields = { status };
    if (status === 'Utilizado') {
      updateFields.used_at = new Date().toISOString();
    } else if (status === 'Pendente') {
      updateFields.used_at = null;
    }
    if (observation) {
      updateFields.observation = observation;
    }

    await supabase.from('prizes').update(updateFields).eq('id', req.params.id);

    await logAudit(req.user.username, 'UPDATE_PRIZE_STATUS', 'prizes', req.params.id, prize.status, { newStatus: status, observation });

    return res.json({ message: `Status do prêmio atualizado para ${status}.` });
  } catch (err) {
    console.error('Error updating prize status in Supabase:', err);
    return res.status(500).json({ error: 'Falha ao atualizar status do prêmio.' });
  }
});

module.exports = router;
