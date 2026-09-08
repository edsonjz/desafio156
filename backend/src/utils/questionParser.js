const xlsx = require('xlsx');

async function parseQuestionsFromBuffer(buffer, filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelQuestions(buffer);
  } else if (ext === 'pdf') {
    return await parsePdfQuestions(buffer);
  } else {
    throw new Error('Formato de arquivo não suportado. Envie um arquivo Excel (.xlsx, .xls) ou PDF (.pdf).');
  }
}

function parseExcelQuestions(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rows || rows.length === 0) {
    throw new Error('A planilha enviada está vazia.');
  }

  const questions = [];

  rows.forEach((row, idx) => {
    // Helper to find column case-insensitively
    const getVal = (...keys) => {
      for (const k of keys) {
        const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
        if (foundKey && String(row[foundKey]).trim()) {
          return String(row[foundKey]).trim();
        }
      }
      return '';
    };

    const numero = Number(getVal('numero', 'número', 'num', 'questao', 'questão', 'item')) || (idx + 1);
    const enunciado = getVal('enunciado', 'pergunta', 'texto', 'questao', 'questão', 'descricao', 'descrição');
    
    if (!enunciado) {
      return; // Skip empty rows
    }

    const altA = getVal('a', 'alternativa a', 'alt a', 'opcao a', 'opção a');
    const altB = getVal('b', 'alternativa b', 'alt b', 'opcao b', 'opção b');
    const altC = getVal('c', 'alternativa c', 'alt c', 'opcao c', 'opção c');
    const altD = getVal('d', 'alternativa d', 'alt d', 'opcao d', 'opção d');
    const altE = getVal('e', 'alternativa e', 'alt e', 'opcao e', 'opção e');

    const gabaritoRaw = getVal('correta', 'gabarito', 'resposta', 'certa', 'alt_correta', 'alternativa_correta').toUpperCase();
    let letraCorreta = 'A';
    if (gabaritoRaw.includes('B')) letraCorreta = 'B';
    else if (gabaritoRaw.includes('C')) letraCorreta = 'C';
    else if (gabaritoRaw.includes('D')) letraCorreta = 'D';
    else if (gabaritoRaw.includes('E')) letraCorreta = 'E';
    else if (gabaritoRaw.includes('A')) letraCorreta = 'A';

    let dificuldade = getVal('dificuldade', 'nivel', 'nível').toLowerCase();
    if (!['facil', 'medio', 'dificil'].includes(dificuldade)) {
      if (numero <= 10) dificuldade = 'facil';
      else if (numero <= 15) dificuldade = 'medio';
      else dificuldade = 'dificil';
    }

    const alternativas = [];
    if (altA) alternativas.push({ letra: 'A', texto: altA, is_correta: letraCorreta === 'A' });
    if (altB) alternativas.push({ letra: 'B', texto: altB, is_correta: letraCorreta === 'B' });
    if (altC) alternativas.push({ letra: 'C', texto: altC, is_correta: letraCorreta === 'C' });
    if (altD) alternativas.push({ letra: 'D', texto: altD, is_correta: letraCorreta === 'D' });
    if (altE) alternativas.push({ letra: 'E', texto: altE, is_correta: letraCorreta === 'E' });

    // Fallback: if no is_correta was matched and we have alternatives, mark first as correct
    if (alternativas.length > 0 && !alternativas.some(a => a.is_correta)) {
      alternativas[0].is_correta = true;
    }

    if (alternativas.length >= 2) {
      questions.push({
        numero,
        enunciado,
        dificuldade,
        alternativas
      });
    }
  });

  if (questions.length === 0) {
    throw new Error('Nenhuma questão válida com enunciado e alternativas foi identificada na planilha.');
  }

  return questions;
}

async function parsePdfQuestions(buffer) {
  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch (e) {
    throw new Error('Biblioteca de processamento de PDF não instalada.');
  }

  const data = await pdfParse(buffer);
  const text = data.text || '';

  if (!text.trim()) {
    throw new Error('O arquivo PDF não contém texto legível ou é uma imagem escaneada.');
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const questions = [];

  let currentQuestion = null;
  let currentAlt = null;

  const questionRegex = /^(?:quest[aã]o|pergunta|\d+[\.\-\)])\s*(\d+)?[\.\-\:\)]?\s*(.*)/i;
  const altRegex = /^([a-eA-E])[\.\-\)\:]\s*(.*)/;
  const gabaritoRegex = /(?:gabarito|resposta|correta)[\:\s]+([a-eA-E])/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check gabarito
    const gabMatch = line.match(gabaritoRegex);
    if (gabMatch && currentQuestion) {
      const letra = gabMatch[1].toUpperCase();
      currentQuestion.alternativas.forEach(a => {
        a.is_correta = (a.letra === letra);
      });
      continue;
    }

    // Check alternative
    const altMatch = line.match(altRegex);
    if (altMatch && currentQuestion) {
      const letra = altMatch[1].toUpperCase();
      const texto = altMatch[2] || '';
      currentAlt = { letra, texto, is_correta: false };
      currentQuestion.alternativas.push(currentAlt);
      continue;
    }

    // Check start of new question
    const qMatch = line.match(questionRegex);
    if (qMatch && (line.toLowerCase().includes('quest') || /^\d+[\.\-\)]/.test(line))) {
      if (currentQuestion && currentQuestion.alternativas.length >= 2) {
        questions.push(currentQuestion);
      }

      const qNum = qMatch[1] ? Number(qMatch[1]) : (questions.length + 1);
      const enunciado = qMatch[2] || line;

      let dificuldade = 'facil';
      if (qNum > 15) dificuldade = 'dificil';
      else if (qNum > 10) dificuldade = 'medio';

      currentQuestion = {
        numero: qNum,
        enunciado,
        dificuldade,
        alternativas: []
      };
      currentAlt = null;
      continue;
    }

    // Append to current alternative or question
    if (currentAlt) {
      currentAlt.texto += ' ' + line;
    } else if (currentQuestion) {
      currentQuestion.enunciado += ' ' + line;
    }
  }

  if (currentQuestion && currentQuestion.alternativas.length >= 2) {
    questions.push(currentQuestion);
  }

  // Ensure each question has at least one correct alternative
  questions.forEach(q => {
    if (!q.alternativas.some(a => a.is_correta) && q.alternativas.length > 0) {
      q.alternativas[0].is_correta = true;
    }
  });

  if (questions.length === 0) {
    throw new Error('Não foi possível identificar questões estruturadas no PDF. Verifique se o formato contém questões numeradas e alternativas A, B, C, D.');
  }

  return questions;
}

module.exports = {
  parseQuestionsFromBuffer
};
