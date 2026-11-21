---
name: video-shot-generation
description: 接收已审定导演 Scene→Shot 与动态时间轴及真实视觉资产，完成技术 Clip 安排、状态核验、Prompt/参考输入编译、真实生成、抽帧与 Production 交接。
metadata:
  version: 1.2.2
  display_name: AI 视频制作（生成与 Prompt 编译）
---

# AI 视频制作：从导演 Shot 到真实素材

本技能是**视频制作人的专业工作入口**。统合生产调度与 Prompt 编译流程；导演的 **Scene → Shot** 是正式叙事结构，**Clip 是技术生成任务及素材索引**，不得反过来改变导演的 Shot 数、切点、自然时长或剧本。

**输入**：锁定 Script、已采用 shot-plan（镜头顺序、动态时间轴、对白位置/说话人、动作、机位、自然时长），director-plan（空间基准与视觉原则）、performance-plan（完整表演过程与状态），以及正式视觉资产。按逐 P 规划表的 Shot ID 与衔接字段识别连续镜头，把同 Shot 的相邻 P 行按实际播放顺序组合，并将 P 局部时间换算为 Shot 局部时间；跨镜 P 只取各行覆盖范围，并行事件不重复计时。对白以 P4 对应片段定位并对照锁定 Script 核验；BGM 不属于视频生成的输入依赖。每轮只读取当前生成所需的内容及仍有效的记录。

**唯一正式输出**：组织 `video-production` 产物（以当前产物契约 `project-contract.yaml` 解析路径，通常 `episodes/EP{episode}/production/production.md`）。Prompt、绑定、任务回执、源视频、关键帧和状态都归同一 Production 记录；不产生第二份 Prompt 产物，也不回填导演文件。

## 一条可循环执行的生产流程

1. **决定本轮技术范围**：按[生产原则](references/production/production-principles.md)的分组方法与制作长度约束、真实工具上限，组合表演连续且模式与参考兼容的相邻 Shot，安排必要拆分、Clip ID、时长与依赖。不默认逐 Shot 生成；连续导演 Shot 可跨多个技术任务而不新增硬切。范围与实际来源按[制作索引规范](references/production/shot-execution.md)记录。
2. **必要时核验生成前状态**：以导演整体方案与表演/镜头的计划空间状态为依据，对实际连续状态存在不确定且影响本轮时，才按[关键帧与连续性](references/production/continuity.md)查看既有图片/结果；已有有效观察可复用。切换机位或跨场 本身不触发读图。
3. **编译本轮 Prompt 与模型输入**：根据技术范围选择真实模式；按[Prompt 编译规范](references/prompt/prompts.md)、[参考输入政策](references/prompt/reference-policy.md)绑定正式资产和必要真实状态。H3 优先读[模式入口](references/prompt/minimax-h3.md)，再选读[基础模式](references/prompt/h3-base-modes.md)或[全参考模式](references/prompt/h3-full-reference.md)，可查[编译范例](references/prompt/prompt-examples.md)。忠实将逐 P 时序组装为实际 Shot，再换算至 Clip 局部时间；依据 P4 对白片段及 Script 保留**全部对白及说话人**，按时序安排技术发声或后期声音，不得漏字、改写、重复或自创表演。技术声音模式不等于新增导演成果。
4. **提交并恢复真实生成**：读取当次插件的真实工具说明，校验时长、模型参数、媒体绑定，执行 H3、ComfyUI 或已明确指定的可用生成路线；保留任务 ID/回执。失败或结果未知先恢复同一任务，不猜测完成或盲目重复提交。
5. **核实输出与抽帧**：按[媒体操作](references/production/media-operations.md)确认视频存在，保存来源、真实时长与哈希；抽取必要关键帧并登记，**不强制生成后立即打开观看或收听**。必要的状态观察在下次生成前条件触发；完整声画验收属于后期与主创。
6. **更新 Production 并继续/交接**：按[制作索引规范](references/production/shot-execution.md)记录所有 Shot 的客观状态、Clip→Shot 对应、实际 Prompt、输入绑定、生成回执、关键帧和待办。未完成进入下一轮；真实素材与声画待办明确后，可按范围交后期。

## 职责边界与检查

- 视频生成不向各技术 Clip 请求独立非剧情 BGM；bgm-plan 中背景音乐意图交音乐制作人和后期。
- **技术 Clip 时长不限制导演 Shot 时长**。不可实现时可调整技术分段、输入与模型参数，但不得擅自增删导演硬切、人物动作或故事信息；真正需要调整镜头或表演设计 时反馈主创交原作者处理。
- `GENERATED` 只说明**真实文件已生成、未完成内容验收**；口型、对白、人物数量、方向、动态及声音完整性由后期/主创据真实媒体核对。无能力完成必要声音时标记待办或 `BLOCKED`，不能冒充成片。
- **专业参考按任务按需读**：生产过程读 `references/production/`，Prompt/模型技术读 `references/prompt/`；按当前模型与实际生成模式选择正文和范例，不要求一次加载所有 H3 指南。
