import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { importWorkbenchModule } from '../lib/workbench.mjs';
import {employeeTemplate, organizationTemplate} from '../lib/template-source.mjs';
import {
  loadExtensionEmployees,
  extensionSkillRoot,
  resourceSourceRoot,
} from '../lib/resource-sources.mjs';

const { loadPackDefinition } = await importWorkbenchModule(
  'packages/resource-loader/src/pack.ts',
);
const { loadSkillDefinition } = await importWorkbenchModule(
  'packages/resource-loader/src/skill.ts',
);
const {
  createSkillDistribution,
  createTemplateDistribution,
  parseDistribution,
  reidentifyDistribution,
  packageId,
  compareVersions,
  sha256,
} = await importWorkbenchModule('packages/resource-loader/src/distribution.ts');
const { templateFiles } = await importWorkbenchModule(
  'packages/resource-loader/src/template-package.ts',
);
const { isBuiltinResource } = await importWorkbenchModule(
  'packages/workbench-protocol/src/builtin-resources.ts',
);
const { GalleryClient } = await importWorkbenchModule(
  'apps/daemon/src/application/gallery-client.ts',
);

class RequestError extends Error {
  constructor(label, status, detail) {
    super(`${label} (${status}): ${detail}`);
    this.status = status;
  }
}

function request(base, token) {
  return async (method, path, input) => {
    const zip = Buffer.isBuffer(input);
    for (let attempt = 0; attempt < 8; attempt++) {
      const response = await fetch(base + path, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(300_000),
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          'content-type': zip ? 'application/zip' : 'application/json',
        },
        body:
          input === undefined ? undefined : zip ? input : JSON.stringify(input),
      });
      if (response.status === 429 && attempt < 7) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new RequestError(
          `${method} ${path}`,
          response.status,
          body.error ?? response.statusText,
        );
      }
      return response.json();
    }
  };
}

