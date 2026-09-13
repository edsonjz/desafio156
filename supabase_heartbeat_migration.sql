-- ============================================================================
-- TABELA TÉCNICA DE HEARTBEAT / KEEP-ALIVE - SUPABASE (DESAFIO 156)
-- ============================================================================
-- Finalidade: Manter atividade periódica mínima no banco de dados para evitar
--             pausa automática por inatividade no plano gratuito do Supabase.
-- 
-- Isolamento: Não afeta nenhuma tabela, regra de negócio ou dados do Desafio 156.
-- Segurança: RLS ativado sem concessão pública para papel anon. Acesso exclusivo
--            via service_role secret mantido em ambiente seguro (GitHub Secrets).
-- ============================================================================

-- 1. Criação da tabela técnica system_heartbeat
CREATE TABLE IF NOT EXISTS public.system_heartbeat (
  id INT PRIMARY KEY DEFAULT 1,
  last_ping TIMESTAMPTZ NOT NULL DEFAULT now(),
  source VARCHAR(50) NOT NULL DEFAULT 'github-actions'
);

-- 2. Inserção do registro único inicial
INSERT INTO public.system_heartbeat (id, last_ping, source)
VALUES (1, now(), 'setup')
ON CONFLICT (id) DO NOTHING;

-- 3. Ativação de Row Level Security (RLS)
ALTER TABLE public.system_heartbeat ENABLE ROW LEVEL SECURITY;

-- 4. Garantir que anon não possui permissões públicas
DROP POLICY IF EXISTS "Deny anon access to system_heartbeat" ON public.system_heartbeat;
CREATE POLICY "Deny anon access to system_heartbeat"
  ON public.system_heartbeat
  FOR ALL
  TO anon
  USING (false);

-- 5. Permitir acesso total exclusivamente para o papel seguro 'service_role'
DROP POLICY IF EXISTS "Allow service_role full access to system_heartbeat" ON public.system_heartbeat;
CREATE POLICY "Allow service_role full access to system_heartbeat"
  ON public.system_heartbeat
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FIM DA DEFINIÇÃO
-- ============================================================================
