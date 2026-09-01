const { supabase } = require('./supabaseDb');

// ==========================================
// AUDIT LOG
// ==========================================
async function logAudit(userId, action, entity, entityId = null, oldValue = null, newValue = null) {
  try {
    await supabase.from('audit_logs').insert([{
      user_id: userId || 'Admin',
      action,
      entity,
      entity_id: entityId ? String(entityId) : null,
      old_value: oldValue ? (typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue)) : null,
      new_value: newValue ? (typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue)) : null
    }]);
  } catch (err) {
    console.error('Failed to log audit in Supabase:', err);
  }
}

// ==========================================
// TICKET SYNC HELPER
// ==========================================
async function syncOperatorTickets(operatorId, campaignId = 1) {
  try {
    // 1. Get all points for this operator
    const { data: ptsData } = await supabase
      .from('point_transactions')
      .select('points')
      .eq('operator_id', operatorId)
      .eq('campaign_id', campaignId);

    const totalPoints = (ptsData || []).reduce((acc, r) => acc + (Number(r.points) || 0), 0);
    const totalTicketsEarned = totalPoints > 0 ? Math.floor(totalPoints / 50) : 0;

    // 2. Count existing tickets
    const { data: existingTickets } = await supabase
      .from('tickets')
      .select('id, ticket_number, ticket_code')
      .eq('operator_id', operatorId)
      .eq('campaign_id', campaignId);

    const existingCount = (existingTickets || []).length;

    if (totalTicketsEarned > existingCount) {
      const needed = totalTicketsEarned - existingCount;

      // Global max ticket number
      const { data: allTickets } = await supabase
        .from('tickets')
        .select('ticket_number')
        .eq('campaign_id', campaignId)
        .order('ticket_number', { ascending: false })
        .limit(1);

      let nextNum = (allTickets && allTickets[0] && allTickets[0].ticket_number) ? allTickets[0].ticket_number : 0;

      const newTicketsToInsert = [];
      const newTicketCodes = [];

      for (let i = 0; i < needed; i++) {
        nextNum += 1;
        const code = `TKT-${String(nextNum).padStart(4, '0')}`;
        newTicketsToInsert.push({
          operator_id: operatorId,
          campaign_id: campaignId,
          ticket_number: nextNum,
          ticket_code: code,
          status: 'valid'
        });
        newTicketCodes.push({ number: nextNum, code });
      }

      await supabase.from('tickets').insert(newTicketsToInsert);

      return { totalPoints, totalTickets: totalTicketsEarned, newlyEarned: needed, newTicketCodes };
    }

    return { totalPoints, totalTickets: totalTicketsEarned, newlyEarned: 0, newTicketCodes: [] };
  } catch (err) {
    console.error('Error syncing tickets in Supabase:', err);
    return { totalPoints: 0, totalTickets: 0, newlyEarned: 0, newTicketCodes: [] };
  }
}

// ==========================================
// OPERATORS
// ==========================================
async function getOperators(status = null, search = null) {
  // Fetch operators
  let query = supabase.from('operators').select('*');
  if (status) {
    query = query.eq('status', status);
  }
  const { data: ops, error: opErr } = await query;
  if (opErr) throw opErr;

  // Fetch all transactions to compute points
  const { data: txs } = await supabase.from('point_transactions').select('operator_id, points');
  const ptsMap = {};
  (txs || []).forEach(t => {
    ptsMap[t.operator_id] = (ptsMap[t.operator_id] || 0) + (Number(t.points) || 0);
  });

  // Fetch all tickets to compute ticket counts
  const { data: tkts } = await supabase.from('tickets').select('operator_id');
  const tktMap = {};
  (tkts || []).forEach(tk => {
    tktMap[tk.operator_id] = (tktMap[tk.operator_id] || 0) + 1;
  });

  let result = (ops || []).map(op => {
    const pts = ptsMap[op.id] || 0;
    const tickets = pts > 0 ? Math.floor(pts / 50) : 0;
    const ptsToNext = pts >= 0 ? 50 - (pts % 50) : 50 + Math.abs(pts);

    return {
      ...op,
      totalPoints: pts,
      totalTickets: tickets,
      pointsToNextTicket: ptsToNext === 0 ? 50 : ptsToNext,
      currentTicketProgress: pts >= 0 ? (pts % 50) : 0
    };
  });

  if (search) {
    const s = search.toLowerCase();
    result = result.filter(o =>
      (o.name && o.name.toLowerCase().includes(s)) ||
      (o.registration && o.registration.toLowerCase().includes(s))
    );
  }

  // Sort by points desc, name asc
  result.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return (a.name || '').localeCompare(b.name || '');
  });

  return result;
}

