# 项目维护者模板

项目维护者通过组织对话开展获准的运行诊断、资源源码开发、配置维护和正式交付。岗位、员工和依赖以 [组织清单](../resources/packs/project-maintainers/pack.yaml) 为准，协作与交接见 [组织工作方法](../resources/packs/project-maintainers/playbook.md)。

| 岗位 | 职责 |
| --- | --- |
| [组织维护负责人](../resources/employees/organization-maintainer.yaml) | 对齐目标、确定交付范围，直接审阅实际结果 |
| [组织资源维护员](../resources/employees/organization-resource-maintainer.yaml) | 开发组织、员工、技能和插件，校验关联改动 |
| [运行诊断员](../resources/employees/runtime-diagnostician.yaml) | 核对真实任务证据、准确版本和故障影响 |
| [资源发布员](../resources/employees/resource-publisher.yaml) | 管理交付提交、Hub 发布和本机采用 |

在 Workbench 资源开发页绑定个人 Git 仓库，从相应资源进入开发对话。开发方法见 [组织资源开发](../resources/extensions/skills/organization-resource-development/SKILL.md)，源码与打包入口见 [开发环境](../README.md#开发环境)。需要远端 Git 操作时为组织启用 GitHub 插件并选择命名连接。

通过 Workbench 广场安装正式版本和依赖。已有组织采用新版前先核对岗位和成员组合，沿用已有身份、历史和获准配置。组织授权与定时变更遵循 [运行维护](https://github.com/huangjiaroro/zero-point-workbench/blob/v1.0.0/docs/maintenance-automation.md)。

已有四岗位实例由客户端升级清单将技能工程师对应到组织资源维护员、插件工程师对应到资源发布员；员工、岗位和成员身份及实际权限保留。资源仓库只负责准确正式包的发布与核验，不直接写本机数据库。普通版本采用仍按宿主当前契约核对成员对应。
