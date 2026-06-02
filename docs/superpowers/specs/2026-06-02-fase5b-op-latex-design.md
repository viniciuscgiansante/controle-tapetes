# Design — Fase 5b: OP de Látex (recebimento do produto final)

**Data:** 2026-06-02
**Fase:** 5b (Látex) — continuação natural da Fase 5a (Tecelagem) e do destino de látex na entrega.

## Problema / objetivo

Hoje a entrega da tecelagem já registra **quanto** foi e **para qual empresa de látex**.
Falta controlar o que acontece depois: a empresa de látex recebe a parte de cima,
aplica o látex e **devolve o produto pronto para a fábrica**. É preciso controlar
**Enviado × Recebido × Falta** desse acabamento.

Processo desejado pelo usuário:
1. Registra-se a entrega da tecelagem (Fase 5a, já existe).
2. Essa entrega **gera automaticamente uma OP nova específica de látex**.
3. Em cada OP de látex fica registrado quanto a tecelagem enviou e há um lugar para
   lançar o recebimento do produto final depois.

## Decisões (acordadas no brainstorming)

1. **Recebimento:** a fábrica recebe o produto final de volta. Controla-se
   enviado × recebido × falta.
2. **Onde vive:** as OPs de látex ficam na **mesma lista de OPs** das de produção,
   distinguidas por um **tipo** (tecelagem / látex) que permite **filtrar**.
3. **Numeração:** a OP de látex tem **número próprio sequencial** (independente das
   de produção). Dentro dela há uma observação de origem e um **botão de navegação**
   para a OP de tecelagem que a gerou (e vice-versa).
4. **Granularidade do recebimento:** **por modelo**, com recebimentos parciais ao
   longo do tempo, mostrando enviado × recebido × falta por modelo (igual à tecelagem).
5. **Acesso:** a empresa de látex **loga** e vê suas OPs de látex e registra os
   envios de volta (= recebimento na fábrica); o admin também pode lançar.
6. **Ciclo de vida:** a OP de látex é **totalmente independente após criada**.
   Editar/excluir a entrega de tecelagem de origem **não** mexe nela (ajuste manual
   fica por conta do responsável). O "enviado" é um **snapshot** no momento da criação.

**Abordagem escolhida (Opção A):** reaproveitar as tabelas existentes (`ops`,
`op_itens`, `op_fornecedores`, `entregas`, `entrega_itens`) em vez de criar tabelas
dedicadas de látex. Encaixa no "tudo na mesma lista", reusa telas/RLS/cálculos já
testados, e dá à empresa de látex uma tela espelhada à da tecelagem.

## 1. Modelo de dados

Migração idempotente nova: `db/08_fase5b_latex.sql`. Mudanças em `ops`:

| Mudança | Detalhe |
|---|---|
| `tipo` | `TEXT NOT NULL DEFAULT 'tecelagem' CHECK (tipo IN ('tecelagem','latex'))`. OPs existentes viram `'tecelagem'`. |
| `origem_op_id` | `BIGINT REFERENCES ops(id) ON DELETE SET NULL` — na OP de látex, a OP de tecelagem que a gerou. |
| `origem_entrega_id` | `BIGINT REFERENCES entregas(id) ON DELETE SET NULL` — a entrega de origem. `SET NULL`: se a entrega for excluída, a OP de látex sobrevive (independente). |
| `observacao` | `TEXT` — texto automático ("Gerada da entrega de DD/MM da OP N/AAAA (tecelagem)") e anotações manuais. |
| Numeração | Trocar `UNIQUE (numero, ano)` por `UNIQUE (numero, ano, tipo)` → sequências de número independentes por tipo. |
| Idempotência da origem | Índice único parcial em `origem_entrega_id` onde `tipo='latex'` (impede duplicar a OP de látex de uma mesma entrega). |

**Mapeamento conceitual (sem tabelas novas):**
- **OP de látex** = linha em `ops` com `tipo='latex'`, `status='em_producao'`,
  número próprio, `origem_op_id`/`origem_entrega_id`/`observacao` preenchidos.
