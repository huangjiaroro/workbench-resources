# Production：Scene / Shot ↔ 技术 Clip 完成范围与来源索引

唯一正式制作索引为当前契约的 `video-production`（production.json）。`clips` 数组按当前实际采用或拟交接顺序排列；Clip ID 是稳定身份而非排序。`shots` 包含本轮全部导演 Shot（未生成也列出），按 Scene → Shot 顺序；一个 Clip 可映射连续多个 Shot，一个 Shot 也可对应多个技术 Clip。导演成果只读；从逐 P 表和 P4 确认全部对白、镜头时间及覆盖关系，发现具体疑点才回查对应 Script 原文。每个 Clip 的 E 完成时更新真实索引，供下一轮 B 按需定位帧。

## 当前成果与覆盖索引

各 Clip 在 clip-prompt 所在目录保存实际视频（如 video.mp4）、完整实际 prompt.md（含必要参考绑定与模型参数）、必要关键帧及来源记录。路径均相对 artifacts。内部回执和尝试自由管理；需保留的备选及旧结果放入该对象 archive/，不要求版本索引。待确认候选不覆盖既有正式结果。

JSON 索引示例（值为示意，不代表真实媒体）：

```json
{
  "clips": [
    {"id":"C001","name":"艾里克进入法庭","scene":"SC01","video":"episodes/EP01/production/clips/C001/video.mp4","prompt":"episodes/EP01/production/clips/C001/prompt.md","status":"GENERATED","sha256":"实际哈希","duration":5,"frames":[{"path":"episodes/EP01/production/clips/C001/frames/t2.png","time":2}]}
  ],
  "shots": [
    {"scene":"SC01","shot":"S001","shotPlanRef":"采用的 Shot Plan 版本或哈希","segments":[{"clipId":"C001","shotRange":[0,2.5],"clipRange":[0,2.5]}],"status":"GENERATED"},
    {"scene":"SC01","shot":"S002","shotPlanRef":"采用的 Shot Plan 版本或哈希","segments":[{"clipId":"C001","shotRange":[0,2.5],"clipRange":[2.5,5]}],"status":"GENERATED"},
    {"scene":"SC01","shot":"S003","segments":[],"status":"PENDING"}
  ],
  "references":[]
}
```

clipRange 和 shotRange 单位为秒；clips 每项 frames 列出当前视频的关键帧实际路径与源内时间，可按需补充用途（如位置转换、伤损、道具）及源哈希便于定位。必要声音待办、真实观察、来源引用和辅助图用途随相关条目保存。抽帧记录不是观察结论；B 读图时仅补充当前需要的事实。参考图按 reference-prompt 所在目录保存并在 references 中引用。A/B/C 内部工作稿不成为作品产物，也无需另建帧索引。

以下表格仅说明覆盖关系，不另建 Markdown 索引。

| Scene | Shot ID | 当前导演 Shot 版本 / 哈希 | Clip ID / 实际生成范围（Shot 局部） | 实际视频路径 / 哈希 / 时间 | 关键帧索引（路径、源内时间） | 生成状态 / 后期待办 |
| --- | --- | --- | --- | --- | --- | --- |
| SC01 | S001 | Shot Plan 版本或 SHA256 | C001：S001 局部 0–2.5s | C001 当前视频 / SHA256 / 源内 0–2.5s | 对应真实关键帧 / 00:02 | GENERATED；台词是否完整待后期 |
| SC01 | S002 | 同上 | C001：S002 局部 0–2.5s | 同一视频，源内 2.5–5s | 对应真实关键帧 / 00:04 | GENERATED |
| SC01 | S003 | 同上 | — | — | — | PENDING |

上述均为**字段格式示例，不代表真实媒体存在**。一次 Clip 多 Shot 必须在相应 Shot 行写同一 Clip，带可定位的源内范围；不能用一个已生成 Clip 代表尚未完成的其他 Shot。一个 Shot 分为多个 Clip 时，逐一登记其 Shot 源内区间、对应 Clip 区间和连续性要求，不增加硬切。

状态用 `PENDING`（未生成）、`RUNNING`、`GENERATED`（真实文件已存在，内容未验收）、`FAILED`、`BLOCKED` 等客观值。按每个获准 Shot 的当前导演版本及自然时序核对实际 `segments`：源 Clip、实际媒体时长及 `clipRange` 须真实可用，`shotRange` 的区间并集须覆盖该 Shot 的全部获准局部时间；有效的既定重叠只计一次，不以重复媒体、预计时长或未生成区间填补缺口。整体覆盖以各 Shot 的实际有效区间为依据，不以生成文件数量或源视频总长度替代。**不得仅根据生成成功或抽帧成功标记视频/音频 PASS、导演意图已实现或整集已完成。** 视觉/声音待办留给后期按真实素材检查。

## 技术生成尝试（员工内部自由管理）

以下为需要追溯时可使用的记录内容，不强制每次填表或写入正式索引：

```markdown
### Clip C001 / 尝试 1（Scene SC01）
- 覆盖导演 Shot：S001 + S002；对应已审定 Shot Plan 版本/哈希：...
- 分组依据：连续相邻 Shot 的实际表演范围；需拆分时记录组织／工具时长上限或其他实际限制，以及自然承接位置
- 模型 / 模式 / 技术生成秒数：按真实插件请求与回执
- 实际 Prompt：...
- 输入绑定：实际资产/图片/视频/音频、来源版本、用途、模式与对应标签
- 任务 ID、回执、失败/重试：...
- 输出媒体：真实路径、实际时长、哈希；若无输出明确 FAILED/BLOCKED
- 抽帧：源视频时间点、图片路径、哈希；观察记录：实际查阅状态、观察内容及来源版本
- 状态：GENERATED（未作逐段内容验收）；声音、裁剪、组装等后期待办：...
```

导演镜头结构、机位或切点需要变更时交主创协调导演；剧情、关键动作和对白内容变更由主创协调编剧修订并重新采用，导演与制作人不自行删改或精简。已有 Clip 更换时同步替换媒体、Prompt 与帧并更新索引，按[连续性状态版本规则](continuity.md#状态版本)核对真正受影响范围；补充独立过渡视频时新建 Clip，将其按实际位置插入 clips 数组，无需重编号或擅改导演硬切。后期只基于真实生成文件和实际采用范围组织成片。
