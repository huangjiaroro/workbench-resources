# ComfyUI

安装／切换插件版本后，本轮 PATH 提供 `zp-comfy`。先运行 `zp-comfy --help`，使用本轮 configurations 中明确选择的连接路径，不输出配置正文。

```sh
# 探测环境与节点完整性
zp-comfy probe --connection <配置路径> [--workflow h3-flex|h3-flex-fl|h3|music3]

# 视频生成（全能多参考默认 h3-flex，亦可指定 --workflow h3；h3 可加 --turbo 开启 4 步极速打样）
zp-comfy video generate --connection <配置路径> --input work/request.json --download outputs/clip.mp4 --record work/clip.job.json
zp-comfy video generate --connection <配置路径> --prompt-file work/prompt.txt --duration 8 --ratio 16:9 --reference-image inputs/aria.jpg --download outputs/clip.mp4
zp-comfy video generate --connection <配置路径> --workflow h3 --turbo --prompt-file work/prompt.txt --duration 5 --download outputs/draft.mp4

# 视频生成（首尾帧过渡 h3-flex-fl，必需首帧，可选尾帧，尺寸依首帧自适应）
zp-comfy video generate --connection <配置路径> --workflow h3-flex-fl --prompt-file work/prompt.txt --duration 5 --first-frame inputs/first.png --last-frame inputs/last.png --download outputs/transition.mp4 --record work/fl.job.json

# 音乐生成（MiniMax Music 3，输出 MP3）
zp-comfy music generate --connection <配置路径> --input work/music.json --download outputs/music.mp3 --record work/music.job.json
zp-comfy music generate --connection <配置路径> --caption-file work/caption.txt --lyrics-file work/lyrics.txt --max-duration 60 --download outputs/music.mp3

# 恢复与状态查询
zp-comfy task wait --connection <原配置路径> --record work/clip.job.json
zp-comfy task get --connection <原配置路径> --record work/clip.job.json
```

一次生成命令内部完成必要素材上传、工作流绑定、提交、轮询和下载。默认等待结果，不要读取内部 engine.mjs 或重写生成／重试程序。

### 视频工作流选择
- **`h3-flex`（默认推荐）**：全能多模态参考生视频。0.98 MP 高清，基于 Pika H3 Flex LoRA 与 LCM 6步去噪。输入包含 `prompt`、`durationSeconds`、`aspectRatio`，可选 0–9 张参考图、0–1 个视频、0–3 个音频。适合绝大多数需要角色一致性、道具特征或音画参考的高清镜头。
- **`h3`（标清保底 / 极速打样）**：全能多模态参考生视频。0.4 MP 标清。默认采用底模 20 步；**支持 `--turbo`（或 JSON `"turbo": true`）开关**切换至 MiniMax 4 步 Turbo 蒸馏 LoRA，用于**快速验证分镜运镜与动作定稿**。输入结构与 `h3-flex` 相同。用于显存受限或极速草稿验证。
- **`h3-flex-fl`（首尾帧过渡）**：首尾帧定向过渡生视频。基于 MiniMax FL2VA 底模与 Pika Flex FL LoRA。必需 `firstFrame`（首帧图），可选 `lastFrame`（尾帧图）。**无需且不支持 aspectRatio**（尺寸依首帧自动对齐 32 整数倍），**不支持**多参考图/音视频。用于分镜之间精准接戏、定格图起幅或两画面平滑过渡。

#### 视频 JSON 输入示例（配合 `--input request.json` 使用）
- **多模态参考（`h3-flex` / `h3`）**：
  ```json
  {"workflow":"h3-flex","prompt":"角色向镜头走来，保持服饰一致","durationSeconds":5,"aspectRatio":"16:9","referenceImages":["inputs/aria.jpg"]}
  ```
  *(若选用 `h3` 工作流做快速打样定稿，可在 JSON 中加 `"turbo": true`)*
- **首尾帧过渡（`h3-flex-fl`）**：
  ```json
  {"workflow":"h3-flex-fl","prompt":"镜头从起幅自然演进到落幅","durationSeconds":5,"firstFrame":"inputs/start.png","lastFrame":"inputs/end.png"}
  ```
  *(无需 `aspectRatio`；`lastFrame` 不提供时仅由首帧精准起幅)*

### 音乐与参数
Music 3 请求使用 workflow=music3、caption、lyrics、maxDurationSeconds、可选 seed 和 parameters，最大时长默认 60 秒，输出 MP3。精确参数和模型需求见 [README](README.md)。JSON 输入与直接命令行参数二选一。

### 回执与恢复
命令在提交前持久保存回执并加锁，成功后立即记录原 remoteJobId。中断后用 `zp-comfy task wait --connection <原配置路径> --record work/clip.job.json` 恢复同一个任务；状态查看用 `task get`。提交结果不明明确阻塞，不自动重提；核实原任务 ID 后可在 task wait 中用 `--job` 补录。不要换连接、修改回执或新建记录绕过未知状态。

文件保存到成果目录或本轮 outputs，并完成实际视听检查。工具缺失时报告当前版本环境需修复，由 Workbench 重新准备；不要修改正式插件包或系统工具。

H3 长视频要同时设置外层 Windows/宿主命令工具的 `timeoutSeconds: 0` 和 `zp-comfy --timeout 0`。有限时等待到期返回 pending，不代表远端失败。每个回执同时只运行一个命令；若先用 `--no-wait` 提交，须等提交命令退出后再用原回执 `task wait --timeout 0`。等待期间不要并发执行 `task get` 或删除活动锁。
