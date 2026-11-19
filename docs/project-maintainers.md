# 项目维护者模板

项目维护者通过组织对话处理获准的配置维护、运行诊断和资源采用。岗位、员工定义与依赖以 [组织清单](../resources/packs/project-maintainers/pack.yaml) 为准，日常分工和交接见 [组织工作方法](../resources/packs/project-maintainers/playbook.md)。

| 岗位 | 职责 | 员工定义 |
| --- | --- | --- |
| 组织维护负责人 | 核对维护目标和范围，分派任务，确认配置变更与资源采用 | [organization-maintainer](../resources/employees/organization-maintainer.yaml) |
| 技能工程师 | 修订和校验可复用的方法包，报告改动与引用影响 | [skill-engineer](../resources/employees/skill-engineer.yaml) |
| 插件工程师 | 维护插件入口、连接契约、依赖和页面，验证实际工具行为 | [plugin-engineer](../resources/employees/plugin-engineer.yaml) |
| 运行诊断员 | 在获准范围内读取运行证据、诊断失败并报告影响 | [runtime-diagnostician](../resources/employees/runtime-diagnostician.yaml) |

资源定义在 Git 源码中维护。同步检查员工身份、个人方法、组织工作方法及其引用，遵循 [共享编写规范](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/resources/builtin/skills/workbench-resource-authoring/SKILL.md)。资源仓库的打包和检查入口见 [开发环境](../README.md#开发环境)。

通过 Workbench 广场安装所需正式版本并创建实例。已有实例的版本切换、岗位授权、配置审批和记忆整理遵循应用的对应规则。[组织广场](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/docs/organization-gallery.md) · [维护与审批](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/docs/maintenance-automation.md)
