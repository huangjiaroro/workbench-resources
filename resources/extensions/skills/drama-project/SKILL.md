---
name: drama-project
description: 创作或修订短剧项目目标、整体故事蓝图、稳定事实设定与特定剧情单元时使用。
metadata:
  version: 1.1.1
  display_name: 故事大纲创作
---

# 故事大纲创作（Drama Project）

负责整部故事的创作设计与正式大纲。按当前产物契约（`project-contract.yaml`）定位 brief、project-design、blueprint、canon 及必要 story-unit。设计稿向用户与相关员工共享，随正式成果交接。

## 执行规则

首次整体开发按 **A → B** 执行；已有有效成果时从受影响阶段或步骤进入。

1. 开始当前阶段时，读取该阶段输入、产物模板及指定案例。先核对用户目标、已有采用决定和当前有效事实；不提前集中读取后续阶段或步骤的方法资料。
2. **每一步是独立的执行单元：实际读取表中列明的必读方法正文与已保存的依赖结果，完成当前设计，通过独立文件写入或更新操作保存，再进入下一步。** 准确、仍适用且本轮上下文已读的方法可复用；熟悉理论名称或已有剧情摘要不等于完成方法读取或设计。
3. 专题按实际设计问题触发，进入依赖它的设计前读取。局部返修可复用已成立的设计章节（明确对应位置、适用范围和有效前提），只更新受影响的依赖。不要求全库通读，不另交逐步文件或阅读日志；必要的检查依据记录于临时工作稿，置于正式产物目录之外。
4. 检查步骤在待检查成果保存后独立回读、核对、修正和复查；不在一次生成中同时完成相依设计与其核验。阶段完成后下一阶段实际读取已保存的成果。首次整体开发，未完成 A 不进入 B，未完成 B 不进入单集技能。内部关卡是编剧自检，不增加独立审批。

区分用户明确要求、已采用的专业决定、研究候选与未定提议。研究素材可取舍，缺少研究材料不阻塞创作；事实需要核验时通过主创定向委派。未锁定的剧情由编剧自主设计；改变用户已确认的重要决定时交主创协调。不要把候选或专业补全改称用户要求。

## A｜整体故事设计

**输入：** 当前工单、用户创作目标与已确认决定、有效 Brief/Canon/Blueprint/Story Unit（如有）。首次需要建立 Brief 时按[内容边界](assets/brief-canon-unit-guide.md)保存，再以其为目标依据。  
**产物模板：** [project-design](assets/project-design-guidance.md)。  
**阶段案例：** 首次整体开发必读[夜灯铺整体设计示例](examples/night-lamp-project.md) 的 A 部分，理解成果如何逐步形成；进入 B 时再读其 B 部分。案例只示范设计方法与产物，不提供本项目的预设情节。

| 步骤 | 前置依赖 | 必读方法 | 设计结果 |
| --- | --- | --- | --- |
| A1 故事核心 | Brief、用户要求和稳定事实 | [故事结构方法](references/story-structure/craft.md) | 核心前提、主角欲望、激励事件、核心矛盾及行动代价 |
| A2 人物与长期冲突 | A1 | [人物与长期冲突方法](references/character-arc/craft.md) | 承重人物的目标、动机、手段与制约、对抗关系、压力下的选择及弧线方向 |
| A3 整体故事结构 | A1/A2 | [故事结构方法](references/story-structure/craft.md)，复用 A2 方法 | 关键行动、因果、转折、高潮与结局，人物关键选择与弧线兑现 |
| A4 系列引擎 | A1–A3 | [系列引擎方法](references/series-engine/craft.md) | 持续事件生成机制、人物网络、冲突变奏、升级及闭合条件 |
| A5 整季与分集结构 | A1–A4 | [整季与分集结构方法](references/season-structure/craft.md) | 季线或阶段目标、主副线、单元与分集因果、揭示与兑现，足以支撑当前单集 |
| A6 整体设计检查 | A1–A5、实际保存的设计稿、Brief/Canon | [项目维护](references/project-maintenance.md) | 按模板判据核对主因果、人物选择、引擎与分集、稳定事实及锁定决定，修复设计缺口 |

A1–A5 分别完成与本轮整体范围相符的设计，在同一份 `project-design.md` 中依次写入对应章节；每一步实际保存并结束当前写入操作后，下一步回读相关章节再继续，不一次性写出五章或在蓝图完成后倒补设计。A6 在后续独立操作中回读完整设计稿及有效依据，定位具体缺口，返回相应设计步骤修正并同步受影响章节，再回读复查；无实质缺口时确认原设计。完成 A6 前设计稿尚未定稿。

专项按实际问题触发，进入依赖它的设计前必读：

