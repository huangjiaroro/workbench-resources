# 提示词适配器规范 (prompts.md)

本文件是 AI 视频制作人将**已审定的导演 Shot Plan 与整体方案与表演设计**编译为目标视频模型请求的规范入口。导演创作判断以本次工单提供的已审定 `shot-plan` 产物及相关导演成果为准；本文件负责**语义保真、模型格式适配、实际素材绑定和编译检查**。模型专有字段及能力差异以准确版本的适配资料（如 [minimax-h3.md](minimax-h3.md)）为准，典型范例见 [prompt-examples.md](prompt-examples.md)。

---

## 一、提示词适配器的职责边界与要求

1. **权威输入**：主创审定的 `shot-plan`（镜头与内部动态时间）、`director-plan`（视觉与空间）、`performance-plan`（完整表演）和锁定 Script。正式素材 ID 以资产登记为准，前序真实关键帧补充剧情状态；BGM 不构成生成依赖。
2. **核心适配任务**：将导演确定的切点、镜内时间轴、景别运镜、动作、反应及原文对白忠实编译。将 Shot 局部时间换成 Clip 局部时间（按生产原则），保留每次实际变化和并行关系；不重设镜头、增写表演或重构节奏。
3. **工程执行要求**：
   * 按本技能生产流程确定的技术范围与续接方式编译；发现范围不适合当前模型时，反馈限制与调整建议，由制作人重新选择；不得擅自改变导演 Shot 的叙事结构、切镜点和表演；
   * 忠实保留剧本对白原文与标点停顿；
   * 忠实遵循导演的表演节拍流转与视线焦点设计；
   * **严格执行音频策略**：视频生成阶段默认不请求独立非剧情背景音乐；
   * **技术变更边界**：模型参数、辅助图、生成次数、技术拆分及无内容变化的声音衔接由制作人决定；若需要改变成片机位、Shot 数量/顺序/切点或导演规划中的表演与时长，交主创协调导演；涉及剧情、关键动作或对白内容变更时，交主创协调编剧修订并重新采用，导演与制作人不得自行删改、精简或改写；
   * **不可执行时如实反馈**：模型无法稳定实现所规划的多镜、声音持续或参考输入时，记录能力缺口和候选解决路径，由导演决定是否调整镜头；不能用“已编译”冒充“已实现”。

---

## 二、文学修辞的编译检查与导演边界

**文学表达的视听转化属于分镜导演，不属于 Prompt 编译器。** 提示词适配器检查的是导演工程是否已把意图落实为可观察的内容，以及最终执行指令是否保留了这些内容。

1. **保留可执行信息**：逐条映射导演给出的主体、动作、可见反应、机位、切换点、持续时间及必要环境声音；按 Shot 的原文定位，从锁定 Script 读取对白说话人和原文，在技术层按镜内时间与可见性安排。对语义相同的英文措辞可以润色，不得创作新增的关键表演。
2. **抽象句不能替代执行指令**：在 Prompt 的非对白执行部分，不能用“目光如刀”“怒火像火山爆发”“icy resolution”“the world holds its breath”等文学修辞**代替**镜头中真正要呈现的动作、表情或声音。可以保留少量氛围、风格和情绪词辅助模型理解，但它们应与具体可观察的描述配合。
3. **原文台词完全例外**：`<d>` 等对白标签里的原文、标点、比喻与修辞应忠实保留，不得因“去比喻”而改写人物台词；可见文字、歌词等真实内容按导演与上游契约处理。
4. **不擅自补拍导演未定内容**：当导演只写“他眼神像刀”而未定义具体拍摄方式时，先标记为视听描述缺口，请导演补足；不能在 Prompt 中自行加入“拔剑、抓住手腕、转身走开”等新的剧情动作。
5. **核对权威版本**：每个生成请求在 `video-production` 产物中关联导演 Shot ID 和相应自然时间范围；技术拆分不改变成片设计，确实无法实现时反馈导演。

