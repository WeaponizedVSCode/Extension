# Architecture Overview

## Prerequisites & Installation

### Required Dependencies

- **VS Code** >= 1.101.0
- **Foam extension** (`foam.foam-vscode`) — the knowledge management backbone. The extension checks for Foam on activation and will not function without it.
- **Shell Integration** — VS Code's shell integration must be active in terminals for the `TerminalBridge` to capture output. This is enabled by default in modern VS Code but can be disabled by user settings.

### Optional Tool Dependencies

These external tools are invoked via terminal, not bundled:

| Tool | Used By | Purpose |
|------|---------|---------|
| `msfvenom` / `msfconsole` | Payload generation, terminal profiles | Metasploit framework |
| `hashcat` | Password cracking task | Hash cracking |
| `rustscan`, `nuclei`, `dirsearch`, `feroxbuster`, `ffuf`, `wfuzz` | Network scanning | Configurable scanner commands |
| `rlwrap`, `netcat` | Terminal profiles | Reverse shell handlers |

---

## Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      app/                               │
│           Composition Root & Bootstrap                  │
│    activate.ts · registerCommands.ts · registerCodeLens │
├─────────────────────────────────────────────────────────┤
│                   features/                             │
│              Vertical Feature Slices                    │
│  ai · mcp · targets · shell · http · terminal · ...    │
├──────────────────────┬──────────────────────────────────┤
│   platform/vscode/   │           core/                  │
│  VS Code Abstraction │     Pure Domain Logic            │
│  Context · Logger    │  domain · markdown · env         │
│  Variables           │  (zero vscode imports)           │
├──────────────────────┴──────────────────────────────────┤
│                    shared/                              │
│              Cross-cutting Utilities                    │
│                 types · globs                           │
└─────────────────────────────────────────────────────────┘
```

### Dependency Rules

| Layer | May Import From | Must NOT Import From |
|-------|----------------|---------------------|
| `app/` | All layers | — |
| `features/*` | `core/`, `platform/`, `shared/` | Other features |
| `platform/vscode/` | `core/`, `shared/`, `vscode` API | `features/` |
| `core/` | `shared/` only | `vscode`, `platform/`, `features/` |
| `shared/` | Nothing (leaf) | Everything else |

The critical boundary: **`core/` has zero VS Code imports**. All domain logic is pure TypeScript, making it testable without the VS Code runtime.

---

## Workspace Design

### `weapon.setup` — Scaffolding

The `weapon.setup` command creates **only** the `.vscode/` configuration directory:

```
<workspace>/
  .vscode/
    .zshrc              # Shell environment: venv activation, history, helper functions
    extensions.json     # Recommended VS Code extensions
    msfcnosole.rc       # Metasploit console resource file
    settings.json       # Weaponized extension default settings
```

These 4 template files are embedded in the extension via base64 encoding. The Python script `scripts/gen-setup.py` reads `resources/setup-template/.vscode/*` and generates `src/features/setup/assets.ts` containing a TypeScript map of `{ path: atob(content) }`. Setup only writes files that don't already exist — it never overwrites.

After file creation, `weapon.setup` checks the user's `~/.zshrc` for the `weapon_vscode_launch_helper` function. If not found, it copies the helper to clipboard and opens `~/.zshrc` for manual pasting. This helper sources `.vscode/.zshrc` when VS Code terminals open, enabling venv activation, proxy settings, and utility functions.

### Workspace Directory Convention

After using the extension, a typical workspace looks like:

```
<workspace>/
  .vscode/                          # Extension config (created by weapon.setup)
    .zshrc
    settings.json
    mcp.json                        # MCP server config (created by weapon.mcp.install)
  hosts/
    <hostname>/
      <hostname>.md                 # Host notes with ```yaml host blocks
  users/
    <username>/
      <username>.md                 # User notes with ```yaml credentials blocks
  services/
    <servicename>/
      <servicename>.md              # Service notes
  findings/
    <findingname>/
      <findingname>.md              # Finding notes with severity, tags
  report.md                         # Auto-generated penetration test report
```

The file discovery glob is `**/{users,hosts,services}/{*.md,*/*.md}` — matching `.md` files one or two levels inside `users/`, `hosts/`, or `services/` directories.

### Note Templates

Note templates are embedded via `scripts/gen-report-assets.py`, which base64-encodes files from `resources/foam/templates/` into `src/features/notes/reports/assets.ts`. The `weapon.note.creation` command offers 5 note types:

| Type | Template Source | Created At | Key Content |
|------|----------------|-----------|-------------|
| `host` | `resources/foam/templates/host.md` | `hosts/<name>/<name>.md` | `yaml host` block (hostname, ip, is_dc, alias, props), ports, nmap, vulns |
| `user` | `resources/foam/templates/user.md` | `users/<name>/<name>.md` | `yaml credentials` block (login, user, password, nt_hash, props), privileges |
| `service` | `resources/foam/templates/service.md` | `services/<name>/<name>.md` | Service alias, location, vulns |
| `finding` | `resources/foam/templates/finding.md` | `findings/<name>/<name>.md` | Severity, tags, description, references |
| `report` | Generated dynamically | `report.md` (workspace root) | Aggregated from all notes via Foam graph analysis |

The `@` character in note names is parsed as a delimiter: `admin@example.com` → id=`admin`, domain=`example_com`.

---

## Core Data Flow — Markdown as Database

The extension is built around **Markdown-as-Database**: penetration test state lives in YAML fenced code blocks inside Markdown files.

```
  Workspace Markdown Files
  (hosts/**/*.md, users/**/*.md, services/**/*.md)
         │
         │  FileSystemWatcher + init scan
         ▼
  ┌─────────────────┐     extractYamlBlocksByIdentity()
  │  targets/sync   │────────────────────────────────────►  core/markdown/
  │  (file watcher) │                                       fencedBlocks.ts
  └────────┬────────┘                                       yamlBlocks.ts
           │
           │  Host.init() / UserCredential.init()
           │  dedup by hostname / login+user
           ▼
  ┌─────────────────┐
  │    Context       │  workspaceState (dirty-flag cache)
  │  HostState       │
  │  UserState       │
  └────────┬────────┘
           │
     ┌─────┼──────────────────┐
     │     │                  │
     ▼     ▼                  ▼
  CodeLens  Env Injection    MCP Server / AI Participant
  Providers  ($TARGET, ...)   (read state via Context)
