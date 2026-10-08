'use strict';
const { createServer } = require('node:http');
const { timingSafeEqual } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const core = require('./core.cjs');

const STATUS = { hard_credit: 402, soft_rate: 429, session_dead: 401, not_found: 502, server: 502, client: 400 };
function json(res, status, value) {
  const data = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store' });
  res.end(data);
}
function fail(res, status, code, message) { json(res, status, { error: { type: code, code, message } }); }
function bearerMatches(header, key) {
  if (typeof header !== 'string') return false;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  if (!match) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(key);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const cleanup = () => { req.off('data', data); req.off('end', end); req.off('error', error); req.off('aborted', aborted); };
    const error = (err) => { cleanup(); reject(err); };
    const aborted = () => error(new Error('Request aborted'));
    const data = (chunk) => {
      size += chunk.length;
      if (size > limit) { req.pause(); error(Object.assign(new Error('Request body too large'), { status: 413 })); return; }
      chunks.push(chunk);
    };
    const end = () => { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')); };
    req.on('data', data); req.on('end', end); req.on('error', error); req.on('aborted', aborted);
  });
}

// Only metadata and public catalog rows cross the local HTTP boundary, never credentials.
function modelRows(models, variant) {
  return models.map(m => ({ id: m.id, object: 'model', created: 0, owned_by: variant,
    name: m.name, context_window: m.contextWindow, max_tokens: m.maxTokens,
    supports_images: m.supportsImages, reasoning: m.reasoning }));
}
function createRuntime(variant, dependencies = {}) {
  const client = dependencies.client || new core.WorkBuddyUpstreamClient();
  const store = dependencies.store || new core.WorkBuddyCredentialStore({
    variant,
    keyProvider: core.atRestKeyProviderFor(variant),
    refresh: c => client.refreshToken(c)
  });
  const fallback = variant.region === 'cn' ? core.FALLBACK_WORKBUDDY_MODELS : core.FALLBACK_WORKBUDDY_AI_MODELS;
  const saved = dependencies.saved || new core.WorkBuddyCatalogStore({ path: require('node:path').join(require('./home.cjs').resolveDshHome(), variant.catalogFilename) });
  const catalog = new core.WorkBuddyCatalog(fallback);
  let account, updatedAt = 0, inflight, source = 'builtin', fetchedAt = 0, refreshFailed = false;
  async function models(force = false) {
    if (force) updatedAt = 0;
    const credential = await store.resolve();
    const identity = JSON.stringify([credential.uid, credential.enterpriseId || '']);
    if (account !== identity) {
      account = identity; updatedAt = 0;
      const previous = saved.get(identity);
      catalog.set(previous?.models || fallback);
      source = previous ? 'saved' : 'builtin';
      fetchedAt = previous?.fetchedAtMs || 0;
      refreshFailed = false;
    }
    if (Date.now() - updatedAt > 5 * 60 * 1000) {
      // Single-flight within an account. Never return an old account's async fetch.
      if (!inflight || inflight.account !== identity) {
        const promise = (async () => {
          try {
            const rows = await client.fetchModels(credential);
            saved.set(identity, { models: rows, fetchedAtMs: Date.now(), source: 'upstream' });
            if (account === identity) { catalog.set(rows); source = 'upstream'; fetchedAt = Date.now(); refreshFailed = false; }
          } catch {
            if (account === identity) { source = source === 'builtin' ? 'builtin' : 'saved'; refreshFailed = true; }
          }
          if (account === identity) updatedAt = Date.now();
        })();
        inflight = { account: identity, promise };
      }
      const flight = inflight;
      await flight.promise;
      if (inflight === flight) inflight = undefined;
      if (account !== identity) return models();
    }
    return catalog.current();
  }
  return { variant, store, client, models, source: () => source,
    catalogStatus: () => ({ modelCount: catalog.current().length, catalogSource: source, checkedAt: updatedAt, catalogFetchedAt: fetchedAt, catalogRefreshFailed: refreshFailed }) };
}

