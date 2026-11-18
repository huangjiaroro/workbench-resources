#!/usr/bin/env node
import {workbenchRequire} from '../lib/workbench.mjs';
/**
 * 一键将组织、员工、技能及插件发布到 Hub 并同步本地工作台。
 * 遵循 Workbench 资源生命周期及 Hub 规范：
 * 1. 插件（Plugin）与技能（Skill）前置发布（自动分块处理超大包体，自动 Fork 已有库资源）
 * 2. 本地工作台实例同步（配置、产物契约、角色职责、员工 Playbook 及技能绑定）
 * 3. 员工模板（Employee Template）发布（绑定正式技能依赖，自动重试限流）
 * 4. 组织模板（Organization Template）发布（聚合已发布正式员工）
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
const YAML = workbenchRequire('yaml');
import {resourceSourceRoot} from '../lib/resource-sources.mjs';

const rootDir = resourceSourceRoot;

const defaultDataDir = path.join(
  process.env.HOME || '',
  'Library/Application Support/com.zeropoint.workbench'
);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    pack: 'short-drama',
    dataDir: defaultDataDir,
    sourceId: '',
    dryRun: false,
    skipSync: false,
    force: false,
    plugin: '',
    allPlugins: false,
    withPlugins: false,
    releaseType: 'patch',
    changelog: ''
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--skip-sync') options.skipSync = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--with-plugins') options.withPlugins = true;
    else if (arg === '--all-plugins') options.allPlugins = true;
    else if (arg === '--plugin' && args[i + 1]) options.plugin = args[++i];
    else if (arg === '--pack' && args[i + 1]) options.pack = args[++i];
    else if (arg === '--data-dir' && args[i + 1]) options.dataDir = args[++i];
    else if (arg === '--source-id' && args[i + 1]) options.sourceId = args[++i];
    else if (arg === '--release-type' && args[i + 1]) options.releaseType = args[++i];
    else if (arg === '--changelog' && args[i + 1]) options.changelog = args[++i];
  }
  return options;
}

class DaemonClient {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.token = '';
    this.port = 0;
  }

  async connect() {
    const tokenPath = path.join(this.dataDir, 'daemon-token');
    if (!fs.existsSync(tokenPath)) {
      throw new Error(`未找到 daemon-token（路径：${tokenPath}），请先启动工作台桌面或守护进程`);
    }
    this.token = fs.readFileSync(tokenPath, 'utf8').trim();

    const endpointPath = path.join(this.dataDir, 'daemon-endpoint.json');
    if (fs.existsSync(endpointPath)) {
      try {
        const ep = JSON.parse(fs.readFileSync(endpointPath, 'utf8'));
        if (ep.port && (await this.ping(ep.port))) {
          this.port = ep.port;
          return;
        }
      } catch {}
    }

    // 扫描端口
    for (let p = 52320; p <= 54999; p++) {
      if (await this.ping(p)) {
        this.port = p;
        return;
      }
    }
    throw new Error('无法连接到 Workbench Daemon 进程');
  }

  async ping(port) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/v1/health',
        method: 'GET',
        headers: { authorization: `Bearer ${this.token}` },
        timeout: 1000
      }, (res) => resolve(res.statusCode === 200));
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });
  }

  async request(method, reqPath, body = null, retries = 10) {
    const dataString = body !== null ? JSON.stringify(body) : '';
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await new Promise((resolve, reject) => {
          const req = http.request({
            hostname: '127.0.0.1',
            port: this.port,
            path: reqPath,
            method,
            headers: {
              authorization: `Bearer ${this.token}`,
              'content-type': 'application/json',
              ...(dataString ? { 'content-length': Buffer.byteLength(dataString) } : {})
            }
          }, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
            res.on('end', () => {
              try {
                resolve({ status: res.statusCode, data: JSON.parse(resBody) });
              } catch {
                resolve({ status: res.statusCode, text: resBody });
              }
            });
          });
          req.on('error', reject);
          if (dataString) req.write(dataString);
          req.end();
        });

        const isRateLimit = result.status === 429 ||
          (result.data && (result.data.error === 'rate_limited' || result.data.code === 'gallery_request_failed'));
        if (isRateLimit && attempt < retries) {
          const waitMs = Math.max(5000, attempt * 5000);
          console.log(`[Rate Limit] 接口请求触发频控，等待 ${waitMs / 1000} 秒后重试 (第 ${attempt}/${retries} 次)...`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        return result;
      } catch (err) {
        if (attempt === retries) throw err;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
}

function loadPackageFiles(dirPath) {
  const files = [];
  function walk(current, relative = '') {
    for (const item of fs.readdirSync(current)) {
      if (item === '.DS_Store' || item === 'node_modules' || item === '.git') continue;
      const full = path.join(current, item);
      const rel = relative ? `${relative}/${item}` : item;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full, rel);
      } else {
        files.push({
          path: rel,
          content: fs.readFileSync(full),
          executable: (stat.mode & 0o111) !== 0
        });
      }
    }
  }
  walk(dirPath);
  return files;
}

function computeDigest(files) {
  const hash = crypto.createHash('sha256');
  for (const file of [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
    hash.update(file.path).update('\0').update(file.executable ? '1' : '0').update('\0')
      .update(String(file.content.length)).update('\0').update(file.content);
  }
  return hash.digest('hex');
}

function parseYamlSimple(content) {
  const lines = content.split('\n');
  const result = { employees: [], plugins: [] };
  let currentEmp = null;
  let inSkills = false;
  let inPlugins = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (line.startsWith('id:')) result.id = trimmed.slice(3).trim();
    else if (line.startsWith('version:')) result.version = trimmed.slice(8).trim();
    else if (line.startsWith('name:')) result.name = trimmed.slice(5).trim();
    else if (line.startsWith('playbook:')) result.playbook = trimmed.slice(9).trim();
    else if (line.startsWith('artifactContract:')) result.artifactContract = trimmed.slice(17).trim();
    else if (line.startsWith('plugins:')) {
      inPlugins = true;
      inSkills = false;
    } else if (inPlugins && trimmed.startsWith('- id:')) {
      result.plugins.push(trimmed.slice(5).trim());
    } else if (line.startsWith('- role:')) {
      inPlugins = false;
      inSkills = false;
      currentEmp = { role: trimmed.slice(7).trim(), skills: [] };
      result.employees.push(currentEmp);
    } else if (currentEmp && trimmed === 'skills:') {
      inSkills = true;
    } else if (currentEmp && inSkills && trimmed.startsWith('- id:')) {
      currentEmp.skills.push(trimmed.slice(5).trim());
    } else if (currentEmp && trimmed.startsWith('roleInstructions:')) {
      inSkills = false;
      currentEmp.roleInstructions = trimmed.slice(17).trim();
    } else if (currentEmp && trimmed.startsWith('id:') && !currentEmp.definitionId) {
      currentEmp.definitionId = trimmed.slice(3).trim();
    } else if (currentEmp && trimmed.startsWith('name:') && !currentEmp.name) {
      currentEmp.name = trimmed.slice(5).trim();
    }
  }
  return result;
}

function extractUnresolvedJobId(errMsg) {
  if (!errMsg) return null;
  const match = /(?:先查询原发布|已有发布提交)\s+([a-zA-Z0-9_-]+)/.exec(errMsg);
  return match ? match[1] : null;
}

async function reconcileUnresolved(client, jobId, label) {
  console.log(`[Reconcile] 查询未决发布任务 ${jobId} 的结果...`);
  const queryRes = await client.request('POST', `/v2/gallery/publication-drafts/${jobId}/query`, {});
  if (queryRes.status === 200 && (queryRes.data?.state === 'completed' || queryRes.data?.result?.published)) {
    const assignedVersion = queryRes.data?.payload?.version || queryRes.data?.result?.version;
    console.log(`✓ ${label} 对齐原发布成功 (版本: v${assignedVersion})`);
    return { version: assignedVersion, jobId };
  }
  return null;
}

/**
 * 统一发布包资源（技能 Skill 或 插件 Plugin）
 */
