# Fase 2 — Bugs pendentes (encontrados no QA)

Itens encontrados durante o QA mas que ficaram pra depois (decisão do Vinícius em 2026-05-19).

## 1. Editar Preço: campo "Largura" não vem preenchido

**Onde:** Modal de editar preço (Cadastros → Preços → Editar).
**Sintoma:** Ao abrir o modal de edição, o select de Largura aparece vazio em vez de mostrar o valor atual (1,40 m ou 2,10 m).
**Hipótese:** Supabase devolve `numeric` como `1.4` / `2.1`, mas as `options` do select usam strings `'1.40'` / `'2.10'`.
**Tentativa de fix (commit `76bf39c`):** Tornar `selectInput` tolerante a comparação numérica vs string. **Não funcionou** no navegador do Vinícius — causa real ainda não confirmada.
**Provavelmente afeta também:** Modal de editar Modelo (mesmo padrão de `largOptions`), mas não foi observado no QA.
**Próximos passos quando voltar:**
- Abrir DevTools → Console na tela de Preços, abrir o modal de editar, e logar `preco.largura` e o `typeof` pra ver o que o Supabase realmente devolve.
- Conferir se o fix do commit `76bf39c` está mesmo no `index.html` servido pelo GitHub Pages (pode ter sido cache).
- Se tipo for `string` tipo `"1.40"`, o problema é outro (talvez `selectInput` está sendo chamado antes do valor chegar?).
