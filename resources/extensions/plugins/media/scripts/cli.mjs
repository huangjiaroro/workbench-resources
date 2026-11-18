import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {inspect,assemble} from './media.mjs';

const [action,...args]=process.argv.slice(2);
if(!action||['help','--help','-h'].includes(action)){
  console.log(JSON.stringify({usage:'wb-media <inspect|assemble> --input ABSOLUTE_JSON --output-dir ABSOLUTE_OUTPUTS',inspect:{path:'absolute authorized file',frameTimes:[0,1.5],extractAudio:false},assemble:{paths:['absolute first video','absolute second video'],audioPolicy:'preserve | mute'},platforms:['darwin-arm64','win32-x64'],evidence:'metadata / extracted files / actual frame timestamps; no viewing or listening assertion'},null,2));
}else{
  let directory;
  try{
    if(!['inspect','assemble'].includes(action))throw new Error('未知媒体命令');
    const options={};
    for(let i=0;i<args.length;i+=2){const key=args[i];if(!['--input','--output-dir'].includes(key)||!args[i+1]||options[key])throw new Error('仅接受一次 --input 和 --output-dir');options[key]=args[i+1];}
    if(!isAbsolute(options['--input']??'')||!isAbsolute(options['--output-dir']??''))throw new Error('必须指定本轮参数文件和 outputs 的绝对路径');
    const root=join(dirname(fileURLToPath(import.meta.url)),'..'),suffix=process.platform==='win32'?'.exe':'';
    const binaries={ffmpeg:join(root,'bin','ffmpeg'+suffix),ffprobe:join(root,'bin','ffprobe'+suffix)};
    if(Object.values(binaries).some(p=>!existsSync(p)))throw new Error('当前插件工具环境未准备或已损坏；请在插件维护页修复，不搜索宿主机程序');
    const input=JSON.parse(await readFile(options['--input'],'utf8'));
    directory=join(options['--output-dir'],`${action}-${randomUUID()}`);await mkdir(directory,{recursive:true});
    const result=await ({inspect,assemble}[action])(input,{binaries,outputDirectory:directory});
    const output={state:'completed',operation:action,result,resultFile:join(directory,'result.json')};
    await writeFile(output.resultFile,JSON.stringify(output,null,2));console.log(JSON.stringify(output));
  }catch(error){
    const result={state:'failed',operation:action,error:error.message,...(directory?{partialDirectory:directory}:{})};
    if(directory)await writeFile(join(directory,'failure.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));process.exitCode=1;
  }
}
