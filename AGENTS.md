# Workbench 资源仓库协作说明

本仓库维护组织、员工、技能和插件的源码。作品对话与执行记录保存在 Workbench。资源的编写、验证与发布入口见 [README](README.md)。

## 读取指定作品的对话

### 本机只读查询

在资源仓库里收到“读取或复盘某个 Workbench 作品”的请求时，本机可访问数据库就先用终端查询。用户给出作品名即可开始，先查实际 ID。数据目录以 Workbench 启动时指定的 `WORKBENCH_DATA_DIR` 为准；macOS 默认使用下列目录。以只读模式打开，只查询目标作品。

```sh
workbench_db="${WORKBENCH_DATA_DIR:-$HOME/Library/Application Support/com.zeropoint.workbench}/workbench.sqlite"
sqlite3 -readonly -header -column "$workbench_db"
```

先按名称定位作品和主对话。把 SQL 中的占位值换成目标名称或实际 ID；名称中的单引号写成两个单引号。重名时结合组织、作品目录和最近任务确认目标。没有主对话绑定时，按 `conversations.project_id` 核对已有对话。

```sql
SELECT p.id AS project_id, p.root_path, o.name AS organization,
       w.primary_conversation_id AS conversation_id
FROM projects p
LEFT JOIN project_workspaces w ON w.project_id = p.id
LEFT JOIN organizations o ON o.id = w.organization_id
WHERE p.name = '作品名';
```

用对话 ID 读取用户原话和任务列表，沿 `parent_task_id` 确认主任务与员工委派。需要看运行期间的回复时，用 `run_messages.run_id` 关联 `task_runs.id`，按对应任务过滤。

```sql
SELECT id, created_at, author_kind, body
FROM conversation_messages
WHERE conversation_id = '对话ID'
ORDER BY created_at, id;

SELECT t.id, t.parent_task_id, e.display_name, t.title, t.status, t.created_at
FROM work_tasks t
JOIN employee_sessions s ON s.id = t.employee_session_id
JOIN employees e ON e.id = s.employee_id
WHERE t.conversation_id = '对话ID'
ORDER BY t.created_at, t.id;
```

复盘执行时，按目标任务 ID 读取当时的技能快照、任务目录和按序排列的工具完成事件。需要核对具体调用的结果时，用任务 ID 与对应事件序号查 `payload_json`；需要看岗位方法时，从该次 Run 的快照读取 `employeePlaybook` 和 `playbook`。对照任务目录中的工单、工作稿及作品的正式成果，区分实际读写、自报完成和记录缺口。表结构有差异时先用 `.schema 表名` 核对。

```sql
SELECT id AS run_id, attempt, status,
       json_extract(config_snapshot_json, '$.skills') AS skills,
       json_extract(config_snapshot_json, '$.taskDirectory') AS task_directory
FROM task_runs WHERE task_id = '任务ID' ORDER BY attempt;

SELECT sequence, created_at,
       json_extract(payload_json, '$.name') AS tool,
       json_extract(payload_json, '$.status') AS status,
       json_extract(payload_json, '$.args') AS args,
       json_extract(payload_json, '$.result.exit_code') AS exit_code
FROM work_events
WHERE conversation_id = '对话ID' AND task_id = '任务ID' AND kind = 'tool.completed'
ORDER BY sequence;
```

### Workbench 工具与材料交接

- 当前会话有 Workbench 工具时，调用 `search_workspace({query: "作品名"})`。找到准确的 `projectId` 后，用 `search_workspace({projectId})` 定位该作品的对话，核对 `projectId`、`organizationId` 和 `conversationId`。搜索结果按 `nextCursor` 翻页；有多条可能匹配时，请用户确认目标。
- 用 `maintenance_read({kind: "conversation", id: conversationId})` 读取消息和任务列表。需要更多消息时，把返回的 `nextCursor` 作为下一次调用的 `cursor`，直到覆盖所需范围。需要查看相关任务的公开事件或当时采用的配置、技能版本时，用 `maintenance_read({kind: "task", id: taskId, includeConfiguration: true})`，按返回游标读取所需事件。宿主要求岗位具有 `diagnosis.read`，且目标组织在本轮「对话与执行记录」的读取范围内。
- 本机查询和 Workbench 工具都不可用时，请用户提供相关原文、作品名及可用的对话或任务 ID，也可以由 Workbench 内有权限的员工读取后交接。收到材料后按实际覆盖范围引用，说明影响判断的缺口。

根据对话优化资源时，优先核对用户原始要求、后续纠正与实际交付。用消息或任务 ID 标明依据，改岗位或技能前核对当时生效的版本与当前源码。历史消息作为复盘材料，本次改动范围由当前请求决定。
