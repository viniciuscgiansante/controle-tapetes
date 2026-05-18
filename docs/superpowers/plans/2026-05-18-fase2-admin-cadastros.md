# Fase 2 — Admin Cadastros · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar todas as 6 telas de cadastro que o admin precisa pra preencher o sistema antes de poder criar OPs: cores, modelos, parâmetros, fornecedores, preços, usuários.

**Architecture:** Continuação do single HTML com Tailwind CDN e Supabase JS via CDN. Cada tela é uma função `screen<Nome>()` que monta lista + modal pra criar/editar. RLS no banco garante que só admin vê/edita.

**Tech Stack:** mesma da Fase 1 (sem dependências novas).

**Pré-requisitos:** Fase 1 concluída (login, RLS, seed). Ver `docs/superpowers/STATUS.md`.

**Definição de "pronto" da Fase 2:**
- 6 telas funcionais no menu lateral do admin
- Cada tela: lista + criar + editar + excluir + validação básica
- Tela de Usuários: vincula UID já criado no Supabase Auth a `public.usuarios`
- Toasts de sucesso/erro em todas as ações
- Checklist QA Fase 2: 100% dos cenários passando

---

## Estrutura de arquivos da Fase 2

```
Controle Tapetes Murilo/
├── index.html                                # ÚNICO arquivo modificado (cresce ~600-800 linhas)
├── docs/
│   ├── qa/
│   │   ├── fase1-checklist.md                (já existe)
│   │   └── fase2-checklist.md                # NOVO
│   └── superpowers/
│       └── plans/
│           └── 2026-05-18-fase2-admin-cadastros.md  (este)
```

**Não cria arquivos novos no banco** — schema já está pronto na Fase 1.

---

## Convenções deste plano

- Tasks **AGENT** = Claude executa via tools (maioria dessa fase)
- Tasks **MANUAL** = Vinicius valida (só o checklist final)
- Commits frequentes (1 por task)
- Cada task termina com push pro GitHub Pages republicar

### Decisão importante: Tela de Usuários

Criar usuário no Supabase Auth via frontend exige `service_role` key (que NÃO PODE estar no HTML — bypassa RLS). Pra MVP, a tela vai funcionar em **modo "vincular usuário"**:

1. Admin abre o Supabase Studio em outra aba, Auth → Users → Create new user (manual)
2. Copia o UID gerado
3. Volta no app → tela Usuários → "+ Vincular usuário" → cola UID + preenche nome + tipo + fornecedor

Documentado na própria tela. Quando a gente decidir investir, fazemos uma Edge Function pra criar tudo de uma vez.

---

## Task 1: [AGENT] Helpers compartilhados (tabela, modal, form, confirmação)

**Files:**
- Modify: `index.html` (adicionar funções na seção `=== UTIL ===`)

**Goal:** criar 4 funções utilitárias que todas as telas de cadastro vão usar, evitando repetição.

- [ ] **Step 1: Localizar a seção UTIL no index.html**

Abrir `index.html` e localizar o bloco que começa com:

```js
// === UTIL ===
```

(deve estar próximo da linha 30-50, depois de `// === CONFIG ===`)

- [ ] **Step 2: Adicionar os helpers no fim da seção UTIL (antes do `// === SUPA ===`)**

Cole esse bloco de código logo antes da linha `// === SUPA ===`:

