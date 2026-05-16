# Fase 1 — Fundação · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir infraestrutura (Supabase + GitHub Pages), schema completo do banco com RLS, e tela de login funcional que distingue admin de fornecedor.

**Architecture:** Single HTML no GitHub Pages → Supabase via JS client (anon key) → Postgres com RLS. JS embutido organizado em seções (CONFIG, UTIL, SUPA, AUTH, ROUTER, SCREENS, MAIN).

**Tech Stack:** HTML5, Tailwind CSS (CDN), Supabase JS v2 (CDN), Inter (Google Fonts), Supabase Postgres + Auth + RLS, GitHub Pages.

**Definição de "pronto" da Fase 1:**
- Repo GitHub criado, GitHub Pages ativo
- Projeto Supabase criado, todas as 13 tabelas existem, todas as políticas RLS aplicadas
- Seed de dados inserido (1 admin + 1 fornecedor de cada tipo + 3 cores + 2 modelos)
- Página de login funcional acessível pela URL do GitHub Pages
- Login como admin redireciona pra painel placeholder
- Login como fornecedor redireciona pra tela vazia placeholder
- Validação RLS: tentativa de leitura indevida via Supabase Studio bloqueada

---

## Estrutura de arquivos da Fase 1

```
Controle Tapetes Murilo/
├── index.html                                # único arquivo do app (vai crescer nas próximas fases)
├── .gitignore                                # já existe
├── README.md                                 # instruções básicas pro Vinicius
├── .env.example                              # referência das variáveis (não é usada em runtime)
├── db/
│   ├── 01_schema.sql                         # CREATE TABLE de todas as 13 tabelas
│   ├── 02_functions.sql                      # is_admin(), meu_fornecedor_id()
│   ├── 03_policies.sql                       # políticas RLS de cada tabela
│   └── 04_seed.sql                           # dados de teste
└── docs/
    ├── qa/
    │   └── fase1-checklist.md                # checklist manual de validação
    └── superpowers/
        ├── specs/
        │   └── 2026-05-16-controle-tapetes-design.md
        └── plans/
            └── 2026-05-16-fase1-fundacao.md  # este arquivo
```

---

## Convenções deste plano

- Tasks **MANUAL** = Vinicius (humano) executa, com prints/cliques descritos passo a passo
- Tasks **AGENT** = Claude (ou outro agent) executa via tools
- Cada task tem critério de "feito" verificável
- Commits frequentes (uma vez por task de código)

---

## Task 1: [MANUAL] Criar conta e projeto no Supabase

**Files:** nenhum (ação externa).

- [ ] **Step 1: Abrir Supabase**

Abra https://supabase.com no navegador.

- [ ] **Step 2: Criar conta**

Clique em **"Start your project"**. Faça login com GitHub (recomendado — vai facilitar depois) ou crie conta com email.

- [ ] **Step 3: Criar organização**

Quando pedir, crie uma organização chamada `controle-tapetes`. Plano: **Free**.

- [ ] **Step 4: Criar projeto**

Clique em **"New project"**. Preencha:
- **Name:** `controle-tapetes`
- **Database Password:** clique em "Generate a password" e **salve essa senha num lugar seguro** (você vai precisar pra acessar o banco direto se quiser)
- **Region:** `South America (São Paulo)` — menor latência pra você
- **Pricing Plan:** Free

Clique em **"Create new project"** e aguarde ~2 minutos.

- [ ] **Step 5: Anotar URL e anon key**

Após criado, vá em **Settings (engrenagem no canto inferior esquerdo) → API**. Anote:
- **Project URL** (formato `https://xxxxxxxx.supabase.co`)
- **anon public** key (string longa começando com `eyJ...`)

Você vai colar esses 2 valores no `index.html` mais tarde.

**Critério de feito:** projeto Supabase ativo, URL e anon key anotados.

---

## Task 2: [MANUAL] Criar repositório GitHub

**Files:** nenhum (ação externa).

- [ ] **Step 1: Acessar GitHub**

Abra https://github.com e faça login (ou crie conta).

- [ ] **Step 2: Criar repositório**

Clique no **+** no canto superior direito → **New repository**. Preencha:
- **Repository name:** `controle-tapetes`
- **Description:** "Controle de produção de tapetes"
- **Visibility:** Public (necessário pra GitHub Pages no plano free) ou Private (se tiver GitHub Pro)
- **NÃO marque** "Add a README", "Add .gitignore", "Add a license" — já temos esses arquivos localmente

