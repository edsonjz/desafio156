const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { authMiddleware } = require('../middleware/auth');
const { parseQuestionsFromBuffer } = require('../utils/questionParser');
const {
  getProvasList,
  createSecretariaProva,
  getQuestionsForProva,
  importQuestionsForProva,
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// ============================================================================
// 1. ROTAS PÚBLICAS DO OPERADOR (Acesso estrito via Token, sem login)
// ============================================================================

// GET /api/iptu/public/session/:token - Carrega dados da prova atribuída ao token
router.get('/public/session/:token', async (req, res) => {
  try {
    const session = await getOperatorSessionByToken(req.params.token);
    return res.json(session);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao carregar sessão da prova.' });
  }
});

// POST /api/iptu/public/start - Inicia a prova
router.post('/public/start', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token obrigatório.' });
    const attempt = await startExam(token);
    return res.json(attempt);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao iniciar avaliação.' });
  }
});

// POST /api/iptu/public/save-answer - Salva resposta de uma questão
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

// POST /api/iptu/public/finish - Finaliza a prova e calcula o resultado
router.post('/public/finish', async (req, res) => {
  try {
    const { token, tempoGastoSegundos, timedOut } = req.body;
    if (!token) return res.status(400).json({ error: 'Token obrigatório.' });
    const result = await finishExam({ tokenCode: token, tempoGastoSegundos, timedOut: !!timedOut });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao finalizar avaliação.' });
  }
});

// ============================================================================
// 2. ROTAS ADMINISTRATIVAS - GESTÃO DE SECRETARIAS E PROVAS (Protegidas)
// ============================================================================

// GET /api/iptu/provas - Lista todas as secretarias / provas cadastradas
router.get('/provas', authMiddleware, async (req, res) => {
  try {
    const list = await getProvasList();
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao listar secretarias.' });
  }
});

// POST /api/iptu/provas - Cria uma nova secretaria / prova
router.post('/provas', authMiddleware, async (req, res) => {
  try {
    const created = await createSecretariaProva(req.body, req.user.username);
    return res.status(201).json({ message: 'Secretaria cadastrada com sucesso!', prova: created });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao criar secretaria.' });
  }
});

// GET /api/iptu/provas/:provaId/questions - Lista questões de uma secretaria/prova
router.get('/provas/:provaId/questions', authMiddleware, async (req, res) => {
  try {
    const questions = await getQuestionsForProva(req.params.provaId);
    return res.json(questions);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao carregar questões da prova.' });
  }
});

// POST /api/iptu/provas/:provaId/import-questions - Importa questões via Excel ou PDF
router.post('/provas/:provaId/import-questions', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado. Selecione um arquivo Excel (.xlsx, .xls) ou PDF (.pdf).' });
  }

  const provaId = Number(req.params.provaId) || 1;
  const autoTokens = req.body.autoGenerateTokens === 'true' || req.body.autoGenerateTokens === true;
  const replaceExisting = req.body.replace !== 'false';

  try {
    // Parse questions from buffer (supports Excel & PDF)
    const questions = await parseQuestionsFromBuffer(req.file.buffer, req.file.originalname);

    // Save to database
    const importResult = await importQuestionsForProva(provaId, questions, replaceExisting, req.user.username);

    let tokensGenerated = 0;
    if (autoTokens) {
      const tokenRes = await generateAllTokens(req.user.username, provaId);
      tokensGenerated = tokenRes.generatedCount;
    }

    return res.json({
      message: `Sucesso! ${importResult.totalImported} questões foram importadas para a avaliação.${tokensGenerated > 0 ? ` ${tokensGenerated} tokens gerados para os operadores.` : ''}`,
      totalImported: importResult.totalImported,
      tokensGenerated,
      questions: importResult.questions
    });
  } catch (err) {
    console.error('Error importing questions:', err);
    return res.status(400).json({ error: err.message || 'Falha ao processar e importar o arquivo de questões.' });
  }
});

// GET /api/iptu/template/questions - Download de planilha Excel modelo para questões
router.get('/template/questions', authMiddleware, (req, res) => {
  try {
    const templateData = [
      {
        'Numero': 1,
        'Enunciado': 'Qual o canal oficial para abertura de chamados do IPTU em Porto Alegre?',
        'Alternativa A': 'Aplicativo 156+POA e Portal Web 156',
        'Alternativa B': 'Apenas presencialmente na SMF',
        'Alternativa C': 'Via WhatsApp pessoal do atendente',
        'Alternativa D': 'Nenhum dos canais acima',
        'Alternativa E': '',
        'Correta': 'A',
        'Dificuldade': 'facil'
      },
      {
        'Numero': 2,
        'Enunciado': 'Qual é o desconto padrão para pagamento em cota única até a data limite?',
        'Alternativa A': 'Até 5%',
        'Alternativa B': 'Até 11% (desconto antecipação + bom pagador)',
        'Alternativa C': 'Não há descontos aplicáveis',
        'Alternativa D': '20% fixo para todos',
        'Alternativa E': '',
        'Correta': 'B',
        'Dificuldade': 'medio'
      }
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(templateData);
    xlsx.utils.book_append_sheet(wb, ws, 'ModeloQuestoes');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=modelo_questoes_desafio156.xlsx');
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar modelo Excel.' });
  }
});

// ============================================================================
// 3. ROTAS ADMINISTRATIVAS - DASHBOARD, OPERADORES, RESULTADOS POR PROVA
// ============================================================================

// GET /api/iptu/dashboard - Métricas consolidadas filtradas por provaId
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const provaId = Number(req.query.provaId) || 1;
    const data = await getIptuDashboard(provaId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar métricas do painel.' });
  }
});