function ownerRequest(dataDir) {
  const { host, port } = JSON.parse(
    readFileSync(join(dataDir, 'daemon-endpoint.json'), 'utf8'),
  );
  if (
    host !== '127.0.0.1' ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw new Error('Workbench 地址必须是有效的本机回环端口');
  return request(
    `http://${host}:${port}`,
    readFileSync(join(dataDir, 'daemon-token'), 'utf8').trim(),
  );
}

const report = (event, details) =>
  console.log(JSON.stringify({ event, ...details }));
const releasePath = ({ kind, id }) => `/packages/${kind}/${id}/versions`;
const packageKey = ({ kind, id }) => `${kind}/${id}`;
const reference = (d) => ({
  kind: d.kind,
  id: d.id,
  registryId: d.registryId,
  publisherId: d.publisherId,
  versionRequirement: d.version,
  payloadDigest: d.payloadDigest,
});
const builtin = (kind, id) => ({
  kind,
  id,
  builtin: true,
  versionRequirement: 'builtin',
});

async function main() {
  const { values: args } = parseArgs({
    options: {
      pack: { type: 'string', default: 'short-drama' },
      'data-dir': { type: 'string' },
      'source-id': { type: 'string' },
      'token-file': { type: 'string' },
      'instance-id': { type: 'string' },
      'allow-new': { type: 'boolean' },
      'allow-global-switch': { type: 'boolean' },
      'allow-http': { type: 'boolean' },
      'release-type': { type: 'string', default: 'patch' },
      apply: { type: 'boolean' },
      'publish-only': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (args.help) {
    console.log(
      'pnpm sync:pack --pack short-drama --data-dir /工作台数据 --source-id 来源ID --token-file /发布令牌文件 --instance-id 组织实例ID | --publish-only [--apply] [--allow-new] [--allow-global-switch] [--allow-http] [--release-type patch|minor|major]',
    );
    return;
  }
  if (
    !args['source-id'] ||
    (!args['instance-id'] && !args['publish-only']) ||
    ![args['data-dir'], args['token-file']].every((p) => p && isAbsolute(p))
  )
    throw new Error(
      '需要 --data-dir、--source-id、--token-file 以及 --instance-id 或 --publish-only，文件路径须为绝对路径。使用 --help 查看参数。',
    );
  if (!['patch', 'minor', 'major'].includes(args['release-type']))
    throw new Error('无效的发布级别');
  packageId(args.pack);
  const profiles = loadExtensionEmployees();
  const pack = loadPackDefinition(
    join(resourceSourceRoot, 'resources/packs', args.pack, 'pack.yaml'),
    profiles,
  );
  if (
    pack.id !== args.pack ||
    !pack.employees.some((role) => role.role === 'leader')
  )
    throw new Error('组织清单必须与目录同名并声明 leader 岗位');
  const organizationId = pack.id;
  const selected = pack.employees.map((role) => {
    const employee = profiles.find(
      (item) =>
        item.id === role.definition?.id &&
        item.version === role.definition?.version,
    );
    if (!employee) throw new Error(`岗位 ${role.role} 必须引用独立员工定义`);
    return {
      role,
      employee,
      id: employee.id,
      skills: [
        ...new Set(
          [...employee.skills, ...(role.skills ?? [])].map((ref) => ref.id),
        ),
      ],
    };
  });
  // A single reusable employee template cannot represent conflicting role-specific skill lists.
  const byEmployee = new Map();
  for (const entry of selected) {
    const previous = byEmployee.get(entry.id);
    if (
      previous &&
      JSON.stringify([...previous.skills].sort()) !==
        JSON.stringify([...entry.skills].sort())
    )
      throw new Error(`同一员工定义的技能配置不一致：${entry.id}`);
    byEmployee.set(entry.id, entry);
  }
  const skillPackages = new Map();
  for (const { skills } of selected)
    for (const id of skills) {
      if (!isBuiltinResource('skill', id) && !skillPackages.has(id)) {
        const skill = loadSkillDefinition(
          join(extensionSkillRoot, id, 'SKILL.md'),
        );
        if (skill.id !== id) throw new Error(`技能源码标识与依赖不符：${id}`);
        skillPackages.set(id, createSkillDistribution(skill));
      }
    }

  const owner = ownerRequest(args['data-dir']);
  const { sources } = await owner('GET', '/v2/gallery/sources');
  const source = sources.find(
    (item) => item.id === args['source-id'] && item.enabled,
  );
  if (!source) throw new Error('指定的 Workbench 广场来源不存在或未启用');
  const url = new URL(source.url);
  if (
    url.protocol === 'http:' &&
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
    !args['allow-http']
  )
    throw new Error('向已保存的公网 HTTP 来源发送令牌需要 --allow-http（明文传输）');
  let members = [];
  if (!args['publish-only']) {
    const instanceId = encodeURIComponent(args['instance-id']);
    await owner('GET', `/v2/organizations/${instanceId}/config`);
    const { roles } = await owner('GET', `/v2/organizations/${instanceId}/roles`);
    ({ members } = await owner('GET', `/v2/organizations/${instanceId}/members`));
    const desired = pack.employees.map((role) => role.role).sort().join(',');
    if (
      roles.map((role) => role.roleKey).sort().join(',') !== desired ||
      members.map((member) => member.role).sort().join(',') !== desired
    ) throw new Error('本机实例岗位或成员与源码不同，当前版本切换接口需要一一对应');
  }

  const client = new GalleryClient(undefined, args['data-dir']);
  try {
    const info = await client.probe({
      url: source.url,
      allowHttp: url.protocol === 'http:',
    });
    if (info.registryId !== source.registryId || info.keyId !== source.keyId)
      throw new Error('Hub 身份或签名密钥与本机信任记录不同');
    const trust = { ...source, publicKey: info.publicKey };
    const hub = request(
      info.url + '/api/gallery/v1',
      readFileSync(args['token-file'], 'utf8').trim(),
    );
    const principal = await hub('GET', '/identity');
    if (
      !['read', 'upload', 'publish'].every((scope) =>
        principal.scopes.includes(scope),
      )
    )
      throw new Error(
        '令牌的发布者或 read/upload/publish 权限不符合本次发布要求',
      );

    function verify(envelope, expected) {
      const d = client.verify(trust, envelope);
      if (
        envelope.status !== 'published' ||
        d.kind !== expected.kind ||
        d.id !== expected.id ||
        (expected.version && d.version !== expected.version)
      )
        throw new Error(`Hub 返回了不同或不可用的包：${packageKey(expected)}`);
      return d;
    }
    async function loadHead(kind, id) {
      const path = releasePath({ kind, id });
      const head = await hub('GET', path.replace(/versions$/, 'head'));
      if (!head.version) return { head };
      const published = verify(await hub('GET', `${path}/${head.version}`), {
        kind,
        id,
        version: head.version,
      });
      if (published.payloadDigest !== head.payloadDigest)
        throw new Error(`Hub 基线已改变：${path}`);
      return { head, published };
    }
    const targets = [
      ...[...skillPackages.keys()].map((id) => ({ kind: 'skill', id })),
      ...[...byEmployee.keys()].map((id) => ({ kind: 'employee', id })),
      { kind: 'organization', id: organizationId },
    ];
    const baselines = new Map();
    for (const target of targets) {
      if (
        !principal.packageIds.includes('*') &&
        !principal.packageIds.includes(target.id)
      )
        throw new Error(`令牌不允许发布 ${packageKey(target)}`);
      const baseline = await loadHead(target.kind, target.id);
      if (
        baseline.published &&
        baseline.published.publisherId !== principal.publisherId
      )
        throw new Error(`远端包属于其他发布者：${packageKey(target)}`);
      if (!baseline.published && !args['allow-new'])
        throw new Error(
          `远端没有正式版本：${packageKey(target)}。首次发布请核对标识后使用 --allow-new`,
        );
      baselines.set(packageKey(target), baseline);
    }
    const { plugins: localPlugins, skills: localSkills } = await owner(
      'GET',
      '/v2/gallery/library',
    );
    for (const id of new Set(selected.flatMap((entry) => entry.skills)))
      if (
        isBuiltinResource('skill', id) &&
        !localSkills.some((item) => item.id === id && item.installed)
      )
        throw new Error(`请先恢复本机内置技能 ${id}`);
    const pluginRefs = [];
    for (const { id } of pack.plugins ?? []) {
      if (isBuiltinResource('plugin', id)) {
        if (!localPlugins.some((item) => item.id === id && item.installed))
          throw new Error(`请先恢复本机内置插件 ${id}`);
        pluginRefs.push(builtin('plugin', id));
        continue;
      }
      const installed = localPlugins.find(
        (plugin) => plugin.id === id && plugin.installed,
      );
      if (installed && installed.origin?.sourceId !== source.id)
        throw new Error(`插件 ${id} 的本机安装来自其他来源，请先核对`);
      const published = installed
        ? verify(
            await hub(
              'GET',
              `${releasePath({ kind: 'plugin', id })}/${installed.version}`,
            ),
            { kind: 'plugin', id, version: installed.version },
          )
        : (await loadHead('plugin', id)).published;
      if (
        !published ||
        (installed && installed.digest !== published.payloadDigest)
      )
        throw new Error(
          `插件 ${id} 缺少准确正式包。请先完成插件发布或核对本机安装`,
        );
      pluginRefs.push(published);
    }
    for (const { id } of targets.filter((target) => target.kind === 'skill')) {
      const local = localSkills.find(
        (skill) => skill.id === id && skill.installed,
      );
      if (local && local.origin?.sourceId !== source.id)
        throw new Error(`技能 ${id} 的本机安装来自其他来源，请先核对`);
    }

    const verified = new Set();
    async function verifyArchive(d) {
      const key = `${packageKey(d)}/${d.version}/${d.payloadDigest}`;
      if (verified.has(key)) return;
      const response = await fetch(info.url + '/api/gallery/v1' + releasePath(d) + `/${d.version}/archive`, {
        redirect: 'error', signal: AbortSignal.timeout(90_000),
        headers: {authorization: `Bearer ${readFileSync(args['token-file'], 'utf8').trim()}`},
      });
      if (!response.ok) throw new Error(`正式包回取失败：${key} (${response.status})`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const pkg = parseDistribution(bytes);
      client.validateManifest(d, pkg.manifest, bytes);
      verified.add(key);
      report('verified', {package: packageKey(d), version: d.version, digest: d.payloadDigest});
    }

    async function publish(bytes, preview) {
      const { manifest: m } = parseDistribution(bytes);
      const { head, published } = baselines.get(packageKey(m));
      if (
        published &&
        (published.source?.payloadDigest === m.payloadDigest ||
          parseDistribution(
            reidentifyDistribution(bytes, m.id, published.version),
          ).manifest.payloadDigest === published.payloadDigest)
      ) {
        await verifyArchive(published);
        report('reuse', { package: packageKey(m), version: published.version });
        return published;
      }
      report(preview ? 'would-publish' : 'publishing', {
        package: packageKey(m),
        baseVersion: head.version,
        sourceDigest: m.payloadDigest,
      });
      if (preview)
        return {
          ...m,
          registryId: trust.registryId,
          publisherId: principal.publisherId,
          version: '0.0.0',
        };
      const archiveSha256 = sha256(bytes),
        path = releasePath(m);
      const key = sha256(
        JSON.stringify([
          path,
          head.version,
          head.payloadDigest,
          archiveSha256,
          args['release-type'],
        ]),
      );
      const { uploadId } = await hub('POST', '/uploads', {
        operationKey: `upload-${key}`,
        archiveSha256,
        bytes: bytes.length,
      });
      const upload = await hub('GET', `/uploads/${uploadId}`);
      if (upload.state === 'created')
        await hub('PUT', `/uploads/${uploadId}/archive`, bytes);
      if (!['ready', 'published'].includes(upload.state))
        await hub('POST', `/uploads/${uploadId}/validate`, {});
      const operationKey = `publish-${key}`;
      const input = {
        uploadId,
        archiveSha256,
        payloadDigest: m.payloadDigest,
        baseVersion: head.version,
        basePayloadDigest: head.payloadDigest,
        versionPolicy: 'server-assigned',
        operationKey,
        ...(m.kind === 'employee' || m.kind === 'organization'
          ? { releaseType: args['release-type'] }
          : {}),
        ...(m.version && (!head.version || compareVersions(m.version, head.version) > 0)
          ? { targetVersion: m.version }
          : {}),
      };
      let envelope;
      try {
        envelope = await hub('POST', path, input);
      } catch (error) {
        if (error instanceof RequestError && error.status < 500) throw error;
        try {
          envelope = (await hub('GET', `/operations/${operationKey}`)).result;
        } catch {
          throw new Error(
            `发布结果未确认：${packageKey(m)}，操作号 ${operationKey}。请核对 Hub 回执后再运行`,
          );
        }
      }
      const result = verify(envelope, { kind: m.kind, id: m.id });
      if (
        result.publisherId !== principal.publisherId ||
        result.source?.payloadDigest !== m.payloadDigest
      )
        throw new Error(`发布回执与源包不符：${packageKey(m)}`);
      await verifyArchive(result);
      report('published', {
        package: packageKey(m),
        version: result.version,
        digest: result.payloadDigest,
        operationKey,
      });
      return result;
    }

    async function publishTree(preview) {
      const skills = new Map();
      for (const [id, bytes] of skillPackages)
        skills.set(id, await publish(bytes, preview));
      const employees = new Map();
      for (const { employee, id, skills: ids } of byEmployee.values()) {
        const definition = employeeTemplate(employee, ids, (kind, skill) =>
          skills.has(skill) ? reference(skills.get(skill)) : builtin(kind, skill));
        employees.set(
          id,
          await publish(
            createTemplateDistribution('employee', templateFiles(definition)),
            preview,
          ),
        );
      }
      const organization = organizationTemplate(pack,
        new Map(selected.map(({role, employee}) => [role.role, employee])),
        (kind, id) => kind === 'employee' ? reference(employees.get(id)) :
          pluginRefs.find(ref => ref.id === id).builtin ? builtin(kind, id) :
            reference(pluginRefs.find(ref => ref.id === id)));
      const root = await publish(
        createTemplateDistribution('organization', templateFiles(organization)),
        preview,
      );
      return [
        ...skills.values(),
        ...pluginRefs.filter((d) => !d.builtin),
        ...employees.values(),
        root,
      ];
    }

    report('plan', {
      sourceId: source.id,
      registryId: source.registryId,
      publisher: principal.publisherId,
      instanceId: args['instance-id'],
    });
    const preview = await publishTree(true);
    if (args['publish-only']) {
      if (args.apply) await publishTree(false);
      return;
    }
    const memberIds = new Set(members.map((member) => member.employeeId));
    function checkReferences(resource, references) {
      const shared = references.filter((ref) =>
        resource.kind === 'skill'
          ? !memberIds.has(ref.id)
          : ref.id !== args['instance-id'],
      );
      if (shared.length && args.apply && !args['allow-global-switch'])
        throw new Error(
          `包 ${packageKey(resource)} 有目标实例之外的引用。核对影响后使用 --allow-global-switch`,
        );
    }

    for (const skill of preview.filter((item) => item.kind === 'skill')) {
      const current = localSkills.find(
        (entry) => entry.id === skill.id && entry.installed,
      );
      if (
        !current ||
        (current.version === skill.version &&
          current.digest === skill.payloadDigest)
      )
        continue;
      const { references } = await owner(
        'GET',
        `/v2/resources/skills/${skill.id}/${current.version}/installation`,
      );
      report('global-skill-switch', {
        id: skill.id,
        from: current.version,
        references,
      });
      checkReferences(skill, references);
    }
    if (!args.apply) return;
    const versions = await publishTree(false);
    // Acquire all packages and check all plans before changing the current installed versions.
    const plans = [];
    const { templates } = await owner('GET', '/v2/resources/templates');
    for (const d of versions) {
      const template = d.kind === 'employee' || d.kind === 'organization';
      const list = template
        ? templates
        : d.kind === 'skill'
          ? localSkills
          : localPlugins;
      if (
        list.some(
          (item) =>
            item.id === d.id &&
            item.version === d.version &&
            item.digest === d.payloadDigest &&
            item.installed &&
            (template ? item.sourceId : item.origin?.sourceId) === source.id,
        )
      )
        continue;
      const input = {
        kind: d.kind,
        id: d.id,
        version: d.version,
        sourceId: source.id,
      };
      const acquired = await owner('POST', '/v2/gallery/acquisitions', {
        ...input,
        operationKey: randomUUID(),
      });
      if (acquired.result?.digest !== d.payloadDigest)
        throw new Error(`下载摘要不符：${packageKey(d)}`);
      const plan = await owner('POST', '/v2/resources/install-plans', input);
      report('install-plan', {
        package: packageKey(d),
        version: d.version,
        references: plan.references ?? [],
      });
      checkReferences(d, plan.references ?? []);
      plans.push(plan);
    }
    for (const { planId, fingerprint } of plans)
      await owner('POST', `/v2/resources/install-plans/${planId}/apply`, {
        fingerprint,
      });

    const root = versions.at(-1);
    const plan = await owner('POST', '/v2/resources/templates/adoption-plans', {
      kind: root.kind,
      id: root.id,
      version: root.version,
      sourceId: source.id,
      instanceId: args['instance-id'],
    });
    if (!plan.ready) throw new Error(plan.message ?? '本机组织版本切换未就绪');
    const result = await owner(
      'POST',
      `/v2/resources/templates/adoption-plans/${plan.planId}/apply`,
      { fingerprint: plan.fingerprint, operationKey: randomUUID() },
    );
    report('adopted', {
      instanceId: args['instance-id'],
      version: root.version,
      result,
    });
  } finally {
    client.close();
  }
}

await main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
