'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {mkdtemp}=require('node:fs/promises');const {join}=require('node:path');const vm=require('node:vm'),fs=require('node:fs');
const {startBridge}=require('../bridge/server.cjs');
const {createPluginService,applySettings}=require('../bridge/plugin-service.cjs');
const KEY='plugin-lifecycle-fixture-'.padEnd(43,'x');
const ENV=['PI_WORKBUDDY_HOME','PI_WORKBUDDY_PORT','APPDATA','LOCALAPPDATA','WORKBUDDY_AUTH_FILE','WORKBUDDY_AI_AUTH_FILE','WORKBUDDY_ELECTRON_BIN','WORKBUDDY_AI_ELECTRON_BIN'];
function preserve(t){const before=Object.fromEntries(ENV.map(n=>[n,process.env[n]]));t.after(()=>{for(const n of ENV)before[n]===undefined?delete process.env[n]:process.env[n]=before[n];});}
async function setup(t){preserve(t);const home=await mkdtemp(join(process.env.PI_SCRATCH_DIR||require('node:os').tmpdir(),'wb-plugin-test-'));const probe=await startBridge({key:KEY,port:0,runtimes:[]});const port=probe.port;await probe.close();let launches=0;const service=createPluginService({settings:async()=>({dataDirectory:home,port:String(port)}),key:async()=>KEY,launch:async opts=>{launches++;return startBridge({...opts,runtimes:[]});}});t.after(()=>service.stop());return {service,port,home,launches:()=>launches};}
test('plugin starts once, exposes owner state and dashboard API, pauses and restarts, unload releases port',async t=>{
 const f=await setup(t);await Promise.all([f.service.start(),f.service.start()]);assert.equal(f.launches(),1);
 assert.equal((await f.service.state()).owner,'pi-plugin');assert.equal((await f.service.state()).owned,true);
 const config=await f.service.api({path:'/api/config'});assert.equal(config.status,200);assert.equal(config.data.apiKey,KEY);
 const status=await f.service.api({path:'/api/status'});assert.equal(status.data.automation.state,'pi-managed');
 await assert.rejects(()=>f.service.api({path:'https://attacker.invalid/'}));
 await assert.rejects(()=>f.service.api({path:'/api/config',method:'POST'}));
 const pause=await f.service.api({path:'/api/stop',method:'POST',body:{confirm:true}});assert.equal(pause.status,200);
 await new Promise(r=>setTimeout(r,50));assert.equal((await f.service.state()).ok,false);
 await assert.rejects(()=>f.service.api({path:'/api/status'}));assert.equal(f.launches(),1,'polling cannot restart paused bridge');
 await f.service.start();assert.equal(f.launches(),2);
 await f.service.stop();assert.equal((await f.service.state()).ok,false);
});
test('plugin reuses an external bridge but never stops it through panel or unload',async t=>{
 const f=await setup(t);const outside=await startBridge({key:KEY,port:f.port,runtimes:[]});t.after(()=>outside.close());
 await f.service.start();const state=await f.service.state();assert.equal(state.mode,'external');assert.equal(state.owned,false);
 const stopped=await f.service.api({path:'/api/stop',method:'POST',body:{confirm:true}});assert.equal(stopped.status,409);
 assert.equal(outside.isRunning(),true);await f.service.stop();assert.equal(outside.isRunning(),true);
});
test('plugin rejects an occupied listener with a different key without shutting it down',async t=>{
 const f=await setup(t);const outside=await startBridge({key:'another-fixture-key-'.padEnd(43,'y'),port:f.port,runtimes:[]});t.after(()=>outside.close());
 await assert.rejects(()=>f.service.start(),/密钥不匹配/);assert.equal(outside.isRunning(),true);
});
test('plugin browser link grants one-use dashboard access without API key in URL',async t=>{
 const f=await setup(t);await f.service.start();const url=await f.service.browserUrl();assert.ok(!url.includes(KEY));assert.match(url,/#ticket=/);
});
test('plugin settings validate paths and ports without reading host secrets',t=>{
 preserve(t);assert.throws(()=>applySettings({port:'abc'}));assert.throws(()=>applySettings({dataDirectory:'relative'}));assert.throws(()=>applySettings({WORKBUDDY_ELECTRON_BIN:'relative.exe'}));
});
test('PI entry registers resident service and two commands; forwards only named panel operations',async()=>{
 const commands=new Map(),services=new Map(),calls=[];
 const companion={start:async()=>calls.push('start'),stop:async()=>calls.push('stop'),state:async()=>({ok:true}),api:async input=>({status:200,data:{path:input.path}}),browserUrl:async()=> 'http://127.0.0.1:18765/dashboard/#ticket=fixture'};
 const pi={plugin:{getSettings:async()=>({})},services:{register:async s=>services.set(s.id,s),unregister:async id=>services.delete(id)},commands:{register:async c=>commands.set(c.id,c),unregister:async id=>commands.delete(id)},ui:{openPanel:async()=>calls.push('panel')},shell:{openExternal:async()=>calls.push('browser')}};
 const context={module:{exports:{}},require:name=>{assert.equal(name,'./bridge/plugin-service.cjs');return {createPluginService:()=>companion};},pi};vm.runInNewContext(fs.readFileSync(join(__dirname,'../main.js'),'utf8'),context);
 const entry=context.module.exports;await entry.onLoad();assert.equal(services.size,1);assert.equal(commands.size,2);
 await assert.rejects(()=>entry.onPanelInvoke('workbuddy.start'),/批准后台服务权限/);
 await assert.rejects(()=>entry.onPanelInvoke('workbuddy.api',{path:'/api/config'}),/批准后台服务权限/);
 await services.get('workbuddy-bridge').start();await commands.get('pi-workbuddy-connect.open').run();
 await entry.onPanelInvoke('workbuddy.browser');await entry.onPanelInvoke('workbuddy.api',{path:'/api/status'});
 await assert.rejects(()=>entry.onPanelInvoke('arbitrary.method'));
 await entry.onUnload();assert.equal(commands.size,0);assert.equal(services.size,0);assert.deepEqual(calls,['start','panel','start','browser','stop']);
});

test('old automation shutdown preserves a bridge already taken over by PI',async t=>{
 const f=await setup(t);await f.service.start();
 const {writeFile}=require('node:fs/promises');await writeFile(join(f.home,'local-api-key'),KEY);
 const configPath=join(f.home,'automation.json');await writeFile(configPath,JSON.stringify({environment:{PI_WORKBUDDY_HOME:f.home,PI_WORKBUDDY_PORT:f.port}}));
 await require('../bridge/automation.cjs').shutdownManaged(configPath);
 assert.equal((await f.service.state()).owned,true);
});
