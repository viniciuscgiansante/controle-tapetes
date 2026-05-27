const { test } = require('node:test');
const assert = require('node:assert');
const { calcularFiosOP, larguraKey, montarOrdensCompraFio, recalcularOP } = require('../js/calculo-op.js');

// Parâmetros do seed (db/04_seed.sql)
const PARAMS = {
  '1.40': { algodao_por_ml: 0.000350, poliester_por_ml: 0.000420, valor_x: 1.0 },
  '2.10': { algodao_por_ml: 0.000525, poliester_por_ml: 0.000630, valor_x: 1.0 },
};
// Modelos: Conforto 1.40 (BRANCO/PRETO), Conforto 2.10 (PRETO/BRANCO)
const MODELOS = {
  1: { id: 1, nome: 'Conforto', largura: 1.40, cor_1: { id: 1, nome: 'BRANCO' }, cor_2: { id: 2, nome: 'PRETO' } },
  2: { id: 2, nome: 'Conforto', largura: 2.10, cor_1: { id: 2, nome: 'PRETO' }, cor_2: { id: 1, nome: 'BRANCO' } },
};

test('larguraKey normaliza 1.4 e 1.40 para a mesma chave', () => {
  assert.strictEqual(larguraKey(1.4), '1.40');
  assert.strictEqual(larguraKey('1.40'), '1.40');
  assert.strictEqual(larguraKey(2.1), '2.10');
});

test('1 item 1.40 x 200m: algodão por cor e poliéster conferem', () => {
  const r = calcularFiosOP([{ modeloId: 1, metros: 200 }], MODELOS, PARAMS);
  assert.ok(Math.abs(r.algodaoPorCor[1].kg - 0.07) < 1e-9);
  assert.ok(Math.abs(r.algodaoPorCor[2].kg - 0.07) < 1e-9);
  assert.strictEqual(r.algodaoPorCor[1].corNome, 'BRANCO');
  assert.ok(Math.abs(r.poliester.PRETO - 0.084) < 1e-9);
  assert.ok(Math.abs(r.poliester.BRANCO - 0.084) < 1e-9);
});

test('2 itens larguras diferentes somam algodão por cor', () => {
  const r = calcularFiosOP(
    [{ modeloId: 1, metros: 200 }, { modeloId: 2, metros: 100 }],
    MODELOS, PARAMS
  );
  assert.ok(Math.abs(r.algodaoPorCor[1].kg - 0.1225) < 1e-9);
  assert.ok(Math.abs(r.algodaoPorCor[2].kg - 0.1225) < 1e-9);
});

test('poliéster sempre lista PRETO e BRANCO mesmo sem itens', () => {
  const r = calcularFiosOP([], MODELOS, PARAMS);
  assert.strictEqual(r.poliester.PRETO, 0);
  assert.strictEqual(r.poliester.BRANCO, 0);
  assert.deepStrictEqual(r.algodaoPorCor, {});
});

test('item com metros inválido é ignorado', () => {
  const r = calcularFiosOP([{ modeloId: 1, metros: 0 }, { modeloId: 1, metros: -5 }], MODELOS, PARAMS);
  assert.deepStrictEqual(r.algodaoPorCor, {});
});

test('largura sem parâmetro lança erro', () => {
  const modelos = { 9: { id: 9, nome: 'X', largura: 3.0, cor_1: { id: 1, nome: 'BRANCO' }, cor_2: { id: 2, nome: 'PRETO' } } };
  assert.throws(() => calcularFiosOP([{ modeloId: 9, metros: 100 }], modelos, PARAMS), /largura/);
});

test('montarOrdensCompraFio gera 1 ordem por cor de algodão + PRETO + BRANCO', () => {
  const calc = calcularFiosOP(
    [{ modeloId: 1, metros: 200 }, { modeloId: 2, metros: 100 }],
    MODELOS, PARAMS
  );
  const ordens = montarOrdensCompraFio(calc);
  const algodao = ordens.filter(o => o.tipo === 'algodao');
  const poliester = ordens.filter(o => o.tipo === 'poliester');
  assert.strictEqual(algodao.length, 2);
  assert.strictEqual(poliester.length, 2);
  for (const o of algodao) { assert.ok(o.cor_id); assert.strictEqual(o.cor_poliester, null); assert.ok(o.kg_pedido > 0); }
  for (const o of poliester) { assert.strictEqual(o.cor_id, null); assert.ok(['PRETO','BRANCO'].includes(o.cor_poliester)); }
});

