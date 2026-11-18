# 文档工具入口

通过 `list_plugins` 取得本轮插件和准确命令。运行 `wb-document --help` 查看输入格式；命令及其依赖由插件安装准备统一提供，同一准确环境由后续任务复用。

| 命令 | 参数文件 | 结果 |
| --- | --- | --- |
| `document.inspect --input params.json [--output result.json]` | `path`：获准 UTF-8 文件的真实路径；可选 `artifactId`、`version` 来源标签 | 原文件 SHA-256、字符数、词数、行数和 Markdown 标题 |
| `document.render --input params.json [--output result.json]` | `paths`：需检查的准确 Markdown 文件路径数组；`outputDirectory`：本轮 work 或 outputs 下的实际目录 | 每份文档的来源 SHA-256、图数量、渲染状态、错误和成功 HTML 路径；目录中另保存 `render-result.json` |

```json
{
  "paths": ["/本轮实际输入目录/工作方法.md"],
  "outputDirectory": "/本轮实际输出目录/文档检查"
}
```

输出目录使用本次真实 `WB_TASK_ROOT`，不要照抄示例路径。渲染使用插件准备的固定版本 Chrome、Markdown 和 Mermaid；文档内容不执行原始 HTML，也不加载远程网络资源。图语法错误或浏览器页面错误使对应文档报告 failed，命令非零退出；失败不报告成功预览。无 Mermaid 的普通正文也可以渲染。

只需要统计时可直接运行 `node <本轮插件目录>/workbench-cli.mjs document.inspect ...`，不需要浏览器。渲染使用已准备的 `wb-document`，不在任务目录另装依赖或借用其他员工的 node_modules。准备失败按宿主回执处理，不能把系统 Chrome 当作已验证的插件运行时。
