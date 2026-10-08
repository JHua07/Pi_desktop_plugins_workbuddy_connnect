'use strict';
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { join } = require('node:path');
async function prepareDashboard({ key, port, start = true }) {
  const base = `http://127.0.0.1:${port}`;
  async function health() {
    const response = await fetch(base+'/healthz',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(1500)});
    if(!response.ok || (await response.json()).service!=='pi-workbuddy-connect') throw new Error('The port or local API key does not match this bridge.');
  }
  try { await health(); }
  catch(error) {
    if (error.cause?.code !== 'ECONNREFUSED' || !start) throw new Error('Cannot open dashboard. Check the bridge port and data directory.');
    const child=spawn(process.execPath,[join(__dirname,'cli.cjs'),'start'],{detached:true,windowsHide:true,stdio:'ignore'});
    let spawnError;
    child.on('error',()=>{spawnError=true;});child.unref();
    let ready=false;
    for(let i=0;i<30;i++) {await new Promise(r=>setTimeout(r,200));if(spawnError)break;try{await health();ready=true;break;}catch{}}
    if(!ready)throw new Error('Background bridge could not start. Use automation install or check the configured port.');
  }
  const response=await fetch(base+'/dashboard/ticket',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw new Error('Dashboard authorization failed. Restart the bridge to load version 0.3.0.');
  const {ticket}=await response.json();
  if(!/^[A-Za-z0-9_-]{43}$/.test(ticket))throw new Error('Invalid dashboard ticket');
  return base+'/dashboard/#ticket='+ticket;
}
async function openDashboard(options) {
  const url=await prepareDashboard(options);
  const run=promisify(execFile);
  try {
    if(process.platform==='win32') {
      if(!/^http:\/\/127\.0\.0\.1:\d+\/dashboard\/#ticket=[A-Za-z0-9_-]{43}$/.test(url))throw new Error('Invalid local dashboard URL');
      await run(join(process.env.SystemRoot||'C:\\Windows','System32','cmd.exe'),['/d','/c','start','',url],{windowsHide:false,timeout:15000});
    }
    else await run(process.platform==='darwin'?'/usr/bin/open':'xdg-open',[url],{timeout:15000});
  } catch { throw new Error('Unable to open browser. Open the local /dashboard/ page and authorize using your local API key.'); }
  // Never print the API key or authorization ticket into logs.
  console.log('Opened the local management dashboard. Authorization link expires in 60 seconds.');
}
module.exports={prepareDashboard,openDashboard};
