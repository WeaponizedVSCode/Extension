# AI Integration Architecture for WeaponizedVSCode

## Overview

This document describes the high-level architecture for adding AI capabilities to the WeaponizedVSCode extension. It covers three integration surfaces:

1. **VS Code Copilot Chat Participant** — in-editor AI assistant aware of pentest state
2. **MCP Server** — allows external AI tools (Claude Code, Cursor, etc.) to control the extension
3. **Local LLM Pipeline** — optional offline analysis for sensitive engagements

---

## Architecture Diagram

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

## Integration Surface 1: Copilot Chat Participant

**Purpose:** Let pentesters ask questions in natural language inside VS Code and get context-aware answers.

**API:** `vscode.chat.createChatParticipant("weapon", handler)`

**Capabilities:**
- Read `Context.HostState`, `Context.UserState`, Foam graph
- Parse and summarize terminal recorder logs
- Suggest next steps based on current engagement state
- Generate commands (nmap, ffuf, impacket) from natural language
- Explain BloodHound output, nmap results, etc.

**See:** `docs/02-COPILOT-CHAT-PARTICIPANT.md` for full implementation guide.

---

## Integration Surface 2: MCP Server

**Purpose:** Let external AI agents (Claude Code, Cursor, Windsurf, custom agents) read and control the extension's state programmatically.

**Protocol:** Model Context Protocol (MCP) over stdio or SSE transport.

**Capabilities:**
- **Resources:** current hosts, users, services, Foam notes, terminal logs
- **Tools:** run scanner, switch target, create finding, generate report, execute command
- **Prompts:** pre-built prompt templates for common pentest analysis tasks

**See:** `docs/03-MCP-SERVER-GUIDE.md` for full implementation guide.

---

## Integration Surface 3: Local LLM (Optional)

For air-gapped or highly sensitive engagements where cloud APIs are not acceptable:

- Use `ollama` or `llama.cpp` as a local inference backend
- The AI Service Layer abstracts the LLM provider (cloud or local)
- Same Chat Participant UI, different backend

This is a future enhancement; start with Copilot integration first.

---

## Shared AI Service Layer

To avoid duplicating logic between the Chat Participant and MCP Server, introduce a shared service:

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

### AIService Interface

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

## Data Flow with AI

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

## Security Considerations

### Credential Handling
- **Never** send plaintext passwords or NT hashes to cloud LLM providers
- The AI Service Layer must sanitize credentials before building prompt context
- MCP tools that expose credentials should require explicit user confirmation
- Consider a `weaponized.ai.redactCredentials` setting (default: `true`)

### Command Execution
- MCP tools that execute commands (`run_command`, `run_scanner`) must:
  - Show the command to the user before execution
  - Require explicit approval (VS Code has built-in MCP tool approval)
  - Log all AI-initiated commands to the terminal recorder

### Data Exfiltration
- Foam notes may contain sensitive engagement data
- The `search_notes` MCP tool should only return note titles/metadata by default
- Full note content should require a separate, explicit tool call

### Audit Trail
- All AI interactions should be logged to a separate `ai-actions.log`
- Include: timestamp, source (chat/mcp), action, parameters, result

---

## Implementation Priority

| Phase | What | Why | Effort |
|-------|------|-----|--------|
| 1 | Copilot Chat Participant | Highest user value, VS Code native | 2-3 days |
| 2 | MCP Server (read-only) | Enables AI IDEs, low risk | 2-3 days |
| 3 | MCP Server (tools) | Full AI automation | 3-5 days |
| 4 | Local LLM support | Air-gapped environments | 5-7 days |

Start with Phase 1 — it requires the least infrastructure and provides the most visible value.

---

## Related Documents

- `docs/02-COPILOT-CHAT-PARTICIPANT.md` — Detailed implementation guide
- `docs/03-MCP-SERVER-GUIDE.md` — MCP server implementation guide
- `docs/04-CODE-QUALITY.md` — Code issues to fix before AI integration
- `docs/05-TESTING-STRATEGY.md` — Testing plan including AI features
- `docs/06-FEATURE-ROADMAP.md` — Full feature roadmap
