import {importWorkbenchModule} from '../lib/workbench.mjs';
/** Read-only release check. Source resources must match complete signed Hub packages exactly. */
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
import {isAbsolute,join} from 'node:path';
const {GalleryClient} = await importWorkbenchModule('apps/daemon/src/application/gallery-client.ts');
import {loadExtensionSkills,loadExtensionPlugins,extensionPluginRoot} from '../lib/resource-sources.mjs';
const {readSkillFiles,skillPackageDigest} = await importWorkbenchModule('packages/resource-loader/src/skill.ts');
const {parseDistribution,compareVersions,MAX_ARCHIVE} = await importWorkbenchModule('packages/resource-loader/src/distribution.ts');
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--data-dir','--source-id','--report'].includes(args[i])||!args[i+1]||options[args[i]])throw new Error('Usage: check-hub-sources.mjs --data-dir /absolute/workbench-data [--source-id ID] [--report /absolute/report.json]');options[args[i]]=args[i+1];}
const dataDir=options['--data-dir'];if(!dataDir||!isAbsolute(dataDir)||options['--report']&&!isAbsolute(options['--report']))throw new Error('Data and report paths must be absolute');
const db=new DatabaseSync(join(dataDir,'workbench.sqlite'),{readOnly:true}),client=new GalleryClient(db,dataDir);
try{
 const enabled=client.sources().filter(s=>s.enabled),source=options['--source-id']?client.source(options['--source-id']):enabled.length===1?client.source(enabled[0].id):undefined;
 if(!source)throw new Error('Select one configured enabled Hub source; accounts are never switched automatically');
 const entries=[...loadExtensionSkills().map(s=>({kind:'skill',id:s.id,version:s.version,files:s.files})),...loadExtensionPlugins().map(p=>({kind:'plugin',id:p.id,version:p.version,files:readSkillFiles(join(extensionPluginRoot,p.id))}))];
 const results=[];let index=0;
 async function worker(){while(index<entries.length){const entry=entries[index++];try{
  const versions=[];let cursor='';do{const page=await client.json(source,`/packages/${entry.kind}/${entry.id}/versions?`+new URLSearchParams({cursor}));versions.push(...page.versions);cursor=page.nextCursor??'';}while(cursor);
  const latest=versions.filter(v=>v.status==='published').sort((a,b)=>compareVersions(b.version,a.version))[0];if(!latest)throw new Error('No published version');
  const {descriptor,envelope}=await client.release(source,entry.kind,entry.id,latest.version);if(envelope.status!=='published')throw new Error('Release state changed during verification');
  const bytes=await client.request(source,`/packages/${entry.kind}/${entry.id}/versions/${latest.version}/archive`,'GET',undefined,MAX_ARCHIVE),pkg=parseDistribution(bytes);client.validateManifest(descriptor,pkg.manifest,bytes);
  const local=new Map(entry.files.map(f=>[f.path,f])),remote=new Map(pkg.files.map(f=>[f.path,f])),differentFiles=[];
  for(const path of new Set([...local.keys(),...remote.keys()])){const a=local.get(path),b=remote.get(path);if(!a||!b||a.executable!==b.executable||!a.content.equals(b.content))differentFiles.push(path);}
  const match=skillPackageDigest(entry.files)===pkg.manifest.payloadDigest;
  results.push({kind:entry.kind,id:entry.id,sourceVersion:entry.version,hubVersion:latest.version,match,differentFiles:differentFiles.sort()});
 }catch(error){results.push({kind:entry.kind,id:entry.id,sourceVersion:entry.version,match:false,error:error.message});}}}
 await Promise.all([worker(),worker(),worker()]);results.sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
 const report={sourceId:source.id,checkedAt:new Date().toISOString(),total:results.length,matching:results.filter(r=>r.match).length,results};
 if(options['--report'])writeFileSync(options['--report'],JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify(report,null,2));if(report.matching!==report.total)process.exitCode=1;
}finally{client.close();db.close();}
