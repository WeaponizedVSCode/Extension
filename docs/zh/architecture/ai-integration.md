# WeaponizedVSCode 的 AI 集成架构

## 概述

本文档描述了为 WeaponizedVSCode 扩展添加 AI 能力的高层架构。涵盖三个集成层面:

1. **VS Code Copilot Chat Participant** -- 感知渗透测试状态的编辑器内 AI 助手
2. **MCP Server** -- 允许外部 AI 工具 (Claude Code, Cursor 等) 控制扩展
3. **本地 LLM 管道** -- 适用于敏感任务的可选离线分析方案

---

## 架构图

```
                           ┌──────────────────────────────────────┐
                           │         VS Code Extension Host       │
                           │                                      │
                           │  ┌────────────────────────────────┐  │
                           │  │   WeaponizedVSCode Extension   │  │
                           │  │                                │  │
  ┌───────────────────┐    │  │  ┌──────────┐  ┌───────────┐  │  │   ┌───────────────────┐
  │  Copilot Chat     │◄───┼──┤  │ Chat      │  │ Extension │  │  │   │  Claude Code /    │
  │  (VS Code UI)     │    │  │  │ Participant│  │ Core      │  │  │   │  Cursor / other   │
  └───────────────────┘    │  │  │ (@weapon) │  │           │  │  ├──►│  AI IDE tools     │
                           │  │  └─────┬─────┘  │ Context   │  │  │   └─────────┬─────────┘
                           │  │        │        │ Host/User │  │  │             │
                           │  │        ▼        │ Foam      │  │  │             │
                           │  │  ┌──────────┐   │ Env Vars  │  │  │       ┌─────▼─────────┐
                           │  │  │ AI        │   │ Terminal  │  │  │       │  MCP Client   │
                           │  │  │ Service   │◄─►│ Recorder  │  │  │       │  (in AI tool) │
                           │  │  │ Layer     │   │ Reports   │  │  │       └─────┬─────────┘
                           │  │  └──────────┘   └───────────┘  │  │             │
                           │  │        │                       │  │             │ stdio/SSE
                           │  │        ▼                       │  │             │
                           │  │  ┌──────────┐                  │  │       ┌─────▼─────────┐
                           │  │  │ MCP      │◄─────────────────┼──┼───────│  MCP Server   │
                           │  │  │ Server   │                  │  │       │  (stdio)      │
                           │  │  └──────────┘                  │  │       └───────────────┘
                           │  └────────────────────────────────┘  │
                           └──────────────────────────────────────┘
```

---

## 集成层面 1: Copilot Chat Participant

**目标:** 让渗透测试人员在 VS Code 中使用自然语言提问，并获得上下文感知的回答。

**API:** `vscode.chat.createChatParticipant("weapon", handler)`

**能力:**
- 读取 `Context.HostState`、`Context.UserState`、Foam 图谱
- 解析和汇总终端记录日志
- 根据当前任务状态建议下一步操作
- 从自然语言生成命令 (nmap, ffuf, impacket)
- 解释 BloodHound 输出、nmap 结果等

**参见:** `docs/02-COPILOT-CHAT-PARTICIPANT.md` 获取完整的实现指南。

---

## 集成层面 2: MCP Server

**目标:** 允许外部 AI 代理 (Claude Code, Cursor, Windsurf, 自定义代理) 以编程方式读取和控制扩展的状态。

**协议:** Model Context Protocol (MCP)，通过 stdio 或 SSE 传输。

**能力:**
- **资源:** 当前主机、用户、服务、Foam 笔记、终端日志
- **工具:** 运行扫描器、切换目标、创建发现、生成报告、执行命令
- **提示词:** 用于常见渗透测试分析任务的预构建提示词模板

**参见:** `docs/03-MCP-SERVER-GUIDE.md` 获取完整的实现指南。

---

## 集成层面 3: 本地 LLM (可选)

适用于不允许使用云端 API 的隔离网络或高度敏感的任务:

- 使用 `ollama` 或 `llama.cpp` 作为本地推理后端
- AI Service Layer 对 LLM 提供者进行抽象 (云端或本地)
- 使用相同的 Chat Participant UI，不同的后端

这是一项未来增强功能；请先从 Copilot 集成开始。

---

## 共享 AI 服务层

为避免在 Chat Participant 和 MCP Server 之间重复逻辑，引入一个共享服务:

```
src/
  features/
    ai/
      service.ts           -- AIService class: shared logic
      participant.ts       -- Copilot Chat Participant (uses AIService)
      mcp/
        server.ts          -- MCP server entry point
        tools.ts           -- MCP tool definitions
        resources.ts       -- MCP resource definitions
        prompts.ts         -- MCP prompt templates
```

### AIService 接口