Clique em **Create repository**.

- [ ] **Step 3: Copiar URL do repo**

Na próxima tela, copie a URL HTTPS (formato `https://github.com/seuusuario/controle-tapetes.git`).

**Critério de feito:** repositório criado, URL HTTPS copiada.

---

## Task 3: [AGENT] Configurar remote do git e fazer primeiro push

**Files:**
- Modify: configuração git local

- [ ] **Step 1: Pedir a URL do Vinicius**

Antes de executar, perguntar ao Vinicius a URL do repo GitHub que ele criou.

- [ ] **Step 2: Adicionar remote**

Executar:
```bash
cd "/Users/viniciuscgiansante/Documents/Controle Tapetes Murilo"
git remote add origin <URL_DO_REPO>
git branch -M main
git push -u origin main
```

Output esperado:
```
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

- [ ] **Step 3: Verificar no GitHub**

Abrir o repo no navegador e confirmar que aparecem os arquivos `.gitignore` e `docs/superpowers/specs/2026-05-16-controle-tapetes-design.md`.

**Critério de feito:** repo local conectado ao remoto, commit inicial visível no GitHub.

---

## Task 4: [MANUAL] Ativar GitHub Pages

**Files:** nenhum (configuração externa).

- [ ] **Step 1: Abrir configurações do repo**

No GitHub, abrir o repo → aba **Settings** → menu lateral **Pages**.

- [ ] **Step 2: Configurar source**

Em **Source**, selecionar **Deploy from a branch**.
Em **Branch**, escolher `main` / `/ (root)` → **Save**.

- [ ] **Step 3: Aguardar publicação**

Aguardar ~1 minuto. Vai aparecer no topo: **"Your site is live at https://seuusuario.github.io/controle-tapetes/"**. Anote essa URL.

**Critério de feito:** URL pública ativa (mesmo que mostre 404 por enquanto, porque ainda não tem `index.html`).

---

## Task 5: [AGENT] Criar `db/01_schema.sql` com todas as tabelas

**Files:**
- Create: `db/01_schema.sql`

- [ ] **Step 1: Definir comportamento esperado**

Script SQL idempotente que cria as 13 tabelas do design, com tipos corretos, FKs, constraints, índices básicos. `DROP TABLE IF EXISTS` no topo pra permitir rerodar durante desenvolvimento.

- [ ] **Step 2: Escrever o arquivo**

Conteúdo de `db/01_schema.sql`:

```sql
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
```

- [ ] **Step 3: Commit**

```bash
git add db/01_schema.sql
git commit -m "feat(db): schema completo das 13 tabelas (Fase 1)"
```

**Critério de feito:** arquivo criado, commitado, sem erros de sintaxe SQL visíveis.

---

## Task 6: [MANUAL] Aplicar schema no Supabase

**Files:** nenhum (ação no Supabase Studio).

- [ ] **Step 1: Abrir SQL Editor**

No Supabase Studio do projeto, menu lateral → **SQL Editor**.

- [ ] **Step 2: Colar e executar**

Clicar em **+ New query**. Copiar TODO o conteúdo de `db/01_schema.sql`. Colar. Clicar em **Run** (canto inferior direito) ou Ctrl/Cmd+Enter.

Output esperado: "Success. No rows returned" (ou mensagem equivalente sem erro).

- [ ] **Step 3: Validar tabelas**

Menu lateral → **Table Editor**. Confirmar que existem as 13 tabelas:
`usuarios, cores, modelos, parametros_largura, fornecedores, precos_terceirizada, ops, op_itens, op_fornecedores, ordens_compra_fio, entregas, entrega_itens, saldo_fios, saldo_fios_op`.

**Critério de feito:** 13 tabelas visíveis no Table Editor sem erros.

---

## Task 7: [AGENT] Criar `db/02_functions.sql` com funções auxiliares

**Files:**
- Create: `db/02_functions.sql`

- [ ] **Step 1: Escrever arquivo**

Conteúdo de `db/02_functions.sql`:

```sql
-- ============================================================
-- Funções auxiliares pra políticas RLS
-- Usam auth.uid() (id do usuário logado no JWT do Supabase)
-- ============================================================

-- Retorna TRUE se o usuário logado é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND tipo = 'admin'
  );
$$;

