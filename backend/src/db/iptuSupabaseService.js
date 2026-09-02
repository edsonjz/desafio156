const crypto = require('crypto');
const { supabase } = require('./supabaseDb');
const { logAudit } = require('./supabaseService');
const { IPTU_QUESTIONS_DATA } = require('./iptuSeedData');

// Local in-memory / PureJS fallback store if Supabase tables are being provisioned
const localIptuStore = {
  config: {
    id: 1,
    nome_prova: 'Avaliação de Conhecimentos — IPTU e TCL Porto Alegre',
    nota_minima_aprovacao: 70.0, // 70%
    tempo_maximo_minutos: 30, // 30 min (0 = desativado)
    max_tentativas_padrao: 1,
    exibir_resultado_operador: true,
    data_inicio: null,
    data_fim: null,
    updated_at: new Date().toISOString()
  },
  questions: IPTU_QUESTIONS_DATA.map((q, idx) => ({
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
  })),
  operadores: [],
  tokens: [],
  tentativas: [],
  respostas: []
};

// Auto-increment helpers for local fallback
let nextOpId = 1;
let nextTokenId = 1;
let nextTentativaId = 1;
let nextRespostaId = 1;

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
    // Fallback to local store
  }
  return localIptuStore.config;
}

async function updateIptuSettings(newConfig, username = 'Admin') {
  const payload = {
    nome_prova: newConfig.nome_prova || localIptuStore.config.nome_prova,
    nota_minima_aprovacao: Number(newConfig.nota_minima_aprovacao) || 70.0,
    tempo_maximo_minutos: newConfig.tempo_maximo_minutos !== undefined ? Number(newConfig.tempo_maximo_minutos) : 30,
    max_tentativas_padrao: Number(newConfig.max_tentativas_padrao) || 1,
    exibir_resultado_operador: newConfig.exibir_resultado_operador !== undefined ? !!newConfig.exibir_resultado_operador : true,
    data_inicio: newConfig.data_inicio || null,
    data_fim: newConfig.data_fim || null,
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('iptu_configuracoes')
      .upsert([{ id: 1, ...payload }])
      .select();
    if (!error && data && data.length > 0) {
      localIptuStore.config = data[0];
      await logAudit(username, 'UPDATE_CONFIG', 'iptu_configuracoes', '1', null, payload);
      return data[0];
    }
  } catch (err) {
    console.warn('Supabase iptu_configuracoes update error, using fallback:', err.message);
  }

  localIptuStore.config = { ...localIptuStore.config, ...payload };
  await logAudit(username, 'UPDATE_CONFIG', 'iptu_configuracoes', '1', null, payload);
  return localIptuStore.config;
}

