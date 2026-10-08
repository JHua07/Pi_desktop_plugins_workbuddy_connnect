'use strict';
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { join } = require('node:path');
const { mkdir, writeFile, rename, unlink } = require('node:fs/promises');
const { randomBytes } = require('node:crypto');
const { resolveDshHome } = require('./home.cjs');
const run = promisify(execFile);
async function taskAction(operation, keepRunning = false) {
  const args = ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(__dirname,'windows-task.ps1'),'-Operation',operation,'-ConfigPath',join(resolveDshHome(),'automation.json')];
  if (keepRunning) args.push('-KeepRunning');
  const { stdout } = await run(join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'), args, { windowsHide:true, timeout:30000, maxBuffer:65536 });
  return stdout.trim();
}
async function automationStatus() {
  if (process.platform !== 'win32') return { state:'unsupported', enabled:false };
  try {
    const text = await taskAction('status');
    if (text === 'not-installed') return {state:text, enabled:false};
    const result = JSON.parse(text);
    return { state:result.state, enabled:result.enabled === true };
  } catch { return {state:'unavailable', enabled:false}; }
}
async function setAutomation(enabled, port) {
  if (process.platform !== 'win32') throw new Error('Windows only');
  if (enabled) {
    const home = resolveDshHome();
    await mkdir(home,{recursive:true,mode:0o700});
    const { automationConfig } = require('./automation.cjs');
    await writeFile(join(home,'automation.json'),JSON.stringify(automationConfig({home,port}),null,2)+'\n',{mode:0o600});
    await taskAction('install',true);
    await run(join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'), ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(__dirname,'desktop-shortcut.ps1'),'-Operation','install','-ConfigPath',join(home,'automation.json')], {windowsHide:true,timeout:15000});
  } else {
    // Disable the trigger, not the currently running supervisor/bridge.
    await taskAction('disable');
  }
  return automationStatus();
}
async function stopSupervisor() {
  if (process.platform !== 'win32') return;
  const state = await automationStatus();
  if (state.state === 'unavailable') throw new Error('Cannot verify supervisor state');
  if (state.state !== 'not-installed') await taskAction('stop');
}
async function saveKey(value) {
  const home = resolveDshHome();
  await mkdir(home,{recursive:true,mode:0o700});
  const temporary = join(home,'local-api-key.'+randomBytes(8).toString('hex')+'.tmp');
  try { await writeFile(temporary,value+'\n',{flag:'wx',mode:0o600}); await rename(temporary,join(home,'local-api-key')); }
  finally { await unlink(temporary).catch(()=>{}); }
}
module.exports={automationStatus,setAutomation,stopSupervisor,saveKey};