-- Retorna o fornecedor_id do usuário logado (NULL se não é fornecedor)
CREATE OR REPLACE FUNCTION meu_fornecedor_id()
RETURNS BIGINT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT fornecedor_id FROM usuarios
  WHERE id = auth.uid();
$$;

-- Garante execução pra usuário autenticado
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION meu_fornecedor_id() TO authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add db/02_functions.sql
git commit -m "feat(db): funcoes auxiliares is_admin e meu_fornecedor_id"
```

**Critério de feito:** arquivo criado e commitado.

---

## Task 8: [MANUAL] Aplicar funções no Supabase

**Files:** nenhum.

- [ ] **Step 1: SQL Editor → New query**

Colar conteúdo de `db/02_functions.sql` → Run.

Output esperado: "Success. No rows returned".

- [ ] **Step 2: Validar**

Rodar no SQL Editor:
```sql
SELECT is_admin();
```

Output esperado: `false` (você ainda não está logado como app user; está como service role).

**Critério de feito:** funções criadas sem erro.

---

## Task 9: [AGENT] Criar `db/03_policies.sql` com RLS

**Files:**
- Create: `db/03_policies.sql`

- [ ] **Step 1: Escrever arquivo**

Conteúdo de `db/03_policies.sql`:

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add db/03_policies.sql
git commit -m "feat(db): politicas RLS de todas as tabelas"
```

**Critério de feito:** arquivo criado e commitado.

---

## Task 10: [MANUAL] Aplicar políticas no Supabase

**Files:** nenhum.

- [ ] **Step 1: SQL Editor → New query**

Colar `db/03_policies.sql` → Run.

Output esperado: "Success".

- [ ] **Step 2: Verificar RLS ativada**

Menu lateral → **Authentication → Policies** (ou **Database → Policies** dependendo da versão). Confirmar que cada tabela tem ao menos 1 política listada.

**Critério de feito:** todas as 14 tabelas com RLS ativada e ao menos 1 política.

---

## Task 11: [AGENT] Criar `db/04_seed.sql`

**Files:**
- Create: `db/04_seed.sql`

- [ ] **Step 1: Escrever arquivo**

Conteúdo (vai inserir cadastros base; NÃO insere `usuarios` porque precisa do `auth.users` correspondente, isso vira na próxima task):

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add db/04_seed.sql
git commit -m "feat(db): seed de cadastros (cores, modelos, fornecedores, precos, parametros)"
```

**Critério de feito:** arquivo criado e commitado.

---

## Task 12: [MANUAL] Rodar seed no Supabase

**Files:** nenhum.

- [ ] **Step 1: SQL Editor → New query**

Colar `db/04_seed.sql` → Run. Output esperado: "Success".

- [ ] **Step 2: Verificar**

Table Editor → abrir tabela `cores`. Deve ter 3 linhas (BRANCO, PRETO, BEGE).
Abrir `fornecedores`. Deve ter 4 linhas. Abrir `modelos`. Deve ter 2 linhas.

**Critério de feito:** dados visíveis nas tabelas.

---

## Task 13: [MANUAL] Criar usuários de teste no Auth do Supabase

**Files:** nenhum.

- [ ] **Step 1: Criar admin**

Menu lateral → **Authentication → Users → Add user → Create new user**:
- Email: `admin@tapetes.test`
- Password: `Admin123!`
- Auto Confirm User: **marcar** (pra não precisar de email)

Clicar **Create user**. Anote o **UID** que aparece (formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

- [ ] **Step 2: Criar fornecedor de fios algodão**

Mesmo processo:
- Email: `algodao@tapetes.test`
- Password: `Fornec123!`
- Auto Confirm: marcar

Anote o UID.

- [ ] **Step 3: Criar fornecedor tecelagem**

- Email: `tecelagem@tapetes.test`
- Password: `Fornec123!`
- Auto Confirm: marcar

Anote o UID.

- [ ] **Step 4: Criar fornecedor látex**

- Email: `latex@tapetes.test`
- Password: `Fornec123!`
- Auto Confirm: marcar

Anote o UID.

**Critério de feito:** 4 usuários listados em Authentication → Users. Os 4 UIDs anotados.

---

## Task 14: [MANUAL] Vincular usuários do Auth à tabela `usuarios`

**Files:** nenhum.

- [ ] **Step 1: SQL Editor → New query**

Substituir os `<UID_*>` pelos UIDs anotados na Task 13 e rodar:

```sql
INSERT INTO usuarios (id, email, nome, tipo, fornecedor_id) VALUES
  ('<UID_ADMIN>',     'admin@tapetes.test',     'Murilo (Admin)', 'admin',      NULL),
  ('<UID_ALGODAO>',   'algodao@tapetes.test',   'Fios Sul',       'fornecedor', (SELECT id FROM fornecedores WHERE nome='Fios Sul Algodão')),
  ('<UID_TECELAGEM>', 'tecelagem@tapetes.test', 'Aurora',         'fornecedor', (SELECT id FROM fornecedores WHERE nome='Tecelagem Aurora')),
  ('<UID_LATEX>',     'latex@tapetes.test',     'Premier',        'fornecedor', (SELECT id FROM fornecedores WHERE nome='Látex Premier'));
