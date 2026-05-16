-- ============================================================
-- Schema do Controle de Tapetes — Fase 1
-- Idempotente: pode rodar várias vezes (DROP + CREATE)
-- ============================================================

-- Limpa tudo (ordem reversa por causa de FKs)
DROP TABLE IF EXISTS saldo_fios_op CASCADE;
DROP TABLE IF EXISTS saldo_fios CASCADE;
DROP TABLE IF EXISTS entrega_itens CASCADE;
DROP TABLE IF EXISTS entregas CASCADE;
DROP TABLE IF EXISTS ordens_compra_fio CASCADE;
DROP TABLE IF EXISTS op_fornecedores CASCADE;
DROP TABLE IF EXISTS op_itens CASCADE;
DROP TABLE IF EXISTS ops CASCADE;
DROP TABLE IF EXISTS precos_terceirizada CASCADE;
DROP TABLE IF EXISTS fornecedores CASCADE;
DROP TABLE IF EXISTS parametros_largura CASCADE;
DROP TABLE IF EXISTS modelos CASCADE;
DROP TABLE IF EXISTS cores CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- ============================================================
-- CADASTROS BASE
-- ============================================================

CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('admin', 'fornecedor')),
  fornecedor_id BIGINT,  -- FK setada depois (forward declaration)
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cores (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE modelos (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cor_1_id BIGINT NOT NULL REFERENCES cores(id) ON DELETE RESTRICT,
  cor_2_id BIGINT NOT NULL REFERENCES cores(id) ON DELETE RESTRICT,
  largura NUMERIC(3,2) NOT NULL CHECK (largura IN (1.40, 2.10)),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nome, cor_1_id, cor_2_id, largura)
);

CREATE TABLE parametros_largura (
  largura NUMERIC(3,2) PRIMARY KEY CHECK (largura IN (1.40, 2.10)),
  peso_linear NUMERIC(10,4) NOT NULL,
  algodao_por_ml NUMERIC(10,6) NOT NULL,
  poliester_por_ml NUMERIC(10,6) NOT NULL,
  valor_x NUMERIC(10,4) NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fornecedores (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('fio_algodao', 'fio_poliester', 'tecelagem', 'latex')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nome, tipo)
);

-- Agora fechamos a FK de usuarios.fornecedor_id
ALTER TABLE usuarios ADD CONSTRAINT usuarios_fornecedor_id_fkey
  FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE SET NULL;

CREATE TABLE precos_terceirizada (
  id BIGSERIAL PRIMARY KEY,
  fornecedor_id BIGINT NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL CHECK (etapa IN ('cima', 'latex')),
  largura NUMERIC(3,2) NOT NULL CHECK (largura IN (1.40, 2.10)),
  preco_por_metro NUMERIC(10,2) NOT NULL CHECK (preco_por_metro >= 0),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fornecedor_id, etapa, largura)
);

-- ============================================================
-- OPERAÇÃO (OP)
-- ============================================================

