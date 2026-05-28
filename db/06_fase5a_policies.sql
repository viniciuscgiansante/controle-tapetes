-- ============================================================
-- Fase 5a — Policies adicionais para entregas
-- Permite ao fornecedor editar e excluir as próprias entregas
-- ============================================================

DROP POLICY IF EXISTS entregas_fornecedor_update ON entregas;
CREATE POLICY entregas_fornecedor_update ON entregas FOR UPDATE
  USING (fornecedor_id = meu_fornecedor_id())
  WITH CHECK (fornecedor_id = meu_fornecedor_id());

DROP POLICY IF EXISTS entregas_fornecedor_delete ON entregas;
CREATE POLICY entregas_fornecedor_delete ON entregas FOR DELETE
  USING (fornecedor_id = meu_fornecedor_id());