**对照示例（只示范忠实转译，不新增镜头）：**

| 导演已经写明的可执行镜头 | 适合的 Prompt 执行表达 | 不适合的写法 |
| :--- | :--- | :--- |
| 男人抬眼盯住女人，下颌绷紧；女人迅速移开视线 | `He raises his gaze, fixes it on her, and tightens his jaw. She briefly meets his eyes and looks away.` | `His gaze cuts through her like a knife.` |
| 男人猛地拍桌，呼吸急促，吐字重音加剧 | `He slams his palm on the table, breathes faster, and delivers the words with sharp emphasis.` | `His rage erupts like a volcano.` |
| 众人说话声骤停，转头看向门口，风声持续 | `The room falls silent; several people turn toward the doorway. Only the wind remains audible.` | `The entire world stops breathing.` |

---

## 三、切片视听形态编译规则 (Timeline & Multi-Shot Compilation)

提示词应将**导演已经决定**的表演节拍、镜头切点与声音关系，映射为目标模型能识别的具体时序、动作和声学指令；不因此重新决定节奏或表演：

### 1. 单镜头戏剧节拍编译映射 (Single-Take Timeline Compilation)
当本次生成对应连续 Shot 或其中一段时，提示词忠实表达导演的连续运镜要求：
* **运镜与连贯声明**：开场明确机位与连贯运镜，避免模型擅自分镜（如 `[Shot 1] Live-action, cinematic. Single continuous take throughout the entire Xs with no camera cuts. The camera slowly pushes in on <Subject 1> from <Picture 1> in a medium-close shot`）；
* **节拍时序转译**：
  * **镜头切点按导演执行**：导演要求动作完成即切就按该切点编译；导演要求合理的沉默反应或情绪余韵，也应如实保留。仅不得自行增加无意义的静止画面来填满生成秒数；
  * **喜剧反应型**：按导演给定的刺激、反应和包袱落点组织执行描述；不替导演规定必须何时切出；
  * **突发与连续动作型**：按照导演明确的发力、受力、空间方向及动作衔接进行编译，不擅自创造新动作填补时长；
* 全程依靠机位语言控制连贯镜头，不外挂任何非官方标签。完整示范见 [prompt-examples.md](prompt-examples.md)。

### 2. 多镜头切片编译规则 (Multi-Shot Cuts Compilation)
当一次生成包含多个 Shot 时，制作人按目标模型支持的分镜结构编译。若同一 Clip 分多次生成，各请求只编译其实际负责的 Shot/时间范围。以下是 **H3 适配示意**，不是通用模型强制格式；准确语法须以 [minimax-h3.md](minimax-h3.md) 及实际可读的模型指南为准：
* **时间戳绝对递增语法**：
  * 首个镜头不标注时间戳：`[Shot 1] The camera frames <Subject 1>...`；
  * 后续镜头必须以精确递增时间戳起首：`[Shot 2] At 00:02.500, the shot cuts to...`，严禁时间倒流或重叠；
* **切机位动词标准库**：
  * 普通硬切统一采用：`the shot cuts to...`、`the camera cuts to...`、`the shot switches to...`、`the shot transitions to...`；
* **同号强绑定延续一致性**：
  * 每个分镜头内必须显式指认主体引用，如 `<Subject 1>`、`<Subject 2>`，让模型注意力在镜头切换后依然牢牢锁定同一角色的五官面容与服装道具；
* **动作动量与受力真实传递**：
  * 忠实表达导演给定的发力、受力反馈和方向关系；不擅自添加“利落定势”或延长收尾。若模型输出改变了受力方向，应返修生成或反馈导演，而不是悄悄更改规划。

---

## 四、对白声学、语气描写与画外音编译规范 (Dialogue Acoustics & Tone)

声学转译应以导演给出的发声者、声线、情绪节拍和声音位置为依据；必要时补充适当的语速、气息、重音等模型可执行描述。抽象情绪词可用于辅助理解，但不能替代导演指定的声学特征。明确区分**画内对白、画外发声（Off-screen Dialogue）与非剧情旁白（Narration / Voice-over）**，不能仅凭画面是否出现人物而改变对白性质。