test('montarOrdensCompraFio arredonda kg_pedido para 3 casas', () => {
  const calc = calcularFiosOP([{ modeloId: 1, metros: 200 }], MODELOS, PARAMS);
  const ordens = montarOrdensCompraFio(calc);
  const branco = ordens.find(o => o.tipo === 'algodao' && o.cor_id === 1);
  assert.strictEqual(branco.kg_pedido, 0.07);
});

test('montarOrdensCompraFio não gera ordens sem itens', () => {
  const ordens = montarOrdensCompraFio(calcularFiosOP([], MODELOS, PARAMS));
  assert.strictEqual(ordens.length, 0);
});

test('recalcularOP fator < 1 escala metros pra baixo e gera saldo da cor não-gargalo', () => {
  const itens = [{ op_item_id: 10, metros_pedidos: 200 }];
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_pedido: 10, kg_recebido: 10 },
    { id: 2, tipo: 'algodao', cor_id: 2, cor_poliester: null, kg_pedido: 10, kg_recebido: 5 },
  ];
  const r = recalcularOP(itens, ordens);
  assert.strictEqual(r.fator, 0.5);
  assert.strictEqual(r.itens[0].metros_ajustados, 100);
  assert.strictEqual(r.itens[0].metros_pedidos, 200);
  assert.strictEqual(r.sobras.length, 1);
  assert.deepStrictEqual(r.sobras[0], { ordem_id: 1, tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_sobra: 5 });
});

test('recalcularOP fator > 1 escala metros pra cima', () => {
  const itens = [{ op_item_id: 10, metros_pedidos: 100 }];
  const ordens = [
    { id: 1, tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_pedido: 10, kg_recebido: 20 },
    { id: 2, tipo: 'poliester', cor_id: null, cor_poliester: 'BRANCO', kg_pedido: 10, kg_recebido: 15 },
  ];
  const r = recalcularOP(itens, ordens);
  assert.strictEqual(r.fator, 1.5);
  assert.strictEqual(r.itens[0].metros_ajustados, 150);
  assert.strictEqual(r.sobras.length, 1);
  assert.strictEqual(r.sobras[0].ordem_id, 1);
  assert.strictEqual(r.sobras[0].kg_sobra, 5);
});

test('recalcularOP fator = 1 não ajusta e não gera saldo', () => {
  const itens = [{ op_item_id: 10, metros_pedidos: 120 }];
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_pedido: 7, kg_recebido: 7 },
    { id: 2, tipo: 'poliester', cor_id: null, cor_poliester: 'PRETO', kg_pedido: 8, kg_recebido: 8 },
  ];
  const r = recalcularOP(itens, ordens);
  assert.strictEqual(r.fator, 1);
  assert.strictEqual(r.itens[0].metros_ajustados, 120);
  assert.strictEqual(r.sobras.length, 0);
});

test('recalcularOP arredonda metros a 2 casas e sobra a 3 casas', () => {
  const itens = [{ op_item_id: 10, metros_pedidos: 100 }];
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_pedido: 3, kg_recebido: 1 },
    { id: 2, tipo: 'algodao', cor_id: 2, cor_poliester: null, kg_pedido: 3, kg_recebido: 3 },
  ];
  const r = recalcularOP(itens, ordens);
  assert.strictEqual(r.itens[0].metros_ajustados, 33.33);
  assert.strictEqual(r.sobras[0].kg_sobra, 2);
});

test('recalcularOP sem ordens mantém metros (fator 1)', () => {
  const r = recalcularOP([{ op_item_id: 10, metros_pedidos: 50 }], []);
  assert.strictEqual(r.fator, 1);
  assert.strictEqual(r.itens[0].metros_ajustados, 50);
  assert.strictEqual(r.sobras.length, 0);
});

test('recalcularOP ignora ordem com kg_pedido 0 ao calcular o fator', () => {
  const itens = [{ op_item_id: 10, metros_pedidos: 100 }];
  const ordens = [
    { id: 1, tipo: 'algodao', cor_id: 1, cor_poliester: null, kg_pedido: 10, kg_recebido: 8 },
    { id: 2, tipo: 'algodao', cor_id: 2, cor_poliester: null, kg_pedido: 0, kg_recebido: 0 },
  ];
  const r = recalcularOP(itens, ordens);
  assert.strictEqual(r.fator, 0.8);
  assert.strictEqual(r.itens[0].metros_ajustados, 80);
});
