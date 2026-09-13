const express = require('express');
const router = express.Router();
const {
  ROULETTE_PRIZES,
  spinRoulette,
  getRouletteHistory,
  deleteRouletteSpin,
  resetAllRouletteHistory
} = require('../db/supabaseService');
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

// DELETE /api/roulette/history/:id - Delete specific spin and revoke its prizes/effects
router.delete('/history/:id', authMiddleware, async (req, res) => {
  try {
    const result = await deleteRouletteSpin(Number(req.params.id), req.user.username);
    return res.json(result);
  } catch (err) {
    console.error('Error deleting roulette spin:', err);
    return res.status(400).json({ error: err.message || 'Erro ao excluir giro da roleta.' });
  }
});

// DELETE /api/roulette/history - Reset all roulette spins and clear all associated rewards
router.delete('/history', authMiddleware, async (req, res) => {
  try {
    const result = await resetAllRouletteHistory(req.user.username);
    return res.json(result);
  } catch (err) {
    console.error('Error resetting roulette history:', err);
    return res.status(400).json({ error: err.message || 'Erro ao zerar histórico da roleta.' });
  }
});

module.exports = router;