```typescript
// src/features/ai/service.ts

import { Context } from "../../platform/vscode/context";
import type { Host, UserCredential, Foam, Resource } from "../../core";

export interface EngagementState {
  hosts: Host[];
  users: UserCredential[];
  currentHost: Host | undefined;
  currentUser: UserCredential | undefined;
  foamNotes: Resource[];
  environmentVariables: Record<string, string>;
}

export interface TerminalLogEntry {
  timestamp: string;
  terminalName: string;
  command: string;
  output?: string;
}

export class AIService {
  /** Snapshot of all engagement state for LLM context */
  async getEngagementState(): Promise<EngagementState> {
    const hosts = Context.HostState ?? [];
    const users = Context.UserState ?? [];
    const foam = await new Context().Foam();
    const foamNotes = foam?.workspace.list() ?? [];

    return {
      hosts,
      users,
      currentHost: hosts.find(h => h.is_current),
      currentUser: users.find(u => u.is_current),
      foamNotes,
      environmentVariables: this.collectEnvVars(hosts, users),
    };
  }

  /** Parse terminal log file into structured entries */
  async getTerminalLogs(logPath: string): Promise<TerminalLogEntry[]> {
    // Parse the weaponized-terminal-logging format
    // ...
  }

  /** Build a context string suitable for LLM prompts */
  async buildPromptContext(): Promise<string> {
    const state = await this.getEngagementState();
    const lines: string[] = [];

    lines.push("## Current Engagement State\n");

    if (state.currentHost) {
      lines.push(`**Current Target:** ${state.currentHost.hostname} (${state.currentHost.ip})`);
    }
    if (state.currentUser) {
      lines.push(`**Current User:** ${state.currentUser.login || state.currentUser.user}`);
    }

    lines.push(`\n**Known Hosts:** ${state.hosts.length}`);
    lines.push(`**Known Users:** ${state.users.length}`);
    lines.push(`**Foam Notes:** ${state.foamNotes.length}`);

    return lines.join("\n");
  }

  private collectEnvVars(
    hosts: Host[],
    users: UserCredential[]
  ): Record<string, string> {
    // Merge all exported env vars
    // ...
    return {};
  }
}
```

---

## AI 数据流

```
User types "@weapon analyze this nmap output"
  │
  ├─► Chat Participant receives request
  │     │
  │     ├─► AIService.getEngagementState()
  │     │     └─► Reads Context.HostState, UserState, Foam
  │     │
  │     ├─► AIService.buildPromptContext()
  │     │     └─► Formats state into LLM-friendly text
  │     │
  │     ├─► Sends to Copilot LLM with context + user query
  │     │
  │     └─► Streams response back to Chat UI
  │
  ▼
User sees AI response with host-aware suggestions


External AI (Claude Code) calls MCP tool "get_targets"
  │
  ├─► MCP Server receives tool call
  │     │
  │     ├─► AIService.getEngagementState()
  │     │     └─► Same shared logic
  │     │
  │     └─► Returns JSON response via MCP protocol
  │
  ▼
Claude Code uses target data to plan next actions
```

---

## 安全注意事项

### 凭据处理
- **绝不** 将明文密码或 NT 哈希发送给云端 LLM 提供者
- AI Service Layer 在构建提示词上下文之前必须对凭据进行脱敏处理
- 暴露凭据的 MCP 工具应要求用户明确确认
- 考虑添加 `weaponized.ai.redactCredentials` 设置项 (默认: `true`)

### 命令执行
- 执行命令的 MCP 工具 (`run_command`, `run_scanner`) 必须:
  - 在执行前向用户显示命令内容
  - 要求明确批准 (VS Code 内置了 MCP 工具审批机制)
  - 将所有 AI 发起的命令记录到终端记录器

### 数据泄露防护
- Foam 笔记可能包含敏感的任务数据
- `search_notes` MCP 工具默认应仅返回笔记标题/元数据
- 获取完整笔记内容应需要单独的、明确的工具调用

### 审计追踪
- 所有 AI 交互应记录到单独的 `ai-actions.log` 文件中
- 包含: 时间戳、来源 (chat/mcp)、操作、参数、结果

---

## 实现优先级

| 阶段 | 内容 | 原因 | 工作量 |
|------|------|------|--------|
| 1 | Copilot Chat Participant | 用户价值最高，VS Code 原生支持 | 2-3 天 |
| 2 | MCP Server (只读) | 支持 AI IDE，风险低 | 2-3 天 |
| 3 | MCP Server (工具) | 完整的 AI 自动化 | 3-5 天 |
| 4 | 本地 LLM 支持 | 隔离网络环境 | 5-7 天 |

从阶段 1 开始 -- 它所需的基础设施最少，且提供最明显的价值。

---

## 相关文档

- `docs/02-COPILOT-CHAT-PARTICIPANT.md` -- 详细实现指南
- `docs/03-MCP-SERVER-GUIDE.md` -- MCP 服务器实现指南
- `docs/04-CODE-QUALITY.md` -- AI 集成前需修复的代码问题
- `docs/05-TESTING-STRATEGY.md` -- 包含 AI 功能的测试计划
- `docs/06-FEATURE-ROADMAP.md` -- 完整功能路线图
