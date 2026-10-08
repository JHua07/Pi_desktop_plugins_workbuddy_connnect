#!/usr/bin/env node
'use strict';
const { mkdir, open, readFile } = require('node:fs/promises');
const { randomBytes } = require('node:crypto');
const { join } = require('node:path');
const { resolveDshHome } = require('./home.cjs');

async function localKey() {
  const dir = resolveDshHome();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, 'local-api-key');
  let file;
  try { file = await open(path, 'wx', 0o600); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  if (file) {
    try { await file.writeFile(randomBytes(32).toString('base64url') + '\n'); }
    finally { await file.close(); }
  }
  // A concurrent first launch may have opened but not finished writing the key.
  for (let i = 0; i < 20; i++) {
    const key = (await readFile(path, 'utf8')).trim();
    if (/^[A-Za-z0-9_-]{43}$/.test(key)) return key;
    if (key) throw new Error('Invalid local-api-key file; stop the bridge and remove this file to regenerate it');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Local API key is empty; stop the bridge and remove local-api-key to regenerate it');
}
function configuredPort() {
  const value = process.env.PI_WORKBUDDY_PORT ?? '18765';
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('PI_WORKBUDDY_PORT must be an integer from 1 to 65535');
  return Number(value);
}
async function main(args = process.argv.slice(2)) {
  const command = args[0] || 'help';
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log('PI WorkBuddy Connect\n\n  node bridge/cli.cjs start                 Run foreground bridge with automatic refresh\n  node bridge/cli.cjs automation install    Enable Windows login startup and start now\n  node bridge/cli.cjs automation status     Show login task status\n  node bridge/cli.cjs automation stop       Stop background bridge (startup kept)\n  node bridge/cli.cjs automation start      Start background bridge again\n  node bridge/cli.cjs automation uninstall  Stop and remove login startup (keys preserved)\n  node bridge/cli.cjs service               Show live bridge and automatic refresh status\n  node bridge/cli.cjs key                   Print LOCAL API key for PI model settings\n  node bridge/cli.cjs status                Read both desktop login summaries\n  node bridge/cli.cjs models workbuddy      Fetch domestic model IDs\n  node bridge/cli.cjs models workbuddy-ai   Fetch international model IDs\n\nRequires Node >=22.19. No commands send a paid chat request.\nThe running bridge automatically checks sign-in and refreshes tokens/catalogs.');
    console.log('  node bridge/cli.cjs ui                    Open authorized local dashboard; start bridge if needed');
    return;
  }
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 19)) throw new Error('Node >=22.19 is required');
  if (command === 'key') { console.log(await localKey()); return; }
  if (command === 'ui') {
    await require('./ui-launcher.cjs').openDashboard({key:await localKey(),port:configuredPort()});
    return;
  }
  if (command === 'automation') {
    await require('./automation.cjs').manageAutomation(args[1], configuredPort());
    return;
  }
  if (command === 'service') {
    const response = await fetch(`http://127.0.0.1:${configuredPort()}/healthz`, {
      headers: { Authorization: 'Bearer ' + await localKey() }, signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`Bridge health check failed (HTTP ${response.status}); check port and data directory.`);
    const state = await response.json();
    if (state.service !== 'pi-workbuddy-connect') throw new Error('Port belongs to another service.');
    console.log(JSON.stringify(state, null, 2));
    return;
  }
  if (!['start', 'status', 'models'].includes(command)) throw new Error('Unknown command; use --help');
  const { startBridge, createRuntime } = require('./server.cjs');
  const { WORKBUDDY_VARIANTS } = require('./core.cjs');
  if (command === 'status') {
    const summaries = [];
    for (const variant of WORKBUDDY_VARIANTS) {
      const runtime = createRuntime(variant);
      summaries.push({ product: variant.id, ...(await runtime.store.status()) });
    }
    console.log(JSON.stringify(summaries, null, 2));
    return;
  }
  if (command === 'models') {
    const variant = WORKBUDDY_VARIANTS.find(v => v.id === (args[1] || 'workbuddy'));
    if (!variant) throw new Error('Use workbuddy or workbuddy-ai');
    const runtime = createRuntime(variant);
    const rows = await runtime.models();
    console.log(JSON.stringify({ product: variant.id, catalog_source: runtime.source(), models: rows }, null, 2));
    return;
  }
  const bridge = await startBridge({ key: await localKey(), port: configuredPort(), autoRefresh: true });
  console.log(`Local bridge listening on 127.0.0.1:${bridge.port}\nWorkBuddy:    http://127.0.0.1:${bridge.port}/workbuddy/v1\nWorkBuddy AI: http://127.0.0.1:${bridge.port}/workbuddy-ai/v1\nRun "node bridge/cli.cjs key" for the local API key.\nAutomatic login checks every minute; catalog cache refreshes every five minutes.\nNo paid chat requests are sent automatically.\nForeground mode: Keep this terminal open. Ctrl+C to stop. For background mode use automation install.`);
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await bridge.close(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
if (require.main === module) main().catch(error => {
  // Key is printed only by the explicit key command, never by a startup error.
  console.error(error.code === 'EADDRINUSE' ? 'Bridge port is occupied. Stop the other instance or set PI_WORKBUDDY_PORT.' : (error.message || 'Bridge failed'));
  process.exitCode = 1;
});
module.exports = { main, localKey, configuredPort };
