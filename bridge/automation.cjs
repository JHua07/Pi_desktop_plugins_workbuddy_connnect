'use strict';
const { writeFile, readFile, mkdir } = require('node:fs/promises');
const { execFileSync } = require('node:child_process');
const { join, resolve } = require('node:path');
const { resolveDshHome } = require('./home.cjs');
const ENV_NAMES = ['WORKBUDDY_AUTH_FILE','WORKBUDDY_AI_AUTH_FILE','WORKBUDDY_ELECTRON_BIN','WORKBUDDY_AI_ELECTRON_BIN'];
function automationConfig({ home, port, nodePath = process.execPath, cliPath = join(__dirname, 'cli.cjs'), environment = process.env }) {
  const env = { PI_WORKBUDDY_HOME: resolve(home), PI_WORKBUDDY_PORT: String(port) };
  for (const name of ENV_NAMES) if (environment[name]?.trim()) env[name] = environment[name];
  return { version: 1, nodePath: resolve(nodePath), cliPath: resolve(cliPath), environment: env };
}
async function shutdownManaged(configPath) {
  let config;
  try { config = JSON.parse(await readFile(configPath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const port = Number(config.environment.PI_WORKBUDDY_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid stored bridge port');
  let key;
  try { key = (await readFile(join(config.environment.PI_WORKBUDDY_HOME, 'local-api-key'), 'utf8')).trim(); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const base = `http://127.0.0.1:${port}`;
  let health;
  try { health = await fetch(base + '/healthz', { headers: { Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(3000) }); }
  catch (error) { if (error.cause?.code === 'ECONNREFUSED') return; throw new Error('Cannot verify the managed listener; no process was killed.'); }
  if (!health.ok) throw new Error('Listener identity or local key mismatch; refusing to stop it.');
  const identity = await health.json();
  if (identity.service !== 'pi-workbuddy-connect') throw new Error('Listener identity or local key mismatch; refusing to stop it.');
  // Migration must not stop a new PI-owned listener after removing the old task.
  if (identity.owner === 'pi-plugin') return;
  const response = await fetch(base + '/shutdown', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error('This bridge cannot shut down through the management API. Stop its old foreground terminal once, then retry.');
  await response.text();
  await new Promise(r => setTimeout(r, 300));
}
async function manageAutomation(operation, port) {
  if (process.platform !== 'win32') throw new Error('Login automation currently supports Windows only; use start on other platforms.');
  if (!['install','uninstall','start','stop','status'].includes(operation)) throw new Error('Use automation install|status|start|stop|uninstall');
  const home = resolveDshHome();
  const configPath = join(home, 'automation.json');
  const powershell = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const runTask = action => execFileSync(powershell, ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(__dirname, 'windows-task.ps1'),'-Operation',action,'-ConfigPath',configPath], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  try {
    if (operation === 'install') {
      if (runTask('status').trim() !== 'not-installed') {
        runTask('stop');
        await shutdownManaged(configPath);
      }
      await mkdir(home, { recursive: true, mode: 0o700 });
      await writeFile(configPath, JSON.stringify(automationConfig({ home, port }), null, 2) + '\n', { mode: 0o600 });
    }
    const output = runTask(operation);
    if (operation === 'stop' || operation === 'uninstall') await shutdownManaged(configPath);
    if (operation === 'install' || operation === 'uninstall') {
      execFileSync(powershell, ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(__dirname,'desktop-shortcut.ps1'),'-Operation',operation === 'install' ? 'install' : 'remove','-ConfigPath',configPath], {windowsHide:true,timeout:15000});
    }
    process.stdout.write(output);
  } catch (error) {
    if (error.stderr) process.stderr.write(error.stderr.toString());
    throw new Error(error.stderr ? 'Windows task operation failed; unrelated tasks were preserved.' : error.message);
  }
}
module.exports = { automationConfig, manageAutomation, shutdownManaged };
