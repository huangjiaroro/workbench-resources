# GitHub 插件

组织加入并启用 GitHub 插件后，成员可使用 `wb-github` 和配套的 [Git 与 GitHub 工作流](skills/github-workflow/SKILL.md)。安装时从 [GitHub 官方发布页](https://github.com/cli/cli/releases/tag/v2.105.0) 下载并核验固定版本的 GitHub CLI。分支、提交与推送需要当前环境可执行 `git`。

## 连接

在插件维护页的“登录认证”点击“登录 GitHub”，在浏览器完成授权。插件只使用一个当前身份，可重新登录或退出；不需要手动创建访问令牌。凭据独立于插件版本保存，升级插件后继续使用。已有单个 Token 配置在首次浏览器登录前仍可使用。

从本轮插件发现结果中读取“当前登录身份”的私有配置路径，传给 `--connection`。用 `whoami` 核对账号；Git 提交作者取自仓库当前 Git 配置。登录失效时回到插件认证页重新登录。配置和凭据不进入对话或发布包。

## 命令

使用 `wb-github --help` 查看全部参数。下例的 `CONNECTION_FILE` 是当前登录身份在本轮的配置路径，`OWNER/REPO` 是实际目标。创建 PR 的正文文件应在本轮可读范围内。

```sh
wb-github --connection "$CONNECTION_FILE" whoami
wb-github --connection "$CONNECTION_FILE" repo-create --repo OWNER/workbench-resources --visibility private --directory /absolute/resources
wb-github --connection "$CONNECTION_FILE" repo --repo OWNER/REPO
wb-github --connection "$CONNECTION_FILE" clone --repo OWNER/REPO --directory /absolute/resources
wb-github --connection "$CONNECTION_FILE" fetch --repo OWNER/REPO --branch main
wb-github --connection "$CONNECTION_FILE" push --repo OWNER/REPO --branch feature/update
wb-github --connection "$CONNECTION_FILE" pr-create --repo OWNER/REPO --head feature/update --base main --title "Update behavior" --body-file pr.md
wb-github --connection "$CONNECTION_FILE" pr-view --repo OWNER/REPO --number 42
wb-github --connection "$CONNECTION_FILE" pr-comments --repo OWNER/REPO --number 42
wb-github --connection "$CONNECTION_FILE" pr-checks --repo OWNER/REPO --number 42
wb-github --connection "$CONNECTION_FILE" run-failures --repo OWNER/REPO --number 1234
```

`repo-create` 按明确要求创建公开或私有仓库，省略 OWNER 时应先用 `whoami` 取得账号；提供 `--directory` 时把已有本地 Git 仓库关联到 origin 并推送已提交内容。创建结果未知时，先用 `repo` 查询准确仓库，不换名字重建。Git 初始化、首个提交与资源目录规范在本地按任务完成。

`clone` 将指定仓库检出到获准的绝对目录。`fetch` 获取指定分支到当前仓库的 `FETCH_HEAD`，可先查看差异再决定是否快进或合并。

`push` 在当前仓库用当前登录账号通过 HTTPS 推送已提交的指定本地分支。它保留 Git 的普通快进限制。用 `remote-head --repo OWNER/REPO --branch BRANCH` 查询实际远端 SHA。跨 fork 开 PR 时先推送到获准的 fork，再指定目标仓库和 `--head OWNER:BRANCH`。创建 PR 返回 URL，可用 `--draft` 创建草稿。

`pr-view` 提供 PR 状态、SHA、审查结论和会话评论，`pr-comments` 提供分页的行内评论，`pr-checks` 保留 GitHub CLI 的状态与退出码。检查尚在运行时会返回 8。需要诊断失败时，根据实际 Actions 运行 ID 调用 `run-failures`。

推送结果未知时先用 `remote-head` 对照本地 SHA。创建 PR 结果未知时用 `pr-list --repo OWNER/REPO --head BRANCH --base BRANCH` 查询，跨 fork 时再从 `pr-view` 核对来源和提交，确认结果后决定是否重试。
