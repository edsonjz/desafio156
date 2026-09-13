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
    } else if (existingCount > totalTicketsEarned) {
      const excess = existingCount - totalTicketsEarned;
      const sorted = [...existingTickets].sort((a, b) => b.ticket_number - a.ticket_number);
      const toDeleteIds = sorted.slice(0, excess).map(t => t.id);
      await supabase.from('tickets').delete().in('id', toDeleteIds);
      return { totalPoints, totalTickets: totalTicketsEarned, newlyEarned: -excess, newTicketCodes: [] };
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

async function deleteOperator(id) {
  await supabase.from('tickets').delete().eq('operator_id', id);
  await supabase.from('point_transactions').delete().eq('operator_id', id);
  await supabase.from('prizes').delete().eq('operator_id', id);
  await supabase.from('weekly_highlights').delete().eq('operator_id', id);
  await supabase.from('roulette_spins').delete().eq('operator_id', id);
  await supabase.from('operator_double_points').delete().eq('operator_id', id);
  await supabase.from('challenge_results').delete().eq('operator_id', id);
  const { error } = await supabase.from('operators').delete().eq('id', id);
  if (error) throw error;
  return true;
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
  {
    id: 'pausa10',
    name: 'Pausa extra 10 min',
    icon: '☕',
    prize_type: 'extra_break',
    points: 0,
    description: 'Pausa adicional de 10 minutos autorizada pela supervisão',
    color: '#0284c7', // Sky Blue
    badge: 'Pausa 10m'
  },
  {
    id: 'pausa15',
    name: 'Pausa extra 15 min',
    icon: '☕',
    prize_type: 'extra_break',
    points: 0,
    description: 'Pausa adicional de 15 minutos autorizada pela supervisão',
    color: '#059669', // Emerald Green
    badge: 'Pausa 15m'
  },
  {
    id: 'pausa20',
    name: 'Pausa extra 20 min',
    icon: '☕',
    prize_type: 'extra_break',
    points: 0,
    description: 'Pausa adicional de 20 minutos autorizada pela supervisão',
    color: '#d97706', // Amber Gold
    badge: 'Pausa 20m'
  },
  {
    id: 'saida30',
    name: 'Saída 30 min mais cedo',
    icon: '⏰',
    prize_type: 'early_leave',
    points: 0,
    description: 'Liberação antecipada de 30 minutos no fim do expediente',
    color: '#7c3aed', // Violet
    badge: 'Saída 30m'
  },
  {
    id: 'saida60',
    name: 'Saída 1h mais cedo',
    icon: '🕐',
    prize_type: 'early_leave',
    points: 0,
    description: 'Liberação antecipada de 1 hora autorizada pela chefia',
    color: '#9333ea', // Purple
    badge: 'Saída 1h'
  },
  {
    id: 'tkt1',
    name: '+1 bilhete',
    icon: '🎟️',
    prize_type: 'ticket',
    points: 50,
    description: 'Garante +1 novo bilhete oficial (+50 pontos) para o sorteio de folgas',
    color: '#2563eb', // Royal Blue
    badge: '+1 Bilhete'
  },
  {
    id: 'dobro',
    name: 'Pontos em dobro',
    icon: '🔥',
    prize_type: 'double_points',
    points: 0,
    description: 'Multiplica x2 a pontuação do próximo lançamento positivo da campanha',
    color: '#ea580c', // Flame Orange
    badge: 'Pontos x2'
  },
  {
    id: 'giro_extra',
    name: 'Giro extra',
    icon: '🎲',
    prize_type: 'extra_spin',
    points: 0,
    description: 'Direito imediato a mais um giro na Roleta 156 para continuar premiando!',
    color: '#e11d48', // Crimson Rose
    badge: 'Girar de novo'
  },
  {
    id: 'coringa',
    name: 'Coringa 156',
    icon: '👑',
    prize_type: 'wildcard',
    points: 0,
    description: 'Recompensa coringa exclusiva: combine um benefício à sua escolha com a coordenação',
    color: '#ca8a04', // Gold
    badge: 'Escolha Livre'
  },
  {
    id: 'dupla',
    name: 'Prêmio em dupla (escolhe um colega para ganhar junto mais um bilhete)',
    icon: '🤝',
    prize_type: 'duo_prize',
    points: 50,
    description: 'Você ganha +1 bilhete (+50 pts) e escolhe um colega de equipe para ganhar +1 bilhete junto!',
    color: '#0d9488', // Teal
    badge: 'Você + Colega'
  }
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
  const { data: insertedSpin } = await supabase.from('roulette_spins').insert([{
    operator_id: operatorId,
    prize: prizeObj.name,
    prize_type: prizeObj.prize_type,
    points: prizeObj.points,
    created_by: username
  }]).select();

  const spinId = insertedSpin && insertedSpin[0] ? insertedSpin[0].id : null;
  const dateToday = new Date().toISOString().split('T')[0];
  let pointsAwarded = prizeObj.points;
  let newlyEarnedTickets = 0;
  let newTicketCodes = [];

  // Prize effects
  if (prizeObj.prize_type === 'ticket' || prizeObj.prize_type === 'duo_prize') {
    await supabase.from('point_transactions').insert([{
      operator_id: operatorId,
      campaign_id: 1,
      points: pointsAwarded,
      event_date: dateToday,
      description: `Roleta 156 — Prêmio: ${prizeObj.name}${spinId ? ` (Giro #${spinId})` : ''}`,
      observation: prizeObj.description,
      created_by: username
    }]);

    const sync = await syncOperatorTickets(operatorId, 1);
    newlyEarnedTickets = sync.newlyEarned;
    newTicketCodes = sync.newTicketCodes;

    if (prizeObj.prize_type === 'duo_prize') {
      await supabase.from('prizes').insert([{
        operator_id: operatorId,
        name: 'Prêmio em Dupla (+1 Bilhete compartilhado)',
        category: 'dupla',
        status: 'Pendente',
        observation: `Conquistado na Roleta 156${spinId ? ` (Giro #${spinId})` : ''}: Escolha um colega para receber +1 bilhete (+50 pts) junto!`,
        created_by: username
      }]);
    }
  } else if (prizeObj.prize_type === 'double_points') {
    await supabase.from('operator_double_points').upsert([{
      operator_id: operatorId,
      active: 1
    }], { onConflict: 'operator_id' });
  } else if (['extra_break', 'early_leave', 'wildcard', 'extra_spin'].includes(prizeObj.prize_type)) {
    let cat = 'outros';
    if (prizeObj.prize_type === 'extra_break') cat = 'pausa_extra';
    if (prizeObj.prize_type === 'early_leave') cat = 'saida_mais_cedo';
    if (prizeObj.prize_type === 'wildcard') cat = 'coringa';
    if (prizeObj.prize_type === 'extra_spin') cat = 'giro_extra';

    await supabase.from('prizes').insert([{
      operator_id: operatorId,
      name: prizeObj.name,
      category: cat,
      status: 'Pendente',
      observation: `Conquistado na Roleta 156${spinId ? ` (Giro #${spinId})` : ''}: ${prizeObj.description}`,
      created_by: username
    }]);
  }

  await logAudit(username, 'SPIN_ROULETTE', 'roulette_spins', spinId ? String(spinId) : null, null, {
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
    .limit(100);

  if (error) {
    // Fallback if join syntax fails
    const { data: rawSpins } = await supabase.from('roulette_spins').select('*').order('created_at', { ascending: false }).limit(100);
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

async function deleteRouletteSpin(spinId, username = 'Admin') {
  // 1. Fetch spin
  const { data: spins, error: fetchErr } = await supabase.from('roulette_spins').select('*').eq('id', spinId);
  if (fetchErr || !spins || spins.length === 0) {
    throw new Error('Giro não encontrado ou já excluído.');
  }
  const spin = spins[0];
  const operatorId = spin.operator_id;

  // 2. Revert double points if applicable
  if (spin.prize_type === 'double_points') {
    const { data: otherDoubleSpins } = await supabase
      .from('roulette_spins')
      .select('id')
      .eq('operator_id', operatorId)
      .eq('prize_type', 'double_points')
      .neq('id', spinId);

    if (!otherDoubleSpins || otherDoubleSpins.length === 0) {
      await supabase.from('operator_double_points').delete().eq('operator_id', operatorId);
    }
  }

  // 3. Revert point transactions & sync tickets
  if (spin.prize_type === 'ticket' || spin.prize_type === 'duo_prize' || (spin.points && spin.points > 0)) {
    await supabase
      .from('point_transactions')
      .delete()
      .eq('operator_id', operatorId)
      .or(`description.ilike.%Giro #${spinId}%,description.ilike.%${spin.prize}%`);

    await syncOperatorTickets(operatorId, 1);
  }

  // 4. Revert prize from prizes table
  if (['extra_break', 'early_leave', 'wildcard', 'extra_spin', 'duo_prize'].includes(spin.prize_type)) {
    await supabase
      .from('prizes')
      .delete()
      .eq('operator_id', operatorId)
      .or(`observation.ilike.%Giro #${spinId}%,observation.ilike.%${spin.prize}%,name.ilike.%${spin.prize}%`);
  }

  // 5. Delete the spin record
  await supabase.from('roulette_spins').delete().eq('id', spinId);

  // 6. Audit log
  await logAudit(username, 'DELETE_ROULETTE_SPIN', 'roulette_spins', String(spinId), spin, null);

  return { success: true, message: `Giro de "${spin.prize}" excluído com sucesso e premiações revogadas.` };
}

async function resetAllRouletteHistory(username = 'Admin') {
  // 1. Fetch all spins
  const { data: allSpins } = await supabase.from('roulette_spins').select('*');
  const operatorIds = [...new Set((allSpins || []).map(s => s.operator_id))];

  // 2. Delete all spins
  await supabase.from('roulette_spins').delete().neq('id', 0);

  // 3. Clear all active double points
  await supabase.from('operator_double_points').delete().neq('operator_id', 0);

  // 4. Delete point transactions generated from roulette
  await supabase.from('point_transactions').delete().ilike('description', '%Roleta 156%');

  // 5. Delete prizes generated from roulette
  await supabase.from('prizes').delete().ilike('observation', '%Roleta 156%');

  // 6. Re-sync tickets for all affected operators
  for (const opId of operatorIds) {
    await syncOperatorTickets(opId, 1);
  }

  // 7. Audit log
  await logAudit(username, 'RESET_ROULETTE_HISTORY', 'roulette_spins', null, null, {
    totalDeletedSpins: (allSpins || []).length,
    affectedOperators: operatorIds.length
  });

  return {
    success: true,
    message: 'Histórico da roleta e todas as premiações ativas foram completamente zerados.',
    deletedCount: (allSpins || []).length
  };
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

async function createTicket({ operator_id, campaign_id = 1, ticket_number, ticket_code, status = 'valid', generated_at }) {
  let num = ticket_number;
  if (!num) {
    const { data: allTickets } = await supabase
      .from('tickets')
      .select('ticket_number')
      .eq('campaign_id', campaign_id)
      .order('ticket_number', { ascending: false })
      .limit(1);
    num = (allTickets && allTickets[0] && allTickets[0].ticket_number ? allTickets[0].ticket_number : 0) + 1;
  }
  const code = ticket_code || `TKT-${String(num).padStart(4, '0')}`;
  const payload = {
    operator_id: Number(operator_id),
    campaign_id: Number(campaign_id),
    ticket_number: Number(num),
    ticket_code: code,
    status: status || 'valid'
  };
  if (generated_at) payload.generated_at = generated_at;
  const { data, error } = await supabase.from('tickets').insert([payload]).select();
  if (error) throw error;
  return data[0];
}

async function updateTicket(id, fields) {
  const updateData = {};
  if (fields.operator_id !== undefined) updateData.operator_id = Number(fields.operator_id);
  if (fields.ticket_number !== undefined) updateData.ticket_number = Number(fields.ticket_number);
  if (fields.ticket_code !== undefined) updateData.ticket_code = fields.ticket_code;
  if (fields.status !== undefined) updateData.status = fields.status;

  const { data, error } = await supabase.from('tickets').update(updateData).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

async function deleteTicket(id) {
  const { error } = await supabase.from('tickets').delete().eq('id', id);
  if (error) throw error;
  return true;
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

async function updatePrize(id, fields) {
  const updateData = {};
  if (fields.operator_id !== undefined) updateData.operator_id = Number(fields.operator_id);
  if (fields.name !== undefined) updateData.name = fields.name.trim();
  if (fields.category !== undefined) updateData.category = fields.category;
  if (fields.status !== undefined) updateData.status = fields.status;
  if (fields.observation !== undefined) updateData.observation = fields.observation;
  if (fields.status === 'Utilizado' && !fields.used_at) {
    updateData.used_at = new Date().toISOString();
  } else if (fields.status === 'Pendente') {
    updateData.used_at = null;
  }

  const { data, error } = await supabase.from('prizes').update(updateData).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

async function deletePrize(id) {
  const { error } = await supabase.from('prizes').delete().eq('id', id);
  if (error) throw error;
  return true;
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

async function deleteChallenge(id) {
  await supabase.from('challenge_results').delete().eq('challenge_id', id);
  const { error } = await supabase.from('challenges').delete().eq('id', id);
  if (error) throw error;
  return true;
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
  deleteOperator,
  importOperatorsBulk,
  ROULETTE_PRIZES,
  spinRoulette,
  getRouletteHistory,
  deleteRouletteSpin,
  resetAllRouletteHistory,
  getCampaign,
  updateCampaign,
  lockCampaign,
  getRules,
  createRule,
  updateRule,
  deleteRule,
  getTickets,
  createTicket,
  updateTicket,
  deleteTicket,
  getPrizes,
  updatePrize,
  deletePrize,
  updatePrizeStatus,
  getHighlights,
  addHighlight,
  deleteHighlight,
  getChallenges,
  createChallenge,
  updateChallenge,
  deleteChallenge,
  getAuditLogs
};
