const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (e) {
    console.warn('Could not create db directory:', e);
  }
}

const dbPath = process.env.VERCEL ? '/tmp/desafio156.db' : path.join(dbDir, 'desafio156.db');
let db;
try {
  db = new Database(dbPath);
} catch (err) {
  console.error('Failed to open database at', dbPath, err);
  db = new Database(':memory:');
}

// Enable foreign keys & WAL mode for fast concurrency
try {
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.warn('Pragma setup warning:', err);
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS administrators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      registration TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- active, inactive
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      start_date TEXT NOT NULL, -- YYYY-MM-DD
      end_date TEXT NOT NULL,   -- YYYY-MM-DD
      status TEXT NOT NULL DEFAULT 'active', -- active, locked
      locked_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS point_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      points INTEGER NOT NULL,
      periodicity TEXT NOT NULL, -- diario, semanal, mensal, monitoria, avulso
      type TEXT NOT NULL, -- positive, negative
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS point_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_id INTEGER NOT NULL,
      campaign_id INTEGER NOT NULL,
      rule_id INTEGER,
      points INTEGER NOT NULL,
      event_date TEXT NOT NULL,
      description TEXT NOT NULL,
      observation TEXT,
      indicator_value TEXT,
      is_adjustment INTEGER DEFAULT 0,
      is_double_points INTEGER DEFAULT 0,
      period_ref TEXT, -- e.g. 2026-09-02, 2026-W37, 2026-09
      created_by TEXT NOT NULL DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (operator_id) REFERENCES operators(id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (rule_id) REFERENCES point_rules(id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_id INTEGER NOT NULL,
      campaign_id INTEGER NOT NULL,
      ticket_number INTEGER NOT NULL,
      ticket_code TEXT NOT NULL, -- e.g. TKT-0047
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'valid',
      FOREIGN KEY (operator_id) REFERENCES operators(id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS roulette_spins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_id INTEGER NOT NULL,
      prize TEXT NOT NULL,
      prize_type TEXT NOT NULL, -- points, double_points, ticket, extra_break, early_leave, surprise, special_challenge, nothing
      points INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL DEFAULT 'Admin',
      FOREIGN KEY (operator_id) REFERENCES operators(id)
    );

    CREATE TABLE IF NOT EXISTS operator_double_points (
      operator_id INTEGER PRIMARY KEY,
      active INTEGER NOT NULL DEFAULT 1,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (operator_id) REFERENCES operators(id)
    );

    CREATE TABLE IF NOT EXISTS prizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pendente', -- Pendente, Utilizado, Cancelado
      awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME,
      observation TEXT,
      created_by TEXT NOT NULL DEFAULT 'Admin',
      FOREIGN KEY (operator_id) REFERENCES operators(id)
    );

    CREATE TABLE IF NOT EXISTS weekly_highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 10,
      week_reference TEXT NOT NULL, -- e.g. 2026-W37
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (operator_id) REFERENCES operators(id)
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reward_points INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ativo', -- ativo, encerrado, concluido, cancelado
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS challenge_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL,
      operator_id INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      points_awarded INTEGER DEFAULT 0,
      completed_at DATETIME,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id),
      FOREIGN KEY (operator_id) REFERENCES operators(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function logAudit(userId, action, entity, entityId = null, oldValue = null, newValue = null) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      userId || 'Admin',
      action,
      entity,
      entityId ? String(entityId) : null,
      oldValue ? (typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue)) : null,
      newValue ? (typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue)) : null
    );
  } catch (err) {
    console.error('Failed to log audit:', err);
  }
}

// Function to calculate accumulated points and manage automatic tickets
function syncOperatorTickets(operatorId, campaignId = 1) {
  // Get total points
  const pointsRow = db.prepare(`
    SELECT COALESCE(SUM(points), 0) as totalPoints
    FROM point_transactions
    WHERE operator_id = ? AND campaign_id = ?
  `).get(operatorId, campaignId);

  const totalPoints = pointsRow ? pointsRow.totalPoints : 0;
  
  // Tickets formula: floor(totalPoints / 50) if totalPoints >= 0, else 0
  const totalTicketsEarned = totalPoints > 0 ? Math.floor(totalPoints / 50) : 0;

  // Count existing tickets for this operator
  const existingTickets = db.prepare(`
    SELECT COUNT(*) as count FROM tickets WHERE operator_id = ? AND campaign_id = ?
  `).get(operatorId, campaignId).count;

  if (totalTicketsEarned > existingTickets) {
    const needed = totalTicketsEarned - existingTickets;
    
    // Find next ticket number global for campaign
    const maxNumRow = db.prepare(`
      SELECT COALESCE(MAX(ticket_number), 0) as maxNum FROM tickets WHERE campaign_id = ?
    `).get(campaignId);
    let nextNum = maxNumRow ? maxNumRow.maxNum : 0;

    const insertTicket = db.prepare(`
      INSERT INTO tickets (operator_id, campaign_id, ticket_number, ticket_code)
      VALUES (?, ?, ?, ?)
    `);

    let newTicketCodes = [];
    for (let i = 0; i < needed; i++) {
      nextNum += 1;
      const code = `TKT-${String(nextNum).padStart(4, '0')}`;
      insertTicket.run(operatorId, campaignId, nextNum, code);
      newTicketCodes.push({ number: nextNum, code });
    }

    return { totalPoints, totalTickets: totalTicketsEarned, newlyEarned: needed, newTicketCodes };
  }

  return { totalPoints, totalTickets: totalTicketsEarned, newlyEarned: 0, newTicketCodes: [] };
}

module.exports = {
  db,
  initDb,
  logAudit,
  syncOperatorTickets
};
