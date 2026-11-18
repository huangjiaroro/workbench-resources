# 典型切片提示词编译范例库 (prompt-examples.md)

本文件汇集 AI 视频制作人将**已经审定的导演 Shot Plan**转为模型输入时的**编译范例**，以 MiniMax H3 为演示。具体镜头、动作、节奏、发声关系都假定已由导演决定；制作人只示范语法与输入适配，不应在执行时照搬范例中的导演创作决策。遵循 [prompts.md](prompts.md)。

---

## 范例一：完整六章节可提交范例 · 一镜到底长镜头 (Single Continuous Take)

> [!NOTE]
> **完整可提交标准**：向底层 MiniMax H3 Ref2VA 模型提交时，Prompt 字符串必须完整包含 `subject_definitions`、`summary`、`retention_analysis`、`detailed_description`、`overall_soundscape`、`non_diegetic_music` 六个章节。
> 本例秒数仅示范模型时间戳格式，不作为当前导演语速规则或时长计算依据；实际制作须遵从导演已审定的时间安排。

```text
[subject_definitions]
<Subject 1> is the young convenience store clerk in <Picture 1>, with short dark hair, wearing a green work vest over a charcoal long-sleeve polo shirt.
<Subject 2> is the brightly lit modern convenience store interior in <Picture 2>, featuring neatly stocked shelves, beverage refrigerators, and a stainless steel checkout counter.
<Audio 1> is the vocal timbre reference for <Subject 1> (S1), containing a gentle, calm young adult male speaking voice.

[summary]
[reference generation + audio reference] A medium-close single continuous take of <Subject 1> working the night shift inside <Subject 2>. He wipes the counter, lifts his head to make friendly conversation using <Audio 1> voice timbre, and settles into calm eye contact with a warm, subtle smile.

[retention_analysis]
<Subject 1> (appears in [Shot 1]): fully_preserved - the clerk's green uniform vest, dark hair, facial features, and gentle expression from <Picture 1> are retained.
<Subject 2> (appears in [Shot 1]): fully_preserved - the convenience store checkout counter, illuminated shelves, and store interior from <Picture 2> are retained.
<Audio 1>: reference - voice timbre guides the dialogue delivery of <Subject 1> without copying signal noise.

[detailed_description]
[Shot 1] Live-action, cinematic. Single continuous take throughout the entire 9.5 seconds with no camera cuts. The camera slowly pushes in on <Subject 1> from <Picture 1> in a medium-close shot against the illuminated interior of <Picture 2>.
From 0.0 to 4.2 seconds, <Subject 1> wipes water stains off the stainless steel counter with a cloth in a relaxed, rhythmic motion. He raises his head slightly and speaks with a calm, gentle tone using <Audio 1> timbre: (S1) speaks: <d>[Chinese]开店太累，我就喜欢上夜班。</d>
From 4.2 to 7.8 seconds, his wiping hand naturally comes to rest upon the counter surface. <Subject 1> makes direct, warm eye contact forward with a faint relaxed smile, speaking: (S1) speaks: <d>[Chinese]安静，没人管，挺好。</d>
From 7.8 to 9.5 seconds, <Subject 1> maintains attentive, calm eye contact, giving a slow, natural half-nod as ambient breath settles the moment naturally through the final 1.7 seconds.

[overall_soundscape]
Soft rain tapping rhythmically against the glass windows, low electrical hum of convenience store refrigeration, subtle wet friction of the cloth wiping across the stainless steel counter.

[non_diegetic_music]
N/A
```

---

> [!TIP]
> **局部核心片段说明**：以下范例二至范例四重点展示多镜头正反打、动作快切与空镜画外音在 `detailed_description`、`overall_soundscape` 与 `non_diegetic_music` 中的时序与声画对齐写法。向底层 Ref2VA 提交时，需参照范例一补齐完整的 `subject_definitions`、`summary` 与 `retention_analysis` 章节。

---

## 范例二：双人对白正反打编译示范 (Multi-Shot Dialogue Cross-Cut)

对应分镜：在同一物理生成切片内，通过毫秒级递增时间戳实现双人正反打交锋，降低跨镜头身份、服饰与光影的色调漂移风险，同时落实听者闭嘴与声音延续。
这里的秒数仅为多镜头 Prompt 编译语法示例，不可代替导演的台词估时脚本和自然时长。