```js
// --- Modal genérico ---
// Uso: modal({title, body: node, onSave, saveLabel='Salvar'})
function modal({ title, body, onSave, saveLabel = 'Salvar', onClose }) {
  const overlay = el('div', {
    class: 'fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40',
    onclick: (e) => { if (e.target === overlay) close(); }
  });

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', escListener);
    if (onClose) onClose();
  }
  function escListener(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', escListener);

  const card = el('div', { class: 'bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col' });
  const header = el('div', { class: 'px-6 py-4 border-b flex justify-between items-center' },
    el('h2', { class: 'text-lg font-semibold' }, title),
    el('button', { class: 'text-gray-400 hover:text-gray-700 text-2xl leading-none', onclick: close }, '×')
  );
  const content = el('div', { class: 'px-6 py-4 overflow-y-auto flex-1' }, body);

  const btnCancel = el('button', { type: 'button',
    class: 'px-4 py-2 rounded-lg border hover:bg-gray-50', onclick: close }, 'Cancelar');
  const btnSave = el('button', { type: 'button',
    class: 'px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold',
    onclick: async () => {
      btnSave.disabled = true;
      btnSave.textContent = 'Salvando...';
      try {
        const result = await onSave();
        if (result !== false) close();
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = saveLabel;
      }
    }
  }, saveLabel);

  const footer = el('div', { class: 'px-6 py-4 border-t flex justify-end gap-2' }, btnCancel, btnSave);

  card.appendChild(header);
  card.appendChild(content);
  card.appendChild(footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  return { close };
}

// --- Confirmação destrutiva ---
function confirmDialog({ title, message, confirmLabel = 'Confirmar', danger = true, onConfirm }) {
  const body = el('p', { class: 'text-gray-700' }, message);
  modal({
    title,
    body,
    saveLabel: confirmLabel,
    onSave: async () => {
      await onConfirm();
    }
  });
}

// --- Campo de formulário (label + input/select/etc) ---
function formField({ label, input, hint }) {
  const wrap = el('div', { class: 'mb-4' });
  wrap.appendChild(el('label', { class: 'block text-sm font-medium text-gray-700 mb-1' }, label));
  wrap.appendChild(input);
  if (hint) wrap.appendChild(el('p', { class: 'text-xs text-gray-500 mt-1' }, hint));
  return wrap;
}

// --- Input texto/email/numero padrão ---
function textInput({ type = 'text', value = '', placeholder = '', required = false, step }) {
  const attrs = { type, placeholder,
    class: 'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' };
  if (required) attrs.required = 'required';
  if (step) attrs.step = step;
  const input = el('input', attrs);
  input.value = value;
  return input;
}

// --- Select padrão ---
function selectInput({ options, value, placeholder = 'Selecione...' }) {
  const sel = el('select', {
    class: 'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
  });
  sel.appendChild(el('option', { value: '' }, placeholder));
  for (const opt of options) {
    const o = el('option', { value: opt.value }, opt.label);
    if (String(opt.value) === String(value)) o.selected = true;
    sel.appendChild(o);
  }
  return sel;
}

// --- Tabela de dados ---
// Uso: dataTable({columns: [{key, label, render?}], rows, actions: [{label, onclick, class?}]})
function dataTable({ columns, rows, actions = [] }) {
  const wrap = el('div', { class: 'bg-white rounded-xl shadow overflow-hidden' });
  if (rows.length === 0) {
    wrap.appendChild(el('div', { class: 'p-8 text-center text-gray-500' }, 'Nenhum registro ainda.'));
    return wrap;
  }
  const table = el('table', { class: 'w-full' });
  const thead = el('thead', { class: 'bg-gray-50 border-b' });
  const trHead = el('tr', {});
  for (const col of columns) trHead.appendChild(el('th', { class: 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase' }, col.label));
  if (actions.length) trHead.appendChild(el('th', { class: 'px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase' }, 'Ações'));
  thead.appendChild(trHead);

  const tbody = el('tbody', { class: 'divide-y divide-gray-100' });
  for (const row of rows) {
    const tr = el('tr', { class: 'hover:bg-gray-50' });
    for (const col of columns) {
      const cellValue = col.render ? col.render(row) : (row[col.key] ?? '');
      const td = el('td', { class: 'px-4 py-3 text-sm text-gray-800' });
      if (cellValue instanceof Node) td.appendChild(cellValue); else td.textContent = String(cellValue);
      tr.appendChild(td);
    }
    if (actions.length) {
      const td = el('td', { class: 'px-4 py-3 text-right' });
      for (const a of actions) {
        const cls = a.class || 'text-blue-700 hover:underline';
        td.appendChild(el('button', { class: 'text-sm ml-3 ' + cls, onclick: () => a.onclick(row) }, a.label));
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(thead);
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// --- Page header padrão (título + botão de ação) ---
function pageHeader(title, actions = []) {
  const wrap = el('div', { class: 'flex justify-between items-center mb-4' });
  wrap.appendChild(el('h1', { class: 'text-2xl font-bold' }, title));
  const actWrap = el('div', { class: 'flex gap-2' });
  for (const a of actions) {
    actWrap.appendChild(el('button', {
      class: 'bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2 rounded-lg',
      onclick: a.onclick
    }, a.label));
  }
  wrap.appendChild(actWrap);
  return wrap;
}
```

- [ ] **Step 3: Atualizar o menu lateral do admin pra incluir Cadastros**

Localizar no index.html a função `screenPainel()` e o array passado pro `shellLayout`. Substituir o array por um com mais itens — encontrar este bloco:

```js
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
```

E substituir o array do `shellLayout` por:

```js
  return shellLayout(ADMIN_MENU, content);
}
```

E adicionar ANTES da definição de `screenPainel()`:

```js
const ADMIN_MENU = [
  { href: '#/painel',                  label: 'Painel' },
  { href: '#/cadastros/cores',         label: 'Cores' },
  { href: '#/cadastros/modelos',       label: 'Modelos' },
  { href: '#/cadastros/parametros',    label: 'Parâmetros' },
  { href: '#/cadastros/fornecedores',  label: 'Fornecedores' },
  { href: '#/cadastros/precos',        label: 'Preços' },
  { href: '#/cadastros/usuarios',      label: 'Usuários' },
];
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/viniciuscgiansante/Documents/Controle Tapetes Murilo"
git add index.html
git commit -m "feat(ui): helpers compartilhados (modal, dataTable, formField) + menu admin"
git push
```

**Critério de feito:** index.html commitado, menu admin mostra 7 itens depois do reload no GitHub Pages.

---

## Task 2: [AGENT] Tela de Cadastro de Cores

**Files:**
- Modify: `index.html`

**Comportamento esperado:**
- Lista todas as cores cadastradas
- Botão "+ Nova cor" abre modal com campo `nome`
- Cada linha tem botão "Editar" (abre modal preenchido) e "Excluir" (com confirmação)
- Validação: nome obrigatório, único (banco já garante via UNIQUE)

- [ ] **Step 1: Adicionar a função `screenCadastrosCores` na seção SCREENS**

Cole esse código antes da função `screenForbidden()`:

