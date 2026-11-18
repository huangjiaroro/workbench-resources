# ComfyUI

插件提供独立 `zp-comfy` 命令。setup.mjs 在安装／切版时将命令及工作流准备到隔离环境，不依赖仓库源码或全局安装。Node.js 程序无需编译为二进制；员工直接使用短命令。

```sh
zp-comfy workflows list
zp-comfy probe --connection <本轮已选配置路径> [--workflow h3-flex|h3-flex-fl|h3|music3]
zp-comfy video generate --connection <配置路径> --input work/request.json --download outputs/clip009.mp4 --record work/clip009.job.json
zp-comfy music generate --connection <配置路径> --input work/music.json --download outputs/music.mp3 --record work/music.job.json
zp-comfy task get --connection <原配置路径> --record work/clip009.job.json
zp-comfy task wait --connection <原配置路径> --record work/clip009.job.json
```

生成默认执行一次提交、持续轮询、下载，完成后返回包含输出路径、哈希和原服务任务 ID 的 JSON。默认 5 秒查询一次、等待上限 3600 秒，可用 --poll-interval、--timeout 调整。--no-wait 仅提交并返回回执。回执默认位于 `<download路径>.job.json`，也可通过 --record 放在本轮 work 下。

---

## 视频生成工作流与能力对比

| 视频工作流 | 定位模式 | 清晰度 / 分辨率 | 参考素材支持 | 核心模型与算法 | 典型适用场景 |
|---|---|---|---|---|---|
| **`h3-flex`**<br>*(默认推荐)* | 全能多模态参考<br>(ref2va) | 0.98 MP 高清<br>(需指定 `aspectRatio`) | 0–9 张参考图<br>0–1 个参考视频<br>0–3 个参考音频 | 底模: `ref2va_pruned_int8`<br>LoRA: `pika_h3_flex_ref2va`<br>采样: LCM (6步 Sigmas) | **日常高清视频首选**。角色、服饰、道具一致性镜头，或带音画动态参考的生成。 |
| **`h3`**<br>*(标清保底 / 快速定稿)* | 全能多模态参考<br>(ref2va) | 0.4 MP 标清<br>(需指定 `aspectRatio`) | 同上 (0–9图, 0–1视频, 0–3音频)<br>**支持 `--turbo`** (4步开关) | 底模: `ref2va_pruned_int8`<br>可选: MiniMax 4-step Turbo<br>采样: res_multistep | 算力受限、服务端缺少 Flex LoRA，或前期**极速验证运镜与动作定稿**（开启 `--turbo` 仅 4 步出片）。 |
| **`h3-flex-fl`**<br>*(首尾帧)* | 首尾帧定向过渡<br>(fl2va) | 自适应分辨率<br>(**依首帧像素 round32**) | **必需 `firstFrame`**<br>**可选 `lastFrame`**<br>*(严禁多参考素材)* | 底模: `fl2va_pruned_int8`<br>LoRA: `pika_h3_flex_fl2va`<br>采样: LCM (6步 Sigmas) | **定点起止帧过渡首选**。两分镜之间接戏过渡、定格关键帧起幅或画面精准形态演化。 |

### 1. 全能多参考视频示例 (`h3-flex` / `h3`)

JSON 请求文件示例（默认采用 `h3-flex`）：
```json
{
  "workflow": "h3-flex",
  "prompt": "角色向镜头走来，保持服饰与面容一致",
  "durationSeconds": 8,
  "aspectRatio": "16:9",
  "referenceImages": ["inputs/aria.jpg"]
}
```

命令行直接调用：
```sh
zp-comfy video generate --connection <配置路径> --prompt-file work/prompt.txt --duration 8 --ratio 16:9 --reference-image inputs/aria.jpg --download outputs/clip.mp4
# 或显式指定旧版标清工作流：
zp-comfy video generate --connection <配置路径> --workflow h3 --prompt-file work/prompt.txt --duration 8 --ratio 16:9 --reference-image inputs/aria.jpg --download outputs/clip.mp4
```

- H3 与 H3-Flex 均支持 0–9 张图片、0–1 个视频、0–3 个音频；路径均为实际本地文件。固定 24 fps。
- **默认工作流 `h3-flex`**：清晰度更高（默认 0.98 MP），采用 Pika H3 Flex LoRA（`pika_h3_flex_ref2va_v1_bf16.safetensors`）、LCM 采样器与 6 步 ManualSigmas 手工去噪序列，兼顾清晰度与快速成片。
- **可选工作流 `h3`**：标清（默认 0.4 MP）。默认使用底模 20 步采样；**支持 `--turbo`（或 JSON `"turbo": true`）开关**：开启时底层切换至 MiniMax 官方 Turbo 蒸馏 LoRA（`minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors`）并采用 4 步采样，专用于**快速验证分镜运镜与主体动作定稿**。
- 两者均使用 `minimax_h3_video_vae_int8_convrot.safetensors` 视频 VAE、`minimax_h3_audio_vae_fp32.safetensors` 与 `minimax_h3_ref2va_pruned_int8_convrot.safetensors` 底模。服务端需安装对应模型及支持它的 ComfyUI 版本。视频输出为 MP4。

