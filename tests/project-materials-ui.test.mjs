import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext, createContext, runInContext } from "node:vm";

test("plugin library presents work documents with the current file contract, opens document preview, and collapses empty categories", async () => {
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.open = false;
      this.isConnected = true;
    }
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren(...children) {
      this.children = children;
    }
    setAttribute(key, value) {
      this[key] = value;
    }
  }
  const ids = Object.fromEntries(
    ["documents-tab", "media-tab", "search", "tree", "reader"].map((id) => [
      id,
      new Element(id),
    ]),
  );
  let publish;
  const calls = [],
    readArtifactCalls = [];
  const walk = (node) => [node, ...node.children.flatMap(walk)];
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
          openArtifact: (...args) => calls.push(args),
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
        },
      },
    },
  );
  publish({
    artifacts: [
      {
        id: "artifacts/story/brief.md",
        relativePath: "artifacts/story/brief.md",
        bytes: 120,
      },
      {
        id: "artifacts/episodes/EP001/script.md",
        relativePath: "artifacts/episodes/EP001/script.md",
        bytes: 2400,
      },
      {
        id: "artifacts/episodes/EP01/post/EP01.mp4",
        relativePath: "artifacts/episodes/EP01/post/EP01.mp4",
        bytes: 24000000,
      },
    ],
  });
  assert.equal(ids["documents-tab"].textContent, "作品文档 · 3");
  const storyGroup = ids.tree.children.find((item) =>
    item.children[0].textContent.includes("故事设定"),
  );
  assert.ok(storyGroup);
  assert.equal(storyGroup.open, true);
  assert.equal(storyGroup.children[1].textContent, "作品目标");
  assert.equal(
    storyGroup.children[1].children[0].textContent,
    "story/brief.md · 120 B",
  );
  storyGroup.children[1].onclick();
  const selectedBtn = walk(ids.tree).find(
    (node) => node.className === "selected",
  );
  assert.ok(selectedBtn);
  assert.equal(selectedBtn.textContent, "作品目标");
  assert.ok(
    walk(ids.reader).some((node) => node.className === "reader-body"),
    "document renders inline in reader area",
  );
  assert.ok(
    walk(ids.reader).some((node) => node.className === "copy-button"),
    "reader toolbar provides copy button",
  );
  await new Promise(setImmediate);
  assert.deepEqual(readArtifactCalls, ["artifacts/story/brief.md"]);
  assert.ok(
    walk(ids.reader).some((node) => node.className === "markdown-body"),
    "markdown content formatted inline",
  );

  // Video artifact in documents tree opens in media reader directly
  const episodeSection = ids.tree.children.find((item) =>
    item.children[0].textContent.includes("分集制作"),
  );
  assert.ok(episodeSection);
  const videoBtn = walk(episodeSection).find((c) =>
    c.textContent?.includes("EP01.mp4"),
  );
  assert.ok(videoBtn);
  videoBtn.onclick();
  assert.ok(
    walk(ids.reader).some((node) => node.className === "media-viewer"),
    "video artifact renders in media player",
  );
  assert.ok(
    walk(ids.reader).some((node) => node.className === "media-play"),
    "video player play button present",
  );

  const emptySection = ids.tree.children.find((item) =>
    item.children[0].textContent.includes("审查记录"),
  );
  assert.ok(emptySection);
  assert.equal(emptySection.open, false);
});

