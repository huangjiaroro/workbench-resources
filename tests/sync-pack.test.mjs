import { test } from 'node:test';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { importWorkbenchModule } from '../scripts/lib/workbench.mjs';

const exec = promisify(execFile);
const {GalleryRoutes} = await importWorkbenchModule('apps/relay/src/gallery/routes.ts');
const { startDaemon } = await importWorkbenchModule(
  'apps/daemon/src/server.ts',
);
const { publishArchive } = await importWorkbenchModule(
  'tests/helpers/signed-gallery.mjs',
);
const { createSkillDistribution, createTemplateDistribution } =
  await importWorkbenchModule('packages/resource-loader/src/distribution.ts');
const { loadSkillDefinition } = await importWorkbenchModule(
  'packages/resource-loader/src/skill.ts',
);
const { templateFiles, templateSemantics } = await importWorkbenchModule(
  'packages/resource-loader/src/template-package.ts',
);
const toRef = (d) => ({
  kind: d.kind,
  id: d.id,
  registryId: d.registryId,
  publisherId: d.publisherId,
  payloadDigest: d.payloadDigest,
  versionRequirement: d.version,
});
const archive = (d) => createTemplateDistribution(d.kind, templateFiles(d));

async function withHub(run) {
  const root = mkdtempSync(join(tmpdir(), 'workbench-sync-pack-'));
  let relay, daemon;
  const write = (path, value) => {
    const absolute = join(root, path);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(
      absolute,
      typeof value === 'string' ? value : JSON.stringify(value),
    );
    return absolute;
  };
  try {
    const hubDir = join(root, 'hub'),
      dataDir = join(root, 'data');
    mkdirSync(dataDir);
    const gallery = new GalleryRoutes(hubDir);
    const server = createServer((req,res) => {void gallery.handle(req,res,new URL(req.url,'http://localhost'));});
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    relay = {port: server.address().port, async close() {
      await new Promise(resolve => server.close(resolve)); await gallery.close();
    }};
    daemon = await startDaemon(dataDir);
    const tokenFile = join(hubDir, 'gallery/admin-token');
    const remote = {
      url: `http://127.0.0.1:${relay.port}`,
      token: readFileSync(tokenFile, 'utf8').trim(),
    };
    const owner = async (method, path, input) => {
      const response = await fetch(`http://127.0.0.1:${daemon.port}` + path, {
        method,
        headers: {
          authorization: `Bearer ${daemon.token}`,
          'content-type': 'application/json',
        },
        body: input === undefined ? undefined : JSON.stringify(input),
      });
      const body = await response.json();
      assert.ok(response.ok, JSON.stringify(body));
      return body;
    };
    const info = await owner('POST', '/v2/gallery/sources/probe', {
      ...remote,
      allowHttp: true,
    });
    const { source } = await owner('POST', '/v2/gallery/sources', {
      ...remote,
      allowHttp: true,
      registryId: info.registryId,
      expectedKeyId: info.keyId,
    });
    await run({ root, write, dataDir, tokenFile, owner, remote, source });
  } finally {
    await daemon?.close();
    await relay?.close();
    rmSync(root, { recursive: true, force: true });
  }
}