async function publishPackageResource(client, sourceId, kind, id, changelog, dryRun, force = false) {
  const dirName = kind === 'skill' ? 'skills' : 'plugins';
  const resourceDir = path.join(rootDir, 'resources/extensions', dirName, id);
  if (!fs.existsSync(resourceDir)) return null;

  const rawFiles = loadPackageFiles(resourceDir);
  const resourceLabel = kind === 'skill' ? '技能' : '插件';
  if (dryRun) {
    console.log(`[Dry Run] 准备发布${resourceLabel} ${id} (${rawFiles.length} 个文件)`);
    return { id, kind, dryRun: true };
  }

  const draftsRes = await client.request('GET', `/v2/resources/drafts?kind=${kind}`);
  const existingDraft = draftsRes.data?.drafts?.find(d => d.kind === kind && d.id === id);
  const libRes = await client.request('GET', '/v2/gallery/library');
  const installedList = kind === 'skill' ? libRes.data?.skills : libRes.data?.plugins;
  const installed = installedList?.find(s => s.id === id && s.version !== 'draft');

  const localDigest = computeDigest(rawFiles);
  if (!force && installed && installed.digest === localDigest) {
    console.log(`✓ ${resourceLabel} ${id.padEnd(24)} 已是最新 (版本: v${installed.version}, 内容无变更)`);
    return { id, kind, version: installed.version, skipped: true };
  }

  let currentRevision = 0;
  if (existingDraft) {
    currentRevision = existingDraft.revision;
  } else if (installed) {
    const forkRes = await client.request('POST', `/v2/resources/${kind}/${id}/fork`, {});
    if (forkRes.status !== 201) throw new Error(`Fork 失败: ${JSON.stringify(forkRes.data)}`);
    currentRevision = 1;
  }

  let updatedRevision = currentRevision;
  const toObj = (list) => Object.fromEntries(
    list.map(f => [f.path, {
      encoding: 'base64',
      content: f.content.toString('base64'),
      executable: Boolean(f.executable)
    }])
  );

  const totalBytes = rawFiles.reduce((sum, f) => sum + f.content.length, 0);
  if (totalBytes > 1_500_000) {
    // 超大包分块上传
    const entryFile = rawFiles.find(f => f.path === (kind === 'skill' ? 'SKILL.md' : 'plugin.yaml'));
    const rest = rawFiles.filter(f => f.path !== entryFile?.path);
    const chunkSize = 20;
    const b1 = [entryFile, ...rest.slice(0, chunkSize - 1)].filter(Boolean);

    let res = await client.request('POST', `/v2/resources/${kind}/${id}/draft`, {
      expectedRevision: updatedRevision,
      files: toObj(b1)
    });
    if (res.status !== 201) throw new Error(`Draft 首批保存失败: ${JSON.stringify(res.data)}`);
    updatedRevision = res.data.revision;

    for (let i = chunkSize - 1; i < rest.length; i += chunkSize) {
      const slice = rest.slice(i, i + chunkSize);
      res = await client.request('POST', `/v2/resources/${kind}/${id}/draft`, {
        expectedRevision: updatedRevision,
        changes: toObj(slice)
      });
      if (res.status !== 201) throw new Error(`Draft 增量保存失败: ${JSON.stringify(res.data)}`);
      updatedRevision = res.data.revision;
    }
  } else {
    const res = await client.request('POST', `/v2/resources/${kind}/${id}/draft`, {
      expectedRevision: currentRevision,
      files: toObj(rawFiles)
    });
    if (res.status !== 201) throw new Error(`Draft 保存失败: ${JSON.stringify(res.data)}`);
    updatedRevision = res.data.revision;
  }

  // 准备发布草稿
  let jobId;
  const prepRes = await client.request('POST', '/v2/gallery/publication-drafts', {
    sourceId,
    kind,
    id,
    draftRevision: updatedRevision,
    operationKey: `${id}-${Date.now()}`,
    changelog
  });
  if (prepRes.status !== 201) {
    if (prepRes.data?.code === 'publication_unresolved') {
      const unresolvedId = extractUnresolvedJobId(prepRes.data.error);
      if (unresolvedId) {
        const resolved = await reconcileUnresolved(client, unresolvedId, `${resourceLabel} ${id.padEnd(24)}`);
        if (resolved) {
          return { id, kind, version: resolved.version, jobId: unresolvedId };
        }
      }
    }
    throw new Error(`发布草稿创建失败: ${JSON.stringify(prepRes.data)}`);
  }
  jobId = prepRes.data.id;

  // 上传
  const uploadRes = await client.request('POST', `/v2/gallery/publication-drafts/${jobId}/upload`, {});
  if (uploadRes.status !== 200) throw new Error(`上传失败: ${JSON.stringify(uploadRes.data)}`);

  // 发布
  const pubRes = await client.request('POST', `/v2/gallery/publication-drafts/${jobId}/publish`, {});
  if (pubRes.status !== 200) {
    if (pubRes.data?.code === 'publication_unresolved') {
      const resolved = await reconcileUnresolved(client, jobId, `${resourceLabel} ${id.padEnd(24)}`);
      if (resolved) {
        return { id, kind, version: resolved.version, jobId };
      }
    }
    throw new Error(`发布失败: ${JSON.stringify(pubRes.data)}`);
  }

  const assignedVersion = pubRes.data?.payload?.version || pubRes.data?.result?.version;
  console.log(`✓ ${resourceLabel} ${id.padEnd(24)} 发布成功 (版本: v${assignedVersion})`);
  return { id, kind, version: assignedVersion, jobId };
}

