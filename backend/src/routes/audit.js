const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/audit - List audit logs with filters
router.get('/', authMiddleware, (req, res) => {
  const { action, entity, user } = req.query;

  let query = 'SELECT * FROM audit_logs';
  const where = [];
  const params = [];

  if (action) {
    where.push('action = ?');
    params.push(action);
  }

  if (entity) {
    where.push('entity = ?');
    params.push(entity);
  }

  if (user) {
    where.push('user_id LIKE ?');
    params.push(`%${user}%`);
  }

  if (where.length > 0) {
    query += ' WHERE ' + where.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT 500';

  const logs = db.prepare(query).all(...params);
  return res.json(logs);
});

module.exports = router;
