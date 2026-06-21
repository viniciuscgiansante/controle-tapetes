# PROJECT_STATE.md — Controle de Tapetes (Grupo Terra Branca)

> Snapshot de estado. Atualizado em **2026-06-21** (fase D1 — baseline de ownership/segurança).
> Fonte da verdade operacional. Para "como cada fase foi feita", ver `docs/superpowers/STATUS.md`.

## Produto
SPA web para controlar a produção de tapetes, do pedido de fio até o recebimento do látex.
Perfis: **admin** (operação) e **fornecedor** (fio / tecelagem / látex).

## Stack real (confirmada)
- Frontend: **`index.html` único** — HTML + JavaScript vanilla + Tailwind via CDN. Sem build, sem framework.
- Cálculo: `js/calculo-op.js` — funções puras, testadas com `node --test` (31/31).
- Backend: **Supabase** `bhgifjrfagkzubpyqpew` (Postgres + Auth e-mail/senha + RLS). Plano free.
- Hospedagem: **GitHub Pages** (publica no push pra `main`). **Não é Vercel. Não é Next.js.**

## Produção (verificado ao vivo em 2026-06-21)
- URL em uso: **https://grupoterrabranca.github.io/controle-tapetes/** (HTTP 200).
- URL antiga **https://viniciuscgiansante.github.io/controle-tapetes/** → **404 (desativada)**.
- Repo: **`grupoterrabranca/controle-tapetes`** (transferência do dono anterior concluída).
- Banco de produção: `bhgifjrfagkzubpyqpew` (o app live usa exatamente esse projeto).
- Versão no ar: **Fase 6** (Cliente/Lote/% entregue/PDF). **Fase 7 NÃO está em produção.**
- Sem staging, sem preview, sem rollback nativo (rollback = commit de revert no `main`).

## Riscos ativos
### 🔴 CRÍTICO — backdoor admin publicado e ATIVO (confirmado 2026-06-21)
- `admin@tapetes.test` / `(senha removida deste doc)` **autentica agora** (HTTP 200) no Supabase de produção.
  UID `6832a5cd-92c1-4588-b4c7-df65bd7ebf42`. As mesmas credenciais estavam publicadas em
  `README.md`/`HANDOFF.md` de um repositório público → qualquer pessoa podia logar como admin.
- Idem para `algodao@`, `tecelagem@`, `latex@tapetes.test` (senha removida deste doc).
- **AÇÃO IMEDIATA do dono** (ver `docs/PRODUCTION_RUNBOOK.md` quando criado):
  1. Supabase → Authentication → Users → **excluir os 4 `*@tapetes.test`** (ou trocar a senha).
  2. Revisar **Auth logs** e a integridade dos dados (possível acesso indevido).
  3. Commitar o scrub das credenciais no repo live — **as senhas continuam no histórico git**
     até serem purgadas (`git filter-repo`/BFG) ou o repo ser tornado privado.

### 🟠 ALTO
- Monólito `index.html` (~2.750 linhas) — qualquer patch é risco amplo de regressão.
- Escritas multi-passo sem transação no JS (D0 §11/§12).
- Deploy automático em `main` sem proteção de branch (push = produção).
- **Sem backup do banco hoje** (Free tier não tem backup gerenciado). **Pré-requisito para
  qualquer patch** — ver `docs/BACKUP_AND_RESTORE.md`.

### 🟡 MÉDIO
- Leitura anônima de `cores`/`modelos` confirmada ao vivo (RLS `USING(true)` + grant `anon`).
  RLS das tabelas sensíveis OK (anon em `ops` retorna `[]`).
- Documentação estava desatualizada (apontava URL antiga); corrigida na D1.

## Comandos seguros
- `node --test tests/calculo-op.test.js` → 31/31.
- Servir local: `python3 -m http.server 8000`.
- Verificação read-only via anon key (ex.: `GET /rest/v1/ops` deve voltar `[]` sem login).

## Ações PROIBIDAS sem autorização explícita
- `db/10_reset_producao.sql` e `db/11_reset_ops.sql` (DELETE em massa de produção).
- Qualquer SQL contra `bhgifjrfagkzubpyqpew` sem backup.
- Push/deploy em `main` (= produção, sem staging).
- Editar `index.html` / `js/` / `tests/` / `db/` durante a fase D1.

## Próxima fase
- **D1 (atual):** segurança + baseline documental (docs-only).
- **D2:** planejar modularização do `index.html` (read-only primeiro).
- **D3+:** primeiro patch pequeno, só após D2, com teste/QA e evidência.

## Pendências de informação (precisa do dono)
- Quem tem write no GitHub `grupoterrabranca` e acesso ao Supabase?
- Existe backup automático do Supabase? Quem sabe restaurar?
- A Fase 7 (branch `feat/corrigir-desfazer-recebimento-fio`) migrou para o repo novo ou ficou no antigo?
- Há link/projeto Vercel real? (premissa atual: não — app é estático no GitHub Pages.)
