# Getting Started

## What is Weaponized VSCode?

Weaponized VSCode is a VS Code extension that transforms your editor into an **Integrated Development & Attack Environment (ID&AE)** for penetration testing and red team operations.

The core problem it solves: **tool and information fragmentation**. In a typical pentest workflow, you constantly switch between terminals, note apps, browsers, text editors, and proxy tools. This context switching wastes time, creates information silos, and makes it hard to reproduce or audit your work.

Weaponized VSCode unifies everything into a single workspace:

- **Notes are your database** — YAML blocks inside Markdown files define hosts, credentials, and findings. Edit a note, and your terminal environment updates automatically.
- **Commands live in your notes** — Shell, HTTP, and PowerShell code blocks become executable via CodeLens buttons directly in the editor.
- **Tools are integrated** — msfvenom, hashcat, rustscan, and custom scanners launch from the Command Palette with auto-populated parameters.
- **Knowledge is embedded** — GTFOBins, LOLBAS, and BloodHound snippets appear as you type.
- **AI understands your context** — the `@weapon` Copilot Chat participant and embedded MCP server give AI assistants full awareness of your targets and findings.

### Design Principles

1. **Workspace as Project** — Each pentest engagement maps to one VS Code workspace. Open the folder, and the entire environment (targets, credentials, env vars, history) is restored.
2. **Note-Driven Workflow** — "Write the note, run the engagement." Every host, user, service, and finding is a structured Markdown note that drives automation.
3. **Context-Aware Automation** — Set the current host/user once; all commands, tasks, and terminal profiles automatically use the correct parameters.
4. **Extensible Toolchain** — The extension doesn't replace your tools — it orchestrates them. Add custom scanners, terminal commands, and wordlist paths through settings.
5. **Embedded Knowledge Base** — Security knowledge (GTFOBins, LOLBAS, BloodHound) is available as snippets and definitions without leaving the editor.

## Prerequisites

### Required

- **Visual Studio Code** 1.96.0 or later
- **Foam** extension (`foam.foam-vscode`) — provides wiki-links, graph visualization, and note templates

### Recommended

These tools are used by specific features. The extension works without them, but the corresponding commands will have no effect.

| Tool | Used By | Notes |
|------|---------|-------|
| `metasploit-framework` | Payload generation, meterpreter handler, msfconsole terminal | `msfvenom` and `msfconsole` binaries |
| `hashcat` | Hash cracking task | GPU recommended |
| `rustscan` | Default scanner | Other scanners configurable |
| `simplehttpserver` | Web delivery terminal | Or any HTTP server with PUT upload |
| `rlwrap` | Netcat handler terminal | Adds readline support to netcat |
| `zsh` | Shell helpers in `.vscode/.zshrc` | Kali Linux default |

