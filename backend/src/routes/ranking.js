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

    // 2. Fetch point transactions with dynamic date filters
    let txQuery = supabase.from('point_transactions').select('*');

    const { getCampaign } = require('../db/supabaseService');
    const campaign = await getCampaign();
    const campStart = campaign?.start_date || '2026-09-01';
    const campEnd = campaign?.end_date || '2026-12-11';

    if (period === 'month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10);
      txQuery = txQuery.gte('event_date', firstDay).lte('event_date', lastDay);
    } else if (period === 'week') {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
      const today = now.toISOString().substring(0, 10);
      txQuery = txQuery.gte('event_date', oneWeekAgo).lte('event_date', today);
    } else if (period === 'custom' && startDate && endDate) {
      txQuery = txQuery.gte('event_date', startDate).lte('event_date', endDate);
    } else {
      // Default: within active campaign bounds
      txQuery = txQuery.gte('event_date', campStart).lte('event_date', campEnd);
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
