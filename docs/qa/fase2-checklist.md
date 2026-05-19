# QA — Fase 2 (Admin Cadastros)

**Resultado:** ✅ 9/9 cenários passaram em 2026-05-19. 1 bug não bloqueante adiado — ver `docs/qa/fase2-bugs-pendentes.md`.

Pré-condição: logado como admin (`admin@tapetes.test` / `Admin123!`)

## Cenário 1 — Menu lateral ✅
- [x] Menu mostra 7 itens: Painel, Cores, Modelos, Parâmetros, Fornecedores, Preços, Usuários
- [x] Cada item navega pra rota correspondente

## Cenário 2 — Cores: CRUD completo ✅
- [x] Lista mostra BRANCO, PRETO, BEGE (seed)
- [x] "+ Nova cor" → criar VERMELHO → aparece na lista (toast verde)
- [x] Editar VERMELHO pra ROXO → atualiza
- [x] Excluir ROXO → confirmação → remove da lista
- [x] Tentar excluir BRANCO (que está em uso por modelo) → toast vermelho "Cor em uso"

## Cenário 3 — Modelos: CRUD com cores ✅
- [x] Lista mostra "Conforto BRANCO/PRETO 1,40" e "Conforto PRETO/BRANCO 2,10" (seed)
- [x] "+ Novo modelo" → criar "Premium BEGE/BRANCO 1,40" → aparece
- [x] Editar para mudar cor 2 pra PRETO → atualiza
- [x] Tentar criar duplicata exata (mesmo nome+cores+largura) → toast vermelho "Já cadastrado"
- [x] Excluir o "Premium" criado → remove

## Cenário 4 — Parâmetros: edição ✅
- [x] Mostra 2 cards (1,40 e 2,10)
- [x] Cada card mostra os 4 valores: peso linear, algodão/ml, poliéster/ml, valor x
- [x] Editar valor x de 1,40 pra 1,5 → salvar → toast verde
- [x] Recarregar a página (F5) → valor persistido
- [x] Voltar valor pra 1,0 → salvar

## Cenário 5 — Fornecedores: CRUD com 4 tipos ✅
- [x] Lista mostra os 4 do seed (Fios Sul, Polifios, Aurora, Premier) com tipos formatados
- [x] "+ Novo fornecedor" → criar "Teste LTDA" tipo "Látex" → aparece
- [x] Editar tipo pra "Tecelagem" → atualiza
- [x] Excluir "Teste LTDA" → remove
- [x] Tentar excluir "Aurora" (vinculada a preço) → toast vermelho

## Cenário 6 — Preços: CRUD ✅ (com ressalva)
- [x] Lista mostra os 4 preços do seed (Aurora cima 1,40/2,10; Premier látex 1,40/2,10)
- [x] "+ Novo preço" → o select só lista tecelagens e látex (NÃO mostra fornecedores de fio)
- [x] Criar preço com um novo fornecedor de látex que você acabou de cadastrar → funciona
- [x] Editar um preço existente → muda valor → toast verde
- [x] Excluir um preço → remove
- [ ] **Bug adiado:** ao abrir o modal de editar preço, o campo Largura não vem preenchido. Documentado em `fase2-bugs-pendentes.md`.

## Cenário 7 — Usuários: lista e vinculação ✅
- [x] Lista mostra os 4 usuários cadastrados na Fase 1
- [x] Caixa amarela com instruções aparece no topo
- [x] Editar nome do admin pra "Murilo" (sem o "(Admin)") → salva
- [x] "+ Vincular usuário" com UID inventado → toast "UID não existe no Supabase Auth"
- [x] "+ Vincular usuário" com UID válido (cria primeiro no Supabase Auth) → vincula

## Cenário 8 — Acesso fornecedor bloqueado ✅
- [x] Sair, logar como `algodao@tapetes.test`
- [x] Editar URL pra `#/cadastros/cores` → tela "Acesso negado"
- [x] Mesmo pra todas as outras rotas `#/cadastros/...`

## Cenário 9 — Validações de formulário ✅
- [x] Em qualquer modal, salvar com campos vazios → toast vermelho específico
- [x] Em preços, salvar com preço negativo → toast vermelho
