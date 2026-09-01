const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/reports/summary - Key report datasets & evolution charts data
router.get('/summary', authMiddleware, (req, res) => {
  // Total points positive vs negative
  const posPts = db.prepare('SELECT COALESCE(SUM(points), 0) as total FROM point_transactions WHERE points > 0').get().total;
  const negPts = db.prepare('SELECT COALESCE(SUM(points), 0) as total FROM point_transactions WHERE points < 0').get().total;

  // Evolution over time (by date)
  const evolution = db.prepare(`
    SELECT event_date, COALESCE(SUM(points), 0) as dailyPoints
    FROM point_transactions
    GROUP BY event_date
    ORDER BY event_date ASC
  `).all();

  // Compute cumulative evolution
  let acc = 0;
  const cumulativeEvolution = evolution.map(e => {
    acc += e.dailyPoints;
    return {
      date: e.event_date,
      daily: e.dailyPoints,
      cumulative: acc
    };
  });

  // Operator participation stats
  const activeOpsCount = db.prepare("SELECT COUNT(*) as cnt FROM operators WHERE status = 'active'").get().cnt;
  const opsWithPoints = db.prepare('SELECT COUNT(DISTINCT operator_id) as cnt FROM point_transactions').get().cnt;

  // Roulette prizes breakdown
  const rouletteBreakdown = db.prepare(`
    SELECT prize, COUNT(*) as count
    FROM roulette_spins
    GROUP BY prize
    ORDER BY count DESC
  `).all();

  // Top 5 Operators
  const top5 = db.prepare(`
    SELECT o.id, o.name, o.registration, COALESCE(SUM(pt.points), 0) as totalPoints
    FROM operators o
    LEFT JOIN point_transactions pt ON o.id = pt.operator_id
    WHERE o.status = 'active'
    GROUP BY o.id
    ORDER BY totalPoints DESC LIMIT 5
  `).all().map((op, idx) => ({
    ...op,
    tickets: op.totalPoints > 0 ? Math.floor(op.totalPoints / 50) : 0,
    rank: idx + 1
  }));

  // Tickets timeline breakdown
  const ticketsCount = db.prepare('SELECT COUNT(*) as cnt FROM tickets').get().cnt;

  return res.json({
    metrics: {
      positivePoints: posPts,
      negativePoints: Math.abs(negPts),
      activeOperators: activeOpsCount,
      participatingOperators: opsWithPoints,
      participationPercentage: activeOpsCount > 0 ? Math.round((opsWithPoints / activeOpsCount) * 100) : 0,
      totalTickets: ticketsCount
    },
    evolution: cumulativeEvolution,
    rouletteBreakdown,
    top5
  });
});

module.exports = router;
