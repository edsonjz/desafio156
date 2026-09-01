const path = require('path');
const fs = require('fs');

class PureJSDatabase {
  constructor() {
    this.tables = {};
    this.autoIncrement = {};
  }
  pragma() {}
  transaction(fn) {
    return (...args) => fn(...args);
  }
  exec(sql) {
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      if (stmt.toUpperCase().startsWith('CREATE TABLE')) {
        const match = stmt.match(/CREATE TABLE IF NOT EXISTS ([\w]+)/i) || stmt.match(/CREATE TABLE ([\w]+)/i);
        if (match) {
          const tableName = match[1];
          if (!this.tables[tableName]) {
            this.tables[tableName] = [];
            this.autoIncrement[tableName] = 1;
          }
        }
      }
    }
  }
  prepare(sqlStr) {
    const self = this;
    const cleanSql = sqlStr.replace(/\s+/g, ' ').trim();
    return {
      get(...params) {
        const flatParams = params.flat();
        const results = self._executeSelect(cleanSql, flatParams);
        return results[0] || undefined;
      },
      all(...params) {
        const flatParams = params.flat();
        return self._executeSelect(cleanSql, flatParams);
      },
      run(...params) {
        const flatParams = params.flat();
        return self._executeUpdate(cleanSql, flatParams);
      }
    };
  }
  _executeSelect(sql, params) {
    const countMatch = sql.match(/SELECT COUNT\(\*\) as count FROM ([\w]+)/i);
    if (countMatch) {
      const tableName = countMatch[1];
      const whereMatch = sql.match(/WHERE\s+(.+)/i);
      let rows = this.tables[tableName] || [];
      if (whereMatch) {
        rows = this._filterRows(rows, whereMatch[1], params);
      }
      return [{ count: rows.length }];
    }

    if (sql.includes('SUM(points)') && sql.includes('point_transactions')) {
      let rows = this.tables['point_transactions'] || [];
      const whereMatch = sql.match(/WHERE\s+(.+)/i);
      if (whereMatch) {
        rows = this._filterRows(rows, whereMatch[1], params);
      }
      const sum = rows.reduce((acc, r) => acc + (Number(r.points) || 0), 0);
      return [{ totalPoints: sum }];
    }

    if (sql.includes('MAX(ticket_number)') && sql.includes('tickets')) {
      let rows = this.tables['tickets'] || [];
      const whereMatch = sql.match(/WHERE\s+(.+)/i);
      if (whereMatch) {
        rows = this._filterRows(rows, whereMatch[1], params);
      }
      const max = rows.reduce((acc, r) => Math.max(acc, Number(r.ticket_number) || 0), 0);
      return [{ maxNum: max }];
    }

    const selectMatch = sql.match(/SELECT .*? FROM ([\w]+)(?:\s+(?:WHERE|ORDER BY|LIMIT).*)?/i);
    if (selectMatch) {
      const tableName = selectMatch[1];
      let rows = [...(this.tables[tableName] || [])];

      const whereMatch = sql.match(/WHERE\s+(.*?)(?:ORDER BY|LIMIT|$)/i);
      if (whereMatch) {
        rows = this._filterRows(rows, whereMatch[1].trim(), params);
      }

      const orderMatch = sql.match(/ORDER BY\s+(.*?)(?:LIMIT|$)/i);
      if (orderMatch) {
        const orderPart = orderMatch[1].trim();
        const isDesc = orderPart.toUpperCase().endsWith('DESC');
        const col = orderPart.split(' ')[0].trim();
        rows.sort((a, b) => {
          if (a[col] < b[col]) return isDesc ? 1 : -1;
          if (a[col] > b[col]) return isDesc ? -1 : 1;
          return 0;
        });
      }

      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        rows = rows.slice(0, parseInt(limitMatch[1], 10));
      }

      return rows;
    }

    return [];
  }
  _executeUpdate(sql, params) {
    const insertMatch = sql.match(/INSERT INTO ([\w]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const tableName = insertMatch[1];
      const cols = insertMatch[2].split(',').map(c => c.trim());
      if (!this.tables[tableName]) {
        this.tables[tableName] = [];
        this.autoIncrement[tableName] = 1;
      }
      const row = { id: this.autoIncrement[tableName]++ };
      let pIdx = 0;
      const valsStr = insertMatch[3].split(',').map(v => v.trim());
      cols.forEach((col, idx) => {
        const v = valsStr[idx];
        if (v === '?') {
          row[col] = params[pIdx++];
        } else {
          row[col] = v.replace(/^['"]|['"]$/g, '');
        }
      });
      this.tables[tableName].push(row);
      return { lastInsertRowid: row.id, changes: 1 };
    }

    const updateMatch = sql.match(/UPDATE ([\w]+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
    if (updateMatch) {
      const tableName = updateMatch[1];
      const setClause = updateMatch[2];
      const whereClause = updateMatch[3];

      let rows = this.tables[tableName] || [];
      const setPairs = setClause.split(',').map(s => s.trim());
      const numSetParams = (setClause.match(/\?/g) || []).length;
      const setParams = params.slice(0, numSetParams);
      const whereParams = params.slice(numSetParams);

      const matchingRows = this._filterRows(rows, whereClause, whereParams);
      matchingRows.forEach(row => {
        let pIdx = 0;
        setPairs.forEach(pair => {
          const col = pair.split('=')[0].trim();
          if (pair.includes('?')) {
            row[col] = setParams[pIdx++];
          } else if (pair.toUpperCase().includes('CURRENT_TIMESTAMP')) {
            row[col] = new Date().toISOString();
          }
        });
      });
      return { changes: matchingRows.length };
    }

    const deleteMatch = sql.match(/DELETE FROM ([\w]+)(?:\s+WHERE\s+(.+))?/i);
    if (deleteMatch) {
      const tableName = deleteMatch[1];
      const whereClause = deleteMatch[2];
      if (!whereClause) {
        const count = (this.tables[tableName] || []).length;
        this.tables[tableName] = [];
        return { changes: count };
      }
      const initialCount = (this.tables[tableName] || []).length;
      const matchingRows = this._filterRows(this.tables[tableName] || [], whereClause, params);
      this.tables[tableName] = (this.tables[tableName] || []).filter(r => !matchingRows.includes(r));
      return { changes: initialCount - this.tables[tableName].length };
    }

    return { changes: 0 };
  }
  _filterRows(rows, whereClause, params) {
    if (!whereClause) return rows;
    let paramIdx = 0;
    return rows.filter(row => {
      const conditions = whereClause.split(/\s+AND\s+/i);
      let matchAll = true;
      for (const cond of conditions) {
        const parts = cond.trim().split(/\s*=\s*/);
        if (parts.length === 2) {
          const col = parts[0].trim();
          const valExpr = parts[1].trim();
          let expectedVal;
          if (valExpr === '?') {
            expectedVal = params[paramIdx++];
          } else {
            expectedVal = valExpr.replace(/^['"]|['"]$/g, '');
          }
          if (String(row[col]) !== String(expectedVal)) {
            matchAll = false;
            break;
          }
        }
      }
      return matchAll;
    });
  }
}

let db;
try {
  const Database = require('better-sqlite3');
  const dbDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, '../../data');
  if (!fs.existsSync(dbDir)) {
    try {
      fs.mkdirSync(dbDir, { recursive: true });
    } catch (e) {
      console.warn('Could not create db directory:', e);
    }
  }
  const dbPath = process.env.VERCEL ? '/tmp/desafio156.db' : path.join(dbDir, 'desafio156.db');
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.warn('better-sqlite3 native module not available, using in-memory pure JS fallback for Vercel:', err.message);
  db = new PureJSDatabase();
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
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      locked_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS point_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      points INTEGER NOT NULL,
      periodicity TEXT NOT NULL,
      type TEXT NOT NULL,
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
      period_ref TEXT,
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
      ticket_code TEXT NOT NULL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'valid',
      FOREIGN KEY (operator_id) REFERENCES operators(id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS roulette_spins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_id INTEGER NOT NULL,
      prize TEXT NOT NULL,
      prize_type TEXT NOT NULL,
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
      status TEXT NOT NULL DEFAULT 'Pendente',
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
      week_reference TEXT NOT NULL,
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
      status TEXT NOT NULL DEFAULT 'ativo',
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

function syncOperatorTickets(operatorId, campaignId = 1) {
  const pointsRow = db.prepare(`
    SELECT COALESCE(SUM(points), 0) as totalPoints
    FROM point_transactions
    WHERE operator_id = ? AND campaign_id = ?
  `).get(operatorId, campaignId);

  const totalPoints = pointsRow ? pointsRow.totalPoints : 0;
  const totalTicketsEarned = totalPoints > 0 ? Math.floor(totalPoints / 50) : 0;

  const existingRow = db.prepare(`
    SELECT COUNT(*) as count FROM tickets WHERE operator_id = ? AND campaign_id = ?
  `).get(operatorId, campaignId);
  const existingTickets = existingRow ? existingRow.count : 0;

  if (totalTicketsEarned > existingTickets) {
    const needed = totalTicketsEarned - existingTickets;
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
