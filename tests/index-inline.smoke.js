// Smoke D2C-R1: garante que o script inline do index.html não redeclara
// os identificadores que foram extraídos para js/badges.js.
//
// Falha do D2C: o index.html mantinha `const OP_STATUS_BADGE = {...}` e
// `const OP_STATUS_LABEL = {...}` no script inline. Quando o browser
// carregava `js/badges.js` (que também declara esses consts no escopo do
// Script Record) e em seguida executava o script inline, o segundo `const`
// lançava `SyntaxError: Identifier 'OP_STATUS_BADGE' has already been
// declared` e a tela ficava branca.
//
// Este teste extrai o <script> inline servido pelo http.server, carrega
// `js/ui.js`, `js/badges.js` e o script inline num MESMO vm.Context (na
// mesma ordem dos <script> do <head>), e valida que não há redeclaração
// dos 6 identificadores extraídos. Antes do fix, este teste falhava com
// SyntaxError; depois do fix, passa.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const http   = require('node:http');

const PORT = 8765;
const HOST = '127.0.0.1';

function fetchIndexHtml() {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: HOST, port: PORT, path: '/index.html' }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}

function extractInlineScript(html) {
  // Pega o <script>...</script> que NÃO tem src (script inline principal).
  // É o ÚLTIMO <script>...</script> do <body> na página atual.
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1]);
  if (matches.length === 0) throw new Error('nenhum <script> inline encontrado');
  // Pega o maior (o script principal é tipicamente o maior)
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

// O script inline do index.html toca Supabase, currentUser, telas, etc.
// Para isolar APENAS a falha de duplicate-binding, criamos um DOM mock
// mínimo e cortamos o script inline numa parte que tenta declarar os
// identificadores extraídos. Se o bug existisse (duplicate const no
// escopo), vm.runInContext lançaria SyntaxError aqui.
function setupSandbox() {
  class FakeNode {
    constructor(t){ this.tagName=(t+'').toUpperCase(); this.children=[]; this.className=''; this._text=null; }
    appendChild(n){ this.children.push(n); return n; }
    setAttribute(k,v){ if(k==='class') this.className=v; }
    addEventListener(){} removeEventListener(){}
    replaceChildren(...ns){ this.children=[]; for(const n of ns.flat()){ if(n==null||n===false) continue; this.children.push(typeof n==='string'?{textContent:n,appendChild:()=>n,setAttribute:()=>{}}:n);} }
    get textContent(){ if(this._text!=null) return this._text; return this.children.map(c=>c.textContent||'').join(''); }
    set textContent(v){ this._text=v; }
  }
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild(){}, setAttribute(){} }),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const sandbox = { document, setTimeout, clearTimeout, console, URL, URLSearchParams };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

const ROOT = path.resolve(__dirname, '..');
const uiSrc     = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'),     'utf8');
const badgesSrc = fs.readFileSync(path.join(ROOT, 'js', 'badges.js'), 'utf8');

test('http.server está respondendo em :8765 e serve index.html', async () => {
  const { status, body } = await fetchIndexHtml();
  assert.equal(status, 200);
  assert.ok(body.length > 1000, 'index.html muito curto');
  assert.match(body, /<script src="js\/badges\.js"><\/script>/);
});

test('js/badges.js é carregado EXATAMENTE UMA VEZ no <head>', async () => {
  const { body } = await fetchIndexHtml();
  const matches = body.match(/<script\s+src="js\/badges\.js"/g) || [];
  assert.equal(matches.length, 1, `esperado 1 <script src="js/badges.js">, encontrado ${matches.length}`);
});

test('script inline servido pelo http.server NÃO contém mais OP_STATUS_BADGE / OP_STATUS_LABEL', async () => {
  const { body } = await fetchIndexHtml();
  const inline = extractInlineScript(body);
  assert.equal(inline.includes('OP_STATUS_BADGE'), false,
    'script inline ainda declara OP_STATUS_BADGE — causaria SyntaxError no browser');
  assert.equal(inline.includes('OP_STATUS_LABEL'), false,
    'script inline ainda declara OP_STATUS_LABEL — causaria SyntaxError no browser');
});

test('script inline servido pelo http.server NÃO contém mais OP_TIPO_LABEL / OP_TIPO_BADGE', async () => {
  const { body } = await fetchIndexHtml();
  const inline = extractInlineScript(body);
  assert.equal(inline.includes('OP_TIPO_LABEL'), false,
    'script inline ainda declara OP_TIPO_LABEL');
  assert.equal(inline.includes('OP_TIPO_BADGE'), false,
    'script inline ainda declara OP_TIPO_BADGE');
});

test('script inline servido pelo http.server NÃO contém mais as funções badgeTipo / badgeStatus', async () => {
  const { body } = await fetchIndexHtml();
  const inline = extractInlineScript(body);
  // Procura por declaração top-level: `function badgeTipo(` ou `function badgeStatus(`
  // (não em string/comentário). Aqui usamos match simples de substring porque o
  // script inline é JavaScript real, sem aspas contendo esses nomes em formato
  // de declaração.
  assert.equal(/function\s+badgeTipo\s*\(/.test(inline), false,
    'script inline ainda define function badgeTipo');
  assert.equal(/function\s+badgeStatus\s*\(/.test(inline), false,
    'script inline ainda define function badgeStatus');
});

test('coexistência ui.js + badges.js não lança SyntaxError', () => {
  const sandbox = setupSandbox();
  // Carrega na mesma ordem do <head>
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  // Se chegamos aqui, não houve SyntaxError
  assert.equal(typeof vm.runInContext('typeof el', sandbox), 'string');
  assert.equal(typeof vm.runInContext('badgeStatus', sandbox), 'function');
  assert.equal(typeof vm.runInContext('badgeTipo',   sandbox), 'function');
});

test('coexistência ui.js + badges.js + script inline não lança SyntaxError', async () => {
  const { body } = await fetchIndexHtml();
  const inline = extractInlineScript(body);
  const sandbox = setupSandbox();
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  // Tentar rodar o script inline (que tem 124KB de UI real) num DOM mock
  // vai falhar em muitas linhas por falta de Supabase/etc, mas o que
  // importa aqui é: NÃO pode falhar com SyntaxError de duplicate
  // identifier. Capturamos só esse tipo de erro.
  let threwSyntax = false;
  let otherErr = null;
  try {
    vm.runInContext(inline, sandbox, { filename: 'index-inline.js' });
  } catch (e) {
    if (e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message)) {
      threwSyntax = true;
    } else {
      otherErr = e;
    }
  }
  assert.equal(threwSyntax, false,
    'coexistência lançou SyntaxError de duplicate identifier (bug D2C não corrigido)');
  // `otherErr` é esperado (Supabase undefined, etc) — o que NÃO pode
  // acontecer é SyntaxError de duplicate. Não fazemos assert sobre
  // otherErr porque a execução completa do app precisa de browser real.
  if (otherErr) {
    // Logar para diagnóstico, mas não falhar
    console.log('(esperado) script inline falhou em runtime, mas NÃO por duplicate identifier:', otherErr.message.slice(0, 120));
  }
});
