const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { authMiddleware } = require('../middleware/auth');
const {
  getIptuSettings,
  updateIptuSettings,
  getIptuOperators,
  createIptuOperator,
  updateIptuOperator,
  deleteIptuOperator,
  importIptuOperatorsBulk,
  generateTokenForOperator,
  generateAllTokens,
  invalidateToken,
  allowNewAttempt,
  getOperatorSessionByToken,
  startExam,
  saveAnswer,
  finishExam,
  getIptuDashboard,
  getIptuResults,
  getDetailedCorrection,
  getQuestionsPerformance,
  getDifficultyPerformance
} = require('../db/iptuSupabaseService');

const upload = multer({ storage: multer.memoryStorage() });

// ============================================================================
// ROTAS PÚBLICAS DO OPERADOR (Acesso via Token individual, sem login)
// ============================================================================

// GET /api/iptu/public/session/:token - Carrega dados da sessão da prova pelo token
router.get('/public/session/:token', async (req, res) => {
  try {
    const session = await getOperatorSessionByToken(req.params.token);
    return res.json(session);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao carregar sessão da prova.' });
  }
});

// POST /api/iptu/public/start - Inicia a prova para o token
router.post('/public/start', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token obrigatório.' });
    const attempt = await startExam(token);
    return res.json(attempt);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao iniciar prova.' });
  }
});

// POST /api/iptu/public/save-answer - Salva resposta de uma questão em tempo real
router.post('/public/save-answer', async (req, res) => {
  try {
    const { token, questaoNumero, letra } = req.body;
    if (!token || !questaoNumero || !letra) {
      return res.status(400).json({ error: 'Dados incompletos para salvar resposta.' });
    }
    const result = await saveAnswer({ tokenCode: token, questaoNumero, letra });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao salvar resposta.' });
  }
});

// POST /api/iptu/public/finish - Finaliza a prova, calcula a nota e armazena resultado
router.post('/public/finish', async (req, res) => {
  try {
    const { token, tempoGastoSegundos, timedOut } = req.body;
    if (!token) return res.status(400).json({ error: 'Token obrigatório.' });
    const result = await finishExam({ tokenCode: token, tempoGastoSegundos, timedOut: !!timedOut });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao finalizar prova.' });
  }
});

// ============================================================================
// ROTAS ADMINISTRATIVAS (Protegidas por JWT com authMiddleware)
// ============================================================================

// GET /api/iptu/dashboard - Métricas gerais e cards
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const data = await getIptuDashboard();
    return res.json(data);
  } catch (err) {
    console.error('Error fetching IPTU dashboard:', err);
    return res.status(500).json({ error: 'Erro ao carregar dashboard da Prova IPTU.' });
  }
});

// GET /api/iptu/operators - Lista todos os operadores e status na prova
router.get('/operators', authMiddleware, async (req, res) => {
  try {
    const { search, status } = req.query;
    const operators = await getIptuOperators(search, status);
    return res.json(operators);
  } catch (err) {
    console.error('Error fetching IPTU operators:', err);
    return res.status(500).json({ error: 'Erro ao carregar operadores da prova.' });
  }
});

// POST /api/iptu/operators - Cadastro individual
router.post('/operators', authMiddleware, async (req, res) => {
  try {
    const { nome, matricula } = req.body;
    const operator = await createIptuOperator({ nome, matricula }, req.user.username);
    return res.status(201).json(operator);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao cadastrar operador.' });
  }
});

// PUT /api/iptu/operators/:id - Edição
router.put('/operators/:id', authMiddleware, async (req, res) => {
  try {
    const updated = await updateIptuOperator(req.params.id, req.body, req.user.username);
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao atualizar operador.' });
  }
});

// DELETE /api/iptu/operators/:id - Exclusão
router.delete('/operators/:id', authMiddleware, async (req, res) => {
  try {
    await deleteIptuOperator(req.params.id, req.user.username);
    return res.json({ message: 'Operador removido com sucesso.' });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao remover operador.' });
  }
});

// POST /api/iptu/operators/import - Importação de planilha Excel / CSV
router.post('/operators/import', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const parsedData = xlsx.utils.sheet_to_json(worksheet);

    if (!parsedData || parsedData.length === 0) {
      return res.status(400).json({ error: 'A planilha enviada está vazia ou não pôde ser lida.' });
    }

    const result = await importIptuOperatorsBulk(parsedData, req.user.username);
    return res.json(result);
  } catch (err) {
    console.error('Error importing IPTU operators:', err);
    return res.status(500).json({ error: 'Falha ao processar arquivo de importação: ' + err.message });
  }
});