// WorkBuddy requires upstream SSE even for non-streaming OpenAI callers.
async function collectCompletion(response, model) {
  if (!response.body) throw new Error('Empty upstream response');
  let pending = '', size = 0, done = false;
  const result = { id: 'workbuddy-completion', object: 'chat.completion', created: Math.floor(Date.now() / 1000), model, choices: [] };
  const choices = new Map();
  function event(block) {
    const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
    if (!data) return;
    if (data.trim() === '[DONE]') { done = true; return; }
    const chunk = JSON.parse(data);
    if (chunk.error) throw new Error('Upstream stream returned an error');
    if (chunk.id) result.id = chunk.id;
    if (chunk.model) result.model = chunk.model;
    if (chunk.usage) result.usage = chunk.usage;
    for (const c of chunk.choices || []) {
      const index = c.index ?? 0;
      if (!choices.has(index)) choices.set(index, { index, message: { role: 'assistant', content: '' }, finish_reason: null });
      const target = choices.get(index);
      const delta = c.delta || {};
      if (typeof delta.content === 'string') target.message.content += delta.content;
      if (typeof delta.reasoning_content === 'string') target.message.reasoning_content = (target.message.reasoning_content || '') + delta.reasoning_content;
      for (const t of delta.tool_calls || []) {
        target.message.tool_calls ||= [];
        const i = t.index ?? 0;
        const call = target.message.tool_calls[i] ||= { id: '', type: 'function', function: { name: '', arguments: '' } };
        if (t.id) call.id = t.id;
        if (t.type) call.type = t.type;
        if (t.function?.name) call.function.name += t.function.name;
        if (t.function?.arguments) call.function.arguments += t.function.arguments;
      }
      if (c.finish_reason != null) target.finish_reason = c.finish_reason;
    }
  }
  const decoder = new TextDecoder();
  for await (const bytes of response.body) {
    size += bytes.length;
    if (size > 32 * 1024 * 1024) throw new Error('Upstream completion too large');
    pending += decoder.decode(bytes, { stream: true }).replace(/\r/g, '');
    let end;
    while ((end = pending.indexOf('\n\n')) >= 0) { event(pending.slice(0, end)); pending = pending.slice(end + 2); }
  }
  pending += decoder.decode();
  if (pending.trim()) event(pending);
  if (!done && ![...choices.values()].some(c => c.finish_reason !== null)) throw new Error('Incomplete upstream completion');
  result.choices = [...choices.values()].sort((a, b) => a.index - b.index);
  return result;
}

