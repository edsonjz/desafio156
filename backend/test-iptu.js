const {
  getIptuSettings,
  updateIptuSettings,
  getIptuOperators,
  createIptuOperator,
  importIptuOperatorsBulk,
  generateTokenForOperator,
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
} = require('./src/db/iptuSupabaseService');

const { IPTU_QUESTIONS_DATA } = require('./src/db/iptuSeedData');

async function runTests() {
  console.log('========================================================');
  console.log('🧪 INICIANDO TESTES DO MÓDULO PROVA IPTU');
  console.log('========================================================');

  // Test 1: Questions count & key verification
  console.log('\n--- Teste 1: Banco de 20 Questões Oficiais ---');
  if (IPTU_QUESTIONS_DATA.length !== 20) {
    throw new Error(`Esperado 20 questões, encontrado ${IPTU_QUESTIONS_DATA.length}`);
  }
  const expectedKeys = ['C', 'B', 'B', 'C', 'A', 'B', 'B', 'B', 'A', 'A', 'B', 'B', 'B', 'B', 'A', 'B', 'C', 'B', 'A', 'D'];
  IPTU_QUESTIONS_DATA.forEach((q, idx) => {
    if (q.correta !== expectedKeys[idx]) {
      throw new Error(`Gabarito da questão ${idx + 1} incorreto: ${q.correta} (esperado ${expectedKeys[idx]})`);
    }
  });
  console.log('✅ 20 Questões Oficiais e Gabarito (1-C até 20-D) verificados com sucesso!');

  // Test 2: Create Operator & Generate Token
  console.log('\n--- Teste 2: Cadastro de Operador e Geração de Token ---');
  const testOp = await createIptuOperator({ nome: 'Operador Teste IPTU', matricula: 'OP-TESTE-999' });
  console.log(`✅ Operador criado: ${testOp.nome} | Matrícula: ${testOp.matricula} | Token: ${testOp.token}`);
  if (!testOp.token.startsWith('IPTU-2026-')) {
    throw new Error(`Token inválido: ${testOp.token}`);
  }

  // Test 2.1: Create Operator without Matrícula (Optional Matrícula)
  const testOpSemMat = await createIptuOperator({ nome: 'Operador Apenas Nome' });
  console.log(`✅ Operador sem matrícula criado: ${testOpSemMat.nome} | Matrícula gerada: ${testOpSemMat.matricula} | Token: ${testOpSemMat.token}`);
  if (!testOpSemMat.matricula || !testOpSemMat.matricula.startsWith('OP-')) {
    throw new Error('Falha ao auto-gerar matrícula para operador sem matrícula');
  }

  // Test 3: Public Operator Session
  console.log('\n--- Teste 3: Sessão Pública do Operador (sem gabarito) ---');
  const session = await getOperatorSessionByToken(testOp.token);
  console.log(`✅ Sessão carregada para: ${session.operator.nome}`);
  if (session.questions.length !== 20) {
    throw new Error('Questões não carregadas na sessão pública');
  }
  // Verify that is_correta and justificativa are NOT exposed to operator
  session.questions[0].alternativas.forEach(alt => {
    if (alt.is_correta !== undefined || alt.justificativa !== undefined) {
      throw new Error('GABARITO VAZOU NA SESSÃO DO OPERADOR!');
    }
  });
  console.log('✅ Segurança confirmada: Gabarito e justificativas totalmente ocultos ao operador.');

  // Test 4: Start Exam & Answer Simulation (17 correct, 3 wrong)
  console.log('\n--- Teste 4: Início da Prova e Salvamento de Respostas ---');
  await startExam(testOp.token);
  
  // We answer Q1..Q17 correctly, and Q18..Q20 wrongly (e.g. choose 'A' for Q18, 'B' for Q19, 'A' for Q20)
  for (let i = 1; i <= 17; i++) {
    const correctLetter = expectedKeys[i - 1];
    await saveAnswer({ tokenCode: testOp.token, questaoNumero: i, letra: correctLetter });
  }
  await saveAnswer({ tokenCode: testOp.token, questaoNumero: 18, letra: 'A' }); // wrong
  await saveAnswer({ tokenCode: testOp.token, questaoNumero: 19, letra: 'C' }); // wrong
  await saveAnswer({ tokenCode: testOp.token, questaoNumero: 20, letra: 'A' }); // wrong

  console.log('✅ 20 respostas salvas em tempo real com sucesso.');

  // Test 5: Finish Exam & Auto Grading
  console.log('\n--- Teste 5: Finalização da Prova e Correção Automática ---');
  const result = await finishExam({ tokenCode: testOp.token, tempoGastoSegundos: 450 });
  console.log(`✅ Prova finalizada: Nota=${result.nota} | Percentual=${result.percentual}% | Acertos=${result.acertos} | Erros=${result.erros} | Resultado=${result.resultado}`);

  if (result.acertos !== 17 || result.erros !== 3) {
    throw new Error(`Esperado 17 acertos e 3 erros, obtido: acertos=${result.acertos}, erros=${result.erros}`);
  }
  if (result.nota !== 8.5) {
    throw new Error(`Esperado nota 8.5, obtido ${result.nota}`);
  }
  if (result.percentual !== 85) {
    throw new Error(`Esperado 85%, obtido ${result.percentual}%`);
  }
  if (result.resultado !== 'aprovado') {
    throw new Error(`Esperado aprovado, obtido ${result.resultado}`);
  }
  console.log('✅ Fórmula de nota (17/20)*10 = 8.5 e aprovação >= 70% validadas!');

  // Test 6: Detailed Correction for Supervisor
  console.log('\n--- Teste 6: Correção Detalhada com Justificativas (Supervisor) ---');
  const correction = await getDetailedCorrection(result.id);
  console.log(`✅ Detalhes carregados para tentativa #${correction.attempt.id}`);
  if (correction.correction.length !== 20) {
    throw new Error('Correção não retornou 20 questões');
  }
  const q1 = correction.correction[0];
  console.log(`- Q1: Resposta=${q1.resposta_operador} | Gabarito=${q1.gabarito_oficial} | Status=${q1.status}`);
  console.log(`  Justificativa: ${q1.justificativa.substring(0, 70)}...`);
  if (!q1.is_correta || !q1.justificativa) {
    throw new Error('Correção da Q1 inválida');
  }
  const q18 = correction.correction[17];
  console.log(`- Q18: Resposta=${q18.resposta_operador} | Gabarito=${q18.gabarito_oficial} | Status=${q18.status}`);
  if (q18.is_correta) {
    throw new Error('Q18 deveria ser incorreta');
  }
  console.log('✅ Correção detalhada questão por questão e justificativas verificadas!');

  // Test 7: Dashboard Metrics & Question Ranking
  console.log('\n--- Teste 7: Dashboard e Estatísticas de Questões ---');
  const dashboard = await getIptuDashboard();
  console.log('✅ Métricas do Dashboard:', dashboard.metrics);
  const qPerf = await getQuestionsPerformance();
  console.log(`✅ Estatísticas calculadas para ${qPerf.questions.length} questões.`);
  const diffPerf = await getDifficultyPerformance();
  console.log('✅ Desempenho por Dificuldade:', diffPerf);

  // Test 8: Retry release
  console.log('\n--- Teste 8: Liberação de Nova Tentativa ---');
  const retryToken = await allowNewAttempt(testOp.id, 'Supervisor');
  console.log(`✅ Nova tentativa liberada com novo token: ${retryToken.token}`);
  if (retryToken.token === testOp.token) {
    throw new Error('O novo token gerado deve ser diferente do token anterior');
  }

  console.log('\n========================================================');
  console.log('🎉 TODOS OS TESTES DO MÓDULO PROVA IPTU PASSARAM COM SUCESSO!');
  console.log('========================================================\n');
}

runTests().catch(err => {
  console.error('❌ ERRO NO TESTE:', err);
  process.exit(1);
});
