# Design — Fase 4: Recebimento de fios + recálculo automático

Data: 2026-05-27
Fase: 4 (próxima após Fase 3 concluída)

## 1. Objetivo

Fechar o ciclo entre o pedido de fio (gerado na Fase 3) e o início da produção:

1. O **fornecedor de fios** registra quanto kg de fio realmente recebeu de cada ordem.
2. Quando todas as ordens da OP forem recebidas, o sistema calcula automaticamente quantos metros dá pra produzir (**fator-gargalo**) e propõe um ajuste ao admin.
3. O **admin** aceita a proposta ou mantém o pedido original; o sistema grava `metros_ajustados`, registra as sobras de fio como saldo e move a OP para `em_producao` (liberando a Fase 5 — tecelagem).

Escopo desta fase: **fluxo completo** (lado fornecedor + recálculo + proposta admin + saldo).

## 2. Decisões de design (do brainstorming)

- **Recálculo por fator-gargalo único**: o fator escala todos os itens da OP proporcionalmente. A cor de fio mais escassa define o fator.
- **Proposta só com a foto completa**: a proposta de ajuste só aparece quando todas as ordens da OP tiverem recebimento lançado.
- **Recebimento de uma vez por ordem**: o fornecedor informa kg + data uma vez por ordem (sem parcelas acumuladas). `kg < pedido → status 'recebido_parcial'`; `kg ≥ pedido → 'recebido_total'`.
- **Decisão libera produção**: tanto "Aceitar" quanto "Manter pedido" movem a OP para `em_producao`.
- **UI Abordagem A**: a proposta vive no detalhe da OP (`screenNovaOP`, rota `#/ops/:id`); o fornecedor ganha tela nova `#/fornecedor/ordens`.
- **Lista do fornecedor**: lista única dividida em Pendentes / Recebidas.
- **Recebimento travado** após registrado (MVP); correção é responsabilidade do admin (fora desta fase).

## 3. Fluxo

```
OP 'aberta' (Fase 3 já gerou ordens_compra_fio, status 'pendente')
        │
        ▼
[FORNECEDOR]  #/fornecedor/ordens
   lista ordens pendentes → informa kg recebido + data → grava
   (status: kg<pedido → 'recebido_parcial'; kg≥pedido → 'recebido_total')
        │
        ▼
[ADMIN]  #/ops/:id  (bloco "Recebimento de fios")
   vê status de cada ordem. Quando TODAS têm recebimento lançado:
   → recalcularOP (fator-gargalo)
   → mostra: fator, metros_pedidos → metros_ajustados por item, sobras por cor
   → [Aceitar proposta] ou [Manter pedido]
        │
        ▼
   grava metros_ajustados + saldo, OP → 'em_producao' (libera Fase 5)
```

## 4. Motor de recálculo (função pura)

Nova função em `js/calculo-op.js`, no mesmo padrão puro/testável de `calcularFiosOP`. **Não depende** de modelos/parâmetros — usa o `kg_pedido` já gravado em cada ordem na Fase 3.

```
recalcularOP(itens, ordens)
  itens:  [{ op_item_id, metros_pedidos }]
  ordens: [{ id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido }]
```

Matemática:

- Para cada ordem: `ratio = kg_recebido / kg_pedido`
- `fator = min(ratio)` entre todas as ordens (cor mais escassa = gargalo)
- Por item: `metros_ajustados = round2(metros_pedidos × fator)`
- Por ordem: `kg_sobra = round3(kg_recebido − fator × kg_pedido)` → sempre ≥ 0 (gargalo sobra 0)

Retorno:

```
{
  fator,
  itens:  [{ op_item_id, metros_pedidos, metros_ajustados }],
  sobras: [{ ordem_id, tipo, cor_id, cor_poliester, kg_sobra }]   // só kg_sobra > 0
}
```

Propriedades:
- `fator < 1` → faltou fio: produz menos; cores não-gargalo sobram → saldo.
- `fator > 1` → veio sobrando: produz mais; gargalo todo usado, outras viram saldo.
- `fator = 1` → bate exato; sem ajuste e sem saldo.
- `kg_pedido > 0` garantido pelo schema CHECK (sem divisão por zero).
- `kg_recebido = 0` → ratio 0 → fator 0 → metros 0 (caso degenerado, ver §8).

Exemplo: pedido algodão A=10, B=10, PRETO=4, BRANCO=4; chega A=10, B=10, PRETO=4, BRANCO=5 → ratios 1/1/1/1,25 → fator 1,0 → metros = pedido; sobra BRANCO 1,0 kg. Se BRANCO chegasse 2 kg → ratio 0,5 → fator 0,5 → todos os itens caem à metade; sobras de A/B/PRETO viram saldo.

## 5. Tela do fornecedor — `#/fornecedor/ordens`

Substitui o placeholder de `screenFornecedorHome`. Função `screenFornecedorOrdens()`:

