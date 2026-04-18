# WeaponizedVSCode 的 AI 集成架构

## 概述

本文档描述了 WeaponizedVSCode 扩展的 AI 能力架构。涵盖两个集成层面:

1. **VS Code Copilot Chat Participant** -- 感知渗透测试状态的编辑器内 AI 助手
2. **MCP Server** -- 允许外部 AI 工具 (Claude Code, Cursor 等) 控制扩展

两个层面共享一个通用的 `AIService` 层，从扩展核心提供任务状态数据。

---

## 架构图

```
                           +--------------------------------------+
                           |         VS Code Extension Host       |
                           |                                      |
                           |  +--------------------------------+  |
                           |  |   WeaponizedVSCode Extension   |  |
                           |  |                                |  |
  +-------------------+    |  |  +------------+ +-----------+  |  |   +-------------------+
  |  Copilot Chat     |<---+--+  | Chat       | | AIService |  |  |   |  Claude Code /    |
  |  (VS Code UI)     |    |  |  | Participant| | (shared)  |  |  |   |  Cursor / other   |
  +-------------------+    |  |  |(@weapon)   | |           |  |  +-->|  AI IDE tools     |
                           |  |  +-----+------+ | hosts     |  |  |   +---------+---------+
                           |  |        |        | users     |  |  |             |
                           |  |        v        | currentH  |  |  |             |
                           |  |  +-----------+  | currentU  |  |  |       +-----v---------+
                           |  |  | Prompt    |  |           |  |  |       |  MCP Client   |
                           |  |  | Builders  |  +-----------+  |  |       |  (in AI tool) |
                           |  |  | system/   |                 |  |       +-----+---------+
                           |  |  | host/user |                 |  |             |
                           |  |  +-----------+                 |  |             | Streamable HTTP
                           |  |                                |  |             |
                           |  +--------------------------------+  |             |
                           |                                      |       +-----v---------+
                           |  +--------------------------------+  |       |  Embedded     |
                           |  | Embedded MCP HTTP Server       |<-+-------+  HTTP Server  |
                           |  | (http://127.0.0.1:{port}/mcp)  |  |       | 127.0.0.1     |
                           |  +--------------------------------+  |       +---------------+
                           +--------------------------------------+
```

---

## 集成层面 1: Copilot Chat Participant

**目标:** 让渗透测试人员在 VS Code 中使用自然语言提问，并获得上下文感知的回答。

**API:** `vscode.chat.createChatParticipant("weapon.chat", handler)`

**能力:**
- 通过 `AIService.getEngagementState()` 读取当前主机和用户状态
- 使用系统提示词、主机上下文和用户上下文构建结构化提示词
- 支持斜杠命令: `/analyze`、`/suggest`、`/generate`、`/explain`、`/report`
- 从自然语言生成渗透测试命令
- 分析工具输出并建议下一步操作
- 生成任务摘要报告 (主机表格、凭据表格)
- 根据上一个命令提供后续建议

**提示词架构:**
- `buildSystemPrompt()` -- 定义 AI 角色、环境、指南和输出格式
- `buildHostContext(hosts, currentHost)` -- 格式化已知主机和当前目标
- `buildUserContext(users, currentUser)` -- 格式化已知凭据 (永不包含实际密码/哈希)

**参见:** [docs/architecture/copilot-chat.md](copilot-chat.md) 获取完整的实现指南。

---

## 集成层面 2: MCP Server

**目标:** 允许外部 AI 代理 (Claude Code, Cursor, Windsurf, 自定义代理) 以编程方式读取和控制扩展的状态。

**协议:** Model Context Protocol (MCP)，通过 Streamable HTTP 传输，由绑定到 `127.0.0.1` 自动选择端口的内嵌 HTTP 服务器提供服务。端点为 `http://127.0.0.1:{port}/mcp`。

**实现:** `src/features/mcp/httpServer.ts` -- `EmbeddedMcpServer` 类为每个请求创建新的 `McpServer` + `StreamableHTTPServerTransport` (无状态模式)。

**资源:**
- `hosts://list` -- 所有已发现的主机
- `hosts://current` -- 当前活跃目标主机
- `users://list` -- 所有已发现的凭据
- `users://current` -- 当前活跃用户凭据
- `graph://relationships` -- 基于 Foam 的完整关系图
- `findings://list` -- 所有发现记录

**工具:**
- `get_targets` -- 获取所有已发现的主机
- `get_credentials` -- 获取所有已发现的凭据
- `get_hosts_formatted` -- 获取格式化的主机信息用于命令 (env, hosts, yaml, table)
- `get_credentials_formatted` -- 获取格式化的凭据用于渗透工具 (env, impacket, nxc, yaml, table)
- `get_graph` -- 获取完整关系图，包含节点、边和 Mermaid 图
- `list_findings` -- 按严重性、标签或全文搜索列出/筛选发现
- `get_finding` -- 按 ID 获取特定发现
- `create_finding` -- 创建带有 YAML frontmatter 的新发现记录
- `update_finding_frontmatter` -- 更新发现的 frontmatter 字段
- `list_terminals` -- 列出所有打开的 VS Code 终端
- `read_terminal` -- 读取终端的最近输出
- `send_to_terminal` -- 向终端发送命令
- `create_terminal` -- 创建新终端 (可选配置文件: netcat, msfconsole, meterpreter, web-delivery, shell)

