const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/tickets - List overall tickets & operator summary
router.get('/', authMiddleware, (req, res) => {
  const { search } = req.query;

  // Aggregate tickets by operator
  let query = `
    SELECT 
      o.id as operator_id,
      o.name as operator_name,
      o.registration,
      o.status as operator_status,
      COALESCE(SUM(pt.points), 0) as total_points,
      (SELECT COUNT(*) FROM tickets t WHERE t.operator_id = o.id) as ticket_count,
      (SELECT MIN(generated_at) FROM tickets t WHERE t.operator_id = o.id) as first_ticket_date,
      (SELECT MAX(generated_at) FROM tickets t WHERE t.operator_id = o.id) as last_ticket_date
    FROM operators o
    LEFT JOIN point_transactions pt ON o.id = pt.operator_id
  `;

  if (search) {
    query += ` WHERE (o.name LIKE '%${search}%' OR o.registration LIKE '%${search}%')`;
  }

  query += ` GROUP BY o.id ORDER BY ticket_count DESC, total_points DESC, o.name ASC`;

  const rows = db.prepare(query).all();

  const operatorsSummary = rows.map(r => ({
    ...r,
    ticket_count: r.total_points > 0 ? Math.floor(r.total_points / 50) : 0,
    points_remaining: r.total_points >= 0 ? 50 - (r.total_points % 50) : 50 + Math.abs(r.total_points)
  }));

  // Overall campaign totals
  const totalTicketsGenerated = db.prepare('SELECT COUNT(*) as cnt FROM tickets').get().cnt;

  return res.json({
    totalTicketsGenerated,
    operators: operatorsSummary
  });
});

// GET /api/tickets/printable - Get formatted ticket cards data for physical print view
router.get('/printable', authMiddleware, (req, res) => {
  const { operatorId } = req.query;

  let query = `
    SELECT 
      t.id as ticket_id,
      t.ticket_number,
      t.ticket_code,
      t.generated_at,
      o.id as operator_id,
      o.name as operator_name,
      o.registration,
      c.name as campaign_name,
      c.subtitle as campaign_subtitle
    FROM tickets t
    JOIN operators o ON t.operator_id = o.id
    JOIN campaigns c ON t.campaign_id = c.id
  `;

  if (operatorId) {
    query += ` WHERE t.operator_id = ${Number(operatorId)}`;
  }

  query += ` ORDER BY t.ticket_number ASC`;

  const tickets = db.prepare(query).all();

  // Get total tickets per operator map
  const opTotalsMap = {};
  const opTotals = db.prepare('SELECT operator_id, COUNT(*) as cnt FROM tickets GROUP BY operator_id').all();
  opTotals.forEach(r => { opTotalsMap[r.operator_id] = r.cnt; });

  // Map each ticket with index sequence "Bilhete X de Y"
  const operatorCounters = {};
  const formattedTickets = tickets.map(t => {
    operatorCounters[t.operator_id] = (operatorCounters[t.operator_id] || 0) + 1;
    const currentNum = operatorCounters[t.operator_id];
    const totalNum = opTotalsMap[t.operator_id] || currentNum;

    return {
      ticketId: t.ticket_id,
      ticketNumberFormatted: `#${String(t.ticket_number).padStart(4, '0')}`,
      ticketCode: t.ticket_code,
      operatorName: t.operator_name,
      operatorRegistration: t.registration,
      campaignName: t.campaign_name,
      issueDate: t.generated_at ? t.generated_at.substring(0, 10) : '2026-09-01',
      operatorTicketIndex: currentNum,
      operatorTotalTickets: totalNum,
      sorteioTag: 'Folga Natal/Ano Novo'
    };
  });

  return res.json(formattedTickets);
});

module.exports = router;
