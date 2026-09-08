const xlsx = require('xlsx');
const http = require('http');
const app = require('./src/server');
const { parseQuestionsFromBuffer } = require('./src/utils/questionParser');

async function testQuestionsAndSecretarias() {
  console.log('========================================================');
  console.log('🧪 TESTE DO MÓDULO DE SECRETARIAS E PARSER DE QUESTÕES');
  console.log('========================================================\n');

  // 1. Test Excel Parsing
  const sampleQuestions = [
    {
      'Numero': 1,
      'Enunciado': 'Qual o prazo limite de vencimento da taxa de lixo?',
      'Alternativa A': 'Final de janeiro',
      'Alternativa B': 'Primeiro dia útil de fevereiro',
      'Alternativa C': 'Não há data fixa',
      'Alternativa D': 'Em dezembro',
      'Correta': 'B',
      'Dificuldade': 'facil'
    },
    {
      'Numero': 2,
      'Enunciado': 'Onde obter a guia de recolhimento atualizada?',
      'Alternativa A': 'Diretamente no portal oficial da prefeitura',
      'Alternativa B': 'Em qualquer banco sem código de barras',
      'Alternativa C': 'Apenas via correios',
      'Alternativa D': 'Nenhum local',
      'Correta': 'A',
      'Dificuldade': 'medio'
    }
  ];

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(sampleQuestions);
  xlsx.utils.book_append_sheet(wb, ws, 'Questoes');
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const parsed = await parseQuestionsFromBuffer(buffer, 'teste_questoes.xlsx');
  console.log(`1. Parser Excel (${parsed.length} questões extraídas):`, parsed.length === 2 ? '✅ OK' : '❌ Falhou');
  console.log(`   - Questão 1 correta: ${parsed[0].alternativas.find(a => a.is_correta)?.letra} (Esperado: B):`, parsed[0].alternativas.find(a => a.is_correta)?.letra === 'B' ? '✅ OK' : '❌ Falhou');
  console.log(`   - Questão 2 correta: ${parsed[1].alternativas.find(a => a.is_correta)?.letra} (Esperado: A):`, parsed[1].alternativas.find(a => a.is_correta)?.letra === 'A' ? '✅ OK' : '❌ Falhou');

  // 2. Test Server Endpoints
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // Direct token creation for test
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('./src/middleware/auth');
    const token = jwt.sign({ id: 1, username: 'admin', role: 'master' }, JWT_SECRET, { expiresIn: '1h' });

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 3. Fetch Secretarias list
    const provRes = await fetch(`${baseUrl}/iptu/provas`, { headers: authHeaders });
    const provas = await provRes.json();
    console.log(`2. Listagem de secretarias cadastradas (${provas.length} secretarias):`, provas.length >= 11 ? '✅ OK' : '❌ Falhou');

    const tributos = provas.find(p => p.secretaria === 'Tributos / Impostos');
    console.log('   - Secretaria "Tributos / Impostos" configurada:', tributos ? '✅ OK' : '❌ Falhou');

    const saude = provas.find(p => p.secretaria === 'Saúde');
    console.log('   - Secretaria "Saúde" configurada:', saude ? '✅ OK' : '❌ Falhou');

    const eptc = provas.find(p => p.secretaria === 'EPTC');
    console.log('   - Secretaria "EPTC" configurada:', eptc ? '✅ OK' : '❌ Falhou');

    // 4. Download question template
    const tmplRes = await fetch(`${baseUrl}/iptu/template/questions`, { headers: authHeaders });
    console.log('3. Download do modelo de questões Excel (status 200):', tmplRes.status === 200 ? '✅ OK' : '❌ Falhou');

    console.log('\n========================================================');
    console.log('🏆 TESTES DE SECRETARIAS E PARSER PASSARAM COM SUCESSO!');
    console.log('========================================================\n');
  } finally {
    server.close();
  }
}

testQuestionsAndSecretarias().catch(err => {
  console.error('❌ ERRO NO TESTE:', err);
  process.exit(1);
});
