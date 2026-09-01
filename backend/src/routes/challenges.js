const express = require('express');
const router = express.Router();
const { supabase, logAudit, syncOperatorTickets } = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/challenges - List all challenges from Supabase
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data: challenges, error } = await supabase.from('challenges').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const { data: results } = await supabase.from('challenge_results').select('*, operators(name, registration)');

    const resMap = {};
    (results || []).forEach(r => {
      if (!resMap[r.challenge_id]) resMap[r.challenge_id] = [];
      resMap[r.challenge_id].push({
        ...r,
        operator_name: r.operators ? r.operators.name : 'Operador',
        registration: r.operators ? r.operators.registration : '-'
      });
    });

    const formatted = (challenges || []).map(ch => ({
      ...ch,
      participants: resMap[ch.id] || []
    }));

    return res.json(formatted);
  } catch (err) {
    console.error('Error fetching challenges from Supabase:', err);
    return res.status(500).json({ error: 'Erro ao carregar desafios.' });
  }
});

// POST /api/challenges - Create new challenge
router.post('/', authMiddleware, async (req, res) => {
  const { name, description, startDate, endDate, rewardPoints, operatorIds } = req.body;

  if (!name || !description || !rewardPoints) {
    return res.status(400).json({ error: 'Nome, descrição e pontuação da recompensa são obrigatórios.' });
  }

  try {
    const { data, error } = await supabase.from('challenges').insert([{
      name,
      description,
      start_date: startDate || '2026-09-01',
      end_date: endDate || '2026-12-11',
      reward_points: Number(rewardPoints),
      status: 'ativo'
    }]).select();

    if (error) throw error;
    const challengeId = data[0].id;

    if (Array.isArray(operatorIds) && operatorIds.length > 0) {
      const enrollList = operatorIds.map(opId => ({
        challenge_id: challengeId,
        operator_id: opId,
        completed: 0,
        points_awarded: 0
      }));
      await supabase.from('challenge_results').insert(enrollList);
    }

    await logAudit(req.user.username, 'CREATE_CHALLENGE', 'challenges', challengeId, null, { name, rewardPoints });

    return res.status(201).json({ message: 'Desafio especial criado com sucesso!', challengeId });
  } catch (err) {
    console.error('Error creating challenge in Supabase:', err);
    return res.status(500).json({ error: 'Falha ao criar desafio.' });
  }
});

// PUT /api/challenges/:id/conclude - Conclude challenge & award reward points in Supabase
router.put('/:id/conclude', authMiddleware, async (req, res) => {
  const { completedOperatorIds } = req.body;

  try {
    const { data: chList } = await supabase.from('challenges').select('*').eq('id', req.params.id).limit(1);
    const challenge = chList && chList[0];
    if (!challenge) {
      return res.status(404).json({ error: 'Desafio não encontrado.' });
    }

    if (challenge.status === 'concluido') {
      return res.status(400).json({ error: 'Este desafio já foi concluído anteriormente.' });
    }

    const dateToday = new Date().toISOString().split('T')[0];
    let awardedCount = 0;

    if (Array.isArray(completedOperatorIds) && completedOperatorIds.length > 0) {
      const txs = [];
      for (const opId of completedOperatorIds) {
        txs.push({
          operator_id: opId,
          campaign_id: 1,
          points: challenge.reward_points,
          event_date: dateToday,
          description: `Desafio Especial — ${challenge.name}`,
          observation: `Desafio concluído com sucesso: ${challenge.name}`,
          created_by: req.user.username
        });

        await supabase.from('challenge_results').upsert([{
          challenge_id: challenge.id,
          operator_id: opId,
          completed: 1,
          points_awarded: challenge.reward_points,
          completed_at: new Date().toISOString()
        }], { onConflict: 'challenge_id, operator_id' });

        await syncOperatorTickets(opId, 1);
        awardedCount++;
      }

      if (txs.length > 0) {
        await supabase.from('point_transactions').insert(txs);
      }
    }

    await supabase.from('challenges').update({ status: 'concluido' }).eq('id', req.params.id);

    await logAudit(req.user.username, 'CONCLUDE_CHALLENGE', 'challenges', req.params.id, null, {
      challengeName: challenge.name,
      awardedCount,
      rewardPoints: challenge.reward_points
    });

    return res.json({
      message: `Desafio "${challenge.name}" concluído! Pontuação de +${challenge.reward_points} pontos concedida a ${awardedCount} operadores.`
    });
  } catch (err) {
    console.error('Error concluding challenge in Supabase:', err);
    return res.status(500).json({ error: 'Falha ao concluir desafio.' });
  }
});

module.exports = router;