async function publishEmployee(client, sourceId, employeeId, templateId, changelog, releaseType, dryRun, force = false) {
  if (dryRun) {
    console.log(`[Dry Run] 准备发布员工模板 ${templateId}`);
    return { templateId, dryRun: true };
  }

  if (!force) {
    const stateRes = await client.request('GET', `/v2/resources/templates/employee/instances/${employeeId}`);
    const state = stateRes.data;
    if (state && state.modified === false && state.unpublished === false && state.lastPublication) {
      console.log(`✓ 员工 ${templateId.padEnd(32)} 已是最新 (版本: v${state.lastPublication.version}, 内容无变更)`);
      return { templateId, version: state.lastPublication.version, skipped: true };
    }
  }

  const previewRes = await client.request('POST', '/v2/resources/templates/publication-preview', {
    kind: 'employee',
    instanceId: employeeId,
    id: templateId,
    releaseType
  });
  if (previewRes.status !== 200) throw new Error(`员工预览失败: ${JSON.stringify(previewRes.data)}`);
  const preview = previewRes.data;

  let jobId;
  const prepRes = await client.request('POST', '/v2/gallery/publication-drafts', {
    kind: 'employee',
    id: templateId,
    sourceId,
    releaseType,
    instanceId: employeeId,
    sourceFingerprint: preview.fingerprint,
    operationKey: `${templateId}-${Date.now()}`,
    changelog
  });
  if (prepRes.status !== 201) {
    if (prepRes.data?.code === 'publication_unresolved') {
      const unresolvedId = extractUnresolvedJobId(prepRes.data.error);
      if (unresolvedId) {
        const resolved = await reconcileUnresolved(client, unresolvedId, `员工 ${templateId.padEnd(32)}`);
        if (resolved) {
          return { templateId, version: resolved.version, jobId: unresolvedId };
        }
      }
    }
    throw new Error(`员工发布草稿失败: ${JSON.stringify(prepRes.data)}`);
  }
  jobId = prepRes.data.id;

  const uploadRes = await client.request('POST', `/v2/gallery/publication-drafts/${jobId}/upload`, {});
  if (uploadRes.status !== 200) throw new Error(`员工上传失败: ${JSON.stringify(uploadRes.data)}`);

  const pubRes = await client.request('POST', `/v2/gallery/publication-drafts/${jobId}/publish`, {});
  if (pubRes.status !== 200) {
    if (pubRes.data?.code === 'publication_unresolved') {
      const resolved = await reconcileUnresolved(client, jobId, `员工 ${templateId.padEnd(32)}`);
      if (resolved) {
        return { templateId, version: resolved.version, jobId };
      }
    }
    throw new Error(`员工发布失败: ${JSON.stringify(pubRes.data)}`);
  }

  const assignedVersion = pubRes.data?.payload?.version || pubRes.data?.result?.version;
  console.log(`✓ 员工 ${templateId.padEnd(32)} 发布成功 (版本: v${assignedVersion})`);
  return { templateId, version: assignedVersion, jobId };
}

