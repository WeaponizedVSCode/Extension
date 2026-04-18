# Terminal Recorder

Capture terminal commands and output to log files for engagement documentation.

## Prerequisites

Requires VS Code **Shell Integration** in Rich mode. Add to your shell profile:

**Zsh** (`.zshrc`):
```bash
[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path zsh)"
```

**Bash** (`.bashrc`):
```bash
[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path bash)"
```

## Commands

| Command | ID | Description |
|---------|-----|-------------|
| Start/Register terminal logger | `weaponized.terminal-logger.register` | Begin recording |
| Stop/Unregister terminal logger | `weaponized.terminal-logger.unregister` | Stop recording |

## Configuration

When starting, you choose:

1. **Log file path**: Default `${workspaceFolder}/.vscode/.terminal.log`
2. **Log level**:
   - `command-only` — Log commands only
   - `output-only` — Log output only
   - `command-and-output` — Log both
   - `netcat-handler` — Specialized mode for netcat sessions
3. **Terminal selection**: Specific terminal PIDs or all terminals

## Auto-enable

```json
{
  "weaponized.terminal-log.enabled": true,
  "weaponized.terminal-log.path": "${workspaceFolder}/.vscode/.terminal.log",
  "weaponized.terminal-log.level": "command-and-output"
}
```

## Log Format

```
weaponized-terminal-logging:[1701234567890][terminalid: 12345][terminalName: zsh] user@/home/kali/project$ nmap -sS 10.10.10.100
```

## Key Files

- `src/features/terminal/recorder/index.ts` — Start/stop logic
- `src/features/terminal/recorder/record_append.ts` — Capture listeners
- `src/features/terminal/recorder/store.ts` — Capture registry
- `src/features/terminal/recorder/mode.ts` — Mode definitions
