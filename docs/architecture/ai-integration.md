# AI Integration Architecture for WeaponizedVSCode

## Overview

This document describes the architecture for AI capabilities in the WeaponizedVSCode extension. It covers two integration surfaces:

1. **VS Code Copilot Chat Participant** -- in-editor AI assistant aware of pentest state
2. **MCP Server** -- allows external AI tools (Claude Code, Cursor, etc.) to control the extension

Both surfaces share a common `AIService` layer that provides engagement state from the extension core.

---

## Architecture Diagram

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

## Integration Surface 1: Copilot Chat Participant

**Purpose:** Let pentesters ask questions in natural language inside VS Code and get context-aware answers.

**API:** `vscode.chat.createChatParticipant("weapon.chat", handler)`

**Capabilities:**
- Read current host and user state via `AIService.getEngagementState()`
- Build structured prompt context with system prompt, host context, and user context
- Support slash commands: `/analyze`, `/suggest`, `/generate`, `/explain`, `/report`
- Generate pentest commands from natural language
- Analyze tool output and suggest next steps
- Produce an engagement summary report (hosts table, credentials table)
- Provide follow-up suggestions based on the last command

**Prompt Architecture:**
- `buildSystemPrompt()` -- defines the AI role, environment, guidelines, and output format
- `buildHostContext(hosts, currentHost)` -- formats known hosts and the active target
- `buildUserContext(users, currentUser)` -- formats known credentials (never includes actual passwords/hashes)

**See:** [docs/architecture/copilot-chat.md](copilot-chat.md) for the full implementation guide.

---

## Integration Surface 2: MCP Server

**Purpose:** Let external AI agents (Claude Code, Cursor, Windsurf, custom agents) read and control the extension's state programmatically.

**Protocol:** Model Context Protocol (MCP) over Streamable HTTP transport, served by an embedded HTTP server bound to `127.0.0.1` on an auto-selected port. The endpoint is `http://127.0.0.1:{port}/mcp`.

**Implementation:** `src/features/mcp/httpServer.ts` -- the `EmbeddedMcpServer` class creates a fresh `McpServer` + `StreamableHTTPServerTransport` per request (stateless mode).

**Resources:**
- `hosts://list` -- all discovered hosts
- `hosts://current` -- the active target host
- `users://list` -- all discovered credentials
- `users://current` -- the active user credential
- `graph://relationships` -- full Foam-based relationship graph
- `findings://list` -- all finding notes

**Tools:**
- `get_targets` -- get all discovered hosts
- `get_credentials` -- get all discovered credentials
- `get_hosts_formatted` -- hosts formatted for commands (env, hosts, yaml, table)
- `get_credentials_formatted` -- credentials formatted for tools (env, impacket, nxc, yaml, table)
- `get_graph` -- full relationship graph with nodes, edges, and Mermaid diagram
- `list_findings` -- list/filter findings by severity, tags, or free-text query
- `get_finding` -- get a specific finding by ID
- `create_finding` -- create a new finding note with YAML frontmatter
- `update_finding_frontmatter` -- update a finding's frontmatter fields
- `list_terminals` -- list all open VS Code terminals
- `read_terminal` -- read recent output from a terminal
- `send_to_terminal` -- send a command to a terminal
- `create_terminal` -- create a new terminal (optionally with a profile: netcat, msfconsole, meterpreter, web-delivery, shell)

**Prompts:**
- `analyze-output` -- analyze tool output and identify findings, with current target context
- `suggest-next-steps` -- suggest next pentest actions based on current hosts and users

**See:** [docs/architecture/mcp-server.md](mcp-server.md) for the full implementation guide.

---

## Shared AI Service Layer

The `AIService` class in `src/features/ai/service.ts` provides shared logic used by the Chat Participant. The MCP server reads from `Context` directly but follows the same data model.

### File Structure