```

- [ ] **Step 2: Validar**

```sql
SELECT u.email, u.tipo, f.nome AS fornecedor_nome, f.tipo AS fornecedor_tipo
FROM usuarios u
LEFT JOIN fornecedores f ON f.id = u.fornecedor_id
ORDER BY u.email;
```

Output esperado: 4 linhas com vínculos corretos.

**Critério de feito:** 4 registros em `usuarios` com vínculos corretos.

---

## Task 15: [AGENT] Criar `.env.example` e `README.md`

**Files:**
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Escrever `.env.example`**

Conteúdo (esse arquivo é só referência — single HTML não usa `.env`):

```
# Não é usado em runtime. Apenas referência das credenciais que vão no index.html.
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- [ ] **Step 2: Escrever `README.md`**

Conteúdo:

````markdown
# Controle de Produção de Tapetes

Sistema para controlar a produção de tapetes do Murilo, do pedido de fios até a entrega final.

## Stack

- HTML único hospedado no GitHub Pages
- Tailwind CSS via CDN
- Supabase (Postgres + Auth + RLS) — plano free

## Documentação

- Design completo: [`docs/superpowers/specs/2026-05-16-controle-tapetes-design.md`](docs/superpowers/specs/2026-05-16-controle-tapetes-design.md)
- Plano da Fase 1: [`docs/superpowers/plans/2026-05-16-fase1-fundacao.md`](docs/superpowers/plans/2026-05-16-fase1-fundacao.md)

## Como rodar localmente

1. Configure as credenciais do Supabase no topo do `<script>` em `index.html`
2. Abra o `index.html` direto no navegador (duplo clique) OU rode um servidor estático:
   ```bash
   python3 -m http.server 8000
   # depois acesse http://localhost:8000
   ```

## Como subir alteração

```bash
git add .
git commit -m "<mensagem>"
git push
```

GitHub Pages publica automaticamente em ~1min.

## Usuários de teste (Fase 1)

| Email                     | Senha       | Tipo                  |
|---------------------------|-------------|-----------------------|
| admin@tapetes.test        | Admin123!   | admin                 |
| algodao@tapetes.test      | Fornec123!  | fornecedor (fio)      |
| tecelagem@tapetes.test    | Fornec123!  | fornecedor (cima)     |
| latex@tapetes.test        | Fornec123!  | fornecedor (látex)    |
````

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: README e .env.example"
```

**Critério de feito:** arquivos criados e commitados.

---

## Task 16: [AGENT] Criar `index.html` base com login funcional

**Files:**
- Create: `index.html`

- [ ] **Step 1: Pedir credenciais do Supabase ao Vinicius**

Antes de criar o arquivo, perguntar:
- Project URL (formato `https://xxxx.supabase.co`)
- Anon key (string longa começando com `eyJ...`)

- [ ] **Step 2: Escrever `index.html`**

Substituir `__SUPABASE_URL__` e `__SUPABASE_ANON_KEY__` pelos valores fornecidos pelo Vinicius. Conteúdo completo:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Controle de Tapetes</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <style>
    body { font-family: 'Inter', sans-serif; }
    .toast { animation: slidein .25s ease-out; }
    @keyframes slidein { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  </style>
</head>
<body class="bg-gray-100 min-h-screen text-gray-900">

<div id="app"></div>
<div id="toasts" class="fixed bottom-4 right-4 space-y-2 z-50"></div>

<script>
// =====================================================================
// === CONFIG ==========================================================
// =====================================================================
const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

// =====================================================================
// === UTIL ============================================================
// =====================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function toast(message, type = 'info') {
  const colors = { info: 'bg-blue-600', success: 'bg-green-600', error: 'bg-red-600' };
  const node = el('div', {
    class: 'toast text-white px-4 py-2 rounded-lg shadow-lg ' + (colors[type] || colors.info)
  }, message);
  $('#toasts').appendChild(node);
  setTimeout(() => node.remove(), 4000);
}

