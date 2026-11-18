import {createReadStream} from 'node:fs';
import {writeFile,stat} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {run} from './process.mjs';

export async function source(path){
  if(typeof path!=='string'||!isAbsolute(path))throw new Error('输入必须是本轮获准的绝对文件路径');
  if(!(await stat(path)).isFile())throw new Error('输入必须是普通文件');
  const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);
  return {path,sha256:hash.digest('hex')};
}
const number=value=>Number.isFinite(Number(value))?Number(value):null;
const rate=value=>{const [a,b]=String(value??'').split('/').map(Number);return b?a/b:null;};
export async function probe(path,binaries){
  const {stdout}=await run(binaries.ffprobe,['-v','error','-show_format','-show_streams','-of','json',path]);
  const p=JSON.parse(stdout),video=p.streams?.find(s=>s.codec_type==='video'&&s.disposition?.attached_pic!==1),audio=p.streams?.find(s=>s.codec_type==='audio');
  if(!video&&!audio)throw new Error('没有可检查的图像、视频或音频流');
  return {durationSeconds:number(p.format?.duration??video?.duration??audio?.duration),format:p.format?.format_name,
    video:video?{streamIndex:video.index,width:video.width,height:video.height,frameRate:rate(video.avg_frame_rate??video.r_frame_rate),codec:video.codec_name,pixelFormat:video.pix_fmt,rotation:number(video.side_data_list?.find(s=>s.rotation!==undefined)?.rotation??video.tags?.rotate??0)}:null,
    audio:audio?{streamIndex:audio.index,codec:audio.codec_name,channels:audio.channels,sampleRate:number(audio.sample_rate),channelLayout:audio.channel_layout??null}:null};
}
function keys(input,allowed){if(!input||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw new Error('输入字段无效');}
export async function inspect(input,{binaries,outputDirectory}){
  keys(input,['path','frameTimes','extractAudio']);
  const original=await source(input.path),analysis=await probe(input.path,binaries),times=input.frameTimes??[];
  if(!Array.isArray(times)||times.length>60||times.some(t=>!Number.isFinite(t)||t<0||!analysis.video||!analysis.durationSeconds||t>=analysis.durationSeconds))throw new Error('frameTimes 必须是实际视频时长内的秒数，最多 60 个');
  if(input.extractAudio!==undefined&&typeof input.extractAudio!=='boolean')throw new Error('extractAudio 必须是布尔值');
  if(input.extractAudio&&!analysis.audio)throw new Error('输入没有音轨，不能提取音频');
  const frames=[];
  for(const [i,requestedSeconds] of times.entries()){
    const path=join(outputDirectory,`frame-${String(i+1).padStart(3,'0')}.png`);
    const {stderr}=await run(binaries.ffmpeg,['-hide_banner','-nostdin','-n','-i',input.path,'-map',`0:${analysis.video.streamIndex}`,'-vf',`select=gte(t\\,${requestedSeconds}),showinfo`,'-frames:v','1','-fps_mode','vfr',path]);
    const actualSeconds=number(/\bpts_time:([\d.eE+-]+)/.exec(stderr)?.[1]);
    if(actualSeconds===null)throw new Error('未取得实际帧时间；不将请求时间冒充实际时间');
    frames.push({requestedSeconds,actualSeconds,...await source(path)});
  }
  let audio=null;
  if(input.extractAudio){
    const path=join(outputDirectory,'audio.wav');
    await run(binaries.ffmpeg,['-hide_banner','-v','error','-nostdin','-n','-i',input.path,'-map',`0:${analysis.audio.streamIndex}`,'-vn','-c:a','pcm_s16le',path]);
    audio={...await source(path),analysis:await probe(path,binaries)};
  }
  if((await source(input.path)).sha256!==original.sha256)throw new Error('检查期间输入文件改变，请重新取得准确版本');
  return {source:original,analysis,frames,audio,coverage:{metadata:true,frameTimes:frames.map(f=>f.actualSeconds),audioExtracted:!!audio,viewed:false,listened:false}};
}
export async function assemble(input,{binaries,outputDirectory}){
  keys(input,['paths','audioPolicy']);
  if(!Array.isArray(input.paths)||input.paths.length<2||input.paths.length>100)throw new Error('paths 需要 2 至 100 个有序视频路径');
  const audioPolicy=input.audioPolicy??'preserve';if(!['preserve','mute'].includes(audioPolicy))throw new Error('audioPolicy 必须是 preserve 或 mute');
  const segments=[];let startSeconds=0;
  for(const path of input.paths){
    const s=await source(path),analysis=await probe(path,binaries);
    if(!analysis.video||!(analysis.durationSeconds>0))throw new Error('每段必须是具有明确时长的视频');
    const first=segments[0]?.analysis;
    if(first){
      if(['width','height','rotation','frameRate'].some(k=>first.video[k]!==analysis.video[k]))throw new Error('分辨率、方向或帧率不同；需要明确的规范化方案');
      if(audioPolicy==='preserve'&&(!!first.audio!==!!analysis.audio||first.audio&&['channels','sampleRate','channelLayout'].some(k=>first.audio[k]!==analysis.audio[k])))throw new Error('源音轨布局不一致；需要明确的声音处理方案');
    }
    segments.push({...s,analysis,startSeconds,durationSeconds:analysis.durationSeconds});startSeconds+=analysis.durationSeconds;
  }
  const preserve=audioPolicy==='preserve'&&!!segments[0].analysis.audio;
  const inputs=segments.flatMap(s=>['-i',s.path]);
  const streams=segments.map((s,i)=>`[${i}:${s.analysis.video.streamIndex}]setpts=PTS-STARTPTS[v${i}];${preserve?`[${i}:${s.analysis.audio.streamIndex}]asetpts=PTS-STARTPTS[a${i}];`:''}`).join('');
  const order=segments.map((_,i)=>`[v${i}]${preserve?`[a${i}]`:''}`).join('');
  const filter=streams+order+`concat=n=${segments.length}:v=1:a=${preserve?1:0}[v]${preserve?'[a]':''}`;
  const path=join(outputDirectory,'assembled.mp4');
  await run(binaries.ffmpeg,['-hide_banner','-v','error','-nostdin','-n',...inputs,'-filter_complex',filter,'-map','[v]',...(preserve?['-map','[a]','-c:a','aac']:['-an']),'-c:v','libx264','-crf','18','-preset','medium','-movflags','+faststart',path],{timeoutMs:0});
  for(const segment of segments)if((await source(segment.path)).sha256!==segment.sha256)throw new Error('导出期间源视频改变');
  const analysis=await probe(path,binaries);
  if(Math.abs(analysis.durationSeconds-startSeconds)>Math.max(0.3,segments.length*0.05)||preserve&&!analysis.audio)throw new Error('导出时长或音轨校验失败');
  return {segments,audioPolicy,output:{...await source(path),analysis},coverage:{exportVerified:true,viewed:false,listened:false}};
}
