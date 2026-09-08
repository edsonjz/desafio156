-- ============================================================================
-- SCRIPT DE ENDURECIMENTO DE SEGURANÇA - SUPABASE (DESAFIO 156)
-- ============================================================================
-- ATENÇÃO:
-- 1. Antes de executar este script, copie a chave "service_role secret" do seu Supabase
--    (em Project Settings > API > Project API keys > service_role secret).
-- 2. Configure a variável SUPABASE_SERVICE_ROLE_KEY no seu arquivo .env (e na Vercel).
-- 3. O papel 'service_role' possui a permissão BYPASSRLS por padrão no Postgres,
--    garantindo que o backend funcione com acesso total e o público externo via
--    PostgREST/anon fique 100% bloqueado.
-- ============================================================================

-- 1. ESTRUTURA ADMINISTRATIVA (Adiciona coluna de perfil e define admin como master)
ALTER TABLE public.administrators ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'admin' NOT NULL;
UPDATE public.administrators SET role = 'master' WHERE username = 'admin';

-- 2. ATIVAÇÃO DE ROW LEVEL SECURITY (RLS) NAS 20 TABELAS DO BANCO DE DADOS
-- Bloqueia qualquer leitura/escrita não autenticada ou via chave anônima (anon) externa.

ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roulette_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_double_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptu_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptu_questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptu_alternativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptu_operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptu_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptu_tentativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iptu_respostas ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICA DE SEGURANÇA EXPLÍCITA PARA A TABELA DE ADMINISTRADORES
-- Garante que NENHUM usuário da chave anônima externa consiga ler senhas ou hashes.
DROP POLICY IF EXISTS "Deny anon access to administrators" ON public.administrators;
CREATE POLICY "Deny anon access to administrators"
  ON public.administrators
  FOR ALL
  TO anon
  USING (false);

-- ============================================================================
-- FIM DO SCRIPT DE SEGURANÇA
-- ============================================================================
