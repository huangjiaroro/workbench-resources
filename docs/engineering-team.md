# 研发工程部：源码、查看与重新打包

本页路径相对于本资源仓库。开发工具使用 `WORKBENCH_APP_ROOT` 指定应用项目，默认读取旁边的 `zero-point-workbench`。

研发工程部是面向不同软件项目的通用研发组织，覆盖需求讨论、技术研究、开发、测试、独立代码审查与集成发布。负责人先按目标工程确认仓库、技术栈、平台和验收条件，再选择必要员工；专业员工沿用工程实际方法维护成果及返修。完整协作方法以[组织 PLAYBOOK](../resources/packs/engineering-team/playbook.md)为准；本页维护源码入口、打包操作和使用边界。

## 源码与岗位

源码组织标识是 `engineering-team`。当前版本从 [pack.yaml](../resources/packs/engineering-team/pack.yaml) 读取，不在本页维护另一份版本表。组织模板在独立资源仓库维护，通过 Hub 发布和安装；用户安装后创建研发团队。

| 岗位 | 员工定义 | 方法与主要责任 |
| --- | --- | --- |
| leader | [engineering-lead.yaml](../resources/employees/engineering-lead.yaml) | 需求与技术判断、方案、工单、协调和最终验收 |
| researcher | [technical-researcher.yaml](../resources/employees/technical-researcher.yaml) | 官方资料、开源方案、许可和适配证据 |
| backend | [backend-developer.yaml](../resources/employees/backend-developer.yaml) | 后端开发工程师：业务逻辑、接口、数据、后台任务与运行机制 |
| frontend | [frontend-developer.yaml](../resources/employees/frontend-developer.yaml) | 前端开发工程师：界面、组件、交互、状态与接口接入 |
| qa | [qa-engineer.yaml](../resources/employees/qa-engineer.yaml) | 独立测试、复现、回归及覆盖缺口 |
| reviewer | [code-reviewer.yaml](../resources/employees/code-reviewer.yaml) | 基于准确差异的独立代码审查 |
| release | [release-engineer.yaml](../resources/employees/release-engineer.yaml) | 按授权集成、构建候选、数据升级检查与发布 |

员工显示名称采用中文职责名，源码标识采用表达专业职责的小写英文及连字符，不加入作者、账号或发布者前缀。员工定义、身份文件、个人工作方法及组织引用使用同一标识；发布者身份由 Hub 来源单独记录，不混入员工名称。

7 个岗位按需要参与。简单低风险任务可以只安排一名开发者及必要检查；研究与独立审查按组织主流程的条件启动。角色有无委派资格以组织定义为准；负责人可委派，其他岗位不再向下组织另一支团队。

前后端职责不表示难度等级。没有界面或独立服务端的 CLI、库、纯前端和单体项目，由负责人按实际模块分工；不为匹配岗位新增服务或要求所有员工出场。项目专用的语言、框架、存储和部署要求留在工程说明与开发约定中，通用技能按实际需求采用。

| 修改内容 | 权威源码位置 |
| --- | --- |
| 岗位、员工定义版本与插件引用 | [pack.yaml](../resources/packs/engineering-team/pack.yaml) |
| 团队主流程、交接、风险和验收节点 | [playbook.md](../resources/packs/engineering-team/playbook.md) |
| 本组织岗位职责 | `resources/packs/engineering-team/role-*.md` |
| 工单与配套报告目录 | [artifacts.yaml](../resources/packs/engineering-team/artifacts.yaml) |
| 员工身份、个人方法与技能分配 | `resources/employees/<id>.yaml`、`<id>.md`、`<id>-playbook.md` |
| 专业技能 | `resources/extensions/skills/<skill-id>/SKILL.md` 及其引用资料 |

组织引用独立员工定义，员工定义维护技能清单；组织不重复列专业技能。负责人使用内置 `project-coordination` 与 `memory-management`，工单和共同背景沿用前者的 `references/work-orders.md`。修改前遵守[共享资源编写规范](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/resources/builtin/skills/workbench-resource-authoring/SKILL.md)。

## 专业技能

| 技能 | 入口 |
| --- | --- |
| 技术研究 | [engineering-research](../resources/extensions/skills/engineering-research/SKILL.md) |
| 架构与任务规划 | [architecture-planning](../resources/extensions/skills/architecture-planning/SKILL.md) |
| 功能实施与交付 | [implementation-delivery](../resources/extensions/skills/implementation-delivery/SKILL.md) |
| 前端开发 | [frontend-development](../resources/extensions/skills/frontend-development/SKILL.md) |
| 测试工程 | [test-engineering](../resources/extensions/skills/test-engineering/SKILL.md) |
| 真实界面验证 | [browser-e2e](../resources/extensions/skills/browser-e2e/SKILL.md) |
| 系统化调试 | [systematic-debugging](../resources/extensions/skills/systematic-debugging/SKILL.md) |
| 独立代码审查 | [independent-code-review](../resources/extensions/skills/independent-code-review/SKILL.md) |
| 发布与集成验证 | [release-validation](../resources/extensions/skills/release-validation/SKILL.md) |
| 完成证据核对 | [verification-evidence](../resources/extensions/skills/verification-evidence/SKILL.md) |