async function publishOrganization(client, sourceId, orgInstanceId, templateId, changelog, releaseType, dryRun, force = false) {
  if (dryRun) {
    console.log(`[Dry Run] 准备发布组织模板 ${templateId}`);
    return { templateId, dryRun: true };
  }

  if (!force) {
    const stateRes = await client.request('GET', `/v2/resources/templates/organization/instances/${orgInstanceId}`);
    const state = stateRes.data;
    if (state && state.modified === false && state.unpublished === false && state.lastPublication) {
      console.log(`✓ 组织 ${templateId.padEnd(32)} 已是最新 (版本: v${state.lastPublication.version}, 内容无变更)`);
      return { templateId, version: state.lastPublication.version, skipped: true };
    }
  }

  const previewRes = await client.request('POST', '/v2/resources/templates/publication-preview', {
    kind: 'organization',
    instanceId: orgInstanceId,
    id: templateId,
    releaseType
  });
  if (previewRes.status !== 200) throw new Error(`组织预览失败: ${JSON.stringify(previewRes.data)}`);
  const preview = previewRes.data;

  let jobId;
  const prepRes = await client.request('POST', '/v2/gallery/publication-drafts', {
    kind: 'organization',
    id: templateId,
    sourceId,
    releaseType,
    instanceId: orgInstanceId,
    sourceFingerprint: preview.fingerprint,
    operationKey: `${templateId}-${Date.now()}`,
    changelog
  });
  if (prepRes.status !== 201) {
    if (prepRes.data?.code === 'publication_unresolved') {
      const unresolvedId = extractUnresolvedJobId(prepRes.data.error);
      if (unresolvedId) {
        const resolved = await reconcileUnresolved(client, unresolvedId, `组织 ${templateId.padEnd(32)}`);
        if (resolved) {
          return { templateId, version: resolved.version, jobId: unresolvedId };
        }
      }
    }
    throw new Error(`组织发布草稿失败: ${JSON.stringify(prepRes.data)}`);
  }
  jobId = prepRes.data.id;

  const uploadRes = await client.request('POST', `/v2/gallery/publication-drafts/${jobId}/upload`, {});
  if (uploadRes.status !== 200) throw new Error(`组织上传失败: ${JSON.stringify(uploadRes.data)}`);

  const pubRes = await client.request('POST', `/v2/gallery/publication-drafts/${jobId}/publish`, {});
  if (pubRes.status !== 200) {
    if (pubRes.data?.code === 'publication_unresolved') {
      const resolved = await reconcileUnresolved(client, jobId, `组织 ${templateId.padEnd(32)}`);
      if (resolved) {
        return { templateId, version: resolved.version, jobId };
      }
    }
    throw new Error(`组织发布失败: ${JSON.stringify(pubRes.data)}`);
  }

  const assignedVersion = pubRes.data?.payload?.version || pubRes.data?.result?.version;
  console.log(`✓ 组织 ${templateId.padEnd(32)} 发布成功 (版本: v${assignedVersion})`);
  return { templateId, version: assignedVersion, jobId };
}