```js
async function screenCadastrosCores() {
  const container = el('div', {});

  async function reload() {
    const { data, error } = await supa.from('cores').select('*').order('nome');
    if (error) { toast('Erro ao carregar cores', 'error'); console.error(error); return; }
    render(data || []);
  }

  function render(rows) {
    container.replaceChildren(
      pageHeader('Cores', [{ label: '+ Nova cor', onclick: () => openModal(null) }]),
      dataTable({
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'nome', label: 'Nome' },
        ],
        rows,
        actions: [
          { label: 'Editar', onclick: (r) => openModal(r) },
          { label: 'Excluir', class: 'text-red-600 hover:underline', onclick: (r) => confirmExcluir(r) },
        ]
      })
    );
  }

  function openModal(cor) {
    const isEdit = !!cor;
    const nomeInput = textInput({ value: cor?.nome || '', placeholder: 'Ex: VERMELHO', required: true });
    const body = el('div', {}, formField({ label: 'Nome', input: nomeInput, hint: 'Use letras maiúsculas pra padronizar' }));
    modal({
      title: isEdit ? 'Editar cor' : 'Nova cor',
      body,
      onSave: async () => {
        const nome = nomeInput.value.trim().toUpperCase();
        if (!nome) { toast('Nome é obrigatório', 'error'); return false; }
        const payload = { nome };
        const { error } = isEdit
          ? await supa.from('cores').update(payload).eq('id', cor.id)
          : await supa.from('cores').insert(payload);
        if (error) { toast(error.message.includes('duplicate') ? 'Cor já cadastrada' : 'Erro ao salvar', 'error'); console.error(error); return false; }
        toast(isEdit ? 'Cor atualizada' : 'Cor criada', 'success');
        reload();
      }
    });
  }

  function confirmExcluir(cor) {
    confirmDialog({
      title: 'Excluir cor',
      message: `Excluir "${cor.nome}"? Se algum modelo usar essa cor, a exclusão vai falhar.`,
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        const { error } = await supa.from('cores').delete().eq('id', cor.id);
        if (error) { toast('Cor está em uso (não dá pra excluir)', 'error'); console.error(error); return; }
        toast('Cor excluída', 'success');
        reload();
      }
    });
  }

  await reload();
  return shellLayout(ADMIN_MENU, container);
}
```

- [ ] **Step 2: Registrar a rota no objeto `routes`**

Localizar o bloco `const routes = { ... }` e adicionar (mantendo as rotas que já existem):

```js
  '#/cadastros/cores': { render: screenCadastrosCores, roles: ['admin'] },
```

- [ ] **Step 3: Ajustar `handleRoute()` pra suportar telas async**

Localizar a função `handleRoute()`. O `setApp(route.render())` precisa virar `setApp(await route.render())` pra suportar telas que fazem fetch antes de renderizar.

Substituir as linhas:
```js
  if (route.public) { setApp(route.render()); return; }
```
por:
```js
  if (route.public) { setApp(await route.render()); return; }
```

E:
```js
    setApp(route.render());
```
por:
```js
    setApp(await route.render());
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(cadastros): tela de Cores (CRUD)"
git push
```

**Critério de feito:** ao clicar "Cores" no menu, lista aparece. Criar/editar/excluir funcionam. Toasts aparecem.

---

## Task 3: [AGENT] Tela de Cadastro de Modelos

**Files:**
- Modify: `index.html`

**Comportamento esperado:**
- Lista modelos com colunas: nome, cor 1, cor 2, largura
- Botão "+ Novo modelo" abre modal com nome + cor 1 (select de cores) + cor 2 (select) + largura (select 1.40 ou 2.10)
- Editar/excluir igual cores
- Validação: nome obrigatório, cores obrigatórias, largura obrigatória

- [ ] **Step 1: Adicionar função `screenCadastrosModelos`**

Cole antes de `screenForbidden()`:

```js
async function screenCadastrosModelos() {
  const container = el('div', {});

  async function reload() {
    const [modelosRes, coresRes] = await Promise.all([
      supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id, nome), cor_2:cor_2_id(id, nome)').order('nome'),
      supa.from('cores').select('id, nome').order('nome')
    ]);
    if (modelosRes.error || coresRes.error) { toast('Erro ao carregar', 'error'); console.error(modelosRes.error || coresRes.error); return; }
    render(modelosRes.data || [], coresRes.data || []);
  }

  function render(modelos, cores) {
    container.replaceChildren(
      pageHeader('Modelos', [{ label: '+ Novo modelo', onclick: () => openModal(null, cores) }]),
      dataTable({
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'nome', label: 'Nome' },
          { key: 'cor_1', label: 'Cor 1 (predominante)', render: (r) => r.cor_1?.nome || '' },
          { key: 'cor_2', label: 'Cor 2', render: (r) => r.cor_2?.nome || '' },
          { key: 'largura', label: 'Largura', render: (r) => Number(r.largura).toFixed(2).replace('.', ',') + ' m' },
        ],
        rows: modelos,
        actions: [
          { label: 'Editar', onclick: (r) => openModal(r, cores) },
          { label: 'Excluir', class: 'text-red-600 hover:underline', onclick: (r) => confirmExcluir(r) },
        ]
      })
    );
  }

  function openModal(modelo, cores) {
    const isEdit = !!modelo;
    const corOptions = cores.map(c => ({ value: c.id, label: c.nome }));
    const nomeInput = textInput({ value: modelo?.nome || '', placeholder: 'Ex: Conforto', required: true });
    const cor1Sel = selectInput({ options: corOptions, value: modelo?.cor_1?.id });
    const cor2Sel = selectInput({ options: corOptions, value: modelo?.cor_2?.id });
    const largSel = selectInput({
      options: [{ value: '1.40', label: '1,40 m' }, { value: '2.10', label: '2,10 m' }],
      value: modelo?.largura
    });
    const body = el('div', {},
      formField({ label: 'Nome do modelo', input: nomeInput }),
      formField({ label: 'Cor 1 (predominante)', input: cor1Sel, hint: 'A ordem importa: "BRANCO/PRETO" é diferente de "PRETO/BRANCO".' }),
      formField({ label: 'Cor 2', input: cor2Sel }),
      formField({ label: 'Largura', input: largSel })
    );
    modal({
      title: isEdit ? 'Editar modelo' : 'Novo modelo',
      body,
      onSave: async () => {
        const nome = nomeInput.value.trim();
        const cor_1_id = cor1Sel.value;
        const cor_2_id = cor2Sel.value;
        const largura = largSel.value;
        if (!nome || !cor_1_id || !cor_2_id || !largura) { toast('Preencha todos os campos', 'error'); return false; }
        const payload = { nome, cor_1_id, cor_2_id, largura };
        const { error } = isEdit
          ? await supa.from('modelos').update(payload).eq('id', modelo.id)
          : await supa.from('modelos').insert(payload);
        if (error) { toast(error.message.includes('duplicate') ? 'Modelo já cadastrado com essa combinação' : 'Erro ao salvar', 'error'); console.error(error); return false; }
        toast(isEdit ? 'Modelo atualizado' : 'Modelo criado', 'success');
        reload();
      }
    });
  }

  function confirmExcluir(modelo) {
    confirmDialog({
      title: 'Excluir modelo',
      message: `Excluir "${modelo.nome}"? Se algum item de OP usar esse modelo, a exclusão vai falhar.`,
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        const { error } = await supa.from('modelos').delete().eq('id', modelo.id);
        if (error) { toast('Modelo está em uso (não dá pra excluir)', 'error'); console.error(error); return; }
        toast('Modelo excluído', 'success');
        reload();
      }
    });
  }

  await reload();
  return shellLayout(ADMIN_MENU, container);
}
```

