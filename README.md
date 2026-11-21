# Workbench 资源

这里维护 Zero Point Workbench 的可独立发布资源源码。资源目录保留清单、工作指引、配套资料和代码，便于在一个提交中更新组织及其依赖。

| 资源 | 定义入口 | 内容 |
| --- | --- | --- |
| 组织模板 | [`resources/packs/<id>/pack.yaml`](resources/packs/engineering-team/pack.yaml) | 岗位、员工定义 ID 和版本、组织插件引用，以及同目录的岗位指引、组织工作手册和成果目录约定 |
| 员工 | [`resources/employees/<id>.yaml`](resources/employees/screenwriter.yaml) | 员工身份、工作手册和技能引用，引用的 Markdown 一并维护 |
| 插件 | [`resources/extensions/plugins/<id>/plugin.yaml`](resources/extensions/plugins/github/plugin.yaml) | 连接字段、命令入口、使用指引和插件自带技能。连接值与密钥由 Workbench 管理 |
| 独立技能 | [`resources/extensions/skills/<id>/SKILL.md`](resources/extensions/skills/drama-writing/SKILL.md) | 技能标识、版本、方法和配套资料。需要声明能力时使用同目录的 `workbench.yaml` |

随应用提供的内置技能和插件由 [Workbench 应用项目](https://github.com/huangjiaroro/zero-point-workbench/tree/v1.0.0/resources) 维护。这里的模板可以引用应用提供的内置能力。

编写资源时参考应用项目的[员工、组织与技能编写规范](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/resources/builtin/skills/workbench-resource-authoring/SKILL.md)和[插件包规范](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/docs/plugin-packages.md)。字段类型、校验和加载行为以应用项目的[资源加载器](https://github.com/huangjiaroro/zero-point-workbench/tree/v1.0.0/packages/resource-loader/src)为准。

Git 记录源码改动。资源通过独立发布流程进入 Workbench Hub，用户在 Workbench 内安装所需版本。组织源码通过本仓库的同步命令发布，Workbench 负责安装和切换正式版本。已创建的组织、用户定制、成员授权、连接值和任务历史保存在 Workbench 内。


## 开发环境

使用支持直接执行 TypeScript 的 Node.js 24 或更新版本。建议将本仓库与 `zero-point-workbench` 放在同一父目录，先在应用项目安装锁定依赖。其他目录布局可设置 `WORKBENCH_APP_ROOT` 为应用项目绝对路径。工具复用应用中的资源加载、分发格式及 Hub 客户端实现，格式验证以应用当前代码为准。

所有以下命令在本资源仓库执行。插件完整包导出和涉及固定工具依赖的回归先执行 `pnpm prepare:plugins`，准备结果由 `.gitignore` 排除。

| 命令 | 用途 |
| --- | --- |
| `pnpm prepare:plugins` | 准备插件源码声明的固定发布依赖 |
| `pnpm export:plugins` | 导出 `dist/plugins` 下的完整插件包和索引 |
| `pnpm export:skills` | 导出 `dist/skills` 下的完整技能包和索引 |
| `pnpm bundle:pack --pack engineering-team` | 校验组织及其员工、技能依赖，生成源码集合与 ZIP |
| `pnpm sync:pack --help` | 从源码发布变更并更新指定的本机组织，见 [组织同步](docs/short-drama.md#一键同步) |
| `pnpm check:hub-sources --data-dir /绝对路径/工作台数据 --source-id 来源ID` | 只读比较扩展源码与 Hub 当前正式完整包 |
| `pnpm test` | 验证组织打包、重建失败时的原包保留以及作品资料插件界面 |
| `pnpm check:docs` | 检查资源和维护说明的本地链接与标题引用 |

源码提交、正式发布、版本切换及真实服务调用按每次任务的明确授权执行。连接账号、秘密值、组织实例和采用计划由 Workbench 的持久化及宿主接口管理。

## 组织维护

- [项目维护者的岗位与源码维护](docs/project-maintainers.md)
- [知识库制作组织与依赖](docs/knowledge-production.md)
- [短剧创作组织及已有实例更新](docs/short-drama.md)
- [研发工程部的岗位、依赖和打包](docs/engineering-team.md)
- [短剧运营中心的维护与打包](docs/drama-commercialization.md)
- [导演方法参考来源](docs/director-method-archive/sources.md)
