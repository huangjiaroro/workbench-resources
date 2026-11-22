import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,basename,extname} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
export async function workflowManifest(id){
  if(typeof id!=='string'||!/^[a-z][a-z0-9-]*$/.test(id))throw new Error('invalid_workflow');
  try{return JSON.parse(await readFile(join(root,'workflows',id,'manifest.json'),'utf8'));}
  catch(error){if(error.code==='ENOENT')throw new Error(`Unknown workflow: ${id}`);throw error;}
}
export async function workflows(){return Promise.all((await readdir(join(root,'workflows'))).sort().map(async id=>({...await workflowManifest(id),id})));}
export async function normalizePayload(input,taskType){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Input must be an object');
  const p={...input,workflow:input.workflow??(taskType==='music'?'music3':'h3-flex')},manifest=await workflowManifest(p.workflow);
  if(manifest.task_type!==taskType)throw new Error(`Workflow ${p.workflow} does not generate ${taskType}`);
  const text=(field,required=false)=>{if(typeof p[field]!=='string'||required&&!p[field].trim()||p[field].length>20000)throw new Error(`Invalid ${field}; expected ${required?'nonempty ':''}text of at most 20000 characters`);};
  const number=(name,value,min,max,integer=false)=>{if(!Number.isFinite(value)||value<min||value>max||integer&&!Number.isInteger(value))throw new Error(`Invalid ${name}; expected ${integer?'integer ':''}${min}..${max}`);};
  if(p.seed!==undefined&&!Number.isSafeInteger(p.seed))throw new Error('Seed must be a nonnegative safe integer');
  if(p.seed!==undefined&&p.seed<0)throw new Error('Seed must be a nonnegative safe integer');
  if(p.parameters!==undefined&&(!p.parameters||typeof p.parameters!=='object'||Array.isArray(p.parameters)))throw new Error('Invalid parameters');
  if(taskType==='video'){
    const isFL=manifest.generation_mode==='first_last_frame';
    const allowed=isFL
      ?new Set(['workflow','prompt','durationSeconds','seed','parameters','quality','firstFrame','lastFrame'])
      :new Set(['workflow','prompt','durationSeconds','aspectRatio','seed','parameters','quality','turbo','referenceImages','referenceVideos','referenceAudios']);
    if(Object.keys(p).some(k=>!allowed.has(k)))throw new Error('Unsupported video input field');
    if(p.quality!==undefined){
      if(!manifest.low_quality_short_edge)throw new Error(`Workflow ${p.workflow} does not support quality selection`);
      if(p.quality!=='high'&&p.quality!=='low')throw new Error('Invalid quality; expected high or low');
      // Keep the original input hash for the default quality.
      if(p.quality==='high')delete p.quality;
    }
    if(p.parameters?.turbo!==undefined){p.turbo??=p.parameters.turbo;delete p.parameters.turbo;}
    if(Object.keys(p.parameters??{}).length)throw new Error('Unsupported video parameter');
    text('prompt',true);p.durationSeconds??=manifest.defaults.duration_seconds;
    number('durationSeconds',p.durationSeconds,1,30,true);
    if(isFL){
      if(typeof p.firstFrame!=='string'||!p.firstFrame)throw new Error('firstFrame is required; provide a local image path');
      if(p.lastFrame!==undefined&&(typeof p.lastFrame!=='string'||!p.lastFrame))throw new Error('Invalid lastFrame; expected a local image path or omit');
    }else{
      if(p.turbo!==undefined){
        if(typeof p.turbo!=='boolean')throw new Error('Invalid turbo; expected boolean');
        if(!manifest.input_bindings.turbo)throw new Error(`Workflow ${p.workflow} does not support turbo mode`);
      }else if(manifest.input_bindings.turbo){
        p.turbo=manifest.defaults.turbo??false;
      }
      p.aspectRatio??=manifest.defaults.aspect_ratio;
      if(!Object.hasOwn(manifest.input_bindings.resolution_selector.aspect_ratio_values,p.aspectRatio))throw new Error('Unsupported aspect ratio');
      for(const [field,limit]of [['referenceImages',9],['referenceVideos',1],['referenceAudios',3]])if(p[field]!==undefined&&(!Array.isArray(p[field])||p[field].length>limit||p[field].some(path=>typeof path!=='string'||!path)))throw new Error(`Invalid ${field}`);
    }
  }else{
    const allowed=new Set(['workflow','caption','lyrics','maxDurationSeconds','seed','parameters']);
    if(Object.keys(p).some(k=>!allowed.has(k)))throw new Error('Unsupported music input field');
    p.lyrics??='';text('caption',true);text('lyrics');p.maxDurationSeconds??=manifest.defaults.maxDurationSeconds;
    number('maxDurationSeconds',p.maxDurationSeconds,0.04,360);
    const specs={steps:[1,10000,true],textCfgScale:[0,100],topK:[1,16384,true],samplerCfg:[0,100],tileSize:[32,8192,true],overlap:[0,1024,true]};
    if(Object.keys(p.parameters??{}).some(k=>!Object.hasOwn(specs,k)&&k!=='tiledDecode'))throw new Error('Unsupported music parameter');
    p.parameters={...manifest.defaults.parameters,...p.parameters};
    for(const [key,limits]of Object.entries(specs))number(key,p.parameters[key],...limits);
    if(typeof p.parameters.tiledDecode!=='boolean')throw new Error('Invalid tiledDecode; expected boolean');
    if(p.parameters.tileSize%8||p.parameters.overlap>=p.parameters.tileSize)throw new Error('tileSize must be a multiple of 8 and greater than overlap');
  }
  return p;
}
async function json(response){if(!response.ok)throw new Error('comfyui_request_failed');return response.json();}
export async function runWorkflow(r){
  let p=r.payload??{};const id=p.workflow??'h3-flex',manifest=await workflowManifest(id);
  const graph=JSON.parse(await readFile(join(root,'workflows',id,'workflow.json'),'utf8'));
  const endpoint=new URL(r.config.endpoint),headers=r.config.apiKey?{Authorization:`Bearer ${r.config.apiKey}`}:{},b=manifest.input_bindings;
  const request=(path,options={})=>fetch(new URL(path,endpoint.href.replace(/\/?$/,'/')),{...options,headers:{...headers,...options.headers},redirect:'error',signal:AbortSignal.timeout(120000)});
  if(r.method==='probe'){
    const info=await json(await request('object_info')),missing=[...new Set(Object.values(graph).map(n=>n.class_type))].filter(type=>!Object.hasOwn(info,type));
    return {ready:!missing.length,missing};
  }
  if(r.method==='submit'){
    p=await normalizePayload({...p,workflow:id},manifest.task_type);
    for(const [kind,field]of [['images','referenceImages'],['videos','referenceVideos'],['audios','referenceAudios']]){
      const names=[];
      for(const path of p[field]??[]){const form=new FormData();form.set('image',new Blob([await readFile(path)]),basename(path));form.set('type','input');form.set('overwrite','false');
        const upload=await json(await request('upload/image',{method:'POST',body:form}));
        if(typeof upload.name!=='string'||upload.name.includes('..')||/[\\\x00]/.test(upload.name))throw new Error('invalid_upload_response');names.push((upload.subfolder?upload.subfolder+'/':'')+upload.name);}
      for(const [index,slot]of (b[kind]?.slots??[]).entries()){
        const load=String(slot.load_node);
        if(index>=names.length){for(const [node,field]of [['target_node','target_field'],['video_target_node','video_target_field'],['audio_target_node','audio_target_field']])if(slot[node]&&slot[field])delete graph[String(slot[node])].inputs[String(slot[field])];delete graph[load];if(slot.components_node)delete graph[String(slot.components_node)];}
        else {graph[load].inputs[slot.load_field]=names[index];if(slot.ui_field)graph[load].inputs[slot.ui_field]='';if(slot.target_node)graph[slot.target_node].inputs[slot.target_field]=[load,0];
          if(slot.components_node){const node=String(slot.components_node);graph[node].inputs[slot.components_field]=[load,slot.load_output_index??0];graph[slot.video_target_node].inputs[slot.video_target_field]=[node,slot.video_output_index];graph[slot.audio_target_node].inputs[slot.audio_target_field]=[node,slot.audio_output_index];}}
      }
    }
    for(const frameKey of ['first_frame','last_frame']){
      const binding=b[frameKey],localPath=p[frameKey==='first_frame'?'firstFrame':'lastFrame'];
      if(!binding||!binding.load_node)continue;
      if(!localPath){if(binding.required)throw new Error(`${frameKey} image is required`);if(binding.target_node&&binding.target_field)delete graph[String(binding.target_node)].inputs[String(binding.target_field)];delete graph[String(binding.load_node)];continue;}
      const form=new FormData();form.set('image',new Blob([await readFile(localPath)]),basename(localPath));form.set('type','input');form.set('overwrite','false');
      const upload=await json(await request('upload/image',{method:'POST',body:form}));
      if(typeof upload.name!=='string'||upload.name.includes('..')||/[\\\x00]/.test(upload.name))throw new Error('invalid_upload_response');
      graph[String(binding.load_node)].inputs[binding.load_field]=(upload.subfolder?upload.subfolder+'/':'')+upload.name;
    }
    const values={...manifest.defaults,...p.parameters,prompt:p.prompt,caption:p.caption,lyrics:p.lyrics,maxDurationSeconds:p.maxDurationSeconds,duration:p.durationSeconds,seed:p.seed??Math.floor(Math.random()*2**48),fps:manifest.defaults.fixed_fps,filename_prefix:`${manifest.output_expectations.primary_kind}/ZeroPoint/${r.operationId}`,...(p.turbo!==undefined?{turbo:p.turbo}:{})};
    const shortEdge=p.quality==='low'?manifest.low_quality_short_edge:undefined;
    values.video_short_edge=shortEdge;
    for(const [key,binding]of Object.entries(b))if(binding.node&&binding.field&&values[key]!==undefined)graph[binding.node].inputs[binding.field]=values[key];
    if(b.resolution_selector){
      const binding=b.resolution_selector, inputs=graph[binding.node].inputs;
      inputs[binding.aspect_ratio_field]=binding.aspect_ratio_values[p.aspectRatio];
      inputs[binding.megapixels_field]=manifest.defaults.megapixels;
      inputs[binding.multiple_field]=manifest.defaults.multiple;
      if(shortEdge!==undefined){
        const [width,height]=p.aspectRatio.split(':').map(Number);
        const aspect=Math.max(width,height)/Math.min(width,height);
        inputs[binding.megapixels_field]=shortEdge**2*aspect/1024**2;
      }
    }
    const response=await json(await request('prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:graph,client_id:r.operationId})}));
    if(typeof response.prompt_id!=='string'||!response.prompt_id)throw new Error('missing_prompt_id');return {state:'submitted',remoteJobId:response.prompt_id};
  }
  const history=await json(await request(`history/${encodeURIComponent(r.remoteJobId)}`)),entry=history[r.remoteJobId];
  if(!entry)return {state:'pending'};
  if(entry.status?.status_str==='error')return {state:'failed',errorCode:'comfyui_workflow_failed'};
  if(entry.status?.completed!==true)return {state:'pending'};
  const files=[];
  const expected=manifest.output_expectations,output=entry.outputs?.[expected.node]??{};
  for(const list of expected.primary_kind==='audio'?[output.audio]:[output.videos,output.gifs,output.images])for(const file of list??[]){
    if(file.type&&file.type!=='output')continue;
    if(typeof file.filename!=='string'||file.filename.includes('/')||/[\\\x00]/.test(file.filename)||file.filename==='..'||String(file.subfolder??'').split('/').some(s=>s==='..'||s==='.')||file.type&&file.type!=='output')throw new Error('invalid_remote_file');
    if(!expected.extensions.includes(extname(file.filename).slice(1).toLowerCase()))throw new Error('unexpected_media_format');
    const query=new URLSearchParams({filename:file.filename,subfolder:file.subfolder??'',type:'output'}),response=await request('view?'+query);
    if(!response.ok||Number(response.headers.get('content-length')??0)>250000000)throw new Error('comfyui_download_failed');
    const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>250000000)throw new Error('media_too_large');chunks.push(chunk);}
    const path=join(r.outputDirectory,`${files.length}-${basename(file.filename)}`);await writeFile(path,Buffer.concat(chunks),{mode:0o600});files.push({path});
  }
  if(!files.length)return {state:'failed',errorCode:'comfyui_no_media_output'};
  return {state:'completed',result:{workflow:id,remoteJobId:r.remoteJobId},files};
}
