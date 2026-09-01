const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const {
  getOperators,
  getOperatorById,
  createOperator,
  updateOperator,
  importOperatorsBulk,
  logAudit
} = require('../db/supabaseService');
const { authMiddleware } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/operators - List all operators with point totals & ticket counts
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, search } = req.query;
    const operators = await getOperators(status, search);
    return res.json(operators);
  } catch (err) {
    console.error('Error fetching operators:', err);
    return res.status(500).json({ error: 'Erro ao carregar operadores.' });
  }
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
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const data = await getOperatorById(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'Operador não encontrado.' });
    }
    return res.json(data);
  } catch (err) {
    console.error('Error fetching operator detail:', err);
    return res.status(500).json({ error: 'Erro ao carregar detalhes do operador.' });
  }
});

// POST /api/operators - Create individual operator
router.post('/', authMiddleware, async (req, res) => {
  const { name, registration, notes } = req.body;

  if (!name || !registration) {
    return res.status(400).json({ error: 'Nome e matrícula são obrigatórios.' });
  }

  try {
    const newOp = await createOperator({ name, registration, notes });
    await logAudit(req.user.username, 'CREATE_OPERATOR', 'operators', newOp.id, null, { name, registration });

    return res.status(201).json({
      message: 'Operador cadastrado com sucesso!',
      operatorId: newOp.id
    });
  } catch (err) {
    console.error('Error creating operator:', err);
    return res.status(400).json({ error: err.message || 'Erro ao criar operador.' });
  }
});

// PUT /api/operators/:id - Edit operator
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, registration, status, notes } = req.body;

  try {
    const updated = await updateOperator(req.params.id, { name, registration, status, notes });
    await logAudit(req.user.username, 'UPDATE_OPERATOR', 'operators', req.params.id, null, { name, registration, status, notes });

    return res.json({ message: 'Cadastro do operador atualizado com sucesso!', operator: updated });
  } catch (err) {
    console.error('Error updating operator:', err);
    return res.status(400).json({ error: err.message || 'Erro ao atualizar operador.' });
  }
});

// POST /api/operators/import-preview - Preview Excel/CSV import
router.post('/import-preview', authMiddleware, upload.single('file'), async (req, res) => {
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

    const currentOps = await getOperators();
    const existingRegSet = new Set(currentOps.map(o => String(o.registration).trim().toLowerCase()));

    const previewList = [];
    const errors = [];
    let newCount = 0;
    let existingCount = 0;

    rawData.forEach((row, index) => {
      const line = index + 2; // header is line 1
      // Handle diverse column header naming in Portuguese/English/Abbr
      const name = row['Nome Completo'] || row['Nome'] || row['nome'] || row['NOME'] || row['NOME COMPLETO'] || row['Operador'] || row['operador'];
      const reg = row['Matrícula'] || row['Matricula'] || row['matricula'] || row['MATRICULA'] || row['REG'] || row['reg'] || row['RE'] || row['re'] || row['ID'] || row['id'];
      const notes = row['Observações'] || row['Observacao'] || row['observacoes'] || row['observacao'] || row['OBS'] || row['obs'] || '';

      if (!name || !reg) {
        errors.push(`Linha ${line}: Nome e matrícula são obrigatórios.`);
        return;
      }

      const regStr = String(reg).trim();
      const nameStr = String(name).trim();
      const isExisting = existingRegSet.has(regStr.toLowerCase());

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
    console.error('Error previewing Excel import:', err);
    return res.status(400).json({ error: 'Falha ao processar arquivo. Verifique a formatação do arquivo enviado.' });
  }
});

// POST /api/operators/import-confirm - Confirm bulk import into Supabase
router.post('/import-confirm', authMiddleware, async (req, res) => {
  const { operators } = req.body; // array of { name, registration, notes }

  if (!Array.isArray(operators) || operators.length === 0) {
    return res.status(400).json({ error: 'Nenhum operador enviado para importação.' });
  }

  try {
    const result = await importOperatorsBulk(operators);

    await logAudit(
      req.user.username,
      'IMPORT_OPERATORS',
      'operators',
      null,
      null,
      `Importados ${result.importedCount} operadores via Excel/CSV no Supabase`
    );

    return res.json({
      message: `${result.importedCount} operadores importados com sucesso!`,
      importedCount: result.importedCount
    });
  } catch (err) {
    console.error('Error during bulk import in Supabase:', err);
    return res.status(500).json({ error: 'Falha ao salvar operadores no Supabase.' });
  }
});

module.exports = router;
