'use strict';
const { randomBytes } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { resolveDshHome } = require('./home.cjs');
const token = () => randomBytes(32).toString('base64url');
function createDashboard({ getKey, rotateKey, products, getService, port, stop, system = require('./dashboard-system.cjs'), now = Date.now }) {
  const tickets = new Map(), sessions = new Map();
  let rotating = false, automating = false;
  const TTL = 30*60*1000;
  const assets = { '/dashboard':'index.html','/dashboard/':'index.html','/dashboard/app.js':'app.js','/dashboard/style.css':'style.css' };
  function prune() {
    for (const [value, expiry] of tickets) if (expiry <= now()) tickets.delete(value);
    for (const [value, expiry] of sessions) if (expiry <= now()) sessions.delete(value);
  }
  function json(res, status, value) { res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}); res.end(JSON.stringify(value)); }
  const fail = (res,status,code,message) => json(res,status,{error:{code,message}});
  async function body(req) {
    if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type']||'')) throw Object.assign(new Error('请求必须为 JSON'),{status:415});
    let length=0, chunks=[];
    for await (const chunk of req) { length+=chunk.length; if(length>8192) throw Object.assign(new Error('请求过大'),{status:413}); chunks.push(chunk); }
    let value;
    try { value=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('JSON 格式错误'),{status:400}); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('请求格式错误'),{status:400});
    return value;
  }
  async function handle(req,res,url) {
    if (!url.pathname.startsWith('/dashboard')) return false;
    prune();
    const expected = `127.0.0.1:${port()}`;
    if (req.headers.host !== expected || (req.headers.origin && req.headers.origin !== `http://${expected}`)) { fail(res,403,'origin','管理界面只允许同源本机访问'); return true; }
    if (url.pathname === '/dashboard' && req.method === 'GET') { res.writeHead(302,{'Location':'/dashboard/','Cache-Control':'no-store'});res.end();return true; }
    try {
      if (assets[url.pathname] && req.method === 'GET') {
        const file = assets[url.pathname];
        const bytes = await readFile(join(__dirname,'dashboard',file));
        res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"});
        res.end(bytes); return true;
      }
      if (url.pathname === '/dashboard/ticket' && req.method === 'POST') {
        if (!getKey().matches(req.headers.authorization)) { fail(res,401,'unauthorized','本地密钥不正确'); return true; }
        await body(req);
        if (tickets.size >= 32) { fail(res,429,'busy','授权请求过多'); return true; }
        const ticket=token(); tickets.set(ticket,now()+60000);
        json(res,200,{ticket,expiresAt:now()+60000}); return true;
      }
      if (url.pathname === '/dashboard/session' && req.method === 'POST') {
        const input=await body(req);
        const validTicket=typeof input.ticket === 'string' && tickets.has(input.ticket);
        if(validTicket) tickets.delete(input.ticket);
        const validKey=typeof input.apiKey === 'string' && getKey().matches('Bearer '+input.apiKey);
        if (!validTicket && !validKey) { fail(res,401,'unauthorized','授权链接已过期，或本地密钥不正确'); return true; }
        if(sessions.size >= 32) { fail(res,429,'busy','管理会话过多'); return true; }
        const sessionToken=token(); const expiresAt=now()+TTL;
        sessions.set(sessionToken,expiresAt); json(res,200,{sessionToken,expiresAt}); return true;
      }
      const match=/^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
      const session=match?.[1];
      if (!session || !sessions.has(session)) { fail(res,401,'unauthorized','请先授权管理界面'); return true; }
      if (url.pathname === '/dashboard/api/config' && req.method === 'GET') {
        json(res,200,{baseUrls:{workbuddy:`http://${expected}/workbuddy/v1`,'workbuddy-ai':`http://${expected}/workbuddy-ai/v1`},apiKey:getKey().value,apiType:'openai-completions',port:port(),home:resolveDshHome(),platform:process.platform,version:require('../package.json').version}); return true;
      }
      if (url.pathname === '/dashboard/api/status' && req.method === 'GET') {
        const rows=await Promise.all(products.map(async runtime=>{
          const auth=await runtime.store.status();
          const safe={state:auth.state,expiresAtMs:auth.expiresAtMs,refreshExpiresAtMs:auth.refreshExpiresAtMs,nickname:auth.nickname,source:auth.source,reasonCode:auth.reasonCode};
          if(auth.reasonCode) safe.reason='请在对应 WorkBuddy 应用中登录；如仍异常，检查凭据路径或 Electron 路径设置。';
          const refresh = { ...getService().products[runtime.variant.id], ...runtime.catalogStatus?.() };
          if (refresh.catalogRefreshFailed) refresh.state = 'catalog-stale';
          else if (refresh.state === 'catalog-stale') refresh.state = 'ready';
          if (auth.state !== 'signed-in') { refresh.state = 'signed-out'; refresh.modelCount = 0; }
          return {id:runtime.variant.id,displayName:runtime.variant.displayName || runtime.variant.id,auth:safe,refresh};
        }));
        json(res,200,{...getService(),products:rows,automation:await system.automationStatus()});return true;
      }
      if ((url.pathname === '/dashboard/api/models' && req.method === 'GET') || (url.pathname === '/dashboard/api/refresh' && req.method === 'POST')) {
        const input=req.method==='POST'?await body(req):{product:url.searchParams.get('product')};
        const runtime=products.find(p=>p.variant.id===input.product);
        if(!runtime){fail(res,400,'product','请选择国内版或国际版');return true;}
        try { const models=await runtime.models(req.method==='POST'); json(res,200,{models,source:runtime.source(),refresh:runtime.catalogStatus?.()}); }
        catch { fail(res,409,'not_signed_in','对应 WorkBuddy 登录不可用或已过期，请在客户端登录后刷新'); }
        return true;
      }
      if (url.pathname === '/dashboard/api/key/regenerate' && req.method === 'POST') {
        const input=await body(req);
        if(input.confirm!==true){fail(res,400,'confirmation','必须确认旧 Key 将失效');return true;}
        if(rotating){fail(res,409,'busy','密钥正在更新');return true;}
        rotating=true;
        try {const value=token();await rotateKey(value,system.saveKey);sessions.clear();sessions.set(session,now()+TTL);tickets.clear();json(res,200,{apiKey:value});}
        finally {rotating=false;}
        return true;
      }
      if (url.pathname === '/dashboard/api/automation' && req.method === 'POST') {
        const input=await body(req);
        if(typeof input.enabled!=='boolean'){fail(res,400,'invalid','开关值必须为布尔值');return true;}
        if(automating){fail(res,409,'busy','正在更新自启动');return true;}
        automating=true;
        try {json(res,200,{automation:await system.setAutomation(input.enabled,port())});}
        finally {automating=false;}
        return true;
      }
      if (url.pathname === '/dashboard/api/stop' && req.method === 'POST') {
        const input=await body(req);
        if(input.confirm!==true){fail(res,400,'confirmation','必须确认关闭服务');return true;}
        // Stop the supervisor first so it cannot immediately restart the service.
        await system.stopSupervisor();
        json(res,200,{ok:true,stopping:true});setImmediate(()=>void stop());return true;
      }
      fail(res,404,'not_found','管理接口不存在');return true;
    } catch(error) { if(!res.headersSent) fail(res,error.status||500,'request_failed',error.status?error.message:'操作失败，请检查登录状态或 Windows 任务权限'); else res.destroy(); return true; }
  }
  return {handle,clear:()=>{tickets.clear();sessions.clear();}};
}
module.exports={createDashboard};