- [ ] **Step 2: Registrar rota**

Adicionar em `routes`:
```js
  '#/cadastros/modelos': { render: screenCadastrosModelos, roles: ['admin'] },
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(cadastros): tela de Modelos (CRUD com selects de cor e largura)"
git push
```

**Critério de feito:** tela acessível pelo menu, criar modelo com nome + 2 cores + largura funciona.

---

## Task 4: [AGENT] Tela de Parâmetros de Cálculo

**Files:**
- Modify: `index.html`

**Comportamento:**
- Tela DIFERENTE das outras: só tem 2 registros possíveis (largura 1.40 e 2.10), pré-criados no seed
- Mostra os 2 lado a lado, cada um com formulário inline editável
- Botão "Salvar" por largura, atualiza in-place
- Não tem criar/excluir (sempre essas 2 larguras)

- [ ] **Step 1: Adicionar `screenCadastrosParametros`**

Cole antes de `screenForbidden()`:

```js
async function screenCadastrosParametros() {
  const container = el('div', {});

  async function reload() {
    const { data, error } = await supa.from('parametros_largura').select('*').order('largura');
    if (error) { toast('Erro ao carregar parâmetros', 'error'); console.error(error); return; }
    render(data || []);
  }

  function render(rows) {
    const cards = el('div', { class: 'grid md:grid-cols-2 gap-4' });
    for (const p of rows) cards.appendChild(cardParametro(p));
    container.replaceChildren(
      pageHeader('Parâmetros de cálculo', []),
      el('p', { class: 'text-gray-600 mb-4 text-sm' }, 'Esses valores são usados no cálculo de fios ao simular uma OP. Edite com cuidado.'),
      cards
    );
  }

  function cardParametro(p) {
    const card = el('div', { class: 'bg-white rounded-xl shadow p-6' });
    card.appendChild(el('h2', { class: 'text-lg font-semibold mb-4' }, `Largura ${Number(p.largura).toFixed(2).replace('.', ',')} m`));
    const pesoInput  = textInput({ type: 'number', step: '0.0001', value: p.peso_linear });
    const algoInput  = textInput({ type: 'number', step: '0.000001', value: p.algodao_por_ml });
    const poliInput  = textInput({ type: 'number', step: '0.000001', value: p.poliester_por_ml });
    const valxInput  = textInput({ type: 'number', step: '0.0001', value: p.valor_x });
    card.appendChild(formField({ label: 'Peso linear', input: pesoInput }));
    card.appendChild(formField({ label: 'Algodão / ML', input: algoInput }));
    card.appendChild(formField({ label: 'Poliéster / ML', input: poliInput }));
    card.appendChild(formField({ label: 'Valor X', input: valxInput }));
    const btn = el('button', {
      class: 'mt-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2 rounded-lg',
      onclick: async () => {
        btn.disabled = true; btn.textContent = 'Salvando...';
        const payload = {
          peso_linear: pesoInput.value,
          algodao_por_ml: algoInput.value,
          poliester_por_ml: poliInput.value,
          valor_x: valxInput.value,
          atualizado_em: new Date().toISOString()
        };
        const { error } = await supa.from('parametros_largura').update(payload).eq('largura', p.largura);
        btn.disabled = false; btn.textContent = 'Salvar';
        if (error) { toast('Erro ao salvar', 'error'); console.error(error); return; }
        toast(`Parâmetros de ${p.largura}m atualizados`, 'success');
      }
    }, 'Salvar');
    card.appendChild(btn);
    return card;
  }

  await reload();
  return shellLayout(ADMIN_MENU, container);
}
```

- [ ] **Step 2: Registrar rota**

```js
  '#/cadastros/parametros': { render: screenCadastrosParametros, roles: ['admin'] },
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(cadastros): tela de Parametros (2 larguras editaveis)"
git push
```

**Critério de feito:** mostra 2 cards (1.40 e 2.10), editar e salvar persiste no banco.

---

## Task 5: [AGENT] Tela de Cadastro de Fornecedores

**Files:**
- Modify: `index.html`