### 1. 声源位置、可见口型与人物唯一性

按 Shot 定位从锁定 Script 取得原文对白，并结合 Shot Plan 的人物可见性/空间方向与实际技术生成范围区分，不以“有没有正面口型”判断是否属于旁白：

- **画内现场对白（口型可见）**：发声者出现在画面且嘴部可见，按导演要求绑定人物、台词和自然口型；正常正反打可在相应 Shot 切换可见的发声者。
- **画内现场对白（全程背影或口型不可见）**：人物仍在场景、仍是唯一声源，画面只呈现其背部、遮挡或其他既定视角；不得为了发声生成该角色的正面副本、强行转身或增添镜头。**没有可见口型不等于没有对白，也不等于旁白。**
- **同场画外对白（Off-screen Dialogue）**：发声者在场景中但不在当前画幅内，声音可与可见人物的反应同在；不应把声音绑定给听者或凭空生成一个说话人。
- **非剧情旁白（Narration / Voice-over）**：按导演已确定的叙述性声音处理，不自动套用于前两种现场对白。

对于**当前生成范围内全程背影、口型不可见**的发声者，若直接给同步视频模型提交该人物台词会造成角色复制、错误转身或幽灵口型，优先采用**声画分离**：生成视频时不向该模型提交该句对白，人物仍按导演设计完成表演，**原定台词不删除、不改写**。这条不适用于后续会露出口型的正常正反打，也不强制所有画外现场对白一律分离；每种方案以当前模型实际表现和可用工具判断。

**在决定省去视频请求中的对白之前，先确认声画闭环能否完成**：有可用且获准的原声素材或语音生成能力、可用的对白时序定位、对轨和混音工具。具备条件时，在 `video-production` 产物 留下发声者、原文、声线依据、预定时段、音频来源或待生成事项，以及交后期的接入要求；最终对白由后期按准确时序合入并验收。若没有核实这些能力，可以制作**待补声音的画面候选**，但必须将该对白和相应 Clip 标注为待处理或 `BLOCKED`，不得把缺失关键对白的结果宣称完整可采用或已交付成片；反馈主创协调可用工具或由导演决定其他可实现方案。若尝试直接声画生成作为备选，应在 Production 标记 GENERATED（未验收），由后期对实际视频验证人物数量、朝向、声源及口型，不得靠提示词声明推定成功。

模型支持发声者编号或音色输入时，逐一核对角色 ID、音色素材与音频槽位；**不能从画面人物顺序推断声源**。示意性写法仅在模型接口支持时使用，如 `Off-screen (S1) continues speaking: <d>[Chinese]原文台词</d>`；画面中可见的非发声者不承担该句口型。具体语法按模型适配资料，不将示例强制用于所有工作流。

### 2. 七类常见情绪具象声学词库
声学描述遵循公式：
$$\text{有效语气描述} = \text{声线物理特征} + \text{语速节奏} + \text{呼吸与气息} + \text{具象情绪微线索}$$

不要**仅**使用空洞情绪词（如“愤怒地吼道”“悲伤地哭诉”）来替代声学信息。下表是按导演意图可选择的辅助声学措辞，不要求每句话机械套用，也不允许擅自改变导演指定的声音表现：

