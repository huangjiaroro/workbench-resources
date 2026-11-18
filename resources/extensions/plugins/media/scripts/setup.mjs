import {cpSync,mkdirSync,writeFileSync,chmodSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

let input='';for await(const chunk of process.stdin)input+=chunk;
const {packageRoot,targetRoot,platform,arch,runtimePaths}=JSON.parse(input);
const lock=JSON.parse(readFileSync(join(packageRoot,'dependencies.lock.json'),'utf8'));
const dependencies=lock.platforms[`${platform}-${arch}`];
if(!dependencies)throw new Error(`媒体插件不支持 ${platform}/${arch}；支持 darwin/arm64 与 win32/x64`);
mkdirSync(join(targetRoot,'bin'),{recursive:true});
for(const dependency of dependencies){
  const response=await fetch(dependency.url,{signal:AbortSignal.timeout(240000)});
  if(!response.ok)throw new Error(`媒体依赖下载失败：${dependency.name} HTTP ${response.status}`);
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>dependency.bytes)throw new Error('媒体依赖大小不符');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);
  if(size!==dependency.bytes||createHash('sha256').update(bytes).digest('hex')!==dependency.sha256)throw new Error(`媒体依赖完整性不符：${dependency.name}`);
  const path=join(targetRoot,'bin',dependency.name+(platform==='win32'?'.exe':''));
  writeFileSync(path,bytes);chmodSync(path,0o755);
  const version=execFileSync(path,['-version'],{encoding:'utf8',timeout:15000,windowsHide:true});
  if(!version.startsWith(dependency.name+' version '+dependency.version))throw new Error('媒体程序版本不符');
}
cpSync(join(packageRoot,'scripts'),join(targetRoot,'scripts'),{recursive:true});
execFileSync(runtimePaths.node,[join(targetRoot,'scripts','cli.mjs'),'--help'],{stdio:'pipe',windowsHide:true});
console.log(JSON.stringify({ready:true,platform,arch,versions:dependencies.map(d=>({name:d.name,version:d.version})),commands:['wb-media']}));