CREATE TABLE ops (
  id BIGSERIAL PRIMARY KEY,
  numero INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'simulada' CHECK (status IN ('simulada','aberta','em_producao','finalizada')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizada_em TIMESTAMPTZ,
  UNIQUE (numero, ano)
);

CREATE TABLE op_itens (
  id BIGSERIAL PRIMARY KEY,
  op_id BIGINT NOT NULL REFERENCES ops(id) ON DELETE CASCADE,
  modelo_id BIGINT NOT NULL REFERENCES modelos(id) ON DELETE RESTRICT,
  metros_pedidos NUMERIC(10,2) NOT NULL CHECK (metros_pedidos > 0),
  metros_ajustados NUMERIC(10,2),  -- preenchido após recálculo
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE op_fornecedores (
  id BIGSERIAL PRIMARY KEY,
  op_id BIGINT NOT NULL REFERENCES ops(id) ON DELETE CASCADE,
  fornecedor_id BIGINT NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  etapa TEXT NOT NULL CHECK (etapa IN ('fio_algodao','fio_poliester','cima','latex')),
  UNIQUE (op_id, fornecedor_id, etapa)
);

CREATE INDEX op_fornecedores_fornecedor_idx ON op_fornecedores(fornecedor_id);

-- ============================================================
-- COMPRA E RECEBIMENTO DE FIOS
-- ============================================================

CREATE TABLE ordens_compra_fio (
  id BIGSERIAL PRIMARY KEY,
  op_id BIGINT NOT NULL REFERENCES ops(id) ON DELETE CASCADE,
  fornecedor_id BIGINT NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('algodao','poliester')),
  cor_id BIGINT REFERENCES cores(id),  -- pra algodão
  cor_poliester TEXT CHECK (cor_poliester IN ('PRETO','BRANCO')),  -- pra poliéster
  kg_pedido NUMERIC(10,3) NOT NULL CHECK (kg_pedido > 0),
  kg_recebido NUMERIC(10,3),
  data_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
  data_recebimento DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','recebido_parcial','recebido_total')),
  CHECK (
    (tipo = 'algodao' AND cor_id IS NOT NULL AND cor_poliester IS NULL) OR
    (tipo = 'poliester' AND cor_poliester IS NOT NULL AND cor_id IS NULL)
  )
);

CREATE INDEX ordens_compra_fio_fornecedor_idx ON ordens_compra_fio(fornecedor_id);
CREATE INDEX ordens_compra_fio_op_idx ON ordens_compra_fio(op_id);

-- ============================================================
-- ENTREGAS DAS TERCEIRIZADAS
-- ============================================================

CREATE TABLE entregas (
  id BIGSERIAL PRIMARY KEY,
  fornecedor_id BIGINT NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  etapa TEXT NOT NULL CHECK (etapa IN ('cima','latex')),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX entregas_fornecedor_idx ON entregas(fornecedor_id);

CREATE TABLE entrega_itens (
  id BIGSERIAL PRIMARY KEY,
  entrega_id BIGINT NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  op_id BIGINT NOT NULL REFERENCES ops(id) ON DELETE RESTRICT,
  op_item_id BIGINT REFERENCES op_itens(id) ON DELETE RESTRICT,
  modelo_id BIGINT REFERENCES modelos(id) ON DELETE RESTRICT,
  metros_entregues NUMERIC(10,2) NOT NULL CHECK (metros_entregues > 0),
  defeito BOOLEAN NOT NULL DEFAULT FALSE,
  observacao TEXT,
  CHECK (op_item_id IS NOT NULL OR modelo_id IS NOT NULL)
);

CREATE INDEX entrega_itens_op_idx ON entrega_itens(op_id);

-- ============================================================
-- SALDOS (INFORMATIVO)
-- ============================================================

CREATE TABLE saldo_fios (
  cor_id BIGINT REFERENCES cores(id),
  cor_poliester TEXT CHECK (cor_poliester IN ('PRETO','BRANCO')),
  tipo TEXT NOT NULL CHECK (tipo IN ('algodao','poliester')),
  kg_total NUMERIC(10,3) NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (tipo = 'algodao' AND cor_id IS NOT NULL AND cor_poliester IS NULL) OR
    (tipo = 'poliester' AND cor_poliester IS NOT NULL AND cor_id IS NULL)
  ),
  UNIQUE (cor_id, cor_poliester, tipo)
);

CREATE TABLE saldo_fios_op (
  id BIGSERIAL PRIMARY KEY,
  op_id BIGINT NOT NULL REFERENCES ops(id) ON DELETE CASCADE,
  cor_id BIGINT REFERENCES cores(id),
  cor_poliester TEXT CHECK (cor_poliester IN ('PRETO','BRANCO')),
  tipo TEXT NOT NULL CHECK (tipo IN ('algodao','poliester')),
  kg_sobra NUMERIC(10,3) NOT NULL,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
