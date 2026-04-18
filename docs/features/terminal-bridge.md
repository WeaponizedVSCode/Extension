# Terminal Bridge

In-memory bridge that gives the MCP server direct access to VS Code terminals. The MCP server calls `TerminalBridge` methods over the in-process API — there is no file-based IPC.

## Architecture

```
MCP Server (in-process)         TerminalBridge (in-memory)         VS Code Terminal API
─────────────────────           ──────────────────────────         ────────────────────
list_terminals       ──call──►  getTerminals()          ──read──►  terminalMap (Map)
read_terminal        ──call──►  getTerminalOutput(id)   ──read──►  disk log / buffer
send_to_terminal     ──call──►  sendCommandDirect(id)   ──call──►  terminal.sendText()
create_terminal      ──call──►  createTerminal(opts)    ──call──►  window.createTerminal()
```

All state lives in memory. The only disk I/O is periodic flushing of output logs.

## Class: `TerminalBridge`

**Source**: `src/features/terminal/bridge.ts`

Constructed with `context.storageUri` as its root directory. On `activate()`:

1. Creates `{storageUri}/terminals/` for log files.
2. Assigns a sequential integer ID (starting at 1) to every existing terminal and stores the mapping in an in-memory `Map<vscode.Terminal, string>`.
3. Subscribes to `onDidOpenTerminal` and `onDidCloseTerminal` to keep the map current.
4. Subscribes to `onDidStartTerminalShellExecution` (Shell Integration API) to capture command output.
5. Starts a 500ms interval timer that flushes buffered output to disk.

## Terminal Tracking

Each terminal gets a sequential string ID (`"1"`, `"2"`, ...) assigned when it is first seen. The mapping is stored in `terminalMap: Map<vscode.Terminal, string>`.

On terminal close (`onDidCloseTerminal`), the bridge:
- Removes the terminal from the map
- Deletes its in-memory output buffer
- Deletes its log file from disk

## Output Capture

Requires **VS Code Shell Integration** to be active in the terminal. When a shell execution starts:

1. The bridge receives `onDidStartTerminalShellExecution` with the command line and an async output stream.
2. It prepends `$ <command>\n` to the buffer, then reads chunks from `execution.read()` and appends them.
3. Every 500ms, all dirty buffers are flushed to `{storageUri}/terminals/{id}.log`.
4. Each log file is capped at **64KB**. When a write would exceed that limit, the content is truncated from the front (oldest output is dropped).

Without Shell Integration enabled, output capture does not work. The `send_to_terminal` and `create_terminal` tools still function normally.

## API Exposed to MCP

The MCP server registers four tools that call bridge methods directly:

### `list_terminals`

Calls `bridge.getTerminals()`. Returns an array of:

```json
{ "id": "1", "name": "bash", "isActive": true, "cwd": "/home/user" }
```

`cwd` is only available when Shell Integration is active (read from `terminal.shellIntegration.cwd`).

### `read_terminal`

Calls `bridge.getTerminalOutput(terminalId, lines)`. Reads the log file from disk, returns the last N lines (default 50). Accepts a numeric ID or a terminal name — if the ID does not match a log file directly, the bridge looks up the terminal by name and resolves to its numeric ID.

### `send_to_terminal`

Calls `bridge.sendCommandDirect(terminalId, command)`. Finds the terminal by ID or name, then calls `terminal.sendText(command)` and brings the terminal to the foreground. Works regardless of Shell Integration.

### `create_terminal`

Calls `bridge.createTerminal({ profile?, name?, cwd? })`. Two modes:

- **Profile-based**: Pass `profile` as one of `netcat`, `msfconsole`, `meterpreter`, `web-delivery`. The bridge looks up the registered `TerminalProfileProvider`, calls `provideTerminalProfile()` to get the terminal options, and creates the terminal with those settings.
- **Plain shell**: Omit `profile` (or pass `"shell"`). Creates a basic terminal with an optional custom name and working directory.

Returns `{ id, name }` of the newly created terminal.

## Profile Providers

During activation (`registerMcpBridge` in `src/features/terminal/index.ts`), the following profile providers are registered with the bridge:

| Profile key    | Provider                                  | Purpose                  |
|----------------|-------------------------------------------|--------------------------|
| `netcat`       | `NetcatWeaponizedTerminalProvider`        | Reverse shell listener   |
| `msfconsole`   | `MsfconsoleWeaponizedTerminalProvider`    | Metasploit console       |
| `meterpreter`  | `MeterpreterWeaponizedTerminalProvider`   | Meterpreter handler      |
| `web-delivery` | `WebDeliveryWeaponizedTerminalProvider`   | HTTP file server         |

## Terminal Lookup

Both `sendCommandDirect` and `getTerminalOutput` accept either a numeric ID string or a terminal name. The bridge first tries an exact ID match against the map, then falls back to matching by `terminal.name`.

## Lifecycle

- **Activation**: Called from `registerMcpBridge()` in `src/features/terminal/index.ts`, which passes `context.storageUri` and sets profile providers.
- **Disposal**: Clears the flush timer, performs a final flush of all pending buffers, and disposes event subscriptions.

## Key Files

- `src/features/terminal/bridge.ts` — `TerminalBridge` class
- `src/features/terminal/index.ts` — Bridge activation and profile provider registration
- `src/features/terminal/profiles.ts` — Terminal profile providers (netcat, msfconsole, etc.)
- `src/features/mcp/httpServer.ts` — MCP tool definitions that call bridge methods
