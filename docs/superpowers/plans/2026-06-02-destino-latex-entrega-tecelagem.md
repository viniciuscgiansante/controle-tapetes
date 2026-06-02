# Destino de látex na entrega da tecelagem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a tecelagem (e o admin) informe, obrigatoriamente, para qual empresa de látex o material da parte de cima foi enviado, ao registrar/editar uma entrega.

**Architecture:** Uma coluna `destino_fornecedor_id` em `entregas` + uma policy RLS de leitura das empresas de látex. No front (`index.html`, vanilla JS, app de página única), o form inline de entrega ganha um `<select>` "Destino (látex)"; a persistência valida e grava o campo; o histórico (fornecedor e admin) exibe o nome do destino.

**Tech Stack:** HTML/CSS/JS vanilla + Supabase (Postgres + RLS). Sem framework, sem build. Testes automatizados só para funções puras em `tests/calculo-op.test.js` (rodados com `node --test`). DOM e SQL são verificados manualmente (padrão do projeto via `docs/qa/`).

---

## File Structure

- **Create** `db/07_fase5a_destino_latex.sql` — migração idempotente: coluna `destino_fornecedor_id`, CHECK de obrigatoriedade para `etapa='cima'`, e policy `fornecedores_latex_read`.
- **Modify** `index.html`:
  - `buildEntregaInlineForm(...)` (linha ~444) — novo param `latexOptions`, novo `<select>`, `getPayload()` retorna `destino_fornecedor_id`.
  - `salvarEntregaCima(...)` (linha ~503) e `atualizarEntregaCima(...)` (linha ~520) — valida destino e grava.
  - `screenFornecedorEntregas` (linha ~552) — carrega lista de látex, passa ao form, exibe destino no histórico (`linhaHistorico`, linha ~673).
  - Bloco admin da tecelagem `buildBlocoTecelagem` (linha ~1227) dentro da screen da OP (var `cimaFornecedorId`, linha ~897) — carrega látex, passa ao form, exibe destino no histórico.
- **Modify** `docs/qa/fase5a-checklist.md` — novos itens de QA do destino.

**Nota sobre testes:** o destino é apenas um vínculo (FK) e não altera nenhum cálculo de metros, então não há nova função pura a testar (decisão registrada na spec). Os 23 testes de `tests/calculo-op.test.js` servem como regressão e devem permanecer verdes (o arquivo `js/calculo-op.js` não é tocado). A verificação funcional do destino é manual, via checklist de QA.

---

## Task 1: Migração de banco (schema + RLS)

**Files:**
- Create: `db/07_fase5a_destino_latex.sql`

- [ ] **Step 1: Criar o arquivo de migração**

```sql
-- ============================================================
-- Fase 5a (complemento) — Destino de látex na entrega da tecelagem
-- Idempotente: pode rodar várias vezes.
-- ============================================================

-- Limpa entregas de teste 'cima' antes de impor o CHECK de obrigatoriedade.
-- (O QA da Fase 5a ainda não rodou; não há entregas 'cima' reais — só dados
-- de teste, que podem ser recriados depois.)
DELETE FROM entregas WHERE etapa = 'cima';

-- Coluna de destino (empresa de látex). Nula para etapa 'latex' (Fase 5b).
ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS destino_fornecedor_id BIGINT
  REFERENCES fornecedores(id) ON DELETE RESTRICT;

-- Obrigatório quando etapa = 'cima'.
ALTER TABLE entregas DROP CONSTRAINT IF EXISTS entregas_destino_cima_chk;
ALTER TABLE entregas
  ADD CONSTRAINT entregas_destino_cima_chk
  CHECK (etapa <> 'cima' OR destino_fornecedor_id IS NOT NULL);

-- RLS: permitir que qualquer usuário autenticado liste empresas de látex
-- (necessário para o dropdown de destino visto pela tecelagem).
DROP POLICY IF EXISTS fornecedores_latex_read ON fornecedores;
CREATE POLICY fornecedores_latex_read ON fornecedores
  FOR SELECT USING (tipo = 'latex');
```

- [ ] **Step 2: Conferência de idempotência (revisão visual)**

Releia o arquivo e confirme: usa `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` antes de `ADD CONSTRAINT`, e `DROP POLICY IF EXISTS` antes de `CREATE POLICY`. Rodar duas vezes não deve dar erro.

> **Execução no Supabase é manual** (regra do projeto: rodar SQL no painel do Supabase). O usuário roda `db/07_fase5a_destino_latex.sql` no SQL Editor. Marque isso como pendência de deploy, não como passo automatizável aqui.

