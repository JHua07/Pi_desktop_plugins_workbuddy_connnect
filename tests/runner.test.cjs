'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {mkdtemp,writeFile}=require('node:fs/promises');
const {join}=require('node:path');
const {spawn}=require('node:child_process');
const {validateConfig}=require('../bridge/runner.cjs');
const {startBridge}=require('../bridge/server.cjs');
const {automationConfig}=require('../bridge/automation.cjs');
test('Node supervisor uses allowlisted configuration and rejects relative paths',()=>{
 const config=automationConfig({home:__dirname,port:18765,environment:{WORKBUDDY_ELECTRON_BIN:'fixture-path',UNRELATED_SECRET:'must-not-save'}});
 const env=validateConfig(config);assert.equal(env.WORKBUDDY_ELECTRON_BIN,'fixture-path');assert.notEqual(env.UNRELATED_SECRET,'must-not-save');
 assert.throws(()=>validateConfig({...config,nodePath:'node.exe'}),/Invalid/);
});
test('Node supervisor starts bridge without a PowerShell wrapper',async t=>{
 const home=await mkdtemp(join(process.env.PI_SCRATCH_DIR||require('node:os').tmpdir(),'wb-supervisor-test-'));
 const key='node-supervisor-fixture-'.padEnd(43,'x');await writeFile(join(home,'local-api-key'),key);
 const probe=await startBridge({key,port:0,runtimes:[]});const port=probe.port;await probe.close();
 const config=automationConfig({home,port,environment:{WORKBUDDY_AUTH_FILE:join(home,'missing-cn'),WORKBUDDY_AI_AUTH_FILE:join(home,'missing-ai')}});
 const configPath=join(home,'automation.json');await writeFile(configPath,JSON.stringify(config));
 const child=spawn(process.execPath,[join(__dirname,'../bridge/runner.cjs'),configPath],{stdio:'ignore',windowsHide:true});
 t.after(async()=>{child.kill();try{await fetch(`http://127.0.0.1:${port}/shutdown`,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:'{}'});}catch{}});
 let healthy=false;
 for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,100));try{const r=await fetch(`http://127.0.0.1:${port}/healthz`,{headers:{Authorization:'Bearer '+key}});if(r.ok){healthy=true;break;}}catch{}}
 assert.equal(healthy,true);
});
