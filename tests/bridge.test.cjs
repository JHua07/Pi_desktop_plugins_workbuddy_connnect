'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { mkdtemp, writeFile, readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const { startBridge, createRuntime, collectCompletion, bearerMatches } = require('../bridge/server.cjs');
const core = require('../bridge/core.cjs');
const KEY = 'test-local-api-key-'.padEnd(43, 'x');
const event = value => `data: ${JSON.stringify(value)}\n\n`;
const textSSE = event({ id: 'chat-1', choices: [{ index: 0, delta: { content: '你好' } }] }) + event({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { total_tokens: 4 } }) + 'data: [DONE]\n\n';
function mockRuntime(id) {
  const calls = [];
  return { variant: { id }, calls,
    store: { resolve: async () => ({ accessToken: 'secret-upstream-token', uid: id }), status: async () => ({ state: 'signed-in', nickname: 'fixture' }) },
    models: async () => [{ id: id + '-model', name: 'Fixture', contextWindow: 10000, maxTokens: 1000, supportsImages: true }], source: () => 'upstream',
    client: { chatStream: async (credential, body, signal) => { calls.push({ credential, body: JSON.parse(body), signal }); return { ok: true, response: new Response(textSSE) }; } }
  };
}
function request(port, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method,
      headers: { Authorization: 'Bearer ' + KEY, ...headers } }, res => {
      const chunks = [];
      res.on('data', data => chunks.push(data)); res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject); req.end(body);
  });
}
const chatBody = (extra = {}) => JSON.stringify({ model: 'fixture', messages: [{ role: 'user', content: 'hi' }], stream: true, ...extra });
const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

