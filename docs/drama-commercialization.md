# 短剧运营中心维护

本页路径相对于本资源仓库。开发工具使用 `WORKBENCH_APP_ROOT` 指定应用项目，默认读取旁边的 `zero-point-workbench`。

本页是“短剧运营中心”的源码查看、修改、检查和重新打包入口。源码组织标识为 **`drama-commercialization`**；它负责短剧、漫剧的市场曝光、宣发物料、渠道运营、发行合作、付费增长与商业收益核对。

组织方法维护分工和交接，员工维护身份与个人方法，技能维护专业判断和媒体处理。具体执行以组织 `playbook.md` 为准；公开发布、商务外发、付费投放和版权授权须在用户已明确批准的具体范围内进行，模板本身不提供平台连接或操作权限。

## 源码与岗位

以下路径均相对于仓库根目录；查看分发 ZIP 时使用下一节的对应路径。

| 内容                                          | 源码位置                                                         |
| --------------------------------------------- | ---------------------------------------------------------------- |
| 组织标识、版本、岗位、员工引用、插件清单      | `resources/packs/drama-commercialization/pack.yaml`              |
| 端到端协作、采用节点、风险审查、返修与交接    | `resources/packs/drama-commercialization/playbook.md`            |
| 本组织各岗位职责                              | `resources/packs/drama-commercialization/{role}.md`              |
| 任务工单与业务产物目录                        | `resources/packs/drama-commercialization/artifacts.yaml`         |
| 员工身份、个人方法与默认技能                  | `resources/employees/{员工定义ID}.yaml` 及其中引用的 Markdown    |
| 宣发定位、钩子、渠道、本地化、增长测量        | `resources/extensions/skills/drama-marketing/`                   |
| 权利链、平台发行、商业主张、AI 标识和商务风险 | `resources/extensions/skills/drama-release-compliance/`          |
| 真实剪辑、音轨处理、导出与视听验收            | `resources/extensions/skills/post-production/`                   |
| 负责人通用协作方法                            | `resources/builtin/skills/project-coordination/`                 |
| 应用的组织模板加载入口                        | `packages/resource-loader/src/pack.ts` 中的 `loadBundledPacks()` |

| 岗位           | role           | 员工定义 ID            | 默认技能                             |
| -------------- | -------------- | ---------------------- | ------------------------------------ |
| 商业化总监     | `leader`       | `commercial-lead`      | `project-coordination`               |
| 市场情报分析师 | `researcher`   | `market-intelligence`  | 无，使用个人 PLAYBOOK                |
| 宣发策划师     | `strategist`   | `promotion-strategist` | `drama-marketing`                    |
| 宣传素材导演   | `producer`     | `promo-producer`       | `drama-marketing`、`post-production` |
| 渠道运营专员   | `operator`     | `channel-operator`     | `drama-marketing`                    |
| 发行商务经理   | `distribution` | `distribution-bd`      | 无，使用个人 PLAYBOOK                |
| 数据增长分析师 | `analytics`    | `growth-analyst`       | `drama-marketing`                    |
| 广告投放优化师 | `ads`          | `ad-optimizer`         | `drama-marketing`                    |
| 商业变现经理   | `monetization` | `monetization-manager` | 无，使用个人 PLAYBOOK                |
| 合规风控专员   | `compliance`   | `compliance-reviewer`  | `drama-release-compliance`           |

员工显示名称使用中文职责名，定义 ID 使用小写英文职责名及连字符，不包含作者、账号或个人姓名前缀。YAML、身份 Markdown 和个人 PLAYBOOK 文件名与定义 ID 对齐；Hub 来源、发布者及正式资源身份单独核对，不从源码 ID 推断。员工定义维护技能清单，组织岗位不重复列技能；改员工定义版本后同步 `pack.yaml` 的准确引用。共享的 `post-production` 也供短剧创作组织使用，修改时同时检查正片制作与宣传切片两种输入。

## 查看与重新打包

在仓库根目录、使用已安装的锁定依赖运行：

```bash
# 从当前源码构建并校验分发目录，不生成 ZIP
pnpm bundle:pack --pack drama-commercialization --check-only

# 从当前源码校验并生成 ZIP
pnpm bundle:pack --pack drama-commercialization --no-desktop

# 仅复查现有分发目录，不同步源码
pnpm bundle:pack --pack drama-commercialization --no-sync --check-only

# 文档链接与标题检查
pnpm check:docs
```

标准输出为 `dist/drama-commercialization-bundle/` 和 `dist/drama-commercialization-bundle.zip`。目录中包含：

| 分发路径                          | 查看内容                           |
| --------------------------------- | ---------------------------------- |
| `organization/pack.yaml`          | 组织名称、版本、十个岗位和插件引用 |
| `organization/playbook.md`        | 组织完整工作方法及主流程           |
| `organization/artifacts.yaml`     | 工单、共同背景和推广业务产物目录   |
| `employees/{员工定义ID}/`         | 对应 YAML、身份和个人 PLAYBOOK     |
| `skills/{技能ID}/`                | 当前依赖的完整技能包及引用资料     |
| `docs/drama-commercialization.md` | 本维护说明                         |

