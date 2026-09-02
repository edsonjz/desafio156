const crypto = require('crypto');
const { supabase } = require('./supabaseDb');
const { logAudit } = require('./supabaseService');
const { IPTU_QUESTIONS_DATA } = require('./iptuSeedData');

// Fallback questions cache if needed
const DEFAULT_QUESTIONS = IPTU_QUESTIONS_DATA.map((q, idx) => ({
  id: idx + 1,
  numero: q.numero,
  enunciado: q.enunciado,
  dificuldade: q.dificuldade,
  ativo: true,
  alternativas: q.alternativas.map((alt, aIdx) => ({
    id: (idx + 1) * 10 + aIdx + 1,
    questao_id: idx + 1,
    letra: alt.letra,
    texto: alt.texto,
    is_correta: alt.letra === q.correta,
    justificativa: alt.letra === q.correta ? q.justificativa : null
  })),
  gabarito_oficial: q.correta,
  justificativa_oficial: q.justificativa
}));

// Helper to generate unique token like 'IPTU-2026-X7K92P'
function generateRandomToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0, O, 1, I for clarity
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    const r = crypto.randomInt(0, chars.length);
    randomPart += chars[r];
  }
  return `IPTU-2026-${randomPart}`;
}

// ============================================================================
// 1. CONFIGURAÇÕES DA PROVA
// ============================================================================
async function getIptuSettings() {
  try {
    const { data, error } = await supabase.from('iptu_configuracoes').select('*').limit(1);
    if (!error && data && data.length > 0) {
      return data[0];
    }
  } catch (err) {
    console.warn('Error reading iptu_configuracoes:', err.message);
  }

  return {
    id: 1,
    nome_prova: 'Avaliação de Conhecimentos — IPTU e TCL Porto Alegre',
    nota_minima_aprovacao: 70.0,
    tempo_maximo_minutos: 30,
    max_tentativas_padrao: 1,
    exibir_resultado_operador: true,
    data_inicio: null,
    data_fim: null
  };
}