test('HTTP bridge protocol and security', async t => {
  const cn = mockRuntime('workbuddy'), ai = mockRuntime('workbuddy-ai');
  const bridge = await startBridge({ key: KEY, port: 0, runtimes: [cn, ai], maxBodyBytes: 2048 });
  t.after(() => bridge.close());
  await t.test('startup makes no upstream request', () => { assert.equal(cn.calls.length + ai.calls.length, 0); });
  await t.test('all endpoints require the independent local bearer', async () => {
    for (const path of ['/healthz', '/workbuddy/v1/models', '/workbuddy/status']) {
      assert.equal((await request(bridge.port, path, { headers: { Authorization: '' } })).status, 401);
      assert.equal((await request(bridge.port, path, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
    }
    assert.equal((await request(bridge.port, '/healthz')).status, 200);
  });
  await t.test('host rebinding and remote browser origin rejected', async () => {
    assert.equal((await request(bridge.port, '/healthz', { headers: { Host: 'attacker.example' } })).status, 403);
    assert.equal((await request(bridge.port, '/healthz', { headers: { Origin: 'https://attacker.example' } })).status, 403);
  });
  await t.test('domestic and international catalogs isolated', async () => {
    for (const id of ['workbuddy', 'workbuddy-ai']) {
      const res = await request(bridge.port, `/${id}/v1/models`);
      const value = JSON.parse(res.text);
      assert.equal(value.data[0].id, id + '-model');
      assert.equal(value.catalog_source, 'upstream');
      assert.ok(!res.text.includes('secret-upstream-token'));
    }
  });
  await t.test('status contains a safe login summary', async () => {
    const res = await request(bridge.port, '/workbuddy/status');
    assert.deepEqual(JSON.parse(res.text), { state: 'signed-in', nickname: 'fixture' });
    assert.equal(res.headers['cache-control'], 'no-store');
  });
  await t.test('invalid JSON, chat schema and content type rejected before upstream', async () => {
    const count = cn.calls.length;
    for (const body of ['{', 'null', '{}', chatBody({ messages: [] }), chatBody({ stream: 'true' })]) {
      assert.equal((await request(bridge.port, '/workbuddy/v1/chat/completions', post(body))).status, 400);
    }
    assert.equal((await request(bridge.port, '/workbuddy/v1/chat/completions', { method: 'POST', body: chatBody() })).status, 415);
    assert.equal((await request(bridge.port, '/workbuddy/v1/chat/completions', post(chatBody({ pad: 'x'.repeat(2100) })))).status, 413);
    assert.equal(cn.calls.length, count);
  });
  await t.test('stream is forwarded intact and international route uses own account', async () => {
    const res = await request(bridge.port, '/workbuddy-ai/v1/chat/completions', post(chatBody()));
    assert.equal(res.status, 200); assert.equal(res.text, textSSE);
    assert.match(res.headers['content-type'], /text\/event-stream/);
    assert.equal(ai.calls[0].credential.uid, 'workbuddy-ai');
    assert.equal(ai.calls[0].signal.aborted, false, 'request body completion must not cancel a chat');
  });
  await t.test('developer role, named tool choice, tool history and image messages survive protocol normalization', async () => {
    const messages = [{ role: 'developer', content: 'system' }, { role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }] },
      { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'read', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'call-1', content: 'done' }];
    const tools = [{ type: 'function', function: { name: 'read', parameters: { type: 'object' } } }];
    const res = await request(bridge.port, '/workbuddy/v1/chat/completions', post(chatBody({ messages, tools, tool_choice: { type: 'function', function: { name: 'read' } } })));
    assert.equal(res.status, 200);
    const sent = cn.calls.at(-1).body;
    assert.equal(sent.messages[0].role, 'system'); assert.equal(sent.tool_choice, 'read');
    assert.deepEqual(sent.messages.slice(1), messages.slice(1)); assert.deepEqual(sent.tools, tools);
  });
  await t.test('non-stream caller receives standard completion JSON', async () => {
    const res = await request(bridge.port, '/workbuddy/v1/chat/completions', post(chatBody({ stream: false })));
    const value = JSON.parse(res.text);
    assert.equal(res.status, 200); assert.equal(value.object, 'chat.completion'); assert.equal(value.choices[0].message.content, '你好');
    assert.equal(value.choices[0].finish_reason, 'stop'); assert.equal(value.usage.total_tokens, 4);
    assert.equal(cn.calls.at(-1).body.stream, true);
  });
  await t.test('upstream business errors mapped and raw token data hidden', async () => {
    const original = cn.client.chatStream;
    for (const [kind, status] of [['hard_credit', 402], ['soft_rate', 429], ['session_dead', 401], ['server', 502]]) {
      cn.client.chatStream = async () => ({ ok: false, kind, status: 403, message: 'secret-upstream-token' });
      const res = await request(bridge.port, '/workbuddy/v1/chat/completions', post(chatBody()));
      assert.equal(res.status, status); assert.ok(!res.text.includes('secret-upstream-token'));
    }
    cn.client.chatStream = original;
  });
  await t.test('missing credentials yield an explicit login error', async () => {
    const original = cn.store.resolve;
    cn.store.resolve = async () => { throw new Error('do not expose secrets'); };
    const res = await request(bridge.port, '/workbuddy/v1/chat/completions', post(chatBody()));
    assert.equal(res.status, 401); assert.ok(!res.text.includes('secrets'));
    cn.store.resolve = original;
  });
});

test('non-stream SSE assembler handles split UTF-8 and tool arguments', async () => {
  const stream = event({ choices: [{ index: 0, delta: { content: '中文', tool_calls: [{ index: 0, id: 'call-1', function: { name: 'read', arguments: '{"path":' } }] } }] })
    + event({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '"a"}' } }] }, finish_reason: 'tool_calls' }] }) + 'data: [DONE]\n\n';
  const bytes = Buffer.from(stream);
  const response = new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i++) controller.enqueue(bytes.subarray(i, i + 1)); controller.close(); } }));
  const value = await collectCompletion(response, 'fixture');
  assert.equal(value.choices[0].message.content, '中文');
  assert.deepEqual(value.choices[0].message.tool_calls[0], { id: 'call-1', type: 'function', function: { name: 'read', arguments: '{"path":"a"}' } });
  await assert.rejects(() => collectCompletion(new Response(event({ choices: [{ delta: { content: 'unfinished' } }] })), 'fixture'), /Incomplete/);
});