async function getOperatorById(id) {
  const { data: opList, error } = await supabase.from('operators').select('*').eq('id', id).limit(1);
  if (error || !opList || opList.length === 0) return null;
  const operator = opList[0];

  // Sync tickets & compute points
  const ticketSync = await syncOperatorTickets(operator.id, 1);
  const totalPoints = ticketSync.totalPoints;
  const totalTickets = ticketSync.totalTickets;

  // Transactions
  const { data: txs } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('operator_id', operator.id)
    .order('created_at', { ascending: false });

  // Compute gained and lost points
  let gained = 0;
  let lost = 0;
  (txs || []).forEach(t => {
    if (t.points > 0) gained += t.points;
    if (t.points < 0) lost += Math.abs(t.points);
  });

  // Roulette spins
  const { data: spins } = await supabase.from('roulette_spins').select('*').eq('operator_id', operator.id);

  // Prizes
  const { data: prizes } = await supabase.from('prizes').select('*').eq('operator_id', operator.id).order('awarded_at', { ascending: false });

  // Highlights
  const { data: highlights } = await supabase.from('weekly_highlights').select('*').eq('operator_id', operator.id).order('created_at', { ascending: false });

  // Double points
  const { data: dbl } = await supabase.from('operator_double_points').select('active').eq('operator_id', operator.id).eq('active', 1);

  // Rank position overall
  const allOps = await getOperators('active');
  const rankPosition = allOps.findIndex(r => r.id === operator.id) + 1;

  // Tickets
  const { data: ticketsList } = await supabase.from('tickets').select('*').eq('operator_id', operator.id).order('ticket_number', { ascending: true });

  // Running balance for statement
  let runningBalance = 0;
  const historyWithBalances = [...(txs || [])].reverse().map(tx => {
    const prev = runningBalance;
    runningBalance += tx.points;
    return {
      ...tx,
      previousBalance: prev,
      newBalance: runningBalance
    };
  }).reverse();

  const ptsToNext = totalPoints >= 0 ? (50 - (totalPoints % 50)) : (50 + Math.abs(totalPoints));

  return {
    operator,
    stats: {
      totalPoints,
      totalTickets,
      pointsToNextTicket: ptsToNext === 0 ? 50 : ptsToNext,
      currentTicketProgress: totalPoints >= 0 ? (totalPoints % 50) : 0,
      rankPosition: rankPosition || '-',
      pointsGained: gained,
      pointsLost: lost,
      rouletteSpins: (spins || []).length,
      prizesWon: (prizes || []).length,
      highlightsWon: (highlights || []).length,
      hasDoublePoints: !!(dbl && dbl.length > 0)
    },
    transactions: historyWithBalances,
    tickets: ticketsList || [],
    prizes: prizes || [],
    highlights: highlights || []
  };
}

async function createOperator({ name, registration, notes }) {
  const regTrimmed = registration.trim();
  const { data: existing } = await supabase.from('operators').select('id').eq('registration', regTrimmed);
  if (existing && existing.length > 0) {
    throw new Error(`Já existe um operador cadastrado com a matrícula ${regTrimmed}.`);
  }

  const { data, error } = await supabase.from('operators').insert([{
    name: name.trim(),
    registration: regTrimmed,
    notes: notes || null,
    status: 'active'
  }]).select();

  if (error) throw error;
  return data[0];
}

