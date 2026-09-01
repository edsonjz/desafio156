const bcrypt = require('bcryptjs');
const { db, initDb, syncOperatorTickets } = require('./index');

function seedDatabase() {
  initDb();

  // 1. Seed Campaign if not existing
  const campaignStmt = db.prepare('SELECT COUNT(*) as count FROM campaigns');
  if (campaignStmt.get().count === 0) {
    db.prepare(`
      INSERT INTO campaigns (id, name, subtitle, start_date, end_date, status)
      VALUES (1, 'DESAFIO 156', 'Performance, reconhecimento e chances de conquistar sua folga de Natal e Ano Novo.', '2026-09-01', '2026-12-11', 'active')
    `).run();
    console.log('Seeded campaign DESAFIO 156');
  }

  // 2. Seed Default Admin if not existing (admin / admin156)
  const adminStmt = db.prepare('SELECT COUNT(*) as count FROM administrators');
  if (adminStmt.get().count === 0) {
    const passwordHash = bcrypt.hashSync('admin156', 10);
    db.prepare(`
      INSERT INTO administrators (username, password_hash)
      VALUES ('admin', ?)
    `).run(passwordHash);
    console.log('Seeded default admin (admin / admin156)');
  }

  // 3. Seed Point Rules if not existing
  const rulesStmt = db.prepare('SELECT COUNT(*) as count FROM point_rules');
  if (rulesStmt.get().count === 0) {
    const rules = [
      // Positive Rules
      { name: 'Atingir TMA dentro da meta', description: 'Metrica diaria de tempo medio de atendimento', points: 10, periodicity: 'diario', type: 'positive' },
      { name: 'Monitoria ≥ 99%', description: 'Avaliação de qualidade com nota 99% ou superior', points: 15, periodicity: 'monitoria', type: 'positive' },
      { name: 'NPS ≥ 92', description: 'Satisfação do usuário semanal com nota ≥ 92', points: 10, periodicity: 'semanal', type: 'positive' },
      { name: 'ABS zerado', description: 'Zero absenteísmo no período mensal', points: 10, periodicity: 'mensal', type: 'positive' },
      { name: '100% de aderência à escala', description: 'Aderência perfeita à escala diária', points: 15, periodicity: 'diario', type: 'positive' },
      { name: 'Dia sem atraso', description: 'Sem registros de atrasos na jornada do dia (+5 pts por dia)', points: 5, periodicity: 'diario', type: 'positive' },
      { name: 'Nenhuma ocorrência disciplinar', description: 'Período sem ocorrências registradas', points: 10, periodicity: 'avulso', type: 'positive' },
      { name: 'Semana sem falta injustificada', description: 'Frequência 100% na semana útil', points: 5, periodicity: 'semanal', type: 'positive' },
      
      // Negative Rules
      { name: 'Atraso não justificado', description: 'Registro de atraso sem justificativa aceita', points: -5, periodicity: 'diario', type: 'negative' },
      { name: 'Pausa excedida sem justificativa', description: 'Tempo de pausa excedeu o limite operacional', points: -5, periodicity: 'diario', type: 'negative' },
      { name: 'Falta injustificada', description: 'Ausência sem justificativa válida', points: -50, periodicity: 'diario', type: 'negative' },
      { name: 'Monitoria abaixo de 95%', description: 'Qualidade abaixo do padrão mínimo esperado', points: -10, periodicity: 'monitoria', type: 'negative' },
      { name: 'Comportamento incompatível com a operação', description: 'Conduta inadequada na operação 156', points: -10, periodicity: 'avulso', type: 'negative' }
    ];

    const insertRule = db.prepare(`
      INSERT INTO point_rules (name, description, points, periodicity, type, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    for (const rule of rules) {
      insertRule.run(rule.name, rule.description, rule.points, rule.periodicity, rule.type);
    }
    console.log('Seeded point rules');
  }

  // 4. Seed Sample Operators if not existing
  const opCount = db.prepare('SELECT COUNT(*) as count FROM operators').get().count;
  if (opCount === 0) {
    const operatorsData = [
      { name: 'Pedro Silva', registration: 'OP15601' },
      { name: 'Maria Santos', registration: 'OP15602' },
      { name: 'João Oliveira', registration: 'OP15603' },
      { name: 'Ana Costa', registration: 'OP15604' },
      { name: 'Carlos Eduardo', registration: 'OP15605' },
      { name: 'Rafael Souza', registration: 'OP15606' },
      { name: 'Fernanda Lima', registration: 'OP15607' },
      { name: 'Lucas Mendes', registration: 'OP15608' },
      { name: 'Juliana Ferreira', registration: 'OP15609' },
      { name: 'Gabriel Alves', registration: 'OP15610' },
      { name: 'Beatriz Rocha', registration: 'OP15611' },
      { name: 'Thiago Barbosa', registration: 'OP15612' },
      { name: 'Camila Ribeiro', registration: 'OP15613' },
      { name: 'Bruno Martins', registration: 'OP15614' },
      { name: 'Patricia Gomes', registration: 'OP15615' },
      { name: 'Rodrigo Carvalho', registration: 'OP15616' },
      { name: 'Vanessa Cardoso', registration: 'OP15617' },
      { name: 'Diego Ramos', registration: 'OP15618' },
      { name: 'Larissa Teixeira', registration: 'OP15619' },
      { name: 'Marcelo Dias', registration: 'OP15620' }
    ];

    const insertOp = db.prepare(`
      INSERT INTO operators (name, registration, status)
      VALUES (?, ?, 'active')
    `);

    for (const op of operatorsData) {
      insertOp.run(op.name, op.registration);
    }
    console.log('Seeded initial operators');

    // 5. Seed sample initial transactions so dashboard & rankings display realistic data!
    const allOps = db.prepare('SELECT * FROM operators').all();
    const rulesList = db.prepare('SELECT * FROM point_rules').all();
    const ruleMap = {};
    rulesList.forEach(r => { ruleMap[r.name] = r; });

    const insertTx = db.prepare(`
      INSERT INTO point_transactions (operator_id, campaign_id, rule_id, points, event_date, description, observation, indicator_value, is_adjustment, created_by, created_at)
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, 0, 'Sistema', ?)
    `);

    // Give top operators realistic points structure
    // Pedro Silva (Rank 1 - target ~387 points)
    const pedro = allOps.find(o => o.name === 'Pedro Silva');
    if (pedro) {
      // Multiple entries for Pedro
      insertTx.run(pedro.id, ruleMap['Monitoria ≥ 99%'].id, 15, '2026-09-01', 'Monitoria ≥ 99%', 'Nota 100%', '100%', '2026-09-01 09:00:00');
      insertTx.run(pedro.id, ruleMap['Atingir TMA dentro da meta'].id, 10, '2026-09-01', 'TMA dentro da meta', 'TMA 3:45', '3:45', '2026-09-01 18:00:00');
      insertTx.run(pedro.id, ruleMap['Dia sem atraso'].id, 5, '2026-09-01', 'Dia sem atraso', 'Jornada pontual', null, '2026-09-01 18:05:00');
      insertTx.run(pedro.id, ruleMap['100% de aderência à escala'].id, 15, '2026-09-01', '100% de aderência à escala', 'Aderencia perfeita', '100%', '2026-09-01 18:10:00');
      insertTx.run(pedro.id, ruleMap['NPS ≥ 92'].id, 10, '2026-09-02', 'NPS ≥ 92', 'NPS Semanal 96', '96', '2026-09-02 10:00:00');
      // Give additional points to bring up to ~387
      for (let day = 2; day <= 15; day++) {
        const dateStr = `2026-09-${String(day).padStart(2, '0')}`;
        insertTx.run(pedro.id, ruleMap['Atingir TMA dentro da meta'].id, 10, dateStr, 'TMA dentro da meta', 'Meta batida', '3:40', `${dateStr} 18:00:00`);
        insertTx.run(pedro.id, ruleMap['100% de aderência à escala'].id, 15, dateStr, '100% de aderência à escala', 'Aderencia 100%', '100%', `${dateStr} 18:05:00`);
      }
    }

    // Maria Santos (Rank 2 - target ~342 points)
    const maria = allOps.find(o => o.name === 'Maria Santos');
    if (maria) {
      for (let day = 1; day <= 14; day++) {
        const dateStr = `2026-09-${String(day).padStart(2, '0')}`;
        insertTx.run(maria.id, ruleMap['Atingir TMA dentro da meta'].id, 10, dateStr, 'TMA dentro da meta', 'Meta batida', '3:50', `${dateStr} 18:00:00`);
        insertTx.run(maria.id, ruleMap['Dia sem atraso'].id, 5, dateStr, 'Dia sem atraso', 'Sem atrasos', null, `${dateStr} 18:05:00`);
        if (day % 3 === 0) {
          insertTx.run(maria.id, ruleMap['Monitoria ≥ 99%'].id, 15, dateStr, 'Monitoria ≥ 99%', 'Nota 99.5%', '99.5%', `${dateStr} 14:00:00`);
        }
      }
    }

    // João Oliveira (Rank 3 - target ~298 points)
    const joao = allOps.find(o => o.name === 'João Oliveira');
    if (joao) {
      for (let day = 1; day <= 12; day++) {
        const dateStr = `2026-09-${String(day).padStart(2, '0')}`;
        insertTx.run(joao.id, ruleMap['100% de aderência à escala'].id, 15, dateStr, '100% de aderência à escala', 'Aderente', '100%', `${dateStr} 18:00:00`);
        insertTx.run(joao.id, ruleMap['Dia sem atraso'].id, 5, dateStr, 'Dia sem atraso', 'Sem atraso', null, `${dateStr} 18:05:00`);
      }
      insertTx.run(joao.id, ruleMap['Pausa excedida sem justificativa'].id, -5, '2026-09-04', 'Pausa excedida sem justificativa', 'Excedeu 3m', null, '2026-09-04 15:00:00');
    }

    // Add points for all other operators to populate standings
    allOps.forEach((op, index) => {
      if (['Pedro Silva', 'Maria Santos', 'João Oliveira'].includes(op.name)) return;
      const basePts = 250 - (index * 10);
      insertTx.run(op.id, ruleMap['Atingir TMA dentro da meta'].id, Math.max(10, basePts), '2026-09-01', 'Lançamento inicial de desempenho', 'Pontuação inicial da campanha', null, '2026-09-01 10:00:00');
    });

    // Sync ticket count for all operators
    allOps.forEach(op => {
      syncOperatorTickets(op.id, 1);
    });
    console.log('Seeded initial point transactions & synced tickets');

    // 6. Seed sample Weekly Highlights
    if (pedro && maria && joao) {
      db.prepare(`
        INSERT INTO weekly_highlights (operator_id, category, points, week_reference)
        VALUES 
          (?, 'NPS', 10, '2026-W36'),
          (?, 'Qualidade', 10, '2026-W36'),
          (?, 'TMA', 10, '2026-W36')
      `).run(pedro.id, maria.id, joao.id);
    }

    // 7. Seed sample Special Challenges
    db.prepare(`
      INSERT INTO challenges (name, description, start_date, end_date, reward_points, status)
      VALUES 
        ('Semana da Excelência', 'Manter monitoria de qualidade acima de 99% durante toda a semana.', '2026-09-01', '2026-09-07', 30, 'ativo'),
        ('Desafio TMA Turbo', 'Superar a meta de TMA em pelo menos 15 segundos em 3 dias seguidos.', '2026-09-08', '2026-09-14', 25, 'ativo')
    `).run();

    // 8. Seed sample Prizes
    if (pedro && maria) {
      db.prepare(`
        INSERT INTO prizes (operator_id, name, category, status, observation)
        VALUES 
          (?, 'Saída 30 minutos mais cedo', 'saida_mais_cedo', 'Pendente', 'Conquistado na Roleta 156'),
          (?, 'Pausa extra de 15 min', 'pausa_extra', 'Utilizado', 'Utilizado em 03/09')
      `).run(pedro.id, maria.id);
    }

    // 9. Seed sample Roulette Spins
    if (pedro) {
      db.prepare(`
        INSERT INTO roulette_spins (operator_id, prize, prize_type, points, created_by)
        VALUES (?, 'Saída 30 minutos mais cedo', 'early_leave', 0, 'Admin')
      `).run(pedro.id);
    }
  }
}

module.exports = seedDatabase;