| 情绪类型 | 英文声学描述模板 | 物理声学特征与听觉线索 |
| :--- | :--- | :--- |
| **1. 委屈 / 压抑** | `in a fragile, slightly trembling voice with a subtle nasal tone and audible caught breath` | 声线发紧微颤、轻带鼻音、尾音发虚、吸气声明显 |
| **2. 愤怒 / 暴烈** | `in a harsh, gravelly voice with heavy, aggressive emphasis and rapid, tense cadence` | 声线粗粝低沉、重音前置、语速骤快、咬字发力 |
| **3. 冷淡 / 决绝** | `in a flat, detached, and steady tone with crisp, resolute enunciation and no trailing inflection` | 语调平直无起伏、吐字清晰决断、音量中等偏轻、无多余拖音 |
| **4. 温柔 / 抚慰** | `in a warm, soft-spoken voice with gentle breathiness and a relaxed, melodious cadence` | 气声偏重、语速舒缓轻柔、尾音自然下落 |
| **5. 紧张 / 慌乱** | `in a hurried, breathless tone with sharp, uneven pauses and a tense, rising inflection` | 语速断续、频繁短促换气、句间停顿不自然、尾音上扬 |
| **6. 嘲讽 / 讥笑** | `in a mocking, condescending voice with a slight sneering nasal exhale and deliberately drawn-out vowels` | 尾音轻蔑上挑、带轻微鼻息冷笑、字句间故意拉长重音 |
| **7. 虚弱 / 垂危** | `in a faint, raspy whisper with shallow, strained breathing and intermittent pauses between syllables` | 气若游丝、中途换气断裂、声音沙哑无力 |

### 3. 音频铁律：严禁在切片中独立生成背景配乐 (No Independent BGM in Clips)
* **规则要求**：视频生成阶段不得请求独立的非剧情背景配乐。对于要求完整音乐章节的模型格式（如 H3 Ref2VA），保留相应章节并填写 `N/A`；对于没有音乐章节的模型格式，不添加该字段；
* **合规音频范围**：切片提示词中的音频描述仅允许包含：
  1. **现场角色对白**（严格按 `<d>` 规范）；
  2. **现场环境声 (Ambience)**（如 `howling blizzard wind, crackling torch embers, distant wolf growls`）；
  3. **核心动作音效 (Foley)**（如 `metallic slice of dagger against flesh, staff striking the stone floor`）；
* 导演可说明整集配乐意图；实际配乐由音乐制作人按需制作，后期在授权和工具支持时剪入及混音；禁止独立 BGM 有助于减少音乐重置，但不能保证环境声、口型和总音轨接缝自然。剧情内音乐（角色弹奏、场内音响等）按导演明确要求单独处理，不自动视为非剧情配乐。

### 4. 标签隔离与原文标点完整性 (Tag Boundary & Punctuation)
1. **对白标签隔离**：
   * 在使用 `<d>` 的模型模式中，声线、表演、运镜、声音方位等执行指令写在台词标签外，标签内只保存实际要说出的原文；
   * `<d>` 标签内部保留该段实际发声的原文、标点和语种标记（若模型要求），不夹带执行动作；不同模型是否使用 `<d>` 以对应适配资料为准；
2. **标点与停顿保留**：
   * 台词内的逗号、句号、感叹号、省略号必须完整保留，标点可能帮助模型理解自然停顿；不承诺某一模型必然准确还原语调；
3. **镜头切点对白过渡标记 (`<scenetrans>`，仅当模型需要且确实支持时)**：
   当锁定原文对白在技术生成中确实跨越 **不同 Shot 的切点**时，制作人先按已审定 D 时长、B 台词预算安排，只有在当前模型接口明确支持并有实测依据的情况下，才使用 `<scenetrans>` 等特定过渡写法。若出现音频截断或重复，先检查原对白是否被错误拆分和时间容量是否足够；需要改变台词承载方式或镜头划分时返回分镜导演调整。不得靠重说后半句制造漏词或重复，也不得假定该标签能够实现跨独立 Clip 的音频连续：
   ```text
   [Shot 1] 温柔女声 (S1) says: <d>[Chinese] 当我们停下脚步，<scenetrans>去感受身边微小的美好。</d>
   ```

---

## 五、多模态参考绑定与请求映射验证 (request_bindings)

在提交模型生成前，制作人应在 `video-production` 产物 的对应生成尝试中完成**实际输入文件、模型插槽与发声者 ID 的映射检查**。`referenceImages` 的素材选择按[参考输入约定](reference-policy.md)执行，此处核对实际文件、模型插槽与声源标签的映射。下面仅为数据结构示例，不表示 `(S1)` 必然与 `<Subject 1>` 同号；模型是否允许这种编号及对应数组索引，按实际接口约定核验：

