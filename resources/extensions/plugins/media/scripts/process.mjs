import {spawn} from 'node:child_process';

/** No shell expansion, no system PATH lookup; forward cancellation to the owned child. */
export async function run(file,args,{timeoutMs=300000}={}){
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<0)throw new Error('timeoutMs 必须是非负整数，0 表示不限时');
  const child=spawn(file,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stdout='',stderr='',overflow=false;
  const collect=(key,chunk)=>{
    if(key==='stdout')stdout+=chunk;else stderr+=chunk;
    if(stdout.length>4_000_000){overflow=true;child.kill();}
    if(stderr.length>200_000)stderr=stderr.slice(-200_000);
  };
  child.stdout.on('data',b=>collect('stdout',b));child.stderr.on('data',b=>collect('stderr',b));
  const cancel=()=>child.kill();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
  let timedOut=false;
  const timer=timeoutMs===0?null:setTimeout(()=>{timedOut=true;child.kill();},timeoutMs);
  try{
    const code=await new Promise((accept,reject)=>{child.once('error',reject);child.once('close',accept);});
    if(timedOut)throw new Error(`${file.split(/[\\/]/).at(-1)} timed out after ${timeoutMs} ms: ${stderr.slice(-6000)}`);
    if(code!==0||overflow)throw new Error(`${file.split(/[\\/]/).at(-1)} failed (${code}): ${stderr.slice(-6000)}`);
    return {stdout,stderr};
  }finally{if(timer!==null)clearTimeout(timer);process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
}
