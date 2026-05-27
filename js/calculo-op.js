// =====================================================================
// === CÁLCULO OP ======================================================
// Funções puras (sem DOM, sem Supabase) — testáveis com `node --test`.
// =====================================================================

// Normaliza largura para chave consistente ("1.4" e "1.40" -> "1.40").
function larguraKey(largura) {
  return Number(largura).toFixed(2);
}

// Calcula kg de fio por cor para os itens da OP.
// itens: [{ modeloId, metros }]
// modelosById: { [id]: { id, nome, largura, cor_1:{id,nome}, cor_2:{id,nome} } }
// parametrosByLargura: { [larguraKey]: { algodao_por_ml, poliester_por_ml, valor_x } }
// Retorna: { algodaoPorCor: { [corId]: {corId, corNome, kg} }, poliester: { PRETO, BRANCO } }
function calcularFiosOP(itens, modelosById, parametrosByLargura) {
  const algodaoPorCor = {};
  const poliester = { PRETO: 0, BRANCO: 0 };

  for (const item of itens) {
    const metros = Number(item.metros);
    if (!Number.isFinite(metros) || metros <= 0) continue;

    const modelo = modelosById[item.modeloId];
    if (!modelo) continue;

    const p = parametrosByLargura[larguraKey(modelo.largura)];
    if (!p) throw new Error('Sem parâmetros para largura ' + modelo.largura);

    const kgAlg = p.algodao_por_ml * p.valor_x * metros;
    for (const cor of [modelo.cor_1, modelo.cor_2]) {
      if (!algodaoPorCor[cor.id]) algodaoPorCor[cor.id] = { corId: cor.id, corNome: cor.nome, kg: 0 };
      algodaoPorCor[cor.id].kg += kgAlg;
    }

    const kgPol = p.poliester_por_ml * p.valor_x * metros;
    poliester.PRETO += kgPol;
    poliester.BRANCO += kgPol;
  }

  return { algodaoPorCor, poliester };
}

// Transforma o resultado de calcularFiosOP em payloads de ordens_compra_fio.
// kg_pedido > 0 (schema CHECK) e arredondado a 3 casas (NUMERIC(10,3)).
// op_id e fornecedor_id são preenchidos na hora de salvar (não aqui).
function montarOrdensCompraFio(calculo) {
  const round3 = (n) => Math.round(n * 1000) / 1000;
  const ordens = [];

  for (const { corId, kg } of Object.values(calculo.algodaoPorCor)) {
    const kgPedido = round3(kg);
    if (kgPedido > 0) ordens.push({ tipo: 'algodao', cor_id: corId, cor_poliester: null, kg_pedido: kgPedido });
  }
  for (const cor of ['PRETO', 'BRANCO']) {
    const kgPedido = round3(calculo.poliester[cor]);
    if (kgPedido > 0) ordens.push({ tipo: 'poliester', cor_id: null, cor_poliester: cor, kg_pedido: kgPedido });
  }
  return ordens;
}

// Recalcula a OP a partir do fio realmente recebido (fator-gargalo).
// A cor de fio com menor (kg_recebido / kg_pedido) define o quanto a OP escala.
// itens:  [{ op_item_id, metros_pedidos }]
// ordens: [{ id, tipo, cor_id, cor_poliester, kg_pedido, kg_recebido }]
// Retorna: { fator, itens:[{op_item_id, metros_pedidos, metros_ajustados}],
//            sobras:[{ordem_id, tipo, cor_id, cor_poliester, kg_sobra}] }  (só sobras > 0)
function recalcularOP(itens, ordens) {
  const round2 = (n) => Math.round(n * 100) / 100;
  const round3 = (n) => Math.round(n * 1000) / 1000;

  let fator = Infinity;
  for (const o of ordens) {
    const ratio = Number(o.kg_recebido) / Number(o.kg_pedido);
    if (ratio < fator) fator = ratio;
  }
  if (!Number.isFinite(fator)) fator = 1; // sem ordens: nada a ajustar

  const itensOut = itens.map((i) => ({
    op_item_id: i.op_item_id,
    metros_pedidos: Number(i.metros_pedidos),
    metros_ajustados: round2(Number(i.metros_pedidos) * fator),
  }));

  const sobras = [];
  for (const o of ordens) {
    const kgSobra = round3(Number(o.kg_recebido) - fator * Number(o.kg_pedido));
    if (kgSobra > 0) {
      sobras.push({
        ordem_id: o.id,
        tipo: o.tipo,
        cor_id: o.cor_id ?? null,
        cor_poliester: o.cor_poliester ?? null,
        kg_sobra: kgSobra,
      });
    }
  }

  return { fator, itens: itensOut, sobras };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { larguraKey, calcularFiosOP, montarOrdensCompraFio, recalcularOP };
}
