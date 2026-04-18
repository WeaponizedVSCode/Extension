# MCP 服务器指南

## 概述

扩展内嵌了一个 MCP（Model Context Protocol）服务器，作为 Node.js `http.Server` **运行在 VS Code 扩展宿主内部**。它不是独立进程 — 与扩展共享同一运行时，直接从 `Context` 单例读取状态。

任何兼容 MCP 的 AI 工具（Claude Code、Cursor、Windsurf、Continue 等）都可以通过单一 HTTP 端点连接，读取渗透测试状态、与终端交互并管理发现。

---

## 传输协议与生命周期

- **协议**：通过 `StreamableHTTPServerTransport`（来自 `@modelcontextprotocol/sdk` v1.29+）实现 Streamable HTTP
- **端点**：`POST /mcp` — 所有其他路径返回 404
- **无状态**：`sessionIdGenerator: undefined` — 每个请求获得全新的 `McpServer` + transport 实例。请求之间无会话持久化。
- **绑定**：仅 `127.0.0.1` — 不暴露到网络
- **端口**：尝试 `weaponized.mcp.port`（默认 `25789`），如被占用则回退到操作系统分配的端口
- **门控**：整个 MCP + AI 子系统由 `weaponized.ai.enabled`（默认 `true`）控制

所有扩展状态存储在 `Context` 单例（HostState、UserState 等）中，因此每请求无状态模型不会导致数据丢失。

---

## 客户端配置

`weapon.mcp.install` 命令写入 `.vscode/mcp.json`：

```json
{
  "servers": {
    "weaponized": {
      "url": "http://127.0.0.1:<port>/mcp"
    }
  }
}
```

这是 **URL 条目**（Streamable HTTP），而非 command+args 条目（stdio）。每次激活时，`autoUpdateMcpJson()` 会静默修补端口（如果条目已存在）。

对于外部客户端（Claude Code、Cursor），将其指向 `http://127.0.0.1:<port>/mcp`。

---

## 注册的工具（共 13 个）

### 状态查询工具

| 工具 | 参数 | 描述 |
|------|------|------|
| `get_targets` | — | 所有已发现主机的 JSON |
| `get_credentials` | — | 所有已发现凭证的 JSON（完整数据，包含密码/哈希） |
| `get_hosts_formatted` | `format`: env / hosts / yaml / table | 格式化的主机数据，可直接用于渗透测试工具 |
| `get_credentials_formatted` | `format`: env / impacket / nxc / yaml / table | 格式化的凭证，适配特定工具输入 |
| `get_graph` | — | 关系图，含攻击路径和 Mermaid 图 |

### 发现管理工具

| 工具 | 参数 | 描述 |
|------|------|------|
| `list_findings` | `severity?`、`tags?[]`、`query?` | 列出、搜索和过滤发现 |
| `get_finding` | `id` | 按 ID 获取特定发现 |
| `create_finding` | `title`、`severity?`、`tags?[]`、`description?`、`references?` | 创建新的发现笔记 |
| `update_finding_frontmatter` | `id`、`severity?`、`description?`、`props?` | 更新发现的 YAML frontmatter |

### 终端工具

| 工具 | 参数 | 描述 |
|------|------|------|
| `list_terminals` | — | 列出所有打开的 VS Code 终端 |
| `read_terminal` | `terminalId`、`lines?` | 读取终端最近的输出 |
| `send_to_terminal` | `terminalId`、`command` | 向终端发送命令 |
| `create_terminal` | `profile?`、`name?`、`cwd?` | 创建终端，可选配置（netcat / msfconsole / meterpreter / web-delivery） |

终端工具依赖 `TerminalBridge` 类，该类需要 **VS Code Shell Integration** 才能捕获输出。`send_to_terminal` 和 `create_terminal` 不受此限制；`read_terminal` 需要。

---

## 注册的资源（共 6 个）

| 资源 | URI | 内容 |
|------|-----|------|
| `hosts-list` | `hosts://list` | 所有主机数组 |
| `hosts-current` | `hosts://current` | 当前目标主机 |
| `users-list` | `users://list` | 所有凭证数组 |
| `users-current` | `users://current` | 当前用户 |
| `graph-relationships` | `graph://relationships` | 完整关系图 |
| `findings-list` | `findings://list` | 所有已解析的发现 |

---

## 注册的提示词（共 2 个）

| 提示词 | 参数 | 用途 |
|--------|------|------|
| `analyze-output` | `output`（必需） | 在当前渗透环境上下文中分析工具输出 |
| `suggest-next-steps` | — | 基于当前状态建议下一步渗透测试操作 |

---

## 安全性

| 关注点 | 处理方式 |
|--------|---------|
| 凭证暴露 | `get_credentials` 返回完整数据；MCP 客户端在执行工具前处理用户审批 |
| 终端命令 | 用户在 VS Code 终端 UI 中可见所有命令；MCP 客户端在执行有副作用的工具前提示确认 |
| 网络暴露 | 绑定到 `127.0.0.1` — 其他机器无法访问 |
| 功能门控 | `weaponized.ai.enabled` 可禁用整个 MCP + AI 子系统 |

---

## 添加新工具

在 `src/features/mcp/httpServer.ts` 的 `EmbeddedMcpServer.registerTools()` 中注册：

1. 调用 `server.tool(name, description, zodSchema, handler)`
2. 从 `Context`（主机、用户、发现）或 `TerminalBridge`（终端）读取状态
3. 返回 `{ content: [{ type: "text", text: ... }] }`

无需独立进程、状态桥接或基于文件的 IPC — 服务器与扩展运行在同一进程中。
