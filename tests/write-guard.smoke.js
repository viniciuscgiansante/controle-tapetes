// Smoke test do WRITE-GUARD-A (fase RAVATEX-TAPETES-WRITE-GUARD-A).
//
// O que este teste garante:
//
//   1. Quando o app roda em localhost/127.0.0.1 E a SUPABASE_URL é a de
//      produção (bhgifjrfagkzubpyqpew), as operações de escrita
//      (insert/update/delete/upsert/rpc) são bloqueadas com um erro
//      identificável (mensagem contém "WRITE-GUARD").
//
//   2. As operações de leitura (select) e o módulo auth NÃO são
//      bloqueados — passam direto para o cliente Supabase real.
//
//   3. Quando o ambiente NÃO é localhost+produção (ex.: produção
//      real em grupoterrabranca.github.io, ou staging com URL
//      diferente), a guarda NÃO ativa — writes passam normal.
//
// Estratégia de teste:
//   - Lê o <script> inline do index.html servido por http.server
//     (porta 8765), extrai o bloco WRITE-GUARD (entre os marcadores
//     `=== WRITE-GUARD` e o próximo `=== AUTH`), executa-o num
//     vm.Context com mocks controlados (location, document, supabase).
//   - Ajusta `location.hostname` e `SUPABASE_URL` no contexto para
//     simular cada ambiente.
//   - Verifica que `supa.from(...).insert/update/delete/upsert(...)
//     rejeitam com a mensagem esperada, que `.select()` passa, e que
//     `.rpc()` rejeita no modo bloqueado.

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

// Extrai o bloco WRITE-GUARD do script inline. Procura o marcador
// `=== WRITE-GUARD` e vai até o início do próximo bloco de seção
// (`=== AUTH`). Isso garante que pegamos o header de comentário
// E todo o código runtime (const, if, function, const supa = ...).
function extractWriteGuardBlock(inline) {
  const start = inline.indexOf('=== WRITE-GUARD');
  if (start < 0) throw new Error('marcador === WRITE-GUARD não encontrado no script inline');
  const blockStart = inline.lastIndexOf('// ====', start);
  // Procura o PRIMEIRO separador de seção após WRITE-GUARD.
  // O padrão é `// ==== ... // ==== ... // === AUTH`. Como o AUTH é
  // a seção imediatamente após WRITE-GUARD no index.html, basta achar
  // o primeiro `// === AUTH` (ou similar) após start.
  const afterStart = start + 20;
  // Anchor: "// === AUTH" (sem `=` extras à esquerda na mesma linha)
  const idx = inline.indexOf('// === AUTH', afterStart);
  if (idx < 0) throw new Error('fim do bloco WRITE-GUARD não encontrado');
  // Volta até o `// ====` que abre o separador de seção
  const sepStart = inline.lastIndexOf('// ====', idx);
  if (sepStart < 0) throw new Error('separador de seção não encontrado');
  return inline.slice(blockStart, sepStart);
}

// Cria um cliente Supabase FAKE (não toca rede) que devolve Promises
// identificáveis. Cada método registra o que foi chamado e devolve
// { data, error } ou uma Promise thereof.
function makeFakeSupabaseClient() {
  const calls = [];
  const record = (op) => (...args) => {
    calls.push({ op, args });
    if (op === 'select') return Promise.resolve({ data: [], error: null });
    if (op === 'auth.getSession') return Promise.resolve({ data: { session: null }, error: null });
    if (op === 'rpc') return Promise.resolve({ data: 'ok', error: null });
    return Promise.resolve({ data: null, error: null });
  };
  const queryBuilder = (table) => {
    const qb = {
      select: record('select'),
      insert: record('insert'),
      update: record('update'),
      delete: record('delete'),
      upsert: record('upsert'),
      eq: () => qb, // encadeamento preservado
      single: record('select'),
    };
    return qb;
  };
  return {
    from: (table) => { calls.push({ op: 'from', args: [table] }); return queryBuilder(table); },
    rpc: record('rpc'),
    auth: {
      getSession: record('auth.getSession'),
      signInWithPassword: record('auth.signInWithPassword'),
      signOut: record('auth.signOut'),
    },
    storage: {},
    _calls: calls,
  };
}