- Carrega `ordens_compra_fio` de `fornecedor_id = CURRENT_USER.fornecedor_id`, com join do lote (`ops(numero, ano)`) e da cor (algodão via `cor_id`, ou texto fixo poliéster).
- **Pendentes** (`data_recebimento IS NULL`): cada linha mostra Lote, fio (ex.: "Algodão — Vermelho" / "Poliéster — PRETO"), kg pedido, campo **kg recebido** (pré-preenchido com o pedido), **data** (default hoje), botão **Registrar**.
  - Registrar → `update` com `kg_recebido`, `data_recebimento`, `status` (`recebido_parcial` se `kg < pedido`, senão `recebido_total`); toast; recarrega.
- **Recebidas**: lista em leitura (kg recebido + data) para histórico.
- Menu do fornecedor passa a ter "Minhas ordens" apontando para a rota. Estado vazio amigável se o usuário não tiver `fornecedor_id` ou não houver ordens.

## 6. Bloco "Recebimento de fios" no detalhe da OP (admin)

Helper próprio `buildBlocoFios(op, ordens, itens)` dentro de `screenNovaOP` (modularizado para não inchar a função). Só aparece quando a OP **não** é `simulada`. Por status:

- **`aberta`**: tabela das ordens (cor, kg pedido, kg recebido, status/“aguardando”).
  - Falta alguma ordem sem recebimento → aviso "Aguardando recebimento de N fio(s)".
  - Todas recebidas → roda `recalcularOP` e mostra a proposta: fator, tabela `item: metros_pedidos → metros_ajustados`, sobras por cor, botões **[Aceitar proposta]** / **[Manter pedido]**.
- **`em_producao` / `finalizada`**: mostra recebimento + `metros_ajustados` aplicados, em leitura (sem botões).

## 7. Persistência da decisão e saldo

`aplicarRecalculo(op, resultado, modo)` com `modo ∈ {'aceitar', 'manter'}`:

1. **`op_itens`** — grava `metros_ajustados` por item:
   - `aceitar` → valor proposto (`metros_pedidos × fator`).
   - `manter` → `metros_ajustados = metros_pedidos`.
2. **`saldo_fios_op`** — insere uma linha por sobra > 0 (`op_id`, `cor_id`/`cor_poliester`, `tipo`, `kg_sobra`):
   - `aceitar` → sobras do resultado.
   - `manter` → `kg_sobra = max(0, kg_recebido − kg_pedido)` por cor.
3. **`saldo_fios`** (totalizador) — para cada sobra, soma `kg_sobra` ao total da cor/tipo (lê o registro atual, soma, upsert; admin único, sem corrida real).
4. **`ops.status`** → `em_producao`.

Sequência com checagem de erro a cada passo + toast; se falhar no meio, reporta e **não** muda o status (mesmo cuidado da Fase 3). Idempotência: o bloco de decisão só roda em `aberta`; após `em_producao` os botões somem, evitando aplicar duas vezes.

## 8. Erros e bordas

- Ordem com `kg_recebido = 0` → fator 0 → metros 0; aviso "nenhum fio recebido em X", ainda permite decidir.
- OP sem ordens (não deveria após Fase 3) → bloco não aparece.
- `fator = 1` → sem ajuste e sem saldo; decisão ainda move para `em_producao`.
- Fornecedor sem `fornecedor_id` vinculado → estado vazio amigável.

## 9. Testes

`node --test tests/calculo-op.test.js` (a forma `node --test tests/` com barra dá falsa falha no Node 25):

- `recalcularOP`: fator < 1 (escala pra baixo + saldos), fator > 1 (escala pra cima), fator = 1 (sem saldo), gargalo definido pela cor certa, sobras arredondadas a 3 casas, `metros_ajustados` a 2 casas, função pura (sem DOM/Supabase).
- QA manual: novo `docs/qa/fase4-checklist.md` (tela fornecedor, recebimento, gatilho "tudo recebido", aceitar, manter pedido, saldo no Supabase, transição de status).

## 10. Verificação de RLS (a confirmar no plano)

Confirmar que as policies permitem:
- fornecedor dar `UPDATE` nas próprias `ordens_compra_fio` (via `meu_fornecedor_id`);
- admin gravar `op_itens`, `saldo_fios`, `saldo_fios_op`, e `UPDATE` de `ops.status`.

Se faltar policy, incluir SQL em `db/` — **sem** Restart/Pause/Resume no Supabase (cuidado conhecido com o schema cache do PostgREST).

## 11. Fora de escopo

- Entregas parciais acumuladas por ordem (decidido: uma vez por ordem).
- Correção de recebimento pelo fornecedor (travado no MVP).
- Painel central de recebimentos de todas as OPs (Abordagem C descartada).
- Consumo do saldo na próxima OP (saldo é meramente informativo).
