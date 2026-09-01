const express = require('express');
const router = express.Router();
const { db, logAudit } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/campaign/status (Public or authenticated)
router.get('/status', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = 1').get();
  if (!campaign) {
    return res.status(404).json({ error: 'Campanha não encontrada.' });
  }

  // Calculate days remaining until end_date (2026-12-11)
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
    status: campaign.status, // active or locked
    locked_at: campaign.locked_at,
    daysRemaining,
    isLocked: campaign.status === 'locked'
  });
});

// POST /api/campaign/lock (Admin only)
router.post('/lock', authMiddleware, (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = 1').get();
  if (!campaign) {
    return res.status(404).json({ error: 'Campanha não encontrada.' });
  }

  if (campaign.status === 'locked') {
    return res.status(400).json({ error: 'A campanha já está encerrada e congelada.' });
  }

  // Lock campaign
  db.prepare(`
    UPDATE campaigns 
    SET status = 'locked', locked_at = CURRENT_TIMESTAMP 
    WHERE id = 1
  `).run();

  logAudit(req.user.username, 'LOCK_CAMPAIGN', 'campaigns', '1', 'active', 'locked');

  return res.json({
    message: 'Campanha encerrada com sucesso! Todos os pontos e bilhetes foram congelados para o sorteio.',
    status: 'locked'
  });
});

module.exports = router;
