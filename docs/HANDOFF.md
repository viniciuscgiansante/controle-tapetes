# Handoff — Controle de Produção de Tapetes

Documento de passagem do projeto. Se você acabou de assumir, **comece por aqui** e
depois leia [`docs/superpowers/STATUS.md`](superpowers/STATUS.md) (a fonte da verdade
sobre o que já foi feito em cada fase).

---

## 1. O que é o projeto

App web (SPA de um arquivo só) para controlar a produção de tapetes, do pedido de fios
até a entrega final. Dois perfis de usuário:

- **Admin** — cria Ordens de Produção (OPs), cadastra cores/modelos/fornecedores/preços,
  acompanha recebimento de fios e entregas.
- **Fornecedor** — cada fornecedor vê só o que é dele. Tipos: fio (algodão/poliéster),
  tecelagem ("parte de cima") e látex.

Produção (vai mudar de URL após a transferência — ver seção 3):
https://viniciuscgiansante.github.io/controle-tapetes/

## 2. Stack

- **Frontend:** HTML único (`index.html`) com JavaScript vanilla embutido + Tailwind CSS via CDN. Sem build, sem framework.
- **Lógica de cálculo:** funções puras em `js/calculo-op.js` (testáveis isoladamente).
- **Backend:** Supabase — Postgres + Auth + RLS (Row Level Security). Plano free.
- **Hospedagem:** GitHub Pages (publica automático no push pra `main`, ~1min).
- **Testes:** `node --test` (nativo do Node, sem dependências).

Não há `package.json`, `node_modules` nem etapa de build. É de propósito — mantém simples.

## 3. Acessos a receber (transferência de propriedade)

O projeto está sendo **transferido inteiro** pra você. Checklist do que precisa acontecer:

### GitHub
1. O dono atual transfere o repositório pra sua conta
   (Settings → General → Danger Zone → *Transfer ownership*). Você aceita o convite.
2. A URL do repo e do site mudam para o **seu** usuário:
   `https://SEU_USUARIO.github.io/controle-tapetes/`.
3. Reative o GitHub Pages no seu repo: Settings → Pages → Source = branch `main`, pasta `/ (root)`.

### Supabase
1. O dono atual transfere o projeto Supabase para uma organização sua
   (Project Settings → General → *Transfer project*). Você precisa ter uma org criada antes.
2. O projeto é o `bhgifjrfagkzubpyqpew` (`https://bhgifjrfagkzubpyqpew.supabase.co`).
3. A `SUPABASE_ANON_KEY` que está no `index.html` (linhas ~27-28) **continua válida** —
   ela aponta pro projeto, que foi transferido junto. A anon key é pública por design
   (a segurança vem das policies RLS), então pode ficar commitada sem problema.
4. **Atenção ao Auth:** se um dia usar magic link / confirmação por e-mail, ajuste o
   *Site URL* e *Redirect URLs* em Authentication → URL Configuration para a nova URL do
   GitHub Pages. Hoje o login é e-mail+senha, então não bloqueia nada de imediato.

### Memória do assistente (claude-mem)
O histórico de observações do Claude (`~/.claude/...`) é **local da máquina do dono anterior**
e não é transferido. Tudo que importa de verdade está versionado no repo (este arquivo,
`STATUS.md`, `docs/qa/`, `db/`). Os docs são a fonte durável da verdade.

## 4. Como rodar localmente

As credenciais já estão no topo do `<script>` em `index.html` — não precisa configurar nada.

```bash
# servidor estático simples
python3 -m http.server 8000
# acesse http://localhost:8000
```

Ou só abrir o `index.html` no navegador (duplo clique).

### Usuários de teste

> ⚠️ **Senhas removidas em 2026-06-21** (estavam publicadas em repo público — risco crítico).
> Excluir/rotacionar os `*@tapetes.test` no Supabase Auth. Ver `PROJECT_STATE.md`.

| Email                  | Senha       | Perfil                |
|------------------------|-------------|-----------------------|
| admin@tapetes.test     | (removida)  | admin                 |
| algodao@tapetes.test   | (removida)  | fornecedor (fio)      |
| tecelagem@tapetes.test | (removida)  | fornecedor (tecelagem)|
| latex@tapetes.test     | (removida)  | fornecedor (látex)    |

## 5. Como rodar os testes