**Comportamento:**
- Lista com colunas: nome, tipo (formato amigável)
- Filtro/agrupamento por tipo
- Criar/editar com nome + tipo (select com 4 opções)
- Excluir com confirmação

- [ ] **Step 1: Adicionar `screenCadastrosFornecedores`**

```js
const FORNECEDOR_TIPOS = [
  { value: 'fio_algodao',   label: 'Fornecedor de Algodão' },
  { value: 'fio_poliester', label: 'Fornecedor de Poliéster' },
  { value: 'tecelagem',     label: 'Tecelagem (parte de cima)' },
  { value: 'latex',         label: 'Látex (acabamento)' },
];

function labelFornecedorTipo(tipo) {
  return FORNECEDOR_TIPOS.find(t => t.value === tipo)?.label || tipo;
}

async function screenCadastrosFornecedores() {
  const container = el('div', {});

  async function reload() {
    const { data, error } = await supa.from('fornecedores').select('*').order('tipo').order('nome');
    if (error) { toast('Erro ao carregar fornecedores', 'error'); console.error(error); return; }
    render(data || []);
  }

  function render(rows) {
    container.replaceChildren(
      pageHeader('Fornecedores', [{ label: '+ Novo fornecedor', onclick: () => openModal(null) }]),
      dataTable({
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'nome', label: 'Nome' },
          { key: 'tipo', label: 'Tipo', render: (r) => labelFornecedorTipo(r.tipo) },
        ],
        rows,
        actions: [
          { label: 'Editar', onclick: (r) => openModal(r) },
          { label: 'Excluir', class: 'text-red-600 hover:underline', onclick: (r) => confirmExcluir(r) },
        ]
      })
    );
  }

  function openModal(forn) {
    const isEdit = !!forn;
    const nomeInput = textInput({ value: forn?.nome || '', placeholder: 'Ex: Tecelagem Fulano', required: true });
    const tipoSel = selectInput({ options: FORNECEDOR_TIPOS, value: forn?.tipo });
    const body = el('div', {},
      formField({ label: 'Nome', input: nomeInput }),
      formField({ label: 'Tipo', input: tipoSel })
    );
    modal({
      title: isEdit ? 'Editar fornecedor' : 'Novo fornecedor',
      body,
      onSave: async () => {
        const nome = nomeInput.value.trim();
        const tipo = tipoSel.value;
        if (!nome || !tipo) { toast('Preencha nome e tipo', 'error'); return false; }
        const payload = { nome, tipo };
        const { error } = isEdit
          ? await supa.from('fornecedores').update(payload).eq('id', forn.id)
          : await supa.from('fornecedores').insert(payload);
        if (error) { toast(error.message.includes('duplicate') ? 'Fornecedor com esse nome e tipo já existe' : 'Erro ao salvar', 'error'); console.error(error); return false; }
        toast(isEdit ? 'Fornecedor atualizado' : 'Fornecedor criado', 'success');
        reload();
      }
    });
  }

  function confirmExcluir(forn) {
    confirmDialog({
      title: 'Excluir fornecedor',
      message: `Excluir "${forn.nome}"? Se ele estiver vinculado a alguma OP, a exclusão vai falhar.`,
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        const { error } = await supa.from('fornecedores').delete().eq('id', forn.id);
        if (error) { toast('Fornecedor em uso (não dá pra excluir)', 'error'); console.error(error); return; }
        toast('Fornecedor excluído', 'success');
        reload();
      }
    });
  }

  await reload();
  return shellLayout(ADMIN_MENU, container);
}
```

- [ ] **Step 2: Registrar rota**

```js
  '#/cadastros/fornecedores': { render: screenCadastrosFornecedores, roles: ['admin'] },
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(cadastros): tela de Fornecedores (CRUD com 4 tipos)"
git push
```

**Critério de feito:** tela funciona, mostra os 4 fornecedores do seed, criar novo com tipo funciona.

---

## Task 6: [AGENT] Tela de Preços Terceirizadas

**Files:**
- Modify: `index.html`

**Comportamento:**
- Mostra tabela: fornecedor (tecelagem/látex) | etapa | largura | preço
- Filtra apenas fornecedores tipo `tecelagem` ou `latex`
- Cada linha tem preço editável inline (não precisa modal, mas faz com modal pra ficar consistente)
- "+ Novo preço" abre modal com select de fornecedor + select de etapa + select de largura + input preço

- [ ] **Step 1: Adicionar `screenCadastrosPrecos`**

