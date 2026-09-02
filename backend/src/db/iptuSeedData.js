// 20 Questões Oficiais — Avaliação de Conhecimentos IPTU e TCL de Porto Alegre (156+POA)
// Classificação:
// 1 a 10: Fácil
// 11 a 15: Médio
// 16 a 20: Difícil
//
// Gabarito Oficial:
// 1: C, 2: B, 3: B, 4: C, 5: A, 6: B, 7: B, 8: B, 9: A, 10: A
// 11: B, 12: B, 13: B, 14: B, 15: A, 16: B, 17: C, 18: B, 19: A, 20: D

const IPTU_QUESTIONS_DATA = [
  // FÁCIL (1 a 10)
  {
    numero: 1,
    dificuldade: 'facil',
    enunciado: 'Qual é o fato gerador do IPTU (Imposto Predial e Territorial Urbano) no Município de Porto Alegre?',
    alternativas: [
      { letra: 'A', texto: 'A realização de obras de infraestrutura urbana em frente ao imóvel.' },
      { letra: 'B', texto: 'A prestação de serviços de coleta de resíduos sólidos domiciliares.' },
      { letra: 'C', texto: 'A propriedade, o domínio útil ou a posse de bem imóvel por natureza ou por acessão física localizado na zona urbana do Município.' },
      { letra: 'D', texto: 'A transferência onerosa da propriedade imobiliária entre pessoas vivas.' }
    ],
    correta: 'C',
    justificativa: 'Conforme a Lei Complementar Municipal nº 07/1973 (Código Tributário Municipal de Porto Alegre) e o CTN (art. 32), o fato gerador do IPTU é a propriedade, o domínio útil ou a posse a qualquer título de bem imóvel construído (predial) ou não construído (territorial) na zona urbana.'
  },
  {
    numero: 2,
    dificuldade: 'facil',
    enunciado: 'A TCL (Taxa de Coleta de Lixo) cobrada juntamente com o IPTU em Porto Alegre tem como finalidade custear:',
    alternativas: [
      { letra: 'A', texto: 'A iluminação pública e a pavimentação asfáltica das vias municipais.' },
      { letra: 'B', texto: 'A prestação dos serviços públicos municipais específicos e divisíveis de coleta, transporte e destinação final de resíduos sólidos domiciliares.' },
      { letra: 'C', texto: 'A fiscalização de posturas municipais e vigilância sanitária em imóveis comerciais.' },
      { letra: 'D', texto: 'O policiamento ostensivo e monitoramento por câmeras na cidade.' }
    ],
    correta: 'B',
    justificativa: 'A Taxa de Coleta de Lixo (TCL) possui como fato gerador a utilização efetiva ou a disponibilização dos serviços específicos e divisíveis de coleta, remoção e destinação de lixo domiciliar, nos termos do CTM de Porto Alegre.'
  },
  {
    numero: 3,
    dificuldade: 'facil',
    enunciado: 'O contribuinte que optar pelo pagamento do IPTU em cota única até a data limite estabelecida no início do ano civil pela Prefeitura de Porto Alegre tem direito a:',
    alternativas: [
      { letra: 'A', texto: 'Isenção total da Taxa de Coleta de Lixo (TCL).' },
      { letra: 'B', texto: 'Desconto financeiro sobre o valor do IPTU, além de eventuais descontos acumulados por inclusão de CPF na Nota Fiscal de Serviços (Nota Fiscal Gaúcha/Cidadão).' },
      { letra: 'C', texto: 'Dispensa de pagamento de qualquer tributo municipal pelos próximos 2 anos.' },
      { letra: 'D', texto: 'Conversão automática do imposto pago em créditos de transporte público.' }
    ],
    correta: 'B',
    justificativa: 'A legislação tributária municipal de Porto Alegre prevê desconto por antecipação de pagamento em cota única no mês de janeiro, cumulável com programas de desconto por incentivo à cidadania fiscal (ex: Nota Fiscal Eletrônica de Serviços com CPF).'
  },
  {
    numero: 4,
    dificuldade: 'facil',
    enunciado: 'Caso o contribuinte não pague o IPTU e a TCL em cota única, o lançamento municipal possibilita o pagamento:',
    alternativas: [
      { letra: 'A', texto: 'Apenas mediante depósito judicial em conta do Tribunal de Justiça.' },
      { letra: 'B', texto: 'Exclusivamente por desconto em folha de pagamento de servidores públicos.' },
      { letra: 'C', texto: 'Parcelado em até 10 (dez) quotas mensais e sucessivas, com vencimentos fixados pela Secretaria Municipal da Fazenda.' },
      { letra: 'D', texto: 'Em 24 parcelas semanais sem encargos moratórios.' }
    ],
    correta: 'C',
    justificativa: 'O IPTU e a TCL em Porto Alegre podem ser quitados parceladamente em até 10 parcelas mensais, vencendo de março a dezembro de cada exercício fiscal.'
  },
  {
    numero: 5,
    dificuldade: 'facil',
    enunciado: 'Para emitir a 2ª via da guia de arrecadação do IPTU pelo portal oficial ou orientar o munícipe pelo 156+POA, qual informação principal é indispensável identificar no carnê ou cadastro?',
    alternativas: [
      { letra: 'A', texto: 'O número da Inscrição Municipal do Imóvel (número do imóvel / cadastro fiscal imobiliário).' },
      { letra: 'B', texto: 'A certidão de nascimento do proprietário do imóvel.' },
      { letra: 'C', texto: 'O comprovante de quitação eleitoral do morador atual.' },
      { letra: 'D', texto: 'A chave Pix de transferência bancária do inquilino.' }
    ],
    correta: 'A',
    justificativa: 'A Inscrição do Imóvel (Cadastro Fiscal Imobiliário) é o identificador único oficial exigido no portal da SMF e no atendimento 156 para localizar o lançamento de IPTU/TCL e emitir guias de arrecadação.'
  },
  {
    numero: 6,
    dificuldade: 'facil',
    enunciado: 'Qual é o canal digital oficial da Secretaria Municipal da Fazenda de Porto Alegre para consulta de débitos, emissão de guias e parcelamentos de IPTU/TCL?',
    alternativas: [
      { letra: 'A', texto: 'Portal de Compras do Governo Federal (ComprasNet).' },
      { letra: 'B', texto: 'Portal da Secretaria Municipal da Fazenda de Porto Alegre (SMF) e App 156+POA / WhatsApp 156.' },
      { letra: 'C', texto: 'Sistema de Acompanhamento Processual do STF.' },
      { letra: 'D', texto: 'Plataforma Gov.br da Previdência Social (Meu INSS).' }
    ],
    correta: 'B',
    justificativa: 'A SMF de Porto Alegre disponibiliza atendimento e autosserviço através do Portal Oficial da Fazenda de POA, integrado ao ecossistema 156+POA (site, aplicativo móvel e canal WhatsApp oficial).'
  },
  {
    numero: 7,
    dificuldade: 'facil',
    enunciado: 'O que ocorre quando o pagamento de uma parcela do IPTU é efetuado após a sua respectiva data de vencimento?',
    alternativas: [
      { letra: 'A', texto: 'O imóvel é desapropriado sumariamente no dia seguinte.' },
      { letra: 'B', texto: 'Incidem acréscimos legais previstos em lei municipal, tais como juros de mora, multa moratória e atualização monetária.' },
      { letra: 'C', texto: 'A dívida é perdoada automaticamente pelo sistema sem qualquer ônus.' },
      { letra: 'D', texto: 'O contribuinte perde o direito de utilizar água e energia elétrica.' }
    ],
    correta: 'B',
    justificativa: 'Conforme as normas do Código Tributário Municipal, o pagamento intempestivo acarreta a aplicação de juros de mora (1% ao mês ou fração), multa de mora escalonada e correção pela variação do índice oficial do município.'
  },
  {
    numero: 8,
    dificuldade: 'facil',
    enunciado: 'A base de cálculo do IPTU predial e territorial no Município de Porto Alegre é:',
    alternativas: [
      { letra: 'A', texto: 'O valor da renda bruta mensal comprovada do contribuinte.' },
      { letra: 'B', texto: 'O valor venal do bem imóvel apurado segundo a Planta Genérica de Valores (PGV) e critérios cadastrais do Município.' },
      { letra: 'C', texto: 'O valor do aluguel estipulado em contrato particular de locação.' },
      { letra: 'D', texto: 'A média das faturas de energia elétrica e água dos últimos 12 meses.' }
    ],
    correta: 'B',
    justificativa: 'O art. 33 do CTN e a LC nº 07/73 de Porto Alegre determinam que a base de cálculo do IPTU é o valor venal do imóvel, apurado pela administração tributária por meio da Planta de Valores.'
  },
  {
    numero: 9,
    dificuldade: 'facil',
    enunciado: 'Em relação à responsabilidade pelo pagamento do IPTU, perante a Fazenda Municipal de Porto Alegre, quem é o sujeito passivo principal da obrigação tributária?',
    alternativas: [
      { letra: 'A', texto: 'O proprietário do imóvel, o titular do seu domínio útil ou o seu possuidor a qualquer título.' },
      { letra: 'B', texto: 'Exclusivamente a imobiliária que intermediou a locação do bem.' },
      { letra: 'C', texto: 'O síndico do condomínio edilício em seu CPF pessoal.' },
      { letra: 'D', texto: 'O agente de atendimento do 156+POA que orientou o munícipe.' }
    ],
    correta: 'A',
    justificativa: 'O sujeito passivo da obrigação tributária principal do IPTU é o proprietário, o titular do domínio útil ou o possuidor a título de proprietário (art. 34 do CTN e Código Tributário de Porto Alegre).'
  },
  {
    numero: 10,
    dificuldade: 'facil',
    enunciado: 'Quando um munícipe entra em contato com o 156+POA informando que não recebeu a guia física do IPTU em sua residência, qual a orientação correta e imediata a ser prestada?',
    alternativas: [
      { letra: 'A', texto: 'Orientar o cidadão a emitir a guia digitalmente pelo Portal da Fazenda de POA ou canais 156+POA informando o número da inscrição imobiliária, ou comparecer à Loja de Atendimento da SMF.' },
      { letra: 'B', texto: 'Informar que ele está dispensado de pagar o imposto daquele ano.' },
      { letra: 'C', texto: 'Transferir a ligação para o Corpo de Bombeiros Militar.' },
      { letra: 'D', texto: 'Recomendar que ele pague o IPTU de outro município do estado.' }
    ],
    correta: 'A',
    justificativa: 'O não recebimento do carnê pelos Correios não desobriga o pagamento no prazo. O operador 156 deve orientar a emissão da 2ª via pelo Portal da SMF, WhatsApp 156, App 156+POA ou atendimento presencial.'
  },

  // MÉDIO (11 a 15)
  {
    numero: 11,
    dificuldade: 'medio',
    enunciado: 'Sobre o benefício fiscal de isenção de IPTU concedido a aposentados e pensionistas de baixa renda em Porto Alegre, assinale a alternativa correta:',
    alternativas: [
      { letra: 'A', texto: 'O benefício é automático e concedido a qualquer cidadão que atinja 50 anos, sem necessidade de requisitos de renda ou propriedade de único imóvel.' },
      { letra: 'B', texto: 'É necessário cumprir requisitos cumulativos previstos na legislação municipal (como limite de renda mensal, ser proprietário de um único imóvel e utilizá-lo como residência própria) e requerer formalmente dentro do prazo regulamentar.' },
      { letra: 'C', texto: 'A isenção concedida para o IPTU estende-se automaticamente a multas de trânsito e taxas de licenciamento de veículos.' },
      { letra: 'D', texto: 'O aposentado beneficiário de isenção fica permanentemente dispensado de qualquer taxa, inclusive da taxa de água (DMAE) e coleta de lixo sem limite.' }
    ],
    correta: 'B',
    justificativa: 'A isenção para aposentados/pensionistas exige preenchimento dos critérios da LC 07/73 (renda familiar limitada a tetos em UVF/salários mínimos, imóvel único de moradia própria e formalização do pedido junto à SMF).'
  },
  {
    numero: 12,
    dificuldade: 'medio',
    enunciado: 'Se existir cláusula no contrato de locação estabelecendo que o inquilino é o responsável pelo pagamento do IPTU, qual a validade dessa cláusula perante a Fazenda Municipal de Porto Alegre?',
    alternativas: [
      { letra: 'A', texto: 'A cláusula substitui o proprietário no polo passivo da cobrança judicial, tornando a Fazenda Municipal impedida de cobrar o proprietário.' },
      { letra: 'B', texto: 'A convenção particular entre proprietário e inquilino não pode ser oposta à Fazenda Municipal (art. 123 do CTN), permanecendo o proprietário como responsável tributário perante o Município.' },
      { letra: 'C', texto: 'O contrato particular extingue imediatamente o crédito tributário e transfere o cadastro fiscal para o nome do fiador.' },
      { letra: 'D', texto: 'A cláusula contratual anula todas as dívidas anteriores de IPTU e TCL do imóvel.' }
    ],
    correta: 'B',
    justificativa: 'Nos termos do art. 123 do Código Tributário Nacional (CTN), convenções particulares relativas à responsabilidade pelo pagamento de tributos não podem ser opostas à Fazenda Pública para modificar a definição legal do sujeito passivo.'
  },
  {
    numero: 13,
    dificuldade: 'medio',
    enunciado: 'Quando um débito de IPTU/TCL não é pago no exercício de lançamento e é inscrito em Dívida Ativa do Município de Porto Alegre, qual consequência ocorre?',
    alternativas: [
      { letra: 'A', texto: 'O débito é cancelado após 30 dias por decurso de prazo administrativo.' },
      { letra: 'B', texto: 'O débito é acrescido de encargos de dívida ativa, passa a ser cobrado pela Procuradoria-Geral do Município (PGM) e pode ser objeto de protesto extrajudicial e execução fiscal judicial.' },
      { letra: 'C', texto: 'O cadastro do munícipe é suspenso do SUS e da rede municipal de ensino.' },
      { letra: 'D', texto: 'O contribuinte passa a pagar o imposto em dobro no exercício seguinte via carnê simplificado.' }
    ],
    correta: 'B',
    justificativa: 'A inscrição em Dívida Ativa confere liquidez e certeza ao título executivo (CDA), transferindo a cobrança para a PGM, sujeitando o devedor a protesto em cartório e ação de execução fiscal com penhora de bens.'
  },
  {
    numero: 14,
    dificuldade: 'medio',
    enunciado: 'Qual é o procedimento cabível para o contribuinte que discordar formalmente dos dados cadastrais ou do valor venal lançado no seu carnê de IPTU de Porto Alegre?',
    alternativas: [
      { letra: 'A', texto: 'Registrar um boletim de ocorrência na Delegacia de Polícia Civil para trancamento do lançamento.' },
      { letra: 'B', texto: 'Abrir processo administrativo de Reclamação/Impugnação contra o Lançamento junto à Secretaria Municipal da Fazenda dentro do prazo regulamentar fixado no edital de lançamento.' },
      { letra: 'C', texto: 'Efetuar o pagamento com valor reduzido decidido por conta própria diretamente na lotérica.' },
      { letra: 'D', texto: 'Solicitar o cancelamento do IPTU diretamente ao Procon Municipal em formulário genérico.' }
    ],
    correta: 'B',
    justificativa: 'A impugnação ao lançamento do IPTU/TCL deve ser formulada por meio de processo administrativo tributário instruído com documentos probatórios junto à SMF no prazo legal previsto no edital.'
  },
  {
    numero: 15,
    dificuldade: 'medio',
    enunciado: 'Em relação ao parcelamento administrativo de débitos tributários de IPTU em Porto Alegre, assinale a opção verdadeira:',
    alternativas: [
      { letra: 'A', texto: 'O parcelamento pode ser solicitado pelo contribuinte ou seu procurador habilitado, respeitadas as condições e número de parcelas fixados na legislação municipal vigente, implicando confissão irretratável da dívida.' },
      { letra: 'B', texto: 'O parcelamento garante desconto de 90% sobre o valor principal do tributo a qualquer época do ano.' },
      { letra: 'C', texto: 'É proibido parcelar débitos de IPTU que tenham ultrapassado 6 meses de atraso.' },
      { letra: 'D', texto: 'O parcelamento é concedido exclusivamente a pessoas jurídicas com faturamento acima de 1 milhão de reais.' }
    ],
    correta: 'A',
    justificativa: 'O parcelamento administrativo de créditos tributários no Município de Porto Alegre constitui ato de adesão que importa no reconhecimento e confissão irretratável do débito pelo contribuinte, com parcelas mensais corrigidas.'
  },

  // DIFÍCIL (16 a 20)
  {
    numero: 16,
    dificuldade: 'dificil',
    enunciado: 'No caso de alienação de imóvel com débitos pendentes de IPTU e TCL, em que o comprador não exige a Certidão Negativa de Débitos (CND) Tributários Municipais no momento da escritura, como se dá a responsabilidade tributária (art. 130 do CTN)?',
    alternativas: [
      { letra: 'A', texto: 'Os débitos são extintos automaticamente, pois a dívida acompanha unicamente o CPF do antigo proprietário sem atingir o novo adquirente.' },
      { letra: 'B', texto: 'Os créditos tributários sub-rogam-se na pessoa dos respectivos adquirentes, respondendo o novo proprietário pelos débitos preexistentes do imóvel perante o Município, salvo quando conste da escritura prova de sua quitação.' },
      { letra: 'C', texto: 'O Município perde o direito de cobrar o tributo e deve indenizar o novo comprador por danos morais.' },
      { letra: 'D', texto: 'A responsabilidade recai integralmente sobre o tabelião de notas em seu patrimônio privado.' }
    ],
    correta: 'B',
    justificativa: 'Conforme o art. 130 do CTN, os créditos tributários relativos a impostos cujo fato gerador seja a propriedade imobiliária sub-rogam-se na pessoa dos adquirentes, salvo se constar na escritura pública prova de plena quitação.'
  },
  {
    numero: 17,
    dificuldade: 'dificil',
    enunciado: 'Para efetuar a alteração de titularidade (transferência de nome) no Cadastro Fiscal Imobiliário do IPTU na Prefeitura de Porto Alegre após a compra de um imóvel, qual documento é indispensável apresentar?',
    alternativas: [
      { letra: 'A', texto: 'Apenas uma declaração de próprio punho com firma reconhecida por semelhança do novo morador.' },
      { letra: 'B', texto: 'Comprovante de pagamento de contas de água dos últimos 3 meses em nome do síndico.' },
      { letra: 'C', texto: 'A Matrícula atualizada do Imóvel expedida pelo Registro de Imóveis competente constando o registro da transferência de propriedade (ou título aquisitivo hábil) e a comprovação da regularidade do ITBI.' },
      { letra: 'D', texto: 'Contrato de gaveta sem assinatura de testemunhas nem registro imobiliário.' }
    ],
    correta: 'C',
    justificativa: 'A transferência da titularidade cadastral no IPTU de Porto Alegre exige a apresentação da certidão de matrícula imobiliária atualizada com o registro da transmissão e quitação/exoneração do ITBI.'
  },
  {
    numero: 18,
    dificuldade: 'dificil',
    enunciado: 'A respeito da imunidade tributária de IPTU prevista na Constituição Federal (art. 150, VI) para templos de qualquer culto e entidades sem fins lucrativos em Porto Alegre, assinale a afirmativa correta:',
    alternativas: [
      { letra: 'A', texto: 'A imunidade independe de qualquer requisito e abrange inclusive imóveis comerciais alugados a terceiros cuja renda seja distribuída aos dirigentes.' },
      { letra: 'B', texto: 'A imunidade abrange os imóveis relacionados com as finalidades essenciais da entidade ou cuja renda gerada seja integralmente revertida para a consecução de seus objetivos institucionais, devendo ser formalmente reconhecida pela SMF.' },
      { letra: 'C', texto: 'Entidades religiosas são obrigadas a pagar alíquota majorada progressiva de IPTU no centro da capital.' },
      { letra: 'D', texto: 'A imunidade de IPTU exclui compulsoriamente o pagamento de tarifas públicas como DMAE e energia elétrica.' }
    ],
    correta: 'B',
    justificativa: 'A imunidade constitucional condiciona-se à vinculação do imóvel às finalidades essenciais ou à aplicação integral de suas rendas nos objetivos estatutários da instituição, exigindo procedimento administrativo perante a SMF.'
  },
  {
    numero: 19,
    dificuldade: 'dificil',
    enunciado: 'Sobre a aplicação da alíquota progressiva do IPTU e do IPTU Progressivo no Tempo no Município de Porto Alegre (decorrente do Plano Diretor e Estatuto da Cidade), qual é a sua finalidade principal?',
    alternativas: [
      { letra: 'A', texto: 'Assegurar o cumprimento da função social da propriedade urbana, induzindo o adequado aproveitamento de imóveis urbanos não edificados, subutilizados ou não utilizados.' },
      { letra: 'B', texto: 'Aumentar a arrecadação municipal exclusivamente para financiar viagens internacionais de gestores.' },
      { letra: 'C', texto: 'Impedir que famílias de baixa renda possam adquirir imóveis próprios na região central.' },
      { letra: 'D', texto: 'Substituir a taxa de iluminação pública em áreas rurais do município.' }
    ],
    correta: 'A',
    justificativa: 'O IPTU progressivo no tempo (art. 182 da CF/88, art. 7º do Estatuto da Cidade e Plano Diretor de POA) visa combater a especulação imobiliária e garantir a função social da propriedade urbana sobre solo subutilizado ou não edificado.'
  },
  {
    numero: 20,
    dificuldade: 'dificil',
    enunciado: 'Em relação à Certidão Negativa de Débitos (CND) Imobiliária emitida pela Secretaria Municipal da Fazenda de Porto Alegre, quando existirem débitos com exigibilidade suspensa (por exemplo, parcelamento em dia ou depósito judicial integral), qual documento é expedido pelo sistema fiscal?',
    alternativas: [
      { letra: 'A', texto: 'Auto de Infração com Imposição de Multa cominatória.' },
      { letra: 'B', texto: 'Certidão de Falência e Recuperação Judicial.' },
      { letra: 'C', texto: 'Declaração de Inadimplência Notória e Perda de Posse.' },
      { letra: 'D', texto: 'Certidão Positiva com Efeitos de Negativa (CPEN), que possui os mesmos efeitos jurídicos da Certidão Negativa para todos os fins de direito (art. 206 do CTN).' }
    ],
    correta: 'D',
    justificativa: 'Conforme o art. 206 do Código Tributário Nacional, tem os mesmos efeitos de certidão negativa a certidão que constar a existência de créditos não vencidos ou em curso de cobrança executiva em que tenha sido efetivada a penhora, ou cuja exigibilidade esteja suspensa (Certidão Positiva com Efeitos de Negativa).'
  }
];

module.exports = {
  IPTU_QUESTIONS_DATA
};