```

### Sync Behavior

- **Cold scan** (`init`): clears all state, scans all matching files, rebuilds host/user lists
- **File change** (`onDidChange`): re-processes the changed file, merges into existing state (additive — removing a YAML block from a file does NOT remove the host/user until a full re-scan)
- **File delete** (`onDidDelete`): triggers a full cold re-scan to correctly remove deleted entries
- **Deduplication**: reversed list before dedup, so the most recently added entry for a given hostname or login/user pair wins

---

## Environment Variable System

### Variable Injection Pipeline

```
ProcessWorkspaceStateToEnvironmentCollects(workspace)
  │
  ├─ getScoped EnvironmentVariableCollection for workspace
  ├─ collection.clear()                    // wipe stale vars
  │
  ├─ Build 3 Collects maps:
  │   ├─ User env vars    (UserCredential.exportEnvironmentCollects())
  │   ├─ Host env vars    (Host.exportEnvironmentCollects())
  │   └─ Default collects (hashcat constants + config + user envs)
  │       └─ + PROJECT_FOLDER = workspace path
  │
  ├─ mergeCollects(users, hosts, defaults)  // first-writer-wins
  │                                          // priority: users > hosts > defaults
  └─ for each key: collection.replace(key, value)
      └─ NEW terminals receive these env vars
