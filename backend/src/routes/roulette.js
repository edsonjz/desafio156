const express = require('express');
const router = express.Router();
const { ROULETTE_PRIZES, spinRoulette, getRouletteHistory } = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/roulette/prizes - List wheel options with descriptions and colors
router.get('/prizes', authMiddleware, (req, res) => {
  return res.json(ROULETTE_PRIZES);
});

// GET /api/roulette/history - List spin history from Supabase
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const history = await getRouletteHistory();
    return res.json(history);
  } catch (err) {
    console.error('Error fetching roulette history:', err);
    return res.status(500).json({ error: 'Erro ao carregar histórico da roleta.' });
  }
});

// POST /api/roulette/spin - Execute spin for operator in Supabase
router.post('/spin', authMiddleware, async (req, res) => {
  const { operatorId, selectedPrizeId } = req.body;

  if (!operatorId) {
    return res.status(400).json({ error: 'Selecione um operador para girar a roleta.' });
  }

  try {
    const result = await spinRoulette(Number(operatorId), selectedPrizeId, req.user.username);
    return res.json(result);
  } catch (err) {
    console.error('Error spinning roulette:', err);
    return res.status(400).json({ error: err.message || 'Erro ao girar a roleta.' });
  }
});

module.exports = router;
