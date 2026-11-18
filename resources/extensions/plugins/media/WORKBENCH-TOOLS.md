# 媒体插件

安装后本轮 PATH 提供 `wb-media`；macOS arm64 和 Windows x64 使用相同命令，不依赖 Homebrew、Bash、系统 Python 或系统 FFmpeg。先按用途读取配套技能：

- [媒体检查](skills/media-inspection/SKILL.md)：信息、指定时间抽帧、音频提取及证据范围。
- [视频拼接](skills/media-assembly/SKILL.md)：明确采用顺序、原声策略及实际导出检查。

`wb-media --help` 查看参数。`inspect` 或 `assemble` 均使用 `--input <本轮 work 参数 JSON 的绝对路径> --output-dir <本轮 outputs 的绝对路径>`。路径含空格时作为一个参数引用；Windows 使用当前 Shell 的引用规则。Node 脚本和二进制位于工作台已准备的工具环境，不能从源码入口猜测依赖路径。

命令同步返回 JSON 与退出码。成功为 state=completed，resultFile 指向实际结果记录；失败为 state=failed、非零退出码，可能保留 partialDirectory 供诊断，不能把部分文件登记为成功成果。没有后台 job、提交或轮询步骤。

命令缺失、依赖损坏、下载失败或平台不支持时保留原错误，在插件维护页修复工具环境；不要运行 `find /`、扫描整盘、安装系统依赖或临时重写媒体解析程序。详细边界见 [README](README.md)。

`wb-media assemble` 的 FFmpeg 拼接不设 5 分钟内部超时。长任务在 Windows 命令工具中保持 `timeoutSeconds: 0`，直接使用 `wb-media assemble`，不在 PowerShell 中手写 FFmpeg 滤镜字符串。
