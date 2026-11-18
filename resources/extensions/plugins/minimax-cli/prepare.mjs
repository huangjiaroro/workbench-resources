/** Build a private, fixed official CLI dependency. No global install or account configuration. */
import {readFileSync,mkdirSync,writeFileSync,cpSync,existsSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url)),version='1.0.28',target=join(root,'dependencies/mmx-cli',version,'node_modules');
const source=process.env.WORKBENCH_MMX_BUILD_SOURCE??join(root,'../../../..','.cache/plugin-build/mmx-cli',version);
if(!existsSync(join(source,'node_modules/mmx-cli/dist/mmx.mjs'))){
  mkdirSync(source,{recursive:true});writeFileSync(join(source,'package.json'),JSON.stringify({private:true,dependencies:{'mmx-cli':version}}));
  cpSync(join(root,'dependency-lock.json'),join(source,'package-lock.json'));
  const p=spawnSync('npm',['ci','--ignore-scripts','--no-audit','--no-fund','--prefix',source],{stdio:'inherit'});if(p.status!==0)throw new Error('Unable to prepare fixed MiniMax CLI dependency');
}
const lock=JSON.parse(readFileSync(join(root,'dependency-lock.json'),'utf8'));
const cli=JSON.parse(readFileSync(join(source,'node_modules/mmx-cli/package.json'),'utf8'));
const undici=JSON.parse(readFileSync(join(source,'node_modules/undici/package.json'),'utf8'));
if(cli.version!==version||undici.version!==lock.packages['node_modules/undici'].version)throw new Error('MiniMax dependency version mismatch');
mkdirSync(target,{recursive:true});
mkdirSync(join(target,'mmx-cli/dist'),{recursive:true});
for(const file of ['dist/mmx.mjs','package.json'])cpSync(join(source,'node_modules/mmx-cli',file),join(target,'mmx-cli',file));
rmSync(join(target,'undici'),{recursive:true,force:true});cpSync(join(source,'node_modules/undici'),join(target,'undici'),{recursive:true});
writeFileSync(join(root,'dependencies/mmx-cli',version,'provenance.json'),JSON.stringify({package:'mmx-cli',version,source:'https://github.com/MiniMax-AI/cli',integrity:lock.packages['node_modules/mmx-cli'].integrity,dependencies:{undici:undici.version}},null,2)+'\n');
