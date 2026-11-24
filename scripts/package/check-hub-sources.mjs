import { importWorkbenchModule } from "../lib/workbench.mjs";
import {
  employeeTemplate,
  organizationTemplate,
} from "../lib/template-source.mjs";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
  loadExtensionEmployees,
  loadExtensionSkills,
  loadExtensionPlugins,
  resourceSourceRoot,
  extensionPluginRoot,
} from "../lib/resource-sources.mjs";
const { GalleryClient } = await importWorkbenchModule(
  "apps/daemon/src/application/gallery-client.ts",
);
const { loadPackDefinition } = await importWorkbenchModule(
  "packages/resource-loader/src/pack.ts",
);
const { readSkillFiles, skillPackageDigest } = await importWorkbenchModule(
  "packages/resource-loader/src/skill.ts",
);
const { templateFiles } = await importWorkbenchModule(
  "packages/resource-loader/src/template-package.ts",
);
const { isBuiltinResource } = await importWorkbenchModule(
  "packages/workbench-protocol/src/builtin-resources.ts",
);
const {
  parseDistribution,
  compareVersions,
  MAX_ARCHIVE,
  createSkillDistribution,
  createPluginDistribution,
  reidentifyDistribution,
} = await importWorkbenchModule("packages/resource-loader/src/distribution.ts");
const args = process.argv.slice(2),
  options = {};
for (let i = 0; i < args.length; i += 2) {
  if (
    !["--data-dir", "--source-id", "--report", "--pack"].includes(args[i]) ||
    !args[i + 1] ||
    options[args[i]]
  )
    throw new Error(
      "Usage: check-hub-sources.mjs --data-dir /absolute/data [--source-id ID] [--pack ID,ID] [--report /absolute/report.json]",
    );
  options[args[i]] = args[i + 1];
}
const dataDir = options["--data-dir"];
if (
  !dataDir ||
  !isAbsolute(dataDir) ||
  (options["--report"] && !isAbsolute(options["--report"]))
)
  throw new Error("Data and report paths must be absolute");
