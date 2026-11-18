import {importWorkbenchModule} from '../lib/workbench.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadExtensionSkills} from '../lib/resource-sources.mjs';
const {createSkillDistribution,parseDistribution,sha256} = await importWorkbenchModule('packages/resource-loader/src/distribution.ts');
const destination=fileURLToPath(new URL('../../dist/skills/',import.meta.url));mkdirSync(destination,{recursive:true});
const skills=loadExtensionSkills().map(skill=>{
 const bytes=createSkillDistribution(skill),pkg=parseDistribution(bytes),name=`${skill.id}-${skill.version}.wbskill`;
 if(pkg.manifest.payloadDigest!==skill.digest)throw new Error('Skill archive verification failed');
 writeFileSync(join(destination,name),bytes);return {id:skill.id,version:skill.version,name,bytes:bytes.length,sha256:sha256(bytes),payloadDigest:skill.digest};
});
writeFileSync(join(destination,'index.json'),JSON.stringify({format:1,skills},null,2)+'\n');console.log(JSON.stringify({destination,skills:skills.map(({id,version})=>({id,version}))},null,2));