test('Git changes publish skill, employee and organization in order, then update the existing Workbench instance', () =>
  withHub(async ({ root, write, dataDir, tokenFile, owner, remote, source }) => {
    const skillPath = 'resources/extensions/skills/test-method/SKILL.md';
    const methodText = (body) =>
      `---\nname: test-method\ndescription: Test method\nmetadata:\n  version: 1.0.0\n---\n\n${body}\n`;
    const skill = loadSkillDefinition(
      write(skillPath, methodText('Original method')),
    );
    const one = (await publishArchive(remote, createSkillDistribution(skill)))
      .descriptor;
    const employee = {
      kind: 'employee',
      id: 'test-worker',
      version: '1.0.0',
      versionSemantics: templateSemantics,
      name: 'Worker',
      description: 'Test worker',
      avatar: '',
      instructions: 'Original identity',
      playbook: '',
      skills: [toRef(one)],
    };
    const two = (await publishArchive(remote, archive(employee))).descriptor;
    const team = {
      kind: 'organization',
      id: 'test-team',
      version: '1.0.0',
      versionSemantics: templateSemantics,
      name: 'Test team',
      description: '',
      workMode: 'both',
      leaderRole: 'leader',
      playbook: 'Original team method',
      artifactContract: '',
      roles: [
        {
          role: 'leader',
          name: 'Worker',
          description: '',
          instructions: '',
          canDelegate: false,
          employee: toRef(two),
        },
      ],
      plugins: [],
    };
    const three = (await publishArchive(remote, archive(team))).descriptor;
    for (const d of [one, two, three]) {
      const input = {
        kind: d.kind,
        id: d.id,
        version: d.version,
        sourceId: source.id,
      };
      await owner('POST', '/v2/gallery/acquisitions', {
        ...input,
        operationKey: randomUUID(),
      });
      const plan = await owner('POST', '/v2/resources/install-plans', input);
      await owner('POST', `/v2/resources/install-plans/${plan.planId}/apply`, {
        fingerprint: plan.fingerprint,
      });
    }
    const plan = await owner('POST', '/v2/resources/templates/create-plans', {
      kind: 'organization',
      id: team.id,
      version: '1.0.0',
      sourceId: source.id,
    });
    const created = await owner(
      'POST',
      `/v2/resources/templates/create-plans/${plan.planId}/apply`,
      { fingerprint: plan.fingerprint, operationKey: randomUUID() },
    );
    const orgId = created.organizationId,
      workerId = created.composition[0].employeeId;
    write('resources/employees/test-worker.yaml', {
      id: employee.id,
      version: '1.0.0',
      name: 'Worker',
      avatar: '',
      description: 'Test worker',
      instructions: 'worker.md',
      skills: [{ id: 'test-method' }],
    });
    write('resources/employees/worker.md', 'New identity');
    write('resources/packs/test-team/pack.yaml', {
      id: team.id,
      version: '1.0.0',
      name: team.name,
      workMode: 'both',
      playbook: 'playbook.md',
      employees: [
        {
          role: 'leader',
          name: 'Worker',
          definition: { id: employee.id, version: '1.0.0' },
        },
      ],
    });
    write('resources/packs/test-team/playbook.md', 'New team method');
    write(skillPath, methodText('New method'));
    const script = new URL('../scripts/gallery/sync-pack.mjs', import.meta.url);
    const run = async (...extra) => {
      const { stdout } = await exec(
        process.execPath,
        [
          script.pathname,
          '--pack',
          team.id,
          '--data-dir',
          dataDir,
          '--source-id',
          source.id,
          '--token-file',
          tokenFile,
          ...(extra.includes('--publish-only') ? [] : ['--instance-id', orgId]),
          ...extra,
        ],
        { env: { ...process.env, WORKBENCH_RESOURCE_SOURCE_ROOT: root } },
      );
      return stdout.trim().split('\n').map(JSON.parse);
    };
    mkdirSync(join(root, 'resources/extensions/plugins'), {recursive: true});
    const check = () => exec(process.execPath, [new URL('../scripts/package/check-hub-sources.mjs', import.meta.url).pathname,
      '--data-dir', dataDir, '--source-id', source.id, '--pack', team.id],
      {env: {...process.env, WORKBENCH_RESOURCE_SOURCE_ROOT: root}});
    const preview = await run();
    assert.equal(
      preview.filter((row) => row.event === 'would-publish').length,
      3,
    );
    assert.equal(
      (await owner('GET', `/v2/organizations/${orgId}/config`)).organization
        .playbook,
      'Original team method',
    );
    const published = await run('--apply', '--publish-only');
    assert.deepEqual(
      published
        .filter((row) => row.event === 'published')
        .map((row) => row.package),
      ['skill/test-method', 'employee/test-worker', 'organization/test-team'],
    );
    assert.equal(
      (await owner('GET', `/v2/organizations/${orgId}/config`)).organization.playbook,
      'Original team method',
    );
    const verifiedReport = JSON.parse((await check()).stdout);
    assert.equal(verifiedReport.total, 3);
    assert.equal(verifiedReport.matching, 3, 'source checking covers skills, employees and organization templates');
    assert.ok(published.some(row => row.event === 'verified'), 'publish-only downloads and verifies formal archives');
    const applied = await run('--apply');
    assert.equal(applied.filter((row) => row.event === 'published').length, 0);
    assert.equal(applied.at(-1).event, 'adopted');
    assert.equal(applied.at(-1).version, '1.0.1');
    assert.equal(
      (await owner('GET', `/v2/organizations/${orgId}/config`)).organization
        .playbook,
      'New team method',
    );
    assert.equal(
      (await owner('GET', `/v2/employees/${workerId}`)).employee.instructions,
      'New identity',
    );
    const unchanged = await run('--apply');
    assert.equal(
      unchanged.filter((row) => row.event === 'published').length,
      0,
    );
    assert.equal(unchanged.at(-1).version, '1.0.1');
    const withdrawn = await fetch(remote.url + '/api/gallery/v1/packages/skill/test-method/versions/1.0.1/yank', {
      method: 'POST', headers: {authorization: `Bearer ${remote.token}`, 'content-type':'application/json'},
      body: JSON.stringify({expectedStatusRevision: 1, reason: 'Dependency withdrawal test', operationKey: randomUUID()}),
    });
    assert.equal(withdrawn.ok, true);
    await assert.rejects(check(), error => {
      const report = JSON.parse(error.stdout);
      assert.ok(report.results.some(row => row.kind === 'organization' && !row.match && row.error),
        'a still-published parent fails when its pinned dependency is withdrawn');
      return true;
    });


  })
);

