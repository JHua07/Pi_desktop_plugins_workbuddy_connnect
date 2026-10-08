'use strict';
const {readFile}=require('node:fs/promises');
const {homedir}=require('node:os');
const {join,isAbsolute}=require('node:path');
const {localKey}=require('./cli.cjs');
const {startBridge}=require('./server.cjs');
const pathVariables=['WORKBUDDY_AUTH_FILE','WORKBUDDY_AI_AUTH_FILE','WORKBUDDY_ELECTRON_BIN','WORKBUDDY_AI_ELECTRON_BIN'];
function applySettings(settings={}) {
  const root=settings.dataDirectory || join(homedir(),'.pi-workbuddy-connect');
  if(typeof root!=='string'||!isAbsolute(root))throw new Error('数据目录必须是绝对路径');
  const port=Number(settings.port ?? 18765);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('端口必须为 1–65535 的整数');
  process.env.PI_WORKBUDDY_HOME=root;
  if(process.platform==='win32'){
    process.env.LOCALAPPDATA ||= join(homedir(),'AppData','Local');
    process.env.APPDATA ||= join(homedir(),'AppData','Roaming');
  }
  process.env.PI_WORKBUDDY_PORT=String(port);
  for(const name of pathVariables) {
    const value=settings[name];
    if(value!==undefined && value!=='' && (typeof value!=='string'||!isAbsolute(value)))throw new Error(name+' 必须是绝对路径');
    if(value)process.env[name]=value;else delete process.env[name];
  }
  return {root,port};
}
async function configure(settings={}) {
  const config=applySettings(settings);
  // Only reuse saved path overrides, never host secrets, Node launch paths or tokens.
  try {
    const legacy=JSON.parse(await readFile(join(config.root,'automation.json'),'utf8'));
    for(const name of pathVariables){const value=legacy.environment?.[name];if(!settings[name]&&typeof value==='string'&&isAbsolute(value))process.env[name]=value;}
  } catch(error) {if(error.code!=='ENOENT' && !(error instanceof SyntaxError))throw error;}
  return config;
}
function createPluginService({settings=async()=>({}),launch=startBridge,key=localKey,fetcher=fetch}={}) {
  let config,owned,inflight,session='',stopping=false;
  const origin=()=>`http://127.0.0.1:${config.port}`;
  const system={
    automationStatus:async()=>({state:'pi-managed',enabled:true}),
    setAutomation:async()=>{throw new Error('由 PI 插件生命周期管理，不使用 Windows 登录任务');},
    stopSupervisor:async()=>{},
    saveKey:require('./dashboard-system.cjs').saveKey
  };
  async function health(){
    const response=await fetcher(origin()+'/healthz',{headers:{Authorization:'Bearer '+await key()},signal:AbortSignal.timeout(2000)});
    if(!response.ok)throw new Error('端口已有服务但本地密钥不匹配；不会接管或停止它');
    const state=await response.json();if(state.service!=='pi-workbuddy-connect')throw new Error('端口被其他服务占用');return state;
  }
  async function start(){
    if(inflight)return inflight;
    if(stopping)throw new Error('插件正在卸载');
    inflight=(async()=>{
      config ||= await configure(await settings());
      if(owned?.isRunning())return;
      owned=undefined;session='';
      try{owned=await launch({key:await key(),port:config.port,autoRefresh:true,dashboardSystem:system,owner:'pi-plugin'});}
      catch(error){if(error.code!=='EADDRINUSE')throw error;await health();}
    })();
    try{await inflight;}finally{inflight=undefined;}
  }
  async function state(){
    config ||= await configure(await settings());
    try{const value=await health();return {...value,owned:!!owned?.isRunning(),mode:owned?.isRunning()?'pi-plugin':'external',port:config.port};}
    catch{return {ok:false,owned:false,mode:'stopped',port:config.port};}
  }
  async function authorize(){
    const response=await fetcher(origin()+'/dashboard/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:await key()}),signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error('管理会话授权失败');
    session=(await response.json()).sessionToken;
  }
  const routes=new Set(['/api/config','/api/status','/api/refresh','/api/key/regenerate','/api/automation','/api/stop']);
  async function api(input={}) {
    const {path,method='GET',body}=input;
    const models=typeof path==='string'&&/^\/api\/models\?product=(workbuddy|workbuddy-ai)$/.test(path);
    if(!routes.has(path)&&!models)throw new Error('不支持的面板操作');
    const expected=['/api/refresh','/api/key/regenerate','/api/automation','/api/stop'].includes(path)?'POST':'GET';
    if(method!==expected)throw new Error('不支持的面板请求方法');
    if(stopping)throw new Error('插件正在卸载');
    if(path==='/api/stop' && !owned?.isRunning())return {status:409,data:{error:{code:'external_instance',message:'此服务由外部启动，插件不会停止它。'}}};
    config ||= await configure(await settings());
    // Do not restart merely because status polling fires after a deliberate stop.
    if(!session)await authorize();
    async function call(){const r=await fetcher(origin()+'/dashboard'+path,{method,headers:{Authorization:'Bearer '+session,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(27000)});return {status:r.status,data:await r.json()};}
    let response=await call();if(response.status===401){await authorize();response=await call();}
    if(path==='/api/status'&&response.status===200)response.data.pluginOwned=!!owned?.isRunning();
    return response;
  }
  async function browserUrl(){await start();const r=await fetcher(origin()+'/dashboard/ticket',{method:'POST',headers:{Authorization:'Bearer '+await key(),'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('管理页授权失败');const ticket=(await r.json()).ticket;if(!/^[A-Za-z0-9_-]{43}$/.test(ticket))throw new Error('管理票据格式错误');return origin()+'/dashboard/#ticket='+ticket;}
  async function migrate(){
    config ||= await configure(await settings());
    if(owned?.isRunning())return state();
    if(process.platform!=='win32')throw new Error('请先停止外部手动桥接，然后点击重新启动');
    const status=await require('./dashboard-system.cjs').automationStatus();
    if(['not-installed','unavailable'].includes(status.state))throw new Error('没有可确认的本项目 Windows 任务；请先停止外部手动桥接');
    const legacy=JSON.parse(await readFile(join(config.root,'automation.json'),'utf8'));
    if(Number(legacy.environment?.PI_WORKBUDDY_PORT)!==config.port || legacy.environment?.PI_WORKBUDDY_HOME!==config.root)throw new Error('旧任务的端口或数据目录不同，未修改任务');
    await health();
    await require('./automation.cjs').manageAutomation('uninstall',config.port);
    session='';await start();return state();
  }
  async function stop(){stopping=true;try{if(inflight)await inflight.catch(()=>{});if(owned)await owned.close();owned=undefined;session='';}finally{stopping=false;}}
  return {start,stop,state,api,browserUrl,migrate};
}
module.exports={createPluginService,applySettings,configure};
