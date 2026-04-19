# AI 与 MCP 集成

Weaponized VSCode 提供两个互补的 AI 集成功能:

1. **`@weapon` Chat Participant** — 一个理解你渗透测试上下文的 Copilot Chat 助手
2. **内嵌 MCP 服务器** — 一个 HTTP API，让外部 AI 客户端（Claude Code、Cursor 等）与你的工作区交互

这两项功能均由 `weaponized.ai.enabled` 设置控制（默认值：`true`）。

## @weapon Chat Participant

`@weapon` Chat Participant 与 GitHub Copilot Chat 集成，提供具有渗透测试意识的 AI 辅助。它可以完全读取你的主机、凭据和发现，但**绝不会将实际密码或哈希值发送给 LLM**。

### 快速开始

1. 安装 [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) 扩展
2. 打开 Copilot Chat 面板（`Ctrl+Shift+I` / `Cmd+Shift+I`）
3. 输入 `@weapon` 后跟你的问题或斜杠命令

### 斜杠命令

| 命令 | 用途 | 示例 |
|---------|---------|---------|
| `/analyze` | 分析工具输出 | `@weapon /analyze`（选中终端输出后使用） |
| `/suggest` | 建议下一步操作 | `@weapon /suggest` |
| `/generate` | 生成命令 | `@weapon /generate kerberoasting commands` |
| `/explain` | 解释概念 | `@weapon /explain what is AS-REP roasting` |
| `/report` | 显示任务摘要 | `@weapon /report` |

### 上下文工作原理

每次向 `@weapon` 发送请求时都会自动包含以下内容:

- **主机上下文**: 所有已知主机及其 IP 地址、别名和域控状态。当前主机会被标记。
- **用户上下文**: 所有已知凭据及其认证类型（密码、哈希或两者）。**实际密码和 NT 哈希值永远不会被包含** — LLM 只能看到凭据的存在。
- **引用内容**: 如果你在聊天中选择了文本或引用了文件，它们会作为附加上下文被包含。

这意味着你可以这样使用:

```
@weapon /suggest
```

AI 将了解你发现了哪些主机、攻陷了哪些用户以及当前目标是什么 — 无需你手动说明任务状态。

### 命令详情

**`/analyze`** — 粘贴或选择工具输出（nmap 扫描、BloodHound 查询等）并请求分析。AI 会识别关键发现、建议下一步操作并推荐相关命令。后续按钮："Suggest next steps"、"Generate commands"。

**`/suggest`** — 基于当前任务状态（主机、用户、发现），建议 3-5 个具体的下一步操作及精确命令。适合在卡住时使用，或确保没有遗漏任何攻击向量。后续按钮："Generate command"。

**`/generate`** — 以代码块形式输出命令，在可用时使用你的环境变量（`$TARGET`、`$RHOST`、`$USER` 等）。后续按钮："Explain command"。

**`/explain`** — 在渗透测试的上下文中解释安全概念、技术或工具。不需要任务状态 — 这是一个通用知识命令。

**`/report`** — **在本地运行，不调用 LLM。** 生成一个包含所有主机和凭据的 Markdown 表格，并高亮当前目标。适合快速检查状态而无需等待 AI 响应。

::: tip
当你接手一个任务或休息后回来时，可以先使用 `@weapon /suggest`。AI 会读取你整个工作区的状态并告诉你上次停在了哪里。
:::

### 凭据安全

`@weapon` participant 使用 `buildUserContext` 函数来构建已知用户的文本摘要 — 它列出用户名、登录域和认证类型，但**绝不包含实际密码或 NT 哈希值**。此外，`AIService.redactCredentials()` 会将所有可能发送给 LLM 的文本中的密码和哈希替换为 `[REDACTED]`。

## 内嵌 MCP 服务器

该扩展在 VS Code 扩展宿主进程内运行一个 **MCP (Model Context Protocol) HTTP 服务器**。外部 AI 客户端通过 HTTP 连接到该服务器，访问你的工作区数据并与终端交互。

### 设置

1. 打开命令面板并运行: `Weapon: Install MCP server to workspace`
2. 这将创建 `.vscode/mcp.json`:

```json
{
  "servers": {
    "weaponized": {
      "url": "http://127.0.0.1:25789/mcp"
    }
  }
}
```

3. VS Code 内置的 MCP 支持（及兼容的扩展）会自动发现此配置
4. 如果端口在会话之间发生变化，会自动更新

### 连接外部 AI 客户端

