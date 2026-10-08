'use strict';
// Trusted native companion: owns its HTTP listener in PI's isolated plugin process.
// No shell launcher, Windows task or detached child is used for the bridge.
const {createPluginService}=require('./bridge/plugin-service.cjs');
let companion,activated=false;
async function startGranted(){if(!activated)throw new Error('请重新加载插件并批准后台服务权限');await companion.start();}
async function onLoad(){
  companion=createPluginService({settings:()=>pi.plugin.getSettings()});
  await pi.services.register({id:'workbuddy-bridge',start:async()=>{activated=true;await companion.start();},stop:async()=>{activated=false;await companion.stop();}});
  await pi.commands.register({id:'pi-workbuddy-connect.open',title:'WorkBuddy Connect: 接入管理',keywords:['workbuddy','模型','状态'],run:()=>pi.ui.openPanel({title:'WorkBuddy Connect'})});
  await pi.commands.register({id:'pi-workbuddy-connect.browser',title:'WorkBuddy Connect: 打开网页后台',keywords:['workbuddy','网页'],run:async()=>{await startGranted();await pi.shell.openExternal(await companion.browserUrl());}});
}
async function onPanelInvoke(channel,payload={}){
  if(!companion)throw new Error('插件尚未加载');
  if(!activated)throw new Error('请重新加载插件并批准后台服务权限');
  switch(channel){
    case 'workbuddy.api':return companion.api(payload);
    case 'workbuddy.start':await startGranted();return companion.state();
    case 'workbuddy.state':return companion.state();
    case 'workbuddy.browser':await startGranted();await pi.shell.openExternal(await companion.browserUrl());return {ok:true};
    case 'workbuddy.migrate':return companion.migrate();
    default:throw new Error('不支持的插件面板操作');
  }
}
async function onUnload(){
  activated=false;
  if(companion)await companion.stop();
  await pi.services.unregister('workbuddy-bridge');
  await pi.commands.unregister('pi-workbuddy-connect.open');
  await pi.commands.unregister('pi-workbuddy-connect.browser');
  companion=undefined;
}
module.exports={onLoad,onUnload,onPanelInvoke};
