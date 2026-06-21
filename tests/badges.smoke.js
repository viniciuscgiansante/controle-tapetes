// Smoke test do módulo js/badges.js.
//
// Cobre o risco residual real da extração D2C: depois de mover helpers
// de badge para um arquivo carregado via <script src=...> separado, é
// possível quebrar o app de formas que testes unitários clássicos não
// pegam:
//
//   1. O binding precisa estar acessível a OUTROS <script> da página
//      (binding cross-script). No browser, <script> clássicos compartilham
//      o mesmo "Script Record" — const/let ficam no escopo, function/var
//      viram window.*. Aqui em vm isso equivale a carregar os arquivos no
//      MESMO contexto.
//
//   2. A ordem dos <script> em index.html precisa satisfazer a dependência:
//      js/ui.js (define el) → js/badges.js (consome el). Quebrar a ordem
//      daria ReferenceError no browser.
//
//   3. O shape do nó retornado e os valores dos labels/classes precisam
//      ser preservados (a extração é literal — não pode mudar UI).

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const uiSrc     = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'),     'utf8');
const badgesSrc = fs.readFileSync(path.join(ROOT, 'js', 'badges.js'), 'utf8');

// ---- DOM mock mínimo ----
class FakeNode {
  constructor(tag) {
    this.tagName = (tag + '').toUpperCase();
    this.children = [];
    this._attrs = {};
    this._text = null;
    this.className = '';
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'class') this.className = v; }
  addEventListener() {}
  removeEventListener() {}
  replaceChildren(...nodes) {
    this.children = [];
    for (const n of nodes.flat()) {
      if (n == null || n === false) continue;
      this.children.push(typeof n === 'string' ? new FakeText(n) : n);
    }
  }
  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map(c => c.textContent).join('');
  }
  set textContent(v) { this._text = v; this.children = []; }
}
class FakeText extends FakeNode {
  constructor(t) { super('#text'); this._text = t; }
}
const fakeDocument = {
  createElement:     (t) => new FakeNode(t),
  createTextNode:    (t) => new FakeText(t),
  querySelector:     () => null,
  querySelectorAll:  () => [],
  addEventListener:  () => {},
  removeEventListener: () => {},
  body: new FakeNode('body'),
};

const sandbox = { document: fakeDocument, setTimeout, clearTimeout, console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// Carrega os dois scripts no MESMO contexto, na ordem do <head> de
// index.html. Esta ordem é parte do contrato testado.
vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });

// Lê os bindings como se fôssemos OUTRO <script> da mesma página: por
// resolução de nome, não por window.x.
function readBinding(name) {
  return vm.runInContext(
    `typeof ${name} === "undefined" ? undefined : ${name}`,
    sandbox,
    { filename: 'inline-other-script' }
  );
}

test('bindings cross-script (mesmo Script Record)', () => {
  assert.equal(typeof readBinding('el'),          'function');
  assert.equal(typeof readBinding('badgeTipo'),   'function');
  assert.equal(typeof readBinding('badgeStatus'), 'function');
});

test('mapas expostos via escopo compartilhado', () => {
  const labels = readBinding('OP_STATUS_LABEL');
  const badge  = readBinding('OP_STATUS_BADGE');
  const tipoL  = readBinding('OP_TIPO_LABEL');
  const tipoB  = readBinding('OP_TIPO_BADGE');
  assert.equal(typeof labels, 'object');
  assert.equal(typeof badge,  'object');
  assert.equal(typeof tipoL,  'object');
  assert.equal(typeof tipoB,  'object');
  assert.notEqual(labels, null);
  assert.notEqual(badge,  null);
  assert.notEqual(tipoL,  null);
  assert.notEqual(tipoB,  null);
});

test('OP_STATUS_LABEL tem os labels esperados', () => {
  const labels = readBinding('OP_STATUS_LABEL');
  assert.equal(labels.simulada,    'Simulada');
  assert.equal(labels.aberta,      'Aberta');
  assert.equal(labels.em_producao, 'Em produção');
  assert.equal(labels.finalizada,  'Finalizada');
});

test('OP_TIPO_LABEL tem os labels esperados', () => {
  const tipoL = readBinding('OP_TIPO_LABEL');
  assert.equal(tipoL.tecelagem, 'Tecelagem');
  assert.equal(tipoL.latex,     'Látex');
});

test('OP_STATUS_BADGE tem classes Tailwind para cada status', () => {
  const badge = readBinding('OP_STATUS_BADGE');
  assert.match(badge.simulada,    /bg-gray-100/);
  assert.match(badge.aberta,      /bg-blue-100/);
  assert.match(badge.em_producao, /bg-amber-100/);
  assert.match(badge.finalizada,  /bg-green-100/);
});