test("project materials plugin hierarchically organizes current short-drama artifacts into story, assets, episode stages, and handles search", async () => {
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.open = false;
      this.isConnected = true;
    }
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren(...children) {
      this.children = children;
    }
    setAttribute(key, value) {
      this[key] = value;
    }
  }
  const ids = Object.fromEntries(
    ["documents-tab", "media-tab", "search", "tree", "reader"].map((id) => [
      id,
      new Element(id),
    ]),
  );
  const readPaths = [];
  let publish;
  const walk = (node) => [node, ...node.children.flatMap(walk)];
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
          openArtifact: () => {},
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
      { id: "story/brief.md", relativePath: "story/brief.md", bytes: 100 },
      {
        id: "story/blueprint.md",
        relativePath: "story/blueprint.md",
        bytes: 200,
      },
      { id: "story/canon.md", relativePath: "story/canon.md", bytes: 300 },
      {
        id: "story/units/u1.md",
        relativePath: "story/units/u1.md",
        bytes: 150,
      },
      {
        id: "assets/asset-registry.md",
        relativePath: "assets/asset-registry.md",
        bytes: 400,
      },
      {
        id: "assets/music/bgm01/track.md",
        relativePath: "assets/music/bgm01/track.md",
        bytes: 500,
      },
      {
        id: "episodes/EP01/script.md",
        relativePath: "episodes/EP01/script.md",
        bytes: 1200,
      },
      {
        id: "episodes/EP01/state.md",
        relativePath: "episodes/EP01/state.md",
        bytes: 600,
      },
      {
        id: "episodes/EP01/director/bgm-plan.md",
        relativePath: "episodes/EP01/director/bgm-plan.md",
        bytes: 850,
      },
      {
        id: "episodes/EP01/director/director-book.md",
        relativePath: "episodes/EP01/director/director-book.md",
        bytes: 850,
      },
      {
        id: "episodes/EP01/director/shot-plan.md",
        relativePath: "episodes/EP01/director/shot-plan.md",
        bytes: 850,
      },
      {
        id: "episodes/EP01/director/performance-plan.md",
        relativePath: "episodes/EP01/director/performance-plan.md",
        bytes: 850,
      },
      {
        id: "episodes/EP01/director/director-plan.md",
        relativePath: "episodes/EP01/director/director-plan.md",
        bytes: 850,
      },
      {
        id: "episodes/EP01/production/production.md",
        relativePath: "episodes/EP01/production/production.md",
        bytes: 2500,
      },
      {
        id: "episodes/EP01/post/assembly.md",
        relativePath: "episodes/EP01/post/assembly.md",
        bytes: 1100,
      },
      {
        id: "research/market.md",
        relativePath: "research/market.md",
        bytes: 950,
      },
      {
        id: "reviews/ep01-check.md",
        relativePath: "reviews/ep01-check.md",
        bytes: 450,
      },
    ],
  });

  assert.equal(ids["documents-tab"].textContent, "作品文档 · 17");

  // 1. 故事设定分组
  const storySec = ids.tree.children.find((c) =>
    c.children[0]?.textContent?.includes("故事设定"),
  );
  assert.ok(storySec);
  assert.equal(storySec.children[0].children[0].textContent, "4");
  assert.ok(storySec.children.some((c) => c.textContent === "作品目标"));
  assert.ok(storySec.children.some((c) => c.textContent === "故事蓝图"));
  assert.ok(storySec.children.some((c) => c.textContent === "锁定事实"));
  assert.ok(storySec.children.some((c) => c.textContent === "承重单元 · u1"));

  // 2. 全剧资产分组
  const assetSec = ids.tree.children.find((c) =>
    c.children[0]?.textContent?.includes("全剧资产"),
  );
  assert.ok(assetSec);
  assert.equal(assetSec.children[0].children[0].textContent, "2");
  assert.ok(assetSec.children.some((c) => c.textContent === "正式素材登记"));
  assert.ok(
    assetSec.children.some((c) => c.textContent === "曲目制作 · bgm01"),
  );

  // 3. 分集制作（含集数聚合与编剧、导演规划、视频制作、后期四阶段）
  const epSec = ids.tree.children.find((c) =>
    c.children[0]?.textContent?.includes("分集制作"),
  );
  assert.ok(epSec);
  assert.equal(epSec.children[0].children[0].textContent, "9");
  const ep01 = epSec.children.find(
    (c) => c.tag === "details" && c.children[0]?.textContent?.includes("EP01"),
  );
  assert.ok(ep01);
  assert.equal(ep01.children[0].children[0].textContent, "9");
  // 检查阶段标签
  assert.ok(ep01.children.some((c) => c.textContent === "编剧"));
  assert.ok(ep01.children.some((c) => c.textContent === "导演规划"));
  assert.ok(ep01.children.some((c) => c.textContent === "视频制作"));
  assert.ok(ep01.children.some((c) => c.textContent === "后期交付"));
  const ep01Btns = ep01.children.filter((c) => c.tag === "button");
  const filePath = (button) => button.children[0].textContent.split(" · ")[0];
  assert.deepEqual(ep01Btns.map(filePath), [
    "script.md",
    "state.md",
    "director/director-plan.md",
    "director/performance-plan.md",
    "director/shot-plan.md",
    "director/bgm-plan.md",
    "director/director-book.md",
    "production/production.md",
    "post/assembly.md",
  ]);

  const performancePlan = ep01Btns.find(
    (b) => filePath(b) === "director/performance-plan.md",
  );
  performancePlan.onclick();
  await new Promise(setImmediate);
  assert.ok(
    walk(ids.reader).some((node) =>
      node.textContent?.includes("performance-plan.md"),
    ),
  );

  const previousBook = ep01Btns.find(
    (b) => filePath(b) === "director/director-book.md",
  );
  previousBook.onclick();
  await new Promise(setImmediate);
  assert.deepEqual(readPaths, [
    "episodes/EP01/director/performance-plan.md",
    "episodes/EP01/director/director-book.md",
  ]);
  assert.ok(
    walk(ids.reader).some((node) => node.textContent === "director-book.md"),
  );

  ids.search.oninput({ target: { value: performancePlan.textContent } });
  const epSecFiltered = ids.tree.children.find((c) =>
    c.children[0]?.textContent?.includes("分集制作"),
  );
  assert.deepEqual(
    walk(epSecFiltered)
      .filter((c) => c.tag === "button")
      .map(filePath),
    ["director/performance-plan.md"],
  );

  // 清空搜索后恢复
  ids.search.oninput({ target: { value: "" } });
  const epSecRestored = ids.tree.children.find((c) =>
    c.children[0]?.textContent?.includes("分集制作"),
  );
  assert.equal(walk(epSecRestored).filter((c) => c.tag === "button").length, 9);
});

