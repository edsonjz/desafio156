const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/ranking - Filterable leaderboard
router.get('/', authMiddleware, (req, res) => {
  const { period, startDate, endDate, search } = req.query;

  let dateFilter = '';
  const params = [];

  if (period === 'month') {
    // Current month filter
    dateFilter = "AND pt.event_date >= '2026-09-01' AND pt.event_date <= '2026-09-30'";
  } else if (period === 'week') {
    // Current week filter
    dateFilter = "AND pt.event_date >= '2026-09-01' AND pt.event_date <= '2026-09-07'";
  } else if (period === 'custom' && startDate && endDate) {
    dateFilter = 'AND pt.event_date >= ? AND pt.event_date <= ?';
    params.push(startDate, endDate);
  }

  let searchFilter = '';
  if (search) {
    searchFilter = `AND (o.name LIKE '%${search}%' OR o.registration LIKE '%${search}%')`;
  }

  const query = `
    SELECT 
      o.id,
      o.name,
      o.registration,
      o.status,
      COALESCE(SUM(pt.points), 0) as totalPoints,
      COALESCE(SUM(CASE WHEN pt.points > 0 THEN pt.points ELSE 0 END), 0) as positivePoints,
      COALESCE(SUM(CASE WHEN pt.points < 0 THEN pt.points ELSE 0 END), 0) as negativePoints,
      COUNT(pt.id) as transactionCount
    FROM operators o
    LEFT JOIN point_transactions pt ON o.id = pt.operator_id ${dateFilter}
    WHERE o.status = 'active' ${searchFilter}
    GROUP BY o.id
    ORDER BY totalPoints DESC, positivePoints DESC, o.name ASC
  `;

  const rows = db.prepare(query).all(...params);

  // Compute positions & tickets
  const leaderboard = rows.map((r, idx) => {
    const pts = r.totalPoints;
    const tickets = pts > 0 ? Math.floor(pts / 50) : 0;
    
    let medal = null;
    if (idx === 0) medal = '🥇';
    else if (idx === 1) medal = '🥈';
    else if (idx === 2) medal = '🥉';

    return {
      position: idx + 1,
      medal,
      id: r.id,
      name: r.name,
      registration: r.registration,
      totalPoints: pts,
      positivePoints: r.positivePoints,
      negativePoints: r.negativePoints,
      tickets,
      transactionCount: r.transactionCount
    };
  });

  return res.json(leaderboard);
});

module.exports = router;
