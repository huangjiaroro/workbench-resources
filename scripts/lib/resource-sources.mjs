import {importWorkbenchModule} from './workbench.mjs';
const {loadEmployeeDefinition} = await importWorkbenchModule('packages/resource-loader/src/employee.ts');
const {parsePackDefinitionFromSource} = await importWorkbenchModule('packages/resource-loader/src/pack.ts');
/** Repository tooling only. Extension sources are never a runtime installation fallback. */
import {readdirSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const {loadSkillDefinition,readSkillFiles,skillPackageDigest} = await importWorkbenchModule('packages/resource-loader/src/skill.ts');
const {parsePluginManifest} = await importWorkbenchModule('packages/resource-loader/src/plugin.ts');
const {pluginSkills} = await importWorkbenchModule('packages/resource-loader/src/plugin-skills.ts');
/** Optional authoring checkout used by publishing tools and extension integration tests. */
export const resourceSourceRoot=resolve(process.env.WORKBENCH_RESOURCE_SOURCE_ROOT || fileURLToPath(new URL('../../',import.meta.url)));
export const extensionPluginRoot=join(resourceSourceRoot,'resources/extensions/plugins');
export const extensionSkillRoot=join(resourceSourceRoot,'resources/extensions/skills');
export function loadExtensionEmployees(){
 const root=join(resourceSourceRoot,'resources/employees');
 return readdirSync(root).filter(name=>name.endsWith('.yaml')).sort().map(name=>loadEmployeeDefinition(join(root,name)));
}
export function loadExtensionPacks(){
 const root=join(resourceSourceRoot,'resources/packs'),profiles=loadExtensionEmployees();
 return readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>{
  const folder=join(root,entry.name);
  return parsePackDefinitionFromSource(readFileSync(join(folder,'pack.yaml'),'utf8'),filename=>readFileSync(join(folder,filename),'utf8'),profiles);
 });
}
export function loadExtensionPlugins(){return readdirSync(extensionPluginRoot,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>{
 const root=join(extensionPluginRoot,e.name),p=parsePluginManifest(readFileSync(join(root,'plugin.yaml'),'utf8'));
 if(p.id!==e.name)throw new Error('Extension plugin directory identity mismatch');
 const files=readSkillFiles(root);
 return {...p,bundledSkills:pluginSkills(p,files).map(({path,definition:s})=>({id:s.id,name:s.name,description:s.description,path})),builtin:false,source:'imported',digest:skillPackageDigest(files),documentation:readFileSync(join(root,p.docs),'utf8'),installed:true,libraryRevision:1};
});}
export function loadExtensionSkills(){return readdirSync(extensionSkillRoot,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>loadSkillDefinition(join(extensionSkillRoot,e.name,'SKILL.md')));}
