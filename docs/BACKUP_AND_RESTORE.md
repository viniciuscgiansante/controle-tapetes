# BACKUP_AND_RESTORE.md — Controle de Tapetes

> Runbook de backup e recuperação. Pré-requisito **obrigatório** antes do primeiro patch
> funcional. Criado em 2026-06-21 (fase D1A). Banco de produção: Supabase `bhgifjrfagkzubpyqpew`.

## Status atual (2026-06-21)
- **Não existe backup conhecido.** ⚠️ É a maior lacuna de segurança operacional depois do backdoor.
- Plano Supabase = **Free** (conforme `README`/`HANDOFF`). Free tier **não tem backup gerenciado
  nem PITR** no painel — o backup é responsabilidade nossa, via export lógico.
- **Storage: nenhum bucket em uso** (probe anônimo retornou `[]`; o app não faz chamadas a Storage).
  Logo, **backup do banco cobre tudo**. Se um dia adicionarem fotos/arquivos (ideia no roadmap),
  os buckets precisarão de backup separado — dump de banco NÃO inclui arquivos do Storage.

## Estratégia em 3 camadas

### Camada 1 — Backup lógico manual (antes de qualquer patch + semanal)
A connection string fica em **Supabase → Project Settings → Database → Connection string (URI)**.
Ela contém a **SENHA do banco** (NÃO é a anon key) — trate como segredo, nunca commite.

```bash
# Segredo — não vai pro git. Pegue no painel.
export DB_URL="postgresql://postgres:[SENHA]@db.bhgifjrfagkzubpyqpew.supabase.co:5432/postgres"

mkdir -p backups   # pasta LOCAL, fora do versionamento (ver "O que nunca fazer")

# Opção A — pg_dump (full: schema + dados; o mais à prova de bala)
pg_dump "$DB_URL" --no-owner --no-privileges -f "backups/$(date +%F)_full.sql"

# Opção B — Supabase CLI
supabase db dump --db-url "$DB_URL"             -f "backups/$(date +%F)_schema.sql"   # estrutura
supabase db dump --db-url "$DB_URL" --data-only -f "backups/$(date +%F)_data.sql"     # dados
```

**Onde guardar:** local seguro / Google Drive do dono / HD externo. **Frequência:** antes de cada
patch e, no mínimo, 1× por semana enquanto o app estiver em produção. **Quem gera:** quem tem a
senha do banco (dono do projeto Supabase).

### Camada 2 — Validar que o backup é recuperável (em ambiente SEPARADO)
Nunca "testar restore" na base viva. Restaure num Postgres local ou num projeto Supabase de dev:

```bash
# Postgres local
createdb tapetes_restore
psql "postgresql://localhost/tapetes_restore" -f "backups/2026-06-21_full.sql"

# Conferir estrutura e dados
psql "postgresql://localhost/tapetes_restore" -c "\dt public.*"            # deve listar as 16 tabelas
psql "postgresql://localhost/tapetes_restore" -c "select count(*) from ops;"
psql "postgresql://localhost/tapetes_restore" -c "select count(*) from entregas;"
```

Documente data + row counts. Um backup que nunca foi restaurado **não é** um backup confiável.

### Camada 3 — Incidente / restore de produção
- Restaurar em produção deixa o projeto **inacessível** durante o processo → só com **janela de
  manutenção** combinada e usuários avisados.
- Preferir restaurar num **projeto novo** e repontar o app (trocar `SUPABASE_URL`/anon key no
  `index.html` e republicar) a sobrescrever a base viva.

## Checklist antes de qualquer restore
- [ ] Tenho um dump fresco do estado ATUAL (antes de sobrescrever qualquer coisa)?
- [ ] Sei a row count esperada das tabelas-chave (`ops`, `op_itens`, `entregas`, `usuarios`)?
- [ ] Estou restaurando em ambiente separado, não na produção viva?
- [ ] Há janela combinada, se for produção?
- [ ] Sei como repontar o app para o banco restaurado, se necessário?

## Rollback do APP (separado do banco)
`main` = produção via GitHub Pages. Não há rollback instantâneo; reverte-se por commit:

```bash
git revert <sha_do_commit_ruim>   # ou: git checkout <sha_bom> -- index.html
git push                          # GitHub Pages republica em ~1 min
```

Atenção: rollback de **app** não desfaz mudanças de **dados** já gravadas no Supabase. Por isso o
backup do banco (camada 1) é o que protege os registros de produção/entrega.

## O que NUNCA fazer
- ❌ Commitar dumps/backup no GitHub (adicione `backups/` ao `.gitignore`).
- ❌ Restaurar na base viva "só para testar".
- ❌ Rodar `db/10_reset_producao.sql` ou `db/11_reset_ops.sql` sem dump fresco + confirmação dupla.
- ❌ Guardar a senha do banco no repo ou em texto plano compartilhado.

## Anexo — Inventário esperado do schema (para validar restore)
Fonte: `db/01..09_*.sql`. Bate com `docs/superpowers/STATUS.md` (Fase 6).

**16 tabelas (public):** `usuarios`, `cores`, `modelos`, `parametros_largura`, `fornecedores`,
`precos_terceirizada`, `clientes`, `lotes`, `ops`, `op_itens`, `op_fornecedores`,
`ordens_compra_fio`, `entregas`, `entrega_itens`, `saldo_fios`, `saldo_fios_op`.

**3 funções:** `is_admin()`, `meu_fornecedor_id()`, `gerar_op_latex(bigint)`.

**0** triggers · **0** views · **0** buckets de Storage · **0** edge functions.

Migrações na ordem: `01_schema` → `02_functions` → `03_policies` → `04_seed` → `05_fix_pgrst`
→ `06_fase5a_policies` → `07_fase5a_destino_latex` → `08_fase5b_latex` → `09_fase6_cliente_lote`.
`setup_completo.sql` = tudo junto (montar do zero); `10`/`11` = **resets destrutivos** (não são backup).

> ⚠️ Não foi possível confirmar se o schema do banco real bate 100% com `db/*.sql` (sem acesso ao
> banco). A primeira restauração de validação (camada 2) serve também para detectar drift.
