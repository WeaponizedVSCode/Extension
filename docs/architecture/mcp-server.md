# MCP Server Guide

## Overview

The extension embeds an MCP (Model Context Protocol) server that runs **inside the VS Code extension host** as a Node.js `http.Server`. It is not a separate process — it shares the same runtime and reads state directly from the `Context` singleton.

Any MCP-compatible AI tool (Claude Code, Cursor, Windsurf, Continue, etc.) can connect via a single HTTP endpoint to read engagement state, interact with terminals, and manage findings.

---

## Transport & Lifecycle

- **Protocol**: Streamable HTTP via `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk` (v1.29+)
- **Endpoint**: `POST /mcp` — all other paths return 404
- **Stateless**: `sessionIdGenerator: undefined` — each request gets a fresh `McpServer` + transport instance. No session persistence between requests.
- **Binding**: `127.0.0.1` only — never exposed to the network
- **Port**: tries `weaponized.mcp.port` (default `25789`), falls back to an OS-assigned port if occupied
- **Gate**: the entire MCP + AI subsystem is controlled by `weaponized.ai.enabled` (default `true`)

All extension state lives in the `Context` singleton (HostState, UserState, etc.), so the per-request stateless model works without data loss.

---

## Client Configuration

The `weapon.mcp.install` command writes `.vscode/mcp.json`:

```json
{
  "servers": {
    "weaponized": {
      "url": "http://127.0.0.1:<port>/mcp"
    }
  }
}
```

This is a **URL-based entry** (Streamable HTTP), not a command+args entry (stdio). On every activation, `autoUpdateMcpJson()` silently patches the port if the entry already exists.

For external clients (Claude Code, Cursor), point them at `http://127.0.0.1:<port>/mcp`.

---

## Registered Tools (13)

### State Query Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `get_targets` | — | All discovered hosts as JSON |
| `get_credentials` | — | All discovered credentials as JSON (full data including passwords/hashes) |
| `get_hosts_formatted` | `format`: env / hosts / yaml / table | Hosts formatted for direct use in pentest tools |
| `get_credentials_formatted` | `format`: env / impacket / nxc / yaml / table | Credentials formatted for specific tool input |
| `get_graph` | — | Relationship graph with attack paths and Mermaid diagram |

### Finding Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_findings` | `severity?`, `tags?[]`, `query?` | List, search, and filter findings |
| `get_finding` | `id` | Get a specific finding by ID |
| `create_finding` | `title`, `severity?`, `tags?[]`, `description?`, `references?` | Create a new finding note |
| `update_finding_frontmatter` | `id`, `severity?`, `description?`, `props?` | Update finding YAML frontmatter |

### Terminal Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_terminals` | — | List all open VS Code terminals |
| `read_terminal` | `terminalId`, `lines?` | Read recent terminal output |
| `send_to_terminal` | `terminalId`, `command` | Send a command to a terminal |
| `create_terminal` | `profile?`, `name?`, `cwd?` | Create a terminal, optionally with a profile (netcat / msfconsole / meterpreter / web-delivery) |

Terminal tools depend on the `TerminalBridge` class, which requires **VS Code Shell Integration** for output capture. `send_to_terminal` and `create_terminal` work without it; `read_terminal` does not.

---

## Registered Resources (6)

| Resource | URI | Content |
|----------|-----|---------|
| `hosts-list` | `hosts://list` | All hosts array |
| `hosts-current` | `hosts://current` | Current target host |
| `users-list` | `users://list` | All credentials array |
| `users-current` | `users://current` | Current user |
| `graph-relationships` | `graph://relationships` | Full relationship graph |
| `findings-list` | `findings://list` | All parsed findings |

---

## Registered Prompts (2)

| Prompt | Parameters | Purpose |
|--------|-----------|---------|
| `analyze-output` | `output` (required) | Analyze tool output in the context of the current engagement |
| `suggest-next-steps` | — | Suggest next pentest actions based on current state |

---

## Security

| Concern | Approach |
|---------|----------|
| Credential exposure | `get_credentials` returns full data; the MCP client handles user approval before tool execution |
| Terminal commands | User sees all commands in the VS Code terminal UI; MCP clients prompt before side-effecting tools |
| Network exposure | Bound to `127.0.0.1` — not reachable from other machines |
| Feature gating | `weaponized.ai.enabled` disables the entire MCP + AI subsystem |

---

## Adding a New Tool

Register in `EmbeddedMcpServer.registerTools()` inside `src/features/mcp/httpServer.ts`:

1. Call `server.tool(name, description, zodSchema, handler)`
2. Read state from `Context` (hosts, users, findings) or `TerminalBridge` (terminals)
3. Return `{ content: [{ type: "text", text: ... }] }`

No separate process, state bridge, or file-based IPC is needed — the server runs in the same process as the extension.
