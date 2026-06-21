# DEPLOYMENT.md — Controle de Tapetes

> Como o app é publicado. Não é Vercel — é **GitHub Pages**. Criado em 2026-06-21 (D1A).

## Plataforma
- **GitHub Pages**, repo `grupoterrabranca/controle-tapetes`, branch **`main`**, pasta `/ (root)`.
- Publica **automaticamente** no push para `main` (~1 min). **Não há build** (HTML/JS estático).

## Produção (verificado ao vivo 2026-06-21)
- URL atual: **https://grupoterrabranca.github.io/controle-tapetes/** (HTTP 200).
- URL antiga: https://viniciuscgiansante.github.io/controle-tapetes/ → **404 (desativada)**.
- Backend: Supabase `bhgifjrfagkzubpyqpew` (o app live usa este projeto).

## Ambientes
- **Não há staging, preview, nem development.** `main` é o único ambiente = **produção**.
- Recomendação futura: criar um repo/branch de preview e um **projeto Supabase de dev** para
  testar sem tocar na base viva.

## Configuração / credenciais
- **Sem variáveis de ambiente de plataforma.** `SUPABASE_URL` e `SUPABASE_ANON_KEY` estão
  **hardcoded** no topo do `<script>` em `index.html`.
- Isso é aceitável **só porque** a anon key é pública por design (a segurança vem do RLS).
  **Nunca** colocar `service_role` no `index.html`.
- Dependências por CDN (com risco de indisponibilidade/drift de versão): Tailwind
  (`cdn.tailwindcss.com`), `@supabase/supabase-js@2`, `jspdf@2.5.1` (com SRI).

## Publicar uma alteração
```bash
# QA local antes (sirva o index.html e rode os testes)
node --test tests/calculo-op.test.js          # deve dar 31/31
python3 -m http.server 8000                    # teste manual em http://localhost:8000

git add .
git commit -m "<mensagem em português>"
git push                                       # GitHub Pages republica em ~1 min
```

## Rollback
- Não há rollback instantâneo. Reverte-se por commit e novo push:
  ```bash
  git revert <sha_ruim>     # ou: git checkout <sha_bom> -- index.html
  git push
  ```
- **Rollback de app não desfaz dados** já gravados no Supabase — ver `docs/BACKUP_AND_RESTORE.md`.

## Riscos de deploy
- 🟠 Push em `main` = produção, **sem aprovação** → recomendado ativar **branch protection**
  (exigir PR/review antes de publicar).
- 🟡 Sem marcador de versão no app → difícil confirmar "o que está no ar". Sugestão futura:
  exibir um número de versão/commit no rodapé.
- 🟡 CDNs de terceiros: se Tailwind/Supabase/jsPDF saírem do ar, o app degrada.

## Pré-requisitos antes do primeiro patch (D2+)
1. Backup do banco gerado e **validado** (`docs/BACKUP_AND_RESTORE.md`).
2. Backdoor `*@tapetes.test` removido (`PROJECT_STATE.md`).
3. QA local + testes verdes antes do push.
