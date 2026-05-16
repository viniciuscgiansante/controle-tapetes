-- ============================================================
-- Seed de dados pra desenvolvimento e teste
-- Pode rodar várias vezes (TRUNCATE + INSERT)
-- ============================================================

-- Reseta apenas tabelas de cadastro (preserva auth.users e usuarios)
TRUNCATE saldo_fios_op, saldo_fios, entrega_itens, entregas,
         ordens_compra_fio, op_fornecedores, op_itens, ops,
         precos_terceirizada, fornecedores, parametros_largura,
         modelos, cores RESTART IDENTITY CASCADE;

-- Cores
INSERT INTO cores (nome) VALUES
  ('BRANCO'),
  ('PRETO'),
  ('BEGE');

-- Fornecedores
INSERT INTO fornecedores (nome, tipo) VALUES
  ('Fios Sul Algodão', 'fio_algodao'),
  ('Polifios Brasil',  'fio_poliester'),
  ('Tecelagem Aurora', 'tecelagem'),
  ('Látex Premier',    'latex');

-- Parâmetros de cálculo por largura
INSERT INTO parametros_largura (largura, peso_linear, algodao_por_ml, poliester_por_ml, valor_x) VALUES
  (1.40, 1.5000, 0.000350, 0.000420, 1.0000),
  (2.10, 2.2500, 0.000525, 0.000630, 1.0000);

-- Modelos (cor 1 / cor 2 / largura)
INSERT INTO modelos (nome, cor_1_id, cor_2_id, largura) VALUES
  ('Conforto', (SELECT id FROM cores WHERE nome='BRANCO'), (SELECT id FROM cores WHERE nome='PRETO'), 1.40),
  ('Conforto', (SELECT id FROM cores WHERE nome='PRETO'),  (SELECT id FROM cores WHERE nome='BRANCO'), 2.10);

-- Preços terceirizadas
INSERT INTO precos_terceirizada (fornecedor_id, etapa, largura, preco_por_metro) VALUES
  ((SELECT id FROM fornecedores WHERE nome='Tecelagem Aurora'), 'cima', 1.40, 8.50),
  ((SELECT id FROM fornecedores WHERE nome='Tecelagem Aurora'), 'cima', 2.10, 12.00),
  ((SELECT id FROM fornecedores WHERE nome='Látex Premier'),    'latex', 1.40, 4.00),
  ((SELECT id FROM fornecedores WHERE nome='Látex Premier'),    'latex', 2.10, 6.00);
