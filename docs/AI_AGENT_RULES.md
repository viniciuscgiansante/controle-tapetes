# AI_AGENT_RULES.md — Controle de Tapetes

> Regras para qualquer agente de IA (ou pessoa) que trabalhe neste projeto. Criado 2026-06-21 (D1A).
> Contexto crítico: **produção em `main` sem staging**, **Supabase único = produção**, app é um
> **monólito `index.html`** de ~2.750 linhas. Errar aqui é incidente operacional real.

## Modos por fase
| Fase | Objetivo | Modo |
|---|---|---|
| D0 | Diagnóstico de herança | read-only, auditoria ✅ feito |
| D1 | Ownership + segurança | docs-only ✅ feito |
| **D1A** | **Backup + safety baseline** | **docs-only (atual)** |
| D2 | Planejar modularização do `index.html` | read-only primeiro |
| D3+ | Primeiro patch pequeno | só após backup validado + QA |

## Pré-requisito absoluto antes de QUALQUER patch funcional
1. ✅ Backup do banco **gerado e validado** (`docs/BACKUP_AND_RESTORE.md`).
2. ✅ Backdoor `*@tapetes.test` removido do Supabase Auth.
3. ✅ Produção mapeada (repo/URL/branch — `PROJECT_STATE.md`).
Sem os três, **não se altera runtime**.

## Comandos / ações PROIBIDOS sem autorização explícita do dono
- ❌ Rodar `db/10_reset_producao.sql` / `db/11_reset_ops.sql` (DELETE em massa).
- ❌ Rodar qualquer SQL/migration contra `bhgifjrfagkzubpyqpew` sem backup fresco.
- ❌ `git push` / deploy (`main` = produção).
- ❌ Remover/alterar usuários ou senhas sem combinar antes.
- ❌ Restaurar backup na base viva.
- ❌ Editar `index.html` durante D1/D1A.

## Política de testes
- Toda mudança em cálculo (`js/calculo-op.js`) → **escrever o teste primeiro** e rodar
  `node --test tests/calculo-op.test.js` (baseline 31/31) antes de commitar.
- Mudança de UI/persistência sem teste automatizado → **QA manual documentado** obrigatório.

## Política de arquivos grandes (limites permanentes)
- UI: ideal <250 linhas; alerta >400.
- Regra de negócio/serviço: ideal <300; alerta >500.
- **Nenhum arquivo novo acima de 500 linhas sem justificativa.**
- Nenhuma regra de negócio crítica apenas em componente de UI.
- Nenhuma chamada Supabase espalhada sem passar por um adapter (`js/api.js`, a criar na D2).
- `js/calculo-op.js` é o modelo de extração saudável a seguir.

## Política Supabase
- Sempre a **anon JWT key** (`eyJ...`). A publishable key nova (`sb_publishable_*`) causa `PGRST002`.
- **Nunca** `service_role` no frontend.
- Toda alteração de schema → arquivo `db/NN_*.sql` **versionado** + backup antes de aplicar.
- Evitar Restart/Pause/Resume seguidos no painel (corrompe o schema cache do PostgREST).

## Política GitHub Pages
- `main` = produção. **Backup + QA local + testes verdes antes de cada push.**
- Recomendado: branch protection (PR/review antes de publicar).

## Evidência obrigatória por patch
- Comando(s) executado(s) + exit code.
- Resultado dos testes (`node --test`).
- QA manual descrito (telas, perfis admin/fornecedor).
- Backup correspondente (data do dump) antes de mexer em dados/schema.
- Confirmação de que nada fora do escopo foi alterado.
