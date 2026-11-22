import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext, createContext, runInContext } from "node:vm";

class ClassList {
  constructor(el) {
    this.el = el;
    this.set = new Set();
  }
  add(...names) {
    for (const n of names) this.set.add(n);
    this.el.className = Array.from(this.set).join(" ");
  }
  remove(...names) {
    for (const n of names) this.set.delete(n);
    this.el.className = Array.from(this.set).join(" ");
  }
  contains(n) {
    return this.set.has(n);
  }
}

class Element {
  constructor(tag, text) {
    this.tag = tag;
    this.children = [];
    this.open = false;
    this.isConnected = true;
    this.scrollTop = 0;
    this._className = "";
    this.classList = new ClassList(this);
    if (text !== undefined && text !== null && text !== "") this.textContent = text;
  }
  get className() {
    return this._className;
  }
  set className(val) {
    this._className = val || "";
    this.classList.set = new Set(this._className.split(/\s+/).filter(Boolean));
  }
  get firstChild() {
    return this.children[0];
  }
  append(...children) {
    for (const c of children) {
      if (typeof c === "string") {
        this.children.push(new Element("text", c));
      } else if (c) {
        this.children.push(c);
      }
    }
  }
  prepend(...children) {
    for (let i = children.length - 1; i >= 0; i--) {
      const c = children[i];
      if (typeof c === "string") {
        this.children.unshift(new Element("text", c));
      } else if (c) {
        this.children.unshift(c);
      }
    }
  }
  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }
  setAttribute(key, value) {
    this[key] = value;
  }
}

const walk = (node) => [node, ...node.children.flatMap(walk)];

test("plugin library presents work documents with the current file contract, opens document preview, and renders markdown and inline media", async () => {
  const ids = Object.fromEntries(
    ["search", "tree", "reader"].map((id) => [id, new Element(id)]),
  );
  let publish;
  const readArtifactCalls = [];
  runInNewContext(
    readFileSync(
      new URL(
        "../resources/extensions/plugins/project-materials/ui/library.js",
        import.meta.url,
      ),
      "utf8",
    ),
    {
      addEventListener: () => {},
      document: {
        createElement: (tag) => new Element(tag),
        getElementById: (id) => ids[id],
      },
      window: {
        workbench: {
          onData: (fn) => {
            publish = fn;
          },
          readArtifact: async (id) => {
            readArtifactCalls.push(id);
            return {
              kind: "text",
              path: id,
              content: "# 剧情梗概\n精彩故事内容",
              label: "当前作品文件",
              truncated: false,
            };
          },
          readMedia: async () => ({
            kind: "media",
            mediaKind: "video",
            bytes: 100,
            mediaRevision: "1",
          }),
        },
      },
    },
  );
  publish({
    artifacts: [
      {
        id: "artifacts/story/brief/brief.md",
        relativePath: "artifacts/story/brief/brief.md",
        bytes: 120,
      },
      {
        id: "artifacts/episodes/EP01/writing/script/script.md",
        relativePath: "artifacts/episodes/EP01/writing/script/script.md",
        bytes: 2400,
      },
      {
        id: "artifacts/episodes/EP01/post/assembly/EP01.mp4",
        relativePath: "artifacts/episodes/EP01/post/assembly/EP01.mp4",
        bytes: 24000000,
      },
    ],
  });

  const labels = ids.tree.children.map((n) =>
    walk(n).find((c) => c.className === "tree-label")?.textContent,
  );
  assert.ok(labels.includes("故事设定"));
  assert.ok(labels.includes("分集制作"));

  // Expand 故事设定
  const storyNode = ids.tree.children.find((n) =>
    walk(n).some((c) => c.textContent === "故事设定"),
  );
  assert.ok(storyNode);
  const storyToggle = walk(storyNode).find((c) => c.className === "tree-toggle");
  assert.ok(storyToggle);
  storyToggle.onclick();

  // Click 作品目标
  const briefBtn = walk(ids.tree).find(
    (c) => c.className === "tree-label" && c.textContent === "作品目标",
  );
  assert.ok(briefBtn);
  briefBtn.onclick();

  assert.ok(walk(ids.reader).some((c) => c.textContent === "作品目标"));
  assert.ok(walk(ids.reader).some((c) => c.className?.includes("detail-section")));

  await new Promise(setImmediate);
  assert.ok(readArtifactCalls.includes("artifacts/story/brief/brief.md"));
  assert.ok(walk(ids.reader).some((c) => c.className === "markdown-body"));
  assert.ok(walk(ids.reader).some((c) => c.textContent === "复制"));

  // Search video in post/assembly and preview
  ids.search.oninput({ target: { value: "EP01.mp4" } });
  const assemblyBtn = walk(ids.tree).find(
    (c) => c.className === "tree-label" && c.textContent === "成片",
  );
  assert.ok(assemblyBtn);
  assemblyBtn.onclick();

  assert.ok(
    walk(ids.reader).some((c) => c.className?.includes("inline-media")),
    "video artifact renders inline in reader area",
  );
  assert.ok(
    walk(ids.reader).some((c) => c.className?.includes("media-play")),
    "video load/play button is available",
  );
});

