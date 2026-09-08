const crypto = require('crypto');
const { supabase } = require('./supabaseDb');
const { logAudit } = require('./supabaseService');
const { IPTU_QUESTIONS_DATA } = require('./iptuSeedData');

// Fallback questions cache for default Tributos / Impostos
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

// Helper to generate unique token like 'TRIB-2026-X7K92P'
function generateRandomToken(secretariaName = 'Tributos / Impostos') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    const r = crypto.randomInt(0, chars.length);
    randomPart += chars[r];
  }
  let prefix = 'AVAL';
  const sec = String(secretariaName).toUpperCase();
  if (sec.includes('TRIBUTO') || sec.includes('IPTU') || sec.includes('IMPOSTO')) prefix = 'TRIB';
  else if (sec.includes('SAUD') || sec.includes('SAÚD')) prefix = 'SAUD';
  else if (sec.includes('EPTC')) prefix = 'EPTC';
  else if (sec.includes('DMLU')) prefix = 'DMLU';
  else if (sec.includes('DMAE')) prefix = 'DMAE';
  else if (sec.includes('SMED')) prefix = 'SMED';
  else if (sec.includes('GUARDA')) prefix = 'GCM';
  else if (sec.includes('SMAS')) prefix = 'SMAS';
  else if (sec.includes('DEFESA')) prefix = 'DEFC';
  else if (sec.includes('ZELAD')) prefix = 'ZELD';
  else if (sec.includes('FISCAL')) prefix = 'FISC';

  return `${prefix}-2026-${randomPart}`;
}

// ============================================================================
// 1. GESTÃO DE SECRETARIAS & PROVAS
// ============================================================================

async function getProvasList() {
  try {
    const { data, error } = await supabase
      .from('iptu_configuracoes')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn('Error reading provas list from Supabase:', err.message);
  }

  return [
    { id: 1, secretaria: 'Tributos / Impostos', nome_prova: 'Avaliação de Conhecimentos — Tributos / Impostos' },
    { id: 2, secretaria: 'Saúde', nome_prova: 'Avaliação de Conhecimentos — Saúde' },
    { id: 3, secretaria: 'EPTC', nome_prova: 'Avaliação de Conhecimentos — EPTC' },
    { id: 4, secretaria: 'DMLU', nome_prova: 'Avaliação de Conhecimentos — DMLU' },
    { id: 5, secretaria: 'DMAE', nome_prova: 'Avaliação de Conhecimentos — DMAE' },
    { id: 6, secretaria: 'Smed', nome_prova: 'Avaliação de Conhecimentos — Smed' },
    { id: 7, secretaria: 'Guarda Municipal', nome_prova: 'Avaliação de Conhecimentos — Guarda Municipal' },
    { id: 8, secretaria: 'SMAS', nome_prova: 'Avaliação de Conhecimentos — SMAS' },
    { id: 9, secretaria: 'Defesa Civil', nome_prova: 'Avaliação de Conhecimentos — Defesa Civil' },
    { id: 10, secretaria: 'Zeladoria', nome_prova: 'Avaliação de Conhecimentos — Zeladoria' },
    { id: 11, secretaria: 'Fiscalização Municipal', nome_prova: 'Avaliação de Conhecimentos — Fiscalização Municipal' }
  ];
}

