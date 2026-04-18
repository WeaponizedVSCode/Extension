# MCP Server

Embedded HTTP server that exposes extension state to external AI clients via the Model Context Protocol.

## Overview

The MCP server runs as an embedded HTTP server inside the VS Code extension host process. It uses `StreamableHTTPServerTransport` from the `@modelcontextprotocol/sdk` to handle MCP requests over HTTP (not stdio or SSE). The server operates in stateless mode -- each incoming request creates a fresh `McpServer` instance, processes it, then tears down.

State is read directly from the in-process `Context` singleton, and terminal interaction goes through the `TerminalBridge` instance passed at startup. There is no file-based IPC.

## Installation

Run from the Command Palette:

```
weapon mcp: Install MCP server config
```

This writes a `.vscode/mcp.json` file in the workspace root containing the server URL:

```json
{
  "servers": {
    "weaponized": {
      "url": "http://127.0.0.1:25789/mcp"
    }
  }
}
```

On subsequent activations the extension auto-updates the port in `mcp.json` if the server entry already exists.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `weaponized.ai.enabled` | `false` | Gates the MCP server -- must be `true` for the server to start |
| `weaponized.mcp.port` | `25789` | Preferred port; if occupied, the OS assigns a random available port |

## Architecture

```
AI Client (Claude Code, Cursor, etc.)
        │
        │  POST /mcp  (StreamableHTTP)
        ▼
┌─────────────────────────────────┐
│  EmbeddedMcpServer              │
│  http.Server on 127.0.0.1:port  │
│                                 │
│  Per-request:                   │
│    McpServer + Transport        │
│    → register tools/resources   │
│    → handle request             │
│    → close transport & server   │
│                                 │
│  Reads from:                    │
│    Context singleton (in-proc)  │
│    TerminalBridge (in-proc)     │
│    Foam graph (in-proc)         │
└─────────────────────────────────┘
```

## Endpoint

- **Method**: `POST`
- **Path**: `/mcp`
- **Bind address**: `127.0.0.1` (localhost only)

All other paths return `404`.

## Tools (13)

| Tool | Description |
|------|-------------|
| `get_targets` | Get all discovered hosts/targets |
| `get_credentials` | Get all discovered credentials |
| `get_hosts_formatted` | Get hosts in a specific format (`env`, `hosts`, `yaml`, `table`) |
| `get_credentials_formatted` | Get credentials formatted for pentest tools (`env`, `impacket`, `nxc`, `yaml`, `table`) |
| `get_graph` | Get the full relationship graph -- nodes, edges, attack paths, and Mermaid diagram |
| `list_findings` | List or search findings with optional severity, tag, and free-text filters |
| `get_finding` | Get a specific finding by ID |
| `create_finding` | Create a new finding note with YAML frontmatter |
| `update_finding_frontmatter` | Update severity, description, or custom fields on a finding note |
| `list_terminals` | List all open VS Code terminals |
| `read_terminal` | Read recent output from a terminal (last N lines) |
| `send_to_terminal` | Send a command to a terminal |
| `create_terminal` | Create a new terminal, optionally with a profile (`netcat`, `msfconsole`, `meterpreter`, `web-delivery`, `shell`) |

## Resources (6)

| Resource | URI | Description |
|----------|-----|-------------|
| Hosts list | `hosts://list` | All discovered hosts as JSON |
| Current host | `hosts://current` | Currently active target |
| Users list | `users://list` | All discovered credentials as JSON |
| Current user | `users://current` | Currently active credential |
| Graph | `graph://relationships` | Relationship graph built from Foam |
| Findings list | `findings://list` | All finding notes in the workspace |

## Prompt Templates (2)

| Template | Description |
|----------|-------------|
| `analyze-output` | Analyze tool output against current targets and suggest findings, next steps, and commands |
| `suggest-next-steps` | Suggest the next 3-5 pentest actions with exact commands based on current hosts and credentials |

## Port Management

The `findAvailablePort` helper in `portManager.ts` probes the preferred port by attempting a temporary `net.createServer` bind on `127.0.0.1`. If the port is occupied, it returns `0` so the OS assigns a random available port. The actual listening port is resolved after `httpServer.listen()` completes.

## Compatible Clients

Any MCP-compatible AI client that supports Streamable HTTP transport: Claude Code, VS Code Copilot Chat, Cursor, Windsurf, etc.

## Key Files

- `src/features/mcp/httpServer.ts` -- `EmbeddedMcpServer` class: HTTP server, tool/resource/prompt registration
- `src/features/mcp/install.ts` -- Install command and auto-update logic for `.vscode/mcp.json`
- `src/features/mcp/portManager.ts` -- Port availability check and fallback