- [ ] **Step 3: Commit**

```bash
git add db/07_fase5a_destino_latex.sql
git commit -m "feat(fase5a): coluna destino_fornecedor_id e policy de leitura de latex"
```

---

## Task 2: Form inline — select de destino + payload

**Files:**
- Modify: `index.html` — `buildEntregaInlineForm` (~444) e seus 4 chamadores (~639, ~715 `abrirEdicao`, ~1255, ~1314 `abrirEdicaoAdmin`)

- [ ] **Step 1: Adicionar param `latexOptions` e o select ao form**

Em `buildEntregaInlineForm`, alterar a assinatura e criar o select. Trocar:

```js
function buildEntregaInlineForm({ opItens, modelosById, entrega = null }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const dataInput = textInput({ type: 'date', value: entrega?.data || hoje });
  const obsInput = textInput({ type: 'text', value: entrega?.observacao || '', placeholder: 'observação (opcional)' });
```

por:

```js
function buildEntregaInlineForm({ opItens, modelosById, entrega = null, latexOptions = [] }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const dataInput = textInput({ type: 'date', value: entrega?.data || hoje });
  const obsInput = textInput({ type: 'text', value: entrega?.observacao || '', placeholder: 'observação (opcional)' });
  const destinoSelect = selectInput({
    options: latexOptions,
    value: entrega?.destino_fornecedor_id ?? '',
    placeholder: '— selecione a empresa de látex —',
  });
```

- [ ] **Step 2: Incluir o campo no layout do form**

Trocar o bloco do `node` (linhas ~478-485):

```js
  const node = el('div', { class: 'mt-3 border-t pt-3' },
    el('div', { class: 'flex flex-wrap gap-3 mb-2' },
      el('div', { class: 'w-40' }, formField({ label: 'Data', input: dataInput })),
      el('div', { class: 'flex-1 min-w-[200px]' }, formField({ label: 'Observação da entrega', input: obsInput })),
    ),
    linhasNode,
  );
```

por:

```js
  const node = el('div', { class: 'mt-3 border-t pt-3' },
    el('div', { class: 'flex flex-wrap gap-3 mb-2' },
      el('div', { class: 'w-40' }, formField({ label: 'Data', input: dataInput })),
      el('div', { class: 'w-64 min-w-[200px]' }, formField({ label: 'Destino (látex)', input: destinoSelect })),
      el('div', { class: 'flex-1 min-w-[200px]' }, formField({ label: 'Observação da entrega', input: obsInput })),
    ),
    linhasNode,
  );
```

- [ ] **Step 3: `getPayload()` retorna o destino**

Trocar o `return` de `getPayload` (linha ~496):

```js
    return { data: dataInput.value || hoje, observacao: obsInput.value || null, linhas };
```

por:

```js
    const destino = destinoSelect.value === '' ? null : Number(destinoSelect.value);
    return { data: dataInput.value || hoje, observacao: obsInput.value || null, destino_fornecedor_id: destino, linhas };
```

- [ ] **Step 4: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 23` / `fail 0` (o arquivo de cálculo não foi tocado).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(fase5a): campo destino latex no form de entrega da tecelagem"
```

---

## Task 3: Persistência — validar e gravar o destino

**Files:**
- Modify: `index.html` — `salvarEntregaCima` (~503), `atualizarEntregaCima` (~520)

- [ ] **Step 1: Validar + gravar em `salvarEntregaCima`**

Trocar (linhas ~503-508):

```js
async function salvarEntregaCima({ fornecedorId, opId, payload }) {
  if (payload.linhas.length === 0) { toast('Adicione ao menos 1 item com metros entregues', 'error'); return false; }
  const ins = await supa.from('entregas').insert({
    fornecedor_id: fornecedorId, etapa: 'cima', data: payload.data, observacao: payload.observacao,
  }).select().single();
```

por:

```js
async function salvarEntregaCima({ fornecedorId, opId, payload }) {
  if (payload.linhas.length === 0) { toast('Adicione ao menos 1 item com metros entregues', 'error'); return false; }
  if (!payload.destino_fornecedor_id) { toast('Escolha a empresa de látex de destino', 'error'); return false; }
  const ins = await supa.from('entregas').insert({
    fornecedor_id: fornecedorId, etapa: 'cima', data: payload.data, observacao: payload.observacao,
    destino_fornecedor_id: payload.destino_fornecedor_id,
  }).select().single();
```

- [ ] **Step 2: Validar + gravar em `atualizarEntregaCima`**

Trocar (linhas ~520-524):