async function createSecretariaProva({ secretaria, nome_prova, tempo_maximo_minutos = 30, nota_minima_aprovacao = 70 }, username = 'Admin') {
  const secClean = String(secretaria || '').trim();
  if (!secClean) throw new Error('O nome da secretaria é obrigatório.');

  const nameClean = String(nome_prova || `Avaliação de Conhecimentos — ${secClean}`).trim();

  const { data, error } = await supabase
    .from('iptu_configuracoes')
    .insert([{
      secretaria: secClean,
      nome_prova: nameClean,
      tempo_maximo_minutos: Number(tempo_maximo_minutos) || 30,
      nota_minima_aprovacao: Number(nota_minima_aprovacao) || 70,
      max_tentativas_padrao: 1,
      exibir_resultado_operador: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select();

  if (error) throw error;
  await logAudit(username, 'CREATE_PROVA', 'iptu_configuracoes', String(data[0].id), null, { secretaria: secClean });
  return data[0];
}

async function getIptuSettings(provaId = 1) {
  const pid = Number(provaId) || 1;
  try {
    const { data, error } = await supabase.from('iptu_configuracoes').select('*').eq('id', pid).limit(1);
    if (!error && data && data.length > 0) {
      return data[0];
    }
  } catch (err) {
    console.warn('Error reading iptu_configuracoes:', err.message);
  }

  return {
    id: pid,
    secretaria: 'Tributos / Impostos',
    nome_prova: 'Avaliação de Conhecimentos — Tributos / Impostos',
    nota_minima_aprovacao: 70.0,
    tempo_maximo_minutos: 30,
    max_tentativas_padrao: 1,
    exibir_resultado_operador: true,
    data_inicio: null,
    data_fim: null
  };
}

async function updateIptuSettings(newConfig, username = 'Admin', provaId = 1) {
  const pid = Number(provaId) || Number(newConfig.id) || 1;
  const payload = {
    nome_prova: newConfig.nome_prova || 'Avaliação de Conhecimentos — Tributos / Impostos',
    secretaria: newConfig.secretaria || 'Tributos / Impostos',
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
    .upsert([{ id: pid, ...payload }])
    .select();

  if (error) {
    console.error('Failed to update iptu_configuracoes in Supabase:', error);
    throw new Error('Falha ao salvar configurações no banco de dados.');
  }

  await logAudit(username, 'UPDATE_CONFIG', 'iptu_configuracoes', String(pid), null, payload);
  return data[0];
}

// ============================================================================
// 2. IMPORTAÇÃO E GESTÃO DE QUESTÕES POR PROVA
// ============================================================================

async function getQuestionsForProva(provaId = 1) {
  const pid = Number(provaId) || 1;
  const { data: dbQuestions, error: qErr } = await supabase
    .from('iptu_questoes')
    .select('*')
    .eq('prova_id', pid)
    .order('numero', { ascending: true });

  if (qErr) throw qErr;

  if (!dbQuestions || dbQuestions.length === 0) {
    if (pid === 1) {
      return DEFAULT_QUESTIONS;
    }
    return [];
  }

  const qIds = dbQuestions.map(q => q.id);
  const { data: dbAlts } = await supabase
    .from('iptu_alternativas')
    .select('*')
    .in('questao_id', qIds)
    .order('letra', { ascending: true });

  return dbQuestions.map(q => {
    const alts = (dbAlts || []).filter(a => a.questao_id === q.id);
    const correctAlt = alts.find(a => a.is_correta);
    return {
      id: q.id,
      numero: q.numero,
      enunciado: q.enunciado,
      dificuldade: q.dificuldade,
      ativo: q.ativo,
      alternativas: alts.map(a => ({
        id: a.id,
        letra: a.letra,
        texto: a.texto,
        is_correta: !!a.is_correta
      })),
      gabarito_oficial: correctAlt ? correctAlt.letra : 'A'
    };
  });
}

async function importQuestionsForProva(provaId, questions, replaceExisting = true, username = 'Admin') {
  const pid = Number(provaId) || 1;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Nenhuma questão válida encontrada para importar.');
  }

  if (replaceExisting) {
    const { data: oldQ } = await supabase.from('iptu_questoes').select('id').eq('prova_id', pid);
    if (oldQ && oldQ.length > 0) {
      const oldIds = oldQ.map(q => q.id);
      await supabase.from('iptu_alternativas').delete().in('questao_id', oldIds);
      await supabase.from('iptu_questoes').delete().eq('prova_id', pid);
    }
  }

  const inserted = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const { data: qData, error: qErr } = await supabase
      .from('iptu_questoes')
      .insert([{
        prova_id: pid,
        numero: q.numero || (i + 1),
        enunciado: q.enunciado,
        dificuldade: q.dificuldade || 'facil',
        ativo: true,
        created_at: new Date().toISOString()
      }])
      .select();

    if (qErr) throw qErr;

    const questaoId = qData[0].id;
    const altsToInsert = (q.alternativas || []).map(a => ({
      questao_id: questaoId,
      letra: a.letra.toUpperCase(),
      texto: a.texto,
      is_correta: !!a.is_correta
    }));

    if (altsToInsert.length > 0) {
      const { error: altErr } = await supabase.from('iptu_alternativas').insert(altsToInsert);
      if (altErr) throw altErr;
    }

    inserted.push({
      id: questaoId,
      numero: q.numero || (i + 1),
      enunciado: q.enunciado,
      totalAlternativas: altsToInsert.length
    });
  }

  await logAudit(username, 'IMPORT_QUESTIONS', 'iptu_questoes', String(pid), null, {
    prova_id: pid,
    totalQuestions: inserted.length
  });

  return {
    success: true,
    totalImported: inserted.length,
    questions: inserted
  };
}

// ============================================================================
// 3. OPERADORES DA PROVA & GERAÇÃO DE TOKENS
// ============================================================================

async function getIptuOperators(search = '', status = '', provaId = 1) {
  const pid = Number(provaId) || 1;
  let query = supabase.from('iptu_operadores').select('*').order('nome', { ascending: true });
  if (status) {
    query = query.eq('status', status);
  }

  const { data: ops, error: opErr } = await query;
  if (opErr) {
    console.error('Error fetching iptu_operadores from Supabase:', opErr);
    throw new Error('Erro ao carregar operadores da base de dados.');
  }

  const { data: tokens } = await supabase.from('iptu_tokens').select('*').eq('prova_id', pid);
  const { data: attempts } = await supabase.from('iptu_tentativas').select('*').eq('prova_id', pid).order('numero_tentativa', { ascending: false });

  let list = (ops || []).map(op => {
    const opTokens = (tokens || []).filter(t => t.iptu_operador_id === op.id);
    const activeToken = opTokens.find(t => t.status === 'ativo') || opTokens[opTokens.length - 1];
    const opAttempts = (attempts || []).filter(a => a.iptu_operador_id === op.id);
    const latestAttempt = opAttempts[0];

    return {
      id: op.id,
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
  if (!nomClean) throw new Error('O nome do operador é obrigatório.');

  let matClean = String(matricula || '').trim().toUpperCase();
  if (!matClean) {
    const { data: existingAll } = await supabase.from('iptu_operadores').select('matricula');
    const existingSet = new Set((existingAll || []).map(o => (o.matricula || '').toUpperCase()));
    let randNum = Math.floor(10000 + Math.random() * 90000);
    while (existingSet.has(`OP-${randNum}`)) {
      randNum = Math.floor(10000 + Math.random() * 90000);
    }
    matClean = `OP-${randNum}`;
  } else {
    const { data: duplicate } = await supabase.from('iptu_operadores').select('id').eq('matricula', matClean).limit(1);
    if (duplicate && duplicate.length > 0) {
      throw new Error(`Já existe um operador cadastrado com a matrícula ${matClean}.`);
    }
  }

  const { data, error } = await supabase.from('iptu_operadores').insert([{
    operador_id: operadorId ? Number(operadorId) : null,
    nome: nomClean,
    matricula: matClean,
    status: 'ativo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }]).select();

  if (error) throw error;
  await logAudit(username, 'CREATE_IPTU_OPERATOR', 'iptu_operadores', String(data[0].id), null, data[0]);
  return data[0];
}

async function updateIptuOperator(id, { nome, matricula, status }, username = 'Admin') {
  const numId = Number(id);
  const updatePayload = { updated_at: new Date().toISOString() };
  if (nome) updatePayload.nome = String(nome).trim();
  if (matricula) updatePayload.matricula = String(matricula).trim().toUpperCase();
  if (status) updatePayload.status = status;

  const { data, error } = await supabase
    .from('iptu_operadores')
    .update(updatePayload)
    .eq('id', numId)
    .select();

  if (error) throw error;
  await logAudit(username, 'UPDATE_IPTU_OPERATOR', 'iptu_operadores', String(numId), null, updatePayload);
  return data[0];
}

async function deleteIptuOperator(id, username = 'Admin') {
  const numId = Number(id);
  await supabase.from('iptu_respostas').delete().eq('tentativa_id', numId);
  await supabase.from('iptu_tentativas').delete().eq('iptu_operador_id', numId);
  await supabase.from('iptu_tokens').delete().eq('iptu_operador_id', numId);

  const { error } = await supabase.from('iptu_operadores').delete().eq('id', numId);
  if (error) throw error;
  await logAudit(username, 'DELETE_IPTU_OPERATOR', 'iptu_operadores', String(numId), null, 'Operador e dados removidos');
  return true;
}

async function importIptuOperatorsBulk(operatorsList, username = 'Admin') {
  const { data: existingAll } = await supabase.from('iptu_operadores').select('matricula');
  const existingMatMap = new Set((existingAll || []).map(o => (o.matricula || '').toUpperCase()));

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
// 4. GESTÃO DE TOKENS INDIVIDUAIS POR PROVA
// ============================================================================

async function generateTokenForOperator(iptuOperatorId, username = 'Admin', provaId = 1) {
  const numOpId = Number(iptuOperatorId);
  const pid = Number(provaId) || 1;
  const config = await getIptuSettings(pid);
  const tokenCode = generateRandomToken(config.secretaria || config.nome_prova);

  // Invalidate previous active token for this operator on THIS prova
  await supabase
    .from('iptu_tokens')
    .update({ status: 'invalidado', updated_at: new Date().toISOString() })
    .eq('iptu_operador_id', numOpId)
    .eq('prova_id', pid)
    .eq('status', 'ativo');

  const { data, error } = await supabase.from('iptu_tokens').insert([{
    iptu_operador_id: numOpId,
    prova_id: pid,
    token: tokenCode,
    status: 'ativo',
    created_by: username,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }]).select();

  if (error || !data || data.length === 0) {
    throw new Error('Falha ao gerar token: ' + (error?.message || 'Erro'));
  }

  return data[0];
}

async function generateAllTokens(username = 'Admin', provaId = 1) {
  const pid = Number(provaId) || 1;
  const operators = await getIptuOperators('', '', pid);
  let generatedCount = 0;

  for (const op of operators) {
    await generateTokenForOperator(op.id, username, pid);
    generatedCount++;
  }

  await logAudit(username, 'GENERATE_ALL_TOKENS', 'iptu_tokens', null, null, { generatedCount, provaId: pid });
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
  if (error) throw new Error('Erro ao invalidar token: ' + error.message);

  await logAudit(username, 'INVALIDATE_TOKEN', 'iptu_tokens', String(tokenIdOrCode), null, 'Token invalidado pelo administrador');
  return true;
}

async function allowNewAttempt(iptuOperatorId, username = 'Admin', provaId = 1) {
  const numOpId = Number(iptuOperatorId);
  const pid = Number(provaId) || 1;
  const newToken = await generateTokenForOperator(numOpId, username, pid);

  await logAudit(username, 'ALLOW_NEW_ATTEMPT', 'iptu_operadores', String(numOpId), null, {
    newToken: newToken.token,
    prova_id: pid,
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

  const { data: toks, error: tokErr } = await supabase
    .from('iptu_tokens')
    .select('*')
    .ilike('token', tokenStr)
    .limit(1);

  if (tokErr || !toks || toks.length === 0) {
    throw new Error('Token de avaliação inválido ou não encontrado no sistema.');
  }

  const tokenObj = toks[0];
  const provaId = tokenObj.prova_id || 1;

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

  const config = await getIptuSettings(provaId);

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

  // Load questions for THIS prova
  const questionsData = await getQuestionsForProva(provaId);
  const sanitizedQuestions = questionsData.map(q => ({
    id: q.id,
    numero: q.numero,
    enunciado: q.enunciado,
    dificuldade: q.dificuldade,
    alternativas: (q.alternativas || []).map(alt => ({
      id: alt.id,
      letra: alt.letra,
      texto: alt.texto
    }))
  }));

  return {
    token: tokenObj.token,
    token_status: tokenObj.status,
    prova_id: provaId,
    operator: {
      id: operatorObj.id,
      nome: operatorObj.nome,
      matricula: operatorObj.matricula
    },
    config: {
      id: config.id,
      secretaria: config.secretaria,
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
      nota: attempt.nota,
      percentual: attempt.percentual,
      resultado: attempt.resultado
    } : null,
    savedAnswers: savedAnswersMap,
    questions: sanitizedQuestions
  };
}

async function startExam(tokenCode) {
  const session = await getOperatorSessionByToken(tokenCode);

  if (session.attempt && session.attempt.status === 'concluida') {
    throw new Error('Esta avaliação já foi finalizada e não permite novo envio.');
  }

  if (session.attempt && session.attempt.status === 'em_andamento') {
    return session.attempt;
  }

  const { data: tokData } = await supabase.from('iptu_tokens').select('*').ilike('token', tokenCode.trim()).limit(1);
  const tokenObj = tokData[0];
  const provaId = tokenObj.prova_id || 1;

  const { data: existingAttempts } = await supabase
    .from('iptu_tentativas')
    .select('numero_tentativa')
    .eq('iptu_operador_id', tokenObj.iptu_operador_id)
    .eq('prova_id', provaId);

  const nextAttemptNum = (existingAttempts || []).length + 1;
  const questions = await getQuestionsForProva(provaId);
  const totalQuestoes = questions.length || 20;

  const { data: newAtt, error: attErr } = await supabase
    .from('iptu_tentativas')
    .insert([{
      iptu_operador_id: tokenObj.iptu_operador_id,
      token_id: tokenObj.id,
      prova_id: provaId,
      numero_tentativa: nextAttemptNum,
      status: 'em_andamento',
      iniciada_em: new Date().toISOString(),
      total_questoes: totalQuestoes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select();

  if (attErr || !newAtt || newAtt.length === 0) {
    throw new Error('Falha ao registrar início da avaliação: ' + attErr?.message);
  }

  return newAtt[0];
}

async function saveAnswer({ tokenCode, questaoNumero, letra }) {
  const session = await getOperatorSessionByToken(tokenCode);
  if (!session.attempt || session.attempt.status !== 'em_andamento') {
    throw new Error('A avaliação não está em andamento para registrar respostas.');
  }

  const qNum = Number(questaoNumero);
  const letraClean = String(letra || '').trim().toUpperCase();

  const questions = await getQuestionsForProva(session.prova_id || 1);
  const qObj = questions.find(q => q.numero === qNum);
  if (!qObj) throw new Error(`Questão número ${qNum} não encontrada nesta avaliação.`);

  const { data: existingResp } = await supabase
    .from('iptu_respostas')
    .select('id')
    .eq('tentativa_id', session.attempt.id)
    .eq('questao_id', qObj.id)
    .limit(1);

  if (existingResp && existingResp.length > 0) {
    await supabase.from('iptu_respostas').update({
      letra_selecionada: letraClean,
      respondida_em: new Date().toISOString()
    }).eq('id', existingResp[0].id);
  } else {
    await supabase.from('iptu_respostas').insert([{
      tentativa_id: session.attempt.id,
      questao_id: qObj.id,
      letra_selecionada: letraClean,
      respondida_em: new Date().toISOString()
    }]);
  }

  return { success: true, questaoId: qObj.id, questaoNumero: qNum, letra: letraClean };
}

async function finishExam({ tokenCode, tempoGastoSegundos, timedOut = false }) {
  const session = await getOperatorSessionByToken(tokenCode);
  if (!session.attempt) {
    throw new Error('Nenhuma tentativa encontrada para finalizar.');
  }
  if (session.attempt.status === 'concluida') {
    return session.attempt;
  }

  const provaId = session.prova_id || 1;
  const questions = await getQuestionsForProva(provaId);
  const { data: userAnswers } = await supabase.from('iptu_respostas').select('*').eq('tentativa_id', session.attempt.id);
  const ansMap = {};
  (userAnswers || []).forEach(r => { ansMap[r.questao_id] = (r.letra_selecionada || '').toUpperCase(); });

  let acertos = 0;
  let erros = 0;
  const totalQuestoes = questions.length || 20;

  questions.forEach(q => {
    const selected = ansMap[q.id];
    const correctAlt = (q.alternativas || []).find(a => a.is_correta);
    const correctLetter = correctAlt ? correctAlt.letra.toUpperCase() : (q.gabarito_oficial || 'A').toUpperCase();

    if (selected && selected === correctLetter) {
      acertos++;
    } else {
      erros++;
    }
  });

  const percentual = totalQuestoes > 0 ? Number(((acertos / totalQuestoes) * 100).toFixed(2)) : 0;
  const nota = Number((percentual / 10).toFixed(2));
  const config = await getIptuSettings(provaId);
  const notaMinima = Number(config.nota_minima_aprovacao) || 70.0;
  const resultado = percentual >= notaMinima ? 'aprovado' : 'reprovado';
  const statusTentativa = timedOut ? 'expirada_tempo' : 'concluida';

  const finishPayload = {
    status: statusTentativa,
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

  await supabase.from('iptu_tentativas').update(finishPayload).eq('id', session.attempt.id);
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

async function getIptuDashboard(provaId = 1) {
  const pid = Number(provaId) || 1;
  const operators = await getIptuOperators('', '', pid);
  const config = await getIptuSettings(pid);

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

async function getIptuResults(search = '', status = '', resultado = '', provaId = 1) {
  const pid = Number(provaId) || 1;
  const { data: attempts, error } = await supabase
    .from('iptu_tentativas')
    .select('*, iptu_operadores(id, nome, matricula)')
    .eq('prova_id', pid)
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
  const provaId = attempt.prova_id || 1;

  const { data: answers } = await supabase.from('iptu_respostas').select('*').eq('tentativa_id', numTentativaId);
  const ansMap = {};
  (answers || []).forEach(r => { ansMap[r.questao_id] = r.letra_selecionada; });

  const questionsList = await getQuestionsForProva(provaId);

  const correctionDetails = questionsList.map(q => {
    const correctAlt = (q.alternativas || []).find(a => a.is_correta);
    const gabarito = correctAlt ? correctAlt.letra : (q.gabarito_oficial || 'A');
    const respostaOperador = ansMap[q.id] || null;
    const isCorreta = respostaOperador ? respostaOperador.toUpperCase() === gabarito.toUpperCase() : false;

    return {
      numero: q.numero,
      enunciado: q.enunciado,
      dificuldade: q.dificuldade,
      alternativas: (q.alternativas || []).map(a => ({
        letra: a.letra,
        texto: a.texto,
        is_correta: a.letra === gabarito
      })),
      resposta_operador: respostaOperador,
      gabarito_oficial: gabarito,
      status: isCorreta ? 'CORRETA' : 'INCORRETA',
      is_correta: isCorreta
    };
  });

  return {
    tentativa: {
      id: attempt.id,
      operador: operator.nome,
      matricula: operator.matricula,
      numero_tentativa: attempt.numero_tentativa,
      status: attempt.status,
      iniciada_em: attempt.iniciada_em,
      finalizada_em: attempt.finalizada_em,
      tempo_gasto_segundos: attempt.tempo_gasto_segundos,
      acertos: attempt.acertos,
      erros: attempt.erros,
      nota: attempt.nota,
      percentual: attempt.percentual,
      resultado: attempt.resultado
    },
    questions: correctionDetails
  };
}

async function getQuestionsPerformance(provaId = 1) {
  const pid = Number(provaId) || 1;
  const questionsList = await getQuestionsForProva(pid);
  const { data: attempts } = await supabase.from('iptu_tentativas').select('id').eq('prova_id', pid);
  const attemptIds = (attempts || []).map(a => a.id);

  let answers = [];
  if (attemptIds.length > 0) {
    const { data: ans } = await supabase.from('iptu_respostas').select('*').in('tentativa_id', attemptIds);
    answers = ans || [];
  }

  const stats = questionsList.map(q => {
    const qAnswers = answers.filter(a => a.questao_id === q.id);
    const totalRespostas = qAnswers.length;
    const correctAlt = (q.alternativas || []).find(a => a.is_correta);
    const gabarito = correctAlt ? correctAlt.letra.toUpperCase() : (q.gabarito_oficial || 'A').toUpperCase();

    let acertos = 0;
    qAnswers.forEach(ans => {
      if (ans.letra_selecionada && ans.letra_selecionada.toUpperCase() === gabarito) {
        acertos++;
      }
    });

    const erros = totalRespostas - acertos;
    const percentualAcerto = totalRespostas > 0 ? Number(((acertos / totalRespostas) * 100).toFixed(1)) : 0;
    const percentualErro = totalRespostas > 0 ? Number(((erros / totalRespostas) * 100).toFixed(1)) : 0;

    return {
      id: q.id,
      numero: q.numero,
      enunciado: q.enunciado,
      dificuldade: q.dificuldade,
      gabarito,
      total_respostas: totalRespostas,
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

async function getDifficultyPerformance(provaId = 1) {
  const pid = Number(provaId) || 1;
  const { questions } = await getQuestionsPerformance(pid);

  const groups = {
    facil: { nome: 'Fácil', totalQuestoes: 0, totalRespostas: 0, acertos: 0, percentual: 0 },
    medio: { nome: 'Médio', totalQuestoes: 0, totalRespostas: 0, acertos: 0, percentual: 0 },
    dificil: { nome: 'Difícil', totalQuestoes: 0, totalRespostas: 0, acertos: 0, percentual: 0 }
  };

  questions.forEach(q => {
    const d = q.dificuldade || 'facil';
    if (groups[d]) {
      groups[d].totalQuestoes++;
      groups[d].totalRespostas += q.total_respostas;
      groups[d].acertos += q.acertos;
    }
  });

  Object.keys(groups).forEach(k => {
    const g = groups[k];
    g.percentual = g.totalRespostas > 0 ? Number(((g.acertos / g.totalRespostas) * 100).toFixed(1)) : 0;
  });

  return groups;
}

module.exports = {
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
};
