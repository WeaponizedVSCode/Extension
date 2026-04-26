# AI & MCP Integration

Weaponized VSCode provides two complementary AI integration points:

1. **`@weapon` Chat Participant** — A Copilot Chat assistant that understands your pentest context
2. **Embedded MCP Server** — An HTTP API that lets external AI clients (Claude Code, Cursor, etc.) interact with your workspace

Both features are controlled by the `weaponized.ai.enabled` setting (default: `true`).

## @weapon Chat Participant

The `@weapon` chat participant integrates with GitHub Copilot Chat to provide pentest-aware AI assistance. It has full read access to your hosts, credentials, and findings — but **never sends actual passwords or hashes to the LLM**.

### Getting Started

1. Install the [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension
2. Open the Copilot Chat panel (`Ctrl+Shift+I` / `Cmd+Shift+I`)
3. Type `@weapon` followed by your question or a slash command

### Slash Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `/analyze` | Analyze tool output | `@weapon /analyze` (with terminal output selected) |
| `/suggest` | Suggest next steps | `@weapon /suggest` |
| `/generate` | Generate commands | `@weapon /generate kerberoasting commands` |
| `/explain` | Explain a concept | `@weapon /explain what is AS-REP roasting` |
| `/report` | Show engagement summary | `@weapon /report` |

### How Context Works

Every request to `@weapon` automatically includes:

- **Host context**: All known hosts with their IPs, aliases, and DC status. The current host is marked.
- **User context**: All known credentials with authentication type (password, hash, or both). **Actual passwords and NT hashes are never included** — the LLM only sees that credentials exist.
- **Referenced content**: If you select text or reference files in the chat, they're included as additional context.

This means you can ask:

```
@weapon /suggest
```

And the AI will know which hosts you've found, which users you've compromised, and what your current target is — without you having to explain the engagement state.

### Command Details

**`/analyze`** — Paste or select tool output (nmap scan, BloodHound query, etc.) and ask for analysis. The AI identifies key findings, suggests next steps, and recommends relevant commands. Follow-up buttons: "Suggest next steps", "Generate commands".

**`/suggest`** — Based on the current engagement state (hosts, users, findings), suggests 3-5 concrete next actions with exact commands. Great for when you're stuck or want to make sure you haven't missed an attack vector. Follow-up: "Generate command".

**`/generate`** — Outputs commands in fenced code blocks, using your environment variables (`$TARGET`, `$RHOST`, `$USER`, etc.) when available. Follow-up: "Explain command".

**`/explain`** — Explains security concepts, techniques, or tools in the context of penetration testing. No engagement state needed — this is a general knowledge command.

**`/report`** — **Runs locally, no LLM call.** Generates a markdown table of all hosts and credentials with the current target highlighted. Useful for a quick status check without waiting for AI response.

::: tip
Start with `@weapon /suggest` when you take over an engagement or return after a break. The AI reads your entire workspace state and tells you where you left off.
:::

### Credential Safety

The `@weapon` participant uses a `buildUserContext` function that constructs a text summary of known users — it lists usernames, login domains, and auth types, but **never includes the actual password or NT hash values**. Additionally, `AIService.redactCredentials()` replaces any passwords and hashes with `[REDACTED]` in any text that might be sent to the LLM.

## Embedded MCP Server

The extension runs an **MCP (Model Context Protocol) HTTP server** inside the VS Code extension host process. External AI clients connect to it over HTTP to access your workspace data and interact with terminals.

### Setup

1. Open the Command Palette and run: `Weapon: Install MCP server to workspace`
2. If `weaponized.mcp.cli` is not set, you'll be prompted to select your AI client:
   - **VSCode** — writes `.vscode/mcp.json`
   - **Claude Code** — writes `.mcp.json`
   - **Codex (OpenAI)** — writes `.codex/config.toml`
   - **Gemini CLI** — writes `.gemini/settings.json`
   - **OpenCode** — writes `.opencode.json`
3. Your choice is saved to workspace settings (`weaponized.mcp.cli`), so subsequent runs skip the picker
4. The port auto-updates on each activation if the config file exists

### Config Examples Per Client

**VSCode** (`.vscode/mcp.json`):
```json
{
  "servers": {
    "weaponized": {
      "url": "http://127.0.0.1:25789/mcp"
    }
  }
}
```

**Claude Code** (`.mcp.json`):
```json
{
  "mcpServers": {
    "weaponized": {
      "type": "url",
      "url": "http://127.0.0.1:25789/mcp"
    }
  }
}
```

**Codex** (`.codex/config.toml`):
```toml
[mcp_servers.weaponized]
url = "http://127.0.0.1:25789/mcp"
```

**Gemini CLI** (`.gemini/settings.json`):
```json
{
  "mcpServers": {
    "weaponized": {
      "httpUrl": "http://127.0.0.1:25789/mcp"
    }
  }
}
```

**OpenCode** (`.opencode.json`):
```json
{
  "mcpServers": {
    "weaponized": {
      "type": "sse",
      "url": "http://127.0.0.1:25789/mcp"
    }
  }
}
```

::: tip
To switch to a different AI client, change `weaponized.mcp.cli` in your workspace settings and re-run the install command.
:::

::: warning
The MCP server binds to `127.0.0.1` (localhost only). It is not accessible from other machines on the network. The port defaults to `25789` but can be changed via `weaponized.mcp.port` setting.
:::

### Available Resources

Resources provide read-only access to workspace state:

| Resource URI | Description |
|-------------|-------------|
| `hosts://list` | All hosts as JSON (hostname, IP, DC status, aliases) |
| `hosts://current` | Current active host |
| `users://list` | All users as JSON (login, username — no passwords) |
| `users://current` | Current active user |
| `graph://relationships` | Full Foam relationship graph (nodes, edges, attack paths, Mermaid diagram) |
| `findings://list` | All finding notes |

### Available Tools

13 tools for querying, creating, and interacting:

**Target Management:**

| Tool | Parameters | Description |
|------|-----------|-------------|
| `get_targets` | — | Get all hosts |
| `get_credentials` | — | Get all credentials |
| `get_hosts_formatted` | `format`: env/hosts/yaml/table | Export hosts in a specific format |
| `get_credentials_formatted` | `format`: env/impacket/nxc/yaml/table | Export credentials in a specific format |
| `get_graph` | — | Full relationship graph with Mermaid diagram |

**Finding Management:**

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_findings` | `severity?`, `tags?`, `query?` | List findings with optional filters |
| `get_finding` | `id` | Get a specific finding by filename |
| `create_finding` | `title`, `severity`, `tags`, `description`, `references?` | Create a new finding note |
| `update_finding_frontmatter` | `id`, `severity?`, `description?`, `custom?` | Update finding metadata |

**Terminal Interaction:**

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_terminals` | — | List all open VS Code terminals |
| `read_terminal` | `terminalId`, `lines?` | Read recent output (default 50 lines) |
| `send_to_terminal` | `terminalId`, `command` | Send a command to a terminal |
| `create_terminal` | `name?`, `profile?`, `cwd?` | Create a terminal (profiles: netcat, msfconsole, meterpreter, web-delivery, shell) |

### Available Prompts

2 prompts that AI clients can invoke:

| Prompt | Description |
|--------|-------------|
| `analyze-output` | Analyzes tool output with current target context injected |
| `suggest-next-steps` | Suggests 3-5 next actions based on current engagement state |

### Use Cases

**AI-assisted enumeration:**
```
"Read the output of terminal 3 and analyze the nmap results.
 Create findings for any critical services you identify."
```

The AI client calls `read_terminal` → parses the output → calls `create_finding` for each discovered vulnerability.

**Automated report drafting:**
```
"List all findings with severity high or critical,
 then get the relationship graph and draft an executive summary."
```

The AI calls `list_findings` with severity filter → `get_graph` for attack path → synthesizes a summary.

**Terminal orchestration:**
```
"Create a netcat handler terminal and send a scan command
 to the terminal running rustscan."
```

The AI calls `create_terminal` with profile "netcat" → `list_terminals` to find rustscan → `send_to_terminal`.

::: tip
The MCP server gives AI clients the same workspace access that CodeLens and commands provide to you in the editor. The AI can read targets, manage findings, and interact with terminals — but it cannot modify host or credential notes directly. That's still your job.
:::

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `weaponized.ai.enabled` | boolean | `true` | Enable/disable both @weapon chat and MCP server |
| `weaponized.mcp.port` | integer | `25789` | MCP HTTP server port |
| `weaponized.mcp.cli` | string | `""` | Target AI CLI tool (`vscode`, `claude`, `codex`, `gemini`, `opencode`). Empty = prompt on first install |
