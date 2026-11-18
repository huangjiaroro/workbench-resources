# Workbench 资源

这里维护 Zero Point Workbench 的可独立发布资源源码。资源目录保留清单、工作指引、配套资料和代码，便于在一个提交中更新组织及其依赖。

| 资源 | 定义入口 | 内容 |
| --- | --- | --- |
| 组织模板 | [`resources/packs/<id>/pack.yaml`](resources/packs/engineering-team/pack.yaml) | 岗位、员工定义 ID 和版本、组织插件引用，以及同目录的岗位指引、组织工作手册和成果目录约定 |
| 员工 | [`resources/employees/<id>.yaml`](resources/employees/screenwriter.yaml) | 员工身份、工作手册和技能引用，引用的 Markdown 一并维护 |
| 插件 | [`resources/extensions/plugins/<id>/plugin.yaml`](resources/extensions/plugins/github/plugin.yaml) | 连接字段、命令入口、使用指引和插件自带技能。连接值与密钥由 Workbench 管理 |
| 独立技能 | [`resources/extensions/skills/<id>/SKILL.md`](resources/extensions/skills/drama-writing/SKILL.md) | 技能标识、版本、方法和配套资料。需要声明能力时使用同目录的 `workbench.yaml` |

随应用提供的内置资源和启动所需资源由 [Workbench 应用项目](https://github.com/huangjiaroro/zero-point-workbench/tree/v1.0.0/resources) 维护。这里的模板可以引用应用提供的内置能力。

编写资源时参考应用项目的[员工、组织与技能编写规范](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/resources/builtin/skills/workbench-resource-authoring/SKILL.md)和[插件包规范](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/docs/plugin-packages.md)。字段类型、校验和加载行为以应用项目的[资源加载器](https://github.com/huangjiaroro/zero-point-workbench/tree/v1.0.0/packages/resource-loader/src)为准。

Git 记录源码改动。正式分发沿用 Workbench Hub 的打包、验证和发布流程，用户在 Workbench 内安装所需版本。已创建的组织、用户定制、成员授权、连接值和任务历史保存在 Workbench 内。
