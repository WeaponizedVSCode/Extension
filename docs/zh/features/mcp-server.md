# MCP 服务器

嵌入式 HTTP 服务器，通过模型上下文协议（Model Context Protocol）向外部 AI 客户端暴露扩展状态。

## 概述

MCP 服务器作为嵌入式 HTTP 服务器运行在 VS Code 扩展宿主进程内部。它使用 `@modelcontextprotocol/sdk` 提供的 `StreamableHTTPServerTransport` 通过 HTTP 处理 MCP 请求（非 stdio 或 SSE）。服务器以无状态模式运行——每个传入请求创建一个全新的 `McpServer` 实例，处理完毕后立即销毁。

状态直接从进程内的 `Context` 单例读取，终端交互通过启动时传入的 `TerminalBridge` 实例完成。不存在基于文件的 IPC。

## 安装

在命令面板中运行：

```
weapon mcp: Install MCP server config
```

此命令会在工作区根目录写入 `.vscode/mcp.json` 文件，包含服务器 URL：

```json
{
  "servers": {
    "weaponized": {
      "url": "http://127.0.0.1:25789/mcp"
    }
  }
}
```

后续每次扩展激活时，如果 `mcp.json` 中已存在服务器条目，扩展会自动更新端口号。

## 配置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `weaponized.ai.enabled` | `false` | 控制 MCP 服务器启停——必须为 `true` 才会启动服务器 |
| `weaponized.mcp.port` | `25789` | 首选端口；如果被占用，则由操作系统分配随机可用端口 |

## 架构

```
AI 客户端 (Claude Code, Cursor 等)
        │
        │  POST /mcp  (StreamableHTTP)
        ▼
┌─────────────────────────────────┐
│  EmbeddedMcpServer              │
│  http.Server on 127.0.0.1:port  │
│                                 │
│  每个请求:                       │
│    McpServer + Transport        │
│    → 注册工具/资源               │
│    → 处理请求                    │
│    → 关闭 transport 和 server   │
│                                 │
│  数据来源:                       │
│    Context 单例 (进程内)         │
│    TerminalBridge (进程内)       │
│    Foam 图 (进程内)              │
└─────────────────────────────────┘
```

## 端点

- **方法**: `POST`
- **路径**: `/mcp`
- **绑定地址**: `127.0.0.1`（仅本地）

所有其他路径返回 `404`。

## 工具 (13)

| 工具 | 说明 |
|------|------|
| `get_targets` | 获取所有发现的主机/目标 |
| `get_credentials` | 获取所有发现的凭证 |
| `get_hosts_formatted` | 以指定格式获取主机（`env`、`hosts`、`yaml`、`table`） |
| `get_credentials_formatted` | 以渗透工具格式获取凭证（`env`、`impacket`、`nxc`、`yaml`、`table`） |
| `get_graph` | 获取完整关系图——节点、边、攻击路径和 Mermaid 图 |
| `list_findings` | 列出或搜索发现，支持按严重程度、标签和自由文本过滤 |
| `get_finding` | 按 ID 获取特定发现 |
| `create_finding` | 创建新的发现笔记，含 YAML 前言元数据 |
| `update_finding_frontmatter` | 更新发现笔记的严重程度、描述或自定义字段 |
| `list_terminals` | 列出所有打开的 VS Code 终端 |
| `read_terminal` | 读取终端的最近输出（最后 N 行） |
| `send_to_terminal` | 向终端发送命令 |
| `create_terminal` | 创建新终端，可选配置文件（`netcat`、`msfconsole`、`meterpreter`、`web-delivery`、`shell`） |

## 资源 (6)

| 资源 | URI | 说明 |
|------|-----|------|
| 主机列表 | `hosts://list` | 所有发现的主机（JSON） |
| 当前主机 | `hosts://current` | 当前活动目标 |
| 用户列表 | `users://list` | 所有发现的凭证（JSON） |
| 当前用户 | `users://current` | 当前活动凭证 |
| 关系图 | `graph://relationships` | 从 Foam 构建的关系图 |
| 发现列表 | `findings://list` | 工作区中所有发现笔记 |

## 提示模板 (2)

| 模板 | 说明 |
|------|------|
| `analyze-output` | 根据当前目标分析工具输出，建议发现、后续步骤和命令 |
| `suggest-next-steps` | 根据当前主机和凭证状态，建议接下来 3-5 个渗透操作及具体命令 |

## 端口管理

`portManager.ts` 中的 `findAvailablePort` 辅助函数通过在 `127.0.0.1` 上尝试临时 `net.createServer` 绑定来探测首选端口。如果端口被占用，返回 `0` 让操作系统分配随机可用端口。实际监听端口在 `httpServer.listen()` 完成后确定。

## 兼容客户端

任何支持 Streamable HTTP 传输的 MCP 兼容 AI 客户端：Claude Code、VS Code Copilot Chat、Cursor、Windsurf 等。

## 关键文件

- `src/features/mcp/httpServer.ts` -- `EmbeddedMcpServer` 类：HTTP 服务器、工具/资源/提示注册
- `src/features/mcp/install.ts` -- 安装命令及 `.vscode/mcp.json` 自动更新逻辑
- `src/features/mcp/portManager.ts` -- 端口可用性检查与回退
