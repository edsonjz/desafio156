const express = require('express');
const router = express.Router();
const { supabase, createTicket, updateTicket, deleteTicket, logAudit } = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/tickets - List overall tickets & operator summary from Supabase
router.get('/', authMiddleware, async (req, res) => {
  const { search } = req.query;

  try {
    const { data: operators, error: opErr } = await supabase.from('operators').select('*');
    if (opErr) throw opErr;

    const { data: transactions } = await supabase.from('point_transactions').select('operator_id, points');
    const ptsMap = {};
    (transactions || []).forEach(t => {
      ptsMap[t.operator_id] = (ptsMap[t.operator_id] || 0) + (Number(t.points) || 0);
    });

    const { data: tickets, error: tkErr } = await supabase.from('tickets').select('*');
    if (tkErr) throw tkErr;

    const tktMap = {};
    const firstDateMap = {};
    const lastDateMap = {};

    (tickets || []).forEach(tk => {
      tktMap[tk.operator_id] = (tktMap[tk.operator_id] || 0) + 1;
      if (!firstDateMap[tk.operator_id] || tk.generated_at < firstDateMap[tk.operator_id]) {
        firstDateMap[tk.operator_id] = tk.generated_at;
      }
      if (!lastDateMap[tk.operator_id] || tk.generated_at > lastDateMap[tk.operator_id]) {
        lastDateMap[tk.operator_id] = tk.generated_at;
      }
    });

    let operatorsSummary = (operators || []).map(o => {
      const pts = ptsMap[o.id] || 0;
      const count = pts > 0 ? Math.floor(pts / 50) : 0;
      const rem = pts >= 0 ? 50 - (pts % 50) : 50 + Math.abs(pts);

      return {
        operator_id: o.id,
        operator_name: o.name,
        registration: o.registration,
        operator_status: o.status,
        total_points: pts,
        ticket_count: count,
        points_remaining: rem === 0 ? 50 : rem,
        first_ticket_date: firstDateMap[o.id] || null,
        last_ticket_date: lastDateMap[o.id] || null
      };
    });

    if (search) {
      const s = search.toLowerCase();
      operatorsSummary = operatorsSummary.filter(o =>
        (o.operator_name && o.operator_name.toLowerCase().includes(s)) ||
        (o.registration && o.registration.toLowerCase().includes(s))
      );
    }

    operatorsSummary.sort((a, b) => {
      if (b.ticket_count !== a.ticket_count) return b.ticket_count - a.ticket_count;
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return (a.operator_name || '').localeCompare(b.operator_name || '');
    });

    return res.json({
      totalTicketsGenerated: (tickets || []).length,
      operators: operatorsSummary
    });
  } catch (err) {
    console.error('Error fetching tickets from Supabase:', err);
    return res.status(500).json({ error: 'Erro ao carregar bilhetes.' });
  }
});

// GET /api/tickets/printable - Printable tickets cards data
router.get('/printable', authMiddleware, async (req, res) => {
  const { operatorId } = req.query;

  try {
    let query = supabase.from('tickets').select('*, operators(name, registration), campaigns(name, subtitle)').order('ticket_number', { ascending: true });
    if (operatorId) {
      query = query.eq('operator_id', Number(operatorId));
    }

    const { data: tickets, error } = await query;
    if (error) throw error;

    // Count per operator
    const opTotalsMap = {};
    (tickets || []).forEach(t => {
      opTotalsMap[t.operator_id] = (opTotalsMap[t.operator_id] || 0) + 1;
    });

    const operatorCounters = {};
    const formatted = (tickets || []).map(t => {
      operatorCounters[t.operator_id] = (operatorCounters[t.operator_id] || 0) + 1;
      const current = operatorCounters[t.operator_id];
      const total = opTotalsMap[t.operator_id] || current;

      return {
        ticketId: t.id,
        ticketNumberFormatted: `#${String(t.ticket_number).padStart(4, '0')}`,
        ticketCode: t.ticket_code,
        operatorName: t.operators ? t.operators.name : 'Operador',
        operatorRegistration: t.operators ? t.operators.registration : '-',
        campaignName: t.campaigns ? t.campaigns.name : 'DESAFIO 156',
        issueDate: t.generated_at ? t.generated_at.substring(0, 10) : '2026-09-01',
        operatorTicketIndex: current,
        operatorTotalTickets: total,
        sorteioTag: 'Folga Natal/Ano Novo'
      };
    });

    return res.json(formatted);
  } catch (err) {
    console.error('Error fetching printable tickets:', err);
    return res.status(500).json({ error: 'Erro ao gerar dados para impressão de bilhetes.' });
  }
});

