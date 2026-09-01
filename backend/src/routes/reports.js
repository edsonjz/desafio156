const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/reports/summary - Key report datasets & evolution charts data from Supabase
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const { data: txs } = await supabase.from('point_transactions').select('*');
    const { data: operators } = await supabase.from('operators').select('*').eq('status', 'active');
    const { data: tickets } = await supabase.from('tickets').select('id');
    const { data: spins } = await supabase.from('roulette_spins').select('prize');

    let posPts = 0;
    let negPts = 0;
    const dailyMap = {};
    const participatingOps = new Set();
    const opPointsMap = {};

    (txs || []).forEach(t => {
      const pts = Number(t.points) || 0;
      if (pts > 0) posPts += pts;
      if (pts < 0) negPts += Math.abs(pts);

      participatingOps.add(t.operator_id);
      opPointsMap[t.operator_id] = (opPointsMap[t.operator_id] || 0) + pts;

      const d = t.event_date;
      dailyMap[d] = (dailyMap[d] || 0) + pts;
    });

    const dates = Object.keys(dailyMap).sort();
    let acc = 0;
    const cumulativeEvolution = dates.map(d => {
      acc += dailyMap[d];
      return {
        date: d,
        daily: dailyMap[d],
        cumulative: acc
      };
    });

    // Roulette breakdown
    const prizeCountMap = {};
    (spins || []).forEach(s => {
      prizeCountMap[s.prize] = (prizeCountMap[s.prize] || 0) + 1;
    });
    const rouletteBreakdown = Object.keys(prizeCountMap).map(p => ({
      prize: p,
      count: prizeCountMap[p]
    })).sort((a, b) => b.count - a.count);

    // Top 5 Operators
    const top5 = (operators || [])
      .map(o => ({
        id: o.id,
        name: o.name,
        registration: o.registration,
        totalPoints: opPointsMap[o.id] || 0,
        tickets: (opPointsMap[o.id] || 0) > 0 ? Math.floor((opPointsMap[o.id] || 0) / 50) : 0
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 5)
      .map((op, idx) => ({ ...op, rank: idx + 1 }));

    const activeOpsCount = (operators || []).length;
    const opsWithPoints = participatingOps.size;

    return res.json({
      metrics: {
        positivePoints: posPts,
        negativePoints: negPts,
        activeOperators: activeOpsCount,
        participatingOperators: opsWithPoints,
        participationPercentage: activeOpsCount > 0 ? Math.round((opsWithPoints / activeOpsCount) * 100) : 0,
        totalTickets: (tickets || []).length
      },
      evolution: cumulativeEvolution,
      rouletteBreakdown,
      top5
    });
  } catch (err) {
    console.error('Error fetching report summary from Supabase:', err);
    return res.status(500).json({ error: 'Erro ao gerar relatório.' });
  }
});

module.exports = router;