```js
async function screenCadastrosPrecos() {
  const container = el('div', {});

  async function reload() {
    const [precosRes, fornsRes] = await Promise.all([
      supa.from('precos_terceirizada').select('id, etapa, largura, preco_por_metro, fornecedor:fornecedor_id(id, nome, tipo)').order('etapa').order('largura'),
      supa.from('fornecedores').select('id, nome, tipo').in('tipo', ['tecelagem', 'latex']).order('nome')
    ]);
    if (precosRes.error || fornsRes.error) { toast('Erro ao carregar', 'error'); console.error(precosRes.error || fornsRes.error); return; }
    render(precosRes.data || [], fornsRes.data || []);
  }

  function render(precos, forns) {
    container.replaceChildren(
      pageHeader('Preços de terceirizadas', [{ label: '+ Novo preço', onclick: () => openModal(null, forns) }]),
      el('p', { class: 'text-gray-600 mb-4 text-sm' }, 'Preço cobrado por metro produzido, por etapa (parte de cima ou látex) e largura.'),
      dataTable({
        columns: [
          { key: 'fornecedor', label: 'Fornecedor', render: (r) => r.fornecedor?.nome || '' },
          { key: 'etapa', label: 'Etapa', render: (r) => r.etapa === 'cima' ? 'Parte de cima' : 'Látex' },
          { key: 'largura', label: 'Largura', render: (r) => Number(r.largura).toFixed(2).replace('.', ',') + ' m' },
          { key: 'preco_por_metro', label: 'R$ / metro', render: (r) => 'R$ ' + Number(r.preco_por_metro).toFixed(2).replace('.', ',') },
        ],
        rows: precos,
        actions: [
          { label: 'Editar', onclick: (r) => openModal(r, forns) },
          { label: 'Excluir', class: 'text-red-600 hover:underline', onclick: (r) => confirmExcluir(r) },
        ]
      })
    );
  }

  function openModal(preco, forns) {
    const isEdit = !!preco;
    const fornOptions = forns.map(f => ({ value: f.id, label: `${f.nome} (${f.tipo === 'tecelagem' ? 'tecelagem' : 'látex'})` }));
    const etapaOptions = [{ value: 'cima', label: 'Parte de cima' }, { value: 'latex', label: 'Látex' }];
    const largOptions = [{ value: '1.40', label: '1,40 m' }, { value: '2.10', label: '2,10 m' }];

    const fornSel = selectInput({ options: fornOptions, value: preco?.fornecedor?.id });
    const etapaSel = selectInput({ options: etapaOptions, value: preco?.etapa });
    const largSel = selectInput({ options: largOptions, value: preco?.largura });
    const precoInput = textInput({ type: 'number', step: '0.01', value: preco?.preco_por_metro || '', placeholder: '0,00' });

    const body = el('div', {},
      formField({ label: 'Fornecedor', input: fornSel }),
      formField({ label: 'Etapa', input: etapaSel }),
      formField({ label: 'Largura', input: largSel }),
      formField({ label: 'Preço por metro (R$)', input: precoInput })
    );

    modal({
      title: isEdit ? 'Editar preço' : 'Novo preço',
      body,
      onSave: async () => {
        const fornecedor_id = fornSel.value;
        const etapa = etapaSel.value;
        const largura = largSel.value;
        const preco_por_metro = parseFloat(precoInput.value);
        if (!fornecedor_id || !etapa || !largura || isNaN(preco_por_metro) || preco_por_metro < 0) {
          toast('Preencha todos os campos com valores válidos', 'error'); return false;
        }
        const payload = { fornecedor_id, etapa, largura, preco_por_metro, atualizado_em: new Date().toISOString() };
        const { error } = isEdit
          ? await supa.from('precos_terceirizada').update(payload).eq('id', preco.id)
          : await supa.from('precos_terceirizada').insert(payload);
        if (error) { toast(error.message.includes('duplicate') ? 'Já existe preço pra esse fornecedor + etapa + largura' : 'Erro ao salvar', 'error'); console.error(error); return false; }
        toast(isEdit ? 'Preço atualizado' : 'Preço criado', 'success');
        reload();
      }
    });
  }

  function confirmExcluir(preco) {
    confirmDialog({
      title: 'Excluir preço',
      message: `Excluir esse preço (${preco.fornecedor?.nome}, ${preco.etapa}, ${preco.largura}m)?`,
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        const { error } = await supa.from('precos_terceirizada').delete().eq('id', preco.id);
        if (error) { toast('Erro ao excluir', 'error'); console.error(error); return; }
        toast('Preço excluído', 'success');
        reload();
      }
    });
  }

  await reload();
  return shellLayout(ADMIN_MENU, container);
}
```

- [ ] **Step 2: Registrar rota**

```js
  '#/cadastros/precos': { render: screenCadastrosPrecos, roles: ['admin'] },
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(cadastros): tela de Precos (terceirizadas, etapas, larguras)"
git push
```

**Critério de feito:** tela mostra os 4 preços do seed, criar/editar/excluir funciona.

---

## Task 7: [AGENT] Tela de Vinculação de Usuários

**Files:**
- Modify: `index.html`

**Comportamento:**
- Lista usuários cadastrados (email, nome, tipo, fornecedor vinculado)
- Botão "+ Vincular usuário" abre modal explicando o processo:
  1. Admin precisa primeiro criar o usuário no Supabase Studio (Auth → Users)
  2. Copiar o UID
  3. Voltar aqui e preencher UID + nome + tipo + fornecedor (se aplicável)
- Edição altera apenas nome e tipo (não o UID)
- Excluir: remove de `usuarios` E do `auth.users` é FORA do escopo (só admin via Supabase)

- [ ] **Step 1: Adicionar `screenCadastrosUsuarios`**

