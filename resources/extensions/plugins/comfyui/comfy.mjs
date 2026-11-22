import {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync,openSync,closeSync,unlinkSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {runWorkflow,workflows,normalizePayload,workflowManifest} from './engine.mjs';
const help=`zp-comfy workflows list
zp-comfy probe --connection FILE [--workflow h3-flex|h3-flex-fl|h3|music3]
zp-comfy video generate --connection FILE [--workflow h3-flex|h3-flex-fl|h3] --input request.json --download clip.mp4 [--record job.json] [--no-wait]
zp-comfy video generate --connection FILE [--workflow h3-flex|h3] --prompt-file prompt.txt --duration 8 --ratio 16:9 --reference-image image.jpg [--turbo] --download clip.mp4
zp-comfy video generate --connection FILE --workflow h3-flex-fl --prompt-file prompt.txt --duration 5 --first-frame first.png [--last-frame last.png] --download clip.mp4
zp-comfy music generate --connection FILE --input request.json --download music.mp3 [--record job.json] [--no-wait]
zp-comfy music generate --connection FILE --caption-file caption.txt [--lyrics-file lyrics.txt] --max-duration 60 --download music.mp3
zp-comfy task wait --connection FILE --record job.json [--job REMOTE_ID]
zp-comfy task get --connection FILE --record job.json
  Video quality: --quality high|low (h3-flex and h3-flex-fl, default high; low targets a 480 px short edge).
  Options: --seed INTEGER, --turbo (h3 4-step LoRA for fast drafting), --poll-interval SECONDS (default 5), --timeout SECONDS (default 3600; 0 means no deadline).
Generation submits once, persists its receipt, waits and downloads by default. Resume with task wait. Unknown submission is never automatically resubmitted.`;
const argv=process.argv.slice(2);
if(!argv.length||argv.includes('--help')||argv.includes('-h')){console.log(help);process.exit(0);}
const command=argv.shift(),action=command==='probe'?undefined:argv.shift(),options={},refs=[];
const allowed=new Set(['connection','workflow','input','prompt-file','duration','ratio','reference-image','first-frame','last-frame','quality','turbo','caption-file','lyrics-file','max-duration','seed','download','record','no-wait','poll-interval','timeout','job']);
for(let i=0;i<argv.length;i++){
 const key=argv[i].replace(/^--/,'');if(!argv[i].startsWith('--')||!allowed.has(key))throw new Error(`Unknown option: ${argv[i]}`);
 if(key==='no-wait'||key==='turbo'){options[key]=true;continue;}
 const value=argv[++i];if(!value||value.startsWith('--'))throw new Error(`Missing --${key} value`);
 if(key==='reference-image')refs.push(value);else if(Object.hasOwn(options,key))throw new Error(`Duplicate option: --${key}`);else options[key]=value;
}
if(command==='workflows'&&action==='list'){console.log(JSON.stringify(await workflows(),null,2));process.exit(0);}
const generating=['video','music'].includes(command)&&action==='generate';
if(command!=='probe'&&!generating&&!(command==='task'&&['wait','get'].includes(action)))throw new Error('Unknown command; use --help');
if(!options.connection)throw new Error('--connection FILE is required');
const config=JSON.parse(readFileSync(resolve(options.connection),'utf8'));
const endpoint=new URL(config.endpoint);if(!['http:','https:'].includes(endpoint.protocol)||endpoint.username||endpoint.password)throw new Error('Invalid selected endpoint');
const hash=value=>createHash('sha256').update(value).digest('hex');
const connectionHash=hash(JSON.stringify(config));
if(command==='probe'){console.log(JSON.stringify(await runWorkflow({config,method:'probe',payload:{workflow:options.workflow??'h3-flex'}})));process.exit(0);}
const interval=Number(options['poll-interval']??5),timeout=Number(options.timeout??3600);
if(!Number.isFinite(interval)||interval<=0||!Number.isFinite(timeout)||timeout<0)throw new Error('Poll interval must be positive; timeout must be nonnegative');
const recordPath=resolve(options.record??(options.download?options.download+'.job.json':''));
if(!options.record&&!options.download)throw new Error('--record or --download is required');
mkdirSync(dirname(recordPath),{recursive:true});
// Exclusive receipt ownership prevents concurrent commands from duplicating a submission.
const lockPath=recordPath+'.lock',lockOwner={pid:process.pid,token:randomUUID(),startedAt:new Date().toISOString()};let lock;
try{lock=openSync(lockPath,'wx',0o600);writeFileSync(lock,JSON.stringify(lockOwner));}
catch(error){if(lock!==undefined)closeSync(lock);throw new Error(`Task receipt is in use: ${recordPath}; verify the previous process before removing its lock`,{cause:error});}
let record;
const save=()=>{const temporary=recordPath+'.'+randomUUID()+'.tmp';writeFileSync(temporary,JSON.stringify(record,null,2),{mode:0o600,flag:'wx'});renameSync(temporary,recordPath);};
try{
 if(existsSync(recordPath)){record=JSON.parse(readFileSync(recordPath,'utf8'));if(record.revision!==1||record.connectionHash!==connectionHash)throw new Error('Receipt or selected connection changed');}
 if(generating){
  if(!options.download)throw new Error('--download is required');
  const videoOptions=['prompt-file','duration','ratio','reference-image','first-frame','last-frame','quality','turbo'],musicOptions=['caption-file','lyrics-file','max-duration'];
  if((command==='video'?musicOptions:videoOptions).some(k=>options[k]!==undefined||k==='reference-image'&&refs.length))throw new Error('Options do not match generation type');
  if(options.input&&[...videoOptions,...musicOptions,'seed'].some(k=>options[k]!==undefined||k==='reference-image'&&refs.length))throw new Error('Use --input or generation flags, not both');
  const fromFlags=command==='video'?{prompt:options['prompt-file']?readFileSync(resolve(options['prompt-file']),'utf8'):'',durationSeconds:Number(options.duration??5),...(options.ratio!==undefined?{aspectRatio:options.ratio}:{}),...(refs.length?{referenceImages:refs}:{}),...(options['first-frame']?{firstFrame:options['first-frame']}:{}),...(options['last-frame']?{lastFrame:options['last-frame']}:{}),...(options.turbo!==undefined?{turbo:true}:{})}:{caption:options['caption-file']?readFileSync(resolve(options['caption-file']),'utf8'):'',lyrics:options['lyrics-file']?readFileSync(resolve(options['lyrics-file']),'utf8'):'',maxDurationSeconds:Number(options['max-duration']??60)};
  const input=options.input?JSON.parse(readFileSync(resolve(options.input),'utf8')):fromFlags;
  if(options.quality!==undefined)input.quality=options.quality;
  if(options.workflow&&input.workflow&&options.workflow!==input.workflow)throw new Error('Conflicting workflow selections');
  const payload=await normalizePayload({...input,...(options.workflow?{workflow:options.workflow}:{}),...(options.seed!==undefined?{seed:Number(options.seed)}:{})},command);
  const manifest=await workflowManifest(payload.workflow);
  const refFiles=[...['referenceImages','referenceVideos','referenceAudios'].flatMap(k=>(payload[k]??[])),...[payload.firstFrame,payload.lastFrame].filter(Boolean)];
  const inputHash=hash(JSON.stringify({payload,refs:refFiles.map(p=>[resolve(p),hash(readFileSync(resolve(p)))])}));
  const output=resolve(options.download);
  if(!manifest.output_expectations.extensions.includes(extname(output).slice(1).toLowerCase()))throw new Error(`Output extension must be ${manifest.output_expectations.extensions.join(', ')}`);
  mkdirSync(dirname(output),{recursive:true});
  if(record&&(record.inputHash!==inputHash||record.output!==output))throw new Error('Existing receipt belongs to different input or output; use task wait for the original task');
  if(!record){
   record={revision:1,connectionHash,inputHash,workflow:payload.workflow,seed:payload.seed??Math.floor(Math.random()*2**48),operationId:randomUUID(),output,status:'submission_unknown',createdAt:new Date().toISOString()};save();
   const submitted=await runWorkflow({config,method:'submit',operationId:record.operationId,payload:{...payload,seed:record.seed},outputDirectory:dirname(output)});
   if(submitted.state!=='submitted'||!submitted.remoteJobId)throw new Error('Submission outcome unknown; inspect service before recovery');
   record.remoteJobId=submitted.remoteJobId;record.status='submitted';save();
   console.error(`Submitted ${record.remoteJobId}; receipt: ${recordPath}`);
  }
 }else if(!record)throw new Error('Task receipt does not exist');
 if(options.job){if(record.remoteJobId&&record.remoteJobId!==options.job)throw new Error('Cannot replace a known remote task');record.remoteJobId=options.job;record.status='submitted';save();}
 if(!record.remoteJobId)throw new Error('Submission outcome unknown. Do not submit again; recover the original task ID and use task wait --job ID');
 if(record.status==='completed'){if(!existsSync(record.output)||hash(readFileSync(record.output))!==record.outputHash)throw new Error('Completed output missing or changed');console.log(JSON.stringify(record));}
 else if(record.status==='failed')throw new Error('Remote task failed; inspect the original task before explicitly requesting a new generation');
 else if(options['no-wait'])console.log(JSON.stringify(record));
 else{
  const start=Date.now();
  while(true){
   let result;
   mkdirSync(dirname(record.output),{recursive:true});
   const downloadDirectory=mkdtempSync(resolve(dirname(record.output),'.comfy-download-'));
   try{
    result=await runWorkflow({config,method:'poll',remoteJobId:record.remoteJobId,payload:{workflow:record.workflow},outputDirectory:downloadDirectory});
    if(result.state==='completed'){
     if(result.files.length!==1)throw new Error('Expected one media output; inspect remote outputs before adoption');
     renameSync(result.files[0].path,record.output);
    }
   }
   catch(error){console.error('Query/download failed; receipt retained. Resume with task wait.');throw error;}
   finally{rmSync(downloadDirectory,{recursive:true,force:true});}
   if(result.state==='failed'){record.status='failed';record.errorCode=result.errorCode;save();throw new Error(result.errorCode);}
   if(result.state==='completed'){
    record.status='completed';record.outputHash=hash(readFileSync(record.output));record.finishedAt=new Date().toISOString();save();console.log(JSON.stringify(record));break;
   }
   if(action==='get'){console.log(JSON.stringify({...record,status:'pending'}));break;}
    if(timeout>0&&Date.now()-start>=timeout*1000){console.log(JSON.stringify({...record,status:'pending',waitTimedOut:true}));break;}
   console.error(`Waiting for ${record.remoteJobId}`);await sleep(interval*1000);
  }
 }
}finally{
 closeSync(lock);
 try{
  const current=JSON.parse(readFileSync(lockPath,'utf8'));
  if(current.token===lockOwner.token)unlinkSync(lockPath);
  else console.error('Receipt lock ownership changed; leaving the current owner lock in place');
 }catch(error){
  if(error.code==='ENOENT')console.error('Receipt lock was removed externally; result and receipt remain authoritative');
  else console.error(`Receipt lock cleanup failed: ${error.message}`);
 }
}