// POST /api/iptu/operators/:id/generate-token - Gera novo token individual
router.post('/operators/:id/generate-token', authMiddleware, async (req, res) => {
  try {
    const token = await generateTokenForOperator(req.params.id, req.user.username);
    return res.json(token);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao gerar token.' });
  }
});

// POST /api/iptu/operators/generate-all-tokens - Gera tokens para todos
router.post('/operators/generate-all-tokens', authMiddleware, async (req, res) => {
  try {
    const result = await generateAllTokens(req.user.username);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar tokens em massa.' });
  }
});

// POST /api/iptu/operators/invalidate-token - Invalida um token
router.post('/operators/invalidate-token', authMiddleware, async (req, res) => {
  try {
    const { token, tokenId } = req.body;
    await invalidateToken(token || tokenId, req.user.username);
    return res.json({ message: 'Token invalidado com sucesso.' });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao invalidar token.' });
  }
});

// POST /api/iptu/operators/:id/retry - Libera nova tentativa
router.post('/operators/:id/retry', authMiddleware, async (req, res) => {
  try {
    const token = await allowNewAttempt(req.params.id, req.user.username);
    return res.json({ message: 'Nova tentativa liberada com sucesso!', token: token.token });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao liberar nova tentativa.' });
  }
});

// GET /api/iptu/results - Lista resultados de provas
router.get('/results', authMiddleware, async (req, res) => {
  try {
    const { search, status, resultado } = req.query;
    const results = await getIptuResults(search, status, resultado);
    return res.json(results);
  } catch (err) {
    console.error('Error fetching IPTU results:', err);
    return res.status(500).json({ error: 'Erro ao carregar resultados da prova.' });
  }
});

// GET /api/iptu/results/:tentativaId/correction - Correção detalhada questão por questão
router.get('/results/:tentativaId/correction', authMiddleware, async (req, res) => {
  try {
    const correction = await getDetailedCorrection(req.params.tentativaId);
    return res.json(correction);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao carregar correção detalhada.' });
  }
});

// GET /api/iptu/stats/questions - Desempenho por questão
router.get('/stats/questions', authMiddleware, async (req, res) => {
  try {
    const stats = await getQuestionsPerformance();
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar desempenho por questão.' });
  }
});

// GET /api/iptu/stats/difficulty - Desempenho por dificuldade
router.get('/stats/difficulty', authMiddleware, async (req, res) => {
  try {
    const stats = await getDifficultyPerformance();
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar desempenho por dificuldade.' });
  }
});

// GET /api/iptu/settings - Configurações
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const config = await getIptuSettings();
    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar configurações.' });
  }
});

// PUT /api/iptu/settings - Atualiza configurações
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const updated = await updateIptuSettings(req.body, req.user.username);
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao atualizar configurações.' });
  }
});

// GET /api/iptu/export/results - Exportação de resultados para Excel (.xlsx)
router.get('/export/results', authMiddleware, async (req, res) => {
  try {
    const results = await getIptuResults();
    const rows = results.map(r => ({
      'Operador': r.nome,
      'Matrícula': r.matricula,
      'Tentativa': `${r.numero_tentativa}ª`,
      'Status': r.status === 'concluida' ? 'Concluída' : 'Em Andamento',
      'Nota (0 a 10)': r.nota !== null ? r.nota.toFixed(1) : '-',
      'Aproveitamento (%)': r.percentual !== null ? `${r.percentual.toFixed(1)}%` : '-',
      'Acertos': r.acertos,
      'Erros': r.erros,
      'Resultado': r.resultado ? r.resultado.toUpperCase() : '-',
      'Data de Início': r.iniciada_em ? new Date(r.iniciada_em).toLocaleString('pt-BR') : '-',
      'Data de Conclusão': r.finalizada_em ? new Date(r.finalizada_em).toLocaleString('pt-BR') : '-'
    }));

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Resultados Prova IPTU');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="resultados_prova_iptu_156.xlsx"');
    return res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ error: 'Falha ao exportar resultados.' });
  }
});

module.exports = router;
