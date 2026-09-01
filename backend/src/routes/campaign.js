const express = require('express');
const router = express.Router();
const { getCampaign, lockCampaign, logAudit } = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/campaign/status
router.get('/status', async (req, res) => {
  try {
    const campaign = await getCampaign();

    const endDate = new Date(`${campaign.end_date}T23:59:59-03:00`);
    const now = new Date();
    const diffTime = endDate - now;
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return res.json({
      id: campaign.id,
      name: campaign.name,
      subtitle: campaign.subtitle,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      status: campaign.status,
      locked_at: campaign.locked_at,
      daysRemaining,
      isLocked: campaign.status === 'locked'
    });
  } catch (err) {
    console.error('Error fetching campaign status from Supabase:', err);
    return res.status(500).json({ error: 'Erro ao carregar status da campanha.' });
  }
});

// POST /api/campaign/lock (Admin only)
router.post('/lock', authMiddleware, async (req, res) => {
  try {
    const campaign = await getCampaign();

    if (campaign.status === 'locked') {
      return res.status(400).json({ error: 'A campanha já está encerrada e congelada.' });
    }

    await lockCampaign();
    await logAudit(req.user.username, 'LOCK_CAMPAIGN', 'campaigns', '1', 'active', 'locked');

    return res.json({
      message: 'Campanha encerrada com sucesso! Todos os pontos e bilhetes foram congelados para o sorteio.',
      status: 'locked'
    });
  } catch (err) {
    console.error('Error locking campaign in Supabase:', err);
    return res.status(500).json({ error: 'Falha ao encerrar campanha.' });
  }
});

module.exports = router;