适用于支持 MCP 的 AI 工具（Claude Code、Cursor、Windsurf 等）:

**Claude Code:**
```bash
# Claude Code 会自动发现 .vscode/mcp.json
# 或在 ~/.claude/mcp_settings.json 中手动配置:
{
  "servers": {
    "weaponized": {
      "url": "http://127.0.0.1:25789/mcp"
    }
  }
}
```

**其他 MCP 客户端:**
将客户端指向 `http://127.0.0.1:25789/mcp`，使用 Streamable HTTP 传输方式。

::: warning
MCP 服务器绑定到 `127.0.0.1`（仅限本机）。无法从网络上的其他机器访问。端口默认为 `25789`，但可以通过 `weaponized.mcp.port` 设置更改。
:::

### 可用资源

资源提供对工作区状态的只读访问:

| 资源 URI | 描述 |
|-------------|-------------|
| `hosts://list` | 所有主机的 JSON 数据（主机名、IP、域控状态、别名） |
| `hosts://current` | 当前活动主机 |
| `users://list` | 所有用户的 JSON 数据（登录信息、用户名 — 不含密码） |
| `users://current` | 当前活动用户 |
| `graph://relationships` | 完整的 Foam 关系图（节点、边、攻击路径、Mermaid 图表） |
| `findings://list` | 所有发现记录 |

### 可用工具

13 个用于查询、创建和交互的工具:

**目标管理:**

| 工具 | 参数 | 描述 |
|------|-----------|-------------|
| `get_targets` | — | 获取所有主机 |
| `get_credentials` | — | 获取所有凭据 |
| `get_hosts_formatted` | `format`: env/hosts/yaml/table | 以指定格式导出主机 |
| `get_credentials_formatted` | `format`: env/impacket/nxc/yaml/table | 以指定格式导出凭据 |
| `get_graph` | — | 完整关系图及 Mermaid 图表 |

**发现管理:**

| 工具 | 参数 | 描述 |
|------|-----------|-------------|
| `list_findings` | `severity?`, `tags?`, `query?` | 列出发现记录，支持可选过滤器 |
| `get_finding` | `id` | 通过文件名获取特定发现记录 |
| `create_finding` | `title`, `severity`, `tags`, `description`, `references?` | 创建新的发现记录 |
| `update_finding_frontmatter` | `id`, `severity?`, `description?`, `custom?` | 更新发现记录的元数据 |

**终端交互:**

| 工具 | 参数 | 描述 |
|------|-----------|-------------|
| `list_terminals` | — | 列出所有打开的 VS Code 终端 |
| `read_terminal` | `terminalId`, `lines?` | 读取最近的输出（默认 50 行） |
| `send_to_terminal` | `terminalId`, `command` | 向终端发送命令 |
| `create_terminal` | `name?`, `profile?`, `cwd?` | 创建终端（配置文件：netcat、msfconsole、meterpreter、web-delivery、shell） |

### 可用提示

2 个 AI 客户端可调用的提示:

| 提示 | 描述 |
|--------|-------------|
| `analyze-output` | 分析工具输出，并注入当前目标上下文 |
| `suggest-next-steps` | 基于当前任务状态建议 3-5 个下一步操作 |

### 使用场景

**AI 辅助枚举:**
```
"Read the output of terminal 3 and analyze the nmap results.
 Create findings for any critical services you identify."
```

AI 客户端调用 `read_terminal` -> 解析输出 -> 为每个发现的漏洞调用 `create_finding`。

**自动化报告草拟:**
```
"List all findings with severity high or critical,
 then get the relationship graph and draft an executive summary."
```

AI 调用带有严重性过滤器的 `list_findings` -> `get_graph` 获取攻击路径 -> 综合生成摘要。

**终端编排:**
```
"Create a netcat handler terminal and send a scan command
 to the terminal running rustscan."
```

AI 调用 `create_terminal` 并使用 "netcat" 配置文件 -> `list_terminals` 查找 rustscan -> `send_to_terminal`。

::: tip
MCP 服务器为 AI 客户端提供的工作区访问权限与 CodeLens 和命令在编辑器中为你提供的相同。AI 可以读取目标、管理发现记录并与终端交互 — 但它不能直接修改主机或凭据笔记。这部分仍然由你来完成。
:::

## 配置

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `weaponized.ai.enabled` | boolean | `true` | 启用/禁用 @weapon 聊天和 MCP 服务器 |
| `weaponized.mcp.port` | integer | `25789` | MCP HTTP 服务器端口 |
