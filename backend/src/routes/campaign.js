const express = require('express');
const router = express.Router();
const { getCampaign, updateCampaign, lockCampaign, logAudit } = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

// GET /api/campaign/status (Protected - Admins only)
router.get('/status', authMiddleware, async (req, res) => {
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

// PUT /api/campaign - Edit campaign settings (dates, title, unlock)
router.put('/', authMiddleware, async (req, res) => {
  const { name, subtitle, startDate, endDate, status } = req.body;

  try {
    const oldCampaign = await getCampaign();

    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (subtitle !== undefined) updateFields.subtitle = subtitle.trim();
    if (startDate !== undefined) updateFields.start_date = startDate;
    if (endDate !== undefined) updateFields.end_date = endDate;
    if (status !== undefined) {
      updateFields.status = status;
      if (status === 'active') {
        updateFields.locked_at = null;
      }
    }

    const updated = await updateCampaign(updateFields);

    await logAudit(req.user.username, 'UPDATE_CAMPAIGN', 'campaigns', '1', oldCampaign, updateFields);

    return res.json({ message: 'Configurações da campanha atualizadas com sucesso!', campaign: updated });
  } catch (err) {
    console.error('Error updating campaign in Supabase:', err);
    return res.status(500).json({ error: 'Falha ao atualizar configurações da campanha.' });
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
