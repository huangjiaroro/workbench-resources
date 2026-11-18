# MiniMax CLI

本插件在安装／切换版本时准备官方 `mmx-cli 1.0.28`，本轮命令 PATH 已包含 `mmx`。先运行 `mmx --help` 或 `mmx video generate --help` 查看官方参数。无需另写 SDK、提交／轮询脚本，直接调用命令。

从本轮插件目录的 configurations 中明确选择已启用连接，追加 `--connection <该配置路径>`；这是账号选择参数，其余 `mmx` 参数、默认等待和下载行为由官方 CLI 实现。不要输出配置正文，不读取个人 ~/.mmx，不运行 auth/config/agent/update；连接在 Workbench 维护。

```sh
mmx video generate --model MiniMax-H3 --prompt "镜头提示词" --duration 8 --ratio 16:9 --reference-image inputs/aria.jpg --download outputs/clip.mp4 --connection <已选配置路径>
```

默认等待生成完成并下载；长任务设置 `--timeout 3600`。需要立即返回任务 ID 时才用 `--async`；已知任务用官方 `video task get`／`video download` 查询和下载，具体参数先读对应 --help。中断或提交回执不明时先核对原任务，不自动重提、不换账号。真实结果写入成果目录或本轮 outputs；文件生成不代表视听验收。

图片、语音、识图、搜索与文本直接使用官方命令。更多示例见 [README](README.md)。若命令缺失，报告当前版本工具环境需修复，由 Workbench 重新准备；不要覆盖系统命令、修改正式包或擅自更新版本。
