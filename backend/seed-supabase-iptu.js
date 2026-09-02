const { supabase } = require('./src/db/supabaseDb');
const { IPTU_QUESTIONS_DATA } = require('./src/db/iptuSeedData');
const crypto = require('crypto');

function generateRandomToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    const r = crypto.randomInt(0, chars.length);
    randomPart += chars[r];
  }
  return `IPTU-2026-${randomPart}`;
}

async function seedSupabase() {
  console.log('Seeding Supabase IPTU tables...');

  // 1. Check & Seed Questions
  const { data: existingQ } = await supabase.from('iptu_questoes').select('numero');
  const existingNums = new Set((existingQ || []).map(q => q.numero));

  for (const q of IPTU_QUESTIONS_DATA) {
    if (!existingNums.has(q.numero)) {
      const { data: qData, error: qErr } = await supabase.from('iptu_questoes').insert([{
        numero: q.numero,
        enunciado: q.enunciado,
        dificuldade: q.dificuldade,
        ativo: true
      }]).select();

      if (qErr) {
        console.error(`Error inserting question ${q.numero}:`, qErr);
        continue;
      }

      const qId = qData[0].id;
      const altsToInsert = q.alternativas.map(alt => ({
        questao_id: qId,
        letra: alt.letra,
        texto: alt.texto,
        is_correta: alt.letra === q.correta,
        justificativa: alt.letra === q.correta ? q.justificativa : null
      }));

      await supabase.from('iptu_alternativas').insert(altsToInsert);
      console.log(`Inserted question #${q.numero}`);
    }
  }

  // 2. Sync existing operators from operators table to iptu_operadores and generate tokens
  const { data: allOps } = await supabase.from('operators').select('*');
  const { data: existingIptuOps } = await supabase.from('iptu_operadores').select('*');
  const existingMatMap = new Set((existingIptuOps || []).map(o => o.matricula.toUpperCase()));

  for (const op of (allOps || [])) {
    const mat = (op.registration || `OP156-${op.id}`).toUpperCase();
    if (!existingMatMap.has(mat)) {
      const { data: newOpList, error: opErr } = await supabase.from('iptu_operadores').insert([{
        operador_id: op.id,
        nome: op.name,
        matricula: mat,
        status: 'ativo'
      }]).select();

      if (!opErr && newOpList && newOpList[0]) {
        const createdOp = newOpList[0];
        const tokenCode = generateRandomToken();
        await supabase.from('iptu_tokens').insert([{
          iptu_operador_id: createdOp.id,
          token: tokenCode,
          status: 'ativo',
          created_by: 'Sistema'
        }]);
        console.log(`Created IPTU operator & token for: ${op.name} (${tokenCode})`);
      }
    }
  }

  // Ensure all existing iptu_operadores have at least one active token
  const { data: currentIptuOps } = await supabase.from('iptu_operadores').select('id, nome');
  const { data: allTokens } = await supabase.from('iptu_tokens').select('iptu_operador_id, status');

  for (const op of (currentIptuOps || [])) {
    const hasToken = (allTokens || []).some(t => t.iptu_operador_id === op.id && t.status === 'ativo');
    if (!hasToken) {
      const tokenCode = generateRandomToken();
      await supabase.from('iptu_tokens').insert([{
        iptu_operador_id: op.id,
        token: tokenCode,
        status: 'ativo',
        created_by: 'Sistema'
      }]);
      console.log(`Generated missing token for ${op.nome}: ${tokenCode}`);
    }
  }

  console.log('✅ Supabase IPTU tables successfully seeded and synchronized!');
}

seedSupabase().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
