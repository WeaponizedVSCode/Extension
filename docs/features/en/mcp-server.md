# MCP Server

Model Context Protocol server that exposes extension state to external AI clients.

## Overview

The MCP server is a standalone Node.js process that communicates via stdio. It reads extension state from the `.weapon-state/` directory (file-based IPC) and provides tools, resources, and prompt templates for AI-assisted penetration testing.

## Installation

Run from Command Palette:

```
weapon mcp: Install MCP server config
```

This writes `.vscode/mcp.json` pointing to the bundled server. Reload your AI client to connect.

## Tools

| Tool | Description |
|------|-------------|
| `list_terminals` | List all open VS Code terminals |
| `read_terminal` | Read recent output from a terminal (last N lines) |
| `send_to_terminal` | Send a command to a terminal |
| `get_targets` | Get all discovered hosts/targets |
| `get_credentials` | Get all discovered credentials |

## Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Hosts list | `hosts://list` | All discovered hosts |
| Current host | `hosts://current` | Currently active target |
| Users list | `users://list` | All discovered credentials |
| Current user | `users://current` | Currently active credential |
| Environment | `env://variables` | Exported environment variables |

## Prompt Templates

| Template | Description |
|----------|-------------|
| `analyze-output` | Analyze tool output with current target context |
| `suggest-next-steps` | Suggest next pentest actions |

## Architecture

```
Extension Host                .weapon-state/              MCP Server (Node.js)
──────────────                ──────────────              ──────────────────────
Track terminals  ──write──►  terminals.json       ◄──read──  list_terminals
Capture output   ──write──►  terminals/{id}.log   ◄──read──  read_terminal
Watch for cmds   ◄──read───  terminal-input.json  ──write──  send_to_terminal
Sync hosts       ──write──►  hosts.json           ◄──read──  get_targets
Sync users       ──write──►  users.json           ◄──read──  get_credentials
```

## Compatible Clients

Any MCP-compatible AI client: Claude Code, Cursor, Windsurf, etc.

## Key Files

- `src/mcp/server.ts` — MCP server with resources, tools, and prompts
- `src/mcp/bridge.ts` — StateBridge that reads `.weapon-state/` files
- `src/features/mcp/install.ts` — MCP config installer command
- `webpack.config.mcp.js` — Separate webpack build for MCP server