```js
async function atualizarEntregaCima({ entregaId, opId, payload }) {
  if (payload.linhas.length === 0) { toast('Adicione ao menos 1 item com metros entregues', 'error'); return false; }
  const upd = await supa.from('entregas').update({
    data: payload.data, observacao: payload.observacao,
  }).eq('id', entregaId);
```

por:

```js
async function atualizarEntregaCima({ entregaId, opId, payload }) {
  if (payload.linhas.length === 0) { toast('Adicione ao menos 1 item com metros entregues', 'error'); return false; }
  if (!payload.destino_fornecedor_id) { toast('Escolha a empresa de látex de destino', 'error'); return false; }
  const upd = await supa.from('entregas').update({
    data: payload.data, observacao: payload.observacao,
    destino_fornecedor_id: payload.destino_fornecedor_id,
  }).eq('id', entregaId);
```

- [ ] **Step 3: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 23` / `fail 0`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(fase5a): valida e grava destino latex ao salvar/editar entrega"
```

---

## Task 4: Tela do fornecedor — carregar látex, passar ao form e exibir no histórico

**Files:**
- Modify: `index.html` — `screenFornecedorEntregas` (~552), query de entregas (~574), `render` (~593) e seus handlers, `linhaHistorico` (~673), `abrirEdicao` (~711)

- [ ] **Step 1: Declarar e carregar a lista de látex na screen**

Logo no início de `screenFornecedorEntregas` (depois de `const container = el('div', {});`), adicionar:

```js
  let latexOptions = [];
```

Dentro de `reload()`, antes do `render(...)` final, carregar a lista (após o bloco que monta `modelosById`):

```js
    const latexRes = await supa.from('fornecedores').select('id, nome').eq('tipo', 'latex').order('nome');
    if (latexRes.error) { toast('Erro ao carregar empresas de látex', 'error'); console.error(latexRes.error); return; }
    latexOptions = (latexRes.data || []).map(f => ({ value: f.id, label: f.nome }));
```

- [ ] **Step 2: Incluir `destino_fornecedor_id` na query de entregas**

Trocar (linha ~575):

```js
      .select('id, data, observacao, criado_em, entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
```

por:

```js
      .select('id, data, observacao, criado_em, destino_fornecedor_id, destino:destino_fornecedor_id(nome), entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
```

- [ ] **Step 3: Passar `latexOptions` ao form na "Nova entrega"**

Trocar (linha ~639):

```js
            const form = buildEntregaInlineForm({ opItens: op.op_itens || [], modelosById });
```

por:

```js
            const form = buildEntregaInlineForm({ opItens: op.op_itens || [], modelosById, latexOptions });
```

- [ ] **Step 4: Passar `latexOptions` ao form na edição**

Em `abrirEdicao` (linha ~712), trocar:

```js
    const form = buildEntregaInlineForm({ opItens: opRef.op_itens || [], modelosById, entrega });
```

por:

```js
    const form = buildEntregaInlineForm({ opItens: opRef.op_itens || [], modelosById, entrega, latexOptions });
```

- [ ] **Step 5: Exibir o destino no histórico (`linhaHistorico`)**

Em `linhaHistorico`, na linha do cabeçalho (logo após o span da data, linha ~683), acrescentar o destino. Trocar:

```js
      el('div', {},
        el('span', { class: 'text-sm font-medium text-gray-800' }, opLabel + ' · '),
        el('span', { class: 'text-sm text-gray-500' }, new Date(entrega.data + 'T00:00:00').toLocaleDateString('pt-BR')),
      ),
```

por:

```js
      el('div', {},
        el('span', { class: 'text-sm font-medium text-gray-800' }, opLabel + ' · '),
        el('span', { class: 'text-sm text-gray-500' }, new Date(entrega.data + 'T00:00:00').toLocaleDateString('pt-BR')),
        el('span', { class: 'text-sm text-gray-500' }, ' · látex: ' + (entrega.destino?.nome || '?')),
      ),
```

- [ ] **Step 6: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 23` / `fail 0`.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(fase5a): tela do fornecedor passa destino latex e mostra no historico"
```

---

## Task 5: Bloco admin — carregar látex, passar ao form e exibir no histórico

**Files:**
- Modify: `index.html` — screen da OP (var `cimaFornecedorId`, ~897), load inicial de entregas (~924-929) e `reloadEntregasCima` (~1325), `buildBlocoTecelagem` (~1227): "Nova entrega" (~1255), histórico (~1280-1305), `abrirEdicaoAdmin` (~1311)