### 2. 首尾帧视频示例 (`h3-flex-fl`)

JSON 请求文件示例：
```json
{
  "workflow": "h3-flex-fl",
  "prompt": "镜头从起幅平滑推进，主体动作自然过渡到落幅姿势",
  "durationSeconds": 5,
  "firstFrame": "inputs/start_frame.png",
  "lastFrame": "inputs/end_frame.png"
}
```

命令行直接调用：
```sh
zp-comfy video generate --connection <配置路径> --workflow h3-flex-fl --prompt-file work/prompt.txt --duration 5 --first-frame inputs/start_frame.png --last-frame inputs/end_frame.png --download outputs/transition.mp4
```

- **首帧 `firstFrame` 必需**，**尾帧 `lastFrame` 可选**（不提供时仅根据首帧画面定向起幅）。
- **画幅机制**：自动通过 `GetImageSize` 节点读取首帧分辨率并对齐为 32 的整数倍，**无需且不支持 `aspectRatio`**。
- **底层模型**：使用 `minimax_h3_fl2va_pruned_int8_convrot.safetensors` 首尾帧专用底模与 `pika_h3_flex_fl2va_v1_bf16.safetensors` 专用 LoRA，搭配 `MiniMaxH3ImageToVideo` 节点。

---

## 音乐生成 (`music3`)

MiniMax Music 3 输入示例：
```json
{
  "workflow": "music3",
  "caption": "Instrumental cinematic piano, warm strings, slow build, no vocals.",
  "lyrics": "",
  "maxDurationSeconds": 60,
  "seed": 12345,
  "parameters": {
    "steps": 30,
    "textCfgScale": 1.7,
    "topK": 50,
    "samplerCfg": 1.7,
    "tiledDecode": true,
    "tileSize": 1536,
    "overlap": 64
  }
}
```

命令行直接调用：
```sh
zp-comfy probe --connection <配置路径> --workflow music3
zp-comfy music generate --connection <配置路径> --caption-file work/caption.txt --lyrics-file work/lyrics.txt --max-duration 60 --seed 12345 --download outputs/music.mp3 --record work/music.job.json
```

`caption` 描述风格、人声、配器与编排；`lyrics` 填写歌词，可包含 `[Verse]`、`[Chorus]` 等段落标记，未提供时使用空文本。制作纯音乐时在 caption 明确无歌词、无人声，实际输出仍需试听确认。`maxDurationSeconds` 默认 60，是最大时长而非精确长度，支持 0.04–360 秒。音乐不接受视频画幅、参考素材或 `prompt` 字段。固定输出 MP3 V0。

---

## 回执机制与长任务恢复

JSON 请求与直接参数二选一，不能混用；生成命令均支持 seed（非负安全整数）。未指定时生成随机种子，并在提交前记录到回执。`workflows list` 返回可直接用于 `--workflow` 的 `h3-flex`、`h3-flex-fl`、`h3` 和 `music3`。

回执在外部提交前落盘，并绑定输入、输出和选定连接；并发使用同一回执会拒绝。已知 remoteJobId 只查询原任务。中断后使用 task wait；网络错误／超时保留原件，不再次提交。提交结果不明时先在原服务核实，再通过 task wait --job <已核实原任务ID> 补录。异常退出留下锁文件时先核对原进程已结束，再处理准确回执的 .lock 文件，不创建新回执重复生成。

包内 workflows/<id>/ 维护 graph、input_bindings、defaults 和输出约束。只采纳工作流指定保存节点的一个结果，拒绝不符的输出格式。probe 只检查节点类型，不证明模型和实际生成已验收。结果需导入媒体库并完成视听检查。

### 长视频等待与回执锁

`--timeout 0` 表示不限时等待，适用于 H3 长视频；有限时等待到期会返回 `status: pending`、`waitTimedOut: true` 和退出码 0，远端任务仍在运行。Workbench 命令工具的 `timeoutSeconds: 0` 与此参数分别控制外层进程和插件轮询，两者都应设为 0。轮询间隔仍由 `--poll-interval` 控制。

同一回执只能有一个活动命令。可以先运行 `video generate --no-wait`，待提交命令退出后，再对原回执运行 `task wait --timeout 0`。等待期间不要并发运行 `task get`，也不要删除活动进程持有的 `.lock`。若进程意外退出，先核实原进程已经结束，再处理准确的遗留锁；始终使用原回执恢复，不重新提交视频。
