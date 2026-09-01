const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabaseService');
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

module.exports = router;