- [ ] **Step 1: Declarar a lista de látex no escopo da screen**

Junto das outras declarações (perto de `let cimaFornecedorId = null;`, linha ~897), adicionar:

```js
  let latexOptions = [];
```

- [ ] **Step 2: Carregar látex no load inicial e incluir destino na query**

No load inicial, trocar a query de entregas (linhas ~927-929):

```js
      const entRes = await supa.from('entregas')
        .select('id, fornecedor_id, data, observacao, fornecedores:fornecedor_id(nome), entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
        .eq('etapa', 'cima')
```

por:

```js
      const latexResIni = await supa.from('fornecedores').select('id, nome').eq('tipo', 'latex').order('nome');
      if (latexResIni.error) { toast('Erro ao carregar empresas de látex', 'error'); console.error(latexResIni.error); }
      latexOptions = (latexResIni.data || []).map(f => ({ value: f.id, label: f.nome }));
      const entRes = await supa.from('entregas')
        .select('id, fornecedor_id, data, observacao, destino_fornecedor_id, destino:destino_fornecedor_id(nome), fornecedores:fornecedor_id(nome), entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
        .eq('etapa', 'cima')
```

- [ ] **Step 3: Incluir destino na query de `reloadEntregasCima`**

Trocar (linha ~1327):

```js
      .select('id, fornecedor_id, data, observacao, fornecedores:fornecedor_id(nome), entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
```

por:

```js
      .select('id, fornecedor_id, data, observacao, destino_fornecedor_id, destino:destino_fornecedor_id(nome), fornecedores:fornecedor_id(nome), entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
```

- [ ] **Step 4: Passar `latexOptions` ao form na "Nova entrega" do admin**

Trocar (linha ~1255):

```js
          const form = buildEntregaInlineForm({ opItens: opItensRaw, modelosById });
```

por:

```js
          const form = buildEntregaInlineForm({ opItens: opItensRaw, modelosById, latexOptions });
```

- [ ] **Step 5: Passar `latexOptions` ao form em `abrirEdicaoAdmin`**

Trocar (linha ~1312):

```js
    const form = buildEntregaInlineForm({ opItens: opItensRaw, modelosById, entrega });
```

por:

```js
    const form = buildEntregaInlineForm({ opItens: opItensRaw, modelosById, entrega, latexOptions });
```

- [ ] **Step 6: Exibir destino no histórico do admin**

No subcard do histórico (linha ~1286), trocar:

```js
          el('div', { class: 'text-sm' },
            el('b', {}, new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR')),
            ' · ' + (ent.fornecedores?.nome || '?'),
          ),
```

por:

```js
          el('div', { class: 'text-sm' },
            el('b', {}, new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR')),
            ' · ' + (ent.fornecedores?.nome || '?'),
            ' → látex: ' + (ent.destino?.nome || '?'),
          ),
```

- [ ] **Step 7: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 23` / `fail 0`.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(fase5a): bloco admin passa destino latex e mostra no historico"
```

---

## Task 6: Atualizar o checklist de QA

**Files:**
- Modify: `docs/qa/fase5a-checklist.md`

- [ ] **Step 1: Acrescentar a seção de destino de látex**

Adicionar, antes da seção `## Resultado`, o bloco:

```markdown
## Destino de látex (manual)
- [ ] 22. Form de entrega da tecelagem mostra o select "Destino (látex)" com as empresas de látex cadastradas.
- [ ] 23. Salvar sem escolher destino → toast de erro e não grava.
- [ ] 24. Salvar com destino → grava `entregas.destino_fornecedor_id`; histórico mostra "látex: <empresa>".
- [ ] 25. Editar entrega carrega o destino atual; trocar o destino e salvar persiste o novo.
- [ ] 26. Admin: bloco da tecelagem mostra o select de destino ao lançar; histórico mostra "→ látex: <empresa>".
- [ ] 27. Tecelagem (logado) consegue listar as empresas de látex no select (policy `fornecedores_latex_read` ativa).
```

E atualizar o cabeçalho de contagem na seção `## Resultado` de `X/21` para `X/27`.

- [ ] **Step 2: Commit**

```bash
git add docs/qa/fase5a-checklist.md
git commit -m "docs(fase5a): itens de QA do destino de latex"
```

---

## Pendências de deploy (manuais, fora do código)

- Rodar `db/07_fase5a_destino_latex.sql` no SQL Editor do Supabase (e confirmar que `db/06_fase5a_policies.sql` já foi rodado).
- Executar o QA manual (itens 6–27 do checklist) com o app publicado.