async function startBridge({ key, port = 18765, runtimes, maxBodyBytes = 32 * 1024 * 1024, timeoutMs = 180000, autoRefresh = false, refreshIntervalMs = 60000, dashboardSystem, dashboardNow, owner = 'standalone' } = {}) {
  if (typeof key !== 'string' || key.length < 32) throw new Error('Local API key must have at least 32 characters');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const products = runtimes || core.WORKBUDDY_VARIANTS.map(createRuntime);
  const active = new Set();
  const refreshState = {};
  let refreshing = false, closing = false, refreshTimer;
  async function refreshProducts() {
    if (refreshing || closing) return;
    refreshing = true;
    try {
      await Promise.all(products.map(async runtime => {
        try {
          const status = await runtime.store.status();
          if (status.state !== 'signed-in') {
            refreshState[runtime.variant.id] = { state: 'signed-out', reasonCode: status.reasonCode || 'no-credential', checkedAt: Date.now() };
            return;
          }
          const rows = await runtime.models();
          const detail = runtime.catalogStatus?.() || {};
          refreshState[runtime.variant.id] = { state: detail.catalogRefreshFailed ? 'catalog-stale' : 'ready', modelCount: rows.length, catalogSource: runtime.source(), checkedAt: Date.now(), ...detail };
        } catch {
          refreshState[runtime.variant.id] = { state: 'refresh-failed', checkedAt: Date.now() };
        }
      }));
    } finally { refreshing = false; }
  }
  const server = createServer((req, res) => {
    void handle(req, res).catch(() => {
      if (!res.headersSent) fail(res, 500, 'internal_error', 'Local bridge request failed');
      else res.destroy();
    });
  });
  const dashboard = require('./dashboard.cjs').createDashboard({
    getKey: () => ({value:key,matches:header=>bearerMatches(header,key)}),
    rotateKey: async (value, save) => { await save(value); key = value; },
    products, getService: () => ({ok:true,autoRefresh,owner,products:refreshState}),
    port:()=>server.address()?.port, stop:closeBridge, system:dashboardSystem, now:dashboardNow
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  async function handle(req, res) {
    if (!core.hostIsLoopback(req.headers.host) || !core.originIsLoopback(req.headers.origin)) {
      fail(res, 403, 'forbidden_origin', 'Only loopback Host and Origin are allowed'); return;
    }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (await dashboard.handle(req,res,url)) return;
    if (!bearerMatches(req.headers.authorization, key)) { fail(res, 401, 'unauthorized', 'Missing or invalid local API key'); return; }
    if (url.pathname === '/shutdown' && req.method === 'POST') {
      if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) { fail(res, 415, 'unsupported_media_type', 'Content-Type must be application/json'); return; }
      json(res, 200, { ok: true, stopping: true });
      setImmediate(() => void closeBridge());
      return;
    }
    if (url.pathname === '/healthz' && req.method === 'GET') { json(res, 200, { ok: true, service: 'pi-workbuddy-connect', autoRefresh, owner, products: refreshState }); return; }
    const match = /^\/(workbuddy|workbuddy-ai)\/(v1\/models|v1\/chat\/completions|status)\/?$/.exec(url.pathname);
    if (!match) { fail(res, 404, 'not_found', 'Unknown bridge endpoint'); return; }
    const runtime = products.find(p => p.variant.id === match[1]);
    if (!runtime) { fail(res, 404, 'not_found', 'Product is not configured'); return; }
    if (req.method === 'GET' && match[2] === 'status') { json(res, 200, await runtime.store.status()); return; }
    if (req.method === 'GET' && match[2] === 'v1/models') {
      let rows;
      try { rows = await runtime.models(); } catch { fail(res, 401, 'not_signed_in', 'Sign in to the matching WorkBuddy desktop app, or use the status command for diagnostics'); return; }
      json(res, 200, { object: 'list', data: modelRows(rows, runtime.variant.id), catalog_source: runtime.source() }); return;
    }
    if (req.method !== 'POST' || match[2] !== 'v1/chat/completions') { fail(res, 405, 'method_not_allowed', 'Unsupported method'); return; }
    if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) { fail(res, 415, 'unsupported_media_type', 'Content-Type must be application/json'); return; }
    let input;
    try {
      input = JSON.parse(await readBody(req, maxBodyBytes));
      if (!input || Array.isArray(input) || typeof input !== 'object' || typeof input.model !== 'string' || !input.model.trim() || !Array.isArray(input.messages) || input.messages.length === 0) throw new Error('invalid chat');
      if (input.stream !== undefined && typeof input.stream !== 'boolean') throw new Error('invalid stream');
    } catch (error) {
      if (error.status === 413) res.setHeader('Connection', 'close');
      fail(res, error.status || 400, 'invalid_request', error.status === 413 ? 'Request body too large' : 'Expected a JSON chat request with model and messages'); return;
    }
    const controller = new AbortController();
    active.add(controller);
    const disconnect = () => { if (!res.writableFinished) controller.abort(); };
    res.on('close', disconnect);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
    try {
      let credential;
      try { credential = await runtime.store.resolve(); } catch { fail(res, 401, 'not_signed_in', 'WorkBuddy login is unavailable or expired; run the status command'); return; }
      const result = await runtime.client.chatStream(credential, core.prepareChatBody(JSON.stringify(input)), signal);
      if (!result.ok) {
        // Do not expose raw upstream documents or token-bearing diagnostics.
        fail(res, STATUS[result.kind] || 502, result.kind, `WorkBuddy request failed (${result.kind}); check account login, credits and model ID`); return;
      }
      if (!result.response.body) { fail(res, 502, 'upstream_error', 'WorkBuddy returned no response body'); return; }
      if (input.stream !== true) {
        const completion = await collectCompletion(result.response, input.model);
        if (!res.destroyed) json(res, 200, completion);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        await pipeline(Readable.fromWeb(result.response.body), res, { signal });
      }
    } catch {
      if (!res.headersSent && !res.destroyed) fail(res, 502, 'upstream_error', 'WorkBuddy response interrupted or timed out');
      else res.destroy();
    } finally { active.delete(controller); res.off('close', disconnect); }
  }
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  if (autoRefresh) {
    if (!Number.isInteger(refreshIntervalMs) || refreshIntervalMs < 10) { await new Promise(resolve => server.close(resolve)); throw new Error('Invalid refresh interval'); }
    void refreshProducts();
    refreshTimer = setInterval(() => void refreshProducts(), refreshIntervalMs);
    refreshTimer.unref();
  }
  async function closeBridge() {
    if (closing) return;
    closing = true;
    dashboard.clear();
    clearInterval(refreshTimer);
    for (const controller of active) controller.abort();
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
  return { port: server.address().port, products, close: closeBridge, isRunning: () => !closing && server.listening };
}
module.exports = { startBridge, createRuntime, bearerMatches, collectCompletion };