const db = new DatabaseSync(join(dataDir, "workbench.sqlite"), {
  readOnly: true,
});
const client = new GalleryClient(db, dataDir);
try {
  const enabled = client.sources().filter((s) => s.enabled);
  const source = options["--source-id"]
    ? client.source(options["--source-id"])
    : enabled.length === 1
      ? client.source(enabled[0].id)
      : undefined;
  if (!source)
    throw new Error(
      "Select one configured enabled Hub source; accounts are never switched automatically",
    );
  const results = [],
    profiles = loadExtensionEmployees(),
    packs = [];
  const selected = options["--pack"]?.split(",");
  const packIds =
    selected ?? readdirSync(join(resourceSourceRoot, "resources/packs"));
  for (const id of packIds) {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error("Invalid pack ID");
    try {
      packs.push(
        loadPackDefinition(
          join(resourceSourceRoot, "resources/packs", id, "pack.yaml"),
          profiles,
        ),
      );
    } catch (error) {
      results.push({
        kind: "organization",
        id,
        match: false,
        error: error.message,
      });
    }
  }
  const employees = new Map();
  for (const pack of packs)
    for (const role of pack.employees) {
      const employee = profiles.find(
        (e) =>
          e.id === role.definition.id && e.version === role.definition.version,
      );
      const skills = [
        ...new Set(
          [...employee.skills, ...(role.skills ?? [])].map((s) => s.id),
        ),
      ];
      const prior = employees.get(employee.id);
      if (
        prior &&
        JSON.stringify([...prior.skills].sort()) !==
          JSON.stringify([...skills].sort())
      )
        throw new Error(`同一员工定义的技能配置不一致：${employee.id}`);
      employees.set(employee.id, { employee, skills });
    }
  if (!selected)
    for (const employee of profiles)
      if (!employees.has(employee.id))
        employees.set(employee.id, {
          employee,
          skills: employee.skills.map((s) => s.id),
        });
  const wantedSkills = new Set(
    [...employees.values()].flatMap((e) => e.skills),
  );
  const wantedPlugins = new Set(
    packs.flatMap((p) => (p.plugins ?? []).map((p) => p.id)),
  );
  const entries = [
    ...loadExtensionSkills()
      .filter((s) => !selected || wantedSkills.has(s.id))
      .map((s) => ({
        kind: "skill",
        id: s.id,
        version: s.version,
        files: s.files,
        bytes: createSkillDistribution(s),
      })),
    ...loadExtensionPlugins()
      .filter((p) => !selected || wantedPlugins.has(p.id))
      .map((p) => ({
        kind: "plugin",
        id: p.id,
        version: p.version,
        files: readSkillFiles(join(extensionPluginRoot, p.id)),
        bytes: createPluginDistribution(
          p,
          readSkillFiles(join(extensionPluginRoot, p.id)),
        ),
      })),
  ];
  const identity = await client.probe({ url: source.url, allowHttp: true });
  if (
    identity.registryId !== source.registryId ||
    identity.keyId !== source.keyId
  )
    throw new Error("Hub identity differs from the configured trusted source");
  const token = source.secretRef ? client.secret(source.secretRef) : undefined;
  async function read(path, maximum = 2_000_000) {
    client.checkCurrent(source);
    const bytes = await client.fetch(
      source.url + "/api/gallery/v1" + path,
      "GET",
      undefined,
      token,
      maximum,
    );
    client.checkCurrent(source);
    return bytes;
  }
  const json = async (path) => JSON.parse((await read(path)).toString());
  const cache = new Map(),
    latestCache = new Map();
  function get(kind, id, version) {
    const key = `${kind}/${id}/${version}`;
    if (!cache.has(key))
      cache.set(
        key,
        (async () => {
          const envelope = await json(
            `/packages/${kind}/${id}/versions/${version}`,
          );
          const descriptor = client.verify(source, envelope);
          if (
            envelope.status !== "published" ||
            descriptor.kind !== kind ||
            descriptor.id !== id ||
            descriptor.version !== version
          )
            throw new Error(`正式资源身份或状态不符：${key}`);
          const bytes = await read(
            `/packages/${kind}/${id}/versions/${version}/archive`,
            MAX_ARCHIVE,
          );
          const pkg = parseDistribution(bytes);
          client.validateManifest(descriptor, pkg.manifest, bytes);
          return { descriptor, pkg };
        })(),
      );
    return cache.get(key);
  }
  function latest(kind, id) {
    const key = `${kind}/${id}`;
    if (!latestCache.has(key))
      latestCache.set(
        key,
        (async () => {
          const versions = [];
          let cursor = "";
          do {
            const page = await json(
              `/packages/${kind}/${id}/versions?` +
                new URLSearchParams({ cursor }),
            );
            versions.push(...page.versions);
            cursor = page.nextCursor ?? "";
          } while (cursor);
          const row = versions
            .filter((v) => v.status === "published")
            .sort((a, b) => compareVersions(b.version, a.version))[0];
          if (!row) throw new Error(`没有正式版本：${key}`);
          return get(kind, id, row.version);
        })(),
      );
    return latestCache.get(key);
  }
  const reference = (d) => ({
    kind: d.kind,
    id: d.id,
    registryId: d.registryId,
    publisherId: d.publisherId,
    versionRequirement: d.version,
    payloadDigest: d.payloadDigest,
  });
  async function resolver(requirements) {
    const refs = new Map();
    for (const [kind, id] of requirements)
      refs.set(
        `${kind}/${id}`,
        kind !== "employee" && isBuiltinResource(kind, id)
          ? { kind, id, builtin: true, versionRequirement: "builtin" }
          : reference((await latest(kind, id)).descriptor),
      );
    return (kind, id) => refs.get(`${kind}/${id}`);
  }
  // Verify the dependency graph pinned by the published template, independently
  // from latest source comparisons. A published parent can reference a deleted child.
  const checked = new Set();
  async function dependencies({ descriptor, pkg }) {
    const key = `${descriptor.kind}/${descriptor.id}/${descriptor.version}`;
    if (checked.has(key)) return;
    const refs =
      pkg.template?.kind === "employee"
        ? pkg.template.skills
        : pkg.template?.kind === "organization"
          ? [
              ...pkg.template.plugins,
              ...pkg.template.roles.map((r) => r.employee),
            ]
          : [];
    for (const ref of refs) {
      if (ref.builtin) {
        if (!isBuiltinResource(ref.kind, ref.id))
          throw new Error(`未知内置依赖：${ref.id}`);
        continue;
      }
      if (!/^\d+\.\d+\.\d+$/.test(ref.versionRequirement)) {
        // Bounded employee ranges are valid; select only within their declared range.
        const { satisfiesTemplateVersion } = await importWorkbenchModule(
          "packages/resource-loader/src/template-package.ts",
        );
        let cursor = "",
          match;
        do {
          const page = await json(
            `/packages/${ref.kind}/${ref.id}/versions?` +
              new URLSearchParams({ cursor }),
          );
          match = page.versions.find(
            (v) =>
              v.status === "published" &&
              v.publisherId === ref.publisherId &&
              satisfiesTemplateVersion(
                v.version,
                ref.versionRequirement,
                v.versionSemantics,
              ),
          );
          cursor = match ? "" : (page.nextCursor ?? "");
        } while (cursor);
        if (!match) throw new Error(`缺少范围内正式依赖：${ref.id}`);
        await checkReference(ref, match.version);
      } else await checkReference(ref, ref.versionRequirement);
    }
    checked.add(key);
  }
  async function checkReference(ref, version) {
    const child = await get(ref.kind, ref.id, version),
      d = child.descriptor;
    if (
      d.registryId !== ref.registryId ||
      d.publisherId !== ref.publisherId ||
      (ref.payloadDigest && d.payloadDigest !== ref.payloadDigest)
    )
      throw new Error(`依赖来源或摘要不符：${ref.id}@${version}`);
    await dependencies(child);
  }
  async function compare(entry, compile) {
    try {
      const remote = await latest(entry.kind, entry.id);
      await dependencies(remote);
      const files = compile
        ? templateFiles(await compile(remote.descriptor.version))
        : parseDistribution(
            reidentifyDistribution(
              entry.bytes,
              entry.id,
              remote.descriptor.version,
            ),
          ).files;
      const local = new Map(files.map((f) => [f.path, f])),
        published = new Map(remote.pkg.files.map((f) => [f.path, f]));
      const differentFiles = [
        ...new Set([...local.keys(), ...published.keys()]),
      ]
        .filter((path) => {
          const a = local.get(path),
            b = published.get(path);
          return (
            !a ||
            !b ||
            a.executable !== b.executable ||
            !a.content.equals(b.content)
          );
        })
        .sort();
      results.push({
        kind: entry.kind,
        id: entry.id,
        sourceVersion: entry.version,
        hubVersion: remote.descriptor.version,
        match: skillPackageDigest(files) === remote.descriptor.payloadDigest,
        differentFiles,
      });
    } catch (error) {
      results.push({
        kind: entry.kind,
        id: entry.id,
        sourceVersion: entry.version,
        match: false,
        error: error.message,
      });
    }
  }
  for (const entry of entries) await compare(entry);
  for (const { employee, skills } of employees.values())
    await compare(
      { kind: "employee", id: employee.id, version: employee.version },
      async (version) => ({
        ...employeeTemplate(
          employee,
          skills,
          await resolver(skills.map((id) => ["skill", id])),
        ),
        version,
      }),
    );
  for (const pack of packs)
    await compare(
      { kind: "organization", id: pack.id, version: pack.version },
      async (version) => {
        const members = new Map(
          pack.employees.map((r) => [
            r.role,
            profiles.find((e) => e.id === r.definition.id),
          ]),
        );
        const resolve = await resolver([
          ...pack.employees.map((r) => ["employee", r.definition.id]),
          ...(pack.plugins ?? []).map((p) => ["plugin", p.id]),
        ]);
        return { ...organizationTemplate(pack, members, resolve), version };
      },
    );
  results.sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
  );
  const report = {
    sourceId: source.id,
    checkedAt: new Date().toISOString(),
    total: results.length,
    matching: results.filter((r) => r.match).length,
    results,
  };
  if (options["--report"])
    writeFileSync(options["--report"], JSON.stringify(report, null, 2) + "\n", {
      mode: 0o600,
    });
  console.log(JSON.stringify(report, null, 2));
  if (report.matching !== report.total) process.exitCode = 1;
} finally {
  client.close();
  db.close();
}
