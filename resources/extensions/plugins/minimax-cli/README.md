# MiniMax CLI

本插件使用 MiniMax 官方 `mmx-cli 1.0.28`，不重新定义官方能力的参数和提交／轮询流程。安装准备将包内固定依赖放入按版本隔离的工具环境，验证版本后暴露 `mmx`；无需全局 npm 安装或个人登录。开发者在打包前运行 prepare.mjs 获取锁定依赖，setup.mjs 只准备本机工具环境。

[官方说明](https://platform.minimax.cn/docs/m-plan/minimax-cli) 与 `mmx <子命令> --help` 提供命令用法。本插件只增加 `--connection FILE`，以本次明确选择的 Workbench 命名配置隔离账号；不会使用个人 ~/.mmx、环境中的其他 MiniMax 账号或隐式切换服务。凭据在命令期间的私有临时目录中使用，退出清理；中断不会自动重新生成。

```sh
mmx --version
mmx video generate --help
mmx video generate --model MiniMax-H3 --prompt "角色向镜头走来" --duration 8 --ratio 16:9 --reference-image inputs/aria.jpg --download outputs/clip.mp4 --connection <配置路径>
mmx image generate --prompt "人物设定板" --aspect-ratio 16:9 --out outputs/character.png --connection <配置路径>
mmx speech synthesize --text "Hello" --voice <已查询音色ID> --out outputs/voice.mp3 --connection <配置路径>
mmx speech voices --connection <配置路径>
mmx vision describe --image inputs/frame.jpg --prompt "检查画面" --connection <配置路径>
mmx search query --q "查询内容" --connection <配置路径>
mmx text chat --message "文本要求" --connection <配置路径>
mmx quota --connection <配置路径>
```

视频默认等待生成完成并下载，内部默认每 5 秒查询一次，连接包装默认等待上限 3600 秒。只有明确需要异步返回时才用 --async／--no-wait，保存 taskId 后按官方帮助查询原任务、下载。超时不代表服务没有接单；不知道提交结果时先查原服务记录，不能盲目重试。

实际素材使用获准本地路径或作品成果路径。生成结果保存与视听验收由员工继续完成。缺失工具环境时使用 Workbench 修复准备，正式包保持不可变。
