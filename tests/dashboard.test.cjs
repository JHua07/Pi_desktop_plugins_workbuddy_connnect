'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {startBridge}=require('../bridge/server.cjs');
const {prepareDashboard}=require('../bridge/ui-launcher.cjs');
const KEY='dashboard-fixture-key-'.padEnd(43,'x');
function runtime(id,logged=true) {
  let forced=0;
  return {variant:{id,displayName:id==='workbuddy'?'WorkBuddy':'WorkBuddy AI'},
    store:{status:async()=>({state:logged?'signed-in':'signed-out',nickname:'fixture',reasonCode:logged?undefined:'no-credential',accessToken:'must-not-expose',reason:'must-not-expose'}),resolve:async()=>({})},
    models:async force=>{if(!logged)throw new Error('must-not-expose');if(force)forced++;return [{id:'fixture-model',name:'Fixture',contextWindow:10000,maxTokens:1000,supportsImages:true}];},
    source:()=> 'upstream',getForced:()=>forced,client:{chatStream:async()=>{throw new Error('no chat allowed');}}};
}
async function fixture(t) {
  const cn=runtime('workbuddy'),ai=runtime('workbuddy-ai',false);
  let savedKey, enabled=true, now=Date.now(),failSave=false,stops=0;
  const bridge=await startBridge({key:KEY,port:0,runtimes:[cn,ai],dashboardNow:()=>now,dashboardSystem:{
    saveKey:async value=>{if(failSave)throw new Error('disk failure');savedKey=value;},
    automationStatus:async()=>({enabled,state:enabled?'Running':'Disabled'}),
    setAutomation:async value=>{enabled=value;return {enabled,state:enabled?'Running':'Disabled'};},
    stopSupervisor:async()=>{stops++;}
  }});
  t.after(()=>bridge.close());
  async function api(path,{key=KEY,method='GET',body,headers={}}={}) {
    const response=await fetch(`http://127.0.0.1:${bridge.port}${path}`,{method,headers:{...(key?{Authorization:'Bearer '+key}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const text=await response.text();
    let data;try{data=JSON.parse(text);}catch{}
    return {status:response.status,data,text,headers:response.headers};
  }
  async function session() {return (await api('/dashboard/session',{method:'POST',body:{apiKey:savedKey||KEY}})).data.sessionToken;}
  return {bridge,cn,api,session,key:()=>savedKey,clock:ms=>{now+=ms;},failSave:value=>{failSave=value;},stops:()=>stops};
}

test('dashboard authorization, same-origin protection, and session scope',async t=>{
  const f=await fixture(t);
  assert.equal((await f.api('/dashboard/api/config',{key:undefined})).status,401);
  assert.equal((await f.api('/dashboard/api/config')).status,401,'main API key cannot act as a dashboard session');
  assert.equal((await f.api('/dashboard/ticket',{method:'POST',body:{},headers:{Origin:'http://127.0.0.1:1'}})).status,403);
  assert.equal((await f.api('/dashboard/session',{method:'POST',body:{apiKey:'wrong'}})).status,401);
  assert.equal((await f.api('/dashboard/session',{method:'POST',headers:{'Content-Type':'text/plain'},body:{apiKey:KEY}})).status,415);
  const ticket=(await f.api('/dashboard/ticket',{method:'POST',body:{}})).data.ticket;
  assert.notEqual(ticket,KEY);assert.match(ticket,/^[A-Za-z0-9_-]{43}$/);
  const exchange=await f.api('/dashboard/session',{method:'POST',body:{ticket}});
  const session=exchange.data.sessionToken;
  assert.equal(exchange.status,200);
  assert.equal((await f.api('/dashboard/session',{method:'POST',body:{ticket}})).status,401,'ticket is one-use');
  assert.equal((await f.api('/healthz',{key:session})).status,401,'dashboard token cannot call chat API');
  const config=await f.api('/dashboard/api/config',{key:session});
  assert.equal(config.data.apiKey,KEY);
  assert.equal(config.data.baseUrls.workbuddy,`http://127.0.0.1:${f.bridge.port}/workbuddy/v1`);
  assert.equal(config.headers.get('cache-control'),'no-store');
  f.clock(1800001);
  assert.equal((await f.api('/dashboard/api/config',{key:session})).status,401,'management session expires');
});

test('dashboard tickets expire and launcher uses a ticket, not API key in URL',async t=>{
  const f=await fixture(t);
  const url=await prepareDashboard({key:KEY,port:f.bridge.port,start:false});
  assert.ok(!url.includes(KEY));assert.match(url,/#ticket=/);
  const ticket=new URLSearchParams(new URL(url).hash.slice(1)).get('ticket');
  f.clock(60001);
  assert.equal((await f.api('/dashboard/session',{method:'POST',body:{ticket}})).status,401);
});

test('safe login/model status, force refresh, and startup toggle',async t=>{
  const f=await fixture(t),session=await f.session();
  const status=await f.api('/dashboard/api/status',{key:session});
  assert.equal(status.data.products.length,2);assert.ok(!status.text.includes('must-not-expose'));
  assert.equal(status.data.automation.enabled,true);
  const rows=await f.api('/dashboard/api/models?product=workbuddy',{key:session});
  assert.equal(rows.data.models[0].id,'fixture-model');
  assert.equal((await f.api('/dashboard/api/refresh',{key:session,method:'POST',body:{product:'workbuddy'}})).status,200);
  assert.equal(f.cn.getForced(),1);
  assert.equal((await f.api('/dashboard/api/models?product=workbuddy-ai',{key:session})).status,409);
  assert.equal((await f.api('/dashboard/api/models?product=invalid',{key:session})).status,400);
  assert.equal((await f.api('/dashboard/api/automation',{key:session,method:'POST',body:{enabled:'true'}})).status,400);
  const toggle=await f.api('/dashboard/api/automation',{key:session,method:'POST',body:{enabled:false}});
  assert.equal(toggle.data.automation.enabled,false);
  assert.equal((await f.api('/healthz')).status,200,'toggle must leave bridge running');
});

test('key regeneration is confirmed and atomic, invalidates old API keys and other sessions',async t=>{
  const f=await fixture(t),one=await f.session(),two=await f.session();
  assert.equal((await f.api('/dashboard/api/key/regenerate',{key:one,method:'POST',body:{}})).status,400);
  f.failSave(true);
  assert.equal((await f.api('/dashboard/api/key/regenerate',{key:one,method:'POST',body:{confirm:true}})).status,500);
  assert.equal((await f.api('/healthz')).status,200,'failed persistence must not alter current key');
  f.failSave(false);
  const rotate=await f.api('/dashboard/api/key/regenerate',{key:one,method:'POST',body:{confirm:true}});
  assert.equal(rotate.status,200);assert.equal(rotate.data.apiKey,f.key());assert.notEqual(f.key(),KEY);
  assert.equal((await f.api('/healthz')).status,401);
  assert.equal((await f.api('/healthz',{key:f.key()})).status,200);
  assert.equal((await f.api('/dashboard/api/config',{key:one})).status,200);
  assert.equal((await f.api('/dashboard/api/config',{key:two})).status,401);
});

test('dashboard stop requires confirmation and stops the supervisor before closing',async t=>{
  const f=await fixture(t),session=await f.session();
  assert.equal((await f.api('/dashboard/api/stop',{key:session,method:'POST',body:{}})).status,400);
  assert.equal((await f.api('/dashboard/api/stop',{key:session,method:'POST',body:{confirm:true}})).status,200);
  assert.equal(f.stops(),1);
  await new Promise(r=>setTimeout(r,50));
  await assert.rejects(()=>f.api('/healthz'));
});

test('dashboard static assets served without credentials, with restrictive CSP and no secrets',async t=>{
  const f=await fixture(t);
  const page=await f.api('/dashboard/',{key:''});
  assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
  assert.ok(!page.text.includes(KEY));
  assert.equal((await f.api('/dashboard/app.js',{key:''})).status,200);
  assert.equal((await f.api('/dashboard/style.css',{key:''})).status,200);
  assert.equal((await f.api('/dashboard/other-file',{key:''})).status,401);
});

test('UI launcher starts a stopped bridge in the background using an isolated home',async t=>{
  const {mkdtemp,writeFile}=require('node:fs/promises');
  const {join}=require('node:path');
  const {execFile}=require('node:child_process');
  const {promisify}=require('node:util');
  const home=await mkdtemp(join(process.env.PI_SCRATCH_DIR || require('node:os').tmpdir(),'wb-ui-launch-test-'));
  await writeFile(join(home,'local-api-key'),KEY);
  const probe=await startBridge({key:KEY,port:0,runtimes:[]});const port=probe.port;await probe.close();
  t.after(async()=>{try{await fetch(`http://127.0.0.1:${port}/shutdown`,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},body:'{}'});}catch{}});
  const modulePath=join(__dirname,'../bridge/ui-launcher.cjs');
  const script='require(process.argv[1]).prepareDashboard({key:process.argv[2],port:Number(process.argv[3])}).then(url=>console.log(JSON.stringify({ticket:new URLSearchParams(new URL(url).hash.slice(1)).get("ticket"),containsKey:url.includes(process.argv[2])}))).catch(()=>process.exitCode=1)';
  const result=await promisify(execFile)(process.execPath,['-e',script,modulePath,KEY,String(port)],{env:{...process.env,PI_WORKBUDDY_HOME:home,PI_WORKBUDDY_PORT:String(port),WORKBUDDY_AUTH_FILE:join(home,'missing-cn'),WORKBUDDY_AI_AUTH_FILE:join(home,'missing-ai')},timeout:12000});
  const data=JSON.parse(result.stdout);assert.equal(data.containsKey,false);assert.match(data.ticket,/^[A-Za-z0-9_-]{43}$/);
  const health=await fetch(`http://127.0.0.1:${port}/healthz`,{headers:{Authorization:'Bearer '+KEY}});
  assert.equal(health.status,200);
});
