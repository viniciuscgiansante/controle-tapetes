-- ============================================================
-- Políticas RLS — controle de acesso linha-por-linha
-- ============================================================
-- Estratégia:
--   - Admin: tudo
--   - Fornecedor: só dados ligados ao próprio fornecedor_id

-- Ativa RLS em todas as tabelas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cores ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametros_largura ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE precos_terceirizada ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_compra_fio ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrega_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE saldo_fios ENABLE ROW LEVEL SECURITY;
ALTER TABLE saldo_fios_op ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- usuarios: cada um vê o próprio; admin vê todos
-- ============================================================
DROP POLICY IF EXISTS usuarios_select ON usuarios;
CREATE POLICY usuarios_select ON usuarios FOR SELECT
  USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS usuarios_admin_all ON usuarios;
CREATE POLICY usuarios_admin_all ON usuarios FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS usuarios_self_update ON usuarios;
CREATE POLICY usuarios_self_update ON usuarios FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND tipo = (SELECT tipo FROM usuarios WHERE id = auth.uid()));

-- ============================================================
-- Cadastros (cores, modelos, parametros, fornecedores, precos):
-- admin gerencia; fornecedor só lê o necessário (cores e modelos)
-- ============================================================
DROP POLICY IF EXISTS cores_admin ON cores;
CREATE POLICY cores_admin ON cores FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS cores_read ON cores;
CREATE POLICY cores_read ON cores FOR SELECT USING (true);  -- leitura aberta pra todo logado

DROP POLICY IF EXISTS modelos_admin ON modelos;
CREATE POLICY modelos_admin ON modelos FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS modelos_read ON modelos;
CREATE POLICY modelos_read ON modelos FOR SELECT USING (true);

DROP POLICY IF EXISTS parametros_admin ON parametros_largura;
CREATE POLICY parametros_admin ON parametros_largura FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS fornecedores_admin ON fornecedores;
CREATE POLICY fornecedores_admin ON fornecedores FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS fornecedores_self ON fornecedores;
CREATE POLICY fornecedores_self ON fornecedores FOR SELECT USING (id = meu_fornecedor_id());

DROP POLICY IF EXISTS precos_admin ON precos_terceirizada;
CREATE POLICY precos_admin ON precos_terceirizada FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- OPs: admin tudo; fornecedor só onde tem vínculo em op_fornecedores
-- ============================================================
DROP POLICY IF EXISTS ops_admin ON ops;
CREATE POLICY ops_admin ON ops FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS ops_fornecedor_read ON ops;
CREATE POLICY ops_fornecedor_read ON ops FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM op_fornecedores
    WHERE op_fornecedores.op_id = ops.id
      AND op_fornecedores.fornecedor_id = meu_fornecedor_id()
  ));

DROP POLICY IF EXISTS op_itens_admin ON op_itens;
CREATE POLICY op_itens_admin ON op_itens FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS op_itens_fornecedor_read ON op_itens;
CREATE POLICY op_itens_fornecedor_read ON op_itens FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM op_fornecedores
    WHERE op_fornecedores.op_id = op_itens.op_id
      AND op_fornecedores.fornecedor_id = meu_fornecedor_id()
  ));

DROP POLICY IF EXISTS op_fornecedores_admin ON op_fornecedores;
CREATE POLICY op_fornecedores_admin ON op_fornecedores FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS op_fornecedores_self_read ON op_fornecedores;
CREATE POLICY op_fornecedores_self_read ON op_fornecedores FOR SELECT
  USING (fornecedor_id = meu_fornecedor_id());

-- ============================================================
-- ordens_compra_fio: admin tudo; fornecedor só as próprias
-- ============================================================
DROP POLICY IF EXISTS ocf_admin ON ordens_compra_fio;
CREATE POLICY ocf_admin ON ordens_compra_fio FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS ocf_fornecedor_read ON ordens_compra_fio;
CREATE POLICY ocf_fornecedor_read ON ordens_compra_fio FOR SELECT
  USING (fornecedor_id = meu_fornecedor_id());

DROP POLICY IF EXISTS ocf_fornecedor_update ON ordens_compra_fio;
CREATE POLICY ocf_fornecedor_update ON ordens_compra_fio FOR UPDATE
  USING (fornecedor_id = meu_fornecedor_id())
  WITH CHECK (fornecedor_id = meu_fornecedor_id());

-- ============================================================
-- entregas / entrega_itens: admin tudo; fornecedor cria/lê as próprias
-- ============================================================
DROP POLICY IF EXISTS entregas_admin ON entregas;
CREATE POLICY entregas_admin ON entregas FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS entregas_fornecedor_read ON entregas;
CREATE POLICY entregas_fornecedor_read ON entregas FOR SELECT
  USING (fornecedor_id = meu_fornecedor_id());

DROP POLICY IF EXISTS entregas_fornecedor_insert ON entregas;
CREATE POLICY entregas_fornecedor_insert ON entregas FOR INSERT
  WITH CHECK (fornecedor_id = meu_fornecedor_id());

DROP POLICY IF EXISTS entrega_itens_admin ON entrega_itens;
CREATE POLICY entrega_itens_admin ON entrega_itens FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS entrega_itens_fornecedor ON entrega_itens;
CREATE POLICY entrega_itens_fornecedor ON entrega_itens FOR ALL
  USING (EXISTS (
    SELECT 1 FROM entregas
    WHERE entregas.id = entrega_itens.entrega_id
      AND entregas.fornecedor_id = meu_fornecedor_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM entregas
    WHERE entregas.id = entrega_itens.entrega_id
      AND entregas.fornecedor_id = meu_fornecedor_id()
  ));

-- ============================================================
-- saldos: só admin
-- ============================================================
DROP POLICY IF EXISTS saldo_fios_admin ON saldo_fios;
CREATE POLICY saldo_fios_admin ON saldo_fios FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS saldo_fios_op_admin ON saldo_fios_op;
CREATE POLICY saldo_fios_op_admin ON saldo_fios_op FOR ALL USING (is_admin()) WITH CHECK (is_admin());