test('OP_TIPO_BADGE tem classes Tailwind para cada tipo', () => {
  const tipoB = readBinding('OP_TIPO_BADGE');
  assert.match(tipoB.tecelagem, /bg-indigo-100/);
  assert.match(tipoB.latex,     /bg-amber-100/);
});

test('badgeStatus("em_producao") produz SPAN com classes e label corretos', () => {
  const span = vm.runInContext("badgeStatus('em_producao')", sandbox, { filename: 'inline-render' });
  assert.ok(span instanceof FakeNode);
  assert.equal(span.tagName, 'SPAN');
  assert.match(span.className, /bg-amber-100/);
  assert.match(span.className, /text-amber-700/);
  assert.equal(span.textContent, 'Em produção');
});

test('badgeStatus("finalizada") produz SPAN verde com label "Finalizada"', () => {
  const span = vm.runInContext("badgeStatus('finalizada')", sandbox, { filename: 'inline-render' });
  assert.equal(span.tagName, 'SPAN');
  assert.match(span.className, /bg-green-100/);
  assert.equal(span.textContent, 'Finalizada');
});

test('badgeStatus("simulada") produz SPAN cinza com label "Simulada"', () => {
  const span = vm.runInContext("badgeStatus('simulada')", sandbox, { filename: 'inline-render' });
  assert.equal(span.tagName, 'SPAN');
  assert.match(span.className, /bg-gray-100/);
  assert.equal(span.textContent, 'Simulada');
});

test('badgeStatus("aberta") produz SPAN azul com label "Aberta"', () => {
  const span = vm.runInContext("badgeStatus('aberta')", sandbox, { filename: 'inline-render' });
  assert.equal(span.tagName, 'SPAN');
  assert.match(span.className, /bg-blue-100/);
  assert.equal(span.textContent, 'Aberta');
});

test('badgeStatus cai no fallback cinza para status desconhecido', () => {
  const span = vm.runInContext("badgeStatus('xyz')", sandbox, { filename: 'inline-render' });
  assert.equal(span.tagName, 'SPAN');
  assert.match(span.className, /bg-gray-100/);
  assert.match(span.className, /text-gray-700/);
  assert.equal(span.textContent, 'xyz');
});

test('badgeTipo("latex") produz SPAN âmbar com label "Látex"', () => {
  const span = vm.runInContext("badgeTipo('latex')", sandbox, { filename: 'inline-render' });
  assert.equal(span.tagName, 'SPAN');
  assert.match(span.className, /bg-amber-100/);
  assert.match(span.className, /text-amber-700/);
  assert.equal(span.textContent, 'Látex');
});

test('badgeTipo("tecelagem") produz SPAN indigo com label "Tecelagem"', () => {
  const span = vm.runInContext("badgeTipo('tecelagem')", sandbox, { filename: 'inline-render' });
  assert.equal(span.tagName, 'SPAN');
  assert.match(span.className, /bg-indigo-100/);
  assert.match(span.className, /text-indigo-700/);
  assert.equal(span.textContent, 'Tecelagem');
});

test('badgeTipo cai no fallback cinza para tipo desconhecido', () => {
  const span = vm.runInContext("badgeTipo('xyz')", sandbox, { filename: 'inline-render' });
  assert.equal(span.tagName, 'SPAN');
  assert.match(span.className, /bg-gray-100/);
  assert.equal(span.textContent, 'xyz');
});

test('todos os badges retornados têm a forma <span class="…">texto</span> esperada pelo HTML', () => {
  // O call-site em index.html faz `el('span', { class: '…' }, label)` —
  // aqui verificamos que o nó produzido é SPAN, com classe e com texto
  // não-vazio. Isso é o que o DOM real precisa para renderizar.
  for (const input of ['em_producao', 'finalizada', 'simulada', 'aberta', 'xyz']) {
    const span = vm.runInContext(`badgeStatus(${JSON.stringify(input)})`, sandbox, { filename: 'inline-shape' });
    assert.equal(span.tagName, 'SPAN', `badgeStatus(${JSON.stringify(input)}).tagName`);
    assert.ok(span.className && span.className.length > 0, `badgeStatus(${JSON.stringify(input)}).className vazio`);
    assert.equal(span.textContent.length > 0, true, `badgeStatus(${JSON.stringify(input)}).textContent vazio`);
  }
  for (const input of ['latex', 'tecelagem', 'xyz']) {
    const span = vm.runInContext(`badgeTipo(${JSON.stringify(input)})`, sandbox, { filename: 'inline-shape' });
    assert.equal(span.tagName, 'SPAN', `badgeTipo(${JSON.stringify(input)}).tagName`);
    assert.ok(span.className && span.className.length > 0, `badgeTipo(${JSON.stringify(input)}).className vazio`);
    assert.equal(span.textContent.length > 0, true, `badgeTipo(${JSON.stringify(input)}).textContent vazio`);
  }
});