- **Enviado** (snapshot) = `op_itens` da OP de látex; `metros_pedidos` = metros
  **sem defeito** que a tecelagem mandou, por modelo. `metros_ajustados` = NULL.
- **Empresa de látex dona** = `op_fornecedores` (OP látex, fornecedor = destino da
  entrega, `etapa='latex'`).
- **Recebimentos** = `entregas` com `etapa='latex'` + `entrega_itens` por modelo,
  `fornecedor_id` = empresa de látex. Sem destino (a trava de destino só vale para
  `etapa='cima'`).

Sem CHECKs novos em `entregas`/`op_fornecedores` (ambos já aceitam `'latex'`).

## 2. Criação automática da OP de látex

**Quando:** ao salvar uma entrega de tecelagem **nova** (`salvarEntregaCima`), após
gravar a entrega + itens. **Não** dispara na edição de entrega (coerente com
"criada uma vez / independente").

**Como — função no banco (RPC), não no JS.** Motivo: hoje só o admin pode inserir em
`ops`/`op_itens`/`op_fornecedores` (RLS), mas a tecelagem (fornecedor) também lança
entregas e não tem essa permissão. Função plpgsql `SECURITY DEFINER`:

`gerar_op_latex(p_entrega_id BIGINT) RETURNS BIGINT`:
1. Lê a entrega (`etapa='cima'`) e **valida** que o chamador é o fornecedor dono dela
   ou admin (`meu_fornecedor_id()` / `is_admin()`); senão, exceção.
2. **Idempotente:** se já existe OP látex com `origem_entrega_id = p_entrega_id`,
   retorna o id existente sem criar (reforçado pelo índice único parcial).
3. Calcula o próximo número de látex do ano (`max(numero)+1` onde `tipo='latex'` e
   `ano` = ano corrente; 1 se não houver).
4. Cria a OP látex (`tipo='latex'`, `status='em_producao'`, `origem_op_id` = op da
   entrega, `origem_entrega_id`, `observacao` automática).
5. Cria `op_itens` = enviado por modelo (soma de `metros_entregues` **sem defeito**,
   agrupado por `modelo_id` via join `entrega_itens → op_itens`).
6. Cria `op_fornecedores` (OP látex, fornecedor = `entregas.destino_fornecedor_id`,
   `etapa='latex'`).
7. Se não houver metros sem defeito (enviado = 0), **não cria** OP de látex.
8. `GRANT EXECUTE ON FUNCTION gerar_op_latex(BIGINT) TO authenticated`.

**No front:** `salvarEntregaCima` chama `supa.rpc('gerar_op_latex', { p_entrega_id })`
após gravar os itens. Erro na RPC: a entrega já está salva; mostra toast de aviso
para gerar manualmente. Atomicidade garantida dentro da função (uma transação).

## 3. Telas, exibição e navegação (admin)

**a) Lista de OPs (`screenListaOPs`):** nova coluna **Tipo** com badge
(`badgeTipo(tipo)`: Tecelagem / Látex) e **filtro** no topo (Todas / Tecelagem /
Látex), client-side. A query passa a trazer `tipo`.

**b) Detalhe da OP de látex:** a rota `#/ops/:id` carrega a OP e, se `tipo='latex'`,
chama um renderizador próprio `screenOPLatex(op)` (mantém `screenNovaOP` enxuto). Mostra:
- Cabeçalho: número + badge Látex + status; observação de origem e botão
  **"Ir para a OP de tecelagem"** (→ `origem_op_id`).
- Tabela por modelo: **Enviado × Recebido × Falta** (Enviado = `op_itens`;
  Recebido = soma dos recebimentos sem defeito; Falta = enviado − recebido).
- **Histórico de recebimentos** (entregas `etapa='latex'` desta OP) com
  "+ Novo recebimento / Editar / Excluir" (admin).