test('a skill can publish and update the existing assignment without republishing the organization', () =>
  withHub(async ({ root, write, dataDir, tokenFile, owner, source, remote }) => {
    const path = 'resources/extensions/skills/test-method/SKILL.md';
    const method = (body) => '---\nname: test-method\ndescription: Test method\n---\n\n' + body + '\n';
    const script = new URL('../scripts/package/sync-resource.mjs', import.meta.url);
    const sync = (kind, id, ...flags) => exec(process.execPath, [
      script.pathname, '--kind', kind, '--' + kind, id,
      '--data-dir', dataDir, '--source-id', source.id, '--token-file', tokenFile, ...flags,
    ], { env: { ...process.env, WORKBENCH_RESOURCE_SOURCE_ROOT: root } });

    write(path, method('Initial skill'));
    assert.match((await sync('skill', 'test-method', '--apply')).stdout, /"event": "published"/);
    const initialEnvelope = await (await fetch(remote.url + '/api/gallery/v1/packages/skill/test-method/versions/1.0.0', {headers: {authorization: `Bearer ${remote.token}`}})).json();
    const initialSkill = JSON.parse(Buffer.from(initialEnvelope.descriptor, 'base64'));
    const d = (await publishArchive(remote, archive({
      kind: 'employee', id: 'test-worker', version: '1.0.0', versionSemantics: templateSemantics,
      name: 'Worker', description: '', avatar: '', instructions: 'Worker', playbook: '', skills: [toRef(initialSkill)],
    }))).descriptor;
    const input = {kind: 'employee', id: d.id, version: d.version, sourceId: source.id};
    await owner('POST', '/v2/gallery/acquisitions', {...input, operationKey: randomUUID()});
    const install = await owner('POST', '/v2/resources/install-plans', input);
    await owner('POST', `/v2/resources/install-plans/${install.planId}/apply`, {fingerprint: install.fingerprint});
    const creation = await owner('POST', '/v2/resources/templates/create-plans', input);
    const {employeeId} = await owner('POST', `/v2/resources/templates/create-plans/${creation.planId}/apply`,
      {fingerprint: creation.fingerprint, operationKey: randomUUID()});
    const employee = {id: employeeId};
    const assignments = `/v2/employees/${employee.id}/skills`;

    write(path, method('Independent skill update'));
    assert.match((await sync('skill', 'test-method', '--apply')).stdout, /"event": "published"/);
    assert.match((await sync('skill', 'test-method')).stdout, /"event": "hub-already-latest"/);
    const { skills } = await owner('GET', assignments);
    assert.ok(skills.some((item) => item.id === 'test-method' && item.version === '1.0.1' && item.enabled));

    write('resources/extensions/plugins/test-plugin/plugin.yaml', {
      format: 3, id: 'test-plugin', version: '1.0.0', name: 'Test plugin', description: 'Example plugin', docs: 'README.md',
    });
    write('resources/extensions/plugins/test-plugin/README.md', 'Example plugin');
    const plugin = await sync('plugin', 'test-plugin', '--apply', '--publish-only');
    assert.match(plugin.stdout, /"event": "published"/);
    assert.doesNotMatch(plugin.stdout, /local-updating/);
  })
);
