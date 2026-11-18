// Connection selection only. All business flags and execution belong to official mmx.
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),index=args.indexOf('--connection');
let config;
if(index>=0){if(!args[index+1])throw new Error('--connection requires a named configuration file');config=JSON.parse(readFileSync(args[index+1],'utf8'));args.splice(index,2);}
const help=!args.length||args.includes('--help')||args.includes('-h')||args.includes('--version')||args.includes('-v');
if(!help&&!config)throw new Error('Select a Workbench connection with --connection FILE');
if(['auth','config','agent','update'].includes(args[0]))throw new Error('Manage accounts in Workbench connections; use this command for tool operations');
if(config&&(!['cn','global'].includes(config.region)||typeof config.apiKey!=='string'||!config.apiKey))throw new Error('Invalid selected MiniMax connection');
if(args.some(a=>/^--(?:api-key|region|base-url)(?:=|$)/.test(a)))throw new Error('Account and service are fixed by --connection');
const directory=mkdtempSync(join(tmpdir(),'wb-mmx-'));
try{
 writeFileSync(join(directory,'config.json'),JSON.stringify(config?{api_key:config.apiKey,region:config.region,timeout:3600}:{}),{mode:0o600});
 const env={...process.env,MMX_CONFIG_DIR:directory};for(const key of Object.keys(env))if(key.startsWith('MINIMAX_'))delete env[key];
 const child=spawn(process.execPath,[fileURLToPath(new URL('./dependencies/mmx-cli/1.0.28/node_modules/mmx-cli/dist/mmx.mjs',import.meta.url)),...args,'--non-interactive','--no-color'],{env,stdio:'inherit'});
 const forward=signal=>child.kill(signal);const onInt=()=>forward('SIGINT'),onTerm=()=>forward('SIGTERM');process.on('SIGINT',onInt);process.on('SIGTERM',onTerm);
 try{process.exitCode=await new Promise((accept,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>accept(code??(signal?130:1)));});}finally{process.off('SIGINT',onInt);process.off('SIGTERM',onTerm);}
}finally{rmSync(directory,{recursive:true,force:true});}
