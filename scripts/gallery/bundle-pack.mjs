#!/usr/bin/env node
import {importWorkbenchModule,workbenchRequire} from '../lib/workbench.mjs';
/**
 * 一键将工作区资源打包为组织分发包，并校验契约、规范和可达性。
 *
 * 流程：
 * 1. 发现并解析组织 pack.yaml
 * 2. 从当前源码构建临时目录，校验后替换 dist/<pack>-bundle/
 * 3. 清理 .DS_Store 及临时缓存
 * 4. 使用宿主资源加载器校验组织、员工和技能
 * 5. 打包生成 zip 归档
 * 6. 输出归档包到 dist/（支持通过 --desktop 选项复制到桌面）
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const YAML = workbenchRequire('yaml');
import {workbenchRoot} from '../lib/workbench.mjs';
import {resourceSourceRoot} from '../lib/resource-sources.mjs';
const { parsePackDefinitionFromSource } = await importWorkbenchModule('packages/resource-loader/src/pack.ts');
const { loadEmployeeDefinition } = await importWorkbenchModule('packages/resource-loader/src/employee.ts');
const { loadSkillDefinition } = await importWorkbenchModule('packages/resource-loader/src/skill.ts');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    pack: 'short-drama',
    desktop: false,
    sync: true,
    validate: true,
    checkOnly: false,
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--pack' && args[i + 1]) options.pack = args[++i];
    else if (arg === '--no-desktop') options.desktop = false;
    else if (arg === '--desktop') options.desktop = true;
    else if (arg === '--no-sync') options.sync = false;
    else if (arg === '--no-validate') options.validate = false;
    else if (arg === '--check-only') options.checkOnly = true;
    else if (arg === '--output' && args[i + 1]) options.output = path.resolve(args[++i]);
    else if (arg === '-h' || arg === '--help') {
      console.log(`
使用方式: node scripts/gallery/bundle-pack.mjs [选项]
或通过 npm 命令: npm run bundle:pack -- [选项]

选项:
  --pack <name>       组织名称（默认: short-drama）
  --desktop           额外复制 zip 包到桌面（默认不复制）
  --no-desktop        不复制 zip 包到桌面
  --no-sync           跳过从 resources/ 自动同步到 dist/ 目录
  --no-validate       跳过组织、员工与技能结构校验
  --check-only        仅运行规范校验，不打包生成 zip
  --output <path>     自定义 zip 输出文件路径
  -h, --help          查看帮助说明
`);
      process.exit(0);
    }
  }

  return options;
}

function cleanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const fullPath = path.join(dir, ent.name);
    if (ent.name === '.DS_Store' || ent.name === '__pycache__' || ent.name.endsWith('.pyc') || ent.name.endsWith('.swp')) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else if (ent.isDirectory()) {
      cleanDirectory(fullPath);
    }
  }
}

function copyDirRecursive(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name === '.DS_Store' || ent.name === '.git') continue;
    const sPath = path.join(src, ent.name);
    const dPath = path.join(dst, ent.name);

    if (ent.isDirectory()) {
      copyDirRecursive(sPath, dPath);
    } else {
      fs.copyFileSync(sPath, dPath);
    }
  }
}

function loadBundlePack(bundleDir) {
  const employeesDir = path.join(bundleDir, 'employees');
  const profiles = fs.readdirSync(employeesDir).map(id =>
    loadEmployeeDefinition(path.join(employeesDir, id, `${id}.yaml`))
  );
  const organizationDir = path.join(bundleDir, 'organization');
  const pack = parsePackDefinitionFromSource(
    fs.readFileSync(path.join(organizationDir, 'pack.yaml'), 'utf8'),
    filename => fs.readFileSync(path.join(organizationDir, filename), 'utf8'),
    profiles
  );
  return {pack, profiles};
}

export function runValidation(bundleDir) {
  const {pack, profiles} = loadBundlePack(bundleDir);
  const skillsDir = path.join(bundleDir, 'skills');
  const skillIds = new Set();
  for (const id of fs.readdirSync(skillsDir)) {
    const skill = loadSkillDefinition(path.join(skillsDir, id, 'SKILL.md'));
    if (skill.id !== id) throw new Error(`技能目录与标识不一致: ${id}`);
    skillIds.add(id);
  }
  const required = pack.employees.flatMap(employee => {
    const profile = employee.definition && profiles.find(profile => profile.id === employee.definition.id);
    return [...(employee.skills || []), ...(profile?.skills || [])];
  });
  for (const {id} of required) {
    if (!skillIds.has(id)) throw new Error(`组织包缺少技能: ${id}`);
  }
  console.log(`[校验] ${pack.name}：${pack.employees.length} 个岗位、${skillIds.size} 个技能结构有效`);
  return true;
}

export function syncBundle(packName, bundleDir, {sourceRoot = resourceSourceRoot, validate = true} = {}) {
  if (!/^[a-z][a-z0-9-]*$/.test(packName)) throw new Error('无效的组织标识');
  const packDir = path.join(sourceRoot, 'resources/packs', packName);
  const employeeRoot = path.join(sourceRoot, 'resources/employees');
  const profiles = fs.readdirSync(employeeRoot).filter(name => name.endsWith('.yaml')).map(name =>
    loadEmployeeDefinition(path.join(employeeRoot, name))
  );
  const packConfig = parsePackDefinitionFromSource(
    fs.readFileSync(path.join(packDir, 'pack.yaml'), 'utf8'),
    filename => fs.readFileSync(path.join(packDir, filename), 'utf8'),
    profiles
  );
  console.log(`[1/5] 从源码构建组织包: ${packConfig.name} (版本: ${packConfig.version})`);
  fs.mkdirSync(path.dirname(bundleDir), {recursive: true});
  const staging = fs.mkdtempSync(path.join(path.dirname(bundleDir), '.pack-build-'));
  const previous = staging + '-previous';
  try {
    copyDirRecursive(packDir, path.join(staging, 'organization'));
    const employeeIds = new Set();
    const skillIds = new Set();
    fs.mkdirSync(path.join(staging, 'employees'));
    fs.mkdirSync(path.join(staging, 'skills'));
    for (const employee of packConfig.employees) {
      if (employee.definition) {
        const id = employee.definition.id;
        if (!employeeIds.has(id)) {
          const source = employeeRoot;
          const profile = profiles.find(profile => profile.id === id);
          const manifest = YAML.parse(fs.readFileSync(path.join(source, `${id}.yaml`), 'utf8'));
          const target = path.join(staging, 'employees', id);
          fs.mkdirSync(target);
          for (const filename of [`${id}.yaml`, manifest.instructions, manifest.playbook].filter(Boolean)) {
            fs.copyFileSync(path.join(source, filename), path.join(target, filename));
          }
          for (const skill of profile.skills) skillIds.add(skill.id);
          employeeIds.add(id);
        }
      }
      for (const skill of employee.skills || []) skillIds.add(skill.id);
    }
    for (const id of skillIds) {
      let source = path.join(sourceRoot, 'resources/extensions/skills', id);
      if (!fs.existsSync(source)) {
        const builtin = path.join(sourceRoot, 'resources/builtin/skills', id);
        source = fs.existsSync(builtin) ? builtin : path.join(workbenchRoot, 'resources/builtin/skills', id);
      }
      const skill = loadSkillDefinition(path.join(source, 'SKILL.md'));
      if (skill.id !== id) throw new Error(`技能目录与标识不一致: ${id}`);
      copyDirRecursive(source, path.join(staging, 'skills', id));
    }
    const doc = path.join(rootDir, 'docs', `${packName}.md`);
    if (fs.existsSync(doc)) {
      fs.mkdirSync(path.join(staging, 'docs'));
      fs.copyFileSync(doc, path.join(staging, 'docs', `${packName}.md`));
    }
    cleanDirectory(staging);
    if (validate) runValidation(staging);
    // 校验成功后才替换生成目录；构建失败时原包仍可读取。
    if (fs.existsSync(bundleDir)) fs.renameSync(bundleDir, previous);
    try {
      fs.renameSync(staging, bundleDir);
    } catch (error) {
      if (fs.existsSync(previous)) fs.renameSync(previous, bundleDir);
      throw error;
    }
    fs.rmSync(previous, {recursive: true, force: true});
    return packConfig;
  } finally {
    fs.rmSync(staging, {recursive: true, force: true});
  }
}

function packageZip(bundleDir, zipOutputPath) {
  console.log(`[3/5] 打包组织 ZIP 归档...`);
  cleanDirectory(bundleDir);

  fs.mkdirSync(path.dirname(zipOutputPath), { recursive: true });
  if (fs.existsSync(zipOutputPath)) fs.unlinkSync(zipOutputPath);

  execFileSync('zip', ['-rq', zipOutputPath, '.'], {
    cwd: bundleDir,
    stdio: 'ignore'
  });

  const stat = fs.statSync(zipOutputPath);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(`      生成归档: ${zipOutputPath} (${sizeMb} MB)`);
  return stat.size;
}

function exportToDesktop(zipOutputPath, packName, version) {
  console.log(`[4/5] 导出组织包到桌面...`);
  const desktopDir = path.join(os.homedir(), 'Desktop');
  if (!fs.existsSync(desktopDir)) {
    console.warn(`[WARN] 未检测到桌面目录: ${desktopDir}，跳过导出`);
    return [];
  }

  const mainDesktopZip = path.join(desktopDir, `${packName}-bundle.zip`);
  const versionedDesktopZip = path.join(desktopDir, `${packName}-bundle-v${version}.zip`);

  fs.copyFileSync(zipOutputPath, mainDesktopZip);
  fs.copyFileSync(zipOutputPath, versionedDesktopZip);

  console.log(`      - ${mainDesktopZip}`);
  console.log(`      - ${versionedDesktopZip}`);
  return [mainDesktopZip, versionedDesktopZip];
}

async function main() {
  const options = parseArgs();
  const packName = options.pack;
  const bundleDir = path.join(rootDir, 'dist', `${packName}-bundle`);

  console.log(`========================================`);
  console.log(`  Zero Point Workbench - 组织包打包工具  `);
  console.log(`========================================`);
  console.log(`目标组织: ${packName}`);
  console.log(`工作目录: ${bundleDir}\n`);

  // 1. 同步
  let packConfig = null;
  if (options.sync) {
    packConfig = syncBundle(packName, bundleDir, {validate: options.validate});
  } else {
    const packYaml = path.join(bundleDir, 'organization/pack.yaml');
    if (fs.existsSync(packYaml)) {
      packConfig = YAML.parse(fs.readFileSync(packYaml, 'utf8'));
    }
  }

  const version = packConfig?.version || 'latest';

  // 2. 校验
  if (options.validate && !options.sync) {
    runValidation(bundleDir);
  }

  if (options.checkOnly) {
    console.log(`\n[完成] 仅检查模式已完成，未生成 ZIP 包。`);
    return;
  }

  // 3. 打包
  const defaultZipOutput = path.join(rootDir, 'dist', `${packName}-bundle.zip`);
  const zipOutputPath = options.output || defaultZipOutput;
  const sizeBytes = packageZip(bundleDir, zipOutputPath);

  // 4. 导出到桌面
  let desktopFiles = [];
  if (options.desktop) {
    desktopFiles = exportToDesktop(zipOutputPath, packName, version);
  }

  // 5. 总结
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
  console.log(`\n[5/5] 打包圆满完成！`);
  console.log(`----------------------------------------`);
  console.log(`- 组织名称: ${packConfig?.name || packName}`);
  console.log(`- 组织版本: v${version}`);
  console.log(`- 岗位数量: ${packConfig?.employees?.length || 9}`);
  console.log(`- 归档大小: ${sizeMb} MB`);
  console.log(`- 产物路径: ${zipOutputPath}`);
  if (desktopFiles.length > 0) {
    console.log(`- 桌面副本:`);
    for (const f of desktopFiles) console.log(`    ${f}`);
  }
  console.log(`----------------------------------------`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((err) => {
  console.error('\n[FATAL] 打包失败:', err.message);
  process.exit(1);
});