```bash
node --test tests/calculo-op.test.js
# esperado hoje: 23/23 passando
```

Toda lógica de cálculo de fio/entrega fica em `js/calculo-op.js` como função pura e tem
teste. Ao mexer em cálculo, **escreva o teste primeiro** e rode a suite antes de commitar.

## 6. Como fazer deploy

```bash
git add .
git commit -m "<mensagem em português>"
git push
```

GitHub Pages republica sozinho em ~1min. Não há ambiente de staging — `main` é produção.
Faça QA local antes de dar push.

## 7. Estado atual (o que falta)

**Fases 1 a 6 estão implementadas e publicadas em produção** (Fase 6 no ar desde 2026-06-05:
Cliente, Lote, fios sob demanda, % entregue e PDF). Todo o SQL correspondente (`db/01` a
`db/09`) já foi aplicado no projeto Supabase atual.

**Fase 7 — Corrigir/Desfazer recebimento de fio** está *implementada e revisada* no branch
`feat/corrigir-desfazer-recebimento-fio` (4 commits), **ainda não mergeada na `main`**.
Pendências antes de fechar:

1. **QA manual no navegador** — rodar `docs/qa/fase7-corrigir-recebimento-fio-checklist.md`
   logado como admin e como fornecedor.
2. **Merge na `main`** (`git checkout main && git merge feat/corrigir-desfazer-recebimento-fio
   && git push`). Não há SQL novo nessa feature — é só `index.html`.

O ponto de retomada detalhado dessa frente está em [`docs/RETOMAR.md`](RETOMAR.md).

## 8. Estrutura do projeto

```
index.html                     # o app inteiro (HTML + CSS classes + JS no <script>)
js/calculo-op.js               # funções puras de cálculo (fio, recálculo, entregas)
tests/calculo-op.test.js       # node --test
db/
  01_schema.sql ... 06_*.sql   # scripts numerados, aplicar em ordem num projeto novo
  setup_completo.sql           # tudo junto (schema + RLS + funções) — usado na Fase 1
docs/
  HANDOFF.md                   # este arquivo
  superpowers/STATUS.md        # estado de cada fase (LER PRIMEIRO depois daqui)
  superpowers/specs|plans/     # design e planos das fases
  qa/faseN-checklist.md        # checklists de QA por fase
README.md
```

## 9. Convenções importantes

- **Idioma:** todo código, UI, mensagens e commits em **português brasileiro**.
- **Látex não é escolhido na criação da OP.** Decide-se depois da parte de cima ("tecelagem"),
  e uma mesma OP pode ter mais de um destino de látex. Isso é a Fase 5b.
- **Cuidados com Supabase (aprendidos na marra):**
  - Sempre usar a JWT **anon key** (`eyJ...`). A publishable key nova (`sb_publishable_*`)
    causa erro `PGRST002`.
  - **Evite** Restart/Pause/Resume seguidos no painel do Supabase — corrompe o schema cache
    do PostgREST.
  - Toda tabela precisa de PRIMARY KEY explícita.
  - Funções de RLS: `plpgsql` + `SECURITY DEFINER` + `EXCEPTION WHEN OTHERS`.
- **Modelos** exibidos no padrão `Nome 1.40m · COR1/COR2` (helper `rotuloModelo`).

## 10. Próximos passos (roadmap)

Já concluídas: Fase 5a (Tecelagem), Fase 5b (Látex) e Fase 6 (Cliente/Lote/fios sob
demanda/% entregue/PDF). Fase 7 (Corrigir/Desfazer recebimento de fio) no branch,
aguardando QA + merge — ver seção 7.

Ideias mencionadas, **ainda não iniciadas** (sem decisão fechada):

- Filtro por data na lista de OPs (`#/ops`) — hoje o filtro é por tipo (tecelagem/látex).
- Tela de relatórios + botão de "prompt pronto pra IA" (copia o prompt + dados do relatório
  pra colar numa IA). Exige criar a tela de relatórios primeiro — hoje não existe.

## 11. Onde achar o resto

- **Estado de cada fase:** `docs/superpowers/STATUS.md`
- **Design e planos:** `docs/superpowers/specs/` e `docs/superpowers/plans/`
- **Checklists de QA:** `docs/qa/`
- **Schema do banco:** `db/01_schema.sql` (ou `setup_completo.sql` pra montar do zero)