- A1/A3：结构体系对比读[结构体系对照](references/story-structure/structure-frameworks.md)；复杂悬疑、案件、游戏规则读[故事机制与价值](references/story-structure/story-mechanisms.md)；采用 Truby 时读[有机结构](references/story-structure/truby-method.md)及[案例](references/story-structure/examples/truby-cases.md)；转折、高潮或兑现问题读[结构案例](references/story-structure/examples/structure-cases.md)。术语核对读[术语锚定表](references/story-structure/craft-terms.md)。
- A2/A3：复杂动机读[人物模型与心理学](references/character-arc/character-models-and-psychology.md)；冲突过渡、对手与弧线读[人物冲突案例](references/character-arc/examples/character-conflict-cases.md)；需要结构化分析时用[埃格里分析模板](references/character-arc/templates/egri-play-analysis.md)。
- A4：系列类型、故事模式与人物网读[系列引擎框架](references/series-engine/series-engine-frameworks.md)；变奏与失压读[引擎案例](references/series-engine/examples/series-engine-cases.md)、[持续冲突案例](references/series-engine/examples/continuing-conflict-cases.md)及[系列类型与人物网络案例](references/series-engine/examples/series-type-and-character-network-cases.md)。
- A5：信息释放、多线编织、pilot 与季形读[整季案例册](references/season-structure/examples/episode-season-casebook.md)；特定剧集体例或行业参考读[结构参考表](references/season-structure/episode-season-reference-tables.md)。传统页数、幕数和节拍配额不作为短剧硬标准；喜剧体例按需参考 drama-writing 的喜剧方法。

A1–A3 可因人物选择与结构矛盾定向回退；A4/A5 暴露长线或分集问题时回到对应设计。单一作品无系列机制时 A4 仅注明不适用，A5 按作品实际结构推进；连续作品应用完整系列及分集方法。不要求提前写完全部单集。需要探索不同创意方向时可先调用 `story-ideation`，方向稳定时直接设计。

**阶段完成：** A6 实际读取并核对已保存的 A1–A5 内容，按判据修正后保存 `project-design.md`。不得以标题、泛化梗概或未来承诺代替具体设计。B 承接此次采用的实际设计。

## B｜正式故事成果

**输入：** 已完成并保存的 project-design、有效 Brief、已有 Canon 与其他采用成果。  
**产物标准：** [Blueprint](assets/blueprint-criteria.md)、[Brief/Canon/Story Unit](assets/brief-canon-unit-guide.md)。  
**阶段案例：** 读取[夜灯铺整体设计示例](examples/night-lamp-project.md) 的 B 部分，理解正式成果与设计稿的对应关系。

| 步骤 | 前置依赖 | 必读方法 | 设计结果 |
| --- | --- | --- | --- |
| B1 整理正式故事蓝图 | A 阶段实际保存成果 | [Blueprint 标准](assets/blueprint-criteria.md)、[项目维护](references/project-maintenance.md) | 从采用设计整理 `blueprint.md`，明确主线、人物、转折、系列与分集依据 |
| B2 整理稳定事实 | A、已保存 Blueprint、既有 Canon | [Brief/Canon/Story Unit 边界](assets/brief-canon-unit-guide.md)、[项目维护](references/project-maintenance.md) | 保存或同步 `canon.md`，区分稳定事实、来源、用户要求与未来计划 |
| B3 承重单元细化（按需） | B1/B2、A5 及实际单元缺口 | [故事结构方法](references/story-structure/craft.md)、[Brief/Canon/Story Unit 边界](assets/brief-canon-unit-guide.md) | 必要时保存 Story Unit，明确单元因果、真相、线索、转折及长线衔接 |
| B4 正式成果核验 | 已保存的 B1–B3、A、Brief | [项目维护](references/project-maintenance.md)、复用上述标准 | 核对正式成果与采用设计、事实来源和下游依赖；修正受影响文件 |

B1、B2、适用的 B3 分别读取前置成果，独立形成并保存相应正式文件的工作版本。B1 从实际 A 整理蓝图；B2 回读 Blueprint 与 A，继承已有 Canon 并整理稳定事实；B3 按需读取上述成果，完成承重单元细化。B4 在这些文件保存后独立回读，与实际 A、Brief 对照核验；发现问题返回相应步骤修正，重新读取受影响文件并复查关联内容。无实质缺口时直接确认，不为完成流程而重写。

B3 若暴露整体结构或稳定事实缺口，回 A 或 B1/B2 修正后同步。无需为所有项目制作 Story Unit；Brief、Canon 和 Story Unit 不规定僵硬体例。

**阶段完成：** B4 核对实际文件后，保存本轮需要的 Blueprint、Canon 及必要 Story Unit，连同 project-design 按契约交付。未解决的承重问题明确影响范围；只在其依据充分时进入单集。已采用故事以有效 Blueprint、Canon 和 Script 为准，设计稿保存创作意图与关键取舍，不另造冲突的事实版本。

