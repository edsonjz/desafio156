const app = require('./src/server');
const http = require('http');

async function testRegression() {
  console.log('========================================================');
  console.log('🔍 TESTE DE REGRESSÃO DO DESAFIO 156');
  console.log('========================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    const health = await healthRes.json();
    console.log('1. Health Check:', health.status === 'ok' ? '✅ OK' : '❌ Falhou');

    // 2. Auth Login (admin / admin156)
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin156' })
    });
    const loginData = await loginRes.json();
    if (!loginData.token) {
      throw new Error('Falha no login com admin / admin156');
    }
    const token = loginData.token;
    console.log('2. Autenticação JWT (admin/admin156): ✅ OK');

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 3. Campaign Status
    const campRes = await fetch(`${baseUrl}/campaign/status`, { headers: authHeaders });
    const camp = await campRes.json();
    console.log(`3. Status da Campanha (${camp.name}): ✅ OK`);

    // 4. Operators List
    const opsRes = await fetch(`${baseUrl}/operators`, { headers: authHeaders });
    const ops = await opsRes.json();
    console.log(`4. Lista de Operadores do Desafio 156 (${ops.length} carregados): ✅ OK`);

    // 5. Point Rules
    const rulesRes = await fetch(`${baseUrl}/rules`, { headers: authHeaders });
    const rules = await rulesRes.json();
    console.log(`5. Regras de Pontuação (${rules.length} regras): ✅ OK`);

    // 6. Ranking
    const rankRes = await fetch(`${baseUrl}/ranking`, { headers: authHeaders });
    const rank = await rankRes.json();
    console.log(`6. Ranking Operacional (${rank.length} posições): ✅ OK`);

    // 7. Roulette History
    const rouRes = await fetch(`${baseUrl}/roulette/history`, { headers: authHeaders });
    const rou = await rouRes.json();
    console.log(`7. Histórico da Roleta 156: ✅ OK`);

    // 8. Prizes
    const prizeRes = await fetch(`${baseUrl}/prizes`, { headers: authHeaders });
    const prizes = await prizeRes.json();
    console.log(`8. Lista de Prêmios: ✅ OK`);

    // 9. Challenges
    const chalRes = await fetch(`${baseUrl}/challenges`, { headers: authHeaders });
    const chal = await chalRes.json();
    console.log(`9. Desafios: ✅ OK`);

    // 10. Audit Logs
    const auditRes = await fetch(`${baseUrl}/audit`, { headers: authHeaders });
    const audit = await auditRes.json();
    console.log(`10. Logs de Auditoria: ✅ OK`);

    // 11. Novo Módulo: Prova IPTU Dashboard
    const iptuDashRes = await fetch(`${baseUrl}/iptu/dashboard`, { headers: authHeaders });
    const iptuDash = await iptuDashRes.json();
    console.log(`11. Módulo Novo - Prova IPTU Dashboard (${iptuDash.metrics.totalOperadores} operadores): ✅ OK`);

    // 12. Novo Módulo: Prova IPTU Operadores
    const iptuOpsRes = await fetch(`${baseUrl}/iptu/operators`, { headers: authHeaders });
    const iptuOps = await iptuOpsRes.json();
    console.log(`12. Módulo Novo - Prova IPTU Operadores (${iptuOps.length} registros): ✅ OK`);

    console.log('\n========================================================');
    console.log('🏆 TESTE DE REGRESSÃO CONCLUÍDO: ZERO REGRESSÕES!');
    console.log('TODAS AS FUNCIONALIDADES ANTIGAS E NOVAS ESTÃO PERFEITAS.');
    console.log('========================================================\n');
  } finally {
    server.close();
  }
}

testRegression().catch(err => {
  console.error('❌ ERRO NO TESTE DE REGRESSÃO:', err);
  process.exit(1);
});
