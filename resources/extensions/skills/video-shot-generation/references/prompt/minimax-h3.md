# H3模式、接口与执行边界

输入是本次技术生成片段对应的导演 Shot 范围、完整实际 Prompt、真实素材、时长、依赖及本轮连接。画面、表演、参考和声音的写法统一按[prompts.md](prompts.md)，本页维护H3接入差异。

## 模式与实际格式

按当前真实输入模式读取 [h3-base-modes.md](h3-base-modes.md)（T2VA、I2VA、FL2VA、L2VA）或 [h3-full-reference.md](h3-full-reference.md)（Ref2VA）；Ref2VA 涉及对白、声源、切镜时也参考基础指南。ComfyUI 的多参考模式仅在实际工作流支持时按 Ref2VA 规则编译；首尾帧等其他模式使用对应完整指南与当前工作流的输入契约，不能只套某一模式的提示词结构。MiniMax CLI 的可用模式按实际插件预检判断。

Ref2VA完整提交subject_definitions、summary、retention_analysis、detailed_description、overall_soundscape、non_diegetic_music六章节，作为一个prompt字符串。画面描述使用英文，原文对白、歌词和可见文字保留原语言；本项目原文台词按正文保留。关于去BGM策略：根据组织规范，生成阶段不请求独立背景音乐，在non_diegetic_music章节中填入 N/A；对于没有音乐章节的模型模式，则不添加该字段。其他模式采用对应完整结构，不套用全参考模式的章节，也不只截取画面正文。

## 参考与当前工作流

素材文件、上传顺序和引用用途保存在 `video-production` 产物 的对应生成记录中，输入使用实际文件路径。`referenceImages` 的选择见 [reference-policy.md](reference-policy.md)。图片／视频／音频分别匹配对应标签，角色与说话人对应按prompts.md及官方指南核对；编号和引用不代替真实素材。多模态音频与画外音（`(S1)` 绑定、`says in an off-screen voiceover`、`while the character's lips remain completely closed`、跨镜头 `<scenetrans>`）遵循 [prompts.md](prompts.md) 的标准画外音规范。

ComfyUI 的多参考与首尾帧工作流可能有不同的输入限制；按当前已安装的 `comfyui-operations` 或相应插件说明选择，不能假定某一入口支持全部参考类型。参考视频音轨与独立音频同时输入时，服务端合并和Audio编号顺序尚未验证；该缺口仅影响相关输入组合，使用前核对真实工作流，不构造含糊声音引用。

多视图设定板、服饰状态和参考冲突按 prompts.md 与 reference-policy.md 判断；前片实际状态由制作人在本技能生成前按需查阅，不因切换机位默认更换角色身份或声音。

## 参数编译与交接

调用前读取本轮准确插件说明和CLI帮助，并取得当前组织／工单的技术视频长度约束。单次时长同时满足制作约束与真实工具／模式上限，相邻 Shot 的组合按[生产原则](../production/production-principles.md#确定-clip-覆盖范围)确定。ComfyUI视频使用当前命令支持的durationSeconds、aspectRatio、referenceImages等输入，其他入口按各自契约。帧率、参考数量、模型、画幅和尺寸以当前工作流及实际接口为准，不将一个工作流的限制套用到所有H3入口。

作品需要精确16:9时核对真实输出的宽高比和尺寸。例如1024×576、1536×864均为精确16:9且宽高为32的倍数，但是否可选取决于当前工作流；出现黑边或重影时检查输出与剪辑设置，不仅凭尺寸承诺没有伪影。

核对完整字段、真实素材和时间安排后，回传实际 Prompt、参数、参考绑定与尚未解决的接口限制。实际提交、任务恢复、输出核对和 Production 记录由本技能后续步骤负责；参数检查只说明请求可编译，不证明模型已实现导演意图。
