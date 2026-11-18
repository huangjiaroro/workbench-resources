import {cpSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {packageRoot,targetRoot,runtimePaths}=JSON.parse(input);
for(const file of ['comfy.mjs','engine.mjs','workflows'])cpSync(join(packageRoot,file),join(targetRoot,file),{recursive:true});
execFileSync(runtimePaths.node,[join(targetRoot,'comfy.mjs'),'--help'],{stdio:'pipe'});
console.log('zp-comfy ready');
