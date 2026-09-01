const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/ranking - Filterable leaderboard directly from Supabase
router.get('/', authMiddleware, async (req, res) => {
  const { period, startDate, endDate, search } = req.query;

  try {
    // 1. Fetch active operators
    const { data: operators, error: opErr } = await supabase
      .from('operators')
      .select('*')
      .eq('status', 'active');

    if (opErr) throw opErr;

    // 2. Fetch point transactions with date filters
    let txQuery = supabase.from('point_transactions').select('*');

    if (period === 'month') {
      txQuery = txQuery.gte('event_date', '2026-09-01').lte('event_date', '2026-09-30');
    } else if (period === 'week') {
      txQuery = txQuery.gte('event_date', '2026-09-01').lte('event_date', '2026-09-07');
    } else if (period === 'custom' && startDate && endDate) {
      txQuery = txQuery.gte('event_date', startDate).lte('event_date', endDate);
    }

    const { data: transactions, error: txErr } = await txQuery;
    if (txErr) throw txErr;

    // Aggregate by operator
    const statsMap = {};
    (transactions || []).forEach(tx => {
      if (!statsMap[tx.operator_id]) {
        statsMap[tx.operator_id] = { total: 0, positive: 0, negative: 0, count: 0 };
      }
      const pts = Number(tx.points) || 0;
      statsMap[tx.operator_id].total += pts;
      if (pts > 0) statsMap[tx.operator_id].positive += pts;
      if (pts < 0) statsMap[tx.operator_id].negative += Math.abs(pts);
      statsMap[tx.operator_id].count += 1;
    });

    // Build rows
    let rows = (operators || []).map(op => {
      const st = statsMap[op.id] || { total: 0, positive: 0, negative: 0, count: 0 };
      return {
        id: op.id,
        name: op.name,
        registration: op.registration,
        totalPoints: st.total,
        positivePoints: st.positive,
        negativePoints: st.negative,
        tickets: st.total > 0 ? Math.floor(st.total / 50) : 0,
        transactionCount: st.count
      };
    });

    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(r =>
        (r.name && r.name.toLowerCase().includes(s)) ||
        (r.registration && r.registration.toLowerCase().includes(s))
      );
    }

    // Sort by totalPoints desc, positivePoints desc, name asc
    rows.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.positivePoints !== a.positivePoints) return b.positivePoints - a.positivePoints;
      return (a.name || '').localeCompare(b.name || '');
    });

    const leaderboard = rows.map((r, idx) => {
      let medal = null;
      if (idx === 0) medal = '🥇';
      else if (idx === 1) medal = '🥈';
      else if (idx === 2) medal = '🥉';

      return {
        position: idx + 1,
        medal,
        ...r
      };
    });

    return res.json(leaderboard);
  } catch (err) {
    console.error('Error fetching ranking from Supabase:', err);
    return res.status(500).json({ error: 'Erro ao carregar ranking.' });
  }
});

module.exports = router;