function setApp(node) {
  const app = $('#app');
  app.replaceChildren(node);
}

// =====================================================================
// === SUPA ============================================================
// =====================================================================
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

// =====================================================================
// === AUTH ============================================================
// =====================================================================
let CURRENT_USER = null;  // { id, email, nome, tipo, fornecedor_id }

async function login(email, senha) {
  const { data, error } = await supa.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  await loadCurrentUser();
  return data.user;
}

async function logout() {
  await supa.auth.signOut();
  CURRENT_USER = null;
  navigate('#/login');
}

async function loadCurrentUser() {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) { CURRENT_USER = null; return null; }
  const { data, error } = await supa.from('usuarios')
    .select('id, email, nome, tipo, fornecedor_id')
    .eq('id', session.user.id)
    .single();
  if (error) {
    console.error('Erro carregando perfil:', error);
    CURRENT_USER = null;
    return null;
  }
  CURRENT_USER = data;
  return data;
}

// =====================================================================
// === ROUTER ==========================================================
// =====================================================================
const routes = {
  '#/login':    { render: screenLogin, public: true },
  '#/painel':   { render: screenPainel, roles: ['admin'] },
  '#/fornecedor/home': { render: screenFornecedorHome, roles: ['fornecedor'] },
};

function navigate(hash) {
  if (location.hash !== hash) location.hash = hash;
  else handleRoute();
}

async function handleRoute() {
  const hash = location.hash || '#/login';
  const route = routes[hash];

  if (!route) { setApp(screenNotFound()); return; }
  if (route.public) { setApp(route.render()); return; }

  if (!CURRENT_USER) await loadCurrentUser();
  if (!CURRENT_USER) { navigate('#/login'); return; }

  if (route.roles && !route.roles.includes(CURRENT_USER.tipo)) {
    setApp(screenForbidden());
    return;
  }

  setApp(route.render());
}

// =====================================================================
// === SCREENS =========================================================
// =====================================================================

function screenLogin() {
  const root = el('div', { class: 'min-h-screen flex items-center justify-center p-4' });
  const card = el('div', { class: 'bg-white rounded-2xl shadow-lg p-8 w-full max-w-md' });

  card.appendChild(el('h1', { class: 'text-2xl font-bold mb-1' }, 'Controle de Tapetes'));
  card.appendChild(el('p', { class: 'text-gray-500 mb-6' }, 'Entre com seu e-mail e senha'));

  const emailInput = el('input', { type: 'email', placeholder: 'seu@email.com', required: 'required',
    class: 'w-full border rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500' });
  const senhaInput = el('input', { type: 'password', placeholder: 'senha', required: 'required',
    class: 'w-full border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500' });
  const btn = el('button', { type: 'submit',
    class: 'w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg py-2 transition' }, 'Entrar');

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Entrando...';
      try {
        await login(emailInput.value.trim(), senhaInput.value);
        toast('Login OK', 'success');
        await routeAfterLogin();
      } catch (err) {
        toast('E-mail ou senha incorretos', 'error');
        console.error(err);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar';
      }
    }
  }, emailInput, senhaInput, btn);

  card.appendChild(form);
  root.appendChild(card);
  return root;
}

async function routeAfterLogin() {
  await loadCurrentUser();
  if (!CURRENT_USER) { navigate('#/login'); return; }
  if (CURRENT_USER.tipo === 'admin') navigate('#/painel');
  else navigate('#/fornecedor/home');
}

function shellLayout(menuItems, contentNode) {
  const root = el('div', { class: 'min-h-screen flex flex-col' });

  const header = el('header', { class: 'bg-white border-b px-4 py-3 flex justify-between items-center' },
    el('div', { class: 'font-bold text-lg' }, 'Controle de Tapetes'),
    el('div', { class: 'flex items-center gap-3' },
      el('span', { class: 'text-sm text-gray-600' }, CURRENT_USER ? (CURRENT_USER.nome + ' (' + CURRENT_USER.tipo + ')') : ''),
      el('button', { class: 'text-sm text-red-600 hover:underline', onclick: logout }, 'Sair')
    )
  );

  const aside = el('aside', { class: 'w-56 bg-white border-r p-4 hidden md:block' });
  for (const item of menuItems) {
    aside.appendChild(el('a', {
      href: item.href,
      class: 'block py-2 px-3 rounded hover:bg-gray-100 text-gray-700'
    }, item.label));
  }

  const main = el('main', { class: 'flex-1 p-6 bg-gray-100' }, contentNode);

  root.appendChild(header);
  root.appendChild(el('div', { class: 'flex flex-1' }, aside, main));
  return root;
}