```yaml
request_bindings:
  visual_subjects:
    - slot: 1               # <Subject 1> 是当前请求内的编号，角色长期 ID 不变
      picture_slot: 1
      character_id: char-sienna
      asset_path: assets/characters/sienna_dress.png
    - slot: 2               # <Subject 2> = 卡特
      picture_slot: 2
      character_id: char-carter
      asset_path: assets/characters/carter_coat.png
  audio_speakers:
    - speaker_id: S1        # 本例 (S1) = 卡特，不等于 <Subject 1> 希拉
      character_id: char-carter
      audio_slot: 1
      voice_asset_id: voice-carter
      voice_path: assets/voices/carter_timbre.wav
  auxiliary_reference:
    - picture_slot: 3       # 仅示例：当前 Shot 需要一张可独立提供场景信息的空场景图
      asset_path: assets/scenes/empty_room.png
      usage: "环境参考：房间结构及光线；图内没有人物"
# 图片选择遵循 reference-policy.md；此例仅展示输入绑定结构。
```

---

## 六、常见音频生成错误排查与补救策略

| 常见故障现象 | 根因分析 | 针对性补救策略 |
| :--- | :--- | :--- |
| **1. 幽灵口型 (Ghost Lip Sync)** | 听者画面被错误分配口型 | 明确画内谁是非发声者及其闭嘴状态；检查发声者 ID、声音引用和具体镜头中的可见主体，不要错误禁止真正发声者开口。 |
| **2. 串音 / 音色错乱 (Voice Bleed)** | 说话人声音与人物不匹配 | 检查 `(S1)`, `(S2)` 映射与 `request_bindings` 中 `<Audio N>` 顺序是否严格一致。 |
| **3. 吞字 / 语速极快 (Rushed Speech)** | 时长容量不足或模型发声失稳 | 根据实际结果核对导演台词估算与生成时长；纯参数问题可重试，需要改变导演规划时长或对白归属时请导演修订；仅拆分技术生成请求可自行处理。不得擅自缩写原文台词。 |
| **4. 底噪杂音 / 音乐重叠 (Audio Noise)** | 误在切片 Prompt 中编写了独立配乐 | 检查 `non_diegetic_music` 是否填写为 `N/A`，清除任何写在环境声里的配乐形容词。 |
| **5. 跨镜台词截断 (Abrupt Cutoff)** | 切点未保持连续发声，或时间容量不足 | 先检查具体模型是否支持所用过渡写法；需要改变导演 Shot、对白或声画设计时反馈导演；纯执行拼接和技术音频衔接由制作及后期按能力处理，不自行重述或改写原文。 |
| **6. 背影发声导致角色复制** | 模型错误地将不可见口型的声音解释为必须新增一个正面发声者 | 这是生成风险；交后期实际视听核对角色数量、朝向、声源与切镜；按本节的声画分离及工具闭环条件处理，不通过增加人物或擅改机位解决。 |

---

## 七、生成请求与结果就近维护

1. 完整 Prompt、`request_bindings`、参数、回执及逐次生成/抽帧在 `video-production` 产物 按导演 Shot ID、制作素材 Clip 和生成尝试维护；
2. 在同一 `video-production` 产物顶部采用索引登记最终采用视频或有序片段、真实关键帧、抽帧索引和真实生成状态；**不回填导演成果**；
3. 实际生成中若出现动作漂移、口型异常、错误画外发声或重复人物，先排查**实际输入参考图携带的旧人物、姿势、构图及其用途**，再排查提示词映射、生成范围及模型参数；仅技术层面且不改变导演工程的修正由制作人重试，涉及镜头、演出、对白或声画关系变化的返回分镜导演处理。独立补声未完成时不可把画面候选当成完整声画成果。
