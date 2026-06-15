# Corrigir / Desfazer recebimento de fio — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir corrigir (kg + data) e desfazer um recebimento de fio enquanto a OP está `aberta`, nas telas do admin e do fornecedor.

**Architecture:** Três helpers de nível de módulo (`corrigirRecebimentoFio`, `desfazerRecebimentoFio`, `botoesRecebimentoFio`) reaproveitam `modal`/`confirmDialog` existentes. As tabelas "Recebidas" de cada tela ganham uma coluna "Ações" com os botões; o gating "só com OP aberta" fica em quem renderiza a coluna.

**Tech Stack:** Vanilla JS num único `index.html`, Supabase (Postgres + RLS). Sem build. Verificação é manual no app + checklist de QA (padrão do projeto; não há lógica pura nova para `tests/`).

**Nota de desenho:** O spec descreveu "Corrigir" como edição inline da linha. Na implementação usamos o `modal` já existente (kg + data + Salvar/Cancelar, com tratamento de erro embutido) — UX equivalente, menos código e menos risco. Comportamento idêntico ao aprovado.

**Como rodar/verificar:** servir o `index.html` (servidor estático local ou o GitHub Pages do projeto) e logar como admin e como fornecedor, conforme os checklists em `docs/qa/`.

---

### Task 1: Helpers compartilhados (corrigir / desfazer / botões)

**Files:**
- Modify: `index.html` — inserir logo após a função `excluirEntrega` (que termina por volta da linha 604, antes de `async function screenFornecedorEntregas()`).

- [ ] **Step 1: Inserir os três helpers**

Colar este bloco imediatamente após o fechamento de `excluirEntrega(...)`:

```js
// ------------------------------------------------------------
// Corrigir / desfazer um recebimento de fio (ordens_compra_fio).
// IMPORTANTE: só deve ser OFERECIDO enquanto a OP está 'aberta'
// (antes de aplicar a proposta de ajuste, que grava saldo_fios e
// metros ajustados). O gating fica em quem renderiza os botões.
// ------------------------------------------------------------
function corrigirRecebimentoFio(ordem, onSuccess) {
  const hoje = new Date().toISOString().slice(0, 10);
  const kgInput = textInput({ type: 'number', step: '0.001', value: String(ordem.kg_recebido ?? '') });
  const dataInput = textInput({ type: 'date', value: ordem.data_recebimento || hoje });
  const pedidoTxt = Number(ordem.kg_pedido).toFixed(3).replace('.', ',') + ' kg';
  const body = el('div', {},
    el('p', { class: 'text-sm text-gray-500 mb-3' }, 'Pedido: ' + pedidoTxt),
    formField({ label: 'Kg recebido', input: kgInput }),
    formField({ label: 'Data', input: dataInput }),
  );
  modal({
    title: 'Corrigir recebimento',
    body,
    saveLabel: 'Salvar',
    onSave: async () => {
      const kg = Number(kgInput.value);
      if (!(kg > 0)) { toast('Informe o kg recebido', 'error'); return false; }
      const dataRec = dataInput.value || hoje;
      const status = kg < Number(ordem.kg_pedido) ? 'recebido_parcial' : 'recebido_total';
      const { error } = await supa.from('ordens_compra_fio')
        .update({ kg_recebido: kg, data_recebimento: dataRec, status })
        .eq('id', ordem.id);
      if (error) { toast('Erro ao corrigir recebimento', 'error'); console.error(error); return false; }
      toast('Recebimento corrigido', 'success');
      if (onSuccess) onSuccess();
    },
  });
}

function desfazerRecebimentoFio(ordemId, onSuccess) {
  confirmDialog({
    title: 'Desfazer recebimento',
    message: 'A ordem volta para "Pendente" e o kg recebido será apagado. Continuar?',
    confirmLabel: 'Desfazer',
    onConfirm: async () => {
      const { error } = await supa.from('ordens_compra_fio')
        .update({ kg_recebido: null, data_recebimento: null, status: 'pendente' })
        .eq('id', ordemId);
      if (error) { toast('Erro ao desfazer recebimento', 'error'); console.error(error); return; }
      toast('Recebimento desfeito', 'success');
      if (onSuccess) onSuccess();
    },
  });
}

// Botões de ação (Corrigir/Desfazer) para uma ordem de fio recebida.
// onSuccess recarrega a tela que chamou.
function botoesRecebimentoFio(ordem, onSuccess) {
  return el('div', { class: 'flex gap-3 justify-end' },
    el('button', { class: 'text-sm text-blue-700 hover:underline',
      onclick: () => corrigirRecebimentoFio(ordem, onSuccess) }, 'Corrigir'),
    el('button', { class: 'text-sm text-red-600 hover:underline',
      onclick: () => desfazerRecebimentoFio(ordem.id, onSuccess) }, 'Desfazer'),
  );
}
```

