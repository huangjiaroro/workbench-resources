# GitHub 插件

组织加入并启用 GitHub 插件后，成员可使用 `wb-github` 和配套的 [Git 与 GitHub 工作流](skills/github-workflow/SKILL.md)。安装时从 [GitHub 官方发布页](https://github.com/cli/cli/releases/tag/v2.105.0) 下载并核验固定版本的 GitHub CLI。分支、提交与推送需要当前环境可执行 `git`。

## 连接

在插件维护页添加命名连接，填入用于 `github.com` 的 GitHub 访问令牌。细粒度令牌选择目标仓库，并按操作配置权限。普通代码推送需要 Contents 写权限，创建 PR 需要 Pull requests 写权限，查看私有 PR 和 Actions 日志需对应读取权限。

从本轮插件发现结果中选择连接，将其私有配置路径传给 `--connection`。用 `whoami` 核对登录名；Git 提交作者取自仓库当前 Git 配置。令牌由插件入口读取，只传给本次子进程。缺少连接、令牌失效或权限不足时，修正所选连接后再执行。

## 命令

使用 `wb-github --help` 查看全部参数。下例的 `CONNECTION_FILE` 是所选连接在本轮的配置路径，`OWNER/REPO` 是实际目标。创建 PR 的正文文件应在本轮可读范围内。

```sh
wb-github --connection "$CONNECTION_FILE" whoami
wb-github --connection "$CONNECTION_FILE" repo --repo OWNER/REPO
wb-github --connection "$CONNECTION_FILE" push --repo OWNER/REPO --branch feature/update
wb-github --connection "$CONNECTION_FILE" pr-create --repo OWNER/REPO --head feature/update --base main --title "Update behavior" --body-file pr.md
wb-github --connection "$CONNECTION_FILE" pr-view --repo OWNER/REPO --number 42
wb-github --connection "$CONNECTION_FILE" pr-comments --repo OWNER/REPO --number 42
wb-github --connection "$CONNECTION_FILE" pr-checks --repo OWNER/REPO --number 42
wb-github --connection "$CONNECTION_FILE" run-failures --repo OWNER/REPO --number 1234
```

`push` 在当前仓库用所选账号通过 HTTPS 推送已提交的指定本地分支。它保留 Git 的普通快进限制。用 `remote-head --repo OWNER/REPO --branch BRANCH` 查询实际远端 SHA。跨 fork 开 PR 时先推送到获准的 fork，再指定目标仓库和 `--head OWNER:BRANCH`。创建 PR 返回 URL，可用 `--draft` 创建草稿。

`pr-view` 提供 PR 状态、SHA、审查结论和会话评论，`pr-comments` 提供分页的行内评论，`pr-checks` 保留 GitHub CLI 的状态与退出码。检查尚在运行时会返回 8。需要诊断失败时，根据实际 Actions 运行 ID 调用 `run-failures`。

推送结果未知时先用 `remote-head` 对照本地 SHA。创建 PR 结果未知时用 `pr-list --repo OWNER/REPO --head BRANCH --base BRANCH` 查询，跨 fork 时再从 `pr-view` 核对来源和提交，确认结果后决定是否重试。