test("project materials plugin hierarchically organizes current short-drama artifacts into story, assets, episode stages, and handles search", async () => {
  const ids = Object.fromEntries(
    ["search", "tree", "reader"].map((id) => [id, new Element(id)]),
  );
  const readPaths = [];
  let publish;
  runInNewContext(
    readFileSync(
      new URL(
        "../resources/extensions/plugins/project-materials/ui/library.js",
        import.meta.url,
      ),
      "utf8",
    ),
    {
      addEventListener: () => {},
      document: {
        createElement: (tag) => new Element(tag),
        getElementById: (id) => ids[id],
      },
      window: {
        workbench: {
          onData: (fn) => {
            publish = fn;
          },
          readArtifact: async (id) => {
            readPaths.push(id);
            return {
              kind: "text",
              path: id,
              content: `# Content for ${id}`,
              label: "作品文档",
              truncated: false,
            };
          },
        },
      },
    },
  );
  publish({
    artifacts: [
      { id: "story/brief/brief.md", relativePath: "story/brief/brief.md", bytes: 100 },
      { id: "story/blueprint/blueprint.md", relativePath: "story/blueprint/blueprint.md", bytes: 200 },
      { id: "story/canon/canon.md", relativePath: "story/canon/canon.md", bytes: 300 },
      { id: "story/units/u1/unit.md", relativePath: "story/units/u1/unit.md", bytes: 150 },
      { id: "assets/asset-registry.json", relativePath: "assets/asset-registry.json", bytes: 400 },
      { id: "assets/music/bgm01/track.md", relativePath: "assets/music/bgm01/track.md", bytes: 500 },
      { id: "episodes/EP01/writing/script/script.md", relativePath: "episodes/EP01/writing/script/script.md", bytes: 1200 },
      { id: "episodes/EP01/writing/state/state.md", relativePath: "episodes/EP01/writing/state/state.md", bytes: 600 },
      { id: "episodes/EP01/director/director-plan/director-plan.md", relativePath: "episodes/EP01/director/director-plan/director-plan.md", bytes: 850 },
      { id: "episodes/EP01/director/performance-plan/performance-plan.md", relativePath: "episodes/EP01/director/performance-plan/performance-plan.md", bytes: 850 },
      { id: "episodes/EP01/director/shot-plan/shot-plan.md", relativePath: "episodes/EP01/director/shot-plan/shot-plan.md", bytes: 850 },
      { id: "episodes/EP01/director/bgm-plan/bgm-plan.md", relativePath: "episodes/EP01/director/bgm-plan/bgm-plan.md", bytes: 850 },
      { id: "episodes/EP01/production/production.json", relativePath: "episodes/EP01/production/production.json", bytes: 2500 },
      { id: "episodes/EP01/post/assembly/assembly.md", relativePath: "episodes/EP01/post/assembly/assembly.md", bytes: 1100 },
      { id: "research/market/research.md", relativePath: "research/market/research.md", bytes: 950 },
      { id: "reviews/ep01-check/review.md", relativePath: "reviews/ep01-check/review.md", bytes: 450 },
    ],
  });

  const topLabels = ids.tree.children.map((n) =>
    walk(n).find((c) => c.className === "tree-label")?.textContent,
  );
  assert.ok(topLabels.includes("故事设定"));
  assert.ok(topLabels.includes("全剧资产"));
  assert.ok(topLabels.includes("分集制作"));
  assert.ok(topLabels.includes("研究资料"));
  assert.ok(topLabels.includes("审查记录"));

  // Search filtering
  ids.search.oninput({ target: { value: "shot-plan" } });
  const matchingLabels = walk(ids.tree)
    .filter((c) => c.className === "tree-label")
    .map((c) => c.textContent);
  assert.ok(matchingLabels.includes("分集制作"));
  assert.ok(matchingLabels.includes("EP01"));
  assert.ok(matchingLabels.includes("镜头规划"));
  assert.equal(matchingLabels.includes("故事设定"), false);

  // Clear search restores top level branches
  ids.search.oninput({ target: { value: "" } });
  const restoredLabels = ids.tree.children.map((n) =>
    walk(n).find((c) => c.className === "tree-label")?.textContent,
  );
  assert.ok(restoredLabels.includes("故事设定"));
});

