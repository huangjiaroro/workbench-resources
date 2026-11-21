---
name: drama-writing
description: 根据有效蓝图、设定、相关剧情单元与前集状态，创作或修订单集戏剧设计、正式分场剧本及续作状态时使用。
metadata:
  version: 1.1.1
  display_name: 单集剧本创作
---

# 单集剧本创作（Drama Writing）

负责具体单集的戏剧设计、正式正文及续作状态。按当前产物契约（`project-contract.yaml`）定位 episode-design、episode、episode-state。导演从本集设计理解人物意图、潜台词和场景目的；剧情事实、动作与对白以有效 Script 为准。

## 执行规则

首次单集创作按 **A → B → C** 执行；已有有效成果时从实际需要的阶段或步骤进入。

1. 开始当前阶段，读取该阶段输入、产物模板及指定案例。确认采用的上游依据一致；不提前集中读取后续阶段或步骤的方法资料。
2. **每一步是独立的执行单元：实际读取表中列明的必读方法正文与已保存的依赖结果，完成当前设计，通过独立文件写入或更新操作保存，再进入下一步。** 准确、仍适用且本轮上下文已读的方法可复用；熟悉理论名称或已有剧情摘要不等于完成方法读取或设计。
3. 专题按实际问题触发，在相关设计前读取。局部修改可直接复用已成立的设计章节（明确对应位置、适用范围和有效前提），只更新受影响的直接依赖。不全库通读，不另交逐步文件或阅读日志；检查与诊断的工作结果记录于临时工作稿，置于正式产物目录之外。
4. 检查步骤在待检查成果保存后独立回读、核对、修正和复查；不在一次生成中同时完成相依设计与其核验。首次单集创作，A 完成并保存后才写 B 的正文，B 核验及修订完成后才生成 C 的 State。内部关卡不增加独立审批。

继承用户明确要求、已采用的故事决定、关键台词、真相及有效版本；未锁定细节由编剧自主设计。候选与研究参考不自动成为用户要求，缺失研究素材不阻塞正常写作。需要新创意可调用 `story-ideation`。上游不足以支撑重大情节时定向补足，涉及改变用户确认的决定交主创协调。

## A｜单集戏剧设计

**输入：** 本集工单、有效 Blueprint/Canon/相关 Story Unit、前集有效 State 与必要正文、已有本集设计。首集没有前集 State 时以有效故事起始条件为准。  
**产物模板：** [episode-design](assets/episode-design-guidance.md)。  
**阶段案例：** 首次单集设计必读[夜灯铺单集案例](examples/night-lamp-episode.md) 的 A 部分，理解如何将采用大纲落实为具体戏剧推进；B、C 示例在相应阶段读取。

| 步骤 | 前置依赖 | 必读方法 | 设计结果 |
| --- | --- | --- | --- |
| A1 人物行动与冲突 | 本集有效上游 | [人物行动与冲突方法](references/character-action/craft.md) | 各承重人物当前目标、动机、知情、障碍、策略、反制与选择代价 |
| A2 单集结构 | A1、Blueprint 与前集 State | [单集结构方法](references/episode-structure/craft.md) | 本集进入处境、开场、事件因果、主要转折、信息释放、结尾及承接 |
| A3 场景设计 | A1/A2 | [场景设计方法](references/scene-craft/craft.md) | 有序场景的进入状态、目标、具体行动与反制、戏剧变化、离开状态及关键空间物件 |
| A4 对白与潜台词 | A1–A3 | [对白与潜台词方法](references/dialogue/craft.md) | 承重语言交锋的意图、策略、潜台词、角色声音及听者回应；重要原话及表达方向 |
| A5 单集设计检查 | 已保存的 A1–A4、有效上游 | [单集返修](references/revision-guidance.md)、[连续性](references/continuity-guidance.md) | 核对行动、事件、场景、对白设计一致及上游事实成立，补齐实际设计缺口 |

A1–A4 分别面向本集完整戏剧设计，在同一份 `episode-design.md` 中依次写入对应章节；每一步实际保存并结束当前写入操作后，下一步回读相关章节再继续。不一次性填完全部章节，不在写完剧本后倒补设计。A5 在后续独立操作中回读完整设计稿及有效依据，定位实际缺口，回对应步骤修正并同步受影响章节，再回读复查；无实质缺口时确认原设计。完成 A5 前设计稿尚未定稿。

专项按实际问题触发，进入依赖它的设计前必读：

