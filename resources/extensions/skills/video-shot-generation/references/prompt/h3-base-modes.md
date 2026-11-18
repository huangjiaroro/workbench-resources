# H3 基础模式编写指南（本技能自包含适配）（T2VA / I2VA / FL2VA / L2VA）

本文供 `video-shot-generation` 内部 Prompt 编译步骤按需读取；保留 H3 官方指南的**字段名称、时间戳、引用标签和声源语法**。编写画面/声音执行内容用英文，剧本中的对白、歌词、可见文字忠实保留原语言；实际可用时长、素材类型以当次模型/插件能力为准。官方原始指南：`MiniMax-AI/MiniMax-H3` 的 `skills/h3-prompt-writing/references/base-en.txt`（需联网时可查阅）。本地镜头、对白、参考资产的完整约束见 [prompts.md](prompts.md)。

## 根据真实输入选择模式

- **T2VA**：文字生成完整连续视听时间线，无参考帧锁定。
- **I2VA**：首帧作为起始状态，从该状态向后自然推进；在 Prompt 最前面写 `For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.`
- **FL2VA**：首帧、末帧都已提供，必须描述从首帧到末帧的真实动作及摄影机路径。最前面写 `How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.` 其中 N 是实际结束时的镜头序号，S.SS 是实际目标片长（小数两位）。
- **L2VA**：只给末帧，须从合理的先前状态逐步收束到末帧。最前面写 `How the reference pictures align with the target video — <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the target video.` 不要把末帧错误地绑定到 Shot 1。

非 T2VA 模式在开头指令之后空一行，再写下面三个核心字段；首尾帧指令只在实际提供并支持相应素材的模式下使用。根据实际接口需要逐字维持这些字段名和顺序：

```text
integrated_multimodal_description: [Shot 1] ... [Shot 2] At 00:05.000, ...
overall_soundscape: ...
non_diegetic_music: N/A
```

- **integrated_multimodal_description**：从开始到结束，按播放顺序描述每个已审定 Shot 的实际视点、人物和场景、动作与反应、摄影机运动、台词及剧情内声音。Shot 1 无时间戳；换镜后用 `[Shot 2] At 00:SS.mmm, ...`，时间严格递增，最后一个 Shot 与目标结束点吻合。不要擅自添加导演没设计的切镜。
- **overall_soundscape**：涵盖整个片段的空间氛围、物理动作声、环境声与非语言人声，不伪造对白或另加配乐。
- **non_diegetic_music**：本组织视频阶段不请求独立非剧情配乐，字段存在时填 `N/A`；不支持该字段的真实接口不强行加入。

## 声源与引用

- 同一实际发声者固定用 `(S1)`、`(S2)`，按目标视频的真实发声次序编号；同一角色跨镜复用编号，不按每镜重排。
- 有对白时写 `<d>[Chinese] 原文台词。</d>`，或者相应语言标签，原文不可改写。已确认画外声源/旁白需明确 `off-screen voiceover` 和画内人物的口型状态；不凭空把画外音变成画内对话。
- 图片、视频、音频参考仅在本次请求实际提供且插件支持时引用；采用 `<Picture 1>`、`<Video 1>`、`<Audio 1>`，保持从定义到镜头内容一致。不能引用未提交的标签或臆造参考文件。
- 只有当前模型实测支持跨镜声音衔接时才能采用 `<scenetrans>` 等标签；跨独立生成 Clip 的声音连续性须另行验证，不能仅凭标签保证。
- FL2VA / L2VA 必须描述人、物、摄影机如何进入终点状态，不能只写“最终成为末帧”。

## 编译与提交检查

核对输入模式、真实参考媒体、首末帧绑定、所有 Shot 时间段、原对白与说话人、预期声音、结束状态、真实模型时长上限与插件入参。若导演要求的时长超过单次生成能力，制作人安排技术分段与素材取用，不修改导演镜头或对白。实际结果由 video-shot-generation 核对输出文件并抽帧；内容视听验收留给后期，Prompt 语法合格不等于真实文件已生成。