test("project materials renders ordinary hash and pipe text without stalling, and keeps real blocks", () => {
  const code = readFileSync(
    new URL(
      "../resources/extensions/plugins/project-materials/ui/library.js",
      import.meta.url,
    ),
    "utf8",
  );
  const instrumented = code.replace(
    "function renderMarkdown",
    "globalThis.__renderMarkdown = renderMarkdown; function renderMarkdown",
  );
  const doc = {
    createElement(tag) {
      return {
        tag,
        children: [],
        append(...c) {
          this.children.push(...c);
        },
        replaceChildren(...c) {
          this.children = c;
        },
        setAttribute() {},
      };
    },
    getElementById() {
      return {
        scrollTop: 0,
        replaceChildren() {},
        children: [],
        append() {},
      };
    },
  };
  const sandbox = {
    document: doc,
    addEventListener() {},
    window: { workbench: { onData() {} } },
  };
  runInNewContext(instrumented, sandbox);
  const renderFn = sandbox.__renderMarkdown;

  const context = createContext({
    result: null,
    renderForTest(markdown) {
      return renderFn(markdown);
    },
  });

  const longPipe = "| a ".repeat(200);
  const longHash = "#".repeat(500);
  for (const input of [longPipe, longHash]) {
    context.input = input;
    const start = Date.now();
    const rendered = runInContext("renderForTest(input)", context, {
      timeout: 200,
    });
    assert.ok(Date.now() - start < 100);
    assert.equal(rendered.children[0].tag, "p");
  }
  context.input = "# 标题\n\n| A |\n| --- |\n| B |\n\n- 项目";
  const rendered = runInContext("renderForTest(input)", context, {
    timeout: 200,
  });
  assert.deepEqual(
    rendered.children.map((child) => child.tag),
    ["h1", "table", "ul"],
  );
});

test("project materials keeps generated clips, post files and archive files distinct from delivery", () => {
  const ids = Object.fromEntries(
    ["search", "tree", "reader"].map((id) => [id, new Element(id)]),
  );
  let publish;
  runInNewContext(
    readFileSync(
      new URL(
        "../resources/extensions/plugins/project-materials/ui/library.js",
        import.meta.url,
      ),
      "utf8",
    ),
    {
      document: {
        createElement: (tag) => new Element(tag),
        getElementById: (id) => ids[id],
      },
      window: {
        workbench: {
          onData: (fn) => {
            publish = fn;
          },
          readArtifact: async () => ({ kind: "text", content: "# Plan" }),
        },
      },
      addEventListener() {},
    },
  );
  const paths = [
    "episodes/EP01/production/clips/C001/C001.mp4",
    "episodes/EP01/post/assembly/assembly.md",
    "episodes/EP01/director/director-plan/director-plan.md",
    "episodes/EP01/director/director-plan/archive/v1.md",
  ];
  publish({
    artifacts: paths.map((id) => ({ id, relativePath: id, bytes: 100 })),
  });

  // Search director-plan
  ids.search.oninput({ target: { value: "director-plan" } });
  const dirBtn = walk(ids.tree).find(
    (c) => c.className === "tree-label" && c.textContent === "导演整体方案",
  );
  assert.ok(dirBtn);
  dirBtn.onclick();

  // Archive is kept in archive section and not as root deliverable node
  assert.ok(
    walk(ids.reader).some((c) => c.className?.includes("archive-section")),
    "archive section exists inside reader",
  );
  assert.ok(
    walk(ids.reader).some((c) => c.textContent?.includes("归档资料 · 1")),
    "archive count is correctly displayed",
  );

  // Search clips
  ids.search.oninput({ target: { value: "C001" } });
  const clipBtn = walk(ids.tree).find(
    (c) => c.className === "tree-label" && c.textContent?.includes("C001"),
  );
  assert.ok(clipBtn);
});