// GET /api/iptu/operators - Lista operadores com token e status para provaId
router.get('/operators', authMiddleware, async (req, res) => {
  try {
    const { search, status, provaId } = req.query;
    const pid = Number(provaId) || 1;
    const data = await getIptuOperators(search, status, pid);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar operadores.' });
  }
});

// POST /api/iptu/operators - Cadastra novo operador
router.post('/operators', authMiddleware, async (req, res) => {
  try {
    const created = await createIptuOperator(req.body, req.user.username);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// PUT /api/iptu/operators/:id - Edita operador
router.put('/operators/:id', authMiddleware, async (req, res) => {
  try {
    const updated = await updateIptuOperator(req.params.id, req.body, req.user.username);
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// DELETE /api/iptu/operators/:id - Remove operador
router.delete('/operators/:id', authMiddleware, async (req, res) => {
  try {
    await deleteIptuOperator(req.params.id, req.user.username);
    return res.json({ message: 'Operador removido com sucesso.' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/iptu/operators/import - Importa operadores via Excel
router.post('/operators/import', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'A planilha enviada está vazia.' });
    }

    const result = await importIptuOperatorsBulk(data, req.user.username);
    return res.json(result);
  } catch (err) {
    console.error('Import error:', err);
    return res.status(400).json({ error: 'Falha ao processar arquivo Excel.' });
  }
});

// POST /api/iptu/operators/:id/generate-token - Gera token individual para operador e prova
router.post('/operators/:id/generate-token', authMiddleware, async (req, res) => {
  try {
    const provaId = Number(req.body.provaId) || 1;
    const token = await generateTokenForOperator(req.params.id, req.user.username, provaId);
    return res.json(token);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/iptu/operators/generate-all-tokens - Gera tokens em lote para prova
router.post('/operators/generate-all-tokens', authMiddleware, async (req, res) => {
  try {
    const provaId = Number(req.body.provaId) || 1;
    const result = await generateAllTokens(req.user.username, provaId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/iptu/operators/invalidate-token - Invalida token
router.post('/operators/invalidate-token', authMiddleware, async (req, res) => {
  try {
    const { token, id } = req.body;
    await invalidateToken(token || id, req.user.username);
    return res.json({ message: 'Token invalidado com sucesso.' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/iptu/operators/:id/retry - Libera nova tentativa
router.post('/operators/:id/retry', authMiddleware, async (req, res) => {
  try {
    const provaId = Number(req.body.provaId) || 1;
    const newToken = await allowNewAttempt(req.params.id, req.user.username, provaId);
    return res.json(newToken);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/iptu/results - Lista resultados de provas
router.get('/results', authMiddleware, async (req, res) => {
  try {
    const { search, status, resultado, provaId } = req.query;
    const pid = Number(provaId) || 1;
    const data = await getIptuResults(search, status, resultado, pid);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar resultados das avaliações.' });
  }
});

// GET /api/iptu/results/:tentativaId/correction - Gabarito e correção detalhada
router.get('/results/:tentativaId/correction', authMiddleware, async (req, res) => {
  try {
    const correction = await getDetailedCorrection(req.params.tentativaId);
    return res.json(correction);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/iptu/stats/questions - Desempenho por questão
router.get('/stats/questions', authMiddleware, async (req, res) => {
  try {
    const provaId = Number(req.query.provaId) || 1;
    const data = await getQuestionsPerformance(provaId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar estatísticas por questão.' });
  }
});

// GET /api/iptu/stats/difficulty - Desempenho por dificuldade
router.get('/stats/difficulty', authMiddleware, async (req, res) => {
  try {
    const provaId = Number(req.query.provaId) || 1;
    const data = await getDifficultyPerformance(provaId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar estatísticas por nível de dificuldade.' });
  }
});

// GET /api/iptu/settings - Configurações da prova selecionada
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const provaId = Number(req.query.provaId) || 1;
    const config = await getIptuSettings(provaId);
    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar configurações da avaliação.' });
  }
});

// PUT /api/iptu/settings - Atualiza configurações da prova
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const provaId = Number(req.body.id || req.query.provaId) || 1;
    const updated = await updateIptuSettings(req.body, req.user.username, provaId);
    return res.json({ message: 'Configurações da avaliação salvas com sucesso!', config: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/iptu/export/results - Exporta resultados para Excel
router.get('/export/results', authMiddleware, async (req, res) => {
  try {
    const provaId = Number(req.query.provaId) || 1;
    const results = await getIptuResults('', '', '', provaId);
    const config = await getIptuSettings(provaId);

    const exportData = results.map(r => ({
      'Operador': r.nome,
      'Matrícula': r.matricula,
      'Secretaria': config.secretaria || 'Tributos / Impostos',
      'Tentativa': r.numero_tentativa,
      'Status': r.status,
      'Nota (0 a 10)': r.nota !== null ? r.nota : '-',
      'Aproveitamento (%)': r.percentual !== null ? `${r.percentual}%` : '-',
      'Acertos': r.acertos,
      'Erros': r.erros,
      'Resultado': r.resultado === 'aprovado' ? 'Aprovado' : (r.resultado === 'reprovado' ? 'Reprovado' : 'Em andamento'),
      'Finalizada em': r.finalizada_em ? new Date(r.finalizada_em).toLocaleString('pt-BR') : '-'
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(exportData);
    xlsx.utils.book_append_sheet(wb, ws, 'Resultados');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=resultados_${(config.secretaria || 'prova').toLowerCase().replace(/\s+/g, '_')}.xlsx`);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao exportar planilha de resultados.' });
  }
});

module.exports = router;
