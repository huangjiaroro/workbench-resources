# 文档检查

本扩展插件提供文档统计、Markdown 和 Mermaid 渲染，以及包内的 `document-review` 配套技能。通过 `list_plugins` 发现本轮入口，命令格式见 [工具入口](WORKBENCH-TOOLS.md)。无需连接配置，组织启用状态及任务权限由 Workbench 管理。

插件在发布准备阶段按 `dependency-lock.json` 打包固定 JavaScript 依赖；安装准备阶段在宿主独立缓存中准备与 Puppeteer 匹配的固定 Chrome。运行命令为 `wb-document`，环境由 Workbench 复用和清理，员工无需 npm 或本机 Chrome。平台支持取决于固定浏览器发行包；本版本准备器在不支持的平台明确失败。

输入是获准读取的准确 UTF-8 文档；结果保留原文件 SHA-256、实际检查范围和输出路径。统计成功或图能显示，不代表正文正确、专业审核通过或工作方法的业务效果已验证。
