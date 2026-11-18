import {importWorkbenchModule} from '../lib/workbench.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadExtensionPlugins,extensionPluginRoot} from '../lib/resource-sources.mjs';
const {readSkillFiles,skillPackageDigest} = await importWorkbenchModule('packages/resource-loader/src/skill.ts');
const {parsePluginManifest} = await importWorkbenchModule('packages/resource-loader/src/plugin.ts');
const {createPluginDistribution,parseDistribution,sha256} = await importWorkbenchModule('packages/resource-loader/src/distribution.ts');
const destination=fileURLToPath(new URL('../../dist/plugins/',import.meta.url));mkdirSync(destination,{recursive:true});
const index=[];
for(const {id}of loadExtensionPlugins()){
 const files=readSkillFiles(join(extensionPluginRoot,id)),definition=parsePluginManifest(files.find(f=>f.path==='plugin.yaml').content.toString('utf8'));
 const bytes=createPluginDistribution(definition,files,'Independent native tool package format 3'),name=`${id}-${definition.version}.wbplugin`;
 const parsed=parseDistribution(bytes);if(parsed.manifest.payloadDigest!==skillPackageDigest(files))throw new Error('Plugin archive verification failed');
 writeFileSync(join(destination,name),bytes);index.push({id,version:definition.version,name,bytes:bytes.length,sha256:sha256(bytes),payloadDigest:parsed.manifest.payloadDigest});
}
writeFileSync(join(destination,'index.json'),JSON.stringify({format:3,plugins:index},null,2)+'\n');
console.log(JSON.stringify({destination,plugins:index.map(({id,version,bytes})=>({id,version,bytes}))},null,2));