test("project materials renders ordinary hash and pipe text without stalling, and keeps real blocks", () => {
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
    }
    append(...children) {
      this.children.push(...children);
    }
    setAttribute() {}
  }
  const context = createContext({
    document: {
      createElement: (tag) => new Element(tag),
      getElementById: () => new Element("div"),
    },
    window: { workbench: { onData() {} } },
    addEventListener() {},
  });
  const source = readFileSync(
    new URL(
      "../resources/extensions/plugins/project-materials/ui/library.js",
      import.meta.url,
    ),
    "utf8",
  );
  runInContext(
    source.replace(
      /\}\)\(\);\s*$/,
      "globalThis.renderForTest = renderMarkdown;})();",
    ),
    context,
  );
  for (const input of [
    "#话题",
    "| 单行 |",
    "####### 标记",
    "前文\n#话题\n| 单行 |",
    "<script>text</script>",
  ]) {
    context.input = input;
    const rendered = runInContext("renderForTest(input)", context, {
      timeout: 200,
    });
    assert.ok(rendered.children.length, input);
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

test("project materials keeps generated clips, post files and retired director files distinct from delivery", () => {
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.isConnected = true;
    }
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren(...children) {
      this.children = children;
    }
    setAttribute() {}
  }
  const ids = Object.fromEntries(
    ["documents-tab", "media-tab", "search", "tree", "reader"].map((id) => [
      id,
      new Element(id),
    ]),
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
        },
      },
      addEventListener() {},
    },
  );
  const paths = [
    "episodes/EP01/production/clips/C001.mp4",
    "episodes/EP01/post/rough.mp4",
    "episodes/EP01/director/edit-plan.md",
    "director/EP01-director-plan.md",
  ];
  publish({
    artifacts: paths.map((id) => ({ id, relativePath: id, bytes: 100 })),
  });
  const episodes = ids.tree.children.find(
    (node) => node.children[0].textContent === "分集制作",
  );
  const ep = episodes.children.find((node) => node.tag === "details");
  const names = ep.children.map((node) => node.textContent);
  assert.ok(names.indexOf("C001.mp4") > names.indexOf("视频制作"));
  assert.ok(names.indexOf("C001.mp4") < names.indexOf("后期交付"));
  assert.ok(names.indexOf("rough.mp4") > names.indexOf("后期交付"));
  assert.ok(names.indexOf("edit-plan.md") > names.indexOf("分集补充"));
  assert.equal(
    names.some(
      (name) => name?.includes("Mode I") || name?.includes("交付成片"),
    ),
    false,
  );
  const other = ids.tree.children.find(
    (node) => node.children[0].textContent === "其他资料",
  );
  assert.ok(
    other.children.some((node) => node.textContent === "EP01-director-plan.md"),
  );
});