async function updateOperator(id, { name, registration, status, notes }) {
  if (registration) {
    const regTrimmed = registration.trim();
    const { data: existing } = await supabase.from('operators').select('id').eq('registration', regTrimmed).neq('id', id);
    if (existing && existing.length > 0) {
      throw new Error(`Já existe outro operador cadastrado com a matrícula ${regTrimmed}.`);
    }
  }

  const updateFields = { updated_at: new Date().toISOString() };
  if (name !== undefined) updateFields.name = name.trim();
  if (registration !== undefined) updateFields.registration = registration.trim();
  if (status !== undefined) updateFields.status = status;
  if (notes !== undefined) updateFields.notes = notes;

  const { data, error } = await supabase.from('operators').update(updateFields).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

async function importOperatorsBulk(operatorsList) {
  if (!Array.isArray(operatorsList) || operatorsList.length === 0) {
    return { importedCount: 0 };
  }

  const payload = operatorsList.map(op => ({
    name: String(op.name).trim(),
    registration: String(op.registration).trim(),
    notes: op.notes ? String(op.notes).trim() : null,
    status: 'active',
    updated_at: new Date().toISOString()
  }));

  // Upsert in batches of 50 for stability
  let importedCount = 0;
  for (let i = 0; i < payload.length; i += 50) {
    const batch = payload.slice(i, i + 50);
    const { error } = await supabase.from('operators').upsert(batch, { onConflict: 'registration' });
    if (error) {
      console.error('Batch upsert error in Supabase, trying individually:', error);
      for (const op of batch) {
        const { error: singleErr } = await supabase.from('operators').upsert([op], { onConflict: 'registration' });
        if (!singleErr) importedCount++;
      }
    } else {
      importedCount += batch.length;
    }
  }

  return { importedCount };
}

// ==========================================
// ROULETTE
// ==========================================
const ROULETTE_PRIZES = [
  { id: 'pts10', name: '+10 pontos', icon: '🎁', prize_type: 'points', points: 10, description: 'Crédito imediato de +10 pontos no extrato', color: '#0284c7' },
  { id: 'pts20', name: '+20 pontos', icon: '⭐', prize_type: 'points', points: 20, description: 'Crédito imediato de +20 pontos no extrato', color: '#7c3aed' },
  { id: 'pausa', name: 'Pausa extra de 15m', icon: '☕', prize_type: 'extra_break', points: 0, description: 'Descanso extra de 15 minutos autorizado', color: '#d97706' },
  { id: 'saida', name: 'Saída 30m mais cedo', icon: '⏰', prize_type: 'early_leave', points: 0, description: 'Liberação antecipada de 30 minutos', color: '#059669' },
  { id: 'tkt1', name: '+1 bilhete extra', icon: '🎟️', prize_type: 'ticket', points: 50, description: 'Equivalente a +50 pts com bilhete gerado', color: '#2563eb' },
  { id: 'tkt2', name: '+2 bilhetes extras', icon: '🎫', prize_type: 'ticket', points: 100, description: 'Equivalente a +100 pts com 2 bilhetes gerados', color: '#9333ea' },
  { id: 'dobro', name: 'Pontos em dobro', icon: '🔥', prize_type: 'double_points', points: 0, description: 'Multiplica x2 o próximo lançamento de pontos', color: '#ea580c' },
  { id: 'surpresa', name: 'Prêmio surpresa', icon: '✨', prize_type: 'surprise', points: 0, description: 'Recompensa surpresa especial da supervisão', color: '#ca8a04' },
  { id: 'nada', name: 'Tente novamente', icon: '🔄', prize_type: 'nothing', points: 0, description: 'Não foi dessa vez! Continue focado', color: '#dc2626' },
  { id: 'desafio', name: 'Desafio especial', icon: '🎯', prize_type: 'special_challenge', points: 0, description: 'Missão relâmpago com bonificação extra', color: '#0891b2' }
];

async function spinRoulette(operatorId, selectedPrizeId = null, username = 'Admin') {
  const { data: opList } = await supabase.from('operators').select('*').eq('id', operatorId).limit(1);
  if (!opList || opList.length === 0) {
    throw new Error('Operador não encontrado.');
  }
  const operator = opList[0];

  let prizeObj = null;
  if (selectedPrizeId) {
    prizeObj = ROULETTE_PRIZES.find(p => p.id === selectedPrizeId);
  }
  if (!prizeObj) {
    const rand = Math.floor(Math.random() * ROULETTE_PRIZES.length);
    prizeObj = ROULETTE_PRIZES[rand];
  }

  // Insert spin into Supabase
  await supabase.from('roulette_spins').insert([{
    operator_id: operatorId,
    prize: prizeObj.name,
    prize_type: prizeObj.prize_type,
    points: prizeObj.points,
    created_by: username
  }]);

  const dateToday = new Date().toISOString().split('T')[0];
  let pointsAwarded = prizeObj.points;
  let newlyEarnedTickets = 0;
  let newTicketCodes = [];

  // Prize effects
  if (prizeObj.prize_type === 'points' || prizeObj.prize_type === 'ticket') {
    await supabase.from('point_transactions').insert([{
      operator_id: operatorId,
      campaign_id: 1,
      points: pointsAwarded,
      event_date: dateToday,
      description: `Roleta 156 — Prêmio: ${prizeObj.name}`,
      observation: prizeObj.description,
      created_by: username
    }]);

    const sync = await syncOperatorTickets(operatorId, 1);
    newlyEarnedTickets = sync.newlyEarned;
    newTicketCodes = sync.newTicketCodes;
  } else if (prizeObj.prize_type === 'double_points') {
    await supabase.from('operator_double_points').upsert([{
      operator_id: operatorId,
      active: 1
    }], { onConflict: 'operator_id' });
  } else if (['extra_break', 'early_leave', 'surprise'].includes(prizeObj.prize_type)) {
    let cat = 'outros';
    if (prizeObj.prize_type === 'extra_break') cat = 'pausa_extra';
    if (prizeObj.prize_type === 'early_leave') cat = 'saida_mais_cedo';
    if (prizeObj.prize_type === 'surprise') cat = 'surpresa';

    await supabase.from('prizes').insert([{
      operator_id: operatorId,
      name: prizeObj.name,
      category: cat,
      status: 'Pendente',
      observation: `Conquistado na Roleta 156: ${prizeObj.description}`,
      created_by: username
    }]);
  }

  await logAudit(username, 'SPIN_ROULETTE', 'roulette_spins', null, null, {
    operatorName: operator.name,
    prize: prizeObj.name,
    prizeType: prizeObj.prize_type
  });

  return {
    message: `🎉 PARABÉNS, ${operator.name}! Você ganhou: ${prizeObj.name}`,
    prize: prizeObj,
    operatorName: operator.name,
    pointsAwarded,
    newlyEarnedTickets,
    newTicketCodes
  };
}

async function getRouletteHistory() {
  const { data: spins, error } = await supabase
    .from('roulette_spins')
    .select('*, operators(name, registration)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    // Fallback if join syntax fails
    const { data: rawSpins } = await supabase.from('roulette_spins').select('*').order('created_at', { ascending: false }).limit(50);
    const { data: ops } = await supabase.from('operators').select('id, name, registration');
    const opMap = {};
    (ops || []).forEach(o => { opMap[o.id] = o; });

    return (rawSpins || []).map(s => ({
      ...s,
      operator_name: opMap[s.operator_id] ? opMap[s.operator_id].name : 'Operador',
      registration: opMap[s.operator_id] ? opMap[s.operator_id].registration : '-'
    }));
  }

  return (spins || []).map(s => ({
    ...s,
    operator_name: s.operators ? s.operators.name : 'Operador',
    registration: s.operators ? s.operators.registration : '-'
  }));
}

// ==========================================
// CAMPAIGN
// ==========================================
async function getCampaign() {
  const { data, error } = await supabase.from('campaigns').select('*').eq('id', 1).limit(1);
  if (error || !data || data.length === 0) {
    return {
      id: 1,
      name: 'DESAFIO 156',
      subtitle: 'Performance, reconhecimento e chances de conquistar sua folga de Natal e Ano Novo.',
      start_date: '2026-09-01',
      end_date: '2026-12-11',
      status: 'active'
    };
  }
  return data[0];
}

async function updateCampaign(data) {
  const { data: updated, error } = await supabase.from('campaigns').update(data).eq('id', 1).select();
  if (error) throw error;
  return updated[0];
}

async function lockCampaign() {
  const { data, error } = await supabase.from('campaigns').update({
    status: 'locked',
    locked_at: new Date().toISOString()
  }).eq('id', 1).select();
  if (error) throw error;
  return data[0];
}

// ==========================================
// POINT RULES
// ==========================================
async function getRules() {
  const { data, error } = await supabase.from('point_rules').select('*').order('type', { ascending: false }).order('points', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createRule(rule) {
  const { data, error } = await supabase.from('point_rules').insert([rule]).select();
  if (error) throw error;
  return data[0];
}

async function updateRule(id, rule) {
  const { data, error } = await supabase.from('point_rules').update(rule).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

async function deleteRule(id) {
  const { error } = await supabase.from('point_rules').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ==========================================
// TICKETS
// ==========================================
async function getTickets(campaignId = 1) {
  const { data: tkts, error } = await supabase
    .from('tickets')
    .select('*, operators(name, registration)')
    .eq('campaign_id', campaignId)
    .order('ticket_number', { ascending: true });

  if (error) {
    const { data: rawTkts } = await supabase.from('tickets').select('*').eq('campaign_id', campaignId).order('ticket_number', { ascending: true });
    const { data: ops } = await supabase.from('operators').select('id, name, registration');
    const opMap = {};
    (ops || []).forEach(o => { opMap[o.id] = o; });

    return (rawTkts || []).map(t => ({
      ...t,
      operator_name: opMap[t.operator_id] ? opMap[t.operator_id].name : 'Operador',
      registration: opMap[t.operator_id] ? opMap[t.operator_id].registration : '-'
    }));
  }

  return (tkts || []).map(t => ({
    ...t,
    operator_name: t.operators ? t.operators.name : 'Operador',
    registration: t.operators ? t.operators.registration : '-'
  }));
}

// ==========================================
// PRIZES
// ==========================================
async function getPrizes() {
  const { data: pList, error } = await supabase
    .from('prizes')
    .select('*, operators(name, registration)')
    .order('awarded_at', { ascending: false });

  if (error) {
    const { data: rawP } = await supabase.from('prizes').select('*').order('awarded_at', { ascending: false });
    const { data: ops } = await supabase.from('operators').select('id, name, registration');
    const opMap = {};
    (ops || []).forEach(o => { opMap[o.id] = o; });

    return (rawP || []).map(p => ({
      ...p,
      operator_name: opMap[p.operator_id] ? opMap[p.operator_id].name : 'Operador',
      registration: opMap[p.operator_id] ? opMap[p.operator_id].registration : '-'
    }));
  }

  return (pList || []).map(p => ({
    ...p,
    operator_name: p.operators ? p.operators.name : 'Operador',
    registration: p.operators ? p.operators.registration : '-'
  }));
}

async function updatePrizeStatus(id, status, observation = null) {
  const updateData = { status };
  if (status === 'Utilizado') {
    updateData.used_at = new Date().toISOString();
  }
  if (observation) {
    updateData.observation = observation;
  }
  const { data, error } = await supabase.from('prizes').update(updateData).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

// ==========================================
// HIGHLIGHTS
// ==========================================
async function getHighlights() {
  const { data: hlList, error } = await supabase
    .from('weekly_highlights')
    .select('*, operators(name, registration)')
    .order('created_at', { ascending: false });

  if (error) {
    const { data: rawHl } = await supabase.from('weekly_highlights').select('*').order('created_at', { ascending: false });
    const { data: ops } = await supabase.from('operators').select('id, name, registration');
    const opMap = {};
    (ops || []).forEach(o => { opMap[o.id] = o; });

    return (rawHl || []).map(h => ({
      ...h,
      operator_name: opMap[h.operator_id] ? opMap[h.operator_id].name : 'Operador',
      registration: opMap[h.operator_id] ? opMap[h.operator_id].registration : '-'
    }));
  }

  return (hlList || []).map(h => ({
    ...h,
    operator_name: h.operators ? h.operators.name : 'Operador',
    registration: h.operators ? h.operators.registration : '-'
  }));
}

async function addHighlight({ operatorId, category, points, weekReference }) {
  const { data, error } = await supabase.from('weekly_highlights').insert([{
    operator_id: operatorId,
    category,
    points: points || 10,
    week_reference: weekReference,
    status: 'confirmed'
  }]).select();

  if (error) throw error;

  // Also award points
  const dateToday = new Date().toISOString().split('T')[0];
  await supabase.from('point_transactions').insert([{
    operator_id: operatorId,
    campaign_id: 1,
    points: points || 10,
    event_date: dateToday,
    description: `Destaque da Semana — ${category} (${weekReference})`,
    observation: 'Reconhecimento de desempenho',
    created_by: 'Admin'
  }]);

  await syncOperatorTickets(operatorId, 1);

  return data[0];
}

async function deleteHighlight(id) {
  const { error } = await supabase.from('weekly_highlights').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ==========================================
// CHALLENGES
// ==========================================
async function getChallenges() {
  const { data, error } = await supabase.from('challenges').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createChallenge(challenge) {
  const { data, error } = await supabase.from('challenges').insert([challenge]).select();
  if (error) throw error;
  return data[0];
}

async function updateChallenge(id, challenge) {
  const { data, error } = await supabase.from('challenges').update(challenge).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

// ==========================================
// AUDIT LOGS
// ==========================================
async function getAuditLogs(limit = 100) {
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

module.exports = {
  supabase,
  logAudit,
  syncOperatorTickets,
  getOperators,
  getOperatorById,
  createOperator,
  updateOperator,
  importOperatorsBulk,
  ROULETTE_PRIZES,
  spinRoulette,
  getRouletteHistory,
  getCampaign,
  updateCampaign,
  lockCampaign,
  getRules,
  createRule,
  updateRule,
  deleteRule,
  getTickets,
  getPrizes,
  updatePrizeStatus,
  getHighlights,
  addHighlight,
  deleteHighlight,
  getChallenges,
  createChallenge,
  updateChallenge,
  getAuditLogs
};