重新打包按员工依赖带入 10 个独立扩展技能和两个内置技能。内置技能随应用交付。Git 并行协作、提交、PR 和 CI 使用 GitHub 插件随包提供的 [Git 与 GitHub 工作流](../resources/extensions/plugins/github/skills/github-workflow/SKILL.md)。

## 组织对话与作品

模板默认 `workMode: both`，支持组织对话和作品主对话。组织对话适合技术讨论、团队方法、跨项目问题以及明确指定仓库的一次任务；作品主对话适合持续维护某个具体软件，积累该项目的目标、任务与文件。同一研发团队可以服务多个作品，每次任务明确当前工程与范围。

首次试运行可以从组织对话向负责人说明仓库路径、工程背景和本次目标；实际读写仍受引擎执行模式与宿主授权控制。持续开发 Workbench 时，可将其作为该团队维护的一个软件作品；当前关联已有仓库的宿主能力见[工作台配置与执行边界](#工作台配置与执行边界)。

模板改变不覆盖已有组织实例。已有研发组织要开放组织对话时，在组织详情的工作方式中选择作品与对话；已有成员名称、标识或方法的采用仍需核对实际差异，不能靠修改源码重建身份或覆盖定制。

## 查看、检查与重新打包

在仓库根目录执行以下现有命令。打包器读取当前源码，在临时目录验证完整组织、员工及技能依赖，成功后替换生成目录；直接修改生成目录不会写回源码。

```sh
# 重建并检查组织源码集合，不生成 ZIP
pnpm bundle:pack --pack engineering-team --check-only

# 从当前源码重新生成 ZIP
pnpm bundle:pack --pack engineering-team

# 查看生成包的目录清单
unzip -l dist/engineering-team-bundle.zip

# 检查文档链接及组织打包、创建和重开行为
pnpm check:docs
node --test tests/integration/organization-bundle.test.mjs tests/integration/default-organizations.test.mjs tests/integration/employee-playbook.test.mjs
```

生成目录是 `dist/engineering-team-bundle/`，ZIP 是 `dist/engineering-team-bundle.zip`。集合内包括 `organization/`、`employees/`、`skills/` 及本页的 `docs/engineering-team.md`。GitHub 插件是单独安装的依赖。正式 Hub 发布按技能、插件、员工、组织分别处理。

## 工作台配置与执行边界

引擎是实际工作台配置，不由本组织的方法文件授予。负责人和审查员可配置 Codex，其他岗位按可用账号选择 Antigravity 或 Claude Code；Gemini 是 Antigravity 中的模型选择，不是新的 Workbench 引擎标识。混用员工引擎时组织与输入框使用 Auto，避免整轮手选覆盖员工偏好；准确规则见[引擎执行配置](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/docs/engine-configuration.md)。模板没有预设具体模型、账号或执行模式。

模板要求安装 GitHub 插件，创建后组织成员可发现其命令和配套技能。已有研发组织可在组织插件中加入并启用 GitHub，按需配置命名连接。研究、UI 验证与构建使用工程实际可用的工具和环境。

组织目录约定只定位工单与配套报告，实际代码保留在获准仓库的原有结构中。当前 Workbench 的作品成果可写范围及文件发现仍以 `artifacts/` 为基础，关联已有仓库及放开整个作品主目录属于宿主功能改造；同步此组织不表示这些能力已经实现。使用独立 Worktree 时同样核对实际可写范围，见[作品文件](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/docs/project-storage.md)和[组织权限](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/docs/organization-permissions.md)。

## 来源、分发与采用

初始来源为《研发工程部-可编辑源码-v1.0.0.zip》。准确归档摘要、源码组织及员工标识清单保存在 [PROVENANCE.json](../resources/packs/engineering-team/PROVENANCE.json)，原包声明的参考项目见 [SOURCES.md](../resources/packs/engineering-team/SOURCES.md)。这些记录用于核对来源，不代表已验证原包的 Hub 账号、正式发布或运行效果。

组织和员工源码使用仓库原生 `pack.yaml`、`definition: {id, version}` 与 `skills: [{id}]` 格式；原包中的 registry、publisher 与 payload digest 不作为源码依赖声明。未来发布前先读取明确 Hub 来源的真实历史及完整包，再核实发布身份，不能将原包样例摘要当作正式依赖或认定资源从未发布。

源码保存、源码 ZIP、Hub 正式发布、本机模板安装、已有组织采用、真实引擎协作分别核验。源码同步不会修改正式数据库、已有组织员工、权限、连接或账号。发布与采用沿用[资源管理](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/docs/resource-management.md)和[员工与组织广场](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/docs/organization-gallery.md)的现有流程；未经实际核验的环节明确保留为未验证。

以后可直接提出：“按 `docs/engineering-team.md` 查看或维护通用研发工程部，修改所属源码并校验；需要打包、Hub 发布或本机采用时按本次明确范围分别处理。”