```js
async function screenCadastrosUsuarios() {
  const container = el('div', {});

  async function reload() {
    const [usersRes, fornsRes] = await Promise.all([
      supa.from('usuarios').select('id, email, nome, tipo, fornecedor:fornecedor_id(id, nome, tipo)').order('email'),
      supa.from('fornecedores').select('id, nome, tipo').order('nome')
    ]);
    if (usersRes.error || fornsRes.error) { toast('Erro ao carregar', 'error'); console.error(usersRes.error || fornsRes.error); return; }
    render(usersRes.data || [], fornsRes.data || []);
  }

  function render(users, forns) {
    container.replaceChildren(
      pageHeader('Usuários', [{ label: '+ Vincular usuário', onclick: () => openModal(null, forns) }]),
      el('div', { class: 'bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-sm text-yellow-900' },
        el('p', { class: 'font-semibold mb-1' }, 'Como criar um usuário novo:'),
        el('ol', { class: 'list-decimal pl-5 space-y-1' },
          el('li', {}, 'Abra o Supabase Studio → Authentication → Users → Add user → Create new user (marque Auto Confirm User).'),
          el('li', {}, 'Copie o UID gerado.'),
          el('li', {}, 'Volte aqui, clique "+ Vincular usuário" e cole o UID + dados.')
        )
      ),
      dataTable({
        columns: [
          { key: 'email', label: 'E-mail' },
          { key: 'nome', label: 'Nome' },
          { key: 'tipo', label: 'Tipo' },
          { key: 'fornecedor', label: 'Fornecedor', render: (r) => r.fornecedor?.nome || '—' },
        ],
        rows: users,
        actions: [
          { label: 'Editar', onclick: (r) => openModal(r, forns) },
          { label: 'Excluir vínculo', class: 'text-red-600 hover:underline', onclick: (r) => confirmExcluir(r) },
        ]
      })
    );
  }

  function openModal(usr, forns) {
    const isEdit = !!usr;
    const fornOptions = forns.map(f => ({ value: f.id, label: `${f.nome} (${labelFornecedorTipo(f.tipo)})` }));
    const tipoOptions = [{ value: 'admin', label: 'Admin' }, { value: 'fornecedor', label: 'Fornecedor' }];

    const idInput = textInput({ value: usr?.id || '', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' });
    idInput.disabled = isEdit;
    if (isEdit) idInput.classList.add('bg-gray-100');

    const emailInput = textInput({ type: 'email', value: usr?.email || '', placeholder: 'usuario@exemplo.com' });
    const nomeInput = textInput({ value: usr?.nome || '', placeholder: 'Ex: Fornecedor X' });
    const tipoSel = selectInput({ options: tipoOptions, value: usr?.tipo });
    const fornSel = selectInput({ options: fornOptions, value: usr?.fornecedor?.id, placeholder: '(nenhum)' });

    const body = el('div', {},
      formField({ label: 'UID do Auth', input: idInput, hint: isEdit ? 'Não pode ser alterado' : 'Cole o UID copiado do Supabase Studio' }),
      formField({ label: 'E-mail', input: emailInput, hint: 'Deve bater com o e-mail criado no Supabase Auth' }),
      formField({ label: 'Nome', input: nomeInput }),
      formField({ label: 'Tipo', input: tipoSel }),
      formField({ label: 'Fornecedor (se tipo for "fornecedor")', input: fornSel, hint: 'Deixe vazio se for admin' })
    );

    modal({
      title: isEdit ? 'Editar usuário' : 'Vincular usuário',
      body,
      onSave: async () => {
        const id = idInput.value.trim();
        const email = emailInput.value.trim();
        const nome = nomeInput.value.trim();
        const tipo = tipoSel.value;
        const fornecedor_id = fornSel.value || null;
        if (!id || !email || !nome || !tipo) { toast('Preencha UID, email, nome e tipo', 'error'); return false; }
        if (tipo === 'fornecedor' && !fornecedor_id) { toast('Usuário tipo "fornecedor" precisa de fornecedor vinculado', 'error'); return false; }
        const payload = { id, email, nome, tipo, fornecedor_id };
        const { error } = isEdit
          ? await supa.from('usuarios').update({ email, nome, tipo, fornecedor_id }).eq('id', usr.id)
          : await supa.from('usuarios').insert(payload);
        if (error) {
          let msg = 'Erro ao salvar';
          if (error.message.includes('duplicate')) msg = 'UID ou e-mail já cadastrado';
          if (error.message.includes('foreign key')) msg = 'UID não existe no Supabase Auth — crie lá primeiro';
          toast(msg, 'error'); console.error(error); return false;
        }
        toast(isEdit ? 'Usuário atualizado' : 'Usuário vinculado', 'success');
        reload();
      }
    });
  }

  function confirmExcluir(usr) {
    confirmDialog({
      title: 'Excluir vínculo',
      message: `Remover "${usr.email}" da tabela de usuários? O cadastro no Supabase Auth NÃO será removido (precisa fazer manual no Studio).`,
      confirmLabel: 'Remover',
      onConfirm: async () => {
        const { error } = await supa.from('usuarios').delete().eq('id', usr.id);
        if (error) { toast('Erro ao remover', 'error'); console.error(error); return; }
        toast('Vínculo removido', 'success');
        reload();
      }
    });
  }

  await reload();
  return shellLayout(ADMIN_MENU, container);
}
```

- [ ] **Step 2: Registrar rota**

```js
  '#/cadastros/usuarios': { render: screenCadastrosUsuarios, roles: ['admin'] },
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(cadastros): tela de Usuarios (vinculacao a UID do Auth)"
git push
```

**Critério de feito:** tela mostra os 4 usuários criados na Fase 1, vincular novo funciona quando UID já existe no Auth.

---

## Task 8: [AGENT + MANUAL] Checklist QA Fase 2

**Files:**
- Create: `docs/qa/fase2-checklist.md`

- [ ] **Step 1: AGENT escreve o checklist**

Conteúdo:

