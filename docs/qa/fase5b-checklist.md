# QA — Fase 5b: OP de Látex

Pré-requisitos: rodar `db/08_fase5b_latex.sql` no Supabase; ter ao menos 1 empresa de látex cadastrada; uma OP de tecelagem `em_producao` com fornecedor de tecelagem.

## Cálculo (automatizado — `node --test tests/calculo-op.test.js`)
- [x] 1. `totalEntregueCimaPorItem` soma o recebido de látex (mesma forma de dados).
- [x] 2. Recebido de látex ignora itens com defeito.

## Criação automática (RPC `gerar_op_latex`)
- [ ] 3. Salvar uma entrega de tecelagem (com destino) cria 1 OP `tipo='latex'`.
- [ ] 4. A OP de látex tem número próprio sequencial (não colide com as de tecelagem).
- [ ] 5. Os `op_itens` da OP de látex = enviado por modelo (soma sem defeito).
- [ ] 6. `op_fornecedores` da OP de látex aponta para a empresa de látex (destino).
- [ ] 7. Editar a entrega de tecelagem NÃO altera a OP de látex (independente).
- [ ] 8. Salvar a MESMA entrega de novo não duplica a OP de látex (idempotência).
- [ ] 9. Entrega só com defeito não gera OP de látex.

## Lista de OPs (admin)
- [ ] 10. Coluna "Tipo" mostra badge Tecelagem/Látex.
- [ ] 11. Filtro Todas/Tecelagem/Látex funciona.

## Detalhe da OP de látex (admin)
- [ ] 12. Tabela Enviado × Recebido × Falta por modelo bate.
- [ ] 13. Botão "Ir para OP de tecelagem" navega para a OP de origem.
- [ ] 14. Na OP de tecelagem, "Ver OP de látex" navega para a OP de látex gerada.
- [ ] 15. Admin lança/edita/exclui recebimento; Recebido e Falta atualizam.
- [ ] 16. Admin edita o "enviado" (op_itens) manualmente e o valor persiste.
- [ ] 17. Admin finaliza a OP de látex (status `finalizada`); bloco vira leitura.
- [ ] 18. Admin exclui a OP de látex (bloqueada se houver recebimentos).

## Empresa de látex (logada)
- [ ] 19. Login da empresa de látex cai em `#/fornecedor/latex`.
- [ ] 20. Vê apenas as próprias OPs de látex em produção (RLS).
- [ ] 21. Registra recebimento por modelo (sem campo de destino) e vê no histórico.
- [ ] 22. Editar/excluir os próprios recebimentos funciona.

## Resultado
(preencher após execução: X/22)
