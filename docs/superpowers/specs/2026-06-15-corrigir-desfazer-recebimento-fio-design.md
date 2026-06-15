# Corrigir / Desfazer recebimento de fio — Design

Data: 2026-06-15
Status: aprovado (aguardando review do spec)

## Problema

Ao registrar o recebimento de uma ordem de compra de fio (`ordens_compra_fio`),
o valor de kg recebido / data é gravado e a ordem passa a aparecer numa lista
"Recebidas" **somente leitura**, tanto na tela do admin (`Recebimento de fios`,
dentro da OP) quanto na do fornecedor (`Minhas ordens`). Não existe forma de
corrigir um valor digitado errado nem de desfazer o recebimento. Hoje o usuário
fica preso ao erro.

## Escopo

- **Ações:** Corrigir (alterar kg recebido + data, mantendo a ordem como recebida)
  e Desfazer (voltar a ordem para `pendente`, como se nunca tivesse sido recebida).
- **Quem:** admin (tela da OP) e fornecedor (tela "Minhas ordens").
- **Quando:** apenas enquanto a OP daquela ordem está com `status = 'aberta'`.

### Fora de escopo (YAGNI)

- Corrigir/desfazer com a OP em produção ou finalizada (exigiria recalcular
  `saldo_fios` e metros ajustados — complexo e arriscado).
- Histórico/auditoria das correções.
- Refatoração ampla das telas de fio.

## Por que a trava "só com OP aberta" é segura

O recebimento dos fios acontece com a OP `aberta`. Só depois que **todos** os
fios são recebidos a proposta de ajuste aparece; ao **aplicá-la** é que a OP
passa para `em_producao` e o sistema grava `saldo_fios`, `saldo_fios_op` e os
`metros_ajustados`. Ou seja, enquanto a OP está `aberta` **nada** foi persistido
a partir do kg recebido — corrigir ou desfazer nessa fase não dessincroniza
nenhum saldo. Reabrir a edição depois disso é que seria perigoso, por isso fica
travado.

## Comportamento

### Desfazer

1. Botão **Desfazer** na linha de uma ordem recebida (só se a OP está `aberta`).
2. `confirmDialog` de confirmação.
3. `UPDATE ordens_compra_fio SET kg_recebido = NULL, data_recebimento = NULL,
   status = 'pendente' WHERE id = <id>`.
4. Reload da tela: a ordem volta para o bloco "Pendentes".

### Corrigir

1. Botão **Corrigir** na linha de uma ordem recebida (só se a OP está `aberta`).
2. A linha vira um formulário inline com **kg recebido** e **data** já
   preenchidos com os valores atuais, mais **Salvar** e **Cancelar**.
3. Ao salvar: valida `kg > 0`, recalcula
   `status = kg < kg_pedido ? 'recebido_parcial' : 'recebido_total'` e faz
   `UPDATE ordens_compra_fio SET kg_recebido, data_recebimento, status WHERE id`.
   (Mesma regra do registro original.)
4. Reload da tela.

## Implementação (tudo em `index.html`)

### 1. Helper compartilhado

Perto de `excluirEntrega(...)`, criar:

```
desfazerRecebimentoFio(ordemId, onSuccess)
```

Usa o `confirmDialog` existente; no callback faz o UPDATE de volta para
pendente; em sucesso `toast(...)` + chama `onSuccess()`; em erro `toast(...)` +
`console.error`.

### 2. Tela do admin — `buildBlocoFios`

- O sub-bloco "Recebidas" hoje só é renderizado quando `op.status === 'aberta'`
  (já é o caso) e usa `dataTable` somente leitura.
- Trocar por linhas com as ações **Corrigir** / **Desfazer**.
- **Corrigir** alterna a linha para um formulário inline reaproveitando a lógica
  de `buildOrdemPendenteRow`, generalizada para aceitar valores iniciais e o
  rótulo do botão ("Registrar" vs "Salvar").
- Reload via `reloadOrdens()` (já existe). A proposta de ajuste se atualiza
  sozinha porque ela só renderiza quando todas as ordens estão recebidas.

### 3. Tela do fornecedor — `screenFornecedorOrdens`

- Incluir `ops(status)` no `select` da query de ordens.
- Em `render(...)`, separar as recebidas:
  - `ops.status === 'aberta'` → linhas editáveis com **Corrigir** / **Desfazer**
    (mesmo construtor generalizado de linha, espelhando o admin).
  - demais (OP já em produção/finalizada) → permanecem na `dataTable` somente
    leitura atual.
- Reload via `reload()` (já existe).

### Evitar duplicação

Generalizar o construtor de linha de recebimento de cada tela
(`buildOrdemPendenteRow` no admin, `linhaPendente` no fornecedor) para aceitar
valores iniciais (kg/data) + rótulo do botão + ação de pós-salvar, servindo
tanto para "Registrar" (pendente) quanto para "Salvar" (corrigir). As duas telas
seguem separadas, como já são hoje.

## Erros

Mesmo padrão do código atual: `toast('mensagem', 'error')` + `console.error(error)`
e reabilitar o botão acionado.

## Testes

Segue o padrão do projeto (QA manual): adicionar um item de checklist em
`docs/qa/` cobrindo: corrigir um recebimento (valor muda, status recalcula),
desfazer (volta para pendente), e confirmar que os botões **não** aparecem
quando a OP não está `aberta` — nas duas telas (admin e fornecedor). Não há
lógica pura nova para `tests/` (o cálculo de status é trivial e inline).