// GET /api/tickets/list - List individual tickets with filters
router.get('/list', authMiddleware, async (req, res) => {
  const { operatorId, status, search } = req.query;

  try {
    let query = supabase
      .from('tickets')
      .select('*, operators(name, registration)')
      .order('ticket_number', { ascending: false });

    if (operatorId) query = query.eq('operator_id', Number(operatorId));
    if (status) query = query.eq('status', status);

    const { data: tickets, error } = await query;
    if (error) {
      const { data: rawTkts } = await supabase.from('tickets').select('*').order('ticket_number', { ascending: false });
      const { data: ops } = await supabase.from('operators').select('id, name, registration');
      const opMap = {};
      (ops || []).forEach(o => { opMap[o.id] = o; });

      let list = (rawTkts || []).map(t => ({
        ...t,
        operator_name: opMap[t.operator_id] ? opMap[t.operator_id].name : 'Operador',
        operator_registration: opMap[t.operator_id] ? opMap[t.operator_id].registration : '-'
      }));
      if (operatorId) list = list.filter(t => t.operator_id === Number(operatorId));
      if (status) list = list.filter(t => t.status === status);
      if (search) {
        const s = search.toLowerCase();
        list = list.filter(t => (t.operator_name && t.operator_name.toLowerCase().includes(s)) || (t.ticket_code && t.ticket_code.toLowerCase().includes(s)));
      }
      return res.json(list);
    }

    let list = (tickets || []).map(t => ({
      ...t,
      operator_name: t.operators ? t.operators.name : 'Operador',
      operator_registration: t.operators ? t.operators.registration : '-'
    }));

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(t => (t.operator_name && t.operator_name.toLowerCase().includes(s)) || (t.ticket_code && t.ticket_code.toLowerCase().includes(s)));
    }

    return res.json(list);
  } catch (err) {
    console.error('Error listing tickets:', err);
    return res.status(500).json({ error: 'Erro ao carregar lista de bilhetes.' });
  }
});

// POST /api/tickets - Manually create a ticket
router.post('/', authMiddleware, async (req, res) => {
  const { operatorId, ticketNumber, ticketCode, status } = req.body;

  if (!operatorId) {
    return res.status(400).json({ error: 'Operador é obrigatório para gerar bilhete.' });
  }

  try {
    const { data: opList } = await supabase.from('operators').select('name').eq('id', operatorId).limit(1);
    const operator = opList && opList[0];
    if (!operator) {
      return res.status(404).json({ error: 'Operador não encontrado.' });
    }

    const newTicket = await createTicket({
      operator_id: operatorId,
      campaign_id: 1,
      ticket_number: ticketNumber ? Number(ticketNumber) : null,
      ticket_code: ticketCode,
      status: status || 'valid'
    });

    await logAudit(req.user.username, 'CREATE_TICKET_MANUAL', 'tickets', newTicket.id, null, {
      operatorName: operator.name,
      ticketNumber: newTicket.ticket_number,
      ticketCode: newTicket.ticket_code,
      status: newTicket.status
    });

    return res.status(201).json({
      message: `Bilhete ${newTicket.ticket_code} incluído com sucesso para ${operator.name}.`,
      ticket: newTicket
    });
  } catch (err) {
    console.error('Error creating manual ticket:', err);
    return res.status(500).json({ error: 'Falha ao incluir bilhete manual.' });
  }
});

// PUT /api/tickets/:id - Edit ticket
router.put('/:id', authMiddleware, async (req, res) => {
  const { operatorId, ticketNumber, ticketCode, status } = req.body;

  try {
    const { data: oldList } = await supabase.from('tickets').select('*').eq('id', req.params.id).limit(1);
    const oldTicket = oldList && oldList[0];
    if (!oldTicket) {
      return res.status(404).json({ error: 'Bilhete não encontrado.' });
    }

    const updateFields = {};
    if (operatorId !== undefined) updateFields.operator_id = Number(operatorId);
    if (ticketNumber !== undefined) updateFields.ticket_number = Number(ticketNumber);
    if (ticketCode !== undefined) updateFields.ticket_code = ticketCode;
    if (status !== undefined) updateFields.status = status;

    const updated = await updateTicket(req.params.id, updateFields);

    await logAudit(req.user.username, 'UPDATE_TICKET', 'tickets', req.params.id, oldTicket, updateFields);

    return res.json({ message: 'Bilhete atualizado com sucesso.', ticket: updated });
  } catch (err) {
    console.error('Error updating ticket:', err);
    return res.status(500).json({ error: 'Falha ao atualizar bilhete.' });
  }
});

// DELETE /api/tickets/:id - Delete ticket
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: oldList } = await supabase.from('tickets').select('*').eq('id', req.params.id).limit(1);
    const oldTicket = oldList && oldList[0];
    if (!oldTicket) {
      return res.status(404).json({ error: 'Bilhete não encontrado.' });
    }

    await deleteTicket(req.params.id);

    await logAudit(req.user.username, 'DELETE_TICKET', 'tickets', req.params.id, oldTicket, null);

    return res.json({ message: `Bilhete ${oldTicket.ticket_code} (#${oldTicket.ticket_number}) excluído com sucesso.` });
  } catch (err) {
    console.error('Error deleting ticket:', err);
    return res.status(500).json({ error: 'Falha ao excluir bilhete.' });
  }
});

module.exports = router;