> **Kali Linux** includes most of these tools out of the box. On macOS, consider using [OrbStack](https://orbstack.dev/) for a Linux environment.

### Recommended Extensions

After setup, VS Code will suggest installing recommended extensions. The most important ones:

- `foam.foam-vscode` — Knowledge graph and wiki-links (required)
- `redhat.vscode-yaml` — YAML validation for host/credential blocks
- `ms-vscode-remote.remote-ssh` — Remote development on target machines

## Installation

### From VSIX

1. Download the `.vsix` file from the [Releases page](https://github.com/WeaponizedVSCode/Extension/releases)
2. In VS Code, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **Extensions: Install from VSIX...** and select the downloaded file

### From Marketplace

Search for **Weaponized** in the VS Code Extensions sidebar and install `Esonhugh.weaponized`.

## Setting Up Your First Workspace

### Step 1: Create a Project Folder

Create a directory for your engagement:

```bash
mkdir -p ~/workspace/hackthebox/target.htb
code ~/workspace/hackthebox/target.htb
```

### Step 2: Initialize the Workspace

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

```
Weapon: Setup/Create/Init weaponized vscode folder in current workspace
```

This creates the following structure:

```
your-project/
├── .foam/
│   └── templates/          # Note templates (host, user, service, finding)
├── .vscode/
│   ├── .zshrc              # Shell helpers (venv, history, utility functions)
│   ├── extensions.json     # Recommended extensions list
│   ├── msfconsole.rc       # Metasploit resource file template
│   └── settings.json       # Pre-configured extension settings
├── hosts/                  # Host notes (created as you go)
├── users/                  # User notes (created as you go)
├── services/               # Service notes (created as you go)
└── findings/               # Finding notes (created as you go)
```

### Step 3: Configure Your Environment

Open `.vscode/settings.json` and set your attacker parameters:

```json
{
  "weaponized.lhost": "10.10.14.5",
  "weaponized.lport": 4444,
  "weaponized.listenon": 8080
}
```

These values populate the `$LHOST`, `$LPORT`, and `$LISTEN_ON` environment variables in every new terminal.

### Step 4: Shell Helper Setup

After initialization, the extension checks whether your `~/.zshrc` contains the `weapon_vscode_launch_helper` function. If missing, it will:

1. Open your `~/.zshrc` for editing
2. Copy the helper function to your clipboard

Paste it and reload your shell. This helper auto-sources the project's `.vscode/.zshrc` when you open terminals in the workspace, giving you access to utility functions like `differ()`, `ntlm()`, `url()`, and `proxys()`.

### Step 5: Create Your First Host

Open the Command Palette and run:

```
Weapon: Create/New note (user/host/service/finding/report) from template
```

Select **host**, enter the target hostname (e.g., `target`), and a new note is created at `hosts/target/target.md` with a pre-filled YAML host block:

````markdown
```yaml host
- hostname: target
  is_dc: false
  ip: 10.10.10.10
  alias: ["target"]
```
````

Edit the IP address, save the file, and you're ready to go. Open a new terminal — the environment variables `$TARGET`, `$RHOST`, and `$IP` are automatically set.

## Workspace Tour

### Command Palette Commands

All extension commands are available via the Command Palette (`Ctrl+Shift+P`). They are prefixed with **Weapon:**

| Command | What It Does |
|---------|-------------|
| `Weapon: Setup` | Initialize workspace structure |
| `Weapon: Switch current host` | Set the active host from your notes |
| `Weapon: Switch current user` | Set the active user from your notes |
| `Weapon: Dump all hosts` | Export hosts in env/hosts/yaml/table format |
| `Weapon: Dump all user credentials` | Export users in env/impacket/nxc/yaml/table format |
| `Weapon: Create msfvenom payload` | Interactive payload builder |
| `Weapon: Crack hashes with hashcat` | Interactive hashcat launcher |
| `Weapon: Run scanner over target` | Launch configurable scanners |
| `Weapon: Decode selected text` | Open selected text in CyberChef |
| `Weapon: Start terminal logger` | Begin recording terminal activity |
| `Weapon: Stop terminal logger` | Stop recording |
| `Weapon: Create note` | Create host/user/service/finding/report note |
| `Weapon: Install MCP server` | Write `.vscode/mcp.json` for AI client integration |

### CodeLens Actions

When editing Markdown files under `hosts/`, `users/`, or `services/`, you'll see clickable actions above code blocks:

- **`yaml host` blocks**: "set as current" / "export to terminal" / "Scan host"
- **`yaml credentials` blocks**: "set as current" / "dump as impacket" / "dump as nxc"
- **`zsh`/`bash`/`sh`/`powershell` blocks**: "Run command in terminal" / "Copy commands"
- **`http` blocks**: "Send HTTP Request" / "Send HTTPS Request" / "Copy in curl"

### Terminal Profiles

Create specialized terminals from the Terminal dropdown (`+` button):

- **meterpreter handler** — starts multi/handler listener
- **msfconsole** — launches msfconsole with your RC file
- **netcat handler** — rlwrap + netcat listener with reverse shell cheatsheet
- **web delivery** — HTTP server for file transfer with download/upload commands

## Next Steps

- [Host & Credential Management](./host-management.md) — Deep dive into target management
- [Offensive Workflows](./offensive-workflows.md) — CodeLens, HTTP repeater, tasks
- [Notes & Reports](./notes-and-reports.md) — Foam integration and report generation
- [Terminal Tools](./terminal-tools.md) — Terminal profiles and recording
- [AI & MCP Integration](./ai-and-mcp.md) — AI chat and external AI client setup
- [Tips & Recipes](./tips-and-recipes.md) — Configuration reference and practical workflows

---

::: info Migrating from v0.4.x?
If you previously used the shell-based Weaponized VSCode (with `weapon_vscode`, `set_current_host`, `dump_hosts` shell commands), see the [migration table](./tips-and-recipes.md#migrating-from-v04x) in Tips & Recipes. The core workflow is the same — notes still drive everything — but all shell commands are now native VS Code extension commands.
:::
