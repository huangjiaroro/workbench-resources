import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncBundle, runValidation } from "../scripts/gallery/bundle-pack.mjs";
import {
  resourceSourceRoot,
  extensionSkillRoot,
} from "../scripts/lib/resource-sources.mjs";
import {
  importWorkbenchModule,
  workbenchRoot,
} from "../scripts/lib/workbench.mjs";

const { loadSkillDefinition } = await importWorkbenchModule(
  "packages/resource-loader/src/skill.ts",
);

test("bundle rebuild uses current sources, removes retired files and preserves the previous bundle on failure", () => {
  const dir = mkdtempSync(join(tmpdir(), "workbench-pack-build-"));
  const write = (relative, content) => {
    const file = join(dir, relative);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, content);
  };
  try {
    write(
      "resources/packs/fixture/pack.yaml",
      JSON.stringify({
        id: "fixture",
        version: "1.0.0",
        name: "Fixture",
        employees: [
          {
            role: "leader",
            name: "Leader",
            definition: { id: "worker", version: "1.0.0" },
            skills: [{ id: "fixture-skill" }],
          },
        ],
      }),
    );
    write(
      "resources/employees/worker.yaml",
      JSON.stringify({
        id: "worker",
        version: "1.0.0",
        name: "Worker",
        description: "Fixture employee",
        avatar: "",
        instructions: "worker.md",
        playbook: "worker-playbook.md",
        skills: [{ id: "default-skill" }],
      }),
    );
    write("resources/employees/worker.md", "# Current identity");
    write("resources/employees/worker-playbook.md", "# Current method");
    const skill = (id) =>
      `---\nname: ${id}\ndescription: 本轮需要执行专业方法时调用。\n---\n# 当前中文方法\n`;
    write(
      "resources/extensions/skills/fixture-skill/SKILL.md",
      skill("fixture-skill"),
    );
    write(
      "resources/builtin/skills/default-skill/SKILL.md",
      skill("default-skill"),
    );
    write("bundle/skills/fixture-skill/SKILL.md", "OLD SKILL");
    write(
      "bundle/skills/fixture-skill/references/upstream.txt",
      "RETIRED TEXT",
    );
    write("bundle/skills/retired-skill/SKILL.md", "RETIRED SKILL");
    write(
      "bundle/qa/reference-manifest.json",
      JSON.stringify({ entries: [{ path: "skills/fixture-skill/SKILL.md" }] }),
    );
    const bundle = join(dir, "bundle");
    syncBundle("fixture", bundle, { sourceRoot: dir });
    assert.equal(
      readFileSync(join(bundle, "skills/fixture-skill/SKILL.md"), "utf8"),
      skill("fixture-skill"),
    );
    assert.equal(
      existsSync(join(bundle, "skills/fixture-skill/references/upstream.txt")),
      false,
    );
    assert.equal(existsSync(join(bundle, "skills/retired-skill")), false);
    assert.equal(existsSync(join(bundle, "qa")), false);
    assert.ok(
      existsSync(join(bundle, "skills/default-skill/SKILL.md")),
      "employee default dependency is included",
    );
    assert.equal(
      runValidation(bundle),
      true,
      "native validation works without a pre-existing QA directory",
    );
    rmSync(join(dir, "resources/extensions/skills/fixture-skill"), {
      recursive: true,
    });
    assert.throws(
      () => syncBundle("fixture", bundle, { sourceRoot: dir }),
      /ENOENT/,
    );
    assert.equal(
      readFileSync(join(bundle, "skills/fixture-skill/SKILL.md"), "utf8"),
      skill("fixture-skill"),
    );
    rmSync(join(bundle, "skills/default-skill"), { recursive: true });
    assert.throws(() => runValidation(bundle), /缺少技能/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("commercialization bundle rebuild includes complete current dependencies and its maintenance guide", () => {
  const directory = mkdtempSync(join(tmpdir(), "workbench-commercial-bundle-"));
  try {
    const definition = syncBundle(
      "drama-commercialization",
      join(directory, "bundle"),
    );
    assert.equal(definition.employees.length, 10);
    assert.equal(runValidation(join(directory, "bundle")), true);
    for (const id of [
      "project-coordination",
      "post-production",
      "drama-marketing",
      "drama-release-compliance",
    ]) {
      const sourceRoot =
        id === "project-coordination"
          ? join(workbenchRoot, "resources/builtin/skills")
          : extensionSkillRoot;
      const source = loadSkillDefinition(join(sourceRoot, id, "SKILL.md"));
      const bundled = loadSkillDefinition(
        join(directory, "bundle/skills", id, "SKILL.md"),
      );
      assert.equal(bundled.digest, source.digest, id);
    }
    for (const id of ["media", "pixel-studio", "project-materials"]) {
      assert.ok(
        existsSync(join(directory, "bundle/plugins", id, "plugin.yaml")),
        `plugin ${id} is bundled`,
      );
    }
    assert.equal(
      readFileSync(
        join(directory, "bundle/docs/drama-commercialization.md"),
        "utf8",
      ),
      readFileSync(
        join(resourceSourceRoot, "docs/drama-commercialization.md"),
        "utf8",
      ),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
