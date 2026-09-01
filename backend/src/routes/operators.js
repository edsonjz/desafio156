const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { db, logAudit, syncOperatorTickets } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/operators - List all operators with point totals & ticket counts
router.get('/', authMiddleware, (req, res) => {
  const { status, search } = req.query;

  let query = `
    SELECT 
      o.id,
      o.name,
      o.registration,
      o.status,
      o.notes,
      o.created_at,
      COALESCE(SUM(pt.points), 0) as totalPoints,
      (SELECT COUNT(*) FROM tickets t WHERE t.operator_id = o.id) as totalTickets
    FROM operators o
    LEFT JOIN point_transactions pt ON o.id = pt.operator_id
  `;

  const whereConditions = [];
  const params = [];

  if (status) {
    whereConditions.push('o.status = ?');
    params.push(status);
  }

  if (search) {
    whereConditions.push('(o.name LIKE ? OR o.registration LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (whereConditions.length > 0) {
    query += ' WHERE ' + whereConditions.join(' AND ');
  }

  query += ' GROUP BY o.id ORDER BY totalPoints DESC, o.name ASC';

  const operators = db.prepare(query).all(...params);

  // Format indicators for each operator
  const result = operators.map(op => {
    const pts = op.totalPoints;
    const tickets = pts > 0 ? Math.floor(pts / 50) : 0;
    const ptsToNext = pts >= 0 ? 50 - (pts % 50) : 50 + Math.abs(pts);

    return {
      ...op,
      totalPoints: pts,
      totalTickets: tickets,
      pointsToNextTicket: ptsToNext === 0 ? 50 : ptsToNext,
      currentTicketProgress: pts >= 0 ? (pts % 50) : 0
    };
  });

  return res.json(result);
});

// GET /api/operators/template - Download sample Excel template for operators import
router.get('/template', authMiddleware, (req, res) => {
  const sampleData = [
    { 'Nome Completo': 'Carlos Silva', 'Matrícula': 'OP15621', 'Status': 'ativo', 'Observações': 'Turno Manhã' },
    { 'Nome Completo': 'Fernanda Souza', 'Matrícula': 'OP15622', 'Status': 'ativo', 'Observações': 'Turno Tarde' }
  ];

  const worksheet = xlsx.utils.json_to_sheet(sampleData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Operadores');

  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="modelo_operadores.xlsx"');
  return res.send(buffer);
});

// GET /api/operators/:id - Individual operator profile with statistics
router.get('/:id', authMiddleware, (req, res) => {
  const operator = db.prepare('SELECT * FROM operators WHERE id = ?').get(req.params.id);
  if (!operator) {
    return res.status(404).json({ error: 'Operador não encontrado.' });
  }

  // Calculate accumulated points & tickets
  const ticketSync = syncOperatorTickets(operator.id, 1);
  const totalPoints = ticketSync.totalPoints;
  const totalTickets = ticketSync.totalTickets;

  // Points gained and lost
  const gainedRow = db.prepare('SELECT COALESCE(SUM(points), 0) as pts FROM point_transactions WHERE operator_id = ? AND points > 0').get(operator.id);
  const lostRow = db.prepare('SELECT COALESCE(SUM(points), 0) as pts FROM point_transactions WHERE operator_id = ? AND points < 0').get(operator.id);

  // Roulette spins count
  const spinsCount = db.prepare('SELECT COUNT(*) as cnt FROM roulette_spins WHERE operator_id = ?').get(operator.id).cnt;

  // Prizes count
  const prizesCount = db.prepare('SELECT COUNT(*) as cnt FROM prizes WHERE operator_id = ?').get(operator.id).cnt;

  // Highlights count
  const highlightsCount = db.prepare('SELECT COUNT(*) as cnt FROM weekly_highlights WHERE operator_id = ?').get(operator.id).cnt;

  // Rank position overall
  const rankRows = db.prepare(`
    SELECT o.id, COALESCE(SUM(pt.points), 0) as total
    FROM operators o
    LEFT JOIN point_transactions pt ON o.id = pt.operator_id
    WHERE o.status = 'active'
    GROUP BY o.id
    ORDER BY total DESC
  `).all();

  const rankPosition = rankRows.findIndex(r => r.id === operator.id) + 1;

  // Extrato history
  const transactions = db.prepare(`
    SELECT pt.*, pr.name as rule_name
    FROM point_transactions pt
    LEFT JOIN point_rules pr ON pt.rule_id = pr.id
    WHERE pt.operator_id = ?
    ORDER BY pt.created_at DESC, pt.id DESC
  `).all(operator.id);

  // Compute running balances for statement
  let runningBalance = 0;
  const historyWithBalances = [...transactions].reverse().map(tx => {
    const prevBalance = runningBalance;
    runningBalance += tx.points;
    return {
      ...tx,
      previousBalance: prevBalance,
      newBalance: runningBalance
    };
  }).reverse();

  // Tickets list
  const ticketsList = db.prepare('SELECT * FROM tickets WHERE operator_id = ? ORDER BY ticket_number ASC').all(operator.id);

  // Prizes list
  const prizesList = db.prepare('SELECT * FROM prizes WHERE operator_id = ? ORDER BY awarded_at DESC').all(operator.id);

  // Highlights list
  const highlightsList = db.prepare('SELECT * FROM weekly_highlights WHERE operator_id = ? ORDER BY created_at DESC').all(operator.id);

  // Check double points active status
  const doublePtsActive = db.prepare('SELECT active FROM operator_double_points WHERE operator_id = ? AND active = 1').get(operator.id);

  const ptsToNext = totalPoints >= 0 ? (50 - (totalPoints % 50)) : (50 + Math.abs(totalPoints));

  return res.json({
    operator,
    stats: {
      totalPoints,
      totalTickets,
      pointsToNextTicket: ptsToNext === 0 ? 50 : ptsToNext,
      currentTicketProgress: totalPoints >= 0 ? (totalPoints % 50) : 0,
      rankPosition: rankPosition || '-',
      pointsGained: gainedRow ? gainedRow.pts : 0,
      pointsLost: lostRow ? lostRow.pts : 0,
      rouletteSpins: spinsCount,
      prizesWon: prizesCount,
      highlightsWon: highlightsCount,
      hasDoublePoints: !!doublePtsActive
    },
    transactions: historyWithBalances,
    tickets: ticketsList,
    prizes: prizesList,
    highlights: highlightsList
  });
});

// POST /api/operators - Create individual operator
router.post('/', authMiddleware, (req, res) => {
  const { name, registration, notes } = req.body;

  if (!name || !registration) {
    return res.status(400).json({ error: 'Nome e matrícula são obrigatórios.' });
  }

  const existing = db.prepare('SELECT * FROM operators WHERE registration = ?').get(registration.trim());
  if (existing) {
    return res.status(400).json({ error: `Já existe um operador com a matrícula ${registration}.` });
  }

  const result = db.prepare(`
    INSERT INTO operators (name, registration, notes, status)
    VALUES (?, ?, ?, 'active')
  `).run(name.trim(), registration.trim(), notes || null);

  logAudit(req.user.username, 'CREATE_OPERATOR', 'operators', result.lastInsertRowid, null, { name, registration });

  return res.status(201).json({
    message: 'Operador cadastrado com sucesso!',
    operatorId: result.lastInsertRowid
  });
});

// PUT /api/operators/:id - Edit operator
router.put('/:id', authMiddleware, (req, res) => {
  const { name, registration, status, notes } = req.body;

  const operator = db.prepare('SELECT * FROM operators WHERE id = ?').get(req.params.id);
  if (!operator) {
    return res.status(404).json({ error: 'Operador não encontrado.' });
  }

  if (registration && registration !== operator.registration) {
    const existing = db.prepare('SELECT * FROM operators WHERE registration = ? AND id != ?').get(registration, req.params.id);
    if (existing) {
      return res.status(400).json({ error: `Já existe outro operador cadastrado com a matrícula ${registration}.` });
    }
  }

  db.prepare(`
    UPDATE operators 
    SET name = ?, registration = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name || operator.name,
    registration || operator.registration,
    status || operator.status,
    notes !== undefined ? notes : operator.notes,
    req.params.id
  );

  logAudit(req.user.username, 'UPDATE_OPERATOR', 'operators', req.params.id, operator, { name, registration, status, notes });

  return res.json({ message: 'Cadastro do operador atualizado com sucesso!' });
});

// POST /api/operators/import-preview - Preview Excel/CSV import
router.post('/import-preview', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Selecione um arquivo Excel ou CSV para importar.' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    if (rawData.length === 0) {
      return res.status(400).json({ error: 'O arquivo enviado está vazio.' });
    }

    const previewList = [];
    const errors = [];
    let newCount = 0;
    let existingCount = 0;

    rawData.forEach((row, index) => {
      const line = index + 2; // header is line 1
      const name = row['Nome Completo'] || row['Nome'] || row['nome'];
      const reg = row['Matrícula'] || row['Matricula'] || row['matricula'] || row['REG'] || row['reg'];
      const notes = row['Observações'] || row['Observação'] || row['observacao'] || '';

      if (!name || !reg) {
        errors.push(`Linha ${line}: Nome e matrícula são obrigatórios.`);
        return;
      }

      const regStr = String(reg).trim();
      const nameStr = String(name).trim();

      const existing = db.prepare('SELECT id FROM operators WHERE registration = ?').get(regStr);
      const isExisting = !!existing;

      if (isExisting) {
        existingCount++;
      } else {
        newCount++;
      }

      previewList.push({
        line,
        name: nameStr,
        registration: regStr,
        notes: notes ? String(notes).trim() : '',
        isExisting
      });
    });

    return res.json({
      totalFound: rawData.length,
      newCount,
      existingCount,
      errors,
      previewList
    });
  } catch (err) {
    return res.status(400).json({ error: 'Falha ao processar arquivo. Verifique a formatação do arquivo enviado.' });
  }
});

// POST /api/operators/import-confirm - Confirm bulk import
router.post('/import-confirm', authMiddleware, (req, res) => {
  const { operators } = req.body; // array of { name, registration, notes }

  if (!Array.isArray(operators) || operators.length === 0) {
    return res.status(400).json({ error: 'Nenhum operador enviado para importação.' });
  }

  const insertStmt = db.prepare(`
    INSERT INTO operators (name, registration, notes, status)
    VALUES (?, ?, ?, 'active')
    ON CONFLICT(registration) DO UPDATE SET
      name = excluded.name,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `);

  let importedCount = 0;
  const transaction = db.transaction((ops) => {
    for (const op of ops) {
      if (op.name && op.registration) {
        insertStmt.run(op.name.trim(), op.registration.trim(), op.notes || null);
        importedCount++;
      }
    }
  });

  transaction(operators);

  logAudit(req.user.username, 'IMPORT_OPERATORS', 'operators', null, null, `Importados ${importedCount} operadores via Excel/CSV`);

  return res.json({
    message: `${importedCount} operadores importados com sucesso!`,
    importedCount
  });
});

module.exports = router;
