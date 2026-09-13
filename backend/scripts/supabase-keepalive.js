/**
 * ============================================================================
 * SUPABASE KEEP-ALIVE SCRIPT (DESAFIO 156)
 * ============================================================================
 * Finalidade:
 * Realizar uma operação mínima e isolada no Supabase para gerar atividade
 * periódica no banco Postgres, evitando a pausa automática por inatividade
 * aplicada a projetos do plano Free (que entram em pausa após 7 dias sem atividade).
 *
 * Princípios de Segurança e Isolamento:
 * - Não toca em nenhuma tabela de regras de negócio, dados de usuários ou relatórios.
 * - Opera estritamente sobre a tabela técnica `public.system_heartbeat` (1 registro fixo id=1).
 * - Não expõe chaves, tokens, dados sensíveis ou detalhes de infraestrutura nos logs.
 * - Suporta ativação/desativação via variável de ambiente (KEEPALIVE_ENABLED=false).
 * ============================================================================
 */

try {
  require('dotenv').config();
} catch (e) {
  // Ignora se dotenv não estiver disponível em tempo de execução
}

const { createClient } = require('@supabase/supabase-js');

// 1. CONFIGURAÇÕES CENTRAIS
const CONFIG = {
  // Flag global para permitir desativar o keep-alive sem alterar o código
  enabled: process.env.KEEPALIVE_ENABLED !== 'false',

  // URL e Chave do Supabase (prioriza service_role para contornar RLS de forma segura)
  supabaseUrl: process.env.SUPABASE_URL || 'https://uctujsmnhmpysacqkuif.supabase.co',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY,

  // Identificador da fonte executora
  source: process.env.HEARTBEAT_SOURCE || 'github-actions',

  // Tabela técnica exclusiva
  targetTable: 'system_heartbeat',
  recordId: 1
};

/**
 * Formata timestamp no formato UTC legível: YYYY-MM-DD HH:MM:SS UTC
 */
function getFormattedUtcTimestamp() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

/**
 * Sanitiza mensagens de erro para garantir que tokens e URLs com credenciais
 * nunca sejam impressos no log.
 */
function sanitizeErrorMessage(error) {
  if (!error) return 'Erro desconhecido';
  let message = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
  // Remove potenciais JWTs ou strings em base64 longas
  message = message.replace(/eyJ[a-zA-Z0-9_-]{20,}\.?[a-zA-Z0-9_-]*/g, '[REDACTED_TOKEN]');
  return message;
}

/**
 * Executa o ping de keep-alive
 */
async function runKeepAlive() {
  const timestamp = getFormattedUtcTimestamp();

  // Verificação de habilitação
  if (!CONFIG.enabled) {
    console.log(`KEEP-ALIVE DISABLED — ${timestamp}`);
    process.exit(0);
  }

  // Validação de credenciais mínimas
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
    console.error(`KEEP-ALIVE ERROR — HTTP 401 (Credenciais do Supabase ausentes) — ${timestamp}`);
    process.exit(1);
  }

  try {
    const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Realiza a atualização do único registro de heartbeat
    const { error } = await supabase
      .from(CONFIG.targetTable)
      .upsert({
        id: CONFIG.recordId,
        last_ping: new Date().toISOString(),
        source: CONFIG.source
      }, {
        onConflict: 'id'
      });

    if (error) {
      const sanitized = sanitizeErrorMessage(error);
      const statusCode = error.code || error.status || '500';
      console.error(`KEEP-ALIVE ERROR — HTTP ${statusCode} (${sanitized}) — ${timestamp}`);
      process.exit(1);
    }

    // Sucesso - log padrão limpo
    console.log(`KEEP-ALIVE OK — ${timestamp}`);
    process.exit(0);
  } catch (err) {
    const sanitized = sanitizeErrorMessage(err);
    const statusCode = err.status || '500';
    console.error(`KEEP-ALIVE ERROR — HTTP ${statusCode} (${sanitized}) — ${timestamp}`);
    process.exit(1);
  }
}

// Execução imediata quando invocado via terminal / runner
if (require.main === module) {
  runKeepAlive();
}

module.exports = {
  runKeepAlive,
  CONFIG
};