// ============================================================================
// 2. OPERADORES DA PROVA & GERAÇÃO DE TOKENS
// ============================================================================
async function getIptuOperators(search = '', status = '') {
  let list = [];

  try {
    const { data: ops, error } = await supabase.from('iptu_operadores').select('*').order('nome', { ascending: true });
    if (!error && ops) {
      // Get tokens and latest attempts for each
      const { data: tokens } = await supabase.from('iptu_tokens').select('*');
      const { data: attempts } = await supabase.from('iptu_tentativas').select('*').order('numero_tentativa', { ascending: false });

      list = ops.map(op => {
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
          nota: latestAttempt && latestAttempt.status === 'concluida' ? latestAttempt.nota : null,
          percentual: latestAttempt && latestAttempt.status === 'concluida' ? latestAttempt.percentual : null,
          resultado: latestAttempt && latestAttempt.status === 'concluida' ? latestAttempt.resultado : null,
          realizada_em: latestAttempt && latestAttempt.finalizada_em ? latestAttempt.finalizada_em : null,
          total_tentativas: opAttempts.length
        };
      });
    } else {
      throw new Error(error?.message || 'Supabase iptu_operadores not available');
    }
  } catch (err) {
    // Local store fallback
    list = localIptuStore.operadores.map(op => {
      const opTokens = localIptuStore.tokens.filter(t => t.iptu_operador_id === op.id);
      const activeToken = opTokens.find(t => t.status === 'ativo') || opTokens[opTokens.length - 1];
      const opAttempts = localIptuStore.tentativas.filter(a => a.iptu_operador_id === op.id);
      const latestAttempt = opAttempts[opAttempts.length - 1];

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
        nota: latestAttempt && latestAttempt.status === 'concluida' ? latestAttempt.nota : null,
        percentual: latestAttempt && latestAttempt.status === 'concluida' ? latestAttempt.percentual : null,
        resultado: latestAttempt && latestAttempt.status === 'concluida' ? latestAttempt.resultado : null,
        realizada_em: latestAttempt && latestAttempt.finalizada_em ? latestAttempt.finalizada_em : null,
        total_tentativas: opAttempts.length
      };
    });
  }

  if (status) {
    list = list.filter(o => o.status === status);
  }

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

  const existingList = await getIptuOperators();
  let matClean = String(matricula || '').trim().toUpperCase();

  // Se não informou matrícula, gerar automaticamente código único
  if (!matClean) {
    let randomNum = Math.floor(10000 + Math.random() * 90000);
    while (existingList.some(o => o.matricula === `OP-${randomNum}`)) {
      randomNum = Math.floor(10000 + Math.random() * 90000);
    }
    matClean = `OP-${randomNum}`;
  } else {
    // Se informou matrícula, verificar duplicidade
    const duplicate = existingList.find(o => o.matricula.toUpperCase() === matClean);
    if (duplicate) {
      throw new Error(`Já existe um operador cadastrado com a matrícula ${matClean}.`);
    }
  }

  let createdOp = null;
  try {
    const { data, error } = await supabase.from('iptu_operadores').insert([{
      nome: nomClean,
      matricula: matClean,
      operador_id: operadorId || null,
      status: 'ativo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]).select();

    if (!error && data && data.length > 0) {
      createdOp = data[0];
    }
  } catch (err) {
    console.warn('Supabase create iptu_operadores error, using local fallback:', err.message);
  }

  if (!createdOp) {
    createdOp = {
      id: nextOpId++,
      operador_id: operadorId || null,
      nome: nomClean,
      matricula: matClean,
      status: 'ativo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    localIptuStore.operadores.push(createdOp);
  }

  // Auto-generate active token for operator
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
  const existingList = await getIptuOperators();
  const op = existingList.find(o => o.id === numId);
  if (!op) throw new Error('Operador da prova não encontrado.');

  if (matricula) {
    const matClean = String(matricula).trim().toUpperCase();
    const duplicate = existingList.find(o => o.id !== numId && o.matricula.toUpperCase() === matClean);
    if (duplicate) throw new Error(`Já existe outro operador com a matrícula ${matClean}.`);
  }

  const payload = {
    updated_at: new Date().toISOString()
  };
  if (nome) payload.nome = String(nome).trim();
  if (matricula) payload.matricula = String(matricula).trim().toUpperCase();
  if (status) payload.status = status;

  try {
    const { data, error } = await supabase.from('iptu_operadores').update(payload).eq('id', numId).select();
    if (!error && data && data.length > 0) {
      await logAudit(username, 'UPDATE_IPTU_OPERATOR', 'iptu_operadores', String(numId), op, payload);
      return data[0];
    }
  } catch (err) {
    console.warn('Supabase update iptu_operadores error, using local fallback');
  }

  const localIdx = localIptuStore.operadores.findIndex(o => o.id === numId);
  if (localIdx >= 0) {
    localIptuStore.operadores[localIdx] = { ...localIptuStore.operadores[localIdx], ...payload };
    await logAudit(username, 'UPDATE_IPTU_OPERATOR', 'iptu_operadores', String(numId), op, payload);
    return localIptuStore.operadores[localIdx];
  }

  return { ...op, ...payload };
}

async function deleteIptuOperator(id, username = 'Admin') {
  const numId = Number(id);
  try {
    await supabase.from('iptu_operadores').delete().eq('id', numId);
  } catch (err) {
    console.warn('Supabase delete iptu_operadores error, deleting local');
  }

  localIptuStore.operadores = localIptuStore.operadores.filter(o => o.id !== numId);
  localIptuStore.tokens = localIptuStore.tokens.filter(t => t.iptu_operador_id !== numId);
  localIptuStore.tentativas = localIptuStore.tentativas.filter(t => t.iptu_operador_id !== numId);

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

  const existingList = await getIptuOperators();
  const existingMatMap = new Set(existingList.map(o => o.matricula.toUpperCase()));

  let importedCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
  const details = [];

  for (const item of operatorsList) {
    // Flexible column resolution
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
      if (created && created.matricula) existingMatMap.add(created.matricula);
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
  try {
    await supabase.from('iptu_tokens').update({ status: 'invalidado', updated_at: new Date().toISOString() }).eq('iptu_operador_id', numOpId).eq('status', 'ativo');
    const { data } = await supabase.from('iptu_tokens').insert([{
      iptu_operador_id: numOpId,
      token: tokenCode,
      status: 'ativo',
      created_by: username,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]).select();

    if (data && data.length > 0) return data[0];
  } catch (err) {
    console.warn('Supabase token insert error, saving local token:', err.message);
  }

  // Local fallback
  localIptuStore.tokens.forEach(t => {
    if (t.iptu_operador_id === numOpId && t.status === 'ativo') {
      t.status = 'invalidado';
      t.updated_at = new Date().toISOString();
    }
  });

  const newTok = {
    id: nextTokenId++,
    iptu_operador_id: numOpId,
    token: tokenCode,
    status: 'ativo',
    created_by: username,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  localIptuStore.tokens.push(newTok);
  return newTok;
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
  try {
    let query = supabase.from('iptu_tokens').update({ status: 'invalidado', updated_at: new Date().toISOString() });
    if (typeof tokenIdOrCode === 'number' || !isNaN(Number(tokenIdOrCode))) {
      query = query.eq('id', Number(tokenIdOrCode));
    } else {
      query = query.eq('token', tokenIdOrCode);
    }
    await query;
  } catch (err) {
    console.warn('Supabase invalidate token error, updating local:', err.message);
  }

  localIptuStore.tokens.forEach(t => {
    if (t.id === Number(tokenIdOrCode) || t.token === tokenIdOrCode) {
      t.status = 'invalidado';
      t.updated_at = new Date().toISOString();
    }
  });

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

  // Find token
  let tokenObj = null;
  let operatorObj = null;

  try {
    const { data: toks } = await supabase.from('iptu_tokens').select('*').eq('token', tokenStr).limit(1);
    if (toks && toks.length > 0) {
      tokenObj = toks[0];
      const { data: ops } = await supabase.from('iptu_operadores').select('*').eq('id', tokenObj.iptu_operador_id).limit(1);
      if (ops && ops.length > 0) operatorObj = ops[0];
    }
  } catch (err) {
    console.warn('Supabase session token query error, checking local store:', err.message);
  }

  if (!tokenObj) {
    tokenObj = localIptuStore.tokens.find(t => t.token.toUpperCase() === tokenStr.toUpperCase());
    if (tokenObj) {
      operatorObj = localIptuStore.operadores.find(o => o.id === tokenObj.iptu_operador_id);
    }
  }

  if (!tokenObj || !operatorObj) {
    throw new Error('Token de avaliação inválido ou não encontrado.');
  }

  if (tokenObj.status === 'invalidado') {
    throw new Error('Este token de avaliação foi invalidado pelo supervisor.');
  }

  const config = await getIptuSettings();

  // Find latest attempt for this token
  let attempt = null;
  let savedAnswersMap = {};

  try {
    const { data: atts } = await supabase.from('iptu_tentativas').select('*').eq('token_id', tokenObj.id).order('numero_tentativa', { ascending: false }).limit(1);
    if (atts && atts.length > 0) {
      attempt = atts[0];
      const { data: resps } = await supabase.from('iptu_respostas').select('*').eq('tentativa_id', attempt.id);
      (resps || []).forEach(r => {
        savedAnswersMap[r.questao_id] = r.letra_selecionada;
      });
    }
  } catch (err) {
    // Local fallback
  }

  if (!attempt) {
    attempt = localIptuStore.tentativas.find(a => a.token_id === tokenObj.id);
    if (attempt) {
      localIptuStore.respostas.filter(r => r.tentativa_id === attempt.id).forEach(r => {
        savedAnswersMap[r.questao_id] = r.letra_selecionada;
      });
    }
  }

  // Sanitize questions: strip `is_correta` and `justificativa` for the operator!
  const sanitizedQuestions = localIptuStore.questions.map(q => ({
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
      nota: attempt.status === 'concluida' ? attempt.nota : null,
      percentual: attempt.status === 'concluida' ? attempt.percentual : null,
      acertos: attempt.status === 'concluida' ? attempt.acertos : null,
      erros: attempt.status === 'concluida' ? attempt.erros : null,
      resultado: attempt.status === 'concluida' ? attempt.resultado : null
    } : null,
    savedAnswers: savedAnswersMap,
    questions: sanitizedQuestions
  };
}

async function startExam(tokenCode) {
  const session = await getOperatorSessionByToken(tokenCode);

  if (session.attempt && session.attempt.status === 'concluida') {
    throw new Error('Esta prova já foi finalizada e não permite novas respostas.');
  }

  if (session.attempt && session.attempt.status === 'em_andamento') {
    return session.attempt;
  }

  // Count past attempts for operator
  const pastAttempts = localIptuStore.tentativas.filter(a => a.iptu_operador_id === session.operator.id);
  const nextAttemptNum = pastAttempts.length + 1;

  const attemptPayload = {
    iptu_operador_id: session.operator.id,
    numero_tentativa: nextAttemptNum,
    status: 'em_andamento',
    iniciada_em: new Date().toISOString(),
    total_questoes: 20,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  let createdAttempt = null;
  try {
    // Find token id
    const { data: tokList } = await supabase.from('iptu_tokens').select('id').eq('token', tokenCode).limit(1);
    if (tokList && tokList[0]) {
      const { data, error } = await supabase.from('iptu_tentativas').insert([{
        ...attemptPayload,
        token_id: tokList[0].id
      }]).select();
      if (!error && data && data.length > 0) {
        createdAttempt = data[0];
      }
    }
  } catch (err) {
    console.warn('Supabase startExam insert error, fallback local');
  }

  if (!createdAttempt) {
    const tok = localIptuStore.tokens.find(t => t.token === tokenCode);
    createdAttempt = {
      id: nextTentativaId++,
      token_id: tok ? tok.id : 1,
      ...attemptPayload
    };
    localIptuStore.tentativas.push(createdAttempt);
  }

  return createdAttempt;
}

async function saveAnswer({ tokenCode, questaoNumero, letra }) {
  const session = await getOperatorSessionByToken(tokenCode);
  if (!session.attempt || session.attempt.status !== 'em_andamento') {
    throw new Error('Tentativa de prova não está em andamento para salvar respostas.');
  }

  const questao = localIptuStore.questions.find(q => q.numero === Number(questaoNumero));
  if (!questao) throw new Error(`Questão número ${questaoNumero} não encontrada.`);

  const letraUpper = String(letra || '').toUpperCase().trim();
  const alternativa = questao.alternativas.find(a => a.letra === letraUpper);
  if (!alternativa) throw new Error(`Alternativa inválida: ${letra}`);

  const isCorreta = letraUpper === questao.gabarito_oficial;

  try {
    // Supabase upsert on (tentativa_id, questao_id)
    await supabase.from('iptu_respostas').upsert([{
      tentativa_id: session.attempt.id,
      questao_id: questao.id,
      alternativa_selecionada_id: alternativa.id,
      letra_selecionada: letraUpper,
      is_correta: isCorreta,
      respondida_em: new Date().toISOString()
    }], { onConflict: 'tentativa_id,questao_id' });
  } catch (err) {
    console.warn('Supabase saveAnswer error, updating local:', err.message);
  }

  // Local fallback
  const existingIdx = localIptuStore.respostas.findIndex(r => r.tentativa_id === session.attempt.id && r.questao_id === questao.id);
  if (existingIdx >= 0) {
    localIptuStore.respostas[existingIdx].letra_selecionada = letraUpper;
    localIptuStore.respostas[existingIdx].alternativa_selecionada_id = alternativa.id;
    localIptuStore.respostas[existingIdx].is_correta = isCorreta;
    localIptuStore.respostas[existingIdx].respondida_em = new Date().toISOString();
  } else {
    localIptuStore.respostas.push({
      id: nextRespostaId++,
      tentativa_id: session.attempt.id,
      questao_id: questao.id,
      alternativa_selecionada_id: alternativa.id,
      letra_selecionada: letraUpper,
      is_correta: isCorreta,
      respondida_em: new Date().toISOString()
    });
  }

  return { success: true, questaoNumero, letra: letraUpper };
}

async function finishExam({ tokenCode, tempoGastoSegundos = 0, timedOut = false }) {
  const session = await getOperatorSessionByToken(tokenCode);
  if (!session.attempt) {
    throw new Error('Tentativa não encontrada para finalização.');
  }

  if (session.attempt.status === 'concluida') {
    return session.attempt;
  }

  // Fetch all saved answers for this attempt
  let allAnswers = [];
  try {
    const { data } = await supabase.from('iptu_respostas').select('*').eq('tentativa_id', session.attempt.id);
    if (data && data.length > 0) allAnswers = data;
  } catch (err) {}

  if (allAnswers.length === 0) {
    allAnswers = localIptuStore.respostas.filter(r => r.tentativa_id === session.attempt.id);
  }

  const ansMap = {};
  allAnswers.forEach(r => { ansMap[r.questao_id] = r.letra_selecionada; });

  // Correct against 20 questions
  let acertos = 0;
  localIptuStore.questions.forEach(q => {
    const chosen = ansMap[q.id];
    if (chosen && chosen.toUpperCase() === q.gabarito_oficial.toUpperCase()) {
      acertos++;
    }
  });

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

  try {
    await supabase.from('iptu_tentativas').update(finishPayload).eq('id', session.attempt.id);
    await supabase.from('iptu_tokens').update({ status: 'utilizado', updated_at: new Date().toISOString() }).eq('token', tokenCode);
  } catch (err) {
    console.warn('Supabase finishExam error, updating local:', err.message);
  }

  // Update local
  const attIdx = localIptuStore.tentativas.findIndex(a => a.id === session.attempt.id);
  if (attIdx >= 0) {
    localIptuStore.tentativas[attIdx] = { ...localIptuStore.tentativas[attIdx], ...finishPayload, status: 'concluida' };
  }

  const tokIdx = localIptuStore.tokens.findIndex(t => t.token === tokenCode);
  if (tokIdx >= 0) {
    localIptuStore.tokens[tokIdx].status = 'utilizado';
  }

  return {
    id: session.attempt.id,
    operador: session.operator.nome,
    matricula: session.operator.matricula,
    ...finishPayload,
    status: 'concluida'
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

  // Chart data
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
  const operators = await getIptuOperators();
  let results = [];

  for (const op of operators) {
    const attempts = localIptuStore.tentativas.filter(a => a.iptu_operador_id === op.id);
    if (attempts.length > 0) {
      attempts.forEach(att => {
        results.push({
          tentativa_id: att.id,
          operador_id: op.id,
          nome: op.nome,
          matricula: op.matricula,
          numero_tentativa: att.numero_tentativa,
          status: att.status,
          iniciada_em: att.iniciada_em,
          finalizada_em: att.finalizada_em,
          tempo_gasto_segundos: att.tempo_gasto_segundos,
          acertos: att.acertos || 0,
          erros: att.erros || 0,
          nota: att.nota !== null && att.nota !== undefined ? att.nota : (att.status === 'concluida' ? Number(((att.acertos / 20) * 10).toFixed(2)) : null),
          percentual: att.percentual !== null && att.percentual !== undefined ? att.percentual : (att.status === 'concluida' ? Number(((att.acertos / 20) * 100).toFixed(1)) : null),
          resultado: att.resultado || (att.status === 'concluida' ? (att.acertos >= 14 ? 'aprovado' : 'reprovado') : 'em_andamento')
        });
      });
    }
  }

  // Sort by finalizada_em desc, nota desc
  results.sort((a, b) => {
    if (b.finalizada_em && a.finalizada_em) return new Date(b.finalizada_em) - new Date(a.finalizada_em);
    return (b.nota || 0) - (a.nota || 0);
  });

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

  // Find attempt
  let attempt = localIptuStore.tentativas.find(a => a.id === numTentativaId);
  let operator = null;

  if (attempt) {
    operator = localIptuStore.operadores.find(o => o.id === attempt.iptu_operador_id);
  } else {
    try {
      const { data: attList } = await supabase.from('iptu_tentativas').select('*').eq('id', numTentativaId).limit(1);
      if (attList && attList[0]) {
        attempt = attList[0];
        const { data: opList } = await supabase.from('iptu_operadores').select('*').eq('id', attempt.iptu_operador_id).limit(1);
        if (opList && opList[0]) operator = opList[0];
      }
    } catch (err) {}
  }

  if (!attempt || !operator) {
    throw new Error('Tentativa ou operador não encontrado para correção.');
  }

  // Fetch answers
  let answers = localIptuStore.respostas.filter(r => r.tentativa_id === numTentativaId);
  if (answers.length === 0) {
    try {
      const { data } = await supabase.from('iptu_respostas').select('*').eq('tentativa_id', numTentativaId);
      if (data) answers = data;
    } catch (err) {}
  }

  const ansMap = {};
  answers.forEach(r => { ansMap[r.questao_id] = r.letra_selecionada; });

  const correctionDetails = localIptuStore.questions.map(q => {
    const respostaOperador = ansMap[q.id] || null;
    const gabarito = q.gabarito_oficial;
    const isCorreta = respostaOperador ? respostaOperador.toUpperCase() === gabarito.toUpperCase() : false;

    return {
      numero: q.numero,
      enunciado: q.enunciado,
      dificuldade: q.dificuldade,
      alternativas: q.alternativas.map(a => ({
        letra: a.letra,
        texto: a.texto,
        is_correta: a.letra === gabarito
      })),
      resposta_operador: respostaOperador,
      gabarito_oficial: gabarito,
      status: isCorreta ? 'CORRETA' : 'INCORRETA',
      is_correta: isCorreta,
      justificativa: q.justificativa_oficial
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
  const completedAttempts = localIptuStore.tentativas.filter(a => a.status === 'concluida' || a.status === 'expirada_tempo');
  const attemptIds = new Set(completedAttempts.map(a => a.id));

  const answers = localIptuStore.respostas.filter(r => attemptIds.has(r.tentativa_id));

  const stats = localIptuStore.questions.map(q => {
    const qAnswers = answers.filter(r => r.questao_id === q.id);
    const total = qAnswers.length;
    let acertos = 0;
    qAnswers.forEach(ans => {
      if (ans.letra_selecionada && ans.letra_selecionada.toUpperCase() === q.gabarito_oficial.toUpperCase()) {
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
      gabarito: q.gabarito_oficial,
      total_respostas: total,
      acertos,
      erros,
      percentual_acerto: percentualAcerto,
      percentual_erro: percentualErro
    };
  });

  // Ranking by highest error percentage
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

// Initial seed helper if DB has existing Desafio 156 operators
async function syncInitialOperatorsFromDesafio156() {
  try {
    const { data: existingOps } = await supabase.from('operators').select('id, name, registration');
    if (existingOps && existingOps.length > 0) {
      for (const op of existingOps) {
        const mat = (op.registration || `OP156-${op.id}`).toUpperCase();
        const exists = localIptuStore.operadores.some(o => o.matricula === mat);
        if (!exists) {
          const newOp = {
            id: nextOpId++,
            operador_id: op.id,
            nome: op.name,
            matricula: mat,
            status: 'ativo',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          localIptuStore.operadores.push(newOp);
          localIptuStore.tokens.push({
            id: nextTokenId++,
            iptu_operador_id: newOp.id,
            token: generateRandomToken(),
            status: 'ativo',
            created_by: 'Sistema',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }
    }
  } catch (err) {
    // If Supabase not connected, seed a few sample operators locally
    if (localIptuStore.operadores.length === 0) {
      const sampleNames = [
        { nome: 'Pedro Silva', matricula: 'OP15601' },
        { nome: 'Maria Santos', matricula: 'OP15602' },
        { nome: 'João Oliveira', matricula: 'OP15603' },
        { nome: 'Ana Costa', matricula: 'OP15604' },
        { nome: 'Carlos Eduardo', matricula: 'OP15605' }
      ];
      sampleNames.forEach(s => {
        const o = {
          id: nextOpId++,
          operador_id: null,
          nome: s.nome,
          matricula: s.matricula,
          status: 'ativo',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        localIptuStore.operadores.push(o);
        localIptuStore.tokens.push({
          id: nextTokenId++,
          iptu_operador_id: o.id,
          token: generateRandomToken(),
          status: 'ativo',
          created_by: 'Sistema',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      });
    }
  }
}

// Run initial sync
syncInitialOperatorsFromDesafio156().catch(() => {});

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