function screenPainel() {
  const content = el('div', {},
    el('h1', { class: 'text-2xl font-bold mb-4' }, 'Painel'),
    el('div', { class: 'bg-white rounded-xl p-6 shadow' },
      el('p', { class: 'text-gray-700' }, 'Bem-vindo, ' + CURRENT_USER.nome + '. (Fase 1 — placeholder; as próximas fases vão preencher essa tela.)')
    )
  );
  return shellLayout([
    { href: '#/painel', label: 'Painel' },
  ], content);
}

function screenFornecedorHome() {
  const content = el('div', {},
    el('h1', { class: 'text-2xl font-bold mb-4' }, 'Área do Fornecedor'),
    el('div', { class: 'bg-white rounded-xl p-6 shadow' },
      el('p', { class: 'text-gray-700' }, 'Olá, ' + CURRENT_USER.nome + '. (Fase 1 — placeholder; suas entregas aparecem aqui a partir da Fase 4/5.)')
    )
  );
  return shellLayout([
    { href: '#/fornecedor/home', label: 'Minhas OPs' },
  ], content);
}

function screenForbidden() {
  return el('div', { class: 'min-h-screen flex flex-col items-center justify-center p-4 text-center' },
    el('h1', { class: 'text-3xl font-bold text-red-600 mb-2' }, 'Acesso negado'),
    el('p', { class: 'text-gray-600 mb-4' }, 'Você não tem permissão pra essa tela.'),
    el('button', { class: 'bg-blue-700 text-white px-4 py-2 rounded-lg', onclick: () => routeAfterLogin() }, 'Voltar pro início')
  );
}

function screenNotFound() {
  return el('div', { class: 'min-h-screen flex flex-col items-center justify-center p-4 text-center' },
    el('h1', { class: 'text-3xl font-bold mb-2' }, '404'),
    el('p', { class: 'text-gray-600 mb-4' }, 'Tela não encontrada.'),
    el('button', { class: 'bg-blue-700 text-white px-4 py-2 rounded-lg', onclick: () => navigate('#/login') }, 'Ir pro login')
  );
}

// =====================================================================
// === MAIN ============================================================
// =====================================================================
async function main() {
  window.addEventListener('hashchange', handleRoute);

  await loadCurrentUser();
  if (!CURRENT_USER) {
    navigate('#/login');
  } else {
    if (location.hash && location.hash !== '#/login') handleRoute();
    else routeAfterLogin();
  }
}

main().catch(err => {
  console.error(err);
  toast('Erro ao iniciar o app', 'error');
});
</script>

</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(app): HTML base com login e roteamento por perfil"
```

**Critério de feito:** `index.html` criado, com credenciais reais do Supabase, commitado.

---

## Task 17: [AGENT + MANUAL] Push pro GitHub e validar deploy

**Files:** nenhum (push + verificação).

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Aguardar GitHub Pages publicar**

~1-2 minutos. Acompanhar na aba **Actions** do repo (vai ter 1 workflow rodando "pages-build-deployment").

- [ ] **Step 3: Abrir URL pública no navegador**

Vinicius abre `https://seuusuario.github.io/controle-tapetes/` no navegador.

Esperado: tela de login carregada, sem erros no console (F12 → Console).

**Critério de feito:** página carrega, formulário de login visível, sem erros 404 ou de CDN.

---

## Task 18: [MANUAL] Validar fluxo de login dos 4 perfis (checklist QA)

**Files:**
- Create: `docs/qa/fase1-checklist.md`

- [ ] **Step 1: AGENT escreve `docs/qa/fase1-checklist.md`**

Conteúdo:

```markdown
# QA — Fase 1 (Fundação)

## Cenário 1: Login como admin
- [ ] Entrar com `admin@tapetes.test` / `Admin123!`
- [ ] Tela redireciona pra `#/painel`
- [ ] Mostra "Bem-vindo, Murilo (Admin)"
- [ ] Botão "Sair" no canto superior direito
- [ ] Clicar em "Sair" leva de volta pra `#/login`