- [ ] **Step 2: Verificar que o arquivo carrega sem erro de sintaxe**

Abrir `index.html` no navegador e conferir o Console (DevTools): nenhum `SyntaxError`. A página deve renderizar a tela de login normalmente. (Os botões ainda não aparecem em lugar nenhum — só foram definidos.)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(fio): helpers para corrigir/desfazer recebimento de fio

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Tela do admin — coluna Ações nas ordens recebidas

**Files:**
- Modify: `index.html` — função `reloadOrdens` (query por volta da linha 1440) e a tabela "Recebidas" dentro de `buildBlocoFios` (por volta da linha 1551, dentro do ramo `if (op.status === 'aberta')`).

- [ ] **Step 1: Incluir `data_recebimento` no select de `reloadOrdens`**

Trocar:

```js
    const r = await supa.from('ordens_compra_fio')
      .select('id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido, status, cores:cor_id(id, nome)')
      .eq('op_id', op.id);
```

Por:

```js
    const r = await supa.from('ordens_compra_fio')
      .select('id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido, data_recebimento, status, cores:cor_id(id, nome)')
      .eq('op_id', op.id);
```

(O modal de "Corrigir" precisa de `data_recebimento` para pré-preencher a data.)

- [ ] **Step 2: Adicionar a coluna "Ações" na tabela "Recebidas" do admin**

Trocar:

```js
      if (recebidas.length) {
        box.appendChild(el('div', { class: 'text-xs uppercase text-gray-500 mt-2 mb-1' }, 'Recebidas'));
        box.appendChild(dataTable({
          columns: [
            { key: 'fio', label: 'Fio', render: rotuloFioOrdem },
            { key: 'kg_pedido', label: 'Pedido', render: (o) => fmtKg(o.kg_pedido) },
            { key: 'kg_recebido', label: 'Recebido', render: (o) => fmtKg(o.kg_recebido) },
            { key: 'status', label: 'Status', render: (o) => OCF_STATUS_LABEL[o.status] || o.status },
          ],
          rows: recebidas,
        }));
      }
```

Por:

```js
      if (recebidas.length) {
        box.appendChild(el('div', { class: 'text-xs uppercase text-gray-500 mt-2 mb-1' }, 'Recebidas'));
        box.appendChild(dataTable({
          columns: [
            { key: 'fio', label: 'Fio', render: rotuloFioOrdem },
            { key: 'kg_pedido', label: 'Pedido', render: (o) => fmtKg(o.kg_pedido) },
            { key: 'kg_recebido', label: 'Recebido', render: (o) => fmtKg(o.kg_recebido) },
            { key: 'status', label: 'Status', render: (o) => OCF_STATUS_LABEL[o.status] || o.status },
            { key: 'acoes', label: 'Ações', render: (o) => botoesRecebimentoFio(o, reloadOrdens) },
          ],
          rows: recebidas,
        }));
      }
```

Este sub-bloco só é renderizado dentro de `if (op.status === 'aberta')`, então o gating "só com OP aberta" já está garantido. O ramo `else` (OP em produção/finalizada) continua somente leitura, sem ações.

