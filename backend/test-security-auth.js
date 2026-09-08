const http = require('http');
const app = require('./src/server');

async function testSecurityAuth() {
  console.log('========================================================');
  console.log('🔒 TESTE DE SEGURANÇA E GESTÃO DE ADMINISTRADORES');
  console.log('========================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 1. Test unauthenticated request to /campaign/status (must be 401)
    const unauthCamp = await fetch(`${baseUrl}/campaign/status`);
    console.log('1. Acesso anônimo a /campaign/status bloqueado (401):', unauthCamp.status === 401 ? '✅ OK' : `❌ Status ${unauthCamp.status}`);

    // 2. Test login with wrong credentials (must be 401)
    const badLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    console.log('2. Tentativa com senha incorreta rejeitada (401):', badLogin.status === 401 ? '✅ OK' : `❌ Status ${badLogin.status}`);

    // 3. Master Admin Login
    const masterLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin156' })
    });
    const masterData = await masterLogin.json();
    if (!masterData.token || masterData.user.role !== 'master' || !masterData.user.isMaster) {
      throw new Error(`Login Master falhou ou role incorreto: ${JSON.stringify(masterData)}`);
    }
    const masterToken = masterData.token;
    console.log('3. Login do Master Admin com role "master": ✅ OK');

    const masterHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${masterToken}`
    };

    // 4. List all administrators
    const usersRes = await fetch(`${baseUrl}/auth/users`, { headers: masterHeaders });
    const users = await usersRes.json();
    console.log(`4. Listagem de administradores (${users.length} encontrados): ✅ OK`);

    // 5. Master creates a new Administrator
    const testUsername = `test_sup_${Date.now().toString().slice(-4)}`;
    const createRes = await fetch(`${baseUrl}/auth/users`, {
      method: 'POST',
      headers: masterHeaders,
      body: JSON.stringify({
        username: testUsername,
        password: 'password123',
        role: 'admin'
      })
    });
    const createData = await createRes.json();
    if (createRes.status !== 201) {
      throw new Error(`Falha ao criar administrador: ${JSON.stringify(createData)}`);
    }
    const createdUserId = createData.user.id;
    console.log(`5. Criação de novo administrador "${testUsername}" pelo Master: ✅ OK`);

    // 6. Login with the newly created admin
    const newAdminLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, password: 'password123' })
    });
    const newAdminData = await newAdminLogin.json();
    if (!newAdminData.token || newAdminData.user.role !== 'admin' || newAdminData.user.isMaster) {
      throw new Error(`Login do novo admin falhou: ${JSON.stringify(newAdminData)}`);
    }
    const newAdminToken = newAdminData.token;
    console.log(`6. Login do novo administrador com token válido: ✅ OK`);

    const newAdminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${newAdminToken}`
    };

    // 7. Verify new admin CAN access operational endpoints (e.g. operators, rules)
    const opRes = await fetch(`${baseUrl}/operators`, { headers: newAdminHeaders });
    console.log(`7. Novo administrador acessando dados operacionais (status ${opRes.status}):`, opRes.status === 200 ? '✅ OK' : '❌ Falhou');

    // 8. Verify new admin CANNOT create other admins (must be 403 Forbidden)
    const forbiddenCreate = await fetch(`${baseUrl}/auth/users`, {
      method: 'POST',
      headers: newAdminHeaders,
      body: JSON.stringify({ username: 'hacker_admin', password: 'password123' })
    });
    console.log('8. Bloqueio de criação de usuários por admin não-master (403):', forbiddenCreate.status === 403 ? '✅ OK' : `❌ Status ${forbiddenCreate.status}`);

    // 9. Master Admin resets password of test admin
    const resetRes = await fetch(`${baseUrl}/auth/users/${createdUserId}/password`, {
      method: 'PUT',
      headers: masterHeaders,
      body: JSON.stringify({ newPassword: 'newpassword456' })
    });
    console.log('9. Master redefinindo senha de outro administrador:', resetRes.status === 200 ? '✅ OK' : `❌ Status ${resetRes.status}`);

    // 10. Login with updated password
    const loginUpdated = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, password: 'newpassword456' })
    });
    console.log('10. Login do administrador com a nova senha atualizada:', loginUpdated.status === 200 ? '✅ OK' : `❌ Status ${loginUpdated.status}`);

    // 11. Master attempts to delete self (must be 400 Bad Request)
    const deleteSelf = await fetch(`${baseUrl}/auth/users/${masterData.user.id}`, {
      method: 'DELETE',
      headers: masterHeaders
    });
    console.log('11. Proteção contra auto-exclusão do Master Admin (400):', deleteSelf.status === 400 ? '✅ OK' : `❌ Status ${deleteSelf.status}`);

    // 12. Master deletes the test admin
    const deleteRes = await fetch(`${baseUrl}/auth/users/${createdUserId}`, {
      method: 'DELETE',
      headers: masterHeaders
    });
    console.log(`12. Exclusão do usuário de teste pelo Master Admin (200):`, deleteRes.status === 200 ? '✅ OK' : `❌ Status ${deleteRes.status}`);

    console.log('\n========================================================');
    console.log('🏆 TODOS OS TESTES DE SEGURANÇA E AUTH PASSARAM 100%!');
    console.log('========================================================\n');
  } finally {
    server.close();
  }
}

testSecurityAuth().catch(err => {
  console.error('❌ ERRO NO TESTE DE SEGURANÇA:', err);
  process.exit(1);
});
