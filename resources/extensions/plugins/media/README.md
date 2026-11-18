# 媒体插件

提供 `wb-media inspect` 与 `wb-media assemble`，组织启用后所有成员可发现两个配套技能，工具与技能随父插件统一版本。

检查输入：`{"path":"实际获准绝对路径","frameTimes":[0,1.5],"extractAudio":true}`。frameTimes 最多 60 个，必须在实际视频时长内；静态图像或纯音频不指定 frameTimes。extractAudio 需要实际音轨，提取第一条音轨到 PCM WAV。返回来源 SHA-256、实际媒体参数、请求及实际源帧时间、图片/音频路径和各自产物哈希。多音轨选择、字幕、声音语义和全片动态检查未实现。

拼接输入：`{"paths":["第一段绝对路径","第二段绝对路径"],"audioPolicy":"preserve"}`。2 至 100 段，保持相同分辨率、帧率与方向；preserve 要求各段均有一致的音轨布局或均无音轨。mute 仅用于明确要求静音的方案。不静默裁切、改变帧率、补声音或忽略混合音轨。使用 H.264 / AAC 导出 MP4，检查导出的时长和音轨，返回按输入顺序的来源哈希、段起点、源时长与真实结果。不同格式规范化、字幕压制、配音混入及复杂转场不在首版范围。

每次调用在指定 outputs 中建立独立目录，保留 result.json 或 failure.json。实际看图、播放、收听与专业验收由当前可用工具和技能完成；工具的 coverage.viewed/listened 始终为 false。抽帧不等于看完整视频，音轨存在或提取成功不等于台词、音乐、声音质量通过。

依赖由 [固定清单](dependencies.lock.json) 锁定，来源为 [Descript 的 FFmpeg/FFprobe 静态发布](https://github.com/descriptinc/ffmpeg-ffprobe-static/releases/tag/b6.1.2-rc.1)，源代码与构建说明见 [上游项目](https://github.com/descriptinc/ffmpeg-ffprobe-static)。第三方构建说明和许可保存在 [notices](notices)。安装准备只下载已锁定文件、验证大小与 SHA-256、检查程序版本，写入插件独立环境；不读取连接或密钥、不修改系统环境。macOS arm64 与 Windows 10 22H2 / Windows 11 x64 使用相同接口；各平台实际验证范围由项目验证文档记录。

`wb-media assemble` 的 FFmpeg 拼接进程不设固定执行期限，适合长集数或高质量编码；任务暂停或取消仍会传递给子进程。检查和抽帧的单个外部命令保留 5 分钟保护期限。拼接由插件构建滤镜，不需要在 PowerShell 中手写 `[0:v]` 等输入标签。
