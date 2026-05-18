-- ============================================================
-- Fix para erro PGRST002 ("Could not query the database for the schema cache")
-- Aplica 3 correções:
--   1. Adiciona PRIMARY KEY em saldo_fios (PostgREST exige PK)
--   2. GRANTs explícitos pros roles anon e authenticated
--   3. Recria as funções is_admin/meu_fornecedor_id com EXCEPTION handling
-- ============================================================

-- ----------------------------------------------------------
-- 1. Adicionar PK em saldo_fios (preserva dados se houver)
-- ----------------------------------------------------------
ALTER TABLE saldo_fios DROP CONSTRAINT IF EXISTS saldo_fios_pkey;
ALTER TABLE saldo_fios ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE saldo_fios ADD CONSTRAINT saldo_fios_pkey PRIMARY KEY (id);

-- ----------------------------------------------------------
-- 2. GRANTs explícitos
-- ----------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Pra futuras tabelas/funções/sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

-- ----------------------------------------------------------
-- 3. Recriar funções com tratamento de exceção
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_tipo TEXT;
BEGIN
  SELECT tipo INTO v_tipo FROM public.usuarios WHERE id = auth.uid();
  RETURN COALESCE(v_tipo = 'admin', FALSE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.meu_fornecedor_id()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  SELECT fornecedor_id INTO v_id FROM public.usuarios WHERE id = auth.uid();
  RETURN v_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meu_fornecedor_id() TO anon, authenticated;

-- ----------------------------------------------------------
-- 4. Força reload do schema cache no PostgREST
-- ----------------------------------------------------------
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
