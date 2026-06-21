# AGENT_HANDOFF.md — Controle de Tapetes

> Para uma nova sessão de IA continuar com segurança. Leia junto: `PROJECT_STATE.md`,
> `docs/HANDOFF.md` e `docs/superpowers/STATUS.md`. Convenção: **tudo em português brasileiro**.

## Contexto
App de controle de produção de tapetes, herdado e transferido (dono anterior Vinícius →
Grupo Terra Branca). Em produção, usado por fornecedores externos. Fase de trabalho atual:
**D1** (ownership + segurança + docs), **sem alterar runtime**.

## Ativos (verificados 2026-06-21)
- Repo: `grupoterrabranca/controle-tapetes` (GitHub).
- Produção: **https://grupoterrabranca.github.io/controle-tapetes/** (GitHub Pages, branch `main`).
  A URL antiga `viniciuscgiansante.github.io/...` está **404 (morta)**.
- Supabase: `bhgifjrfagkzubpyqpew` (Postgres + Auth + RLS, free). **Projeto único = produção.**
- Local: `D:\OneDrive\Programação\Ravatex\controle-tapetes-main` é um **snapshot do `main`
  (Fase 6)**, sem `.git`. É idêntico ao que está no ar.

## Estado
- Produção = **Fase 6**. Fase 7 ("corrigir/desfazer recebimento de fio") **não deployada**.
- Testes: 31/31 (`node --test tests/calculo-op.test.js`).
- Banco: 16 tabelas, 3 funções (`is_admin`, `meu_fornecedor_id`, `gerar_op_latex`),
  0 trigger / 0 view / 0 storage / 0 edge function / 0 realtime / 0 cron.

## Decisões tomadas
- Premissa "Vercel/Next.js" descartada — é GitHub Pages + HTML único + Supabase.
- D1 é docs-only; modularização só após D2.
- Credenciais de teste neutralizadas nos docs locais (não resolve o repo live — ver riscos).

## Riscos (resumo — detalhe em `PROJECT_STATE.md`)
- 🔴 backdoor `*@tapetes.test` **ativo** em produção (login HTTP 200 confirmado 2026-06-21).
- 🟠 monólito `index.html`; escritas multi-passo sem transação; deploy auto sem proteção.
- 🟡 leitura anônima de `cores`/`modelos`.

## Pendências
- Remover/rotacionar usuários de teste no Supabase Auth (ação do dono).
- Confirmar acessos (GitHub/Supabase), backup, e destino do branch da Fase 7.

## Próximos comandos seguros
- `node --test tests/calculo-op.test.js`
- Verificação read-only via anon key (`GET /rest/v1/ops` → `[]` sem login = RLS ok).

## O que um agente NÃO deve fazer
- Não editar `index.html`, `js/`, `tests/`, `db/` na D1.
- Não rodar `db/10`/`db/11` (resets destrutivos).
- Não fazer push/deploy (`main` = produção, sem staging).
- Não rodar SQL em produção sem backup.

## Critérios de aceite da D1
- [x] Repo/URL/branch de produção confirmados ao vivo.
- [x] Status do backdoor de teste verificado (**ativo**) + runbook de remoção entregue.
- [x] Fase 7 confirmada fora de produção.
- [ ] Usuários de teste removidos no Auth (**depende do dono**).
- [ ] Backup do banco gerado e validado (**pré-requisito p/ patch** — `docs/BACKUP_AND_RESTORE.md`).
- [~] Docs de baseline criados (PROJECT_STATE, AGENT_HANDOFF feitos; ARCHITECTURE/SCHEMA/
  DEPLOYMENT/RUNBOOK/AI_AGENT_RULES pendentes de autorização).
- [x] Nenhum arquivo de runtime alterado.