- [ ] **Step 3: Verificação manual (admin)**

Logado como admin, abrir uma OP `aberta` que já tenha pelo menos um fio recebido (registre um se necessário). Na seção "Recebimento de fios" → "Recebidas":
- Aparecem os botões **Corrigir** e **Desfazer** na coluna Ações.
- **Corrigir** abre o modal com kg e data preenchidos; salvar com um valor menor que o pedido mostra status "Recebido (parcial)"; a tabela atualiza.
- **Desfazer** pede confirmação e devolve a ordem para "Pendentes".
- Abrir uma OP em produção: a tabela de fios continua **sem** botões.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(fio): corrigir/desfazer recebimento na tela do admin

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Tela do fornecedor — coluna Ações gated por status da OP

**Files:**
- Modify: `index.html` — `screenFornecedorOrdens`: query de ordens (por volta da linha 971) e a tabela "Recebidas" dentro de `render(rows)` (por volta da linha 1028).

- [ ] **Step 1: Incluir `status` da OP no select**

Trocar:

```js
    const { data, error } = await supa.from('ordens_compra_fio')
      .select('id, tipo, cor_poliester, kg_pedido, kg_recebido, data_recebimento, status, ops(numero, ano), cores:cor_id(id, nome)')
      .order('id', { ascending: true });
```

Por:

```js
    const { data, error } = await supa.from('ordens_compra_fio')
      .select('id, tipo, cor_poliester, kg_pedido, kg_recebido, data_recebimento, status, ops(numero, ano, status), cores:cor_id(id, nome)')
      .order('id', { ascending: true });
```

- [ ] **Step 2: Adicionar a coluna "Ações" gated na tabela "Recebidas" do fornecedor**

Trocar:

```js
    blocos.push(el('div', { class: 'bg-white rounded-xl shadow p-5' },
      el('div', { class: 'font-semibold text-gray-700 mb-2' }, 'Recebidas'),
      recebidas.length === 0
        ? el('p', { class: 'text-sm text-gray-400' }, 'Nenhuma ordem recebida ainda.')
        : dataTable({
            columns: [
              { key: 'lote', label: 'Lote', render: lote },
              { key: 'fio', label: 'Fio', render: rotuloFio },
              { key: 'kg_pedido', label: 'Pedido', render: (r) => fmtKg(r.kg_pedido) },
              { key: 'kg_recebido', label: 'Recebido', render: (r) => fmtKg(r.kg_recebido) },
              { key: 'data', label: 'Data', render: (r) => new Date(r.data_recebimento + 'T00:00:00').toLocaleDateString('pt-BR') },
              { key: 'status', label: 'Status', render: (r) => OCF_STATUS_LABEL[r.status] || r.status },
            ],
            rows: recebidas,
          }),
    ));
```

Por:

```js
    blocos.push(el('div', { class: 'bg-white rounded-xl shadow p-5' },
      el('div', { class: 'font-semibold text-gray-700 mb-2' }, 'Recebidas'),
      recebidas.length === 0
        ? el('p', { class: 'text-sm text-gray-400' }, 'Nenhuma ordem recebida ainda.')
        : dataTable({
            columns: [
              { key: 'lote', label: 'Lote', render: lote },
              { key: 'fio', label: 'Fio', render: rotuloFio },
              { key: 'kg_pedido', label: 'Pedido', render: (r) => fmtKg(r.kg_pedido) },
              { key: 'kg_recebido', label: 'Recebido', render: (r) => fmtKg(r.kg_recebido) },
              { key: 'data', label: 'Data', render: (r) => new Date(r.data_recebimento + 'T00:00:00').toLocaleDateString('pt-BR') },
              { key: 'status', label: 'Status', render: (r) => OCF_STATUS_LABEL[r.status] || r.status },
              { key: 'acoes', label: 'Ações', render: (r) => r.ops?.status === 'aberta'
                  ? botoesRecebimentoFio(r, reload)
                  : document.createTextNode('—') },
            ],
            rows: recebidas,
          }),
    ));
```