- **Ajuste manual (admin):** editar o "enviado" (`op_itens`) da OP de látex e excluir
  a OP de látex. A empresa de látex vê o enviado como leitura.
- **Finalizar (admin):** botão para marcar a OP de látex como `finalizada`.

**c) Navegação ida-e-volta:** na OP de tecelagem, no histórico de cada entrega que
gerou látex, link **"Ver OP de látex"** (busca `ops` onde `origem_entrega_id =
entrega.id`). Na OP de látex, botão de volta (item b).

## 4. Acesso da empresa de látex (tela + RLS)

**RLS — praticamente nada novo** (as policies são genéricas, por `fornecedor_id =
meu_fornecedor_id()` e vínculo em `op_fornecedores`, sem amarrar etapa/tipo):
- `ops_fornecedor_read` / `op_itens_fornecedor_read`: a látex já lê suas OPs de látex
  e o enviado (tem vínculo em `op_fornecedores`).
- `entregas_fornecedor_*` / `entrega_itens_fornecedor`: a látex já pode CRUD os
  recebimentos próprios (entregas `etapa='latex'`).
- A trava `entregas_destino_cima_chk` não exige destino para `etapa='latex'`.
- **Único objeto novo no banco:** a função `gerar_op_latex` (`SECURITY DEFINER`) com
  `GRANT EXECUTE ... TO authenticated`.

**Tela da empresa de látex (`screenFornecedorLatex`):** espelha a da tecelagem.
- Roteamento: `routeAfterLogin` manda `latex` para `#/fornecedor/latex` (substitui o
  fallback temporário atual). Rota nova registrada para o papel fornecedor.
- Lista as OPs `tipo='latex'` em produção vinculadas à empresa, com Enviado × Recebido
  × Falta por modelo.
- Registra **recebimentos** (entregas `etapa='latex'`, por modelo, **sem** destino) +
  histórico com Editar/Excluir.

**Reúso de código (sem duplicar):**
- `buildEntregaInlineForm` ganha flag `comDestino = true` (default); a látex chama com
  `false` (sem o select de destino; `getPayload` retorna `destino_fornecedor_id: null`).
- A persistência de entregas é generalizada por `etapa`: a de tecelagem (`'cima'`)
  continua exigindo destino e chamando `gerar_op_latex`; a de látex (`'latex'`) não
  faz nem um nem outro.

## 5. Testes e verificação

- **Automatizado (`tests/calculo-op.test.js`):** o cálculo Enviado × Recebido × Falta
  reusa `totalEntregueCimaPorItem` (agnóstica de etapa). Adicionar 1–2 testes
  garantindo que ela serve ao recebido de látex (mesma forma de dados); manter os 23
  testes atuais verdes (regressão). Sem criar função pura sem consumidor (YAGNI).
- **RPC `gerar_op_latex` (sem harness JS):** verificação manual no SQL Editor do
  Supabase — roteiro: criar entrega `cima` de teste → chamar a função → conferir OP
  `tipo='latex'` + `op_itens` + `op_fornecedores`; chamar de novo → não duplica;
  entrega só com defeito → não cria.
- **QA manual (`docs/qa/fase5b-checklist.md`):** criação automática ao salvar entrega
  de tecelagem (e que não dispara na edição); numeração sequencial de látex; navegação
  ida-e-volta; badge + filtro na lista; login da látex caindo na tela certa;
  recebimento por modelo (criar/editar/excluir); Enviado×Recebido×Falta batendo;
  finalizar (admin); ajuste manual do enviado (admin); RLS (látex só vê as próprias).

## Pendências de deploy (manuais)

- Rodar `db/08_fase5b_latex.sql` no SQL Editor do Supabase (inclui a função
  `gerar_op_latex` e o GRANT).
- Executar o QA manual da Fase 5b com o app publicado.

## Fora de escopo

- Etapas posteriores ao látex (corte/acabamento/expedição).
- Relatórios consolidados de produção ponta-a-ponta.
- Finalização automática da OP de látex quando falta = 0 (por ora, finalização manual
  pelo admin).