打包器从当前源码收集员工和技能依赖，在临时目录校验后替换生成目录；缺少依赖或结构错误时停止并保留已有分发目录。生成结果只用于查看和交付，修改应回到源码后重新生成。指定 `--output /绝对路径/文件.zip` 可以另存 ZIP；构建目录仍是上述 `dist` 目录。

该 ZIP 是扁平源码 Bundle，不是一次上传就能更新全部资源的 Hub 组织模板。插件只有引用，不包含在这个 ZIP 中；安装方式必须使用当前工作台支持的资源和模板入口。

## 依赖与素材衔接

完整依赖以组织和员工 YAML 为准。组织引用 `media`、`pixel-studio`、`project-materials` 三个扩展插件；技能包括内置 `project-coordination`，以及扩展 `drama-marketing`、`drama-release-compliance`、`post-production`。扩展源码用于开发和发布，不随客户端自动安装；创建组织前应安装完整依赖，配置实际需要的连接。缺少依赖时宿主拒绝创建残缺组织。

| 插件 | 当前能力与用途 |
| --- | --- |
| `media` | 媒体参数检查、抽帧、提取音频、简单视频拼接；完整宣传剪辑还需实际可用的裁剪、字幕、画幅适配和混音能力 |
| `project-materials` | 作品文档与媒体浏览页面；当前分组偏向短剧创作，推广活动目录下的文档归入其他资料 |
| `pixel-studio` | 团队和任务状态展示页面，不提供图像生成或封面编辑 |

两个页面插件在业务执行上属于辅助界面，当前模板仍将它们列为创建依赖。专业技能提供方法，不补足缺失的媒体编辑、图片生成或平台接口；实际任务按引擎与已启用插件提供的能力开展。

没有声明抖音、红果、邮件或广告后台连接已经具备。未接入平台时仍可交付方案、真实素材和人工操作清单，执行状态据实际回执说明。

宣传素材可以来自用户提供的成片，或创作组织实际交接的有效成片与制作记录；原素材保持权威位置，引用获准路径、准确版本、取用范围和用途。宣传切片不要求重建整集导演文件；源片缺失时先交创意与补料清单。真实裁剪、声音处理和导出能力以 `post-production` 与实际插件说明为准。

执行时宿主将作品当前目录约定写入会话的 `project-contract.yaml`，专业产物保存在作品的 `artifacts` 下。工单按用户任务真实 `taskId` 集中保存；各活动的业务成果按 `campaignId` 组织，二者不能互相代替。`promo-package` 登记真实媒体路径与版本，不将登记文件当作实际视频。

## 源码、发布与本机采用

源码同步、Bundle 打包、Hub 正式发布、已安装资源更新和实际组织采用是不同结果，分别核对。当前源码版本由各 YAML 或 `SKILL.md` 维护；Hub 正式版本由服务端分配。Bundle 的文件名和源码中的作者前缀不能证明正式资源已经存在。

需要发布时，先按 `resources/builtin/skills/workbench-hub/SKILL.md` 及其引用读取实际来源、账号、已有资源与全部分页，确认是否已有同一套组织、员工和技能的发布关系，不猜测或另建同名资源。沿准确依赖顺序发布变化的扩展技能、员工模板和组织模板；内置协作技能随应用交付，不通过 Hub 同标识发布。发布准备、上传、提交和正式包回取核验各自保留真实结果，未知提交查询原作业，不盲目重提。

已有组织更新前核对目标模板、完整依赖和本机定制，采用宿主的差异预览与原位更新入口，保留组织与员工 ID、成员、权限、连接、设置、作品及历史。安装模板不等于覆盖实例，不通过重建组织绕过差异处理。开发和发布共用的原则由 `AGENTS.md`、`resources/README.md` 和资源 Hub 技能维护。

## 检查与效果边界

在应用项目目录执行与本组织接入有关的离线回归。资源仓库的文档检查另在本仓库执行 `pnpm check:docs`。

```bash
node --test tests/integration/organization-bundle.test.mjs tests/integration/drama-commercialization.test.mjs
pnpm typecheck
pnpm check:docs
```

Bundle 校验验证组织、员工和技能结构及完整依赖收集；组织回归使用独立临时数据库，检查依赖缺失拒绝、成员与技能分配、目录约定、任务上下文和重开保留。Mermaid 渲染、真实员工委派、媒体加工、平台操作、Hub 发布及安装包升级分别验证，不能由离线回归推定通过。

后续可直接提出：按 `docs/drama-commercialization.md` 查看或维护短剧运营中心，修改所属源码并重新校验、打包；需要发布或更新已有组织时，明确目标来源与采用范围，并分别报告实际结果。