```

### Variables Exported by Current Host (`is_current: true`)

| Variable | Value |
|----------|-------|
| `TARGET` | `hostname` |
| `RHOST` | `ip` |
| `HOST` | `hostname` |
| `DOMAIN` | `hostname` |
| `IP` | `ip` |
| `CURRENT_HOST` | `hostname` |

### Variables Exported by All Hosts

| Variable | Value |
|----------|-------|
| `HOST_<safename>` | `hostname` |
| `IP_<safename>` | `ip` |
| `DC_HOST_<safename>` | `alias[0]` (if `is_dc`) |
| `DC_IP_<safename>` | `ip` (if `is_dc`) |
| `DC_HOST` / `DC_IP` | (if `is_current_dc`) |

### Variables Exported by Current User (`is_current: true`)

| Variable | Value |
|----------|-------|
| `USER` / `USERNAME` / `CURRENT_USER` | `user` |
| `LOGIN` | `login` |
| `PASS` / `PASSWORD` | `password` (when no NT hash) |
| `NT_HASH` | `nt_hash` (when valid hash present) |

### Custom Props

Both Host and UserCredential support arbitrary `props`. Keys prefixed with `ENV_` are exported as env vars with the prefix stripped: `props: { ENV_CUSTOM: "value" }` → `$CUSTOM=value`.

### Default Collects

Includes hashcat mode/device/hash-type constants (e.g., `$HASH_NTLM=1000`), plus config values from `weaponized.lhost`, `weaponized.lport`, `weaponized.listenon`, and any user-defined `weaponized.envs`.

### VS Code Variable Resolver

A separate system (`platform/vscode/variables.ts`) resolves `${workspaceFolder}`, `${file}`, `${env:VAR}`, `${config:VAR}`, `${command:CMD}` placeholders in strings. Used by terminal profiles, scanner commands, and task definitions — **not** in the env-var injection pipeline.

---

## Embedded MCP Server Design

### Architecture

The MCP server runs **inside the VS Code extension host** as a Node.js `http.Server`, not as a separate process.

```
External AI Tool                    VS Code Extension Host
(Claude Code, Cursor, ...)
     │                              ┌──────────────────────────────┐
     │  POST /mcp                   │  EmbeddedMcpServer           │
     │─────────────────────────────►│  http.Server on 127.0.0.1    │
     │                              │                              │
     │                              │  Per-request:                │
     │                              │  new McpServer()             │
     │                              │  + StreamableHTTPTransport   │
     │                              │  + registerResources/Tools/  │
     │                              │    Prompts                   │
     │                              │                              │
     │◄─────────────────────────────│  Reads from Context          │
     │  JSON response               │  (HostState, UserState, ...)│
     │                              └──────────────────────────────┘
```

### Key Design Decisions

- **Transport**: `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk` v1.29+ — **not** stdio or SSE
- **Stateless**: `sessionIdGenerator: undefined` — each HTTP request gets a fresh `McpServer` + transport, no session persistence. The extension's `Context` singleton holds all state.
- **Single endpoint**: `POST /mcp` — all other paths return 404
- **Localhost only**: binds to `127.0.0.1`, never `0.0.0.0`
- **Port strategy**: tries `weaponized.mcp.port` (default `25789`), falls back to OS-assigned port if occupied. No range scanning — binary choice.
- **Gated by setting**: `weaponized.ai.enabled` (default `true`) gates the entire MCP + AI subsystem

### MCP Configuration (`mcp.json`)

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

This is a URL-based entry (Streamable HTTP), not a command+args entry (stdio). On every activation, `autoUpdateMcpJson()` silently patches the port if the entry already exists.

### Registered MCP Tools (13 total)

| Tool | Parameters | Description |
|------|-----------|-------------|
| `get_targets` | — | All discovered hosts as JSON |
| `get_credentials` | — | All discovered credentials as JSON |
| `get_hosts_formatted` | `format`: env/hosts/yaml/table | Hosts formatted for direct tool use |
| `get_credentials_formatted` | `format`: env/impacket/nxc/yaml/table | Credentials formatted for pentest tools |
| `get_graph` | — | Relationship graph with attack paths and Mermaid diagram |
| `list_findings` | `severity?`, `tags?[]`, `query?` | List/search/filter findings |
| `get_finding` | `id` | Get specific finding by ID |
| `create_finding` | `title`, `severity?`, `tags?[]`, `description?`, `references?` | Create a finding note |
| `update_finding_frontmatter` | `id`, `severity?`, `description?`, `props?` | Update finding YAML frontmatter |
| `list_terminals` | — | List all open VS Code terminals |
| `read_terminal` | `terminalId`, `lines?` | Read recent terminal output |
| `send_to_terminal` | `terminalId`, `command` | Send command to a terminal |
| `create_terminal` | `profile?`, `name?`, `cwd?` | Create terminal (optionally with profile: netcat/msfconsole/meterpreter/web-delivery) |

### Registered MCP Resources (6 total)

| Resource | URI | Content |
|----------|-----|---------|
| `hosts-list` | `hosts://list` | All hosts array |
| `hosts-current` | `hosts://current` | Current target host |
| `users-list` | `users://list` | All credentials array |
| `users-current` | `users://current` | Current user |
| `graph-relationships` | `graph://relationships` | Full relationship graph |
| `findings-list` | `findings://list` | All parsed findings |

