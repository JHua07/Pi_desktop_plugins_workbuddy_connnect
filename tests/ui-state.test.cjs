'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {join}=require('node:path');
class Element{
 constructor(id=''){this.id=id;this.value='';this.hidden=true;this.disabled=false;this.textContent='';this.children=[];this.dataset={};this.handlers={};this.attrs={};this.open=false;this.classList={add(){},remove(){},toggle(){}};}
 addEventListener(name,fn){(this.handlers[name]||=[]).push(fn);}
 async emit(name,event={}){for(const fn of this.handlers[name]||[])await fn({preventDefault(){},...event});}
 setAttribute(name,value){this.attrs[name]=value;}
 replaceChildren(...values){this.children=values;}
 append(...values){this.children.push(...values);}
 focus(){}select(){}showModal(){this.open=true;}
 close(){this.open=false;void this.emit('close');}
 get parentElement(){return this.parent ||= new Element();}
}
async function fixture(){
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
 const tabs=['workbuddy','workbuddy-ai'].map(product=>{const node=get('tab-'+product);node.dataset.product=product;return node;});
 const root=new Element('html');const intervals=[];let key='fixture-key-original',logged=true,models=[{id:'fixture-model',name:'Fixture',contextWindow:10000,maxTokens:1000}],copied='',failure=false;
 const config=()=>({apiKey:key,baseUrls:{workbuddy:'http://127.0.0.1:18765/workbuddy/v1','workbuddy-ai':'http://127.0.0.1:18765/workbuddy-ai/v1'},version:'0.4.1',platform:'win32',port:18765});
 const status=()=>({owner:'pi-plugin',pluginOwned:true,products:[{id:'workbuddy',auth:{state:logged?'signed-in':'signed-out'},refresh:{state:failure?'catalog-stale':'ready',modelCount:models.length,catalogSource:failure?'saved':'upstream',checkedAt:Date.now()}},{id:'workbuddy-ai',auth:{state:'signed-out'}}],automation:{state:'pi-managed',enabled:true}});
 const context={console,document:{getElementById:get,documentElement:root,hidden:false,addEventListener(){},createElement:()=>new Element(),querySelectorAll:selector=>selector==='[data-product]'?tabs:[]},window:{addEventListener(){},pluginBridge:{invoke:async(channel,input)=>{
   if(channel==='clipboard.writeText'){copied=input.text;return {ok:true};}
   if(channel==='workbuddy.start')return {ok:true};
   if(channel!=='workbuddy.api')throw new Error('unexpected channel');
   const path=input.path;
   if(path==='/api/config')return {status:200,data:config()};
   if(path==='/api/status')return {status:200,data:status()};
   if(path.startsWith('/api/models')||path==='/api/refresh')return {status:200,data:{models:logged?models:[],source:failure?'saved':'upstream',refresh:{catalogRefreshFailed:failure,catalogSource:failure?'saved':'upstream',modelCount:models.length}}};
   throw new Error('unexpected path');
 }}},navigator:{},location:{hash:'',pathname:'/dashboard/',search:''},history:{replaceState(){}},matchMedia:()=>({matches:false,addEventListener(){}}),setInterval:fn=>{intervals.push(fn);return 1;},setTimeout:(fn,delay)=>delay<1000?setTimeout(fn,delay):0,clearTimeout,AbortSignal,URLSearchParams,sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}}};
 vm.runInNewContext(fs.readFileSync(join(__dirname,'../bridge/dashboard/app.js'),'utf8'),context);
 const settle=async()=>{await new Promise(r=>setTimeout(r,15));};await settle();
 return {get,settle,key:value=>{key=value;},logged:value=>{logged=value;},failure:value=>{failure=value;},models:value=>{models=value;},copied:()=>copied,intervals};
}
test('PI dashboard copy-key reads the current key after another window regenerated it',async()=>{
 const f=await fixture();assert.equal(f.get('workspace').hidden,false);
 f.key('fixture-key-new');await f.get('copy-key').emit('click');await f.settle();
 assert.equal(f.copied(),'fixture-key-new');
});
test('status refresh removes old model rows when the desktop account signs out',async()=>{
 const f=await fixture();assert.equal(f.get('models-body').children.length,1);
 f.logged(false);await f.get('sync').emit('click');await f.settle();
 assert.equal(f.get('auth-state').textContent,'未登录');
 assert.equal(f.get('models-body').children.length,0);
});
test('manual model refresh also refreshes authorization and reports cached fallback honestly',async()=>{
 const f=await fixture();f.logged(false);await f.get('sync').emit('click');await f.settle();
 f.logged(true);f.failure(true);await f.get('refresh-models').emit('click');await f.settle();
 assert.equal(f.get('auth-state').textContent,'已登录');
 assert.equal(f.get('models-body').children.length,1);
 assert.match(f.get('toast').textContent,/缓存|失败|未更新/);
});