test('disconnect cancels upstream request', async t => {
  const runtime = mockRuntime('workbuddy');
  let signal, called;
  const started = new Promise(resolve => { called = resolve; });
  runtime.client.chatStream = async (_, __, received) => {
    signal = received; called();
    return new Promise(resolve => { received.addEventListener('abort', () => resolve({ ok: false, kind: 'server', status: 0 }), { once: true }); });
  };
  const bridge = await startBridge({ key: KEY, port: 0, runtimes: [runtime] });
  t.after(() => bridge.close());
  const req = http.request({ hostname: '127.0.0.1', port: bridge.port, path: '/workbuddy/v1/chat/completions', method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' } });
  req.on('error', () => {}); req.end(chatBody());
  await started; req.destroy();
  for (let i = 0; i < 50 && !signal.aborted; i++) await new Promise(r => setTimeout(r, 10));
  assert.equal(signal.aborted, true);
});

test('credential adapter uses fixture files only, refreshes own copy, follows account switch', async () => {
  const dir = await mkdtemp(join(process.env.PI_SCRATCH_DIR || tmpdir(), 'wb-auth-test-'));
  const desktopPath = join(dir, 'desktop.json'), ownPath = join(dir, 'own.json');
  const original = JSON.stringify({ auth: { accessToken: 'fixture-old', refreshToken: 'fixture-refresh', expiresAt: Date.now() - 1, domain: 'https://copilot.tencent.com' }, account: { uid: 'fixture-user' } });
  await writeFile(desktopPath, original);
  let refreshes = 0;
  const store = new core.WorkBuddyCredentialStore({ variant: core.WORKBUDDY_VARIANTS[0], desktopPath, ownPath, refresh: async () => { refreshes++; return { accessToken: 'fixture-new', expiresInSec: 3600 }; } });
  const [one, two] = await Promise.all([store.resolve(), store.resolve()]);
  assert.equal(one.accessToken, 'fixture-new'); assert.equal(two.accessToken, 'fixture-new'); assert.equal(refreshes, 1);
  assert.equal(await readFile(desktopPath, 'utf8'), original);
  const status = await store.status(); assert.ok(!JSON.stringify(status).includes('fixture-new'));
  await writeFile(desktopPath, JSON.stringify({ auth: { accessToken: 'fixture-switched', expiresAt: Date.now() + 3600000, domain: 'https://copilot.tencent.com' }, account: { uid: 'another-user' } }));
  assert.equal((await store.resolve()).uid, 'another-user');
  const foreign = new core.WorkBuddyCredentialStore({ variant: core.WORKBUDDY_VARIANTS[1], desktopPath, ownPath: join(dir, 'foreign.json'), refresh: async () => { throw new Error('must not refresh'); } });
  assert.equal((await foreign.status()).reasonCode, 'credential-region-mismatch');
});

test('CLI isolated smoke: stable key, port validation, startup and no-login status', async t => {
  const dir = await mkdtemp(join(process.env.PI_SCRATCH_DIR || tmpdir(), 'wb-cli-test-'));
  const cli = join(__dirname, '../bridge/cli.cjs');
  const env = { ...process.env, PI_WORKBUDDY_HOME: dir, WORKBUDDY_AUTH_FILE: join(dir, 'missing-cn'), WORKBUDDY_AI_AUTH_FILE: join(dir, 'missing-ai') };
  const run = args => execFileSync(process.execPath, [cli, ...args], { env, encoding: 'utf8' });
  const key = run(['key']).trim(); assert.match(key, /^[A-Za-z0-9_-]{43}$/); assert.equal(run(['key']).trim(), key);
  const statuses = JSON.parse(run(['status'])); assert.equal(statuses.length, 2); assert.ok(statuses.every(s => s.state === 'signed-out'));
  assert.throws(() => execFileSync(process.execPath, [cli, 'start'], { env: { ...env, PI_WORKBUDDY_PORT: 'bad' }, stdio: 'pipe' }));
  // Reserve a free port and immediately release it for the CLI smoke test.
  const probe = await startBridge({ key: KEY, port: 0, runtimes: [] }); const port = probe.port; await probe.close();
  const child = spawn(process.execPath, [cli, 'start'], { env: { ...env, PI_WORKBUDDY_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { child.kill(); });
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CLI startup timeout')), 5000);
    child.stdout.on('data', data => { output += data; if (output.includes('Keep this terminal open')) { clearTimeout(timer); resolve(); } });
    child.once('error', e => { clearTimeout(timer); reject(e); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error('CLI exited ' + code)); });
  });
  assert.ok(!output.includes(key));
  const response = await fetch(`http://127.0.0.1:${port}/healthz`, { headers: { Authorization: 'Bearer ' + key } });
  assert.equal(response.status, 200);
  child.kill();
});

test('constant-time bearer helper rejects missing and mismatched keys', () => {
  assert.equal(bearerMatches(undefined, KEY), false); assert.equal(bearerMatches('Bearer short', KEY), false);
  assert.equal(bearerMatches('Bearer ' + KEY, KEY), true);
});

test('catalog refresh expires, retries, and follows account switches', async () => {
  const originalNow = Date.now;
  let now = originalNow(), uid = 'user-a', fetches = 0, unavailable = false;
  const cache = new Map();
  const runtime = createRuntime(core.WORKBUDDY_VARIANTS[0], {
    store: { resolve: async () => ({ uid }) },
    saved: { get: id => cache.get(id), set: (id, rows) => cache.set(id, rows) },
    client: { fetchModels: async credential => {
      fetches++;
      if (unavailable) throw new Error('catalog offline');
      return [{ id: credential.uid + '-model', name: 'fixture', contextWindow: 100, maxTokens: 10, supportsImages: false }];
    } }
  });
  Date.now = () => now;
  try {
    await Promise.all([runtime.models(), runtime.models()]);
    assert.equal(fetches, 1);
    await runtime.models(); assert.equal(fetches, 1);
    now += 300001; await runtime.models(); assert.equal(fetches, 2);
    unavailable = true; now += 300001;
    assert.equal((await runtime.models())[0].id, 'user-a-model');
    assert.equal(runtime.source(), 'saved', 'failed refresh must not claim a live upstream catalog');
    assert.equal(runtime.catalogStatus().catalogRefreshFailed, true);
    assert.equal(runtime.catalogStatus().modelCount, 1);
    unavailable = false; now += 300001; await runtime.models(); assert.equal(fetches, 4);
    uid = 'user-b'; assert.equal((await runtime.models())[0].id, 'user-b-model');
    assert.equal(runtime.catalogStatus().catalogRefreshFailed, false);
    assert.equal(runtime.source(), 'upstream');
    assert.equal(cache.size, 2);
  } finally { Date.now = originalNow; }
});

test('real runtime wires product-specific automatic Electron discovery like upstream DSH', () => {
  const expected = process.platform === 'win32' ? 'windows-workbuddy' : process.platform === 'darwin' ? 'macos-workbuddy' : 'none';
  for (const variant of core.WORKBUDDY_VARIANTS) {
    // Construction is I/O-free: do not execute helpers or read real credentials.
    const runtime = createRuntime(variant);
    assert.equal(runtime.store.keyProvider.discovery, expected);
    assert.equal(runtime.store.keyProvider.product.productName, variant.displayName);
    assert.equal(runtime.store.keyProvider.product.envVar, variant.electron.envVar);
  }
});

test('automatic refresh skips signed-out products, handles failures, recovers and stops its timer', async () => {
  const cn = mockRuntime('workbuddy'), ai = mockRuntime('workbuddy-ai');
  let ticks = 0, aiCalls = 0, failRefresh = true;
  ai.store.status = async () => ({ state: 'signed-out', reasonCode: 'no-credential' });
  ai.models = async () => { aiCalls++; return []; };
  cn.models = async () => { ticks++; if (failRefresh) throw new Error('private-token must not appear'); return [{ id: 'fixture' }]; };
  const bridge = await startBridge({ key: KEY, port: 0, runtimes: [cn, ai], autoRefresh: true, refreshIntervalMs: 20 });
  try {
    await new Promise(r => setTimeout(r, 15));
    const first = JSON.parse((await request(bridge.port, '/healthz')).text);
    assert.equal(first.autoRefresh, true);
    assert.equal(first.products.workbuddy.state, 'refresh-failed');
    assert.equal(first.products['workbuddy-ai'].state, 'signed-out');
    assert.ok(!JSON.stringify(first).includes('private-token'));
    failRefresh = false;
    await new Promise(r => setTimeout(r, 50));
    const second = JSON.parse((await request(bridge.port, '/healthz')).text);
    assert.equal(second.products.workbuddy.state, 'ready');
    assert.equal(second.products.workbuddy.modelCount, 1);
    assert.equal(aiCalls, 0);
    assert.equal(cn.calls.length, 0, 'automatic refresh must never send chat');
  } finally { await bridge.close(); }
  const stoppedTicks = ticks;
  await new Promise(r => setTimeout(r, 60));
  assert.equal(ticks, stoppedTicks);
});

test('automation config persists only absolute paths, port and allowlisted variables, never tokens', () => {
  const { automationConfig } = require('../bridge/automation.cjs');
  const config = automationConfig({ home: __dirname, port: 18765, environment: {
    WORKBUDDY_ELECTRON_BIN: 'D:\\Program Files\\WorkBuddy\\WorkBuddy.exe',
    WORKBUDDY_ACCESS_TOKEN: 'must-not-save', OPENAI_API_KEY: 'must-not-save', PATH: 'must-not-save'
  } });
  assert.equal(config.version, 1);
  assert.equal(config.environment.PI_WORKBUDDY_PORT, '18765');
  assert.equal(config.environment.WORKBUDDY_ELECTRON_BIN, 'D:\\Program Files\\WorkBuddy\\WorkBuddy.exe');
  assert.ok(!JSON.stringify(config).includes('must-not-save'));
  assert.ok(require('node:path').isAbsolute(config.nodePath));
  assert.ok(require('node:path').isAbsolute(config.cliPath));
});

test('shutdown management requires local bearer and JSON, then releases the listener', async () => {
  const bridge = await startBridge({ key: KEY, port: 0, runtimes: [] });
  try {
    assert.equal((await request(bridge.port, '/shutdown', { ...post('{}'), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong' } })).status, 401);
    assert.equal((await request(bridge.port, '/shutdown', { method: 'POST' })).status, 415);
    assert.equal((await request(bridge.port, '/healthz')).status, 200);
    assert.equal((await request(bridge.port, '/shutdown', post('{}'))).status, 200);
    await new Promise(r => setTimeout(r, 50));
    await assert.rejects(() => request(bridge.port, '/healthz'));
  } finally { await bridge.close(); }
});

test('automation shutdown uses persisted port and key without exposing them', async () => {
  const { shutdownManaged } = require('../bridge/automation.cjs');
  const home = await mkdtemp(join(process.env.PI_SCRATCH_DIR || tmpdir(), 'wb-managed-test-'));
  const bridge = await startBridge({ key: KEY, port: 0, runtimes: [] });
  const configPath = join(home, 'automation.json');
  await writeFile(join(home, 'local-api-key'), KEY);
  await writeFile(configPath, JSON.stringify({ environment: { PI_WORKBUDDY_HOME: home, PI_WORKBUDDY_PORT: bridge.port } }));
  try {
    await shutdownManaged(configPath);
    await assert.rejects(() => request(bridge.port, '/healthz'));
    await shutdownManaged(configPath); // Already stopped is a safe no-op.
  } finally { await bridge.close(); }
});

test('automatic health reports catalog cache fallback rather than fresh upstream success', async t => {
  let failed = false;
  const runtime = createRuntime(core.WORKBUDDY_VARIANTS[0], {
    store: { resolve: async () => ({ uid: 'fixture' }), status: async () => ({ state: 'signed-in' }) },
    saved: { get: () => undefined, set: () => {} },
    client: { fetchModels: async () => { if (failed) throw new Error('catalog offline'); return [{ id: 'fixture', name: 'Fixture', contextWindow: 100, maxTokens: 10, supportsImages: false }]; } }
  });
  const bridge = await startBridge({ key: KEY, port: 0, runtimes: [runtime], autoRefresh: true, refreshIntervalMs: 20 });
  t.after(() => bridge.close());
  await runtime.models();
  const fetchedAt = runtime.catalogStatus().catalogFetchedAt;
  failed = true; await runtime.models(true); await new Promise(r => setTimeout(r, 35));
  const state = JSON.parse((await request(bridge.port, '/healthz')).text).products.workbuddy;
  assert.equal(state.state, 'catalog-stale');
  assert.equal(state.catalogSource, 'saved');
  assert.equal(state.catalogFetchedAt, fetchedAt);
  assert.equal(state.modelCount, 1);
});
