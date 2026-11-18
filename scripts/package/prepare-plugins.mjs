import {readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {extensionPluginRoot as root} from '../lib/resource-sources.mjs';
// Source-owned packaging dependencies only. Installation uses the optional manifest prepare lifecycle.
for(const entry of readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory())){
 const script=join(root,entry.name,'prepare.mjs');if(existsSync(script))execFileSync(process.execPath,[script],{stdio:'inherit'});
}