**提示词:**
- `analyze-output` -- 分析工具输出并识别发现，包含当前目标上下文
- `suggest-next-steps` -- 根据当前主机和用户建议下一步渗透操作

**参见:** [docs/architecture/mcp-server.md](mcp-server.md) 获取完整的实现指南。

---

## 共享 AI 服务层

`src/features/ai/service.ts` 中的 `AIService` 类提供 Chat Participant 使用的共享逻辑。MCP 服务器直接从 `Context` 读取数据，但遵循相同的数据模型。

### 文件结构

```
src/
  features/
    ai/
      index.ts               -- registerAIFeatures(): 创建 chat participant
      service.ts             -- AIService 类: getEngagementState(), redactCredentials()
      participant.ts         -- Chat 处理器、斜杠命令、LLM 交互
      prompts/
        systemPrompt.ts      -- buildSystemPrompt(): AI 角色和指南
        hostContext.ts       -- buildHostContext(): 为提示词格式化主机数据
        userContext.ts       -- buildUserContext(): 为提示词格式化凭据数据
    mcp/
      httpServer.ts          -- EmbeddedMcpServer: HTTP 服务器、资源、工具、提示词
      install.ts             -- 为 AI IDE 客户端安装 MCP 配置
      portManager.ts         -- 端口选择工具
```

### AIService 接口

```typescript
// src/features/ai/service.ts

import { Host, UserCredential } from "../../core";
import { Context } from "../../platform/vscode/context";

export interface EngagementState {
  hosts: Host[];
  users: UserCredential[];
  currentHost: Host | undefined;
  currentUser: UserCredential | undefined;
}

export class AIService {
  /** 同步获取所有任务状态的快照，用于 LLM 上下文 */
  getEngagementState(): EngagementState {
    const hosts = Context.HostState ?? [];
    const users = Context.UserState ?? [];
    const currentHost = hosts.find((h) => h.is_current);
    const currentUser = users.find((u) => u.is_current);
    return { hosts, users, currentHost, currentUser };
  }

  /** 将已知的密码和 NT 哈希替换为 [REDACTED] */
  redactCredentials(text: string): string {
    // 遍历已知用户并替换敏感值
    // ...
  }
}
```

---

## 数据流

### Chat Participant 流程

```
用户输入 "@weapon /analyze 扫描输出内容"
  |
  +-> Chat Participant 接收请求
  |     |
  |     +-> aiService.getEngagementState()
  |     |     +-> 读取 Context.HostState, Context.UserState
  |     |
  |     +-> buildSystemPrompt()     -- AI 角色和指南
  |     +-> buildHostContext()       -- 已知主机、当前目标
  |     +-> buildUserContext()       -- 已知凭据 (已脱敏)
  |     +-> buildTaskPrompt()       -- 命令特定的任务指令
  |     |
  |     +-> vscode.lm.selectChatModels({ vendor: "copilot", family: "gpt-4o" })
  |     +-> model.sendRequest(messages, {}, token)
  |     |
  |     +-> 将响应流式传输回 Chat UI
  |
  v
用户看到包含上下文感知建议和后续操作的 AI 回复
```

### MCP 流程

```
外部 AI (Claude Code) 调用 MCP 工具 "get_targets"
  |
  +-> HTTP POST 到 http://127.0.0.1:{port}/mcp
  |     |
  |     +-> 创建新的 McpServer + StreamableHTTPServerTransport
  |     +-> 工具处理器直接读取 Context.HostState
  |     +-> 通过 MCP 协议返回 JSON 响应
  |     +-> 关闭 transport 和 server (无状态)
  |
  v
Claude Code 使用目标数据规划下一步操作
```

---

## 安全注意事项

### 凭据处理
- **绝不** 将明文密码或 NT 哈希发送给云端 LLM 提供者
- `buildUserContext()` 仅包含认证类型 (密码/NT 哈希/无)，永不包含实际密钥
- `AIService.redactCredentials()` 将已知密码和 NT 哈希替换为 `[REDACTED]`
- MCP `get_credentials` 工具返回完整凭据对象；AI IDE 内置的工具审批对话框提供用户控制

### 命令执行
- 执行命令的 MCP 工具 (`send_to_terminal`, `create_terminal`) 受 VS Code 内置 MCP 工具审批机制约束
- 用户必须在执行前明确批准工具调用
- 终端配置文件 (netcat, msfconsole 等) 使用预配置的处理器

### 审计追踪
- MCP 服务器通过扩展日志记录器记录请求和错误
- 所有通过 Copilot Chat 的 AI 交互在 VS Code 聊天历史中可见

---

## 相关文档

- [docs/architecture/copilot-chat.md](copilot-chat.md) -- Copilot Chat Participant 实现指南
- [docs/architecture/mcp-server.md](mcp-server.md) -- MCP 服务器实现指南
- [docs/architecture/code-quality.md](code-quality.md) -- 代码质量说明
- [docs/architecture/testing-strategy.md](testing-strategy.md) -- 包含 AI 功能的测试计划
- [docs/architecture/feature-roadmap.md](feature-roadmap.md) -- 完整功能路线图