- A1：复杂人物动机读[人物模型与心理学](references/character-action/character-models-and-psychology.md)；反制、升级及过渡读[冲突案例](references/character-action/examples/conflict-and-opponent-cases.md)；复杂人物核查可用[埃格里分析模板](references/character-action/templates/egri-play-analysis.md)。
- A2：信息揭示、pilot、分幕、多线编织参考[单集结构表与案例](references/episode-structure/episode-structure-tables-and-cases.md)，历史电视页数、幕数按媒介适用性取舍。
- A3：场景价值转折、行动反制、道具或悬念乏力时读[场景分析案例](references/scene-craft/examples/scene-analysis-casebook.md)。
- A4：对白攻防、潜台词或角色差异问题读[对白冲突案例](references/dialogue/examples/dialogue-conflict-casebook.md)。
- 喜剧、荒诞及笑点问题在实际相关的 A1–A4 步骤触发[喜剧方法](references/comedy/craft.md)，结合需要读取[喜剧框架与技法](references/comedy/comedy-frameworks-and-techniques.md)及[笑点案例](references/comedy/examples/comedy-jokes-and-fleabag-cases.md)；情境反差、铺垫与意外后果优先于固定笑点配额。

人物、结构、场景和语言设计互相校准；下游推演暴露前置问题时回对应步骤并同步受影响内容。对白设计明确语言行为，不提前写两遍完整正文。

**阶段完成：** A5 读取实际保存的 A1–A4，核对模板判据并补足缺失，保存 `episode-design.md`。B 直接承接已完成的具体人物行动、事件及逐场设计。

## B｜正式剧本创作

**输入：** 已完成并保存的 episode-design、有效上游、已有 Script（修订时）。  
**产物标准：** [单集正文规范](assets/episode-script-format.md)。  
**阶段案例：** 读取[夜灯铺单集案例](examples/night-lamp-episode.md) 的 B 部分，理解设计如何在实际可演正文中兑现。

| 步骤 | 前置依赖 | 必读方法 | 设计结果 |
| --- | --- | --- | --- |
| B1 正文写作 | A 阶段实际保存成果 | [正式剧本格式](assets/episode-script-format.md)、[写作补充原则](references/writing-principles.md) | 完整分场动作、对白及戏剧结果，保存 `script.md` |
| B2 剧本核验 | 已保存 Script、episode-design、有效上游 | [单集返修](references/revision-guidance.md)、[连续性](references/continuity-guidance.md) | 对实际正文检查人物策略、事件因果、场景攻防、对白表现、事实与承接，定位问题与影响 |
| B3 正文修订与确认 | B2 核验结果 | 复用 B2 方法，按根因读取对应 A 步骤专业方法 | 修正实际问题、同步受影响设计，复核并保存最终 Script；无缺口时直接确认原版本 |

B1–B3 分开执行：

- B1 回读已完成的 A，写出本集完整可演正文，实际保存 `script.md`（尚未定稿）。
- B2 在后续独立操作中回读已保存正文、单集设计及必要上游，逐场检查设计如何在动作、对白与后果中兑现。将实际发现的问题、原文位置、根因所在层和影响范围保存为临时诊断结果；未发现问题时记录所核对的关键情节与确认依据，不预写合格结论。
- B3 回读 B2 已保存结果；有问题时按根因进入相应设计或正文修订，同步受影响内容并保存，再独立回读修订后的正文和受影响依据复查。若仍有实质问题，继续定向修订直至成立；无实质缺口时直接确认 B1 原版本，不机械改写。

正文只写观众理解故事需要的可演动作、事件、分场及对白，不混入创作理论、自检记录、镜头参数或技术 Clip。用户明确的时长和体例属于创作约束，无明确要求时不预设时长。

**阶段完成：** 读取实际最终 Script，确认已采用戏剧设计在正文中落实，所有已确认剧情、对白与事实得到继承；保存最终 `script.md` 和受影响的 episode-design，C 从该版本提取续作状态。

## C｜续作状态

**输入：** B 阶段已核验的最终 Script、有效 Canon、前集 State 及必要前情。  
**产物标准：** [State 规范](assets/episode-state-guidance.md)。  
**阶段案例：** 读取[夜灯铺单集案例](examples/night-lamp-episode.md) 的 C 部分，区分实际发生、人物所知和预期计划。

| 步骤 | 前置依赖 | 必读方法 | 设计结果 |
| --- | --- | --- | --- |
| C1 状态提取 | 实际最终 Script 与有效前情 | [State 规范](assets/episode-state-guidance.md)、[连续性](references/continuity-guidance.md) | 已发生事实、人物认知或误信、关系及承重物件变化、未解事件，保存 `state.md` |
| C2 状态检查 | 已保存 State、最终 Script、Canon、前集 State | [连续性](references/continuity-guidance.md)，复用 State 规范 | 确认状态来源、事实层次、前后继承及未确定结果均准确；必要时修正 |

C1 回读 B 已确认的最终正文，独立提取并保存 State。C2 在后续独立操作中回读已保存 State，并与最终 Script、有效 Canon 和前集 State 对照，发现问题时修正并复查；无实质问题直接确认。不得在生成 State 的同一次操作中预写 C2 合格结论。

**阶段完成：** 保存与最终正文一致的 `state.md`，与 episode-design、Script 一并交主创验收。正文修订后同步影响到的设计及 State，不用状态文件替代正文。镜头与实际媒体交下游岗位设计和制作。
