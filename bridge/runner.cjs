'use strict';
const {readFile,mkdir,stat,rename,appendFile}=require('node:fs/promises');
const {createWriteStream}=require('node:fs');
const {spawn}=require('node:child_process');
const {join,isAbsolute}=require('node:path');
const allowed=['PI_WORKBUDDY_HOME','PI_WORKBUDDY_PORT','WORKBUDDY_AUTH_FILE','WORKBUDDY_AI_AUTH_FILE','WORKBUDDY_ELECTRON_BIN','WORKBUDDY_AI_ELECTRON_BIN'];
function validateConfig(config){
  if(config.version!==1 || !isAbsolute(config.nodePath||'') || !isAbsolute(config.cliPath||'') || !isAbsolute(config.environment?.PI_WORKBUDDY_HOME||''))throw new Error('Invalid automation configuration');
  const env={...process.env};
  for(const name of allowed)if(typeof config.environment[name]==='string')env[name]=config.environment[name];
  return env;
}
async function main(path){
  const config=JSON.parse(await readFile(path,'utf8'));
  const env=validateConfig(config);
  const home=env.PI_WORKBUDDY_HOME;
  await mkdir(home,{recursive:true,mode:0o700});
  const log=join(home,'background.log');
  let stopping=false,child;
  const stop=()=>{stopping=true;child?.kill();};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  while(!stopping){
    if((await stat(log).catch(()=>null))?.size>1048576)await rename(log,log+'.previous').catch(()=>{});
    await appendFile(log,new Date().toISOString()+' Starting managed bridge.\n',{mode:0o600});
    const output=createWriteStream(log,{flags:'a',mode:0o600});
    await new Promise(resolve=>{
      child=spawn(config.nodePath,[config.cliPath,'start'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
      child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});
      child.once('error',()=>resolve());child.once('exit',()=>resolve());
    });
    await new Promise(resolve=>output.end(resolve));
    if(!stopping){await appendFile(log,'Bridge exited; retrying in 15 seconds.\n');await new Promise(resolve=>setTimeout(resolve,15000));}
  }
}
if(require.main===module)main(process.argv[2]).catch(()=>{console.error('Managed bridge failed; check local paths and permissions.');process.exitCode=1;});
module.exports={validateConfig};