async function updateIptuSettings(newConfig, username = 'Admin') {
  const payload = {
    nome_prova: newConfig.nome_prova || 'Avaliação de Conhecimentos — IPTU e TCL Porto Alegre',
    nota_minima_aprovacao: Number(newConfig.nota_minima_aprovacao) || 70.0,
    tempo_maximo_minutos: newConfig.tempo_maximo_minutos !== undefined ? Number(newConfig.tempo_maximo_minutos) : 30,
    max_tentativas_padrao: Number(newConfig.max_tentativas_padrao) || 1,
    exibir_resultado_operador: newConfig.exibir_resultado_operador !== undefined ? !!newConfig.exibir_resultado_operador : true,
    data_inicio: newConfig.data_inicio || null,
    data_fim: newConfig.data_fim || null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('iptu_configuracoes')
    .upsert([{ id: 1, ...payload }])
    .select();

  if (error) {
    console.error('Failed to update iptu_configuracoes in Supabase:', error);
    throw new Error('Falha ao salvar configurações no banco de dados.');
  }

  await logAudit(username, 'UPDATE_CONFIG', 'iptu_configuracoes', '1', null, payload);
  return data[0];
}

// ============================================================================
// 2. OPERADORES DA PROVA & GERAÇÃO DE TOKENS
// ============================================================================
async function getIptuOperators(search = '', status = '') {
  let query = supabase.from('iptu_operadores').select('*').order('nome', { ascending: true });
  if (status) {
    query = query.eq('status', status);
  }

  const { data: ops, error: opErr } = await query;
  if (opErr) {
    console.error('Error fetching iptu_operadores from Supabase:', opErr);
    throw new Error('Erro ao carregar operadores da base de dados.');
  }

  const { data: tokens } = await supabase.from('iptu_tokens').select('*');
  const { data: attempts } = await supabase.from('iptu_tentativas').select('*').order('numero_tentativa', { ascending: false });

  let list = (ops || []).map(op => {
    const opTokens = (tokens || []).filter(t => t.iptu_operador_id === op.id);
    const activeToken = opTokens.find(t => t.status === 'ativo') || opTokens[opTokens.length - 1];
    const opAttempts = (attempts || []).filter(a => a.iptu_operador_id === op.id);
    const latestAttempt = opAttempts[0];

    return {
      id: op.id,
      operador_id: op.operador_id,
      nome: op.nome,
      matricula: op.matricula,
      status: op.status,
      created_at: op.created_at,
      token: activeToken ? activeToken.token : null,
      token_status: activeToken ? activeToken.status : 'sem_token',
      tentativa_status: latestAttempt ? latestAttempt.status : 'nao_iniciada',
      nota: latestAttempt && (latestAttempt.status === 'concluida' || latestAttempt.status === 'expirada_tempo') ? latestAttempt.nota : null,
      percentual: latestAttempt && (latestAttempt.status === 'concluida' || latestAttempt.status === 'expirada_tempo') ? latestAttempt.percentual : null,
      resultado: latestAttempt && (latestAttempt.status === 'concluida' || latestAttempt.status === 'expirada_tempo') ? latestAttempt.resultado : null,
      realizada_em: latestAttempt && latestAttempt.finalizada_em ? latestAttempt.finalizada_em : null,
      total_tentativas: opAttempts.length
    };
  });

  if (search) {
    const s = search.toLowerCase().trim();
    list = list.filter(o => 
      (o.nome && o.nome.toLowerCase().includes(s)) ||
      (o.matricula && o.matricula.toLowerCase().includes(s)) ||
      (o.token && o.token.toLowerCase().includes(s))
    );
  }

  return list;
}

async function createIptuOperator({ nome, matricula, operadorId = null }, username = 'Admin') {
  const nomClean = String(nome || '').trim();
  if (!nomClean) {
    throw new Error('O nome do operador é obrigatório.');
  }

  let matClean = String(matricula || '').trim().toUpperCase();

  // If matricula was not passed, generate unique code
  if (!matClean) {
    const { data: existingAll } = await supabase.from('iptu_operadores').select('matricula');
    const existingSet = new Set((existingAll || []).map(o => (o.matricula || '').toUpperCase()));
    let randNum = Math.floor(10000 + Math.random() * 90000);
    while (existingSet.has(`OP-${randNum}`)) {
      randNum = Math.floor(10000 + Math.random() * 90000);
    }
    matClean = `OP-${randNum}`;
  } else {
    // Check duplicate
    const { data: duplicate } = await supabase.from('iptu_operadores').select('id').eq('matricula', matClean).limit(1);
    if (duplicate && duplicate.length > 0) {
      throw new Error(`Já existe um operador cadastrado com a matrícula ${matClean}.`);
    }
  }

  const { data, error } = await supabase.from('iptu_operadores').insert([{
    nome: nomClean,
    matricula: matClean,
    operador_id: operadorId || null,
    status: 'ativo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }]).select();

  if (error || !data || data.length === 0) {
    console.error('Error inserting iptu_operador in Supabase:', error);
    throw new Error('Falha ao cadastrar operador no Supabase: ' + (error?.message || 'Erro desconhecido'));
  }

  const createdOp = data[0];

  // Auto-generate token for operator
  const tokenRecord = await generateTokenForOperator(createdOp.id, username);

  await logAudit(username, 'CREATE_IPTU_OPERATOR', 'iptu_operadores', String(createdOp.id), null, {
    nome: createdOp.nome,
    matricula: createdOp.matricula,
    token: tokenRecord.token
  });

  return { ...createdOp, token: tokenRecord.token };
}

async function updateIptuOperator(id, { nome, matricula, status }, username = 'Admin') {
  const numId = Number(id);
  const { data: existingList } = await supabase.from('iptu_operadores').select('*').eq('id', numId).limit(1);
  if (!existingList || existingList.length === 0) {
    throw new Error('Operador da prova não encontrado.');
  }
  const op = existingList[0];

  const payload = {
    updated_at: new Date().toISOString()
  };

  if (nome) payload.nome = String(nome).trim();
  if (status) payload.status = status;

  if (matricula) {
    const matClean = String(matricula).trim().toUpperCase();
    const { data: duplicate } = await supabase.from('iptu_operadores').select('id').eq('matricula', matClean).neq('id', numId).limit(1);
    if (duplicate && duplicate.length > 0) {
      throw new Error(`Já existe outro operador com a matrícula ${matClean}.`);
    }
    payload.matricula = matClean;
  }

  const { data, error } = await supabase.from('iptu_operadores').update(payload).eq('id', numId).select();
  if (error) {
    throw new Error('Falha ao atualizar operador: ' + error.message);
  }

  await logAudit(username, 'UPDATE_IPTU_OPERATOR', 'iptu_operadores', String(numId), op, payload);
  return data[0];
}

async function deleteIptuOperator(id, username = 'Admin') {
  const numId = Number(id);
  const { error } = await supabase.from('iptu_operadores').delete().eq('id', numId);
  if (error) {
    throw new Error('Falha ao excluir operador: ' + error.message);
  }

  await logAudit(username, 'DELETE_IPTU_OPERATOR', 'iptu_operadores', String(numId), null, 'Operador e dados da prova excluídos');
  return true;
}

// ============================================================================
// 3. IMPORTAÇÃO DE OPERADORES EM MASSA (EXCEL / CSV)
// ============================================================================
async function importIptuOperatorsBulk(operatorsList, username = 'Admin') {
  if (!Array.isArray(operatorsList) || operatorsList.length === 0) {
    return { importedCount: 0, duplicateCount: 0, errorCount: 0, details: [] };
  }

  const { data: existingList } = await supabase.from('iptu_operadores').select('matricula');
  const existingMatMap = new Set((existingList || []).map(o => (o.matricula || '').toUpperCase()));

  let importedCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
  const details = [];

  for (const item of operatorsList) {
    const nome = (item['Nome'] || item['Nome Completo'] || item['nome'] || item['nome_completo'] || item['OPERADOR'] || '').toString().trim();
    const matricula = (item['Matrícula'] || item['Matricula'] || item['matricula'] || item['MATRICULA'] || item['Registro'] || '').toString().trim().toUpperCase();

    if (!nome) {
      errorCount++;
      details.push({ nome: 'Vazio', matricula: matricula || 'Vazio', status: 'erro', motivo: 'Nome ausente' });
      continue;
    }

    if (matricula && existingMatMap.has(matricula)) {
      duplicateCount++;
      details.push({ nome, matricula, status: 'duplicado', motivo: 'Matrícula já existente' });
      continue;
    }

    try {
      const created = await createIptuOperator({ nome, matricula: matricula || null }, username);
      if (created && created.matricula) existingMatMap.add(created.matricula.toUpperCase());
      importedCount++;
      details.push({ nome, matricula: created.matricula, status: 'importado' });
    } catch (err) {
      errorCount++;
      details.push({ nome, matricula, status: 'erro', motivo: err.message });
    }
  }

  await logAudit(username, 'BULK_IMPORT_IPTU_OPERATORS', 'iptu_operadores', null, null, {
    total: operatorsList.length,
    importedCount,
    duplicateCount,
    errorCount
  });

  return { importedCount, duplicateCount, errorCount, details };
}

// ============================================================================
// 4. GESTÃO DE TOKENS INDIVIDUAIS
// ============================================================================
async function generateTokenForOperator(iptuOperatorId, username = 'Admin') {
  const numOpId = Number(iptuOperatorId);
  const tokenCode = generateRandomToken();

  // Invalidate any previously active token for this operator
  await supabase
    .from('iptu_tokens')
    .update({ status: 'invalidado', updated_at: new Date().toISOString() })
    .eq('iptu_operador_id', numOpId)
    .eq('status', 'ativo');

  const { data, error } = await supabase.from('iptu_tokens').insert([{
    iptu_operador_id: numOpId,
    token: tokenCode,
    status: 'ativo',
    created_by: username,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }]).select();

  if (error || !data || data.length === 0) {
    console.error('Error creating token in Supabase:', error);
    throw new Error('Falha ao gerar token no Supabase: ' + (error?.message || 'Erro'));
  }

  return data[0];
}

async function generateAllTokens(username = 'Admin') {
  const operators = await getIptuOperators();
  let generatedCount = 0;

  for (const op of operators) {
    await generateTokenForOperator(op.id, username);
    generatedCount++;
  }

  await logAudit(username, 'GENERATE_ALL_TOKENS', 'iptu_tokens', null, null, { generatedCount });
  return { generatedCount };
}

async function invalidateToken(tokenIdOrCode, username = 'Admin') {
  let query = supabase.from('iptu_tokens').update({ status: 'invalidado', updated_at: new Date().toISOString() });
  if (typeof tokenIdOrCode === 'number' || !isNaN(Number(tokenIdOrCode))) {
    query = query.eq('id', Number(tokenIdOrCode));
  } else {
    query = query.ilike('token', String(tokenIdOrCode).trim());
  }

  const { error } = await query;
  if (error) {
    throw new Error('Erro ao invalidar token: ' + error.message);
  }

  await logAudit(username, 'INVALIDATE_TOKEN', 'iptu_tokens', String(tokenIdOrCode), null, 'Token invalidado pelo administrador');
  return true;
}

async function allowNewAttempt(iptuOperatorId, username = 'Admin') {
  const numOpId = Number(iptuOperatorId);
  const newToken = await generateTokenForOperator(numOpId, username);

  await logAudit(username, 'ALLOW_NEW_ATTEMPT', 'iptu_operadores', String(numOpId), null, {
    newToken: newToken.token,
    motivo: 'Nova tentativa liberada pelo supervisor'
  });

  return newToken;
}

// ============================================================================
// 5. ÁREA DO OPERADOR — SESSÃO, SALVAMENTO E FINALIZAÇÃO
// ============================================================================
async function getOperatorSessionByToken(tokenCode) {
  const tokenStr = String(tokenCode || '').trim();
  if (!tokenStr) throw new Error('Token de acesso não fornecido.');

  // Find token case-insensitively
  const { data: toks, error: tokErr } = await supabase
    .from('iptu_tokens')
    .select('*')
    .ilike('token', tokenStr)
    .limit(1);

  if (tokErr || !toks || toks.length === 0) {
    throw new Error('Token de avaliação inválido ou não encontrado no sistema.');
  }

  const tokenObj = toks[0];

  const { data: ops, error: opErr } = await supabase
    .from('iptu_operadores')
    .select('*')
    .eq('id', tokenObj.iptu_operador_id)
    .limit(1);

  if (opErr || !ops || ops.length === 0) {
    throw new Error('Operador associado a este token não foi encontrado.');
  }

  const operatorObj = ops[0];

  if (tokenObj.status === 'invalidado') {
    throw new Error('Este token de avaliação foi invalidado pelo supervisor.');
  }

  const config = await getIptuSettings();

  // Find latest attempt for this token or operator
  const { data: atts } = await supabase
    .from('iptu_tentativas')
    .select('*')
    .eq('token_id', tokenObj.id)
    .order('numero_tentativa', { ascending: false })
    .limit(1);

  let attempt = (atts && atts.length > 0) ? atts[0] : null;
  let savedAnswersMap = {};

  if (attempt) {
    const { data: resps } = await supabase.from('iptu_respostas').select('*').eq('tentativa_id', attempt.id);
    (resps || []).forEach(r => {
      savedAnswersMap[r.questao_id] = r.letra_selecionada;
    });
  }

  // Load questions from Supabase or fallback
  let questionsData = [];
  const { data: dbQuestions } = await supabase.from('iptu_questoes').select('*').order('numero', { ascending: true });
  const { data: dbAlts } = await supabase.from('iptu_alternativas').select('*').order('letra', { ascending: true });

  if (dbQuestions && dbQuestions.length === 20 && dbAlts && dbAlts.length >= 80) {
    questionsData = dbQuestions.map(q => ({
      id: q.id,
      numero: q.numero,
      enunciado: q.enunciado,
      dificuldade: q.dificuldade,
      alternativas: dbAlts.filter(a => a.questao_id === q.id).map(alt => ({
        id: alt.id,
        letra: alt.letra,
        texto: alt.texto
      }))
    }));
  } else {
    // Sanitize default questions
    questionsData = DEFAULT_QUESTIONS.map(q => ({
      id: q.id,
      numero: q.numero,
      enunciado: q.enunciado,
      dificuldade: q.dificuldade,
      alternativas: q.alternativas.map(alt => ({
        id: alt.id,
        letra: alt.letra,
        texto: alt.texto
      }))
    }));
  }

  return {
    token: tokenObj.token,
    token_status: tokenObj.status,
    operator: {
      id: operatorObj.id,
      nome: operatorObj.nome,
      matricula: operatorObj.matricula
    },
    config: {
      nome_prova: config.nome_prova,
      tempo_maximo_minutos: config.tempo_maximo_minutos,
      nota_minima_aprovacao: config.nota_minima_aprovacao,
      exibir_resultado_operador: config.exibir_resultado_operador
    },
    attempt: attempt ? {
      id: attempt.id,
      numero_tentativa: attempt.numero_tentativa,
      status: attempt.status,
      iniciada_em: attempt.iniciada_em,
      finalizada_em: attempt.finalizada_em,
      tempo_gasto_segundos: attempt.tempo_gasto_segundos,
      nota: (attempt.status === 'concluida' || attempt.status === 'expirada_tempo') ? attempt.nota : null,
      percentual: (attempt.status === 'concluida' || attempt.status === 'expirada_tempo') ? attempt.percentual : null,
      acertos: (attempt.status === 'concluida' || attempt.status === 'expirada_tempo') ? attempt.acertos : null,
      erros: (attempt.status === 'concluida' || attempt.status === 'expirada_tempo') ? attempt.erros : null,
      resultado: (attempt.status === 'concluida' || attempt.status === 'expirada_tempo') ? attempt.resultado : null
    } : null,
    savedAnswers: savedAnswersMap,
    questions: questionsData
  };
}

async function startExam(tokenCode) {
  const session = await getOperatorSessionByToken(tokenCode);

  if (session.attempt && (session.attempt.status === 'concluida' || session.attempt.status === 'expirada_tempo')) {
    throw new Error('Esta prova já foi finalizada e não permite novas respostas.');
  }

  if (session.attempt && session.attempt.status === 'em_andamento') {
    return session.attempt;
  }

  // Count past attempts
  const { data: pastAttempts } = await supabase
    .from('iptu_tentativas')
    .select('id')
    .eq('iptu_operador_id', session.operator.id);

  const nextAttemptNum = (pastAttempts ? pastAttempts.length : 0) + 1;

  // Get token record id
  const { data: tokData } = await supabase
    .from('iptu_tokens')
    .select('id')
    .ilike('token', tokenCode.trim())
    .limit(1);

  const tokenId = tokData && tokData[0] ? tokData[0].id : null;

  const { data, error } = await supabase.from('iptu_tentativas').insert([{
    iptu_operador_id: session.operator.id,
    token_id: tokenId,
    numero_tentativa: nextAttemptNum,
    status: 'em_andamento',
    iniciada_em: new Date().toISOString(),
    total_questoes: 20,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }]).select();

  if (error || !data || data.length === 0) {
    console.error('Error starting attempt in Supabase:', error);
    throw new Error('Erro ao iniciar tentativa de prova: ' + (error?.message || 'Erro'));
  }

  return data[0];
}

async function saveAnswer({ tokenCode, questaoNumero, letra }) {
  const session = await getOperatorSessionByToken(tokenCode);
  if (!session.attempt || session.attempt.status !== 'em_andamento') {
    throw new Error('Tentativa de prova não está em andamento para salvar respostas.');
  }

  const questaoNum = Number(questaoNumero);
  const letraUpper = String(letra || '').toUpperCase().trim();

  // Find questao in Supabase or fallback
  const { data: qList } = await supabase.from('iptu_questoes').select('id, numero').eq('numero', questaoNum).limit(1);
  const qId = (qList && qList[0]) ? qList[0].id : questaoNum;

  // Find alternative
  const { data: altList } = await supabase
    .from('iptu_alternativas')
    .select('id, letra, is_correta')
    .eq('questao_id', qId)
    .eq('letra', letraUpper)
    .limit(1);

  const altId = (altList && altList[0]) ? altList[0].id : null;
  const isCorreta = (altList && altList[0]) ? !!altList[0].is_correta : (DEFAULT_QUESTIONS.find(q => q.numero === questaoNum)?.gabarito_oficial === letraUpper);

  const { error } = await supabase.from('iptu_respostas').upsert([{
    tentativa_id: session.attempt.id,
    questao_id: qId,
    alternativa_selecionada_id: altId,
    letra_selecionada: letraUpper,
    is_correta: isCorreta,
    respondida_em: new Date().toISOString()
  }], { onConflict: 'tentativa_id,questao_id' });

  if (error) {
    console.error('Error saving answer to Supabase:', error);
    throw new Error('Falha ao registrar resposta: ' + error.message);
  }

  return { success: true, questaoNumero: questaoNum, letra: letraUpper };
}

async function finishExam({ tokenCode, tempoGastoSegundos = 0, timedOut = false }) {
  const session = await getOperatorSessionByToken(tokenCode);
  if (!session.attempt) {
    throw new Error('Tentativa não encontrada para finalização.');
  }

  if (session.attempt.status === 'concluida' || session.attempt.status === 'expirada_tempo') {
    return session.attempt;
  }

  // Fetch all saved answers and correct against official answer key
  const { data: allAnswers } = await supabase
    .from('iptu_respostas')
    .select('questao_id, letra_selecionada, iptu_questoes(numero)')
    .eq('tentativa_id', session.attempt.id);

  const { data: dbQuestions } = await supabase.from('iptu_questoes').select('id, numero');
  const { data: dbAlts } = await supabase.from('iptu_alternativas').select('questao_id, letra, is_correta').eq('is_correta', true);

  const correctKeyMap = {};
  (dbAlts || []).forEach(a => { correctKeyMap[a.questao_id] = a.letra; });

  // Map answers
  const ansMap = {};
  (allAnswers || []).forEach(r => {
    ansMap[r.questao_id] = r.letra_selecionada;
  });

  let acertos = 0;
  if (dbQuestions && dbQuestions.length === 20) {
    dbQuestions.forEach(q => {
      const chosen = ansMap[q.id];
      const correct = correctKeyMap[q.id];
      if (chosen && correct && chosen.toUpperCase() === correct.toUpperCase()) {
        acertos++;
      }
    });
  } else {
    // Fallback comparison
    DEFAULT_QUESTIONS.forEach(q => {
      const chosen = ansMap[q.id] || ansMap[q.numero];
      if (chosen && chosen.toUpperCase() === q.gabarito_oficial.toUpperCase()) {
        acertos++;
      }
    });
  }

  const totalQuestoes = 20;
  const erros = totalQuestoes - acertos;
  const nota = Number(((acertos / totalQuestoes) * 10).toFixed(2));
  const percentual = Number(((acertos / totalQuestoes) * 100).toFixed(2));
  const notaMinima = session.config.nota_minima_aprovacao || 70.0;
  const resultado = percentual >= notaMinima ? 'aprovado' : 'reprovado';

  const finishPayload = {
    status: timedOut ? 'expirada_tempo' : 'concluida',
    finalizada_em: new Date().toISOString(),
    tempo_gasto_segundos: Number(tempoGastoSegundos) || 0,
    total_questoes: totalQuestoes,
    acertos,
    erros,
    nota,
    percentual,
    resultado,
    updated_at: new Date().toISOString()
  };

  const { error: updErr } = await supabase.from('iptu_tentativas').update(finishPayload).eq('id', session.attempt.id);
  if (updErr) {
    console.error('Error updating attempt status:', updErr);
  }

  await supabase.from('iptu_tokens').update({ status: 'utilizado', updated_at: new Date().toISOString() }).ilike('token', tokenCode.trim());

  return {
    id: session.attempt.id,
    operador: session.operator.nome,
    matricula: session.operator.matricula,
    ...finishPayload
  };
}

// ============================================================================
// 6. PAINEL ADMINISTRATIVO — DASHBOARD, CORREÇÃO, ESTATÍSTICAS & EXPORTAÇÃO
// ============================================================================
async function getIptuDashboard() {
  const operators = await getIptuOperators();
  const config = await getIptuSettings();

  const totalOperadores = operators.length;
  let naoIniciadas = 0;
  let emAndamento = 0;
  let concluidas = 0;
  let aprovadas = 0;
  let reprovadas = 0;
  let somaNotas = 0;
  let somaPercentuais = 0;

  operators.forEach(op => {
    if (op.tentativa_status === 'nao_iniciada') {
      naoIniciadas++;
    } else if (op.tentativa_status === 'em_andamento') {
      emAndamento++;
    } else if (op.tentativa_status === 'concluida' || op.tentativa_status === 'expirada_tempo') {
      concluidas++;
      if (op.resultado === 'aprovado') aprovadas++;
      if (op.resultado === 'reprovado') reprovadas++;
      somaNotas += Number(op.nota || 0);
      somaPercentuais += Number(op.percentual || 0);
    }
  });

  const mediaGeral = concluidas > 0 ? Number((somaNotas / concluidas).toFixed(2)) : 0;
  const aproveitamentoMedio = concluidas > 0 ? Number((somaPercentuais / concluidas).toFixed(1)) : 0;

  const statusPieData = [
    { name: 'Aprovados', value: aprovadas, color: '#10b981' },
    { name: 'Reprovados', value: reprovadas, color: '#ef4444' },
    { name: 'Em Andamento', value: emAndamento, color: '#f59e0b' },
    { name: 'Não Iniciadas', value: naoIniciadas, color: '#64748b' }
  ];

  return {
    metrics: {
      totalOperadores,
      naoIniciadas,
      emAndamento,
      concluidas,
      aprovadas,
      reprovadas,
      mediaGeral,
      aproveitamentoMedio,
      taxaAprovacao: concluidas > 0 ? Number(((aprovadas / concluidas) * 100).toFixed(1)) : 0
    },
    statusPieData,
    config
  };
}

async function getIptuResults(search = '', status = '', resultado = '') {
  const { data: attempts, error } = await supabase
    .from('iptu_tentativas')
    .select('*, iptu_operadores(id, nome, matricula)')
    .order('finalizada_em', { ascending: false });

  if (error) {
    console.error('Error fetching iptu_results:', error);
    return [];
  }

  let results = (attempts || []).map(att => ({
    tentativa_id: att.id,
    operador_id: att.iptu_operador_id,
    nome: att.iptu_operadores ? att.iptu_operadores.nome : 'Operador',
    matricula: att.iptu_operadores ? att.iptu_operadores.matricula : '-',
    numero_tentativa: att.numero_tentativa,
    status: att.status,
    iniciada_em: att.iniciada_em,
    finalizada_em: att.finalizada_em,
    tempo_gasto_segundos: att.tempo_gasto_segundos,
    acertos: att.acertos || 0,
    erros: att.erros || 0,
    nota: att.nota !== null && att.nota !== undefined ? att.nota : null,
    percentual: att.percentual !== null && att.percentual !== undefined ? att.percentual : null,
    resultado: att.resultado || 'em_andamento'
  }));

  if (search) {
    const s = search.toLowerCase().trim();
    results = results.filter(r => r.nome.toLowerCase().includes(s) || r.matricula.toLowerCase().includes(s));
  }

  if (resultado) {
    results = results.filter(r => r.resultado === resultado);
  }

  return results;
}

async function getDetailedCorrection(tentativaId) {
  const numTentativaId = Number(tentativaId);

  const { data: attList } = await supabase
    .from('iptu_tentativas')
    .select('*, iptu_operadores(id, nome, matricula)')
    .eq('id', numTentativaId)
    .limit(1);

  if (!attList || attList.length === 0) {
    throw new Error('Tentativa de prova não encontrada.');
  }

  const attempt = attList[0];
  const operator = attempt.iptu_operadores || { nome: 'Operador', matricula: '-' };

  // Fetch answers
  const { data: answers } = await supabase.from('iptu_respostas').select('*').eq('tentativa_id', numTentativaId);
  const ansMap = {};
  (answers || []).forEach(r => { ansMap[r.questao_id] = r.letra_selecionada; });

  // Fetch questions
  const { data: dbQuestions } = await supabase.from('iptu_questoes').select('*').order('numero', { ascending: true });
  const { data: dbAlts } = await supabase.from('iptu_alternativas').select('*').order('letra', { ascending: true });

  const questionsList = (dbQuestions && dbQuestions.length === 20) ? dbQuestions : DEFAULT_QUESTIONS;

  const correctionDetails = questionsList.map(q => {
    const qAlts = (dbAlts && dbAlts.length > 0) ? dbAlts.filter(a => a.questao_id === q.id) : (q.alternativas || []);
    const correctAlt = qAlts.find(a => a.is_correta) || qAlts.find(a => a.letra === (q.gabarito_oficial || 'A'));
    const gabarito = correctAlt ? correctAlt.letra : (q.gabarito_oficial || 'C');
    const respostaOperador = ansMap[q.id] || null;
    const isCorreta = respostaOperador ? respostaOperador.toUpperCase() === gabarito.toUpperCase() : false;
    const justificativa = (correctAlt && correctAlt.justificativa) || q.justificativa_oficial || '';

    return {
      numero: q.numero,
      enunciado: q.enunciado,
      dificuldade: q.dificuldade,
      alternativas: qAlts.map(a => ({
        letra: a.letra,
        texto: a.texto,
        is_correta: a.letra === gabarito
      })),
      resposta_operador: respostaOperador,
      gabarito_oficial: gabarito,
      status: isCorreta ? 'CORRETA' : 'INCORRETA',
      is_correta: isCorreta,
      justificativa
    };
  });

  return {
    attempt: {
      id: attempt.id,
      operador: operator.nome,
      matricula: operator.matricula,
      numero_tentativa: attempt.numero_tentativa,
      iniciada_em: attempt.iniciada_em,
      finalizada_em: attempt.finalizada_em,
      tempo_gasto_segundos: attempt.tempo_gasto_segundos,
      acertos: attempt.acertos,
      erros: attempt.erros,
      nota: attempt.nota,
      percentual: attempt.percentual,
      resultado: attempt.resultado
    },
    correction: correctionDetails
  };
}

async function getQuestionsPerformance() {
  const { data: dbQuestions } = await supabase.from('iptu_questoes').select('*').order('numero', { ascending: true });
  const { data: dbAlts } = await supabase.from('iptu_alternativas').select('*').eq('is_correta', true);
  const { data: allAnswers } = await supabase.from('iptu_respostas').select('questao_id, letra_selecionada, is_correta');

  const correctKeyMap = {};
  (dbAlts || []).forEach(a => { correctKeyMap[a.questao_id] = a.letra; });

  const questionsList = (dbQuestions && dbQuestions.length === 20) ? dbQuestions : DEFAULT_QUESTIONS;

  const stats = questionsList.map(q => {
    const qAnswers = (allAnswers || []).filter(r => r.questao_id === q.id);
    const total = qAnswers.length;
    let acertos = 0;
    const gabarito = correctKeyMap[q.id] || q.gabarito_oficial || 'C';

    qAnswers.forEach(ans => {
      if (ans.is_correta || (ans.letra_selecionada && ans.letra_selecionada.toUpperCase() === gabarito.toUpperCase())) {
        acertos++;
      }
    });

    const erros = total - acertos;
    const percentualAcerto = total > 0 ? Number(((acertos / total) * 100).toFixed(1)) : 0;
    const percentualErro = total > 0 ? Number(((erros / total) * 100).toFixed(1)) : 0;

    return {
      numero: q.numero,
      dificuldade: q.dificuldade,
      enunciado: q.enunciado,
      gabarito,
      total_respostas: total,
      acertos,
      erros,
      percentual_acerto: percentualAcerto,
      percentual_erro: percentualErro
    };
  });

  const rankingErros = [...stats].sort((a, b) => b.percentual_erro - a.percentual_erro);

  return {
    questions: stats,
    rankingErros
  };
}

async function getDifficultyPerformance() {
  const { questions } = await getQuestionsPerformance();

  const groups = {
    facil: { nome: 'Fácil (Questões 1–10)', totalQuestoes: 10, totalRespostas: 0, acertos: 0, percentual: 0 },
    medio: { nome: 'Médio (Questões 11–15)', totalQuestoes: 5, totalRespostas: 0, acertos: 0, percentual: 0 },
    dificil: { nome: 'Difícil (Questões 16–20)', totalQuestoes: 5, totalRespostas: 0, acertos: 0, percentual: 0 }
  };

  questions.forEach(q => {
    if (groups[q.dificuldade]) {
      groups[q.dificuldade].totalRespostas += q.total_respostas;
      groups[q.dificuldade].acertos += q.acertos;
    }
  });

  Object.keys(groups).forEach(k => {
    const g = groups[k];
    g.percentual = g.totalRespostas > 0 ? Number(((g.acertos / g.totalRespostas) * 100).toFixed(1)) : 0;
  });

  return groups;
}

module.exports = {
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
};
