# QA — Fase 4: Recebimento de fios + recálculo automático

Pré-requisitos: logado conforme cada item; OP `aberta` com ordens de fio geradas (Fase 3).

## Cálculo (automatizado — `node --test tests/calculo-op.test.js`)
- [x] 1. `recalcularOP` fator < 1 escala metros pra baixo e gera saldo.
- [x] 2. `recalcularOP` fator > 1 escala metros pra cima.
- [x] 3. `recalcularOP` fator = 1 não ajusta e não gera saldo.
- [x] 4. Arredondamento: metros 2 casas, sobra 3 casas.
- [x] 4b. `consumoPorOrdem` mapeia consumo/sobra por ordem para metros livres (incluindo sobra negativa quando excede).

## Fornecedor (manual no site, logado como fornecedor de fios)
- [x] 5. Menu "Minhas ordens"; tela lista Pendentes e Recebidas.
- [x] 6. Registrar recebimento (kg + data) move a ordem para Recebidas com status correto (parcial se kg < pedido).
- [x] 7. Usuário sem fornecedor vinculado vê estado vazio amigável.

## Admin (manual no site, logado como admin)
- [x] 8. OP `aberta` mostra o bloco "Recebimento de fios" com Pendentes (formulário inline) e Recebidas (tabela).
- [x] 9. Com ordens pendentes: aviso "Aguardando recebimento de N fio(s)", sem botões da proposta.
- [x] 9b. Admin também pode dar baixa do recebimento direto no bloco (mesmo formulário inline do fornecedor; `reloadOrdens` atualiza a tela após salvar).
- [x] 10. Todas recebidas: mostra fator proporcional, **um slider por item** (0 → máximo individual = se este item fosse o único), painel "Consumo de fio" recalculado ao vivo, e botão **↺ Voltar à proposta proporcional**.
- [x] 10b. Modelos exibidos no slider e nas tabelas no formato padrão `Nome 1.40m · COR1/COR2`.
- [x] 11. "Aceitar proposta": trava quando alguma cor excede; ao aceitar grava `metros_ajustados` exatamente como nos sliders, gera saldo `recebido − consumido_real` por cor, OP → `em_producao` (conferido no Supabase).
- [x] 12. "Manter pedido": `metros_ajustados = metros_pedidos`, saldo = `recebido − pedido` (>0), OP → `em_producao`.
- [x] 13. OP `em_producao` abre o bloco em leitura (tabela de ordens + "Metros de produção" com `metros_ajustados`, sem sliders nem botões).

## Resultado
**15/15** — QA aprovado por Vinícius em 2026-05-28. Fase 4 concluída (inclui as duas melhorias pós-spec: baixa pelo admin e proposta com sliders).