```markdown
# QA — Fase 2 (Admin Cadastros)

Pré-condição: logado como admin (`admin@tapetes.test` / `Admin123!`)

## Cenário 1 — Menu lateral
- [ ] Menu mostra 7 itens: Painel, Cores, Modelos, Parâmetros, Fornecedores, Preços, Usuários
- [ ] Cada item navega pra rota correspondente

## Cenário 2 — Cores: CRUD completo
- [ ] Lista mostra BRANCO, PRETO, BEGE (seed)
- [ ] "+ Nova cor" → criar VERMELHO → aparece na lista (toast verde)
- [ ] Editar VERMELHO pra ROXO → atualiza
- [ ] Excluir ROXO → confirmação → remove da lista
- [ ] Tentar excluir BRANCO (que está em uso por modelo) → toast vermelho "Cor em uso"

## Cenário 3 — Modelos: CRUD com cores
- [ ] Lista mostra "Conforto BRANCO/PRETO 1,40" e "Conforto PRETO/BRANCO 2,10" (seed)
- [ ] "+ Novo modelo" → criar "Premium BEGE/BRANCO 1,40" → aparece
- [ ] Editar para mudar cor 2 pra PRETO → atualiza
- [ ] Tentar criar duplicata exata (mesmo nome+cores+largura) → toast vermelho "Já cadastrado"
- [ ] Excluir o "Premium" criado → remove

## Cenário 4 — Parâmetros: edição
- [ ] Mostra 2 cards (1,40 e 2,10)
- [ ] Cada card mostra os 4 valores: peso linear, algodão/ml, poliéster/ml, valor x
- [ ] Editar valor x de 1,40 pra 1,5 → salvar → toast verde
- [ ] Recarregar a página (F5) → valor persistido
- [ ] Voltar valor pra 1,0 → salvar

## Cenário 5 — Fornecedores: CRUD com 4 tipos
- [ ] Lista mostra os 4 do seed (Fios Sul, Polifios, Aurora, Premier) com tipos formatados
- [ ] "+ Novo fornecedor" → criar "Teste LTDA" tipo "Látex" → aparece
- [ ] Editar tipo pra "Tecelagem" → atualiza
- [ ] Excluir "Teste LTDA" → remove
- [ ] Tentar excluir "Aurora" (vinculada a preço) → toast vermelho

## Cenário 6 — Preços: CRUD
- [ ] Lista mostra os 4 preços do seed (Aurora cima 1,40/2,10; Premier látex 1,40/2,10)
- [ ] "+ Novo preço" → tentar criar com fornecedor "Fios Sul" → o select só lista tecelagens e látex (NÃO mostra fornecedores de fio)
- [ ] Criar preço "Aurora látex 1,40 R$ 5,00" → falha porque tipo do fornecedor é tecelagem, não látex
  (TESTE ALTERNATIVO: criar com um novo fornecedor de látex que você acabou de cadastrar)
- [ ] Editar um preço existente → muda valor → toast verde
- [ ] Excluir um preço → remove

## Cenário 7 — Usuários: lista e vinculação
- [ ] Lista mostra os 4 usuários cadastrados na Fase 1
- [ ] Caixa amarela com instruções aparece no topo
- [ ] Editar nome do admin pra "Murilo" (sem o "(Admin)") → salva
- [ ] "+ Vincular usuário" com UID inventado → toast "UID não existe no Supabase Auth"
- [ ] "+ Vincular usuário" com UID válido (cria primeiro no Supabase Auth) → vincula

## Cenário 8 — Acesso fornecedor bloqueado
- [ ] Sair, logar como `algodao@tapetes.test`
- [ ] Editar URL pra `#/cadastros/cores` → tela "Acesso negado"
- [ ] Mesmo pra todas as outras rotas `#/cadastros/...`

## Cenário 9 — Validações de formulário
- [ ] Em qualquer modal, salvar com campos vazios → toast vermelho específico
- [ ] Em preços, salvar com preço negativo → toast vermelho
```

- [ ] **Step 2: Commit**

```bash
mkdir -p docs/qa
git add docs/qa/fase2-checklist.md
git commit -m "docs: checklist QA da Fase 2"
git push
```

- [ ] **Step 3: Vinicius roda o checklist na URL do GitHub Pages**

Espera 1 min após o último push pra Pages republicar. Cmd+Shift+R pra force reload. Marca cada cenário. Reporta o que falhar.

**Critério de feito:** 100% dos cenários passam (ou as falhas são reportadas e corrigidas em iteração).

---

## Task 9: [AGENT] Fechar Fase 2

**Files:**
- Modify: `docs/superpowers/STATUS.md`

- [ ] **Step 1: Atualizar STATUS.md**

Adicionar abaixo da seção da Fase 1:

```markdown
### Fase 2 — Admin Cadastros ✅ (concluída em <DATA>)

- 6 telas de cadastro funcionais: Cores, Modelos, Parâmetros, Fornecedores, Preços, Usuários
- Helpers reutilizáveis: modal, dataTable, formField, textInput, selectInput, pageHeader, confirmDialog
- Menu lateral expandido com 7 itens
- Roteamento por hash com suporte async
- Tela de Usuários em modo "vincular" (criação ainda manual no Supabase Auth — Edge Function fica pra depois)
- Checklist QA Fase 2: 9/9 cenários passando
```

Mudar "Fase atual" pra "3 — Admin: Nova OP (próxima)".

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/STATUS.md
git commit -m "docs(fase2): conclusao dos cadastros admin"
git push
```

**Critério de feito:** STATUS.md atualizado.

---

## Resumo da Fase 2

- **Tasks AGENT:** 1, 2, 3, 4, 5, 6, 7, 8 (escrita), 9 → 9 tasks ao todo
- **Tasks MANUAL:** apenas o checklist (Task 8 step 3) — você só valida no navegador
- **Tempo estimado:** 1 dia de trabalho (de Claude). Você gasta ~30 min validando.
- **Pronto pra Fase 3** quando todos os 9 cenários do checklist QA passarem.
