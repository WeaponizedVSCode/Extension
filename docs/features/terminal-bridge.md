# Terminal Bridge

Bidirectional file-based IPC layer that bridges VS Code terminals with the MCP server.

## Architecture

```
Extension Host                .weapon-state/              MCP Server (Node.js)
──────────────                ──────────────              ──────────────────────
Track terminals  ──write──►  terminals.json       ◄──read──  list_terminals
Capture output   ──write──►  terminals/{id}.log   ◄──read──  read_terminal
Watch for cmds   ◄──read───  terminal-input.json  ──write──  send_to_terminal
```

## How It Works

The `TerminalBridge` class activates per workspace folder and:

1. **Tracks all open terminals** — Assigns numeric IDs, writes metadata to `terminals.json`
2. **Captures command output** — Uses VS Code Shell Integration API (`onDidStartTerminalShellExecution` + `execution.read()`) to stream output into per-terminal `.log` files
3. **Watches for input commands** — Monitors `terminal-input.json` for command requests from the MCP server, dispatches them to the target terminal via `terminal.sendText()`
4. **Manages output size** — Caps each log file at 64KB (keeps tail)
5. **Periodic flush** — Buffers output and flushes every 500ms to reduce I/O

## State Files

| File | Content |
|------|---------|
| `.weapon-state/terminals.json` | Array of `{id, name, isActive, cwd}` |
| `.weapon-state/terminals/{id}.log` | Rolling output log per terminal |
| `.weapon-state/terminal-input.json` | `{terminalId, command}` — consumed on read |

## Terminal Lookup

Commands can target terminals by numeric ID or by name.

## Key Files

- `src/features/terminal/bridge.ts` — TerminalBridge implementation
- `src/features/terminal/index.ts` — Bridge activation