```
src/
  features/
    ai/
      index.ts               -- registerAIFeatures(): creates chat participant
      service.ts             -- AIService class: getEngagementState(), redactCredentials()
      participant.ts         -- Chat handler, slash commands, LLM interaction
      prompts/
        systemPrompt.ts      -- buildSystemPrompt(): AI role and guidelines
        hostContext.ts       -- buildHostContext(): formats host data for prompts
        userContext.ts       -- buildUserContext(): formats credential data for prompts
    mcp/
      httpServer.ts          -- EmbeddedMcpServer: HTTP server, resources, tools, prompts
      install.ts             -- MCP configuration installer for AI IDE clients
      portManager.ts         -- Port selection utility
```

### AIService Interface

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
  /** Synchronous snapshot of all engagement state for LLM context */
  getEngagementState(): EngagementState {
    const hosts = Context.HostState ?? [];
    const users = Context.UserState ?? [];
    const currentHost = hosts.find((h) => h.is_current);
    const currentUser = users.find((u) => u.is_current);
    return { hosts, users, currentHost, currentUser };
  }

  /** Replace known passwords and NT hashes with [REDACTED] */
  redactCredentials(text: string): string {
    // Iterates over known users and replaces sensitive values
    // ...
  }
}
```

---

## Data Flow

### Chat Participant Flow

```
User types "@weapon /analyze scan output here"
  |
  +-> Chat Participant receives request
  |     |
  |     +-> aiService.getEngagementState()
  |     |     +-> Reads Context.HostState, Context.UserState
  |     |
  |     +-> buildSystemPrompt()     -- AI role and guidelines
  |     +-> buildHostContext()       -- known hosts, active target
  |     +-> buildUserContext()       -- known credentials (redacted)
  |     +-> buildTaskPrompt()       -- command-specific task instructions
  |     |
  |     +-> vscode.lm.selectChatModels({ vendor: "copilot", family: "gpt-4o" })
  |     +-> model.sendRequest(messages, {}, token)
  |     |
  |     +-> Streams response back to Chat UI
  |
  v
User sees AI response with context-aware suggestions + follow-ups
```

### MCP Flow

```
External AI (Claude Code) calls MCP tool "get_targets"
  |
  +-> HTTP POST to http://127.0.0.1:{port}/mcp
  |     |
  |     +-> Fresh McpServer + StreamableHTTPServerTransport created
  |     +-> Tool handler reads Context.HostState directly
  |     +-> Returns JSON response via MCP protocol
  |     +-> Transport and server closed (stateless)
  |
  v
Claude Code uses target data to plan next actions
```

---

## Security Considerations

### Credential Handling
- **Never** send plaintext passwords or NT hashes to cloud LLM providers
- `buildUserContext()` only includes authentication type (password/NT hash/none), never actual secrets
- `AIService.redactCredentials()` replaces known passwords and NT hashes with `[REDACTED]`
- MCP `get_credentials` tool returns full credential objects; the AI IDE's built-in tool approval dialog provides user control

### Command Execution
- MCP tools that execute commands (`send_to_terminal`, `create_terminal`) are subject to VS Code's built-in MCP tool approval mechanism
- Users must explicitly approve tool calls before execution
- Terminal profiles (netcat, msfconsole, etc.) use pre-configured handlers

### Audit Trail
- The MCP server logs requests and errors via the extension logger
- All AI interactions through Copilot Chat are visible in the VS Code chat history

---

## Related Documents

- [docs/architecture/copilot-chat.md](copilot-chat.md) -- Copilot Chat Participant implementation guide
- [docs/architecture/mcp-server.md](mcp-server.md) -- MCP server implementation guide
- [docs/architecture/code-quality.md](code-quality.md) -- Code quality notes
- [docs/architecture/testing-strategy.md](testing-strategy.md) -- Testing plan including AI features
- [docs/architecture/feature-roadmap.md](feature-roadmap.md) -- Full feature roadmap
