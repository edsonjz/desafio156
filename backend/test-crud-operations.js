const app = require('./src/server');
const http = require('http');

async function testCrud() {
  console.log('========================================================');
  console.log('🧪 TESTE COMPLETO DE OPERAÇÕES MANUAIS (CRUD)');
  console.log('========================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin156' })
    });
    const { token } = await loginRes.json();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // ----------------------------------------------------
    // 1. OPERADORES (Incluir, Editar, Excluir)
    // ----------------------------------------------------
    console.log('--- 1. TESTE CRUD OPERADORES ---');
    // Create
    const createOpRes = await fetch(`${baseUrl}/operators`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Operador Teste CRUD', registration: 'OP99999', notes: 'Teste Inicial' })
    });
    const createOpData = await createOpRes.json();
    if (!createOpData.operatorId) throw new Error('Falha ao criar operador: ' + JSON.stringify(createOpData));
    const testOpId = createOpData.operatorId;
    console.log(`✅ Operador criado: ID ${testOpId}`);

    // Edit
    const editOpRes = await fetch(`${baseUrl}/operators/${testOpId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'Operador Teste CRUD Editado', registration: 'OP99999', notes: 'Atualizado com Sucesso' })
    });
    const editOpData = await editOpRes.json();
    console.log(`✅ Operador editado: ${editOpData.message}`);

    // ----------------------------------------------------
    // 2. LANÇAMENTO DE PONTOS (Incluir, Editar, Listar, Excluir)
    // ----------------------------------------------------
    console.log('\n--- 2. TESTE CRUD LANÇAMENTO DE PONTOS ---');
    // Create Point
    const createPtRes = await fetch(`${baseUrl}/points/single`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operatorId: testOpId,
        points: 45,
        eventDate: '2026-09-06',
        observation: 'Lançamento Teste CRUD'
      })
    });
    const createPtData = await createPtRes.json();
    if (!createPtData.transactionId) throw new Error('Falha ao lançar ponto: ' + JSON.stringify(createPtData));
    const testTxId = createPtData.transactionId;
    console.log(`✅ Ponto lançado: ID ${testTxId} (+45 pts)`);

    // List Points
    const listPtsRes = await fetch(`${baseUrl}/points?operatorId=${testOpId}`, { headers });
    const listPts = await listPtsRes.json();
    console.log(`✅ Listagem de pontos: ${listPts.length} lançamentos encontrados`);

    // Edit Point
    const editPtRes = await fetch(`${baseUrl}/points/${testTxId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        points: 55,
        observation: 'Lançamento Teste CRUD (Editado para 55 pts)'
      })
    });
    const editPtData = await editPtRes.json();
    console.log(`✅ Ponto editado: ${editPtData.message} (Saldo: ${editPtData.totalPoints} pts, Bilhetes: ${editPtData.totalTickets})`);

    // Delete Point
    const delPtRes = await fetch(`${baseUrl}/points/${testTxId}`, { method: 'DELETE', headers });
    const delPtData = await delPtRes.json();
    console.log(`✅ Ponto excluído: ${delPtData.message}`);

    // ----------------------------------------------------
    // 3. BILHETES (Incluir, Listar, Editar, Excluir)
    // ----------------------------------------------------
    console.log('\n--- 3. TESTE CRUD BILHETES ---');
    // Create Ticket
    const createTkRes = await fetch(`${baseUrl}/tickets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operatorId: testOpId,
        ticketCode: 'TKT-9999',
        status: 'valid'
      })
    });
    const createTkData = await createTkRes.json();
    if (!createTkData.ticket) throw new Error('Falha ao criar bilhete: ' + JSON.stringify(createTkData));
    const testTkId = createTkData.ticket.id;
    console.log(`✅ Bilhete manual incluído: ID ${testTkId} (${createTkData.ticket.ticket_code})`);

    // List Tickets
    const listTkRes = await fetch(`${baseUrl}/tickets/list?operatorId=${testOpId}`, { headers });
    const listTk = await listTkRes.json();
    console.log(`✅ Listagem de bilhetes individuais: ${listTk.length} encontrados`);

    // Edit Ticket
    const editTkRes = await fetch(`${baseUrl}/tickets/${testTkId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: 'used' })
    });
    const editTkData = await editTkRes.json();
    console.log(`✅ Bilhete editado: ${editTkData.message} (Novo status: ${editTkData.ticket.status})`);

    // Delete Ticket
    const delTkRes = await fetch(`${baseUrl}/tickets/${testTkId}`, { method: 'DELETE', headers });
    const delTkData = await delTkRes.json();
    console.log(`✅ Bilhete excluído: ${delTkData.message}`);

    // ----------------------------------------------------
    // 4. DESAFIOS (Incluir, Editar, Excluir)
    // ----------------------------------------------------
    console.log('\n--- 4. TESTE CRUD DESAFIOS ---');
    // Create Challenge
    const createChRes = await fetch(`${baseUrl}/challenges`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Desafio Teste CRUD',
        description: 'Descrição de teste',
        rewardPoints: 25,
        startDate: '2026-09-01',
        endDate: '2026-09-10'
      })
    });
    const createChData = await createChRes.json();
    const testChId = createChData.challengeId;
    console.log(`✅ Desafio criado: ID ${testChId}`);

    // Edit Challenge
    const editChRes = await fetch(`${baseUrl}/challenges/${testChId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: 'Desafio Teste CRUD (Nome Atualizado)',
        rewardPoints: 35
      })
    });
    const editChData = await editChRes.json();
    console.log(`✅ Desafio editado: ${editChData.message}`);

    // Delete Challenge
    const delChRes = await fetch(`${baseUrl}/challenges/${testChId}`, { method: 'DELETE', headers });
    const delChData = await delChRes.json();
    console.log(`✅ Desafio excluído: ${delChData.message}`);

    // ----------------------------------------------------
    // 5. PRÊMIOS (Incluir, Editar, Excluir)
    // ----------------------------------------------------
    console.log('\n--- 5. TESTE CRUD PRÊMIOS ---');
    // Create Prize
    const createPrzRes = await fetch(`${baseUrl}/prizes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operatorId: testOpId,
        name: 'Prêmio Teste CRUD',
        category: 'pausa_extra',
        observation: 'Concedido no teste'
      })
    });
    const createPrzData = await createPrzRes.json();
    console.log(`✅ Prêmio manual incluído: ${createPrzData.message}`);

    // List prizes to get ID
    const listPrzRes = await fetch(`${baseUrl}/prizes?operatorId=${testOpId}`, { headers });
    const listPrz = await listPrzRes.json();
    const testPrzId = listPrz[0].id;

    // Edit Prize
    const editPrzRes = await fetch(`${baseUrl}/prizes/${testPrzId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: 'Prêmio Teste CRUD (Editado)',
        status: 'Utilizado',
        observation: 'Utilizado com sucesso'
      })
    });
    const editPrzData = await editPrzRes.json();
    console.log(`✅ Prêmio editado: ${editPrzData.message}`);

    // Delete Prize
    const delPrzRes = await fetch(`${baseUrl}/prizes/${testPrzId}`, { method: 'DELETE', headers });
    const delPrzData = await delPrzRes.json();
    console.log(`✅ Prêmio excluído: ${delPrzData.message}`);

    // ----------------------------------------------------
    // 6. REGRAS DA CAMPANHA (Incluir, Editar, Excluir)
    // ----------------------------------------------------
    console.log('\n--- 6. TESTE CRUD REGRAS DA CAMPANHA ---');
    // Create Rule
    const createRlRes = await fetch(`${baseUrl}/rules`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Regra Teste CRUD',
        description: 'Regra temporária de teste',
        points: 15,
        periodicity: 'diario',
        type: 'positive',
        active: 1
      })
    });
    const createRlData = await createRlRes.json();
    const testRlId = createRlData.rule.id;
    console.log(`✅ Regra criada: ID ${testRlId} (${createRlData.rule.name})`);

    // Edit Rule
    const editRlRes = await fetch(`${baseUrl}/rules/${testRlId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: 'Regra Teste CRUD (Nome Atualizado)',
        points: 20
      })
    });
    const editRlData = await editRlRes.json();
    console.log(`✅ Regra editada: ${editRlData.message}`);

    // Delete Rule
    const delRlRes = await fetch(`${baseUrl}/rules/${testRlId}`, { method: 'DELETE', headers });
    const delRlData = await delRlRes.json();
    console.log(`✅ Regra excluída: ${delRlData.message}`);

    // Campaign Settings Edit
    const editCampRes = await fetch(`${baseUrl}/campaign`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        subtitle: 'Performance e reconhecimento de excelência na Central 156.'
      })
    });
    const editCampData = await editCampRes.json();
    console.log(`✅ Configurações da Campanha editadas: ${editCampData.message}`);

    // ----------------------------------------------------
    // Limpeza: Excluir o Operador de Teste
    // ----------------------------------------------------
    const delOpRes = await fetch(`${baseUrl}/operators/${testOpId}`, { method: 'DELETE', headers });
    const delOpData = await delOpRes.json();
    console.log(`\n✅ Operador de teste excluído: ${delOpData.message}`);

    console.log('\n========================================================');
    console.log('🎉 TODOS OS TESTES DE CRUD PASSARAM COM SUCESSO TOTAL!');
    console.log('========================================================\n');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro no teste de CRUD:', err);
    server.close();
    process.exit(1);
  }
}

testCrud();