async function main() {
  const options = parseArgs();
  console.log(`\n======================================================`);
  console.log(`🚀 Workbench 资源统一发布流水线`);
  console.log(`======================================================`);
  console.log(`模式: ${options.dryRun ? '预览 (Dry Run)' : '正式发布'}`);

  const client = new DaemonClient(options.dataDir);
  await client.connect();
  console.log(`已连接 Daemon (端口: ${client.port})`);

  // 获取 Hub 源
  const sourcesRes = await client.request('GET', '/v2/gallery/sources');
  const sources = sourcesRes.data?.sources?.filter(s => s.enabled) || [];
  const source = options.sourceId
    ? sources.find(s => s.id === options.sourceId)
    : sources.find(s => s.scopes?.includes('publish') && s.scopes?.includes('upload')) || sources[0];

  if (!source) throw new Error('未找到具有发布权限的 Hub 源');
  console.log(`发布目标 Hub: ${source.url} (Publisher: ${source.publisherId})`);

  // --- 单独发布指定插件模式 ---
  if (options.plugin) {
    console.log(`\n--- 单独发布插件: ${options.plugin} ---`);
    const changelog = options.changelog || `更新插件 ${options.plugin}`;
    const res = await publishPackageResource(client, source.id, 'plugin', options.plugin, changelog, options.dryRun);
    console.log(`\n✨ 插件 ${options.plugin} 处理完成！`);
    return;
  }

  // --- 批量发布所有插件模式 ---
  if (options.allPlugins) {
    console.log(`\n--- 批量发布全部扩展插件 ---`);
    const pluginDirs = fs.readdirSync(path.join(rootDir, 'resources/extensions/plugins'))
      .filter(item => fs.statSync(path.join(rootDir, 'resources/extensions/plugins', item)).isDirectory());
    for (const p of pluginDirs) {
      const changelog = options.changelog || `更新扩展插件 ${p}`;
      await publishPackageResource(client, source.id, 'plugin', p, changelog, options.dryRun);
      if (!options.dryRun) await new Promise(r => setTimeout(r, 800));
    }
    console.log(`\n✨ 全部扩展插件处理完成！`);
    return;
  }

  // --- 组织包（Pack）发布模式 ---
  console.log(`目标 Pack: ${options.pack}`);
  const packDir = path.join(rootDir, 'resources/packs', options.pack);
  const packYamlPath = path.join(packDir, 'pack.yaml');
  if (!fs.existsSync(packYamlPath)) {
    throw new Error(`未找到包配置文件: ${packYamlPath}`);
  }
  const packConfig = YAML.parse(fs.readFileSync(packYamlPath, 'utf8'));
  console.log(`包名称: ${packConfig.name || options.pack} (v${packConfig.version})`);

  for (const emp of packConfig.employees || []) {
    const defId = emp.definition?.id || emp.definitionId || emp.role;
    emp.definitionId = defId;
    const empYamlPath = path.join(rootDir, 'resources/employees', `${defId}.yaml`);
    if (fs.existsSync(empYamlPath)) {
      const empData = YAML.parse(fs.readFileSync(empYamlPath, 'utf8'));
      const inheritedSkills = (empData.skills || []).map(s => typeof s === 'string' ? s : s.id);
      emp.skills = Array.from(new Set([...(emp.skills || []), ...inheritedSkills]));
    }
  }

  const changelog = options.changelog || `同步 v${packConfig.version} ${packConfig.name || options.pack} 规范与资源包`;

  // 1. 可选发布组织引用的扩展插件
  const rawPlugins = (packConfig.plugins || []).map(p => typeof p === 'string' ? p : p.id).filter(Boolean);
  if (options.withPlugins && rawPlugins.length) {
    console.log(`\n--- 阶段 1: 扫描并发布组织扩展插件 (${rawPlugins.length} 个) ---`);
    const availablePlugins = new Set(
      fs.readdirSync(path.join(rootDir, 'resources/extensions/plugins'))
        .filter(item => fs.statSync(path.join(rootDir, 'resources/extensions/plugins', item)).isDirectory())
    );
    for (const p of rawPlugins) {
      if (availablePlugins.has(p)) {
        await publishPackageResource(client, source.id, 'plugin', p, changelog, options.dryRun);
        if (!options.dryRun) await new Promise(r => setTimeout(r, 600));
      }
    }
  }

  // 2. 扫描并发布扩展技能
  console.log(`\n--- 阶段 2: 扫描并发布扩展技能 ---`);
  const allExtensionSkillDirs = fs.readdirSync(path.join(rootDir, 'resources/extensions/skills'))
    .filter(item => fs.statSync(path.join(rootDir, 'resources/extensions/skills', item)).isDirectory());

  const neededSkillIds = new Set();
  for (const emp of packConfig.employees) {
    for (const s of emp.skills) neededSkillIds.add(s);
  }

  const targetSkills = allExtensionSkillDirs.filter(s => neededSkillIds.has(s));
  console.log(`涉及扩展技能 (${targetSkills.length} 个): ${targetSkills.join(', ')}`);

  const skillResults = [];
  for (const s of targetSkills) {
    const res = await publishPackageResource(client, source.id, 'skill', s, changelog, options.dryRun, options.force);
    if (res) skillResults.push(res);
    if (!options.dryRun && !res?.skipped) await new Promise(r => setTimeout(r, 2000)); // 避免高频 429
  }

  // 3. 本地工作台实例同步
  console.log(`\n--- 阶段 3: 同步本地工作台组织实例 ---`);
  const orgsRes = await client.request('GET', '/v2/organizations');
  const orgs = orgsRes.data?.organizations || [];
  const localOrg = orgs.find(o => o.name === packConfig.name) || orgs[0];

  if (!localOrg) {
    console.log(`未找到匹配的本地组织实例，跳过本地同步。`);
  } else if (options.skipSync) {
    console.log(`参数指定跳过本地同步。`);
  } else if (options.dryRun) {
    console.log(`[Dry Run] 组织实例 ${localOrg.name} (${localOrg.id}) 检查通过，Dry Run 模式下跳过实际写入。`);
  } else {
    console.log(`同步组织实例: ${localOrg.name} (${localOrg.id})`);

    const playbookFile = path.join(packDir, packConfig.playbook || 'playbook.md');
    const artifactFile = path.join(packDir, packConfig.artifactContract || 'artifacts.yaml');
    const playbookText = fs.existsSync(playbookFile) ? fs.readFileSync(playbookFile, 'utf8') : '';
    const artifactText = fs.existsSync(artifactFile) ? fs.readFileSync(artifactFile, 'utf8') : '';

    const orgConfigRes = await client.request('GET', `/v2/organizations/${localOrg.id}/config`);
    const orgConfig = orgConfigRes.data?.organization;
    if (orgConfig) {
      await client.request('POST', `/v2/organizations/${localOrg.id}/config`, {
        expectedRevision: orgConfig.revision,
        name: orgConfig.name,
        leaderEmployeeId: orgConfig.leaderEmployeeId,
        defaultCore: orgConfig.defaultCore || 'auto',
        defaultModel: orgConfig.defaultModel,
        defaultReasoningEffort: orgConfig.defaultReasoningEffort,
        archived: Boolean(orgConfig.archived),
        workMode: orgConfig.workMode,
        useLocalDevelopment: Boolean(orgConfig.useLocalDevelopment),
        playbook: playbookText,
        artifactContractYaml: artifactText
      });
      console.log(`✓ 组织 Playbook 与产物契约已更新`);
    }

    const rolesRes = await client.request('GET', `/v2/organizations/${localOrg.id}/roles`);
    for (const r of rolesRes.data?.roles || []) {
      const empDef = packConfig.employees.find(e => e.role === r.roleKey);
      if (!empDef?.roleInstructions) continue;
      const roleFile = path.join(packDir, empDef.roleInstructions);
      if (fs.existsSync(roleFile)) {
        await client.request('POST', `/v2/roles/${r.id}`, {
          expectedRevision: r.revision,
          roleKey: r.roleKey,
          name: r.name,
          description: r.description,
          canDelegate: r.canDelegate === 1,
          instructions: fs.readFileSync(roleFile, 'utf8')
        });
        console.log(`✓ 岗位 [${r.name}] 职责说明已更新`);
      }
    }

    const membersRes = await client.request('GET', `/v2/organizations/${localOrg.id}/members`);
    for (const m of membersRes.data?.members || []) {
      const empDef = packConfig.employees.find(e => e.role === m.role);
      if (!empDef) continue;

      const baseName = empDef.definitionId || empDef.role;
      const empInstrFile = path.join(rootDir, 'resources/employees', `${baseName}.md`);
      const empPlayFile = path.join(rootDir, 'resources/employees', `${baseName}-playbook.md`);

      const empRes = await client.request('GET', `/v2/employees/${m.employeeId}`);
      const emp = empRes.data?.employee;
      if (emp) {
        await client.request('POST', `/v2/employees/${m.employeeId}`, {
          expectedRevision: emp.revision,
          displayName: emp.displayName,
          description: emp.description,
          avatarKey: emp.avatarKey,
          preferredCore: emp.preferredCore,
          defaultModel: emp.defaultModel,
          defaultReasoningEffort: emp.defaultReasoningEffort,
          instructions: fs.existsSync(empInstrFile) ? fs.readFileSync(empInstrFile, 'utf8') : emp.instructions,
          playbook: fs.existsSync(empPlayFile) ? fs.readFileSync(empPlayFile, 'utf8') : emp.playbook
        });
      }

      const skillsRes = await client.request('GET', `/v2/employees/${m.employeeId}/skills`);
      const curSkills = skillsRes.data?.skills || [];
      const targetSkillsSet = new Set(empDef.skills);

      for (const cs of curSkills) {
        if (!targetSkillsSet.has(cs.id)) {
          await client.request('POST', `/v2/employees/${m.employeeId}/skills`, {
            skillId: cs.id,
            enabled: false,
            remove: true
          });
        }
      }
      for (const ts of empDef.skills) {
        const existing = curSkills.find(cs => cs.id === ts);
        if (!existing || !existing.enabled) {
          await client.request('POST', `/v2/employees/${m.employeeId}/skills`, {
            skillId: ts,
            enabled: true
          });
        }
      }
      console.log(`✓ 员工 [${m.employeeName || m.role}] 工作方法与技能绑定已对齐 (${empDef.skills.length} 个技能)`);
    }
  }

  // 4. 发布员工模板
  console.log(`\n--- 阶段 4: 聚合发布员工模板 ---`);
  const membersRes = await client.request('GET', `/v2/organizations/${localOrg.id}/members`);
  const members = membersRes.data?.members || [];

  const empResults = [];
  for (const m of members) {
    const templateId = `${source.publisherId}-${m.role === 'leader' ? 'project-lead' : m.role === 'writer' ? 'screenwriter' : m.role === 'researcher' ? 'creative-researcher' : m.role === 'reviewer' ? 'quality-reviewer' : m.role === 'visual' ? 'visual-designer' : m.role === 'director' ? 'storyboard-director' : m.role === 'video' ? 'video-producer' : m.role === 'music' ? 'music-producer' : m.role === 'post' ? 'post-producer' : m.role}`;
    const res = await publishEmployee(
      client,
      source.id,
      m.employeeId,
      templateId,
      changelog,
      options.releaseType,
      options.dryRun,
      options.force
    );
    empResults.push(res);
    if (!options.dryRun && !res?.skipped) await new Promise(r => setTimeout(r, 2000)); // 避免 429
  }

  // 5. 发布组织模板
  console.log(`\n--- 阶段 5: 发布组织模板 ---`);
  const orgTemplateId = `${source.publisherId}-${options.pack}`;
  const orgResult = await publishOrganization(
    client,
    source.id,
    localOrg.id,
    orgTemplateId,
    changelog,
    options.releaseType,
    options.dryRun,
    options.force
  );

  console.log(`\n======================================================`);
  console.log(`✨ 全部发布与同步成功完成！`);
  console.log(`======================================================`);
  console.log(`组织模板: ${orgTemplateId} (版本: v${orgResult.version || 'dry-run'})`);
  console.log(`员工模板 (${empResults.length} 个): 全部成功发布`);
  console.log(`扩展技能 (${skillResults.length} 个): 全部成功发布并同步`);
}

main().catch(err => {
  console.error(`\n❌ 执行失败:`, err.message);
  process.exit(1);
});