## Cenário 2: Login como fornecedor de fios
- [ ] Entrar com `algodao@tapetes.test` / `Fornec123!`
- [ ] Tela redireciona pra `#/fornecedor/home`
- [ ] Mostra "Olá, Fios Sul"

## Cenário 3: Login como tecelagem
- [ ] Entrar com `tecelagem@tapetes.test` / `Fornec123!`
- [ ] Redireciona pra `#/fornecedor/home`
- [ ] Mostra "Olá, Aurora"

## Cenário 4: Login como látex
- [ ] Entrar com `latex@tapetes.test` / `Fornec123!`
- [ ] Redireciona pra `#/fornecedor/home`
- [ ] Mostra "Olá, Premier"

## Cenário 5: Senha errada
- [ ] Tentar admin@tapetes.test / senhaerrada
- [ ] Toast vermelho "E-mail ou senha incorretos"
- [ ] Continua na tela de login

## Cenário 6: Acesso indevido a rota de admin
- [ ] Logar como `algodao@tapetes.test`
- [ ] Navegar manualmente pra `#/painel`
- [ ] Mostra tela "Acesso negado"

## Cenário 7: RLS bloqueando leitura indevida (Supabase Studio)
- [ ] No Supabase Studio, abrir SQL Editor
- [ ] Rodar como anon (não logado): `SELECT * FROM ops;` → deve retornar 0 linhas (ou erro)
- [ ] Em outro browser logado como tecelagem, abrir DevTools → Console e rodar:
      `await supa.from('fornecedores').select('*')` → deve retornar APENAS o registro "Tecelagem Aurora"
- [ ] Mesma chamada como admin no console → retorna os 4 fornecedores

## Cenário 8: Sessão persiste após reload
- [ ] Logar como admin
- [ ] Apertar F5
- [ ] Continua logado, vai direto pra `#/painel`
```

- [ ] **Step 2: Commit do checklist**

```bash
git add docs/qa/fase1-checklist.md
git commit -m "docs: checklist QA da Fase 1"
git push
```

- [ ] **Step 3: Vinicius executa o checklist na URL do GitHub Pages**

Marca cada item conforme valida. Reporta qualquer falha.

**Critério de feito:** todos os 8 cenários passam.

---

## Task 19: [AGENT] Fechar Fase 1

**Files:**
- Create: `docs/superpowers/STATUS.md`

- [ ] **Step 1: Escrever `docs/superpowers/STATUS.md`**

Conteúdo:

```markdown
# Status do projeto

## Fase atual: 2 — Admin: Cadastros (próxima)

## Fases concluídas

### Fase 1 — Fundação ✅ (concluída em <DATA>)
- Repo GitHub criado e GitHub Pages ativo: <URL>
- Projeto Supabase ativo com 13 tabelas + RLS
- Seed de cadastros base aplicado
- 4 usuários de teste criados (1 admin + 3 fornecedores)
- Login funcional com redirecionamento por perfil
- Checklist QA Fase 1: 8/8 cenários passando

## Próximas fases
- Fase 2 — Admin: telas de cadastros (cores, modelos, parâmetros, fornecedores, preços, usuários)
- Fase 3 — Admin: Nova OP com cálculo ao vivo
- Fase 4 — Fornecedor de fios + recálculo
- Fase 5 — Tecelagem e látex
- Fase 6 — Fechamento, painel, estoque
- Fase 7 — Polimento visual
```

Substituir `<DATA>` e `<URL>` pelos valores reais.

- [ ] **Step 2: Commit final**

```bash
git add docs/superpowers/STATUS.md
git commit -m "docs(fase1): conclusao da fundacao"
git push
```

**Critério de feito:** STATUS.md atualizado, commit final feito.

---

## Resumo da Fase 1

- **Tasks manuais (Vinicius):** 1, 2, 4, 6, 8, 10, 12, 13, 14, 17 (parte), 18 (execução)
- **Tasks agente (Claude):** 3, 5, 7, 9, 11, 15, 16, 17 (push), 18 (escrever checklist), 19
- **Tempo estimado:** 1 dia de trabalho real (com pausas pra Vinicius fazer as partes manuais)
- **Pronto pra Fase 2** quando todos os 8 cenários do checklist QA passarem