```text
[detailed_description]
[Shot 1] The camera frames <Subject 1> from <Picture 1> and <Subject 2> from <Picture 2> in a dynamic medium two-shot within the ruined stone hall of <Picture 3>, the flickering campfire casting amber light across their faces. From 0.0 to 2.5 seconds, <Subject 1> clutches the torn parchment firmly with a sinister sneer, while <Subject 2> stands motionless, fresh blood seeping from her left wrist.
[Shot 2] At 00:02.500, the shot cuts to a medium-close shot of <Subject 1> from <Picture 1>. From 2.5 to 5.7 seconds, <Subject 1> gestures aggressively toward the stone floor with a dark, furious snarl: (S1) speaks with a harsh, heavy voice: <d>[Chinese]想走？先把十万银币吐出来！</d> <Subject 2> is out of frame, not participating in lip sync.
[Shot 3] At 00:05.700, the shot cuts to an extreme close-up of <Subject 2> from <Picture 2>. From 5.7 to 8.8 seconds, her grey-purple eyes narrow, her jaw tenses, and she lifts her chin slightly. She speaks in the steady, restrained tone specified by the director: (S2) speaks: <d>[Chinese]我希拉，接受你的拒绝！</d> Her lips remain firmly closed after speaking, her stare unwavering and cold through the final 0.7 seconds.

[overall_soundscape]
Distant howling wind outside the stone hall, crackling of damp firewood, heavy metallic clinking of armor studs as Carter shifts weight.

[non_diegetic_music]
N/A
```

---

## 范例三：动作快切蒙太奇编译示范 (Multi-Shot Action Cuts)

对应分镜：生死绝境瞬间反弹，以高频分镜头切换制造强烈的视觉压迫感与受力传递。

```text
[detailed_description]
[Shot 1] The camera frames <Subject 1> from <Picture 1> in a dynamic low-angle medium shot. From 0.0 to 1.5 seconds, <Subject 1> rises sharply from her crouching posture and snatches the burning bronze torch <Picture 3> from the stone pillar, the orange flames roaring fiercely against the gale.
[Shot 2] At 00:01.500, the shot cuts to an extreme close-up of <Subject 2> from <Picture 2>. The flaming torch hurtles directly toward his face, fire reflection expanding rapidly in his shrinking pupils as pure shock and terror distort his features.
[Shot 3] At 00:02.800, the shot cuts to a medium-wide shot. The torch slams violently into <Subject 2>'s heavy fur collar, bursting into scattered embers and sudden flames. He shrieks in panic, tumbling sideways onto the wet stone floor to smother the fire.
[Shot 4] At 00:04.500, the shot cuts to a rapid low-angle tracking shot. <Subject 1> turns without hesitation and leaps onto the ruined stone balustrade of <Picture 4>, her platinum hair streaming wild in the blizzard, balancing steadfast against the vast abyss through the final 1.5 seconds.

[overall_soundscape]
Howling mountain blizzard, sudden loud whoosh of the torch sweeping through the air, muffled explosion of fire striking thick fabric, wet tumbling thud on cold slate stone.

[non_diegetic_music]
N/A
```

---

## 范例四：纯风景空镜承载画外音示范 (Scenic Shot with Off-Screen Voiceover)

对应分镜：画面无可见人物，呈现辽阔的环境空镜，台词由画外音从容叙述。
这里的时间段仅展示声画时序写法，实际时长由导演估时与表演规划确定。

```text
[detailed_description]
[Shot 1] Live-action, cinematic. A wide, static scenic shot of snow-covered jagged mountain peaks under a dark twilight sky. Dense fog drifts slowly through the pines in the valley below. No human figures are present in the frame.
From 0.0 to 5.4 seconds, a deep, weary male voiceover (S1) speaks in a slow, gravelly tone: <d>[Chinese]极北之地的风，从来不会同情弱者。</d>
From 5.4 to 7.5 seconds, the camera maintains a slow, solemn tilt upward toward the cold crescent moon breaking through heavy storm clouds, leaving a desolate visual aftermath.

[overall_soundscape]
Vast mountain wind whistling through rocky crevices, distant deep rumbling of ice groaning under winter frost.

[non_diegetic_music]
N/A
```