### Registered MCP Prompts (2 total)

| Prompt | Parameters | Purpose |
|--------|-----------|---------|
| `analyze-output` | `output` (required) | Analyze tool output in engagement context |
| `suggest-next-steps` | — | Suggest next pentest actions based on current state |

---

## Terminal Bridge & Shell Integration

### How It Works

The `TerminalBridge` class provides MCP tools with terminal interaction capabilities. It **requires VS Code Shell Integration** to capture output.

```
VS Code Terminal
     │
     │  onDidStartTerminalShellExecution (Shell Integration API)
     ▼
  TerminalBridge
     ├─ Tracks terminals by sequential ID
     ├─ Buffers output in memory
     ├─ Flushes to disk every 500ms
     ├─ Caps at 64KB per terminal (truncates from front)
     └─ Log files at <storageUri>/terminals/<id>.log
```

- **Tracking**: each terminal gets a sequential integer ID. Lookup supports both ID and name matching.
- **Output capture**: hooks `onDidStartTerminalShellExecution`, reads async output stream, buffers in memory
- **Profile-based creation**: supports `netcat`, `msfconsole`, `meterpreter`, `web-delivery` profiles via registered `TerminalProfileProvider`s
- **Cleanup**: on terminal close, removes from map, clears buffer, deletes log file

### Shell Integration Requirement

Without Shell Integration, the `TerminalBridge` cannot capture command execution events or output. Users must ensure their terminal configuration has shell integration enabled (VS Code default). This affects `read_terminal` and output logging — `send_to_terminal` and `create_terminal` work regardless.

---

## Report Generation — Tarjan SCC Analysis

The `report` note type triggers a dynamic report built from the Foam knowledge graph:

1. **Build graph model**: iterates all Foam resources, builds nodes/edges from wiki-links, separates into host-edges and user-edges
2. **Tarjan SCC**: runs strongly connected components algorithm on user-edges
3. **Longest path**: builds DAG of SCCs, finds longest path via topological order DP — this represents the privilege escalation chain
4. **Mermaid diagram**: generates `graph TD` diagram from host-edges and user-edges
5. **Report assembly**: hosts info → relationship graph → attack path → extra pwned users

---

## Activation Sequence

```
extension.ts
  └─► activate.ts: activateExtension(context)
        ├─ Context.context = context
        ├─ dependencyCheck()            // Foam installed? Workspace open?
        ├─ registerTargetsSync()        // File watcher + initial cold scan
        ├─ registerCommands()           // 14 weapon.* commands
        ├─ registerCodeLens()           // YAML, shell, HTTP, notes
        ├─ registerTerminalUtils()      // Profiles + recorder
        ├─ registerDefinitionProvider() // BloodHound hover
        └─ if (weaponized.ai.enabled)
             ├─ registerMcpBridge()     // TerminalBridge + profile providers
             ├─ EmbeddedMcpServer.start(bridge, port)
             ├─ autoUpdateMcpJson(port) // Patch .vscode/mcp.json
             └─ registerAIFeatures()    // @weapon Copilot Chat participant
```

Each registration is wrapped in try/catch — one subsystem failing does not block others.

---

## Security Model

| Concern | Approach |
|---------|----------|
| Credentials in AI context | `AIService` never sends passwords/hashes to LLM — only "auth: password" / "auth: NT hash" |
| MCP credential access | `get_credentials` returns full data; MCP client handles user approval |
| Command execution | Terminal-based; user sees all commands in VS Code UI |
| SSL verification | Disabled for HTTP repeater (pentest targets with self-signed certs) |
| MCP server binding | `127.0.0.1` only — not exposed to network |
| AI feature gate | `weaponized.ai.enabled` setting disables entire MCP + AI subsystem |