// Monta um sandbox com mocks e executa o bloco WRITE-GUARD.
// Retorna { sandbox, fakeSupa, guardBlock, source }.
function runGuardInSandbox({ hostname, supabaseUrl }) {
  const fakeSupa = makeFakeSupabaseClient();
  const fakeSupabase = {
    createClient: (url, key, opts) => {
      fakeSupa._createdWith = { url, key, opts };
      return fakeSupa;
    },
  };
  const documentMock = {
    body: null, // sem DOM real; banner é best-effort e vai falhar silencioso
    createElement: (t) => ({
      tagName: t.toUpperCase(),
      setAttribute() {},
      style: {},
      textContent: '',
    }),
  };
  const sandbox = {
    console,
    URL,
    URLSearchParams,
    setTimeout, clearTimeout,
    location: { hostname, href: 'http://' + hostname + '/index.html' },
    document: documentMock,
    supabase: fakeSupabase,
    Promise,
    Reflect,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  return new Promise((resolve, reject) => {
    fetchIndexHtml().then(({ body }) => {
      const inlineMatch = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g.exec(body);
      if (!inlineMatch) return reject(new Error('nenhum <script> inline encontrado'));
      const inline = inlineMatch[1];
      const guardBlock = extractWriteGuardBlock(inline);
      // Injeta SUPABASE_URL e _supaRaw (que normalmente vem do bloco SUPA)
      // no contexto antes de executar o WRITE-GUARD block.
      vm.runInContext(`var SUPABASE_URL = ${JSON.stringify(supabaseUrl)};`, sandbox);
      vm.runInContext(`var _supaRaw = supabase.createClient(SUPABASE_URL, 'fake-key', { auth: {} });`, sandbox);
      try {
        vm.runInContext(guardBlock, sandbox, { filename: 'write-guard.js' });
      } catch (e) {
        return reject(new Error('WRITE-GUARD lançou erro ao inicializar: ' + e.message));
      }
      resolve({ sandbox, fakeSupa, guardBlock, inline });
    }).catch(reject);
  });
}

// -----------------------------------------------------------------------------
// Testes
// -----------------------------------------------------------------------------

test('http.server responde em :8765 e index.html contém o WRITE-GUARD', async () => {
  const { body } = await fetchIndexHtml();
  assert.equal(typeof body, 'string');
  assert.ok(body.length > 1000, 'index.html muito curto');
  assert.match(body, /=== WRITE-GUARD/);
  assert.match(body, /_GUARD_BLOCK_WRITES/);
});

test('extrai o bloco WRITE-GUARD do script inline', async () => {
  const { body } = await fetchIndexHtml();
  const inlineMatch = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g.exec(body);
  const inline = inlineMatch[1];
  const block = extractWriteGuardBlock(inline);
  assert.ok(block.includes('_GUARD_BLOCK_WRITES'), 'bloco não contém a flag de ativação');
  assert.ok(block.includes('Promise.reject'), 'bloco não usa Promise.reject');
  assert.ok(block.includes('new Proxy'), 'bloco não usa Proxy');
  // não deve englobar o bloco AUTH
  assert.equal(block.includes('=== AUTH'), false, 'bloco vazou para AUTH');
});

test('LOCALHOST + PRODUÇÃO: insert/update/delete/upsert/rpc bloqueados', async () => {
  const { sandbox } = await runGuardInSandbox({
    hostname: 'localhost',
    supabaseUrl: 'https://bhgifjrfagkzubpyqpew.supabase.co',
  });
  // O bloco define `supa` no escopo do contexto
  const ops = ['insert', 'update', 'delete', 'upsert'];
  for (const op of ops) {
    const qb = vm.runInContext(`supa.from('qualquer')`, sandbox);
    let thrown = null;
    try {
      await qb[op]({ foo: 'bar' });
    } catch (e) {
      thrown = e;
    }
    assert.ok(thrown, `${op} deveria lançar erro (rejeitar)`);
    // vm: a Error do sandbox é uma Error do vm context, não do host —
    // `instanceof Error` falha. Validamos por constructor.name e message.
    assert.equal(thrown && thrown.constructor && thrown.constructor.name, 'Error',
      `${op} não lançou Error: ctor=${thrown && thrown.constructor && thrown.constructor.name}`);
    assert.match(thrown.message, /WRITE-GUARD/, `${op} não retornou erro WRITE-GUARD`);
  }
  // rpc
  let rpcThrown = null;
  try {
    await vm.runInContext(`supa.rpc('qualquer', {})`, sandbox);
  } catch (e) {
    rpcThrown = e;
  }
  assert.ok(rpcThrown, 'rpc deveria lançar erro');
  assert.equal(rpcThrown && rpcThrown.constructor && rpcThrown.constructor.name, 'Error',
    'rpc não lançou Error');
  assert.match(rpcThrown.message, /WRITE-GUARD/, 'rpc não retornou erro WRITE-GUARD');
});

test('LOCALHOST + PRODUÇÃO: select preservado (NÃO bloqueia)', async () => {
  const { sandbox, fakeSupa } = await runGuardInSandbox({
    hostname: 'localhost',
    supabaseUrl: 'https://bhgifjrfagkzubpyqpew.supabase.co',
  });
  fakeSupa._calls.length = 0;
  // .select() deve passar para o cliente real (sem rejeitar)
  const sel = vm.runInContext(`supa.from('usuarios')`, sandbox);
  const res = await sel.select('*');
  assert.equal(res && typeof res, 'object', 'select deve devolver objeto');
  // verifica que a chamada chegou no fake client
  const fromCalls = fakeSupa._calls.filter(c => c.op === 'from');
  assert.ok(fromCalls.length >= 1, 'from() não chegou no fake client');
  const selectCalls = fakeSupa._calls.filter(c => c.op === 'select');
  assert.ok(selectCalls.length >= 1, 'select() não chegou no fake client');
});

test('LOCALHOST + PRODUÇÃO: auth preservado (NÃO bloqueia)', async () => {
  const { sandbox, fakeSupa } = await runGuardInSandbox({
    hostname: 'localhost',
    supabaseUrl: 'https://bhgifjrfagkzubpyqpew.supabase.co',
  });
  fakeSupa._calls.length = 0;
  // auth.getSession deve passar para o cliente real
  const authSession = await vm.runInContext(`supa.auth.getSession()`, sandbox);
  assert.equal(authSession && typeof authSession, 'object', 'auth.getSession deve devolver objeto');
  const authCalls = fakeSupa._calls.filter(c => c.op === 'auth.getSession');
  assert.ok(authCalls.length >= 1, 'auth.getSession não chegou no fake client');
});

test('PRODUÇÃO REAL (github.io): guarda NÃO ativa, writes passam normal', async () => {
  const { sandbox, fakeSupa } = await runGuardInSandbox({
    hostname: 'grupoterrabranca.github.io',
    supabaseUrl: 'https://bhgifjrfagkzubpyqpew.supabase.co',
  });
  fakeSupa._calls.length = 0;
  // insert NÃO deve ser bloqueado
  const qb = vm.runInContext(`supa.from('qualquer')`, sandbox);
  const res = await qb.insert({ foo: 'bar' });
  assert.equal(res && res.error, null, 'insert não deveria bloquear em produção real');
  const insertCalls = fakeSupa._calls.filter(c => c.op === 'insert');
  assert.ok(insertCalls.length >= 1, 'insert não chegou no fake client em produção real');
  // rpc também não
  const rpcRes = await vm.runInContext(`supa.rpc('qualquer', {})`, sandbox);
  assert.equal(rpcRes && rpcRes.error, null, 'rpc não deveria bloquear em produção real');
});

test('LOCALHOST + STAGING (URL diferente): guarda NÃO ativa', async () => {
  // Cenário futuro: app local apontando para Supabase de staging.
  // A guarda NÃO pode bloquear — staging é justamente onde se testa writes.
  const { sandbox, fakeSupa } = await runGuardInSandbox({
    hostname: 'localhost',
    supabaseUrl: 'https://abcdefghijk.supabase.co', // staging fictício
  });
  fakeSupa._calls.length = 0;
  const qb = vm.runInContext(`supa.from('qualquer')`, sandbox);
  const res = await qb.insert({ foo: 'bar' });
  assert.equal(res && res.error, null, 'insert não deveria bloquear com URL de staging');
  const insertCalls = fakeSupa._calls.filter(c => c.op === 'insert');
  assert.ok(insertCalls.length >= 1, 'insert não chegou no fake client em staging');
});

test('127.0.0.1 + PRODUÇÃO: também bloqueia (hostname alternativo)', async () => {
  const { sandbox } = await runGuardInSandbox({
    hostname: '127.0.0.1',
    supabaseUrl: 'https://bhgifjrfagkzubpyqpew.supabase.co',
  });
  const qb = vm.runInContext(`supa.from('qualquer')`, sandbox);
  let thrown = null;
  try {
    await qb.insert({ foo: 'bar' });
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown, 'insert deveria lançar erro em 127.0.0.1');
  assert.equal(thrown && thrown.constructor && thrown.constructor.name, 'Error',
    'não lançou Error');
  assert.match(thrown.message, /WRITE-GUARD/);
});