Apenas as ordens cuja OP está `aberta` mostram os botões; as demais (OP já em produção/finalizada) mostram "—".

- [ ] **Step 3: Verificação manual (fornecedor)**

Logado como fornecedor, na tela "Minhas ordens" → "Recebidas":
- Ordens de OP `aberta` mostram **Corrigir** / **Desfazer**; Corrigir e Desfazer funcionam (mesma checagem da Task 2).
- Ordens de OP em produção/finalizada mostram "—" (sem botões).
- Confirmar no Console que o UPDATE do fornecedor não é bloqueado por RLS (sem erro 401/403); o registro de recebimento já usa o mesmo UPDATE, então deve passar.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(fio): corrigir/desfazer recebimento na tela do fornecedor

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Checklist de QA

**Files:**
- Create: `docs/qa/fase7-corrigir-recebimento-fio-checklist.md`

- [ ] **Step 1: Criar o checklist**

```markdown
# QA — Corrigir / Desfazer recebimento de fio

Pré-requisito: uma OP `aberta` com pelo menos um fio já recebido, e uma OP
`em_producao`/`finalizada` com fios recebidos (para checar a trava).

## Admin (tela da OP → "Recebimento de fios")
- [ ] OP aberta: ordens recebidas mostram botões **Corrigir** e **Desfazer**.
- [ ] Corrigir: modal abre com kg e data preenchidos.
- [ ] Corrigir com kg menor que o pedido → status vira "Recebido (parcial)".
- [ ] Corrigir com kg igual/maior que o pedido → status vira "Recebido".
- [ ] Desfazer: pede confirmação; ao confirmar, a ordem volta para "Pendentes".
- [ ] OP em produção/finalizada: tabela de fios SEM botões (somente leitura).
- [ ] Após corrigir/desfazer, a proposta de ajuste reflete o novo estado.

## Fornecedor (tela "Minhas ordens")
- [ ] Ordens de OP aberta mostram **Corrigir** / **Desfazer** e funcionam.
- [ ] Ordens de OP em produção/finalizada mostram "—".
- [ ] Nenhum erro de permissão (RLS) no Console ao corrigir/desfazer.

## Geral
- [ ] Nenhum erro no Console do navegador.
```

- [ ] **Step 2: Commit**

```bash
git add docs/qa/fase7-corrigir-recebimento-fio-checklist.md
git commit -m "docs(qa): checklist corrigir/desfazer recebimento de fio

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Cobertura do spec:** Desfazer (Task 1 helper + Tasks 2/3 botões) ✓; Corrigir via modal (Task 1 + 2/3) ✓; gating "só OP aberta" — admin via ramo `op.status==='aberta'` (Task 2), fornecedor via `ops.status==='aberta'` por linha (Task 3) ✓; admin e fornecedor ✓; recálculo de status idêntico ao registro ✓; padrão de erro `toast`+`console.error` ✓; QA manual (Task 4) ✓.
- **Desvio consciente do spec:** "Corrigir" usa `modal` em vez de linha inline — registrado no cabeçalho; comportamento equivalente.
- **Consistência de tipos/nomes:** `corrigirRecebimentoFio(ordem, onSuccess)`, `desfazerRecebimentoFio(ordemId, onSuccess)`, `botoesRecebimentoFio(ordem, onSuccess)` usados com a mesma assinatura nas Tasks 2 e 3. Reloads: `reloadOrdens` (admin) e `reload` (fornecedor) existem nas respectivas funções.
- **Dependência de dados:** `data_recebimento` adicionado ao select do admin (Task 2.1); `ops(status)` adicionado ao select do fornecedor (Task 3.1). Sem isso, modal do admin não pré-preenche a data e o gating do fornecedor não funciona.
- **Placeholders:** nenhum.
