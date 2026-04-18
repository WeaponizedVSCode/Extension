# Overall Design — Weaponized VS Code

## Project Identity & Vision

**Weaponized VS Code** turns a VS Code workspace into a penetration testing IDE. It builds on [Foam](https://foambubble.github.io/foam/) (a knowledge management extension) and treats **Markdown files as a structured database**: the same `.md` file a pentester writes notes in is also the machine-parsable source of truth for hosts, credentials, findings, and relationships.

### Core Principles

| Principle | What It Means |
|-----------|---------------|
| **Note-as-Data** | YAML fenced blocks inside Markdown are the canonical state. No separate database. |
| **Foam-First** | Wiki-links and the Foam graph drive report generation (Tarjan SCC analysis) and entity navigation (go-to-definition). Foam is a required dependency. |
| **Terminal-Native** | External tools (nmap, hashcat, msfconsole, ...) run in VS Code terminals, not reimplemented. |
| **AI-Augmented** | Copilot Chat participant + MCP server give AI assistants full engagement context. |
| **Secure-by-Default** | Credentials are never sent to LLMs; MCP binds to localhost only; AI features are gated by a setting. |

### Target Users

Penetration testers working through HTB, OSCP, red team engagements, or similar scenarios who want a single workspace to organize notes, manage targets, run tools, and leverage AI assistance.

### Prerequisites

- **VS Code** >= 1.101.0
- **Foam extension** (`foam.foam-vscode`) — knowledge management backbone. The extension checks for Foam on activation; if missing, `dependencyCheck()` returns early and **no subsystem registers** (this is a hard prerequisite, not subject to the partial-activation resilience described below).
- **Shell Integration** — must be active in terminals for `TerminalBridge` output capture (enabled by default in modern VS Code).

Optional external tools (invoked via terminal, not bundled):

| Tool | Used By | Purpose |
|------|---------|---------|
| `msfvenom` / `msfconsole` | Payload generation, terminal profiles | Metasploit framework |
| `hashcat` | Password cracking task | Hash cracking |
| `rustscan`, `nuclei`, `dirsearch`, `feroxbuster`, `ffuf`, `wfuzz` | Network scanning | Configurable scanner commands |
| `rlwrap`, `netcat` | Terminal profiles | Reverse shell handlers |

---

## Architecture Decisions

### ADR-1: Markdown-as-Database

**Context:** Pentesting workflows need structured state (hosts, credentials, findings) but also rich human-readable notes with screenshots, tool output, and narrative.

**Decision:** Use YAML fenced code blocks (` ```yaml host `, ` ```yaml credentials `) inside Markdown files as the canonical data source. A `FileSystemWatcher` parses them into in-memory domain objects on every change.

**Consequences:**
- (+) Single source of truth — no sync between notes and a database
- (+) Works with any text editor, git-friendly, Foam wiki-links connect entities
- (+) Users can hand-edit YAML or use extension commands interchangeably
- (-) No query language — all "queries" are full scans of matching files
- (-) Deletions are only detected on full re-scan (file delete triggers cold scan, but removing a YAML block mid-file is additive-only until restart)

### ADR-2: Embedded MCP Server (In-Process HTTP)

**Context:** The MCP server originally ran as a standalone Node.js process communicating via stdio and file-based IPC (`.weapon-state/` directory). This required maintaining state sync files and a separate webpack build target.

**Decision:** Move the MCP server into the extension host as an embedded HTTP server using `StreamableHTTPServerTransport`. The server reads state directly from the `Context` singleton and interacts with terminals through the `TerminalBridge`.

**Consequences:**
- (+) Zero IPC overhead — direct memory access to all extension state
- (+) No file sync bugs, no stale `.weapon-state/` data
- (+) Single process to debug, single webpack target to maintain
- (-) Server lifecycle tied to extension host — if the extension crashes, MCP goes down
- (-) Must be careful about blocking the extension host thread (mitigated by stateless per-request design)

### ADR-3: Layered Architecture with Core Zero-VS-Code Dependency

**Context:** Domain logic (host parsing, credential formatting, graph algorithms) needs to be testable without spinning up VS Code.

**Decision:** Enforce a strict layered architecture where `core/` has zero `vscode` imports. All VS Code coupling lives in `platform/vscode/` and `features/`.

**Consequences:**
- (+) `core/` can be tested with plain Mocha — no extension host required
- (+) Domain models are reusable outside VS Code (e.g., a future CLI tool)
- (-) Requires discipline — domain models export `Collects` maps instead of directly setting env vars

### ADR-4: Static Singleton Context

**Context:** Many subsystems (CodeLens providers, MCP server, AI participant, target sync) all need access to the same host/user state.

**Decision:** Use a static singleton class `Context` that holds `ExtensionContext`, cached `HostState`/`UserState` arrays, and a lazy Foam reference. State is persisted via VS Code's `workspaceState` with a dirty-flag caching pattern.

**Consequences:**
- (+) Simple — any module can read `Context.HostState` without wiring
- (+) `workspaceState` persistence survives extension restarts
- (-) Global mutable state — harder to unit-test consumers (must mock `Context`)
- (-) No event system — consumers poll state rather than subscribing to changes

### ADR-5: Stateless MCP (Per-Request New Instance)

**Context:** MCP sessions could accumulate state, requiring cleanup and concurrency management.

**Decision:** Set `sessionIdGenerator: undefined` — each HTTP request to `/mcp` creates a fresh `McpServer` + `StreamableHTTPServerTransport`. All persistent state lives in `Context`, not in MCP sessions.

**Consequences:**
- (+) No session leaks, no cleanup needed, trivially concurrent
- (+) Server restart is just "stop listening, start listening"
- (-) No MCP notifications/subscriptions (push from server to client)
- (-) Slight overhead of re-registering tools/resources per request (negligible in practice)

### ADR-6: Credential Security Model — Tiered Exposure

**Context:** AI tools should have engagement context but must not leak passwords/hashes to external LLMs.

**Decision:** Three-tier credential exposure:

| Consumer | Sees Passwords/Hashes? | Mechanism |
|----------|----------------------|-----------|
| Copilot Chat (`@weapon`) | Never | `userContext.ts` only reports auth type ("password"/"NT hash"/"none") |
| MCP Server tools | Yes (full data) | MCP client handles user approval; localhost-only binding |
| Terminal env vars | Yes (injected as `$PASS`, `$NT_HASH`) | User's own terminal; visible in VS Code UI |

**Consequences:**
- (+) LLM context is safe — no credential exfiltration via model
- (+) MCP gives full data to local tools that need it
- (-) MCP credential exposure relies on client-side approval (out of our control)

---

## System Architecture

### Four-Layer Structure

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
| `features/*` | `core/`, `platform/`, `shared/` | Other features (exception: `features/mcp/` imports from `features/terminal/` and `features/targets/` because the MCP server must bridge terminal interaction and graph building) |
| `platform/vscode/` | `core/`, `shared/`, `vscode` API | `features/` |
| `core/` | `shared/` only | `vscode`, `platform/`, `features/` |
| `shared/` | Nothing (leaf) | Everything else |

The critical boundary: **`core/` has zero VS Code imports**. All domain logic is pure TypeScript, making it testable without the VS Code runtime.

### Runtime Component Diagram

```
┌─ VS Code Extension Host ──────────────────────────────────────────────┐
│                                                                       │
│  activate.ts (Composition Root)                                       │
│       │                                                               │
│       ├─► targets/sync ──► FileSystemWatcher ──► Context (singleton)  │
│       │                         ▲                    │                │
│       │                    .md files              ┌──┴──┐            │
│       │                                           │State│            │
│       ├─► registerCommands() ◄────────────────────┤Cache│            │
│       │   (17 weapon.* commands)                  └──┬──┘            │
│       │                                              │                │
│       ├─► registerCodeLens()                         │                │
│       │   (targets, shell, notes, http)              │                │
│       │                                              │                │
│       ├─► registerTerminalUtils()                    │                │
│       │   (profiles + recorder)                      │                │
│       │                                              │                │
│       ├─► registerDefinitionProvider()               │                │
│       │   (BloodHound hover)                         │                │
│       │                                              │                │
│       └─► if (ai.enabled)                            │                │
│            ├─► TerminalBridge ◄──────────────────────┤                │
│            ├─► EmbeddedMcpServer ◄───────────────────┘                │
│            │     POST /mcp on 127.0.0.1:<port>                       │
│            ├─► autoUpdateMcpJson()                                    │
│            └─► @weapon Chat Participant                               │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
         ▲
         │ POST /mcp (Streamable HTTP)
         │
  External AI Clients (Claude Code, Cursor, VS Code Copilot, ...)
```

### Activation Sequence

```
extension.ts
  └─► activate.ts: activateExtension(context)
        ├─ Context.context = context
        ├─ dependencyCheck()            // Foam installed? Workspace open?
        ├─ registerTargetsSync()        // File watcher + initial cold scan
        ├─ registerCommands()           // 17 weapon.* commands
        ├─ registerCodeLens()           // YAML, shell, HTTP, notes
        ├─ registerTerminalUtils()      // Profiles + recorder
        ├─ registerDefinitionProvider() // BloodHound hover
        └─ if (weaponized.ai.enabled)
             ├─ registerMcpBridge()     // TerminalBridge + profile providers
             ├─ EmbeddedMcpServer.start(bridge, port)
             ├─ autoUpdateMcpJson(port) // Patch .vscode/mcp.json
             └─ registerAIFeatures()    // @weapon Copilot Chat participant
```

Each registration is wrapped in try/catch — one subsystem failing does not block others (resilient partial activation).

---

## Core Data Flow — Markdown as Database

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

| Event | Action |
|-------|--------|
| **Cold scan** (init) | Clear all state, scan all matching files, rebuild host/user lists |
| **File change** (onDidChange) | Re-process changed file, merge into existing state (additive) |
| **File delete** (onDidDelete) | Trigger full cold re-scan to correctly remove entries |
| **Deduplication** | Reversed list before dedup — most recently added entry for a given hostname or login/user pair wins |

### File Discovery

The glob `**/{users,hosts,services}/{*.md,*/*.md}` matches `.md` files one or two levels inside `users/`, `hosts/`, or `services/` directories.

---

## Workspace Design

### Scaffolding (`weapon.setup`)

Creates **only** `.vscode/` configuration files from base64-embedded templates:

```
<workspace>/
  .vscode/
    .zshrc              # Shell environment: venv activation, history, helper functions
    extensions.json     # Recommended VS Code extensions
    msfconsole.rc       # Metasploit console resource file
    settings.json       # Weaponized extension default settings
```

Templates are generated by `scripts/gen-setup.py` → `src/features/setup/assets.ts`. Setup only writes files that don't already exist — it never overwrites.

After file creation, checks `~/.zshrc` for `weapon_vscode_launch_helper`. If missing, copies the helper to clipboard and opens `~/.zshrc` for manual pasting.

### Workspace Directory Convention

```
<workspace>/
  .vscode/                          # Extension config (weapon.setup)
    .zshrc
    settings.json
    mcp.json                        # MCP server config (weapon.mcp.install)
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

### Note Templates

Embedded via `scripts/gen-report-assets.py` → `src/features/notes/reports/assets.ts`. The `weapon.note.creation` command offers 5 types:

| Type | Created At | Key Content |
|------|-----------|-------------|
| `host` | `hosts/<name>/<name>.md` | `yaml host` block, ports, nmap, vulns |
| `user` | `users/<name>/<name>.md` | `yaml credentials` block, privileges |
| `service` | `services/<name>/<name>.md` | Service alias, location, vulns |
| `finding` | `findings/<name>/<name>.md` | Severity, tags, description, references |
| `report` | `report.md` (workspace root) | Aggregated via Foam graph analysis |

The `@` character in note names is parsed as a delimiter: `admin@example.com` → id=`admin`, domain=`example_com`.

---

## Module Responsibilities

### State Management Domain

**`core/domain/`** — Pure TypeScript domain models with zero VS Code dependency.

| Model | File | Responsibility |
|-------|------|---------------|
| `Host` | `host.ts` | Target host with hostname, IP, aliases, DC flags, current-target flag, custom props. Supports 4 dump formats (env, hosts, yaml, table). |
| `UserCredential` | `user.ts` | Credential with user, password, NT hash, login domain, current flag. Supports 5 dump formats (env, impacket, nxc, yaml, table). |
| `Finding` | `finding.ts` | Security finding with id, title, severity, tags, description, references. Parses YAML frontmatter + markdown sections. |
| `Graph` | `graph.ts` | Pure algorithm: Tarjan SCC + longest path for privilege escalation chain computation. |
| `Foam types` | `foam.ts` | TypeScript interfaces mirroring Foam extension API for type-safe interop. |

**`core/markdown/`** — Markdown parsing primitives.

| Module | Responsibility |
|--------|---------------|
| `fencedBlocks.ts` | Parse fenced code blocks into `FencedBlock` objects; `replaceFencedBlockContent()` for surgical edits. |
| `yamlBlocks.ts` | Filters on top of fencedBlocks: `extractYamlBlocksByIdentity()` finds `yaml host` / `yaml credentials` blocks. |

**`core/env/collects.ts`** — `Collects` type (string→string map), `envVarSafer()` sanitizer, `mergeCollects()` with first-writer-wins.

**`features/targets/sync/`** — Watches workspace files, parses YAML blocks into domain objects, stores in `Context`, injects environment variables into terminal.

- `markdownSync.ts` — Core sync: file → parse → dedup → Context → env injection
- `graphBuilder.ts` — Builds `RelationshipGraph` from Foam workspace (nodes, edges, attack path, Mermaid diagram)

### Terminal Domain

**`features/terminal/`** — Terminal profiles, output capture, and MCP bridge.

| Component | Responsibility |
|-----------|---------------|
| `bridge.ts` (`TerminalBridge`) | Tracks terminals by ID, captures output via Shell Integration API, buffers in memory, flushes to disk (500ms interval, 64KB cap). Exposes `getTerminals()`, `getTerminalOutput()`, `sendCommandDirect()`, `createTerminal()` for MCP tools. |
| `profiles/` | Abstract `BaseWeaponizedTerminalProvider` + 4 concrete providers: msfconsole, meterpreter, netcat, web-delivery. Each sends an initial command on terminal open. |
| `recorder/` | Terminal logging system with 4 modes: CommandOnly, OutputOnly, CommandAndOutput, NetcatHandler. User-facing start/stop commands. |

**`features/tasks/`** — Command handlers for `hashcat`, `msfvenom`, `scan` — create terminals and run configured tool commands.

**`features/shell/`** — CodeLens on `bash`/`zsh`/`sh`/`powershell` fenced blocks → "Run command in terminal" / "Copy commands" buttons.

### AI Domain

**`features/ai/`** — Copilot Chat participant `@weapon`.

| Component | Responsibility |
|-----------|---------------|
| `participant.ts` | Routes `/analyze`, `/suggest`, `/generate`, `/explain`, `/report` commands. Builds messages with system prompt + host/user context, streams from `gpt-4o`. `/report` is pure data (no LLM call). |
| `service.ts` (`AIService`) | Reads engagement state from `Context`. Includes `redactCredentials()` to strip passwords/hashes. |
| `prompts/systemPrompt.ts` | Static system prompt: pentest assistant role, output format rules, credential handling. |
| `prompts/hostContext.ts` | Markdown summary of known hosts for LLM context (flags DC/CURRENT status). |
| `prompts/userContext.ts` | Markdown summary of credentials — **never includes actual passwords or hashes**, only auth type. |

**`features/mcp/`** — Embedded MCP HTTP server.

| Component | Responsibility |
|-----------|---------------|
| `httpServer.ts` (`EmbeddedMcpServer`) | HTTP server on `127.0.0.1`, stateless per-request. Registers 6 resources, 13 tools, 2 prompts. |
| `install.ts` | Manages `.vscode/mcp.json`: user command + auto-update on activation. |
| `portManager.ts` | Port selection: try preferred (default 25789), fallback to OS-assigned. |

### Knowledge Management Domain

**`features/notes/`** — Note creation and report generation.

| Component | Responsibility |
|-----------|---------------|
| `reports/report.ts` | Generates full pentest report: Foam graph → Tarjan SCC → longest attack path → Mermaid diagram → assembled sections. |
| `reports/index.ts` | `weapon.note.creation` command: 5 note types, templates from `assets.ts`. |
| `codelens/noteProvider.ts` | Scans for `get user <name>` / `own host <name>` lines, offers CodeLens to create Foam notes for entities not yet in state. |

**`features/definitions/`** — BloodHound hover tooltips and go-to-definition for BloodHound terms in Markdown.

**`features/decoder/`** — `weapon.magic_decoder`: opens CyberChef in VS Code's Simple Browser with selected text and "Magic" recipe.

### HTTP Domain

**`features/http/`** — HTTP repeater functionality.

| Component | Responsibility |
|-----------|---------------|
| `codelens/` | "Send HTTP/HTTPS Request" and "Copy in curl" buttons on ` ```http ` fenced blocks. |
| `commands/rawRequest.ts` | Parses raw HTTP text, executes via `node-fetch` (SSL verification disabled for pentest targets), shows response. |
| `commands/requestToCurl.ts` | Converts raw HTTP request to curl command, copies to clipboard. |

### Engineering Domain

**`features/setup/`** — Workspace scaffolding (`weapon.setup`).

**`features/editor/`** — Virtual document display (`displayVirtualContent`) and in-file text replacement (`replacer`) used by CodeLens actions.

**`platform/vscode/`** — VS Code integration layer.

| Component | Responsibility |
|-----------|---------------|
| `context.ts` (`Context`) | Static singleton: holds `ExtensionContext`, cached `HostState`/`UserState`, lazy Foam reference. Uses `workspaceState` with dirty-flag caching. |
| `logger.ts` | `LogOutputChannel` named "Weaponized". |
| `variables.ts` | Resolves `${workspaceFolder}`, `${env:VAR}`, `${config:VAR}`, `${command:CMD}` placeholders. Supports recursive resolution. |
| `defaultCollects.ts` | Hashcat constants + `LHOST`/`LPORT`/`LISTEN_ON` from config + user envs. |

### Common Feature Patterns

All feature modules follow consistent conventions:

- **Barrel exports**: `index.ts` re-exports the public API
- **Command handlers**: functions of type `callback = (...args: any[]) => any` in `commands/`
- **CodeLens generators**: base class accepts generator functions, iterates fenced blocks, produces `CodeLens[]`
- **Isolation**: features import from `core/`, `platform/`, `shared/` but **never from other features**
- **Auto-generated assets**: Python scripts encode templates as base64 into TypeScript — no runtime file reads

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

## Embedded MCP Server

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
     │  JSON response               │  (HostState, UserState, ...) │
     │                              └──────────────────────────────┘
```

### Key Design Decisions

- **Transport**: `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk` v1.29+ — **not** stdio or SSE
- **Stateless**: `sessionIdGenerator: undefined` — each HTTP request gets a fresh `McpServer` + transport, no session persistence
- **Single endpoint**: `POST /mcp` — all other paths return 404
- **Localhost only**: binds to `127.0.0.1`, never `0.0.0.0`
- **Port strategy**: tries `weaponized.mcp.port` (default `25789`), falls back to OS-assigned port if occupied
- **Gated by setting**: `weaponized.ai.enabled` (default `true`) gates the entire MCP + AI subsystem

### MCP Configuration (`mcp.json`)

```json
{
  "servers": {
    "weaponized": {
      "url": "http://127.0.0.1:<port>/mcp"
    }
  }
}
```

URL-based entry (Streamable HTTP), not command+args (stdio). On every activation, `autoUpdateMcpJson()` silently patches the port.

### Registered MCP Tools (13)

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
| `read_terminal` | `terminalId` (string: numeric ID or terminal name), `lines?` | Read recent terminal output |
| `send_to_terminal` | `terminalId`, `command` | Send command to a terminal |
| `create_terminal` | `profile?`, `name?`, `cwd?` | Create terminal (optionally with profile) |

### Registered MCP Resources (6)

| Resource | URI | Content |
|----------|-----|---------|
| `hosts-list` | `hosts://list` | All hosts array |
| `hosts-current` | `hosts://current` | Current target host |
| `users-list` | `users://list` | All credentials array |
| `users-current` | `users://current` | Current user |
| `graph-relationships` | `graph://relationships` | Full relationship graph |
| `findings-list` | `findings://list` | All parsed findings |

### Registered MCP Prompts (2)

| Prompt | Parameters | Purpose |
|--------|-----------|---------|
| `analyze-output` | `output` (required) | Analyze tool output in engagement context |
| `suggest-next-steps` | — | Suggest next pentest actions based on current state |

---

## Terminal Bridge & Shell Integration

### How It Works

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

Without Shell Integration, `TerminalBridge` cannot capture command execution events or output. This affects `read_terminal` and output logging — `send_to_terminal` and `create_terminal` work regardless.

---

## Report Generation — Tarjan SCC Analysis

The `report` note type triggers a dynamic report built from the Foam knowledge graph:

1. **Build graph model**: iterates all Foam resources, builds nodes/edges from wiki-links, separates into host-edges and user-edges
2. **Tarjan SCC**: runs strongly connected components algorithm on user-edges
3. **Longest path**: builds DAG of SCCs, finds longest path via topological order DP — this represents the privilege escalation chain
4. **Mermaid diagram**: generates `graph TD` diagram from host-edges and user-edges
5. **Report assembly**: hosts info → relationship graph → attack path → extra pwned users

---

## Security Model

### Credential Exposure Matrix

| Consumer | Passwords | NT Hashes | Mechanism |
|----------|-----------|-----------|-----------|
| Copilot Chat (`@weapon`) | Never | Never | `userContext.ts` reports auth type only |
| MCP `get_credentials` | Yes | Yes | Full data; MCP client handles approval |
| MCP `users://list` resource | Yes | Yes | Full data; MCP client handles approval |
| MCP prompts (`suggest-next-steps`) | Yes | Yes | Prompt text includes credentials for LLM consumption; relies on MCP client approval |
| Terminal env vars | Yes (`$PASS`) | Yes (`$NT_HASH`) | Injected into user's own terminal |
| CodeLens dump commands | Yes | Yes | Displayed in virtual document (user-initiated) |

### Other Security Measures

| Concern | Approach |
|---------|----------|
| MCP server binding | `127.0.0.1` only — not exposed to network |
| AI feature gate | `weaponized.ai.enabled` disables entire MCP + AI subsystem |
| Command execution | Terminal-based; user sees all commands in VS Code UI |
| SSL verification | Disabled for HTTP repeater (pentest targets with self-signed certs) |
| `AIService.redactCredentials()` | Single point of control for stripping credentials from arbitrary text |

---

## Testing Strategy

### Current Coverage

Tests target **only the `core/` layer** — validating the architectural boundary that `core/` is testable without VS Code:

| Test File | Covers |
|-----------|--------|
| `domain/host.test.ts` | `Host.init`, dump formats, `parseHostsYaml`, `dumpHosts` |
| `domain/user.test.ts` | `UserCredential.init`, dump formats, env export |
| `domain/finding.test.ts` | `parseFindingNote`, `generateFindingMarkdown`, `filterFindings` |
| `domain/graph.test.ts` | `longestReferencePath` (Tarjan SCC algorithm) |
| `env/collects.test.ts` | `envVarSafer`, `mergeCollects` |
| `markdown/fencedBlocks.test.ts` | `extractFencedBlocks`, `replaceFencedBlockContent` |
| `markdown/yamlBlocks.test.ts` | `extractYamlBlocks`, `extractYamlBlocksByIdentity` |

### Test Infrastructure

- **Framework**: `@vscode/test-cli` + `@vscode/test-electron` + Mocha
- **Config**: `.vscode-test.mjs` defines a `unit` label
- **Compilation**: tests compiled via `tsc` (not webpack) to `out/`
- **Run**: `pnpm run test:unit`

### Uncovered Areas & Recommendations

| Area | Current State | Recommendation |
|------|--------------|----------------|
| `features/` layer | No tests | Integration tests with mocked VS Code API |
| MCP tool handlers | No tests | Test request→response with mocked Context |
| AI prompt builders | No tests | Unit-testable (pure string functions) |
| `platform/vscode/variables.ts` | No tests | Complex resolver; would benefit from edge-case tests |

---

## Extension Guide — How to Add New Components

### Adding a New Feature Module

1. Create `src/features/<name>/` with:
   - `index.ts` — barrel re-exports
   - `commands/` — command handler functions (type `callback`)
   - (optional) `codelens/` with `register.ts`
2. Import only from `core/`, `platform/`, `shared/`
3. Wire in `app/registerCommands.ts` and/or `app/registerCodeLens.ts`
4. Register activation in `app/activate.ts` (with try/catch)

### Adding a New MCP Tool

1. In `src/features/mcp/httpServer.ts`, inside the `registerToolsAndResources` function
2. Add `server.tool("tool_name", "description", { schema }, handler)`
3. Schema uses Zod for parameter validation
4. Handler reads from `Context` or `TerminalBridge`

### Adding a New CodeLens Provider

1. Create a provider class or use the generator pattern with the existing base classes
2. Register in the feature's `codelens/register.ts`
3. Wire in `app/registerCodeLens.ts`

### Adding a New Terminal Profile

1. Extend `BaseWeaponizedTerminalProvider` in `features/terminal/profiles/`
2. Implement `getInitialCommand()` to return the command sent on terminal open
3. Register in `package.json` → `contributes.terminal.profiles`
4. Wire in `features/terminal/index.ts`

### Adding a New Domain Model

1. Create in `core/domain/` — **zero vscode imports**
2. Implement `init()` factory, `exportEnvironmentCollects()` if applicable
3. Add parsing function (e.g., `parseXxxYaml()`)
4. Write unit tests in `src/test/unit/core/domain/`
5. Re-export from `core/index.ts`
