# Architecture Overview

## Layered Architecture

The extension follows a strict layered architecture with clear dependency rules.

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

## Directory Structure

```
src/
  extension.ts                    # Entry point (thin shim)
  app/
    activate.ts                   # Bootstrap sequence
    registerCommands.ts           # Central command registry
    registerCodeLens.ts           # Central CodeLens registry
  core/                           # Pure domain logic
    domain/
      host.ts                     # Host model + env export
      user.ts                     # UserCredential model + env export
      finding.ts                  # Finding interface + parsing
      graph.ts                    # Relationship graph + Tarjan SCC
      foam.ts                     # Foam extension type definitions
      index.ts                    # Barrel export
    env/
      collects.ts                 # Environment variable collection utils
    markdown/
      fencedBlocks.ts             # Fenced code block parser
      yamlBlocks.ts               # YAML block extraction by identity
    index.ts                      # Barrel re-export
  features/                       # Vertical feature modules
    ai/                           # Copilot Chat @weapon participant
    mcp/                          # Embedded MCP HTTP server
    targets/                      # Host/user sync, switch, dump
    shell/                        # Run/copy commands from markdown
    http/                         # Raw HTTP request repeater
    terminal/                     # Profiles, recorder, MCP bridge
    notes/                        # Report generation, note CodeLens
    tasks/                        # Scanner, hashcat, msfvenom
    decoder/                      # CyberChef magic decoder
    definitions/                  # BloodHound hover/go-to-definition
    editor/                       # Virtual documents, text replacement
    setup/                        # Workspace scaffolding
  platform/vscode/
    context.ts                    # Global state singleton
    logger.ts                     # OutputChannel logger
    variables.ts                  # VS Code variable resolver
    defaultCollects.ts            # Default env var collections
  shared/
    types.ts                      # Shared type aliases
    globs.ts                      # File glob patterns
  snippets/                       # Bundled snippet data
  test/                           # Unit tests (mirrors core/)
```

---

## Core Data Flow

The extension is built around **Markdown-as-Database**: penetration test state lives in YAML fenced code blocks inside Markdown files.

```
  Workspace Markdown Files
  (hosts/*.md, users/*.md)
         │
         │  FileSystemWatcher
         ▼
  ┌─────────────────┐     extractYamlBlocksByIdentity()
  │  targets/sync   │────────────────────────────────────►  core/markdown/
  │  (file watcher) │                                       fencedBlocks.ts
  └────────┬────────┘                                       yamlBlocks.ts
           │
           │  Host.init() / UserCredential.init()
           ▼
  ┌─────────────────┐
  │    Context       │  workspaceState (cached w/ dirty flags)
  │  HostState       │
  │  UserState       │
  └────────┬────────┘
           │
     ┌─────┼──────────────────┐
     │     │                  │
     ▼     ▼                  ▼
  CodeLens  Env Injection    MCP Server / AI Participant
  Providers  ($TARGET,       (read state via Context)
             $RHOST, ...)
```

### Step by Step

1. **Markdown files** contain `` ```yaml host `` and `` ```yaml credentials `` fenced blocks
2. **`targets/sync`** watches files, extracts YAML blocks via `core/markdown`, parses into domain objects via `core/domain`
3. **`Context`** stores `Host[]` / `UserCredential[]` in VS Code `workspaceState` with dirty-flag caching
4. **Environment injection**: iterates all hosts/users, calls `exportEnvironmentCollects()`, sets vars on `EnvironmentVariableCollection` — terminals receive `$TARGET`, `$RHOST`, `$USER`, `$PASS`, etc.
5. **CodeLens providers** scan markdown and offer inline actions (Run, Copy, Switch Host, Send HTTP)
6. **MCP server** exposes the same state via HTTP for external AI clients
7. **AI participant** (`@weapon`) reads state via `AIService` and builds context-aware prompts

---

## Activation Sequence

```
extension.ts
  └─► activate.ts: activateExtension(context)
        ├─ Context.context = context
        ├─ dependencyCheck()           // Foam installed? Workspace open?
        ├─ registerTargetsSync()       // File watcher + initial scan
        ├─ registerCommands()          // 14 weapon.* commands
        ├─ registerCodeLens()          // YAML, shell, HTTP, notes
        ├─ registerTerminalUtils()     // Profiles + recorder
        ├─ registerDefinitionProvider() // BloodHound hover
        └─ if (ai.enabled)
             ├─ registerMcpBridge()    // Terminal output capture
             ├─ EmbeddedMcpServer.start()
             ├─ autoUpdateMcpJson()
             └─ registerAIFeatures()   // @weapon participant
```

Each registration is wrapped in try/catch — one subsystem failing does not block others.

---

## Feature Module Pattern

Every feature follows the same internal structure:

```
features/<name>/
  index.ts              # Barrel export + register function
  commands/             # Command handlers (exported as callbacks)
  codelens/             # CodeLens providers + registration
    register.ts         # registerXxxCodeLens(context)
    *Provider.ts        # Concrete provider classes
```

Registration follows: `export function registerXxx(context: ExtensionContext)`

Subscriptions are always pushed to `context.subscriptions` for automatic disposal.

---

## State Management

All mutable state flows through `Context` — a static singleton class:

```typescript
// Read (cached, re-hydrated from workspaceState)
const hosts = Context.HostState;      // Host[] | undefined
const users = Context.UserState;      // UserCredential[] | undefined
const foam  = await Context.Foam();   // Foam | undefined

// Write (persists to workspaceState, marks cache dirty)
Context.HostState = updatedHosts;
Context.UserState = updatedUsers;
```

The dirty-flag pattern avoids repeated deserialization:
- Getters read from `workspaceState` and re-hydrate via `.init()` only when the dirty flag is set
- Setters write to `workspaceState` and set the dirty flag

---

## MCP Server Architecture

The embedded MCP server runs inside the extension host as a Node.js HTTP server:

```
External AI Tool                    VS Code Extension Host
(Claude Code, Cursor, ...)
     │                              ┌──────────────────────────┐
     │  POST /mcp                   │  EmbeddedMcpServer       │
     │─────────────────────────────►│  (http.Server on 127.0.0.1)│
     │                              │                          │
     │                              │  Per-request:            │
     │                              │  McpServer + Transport   │
     │                              │                          │
     │                              │  ┌─ Resources ──────┐   │
     │                              │  │ hosts, users,     │   │
     │                              │  │ findings, graph   │   │
     │                              │  └──────────────────┘   │
     │                              │  ┌─ Tools ──────────┐   │
     │                              │  │ get_targets,      │   │
     │                              │  │ create_finding,   │   │
     │                              │  │ send_to_terminal, │   │
     │                              │  │ ...               │   │
     │◄─────────────────────────────│  └──────────────────┘   │
     │  JSON response               └──────────────────────────┘
```

Key design: **stateless per-request** — each HTTP request gets a fresh `McpServer` + `StreamableHTTPServerTransport`. No session persistence. This simplifies the embedded model since the extension already holds all state in `Context`.

---

## Security Model

| Concern | Approach |
|---------|----------|
| Credentials in AI context | `AIService` never sends passwords/hashes to LLM — only metadata ("auth: password") |
| MCP credential access | Read tools return full data; MCP client handles user approval |
| Command execution | Terminal-based; user sees all commands; MCP tools logged |
| SSL verification | Disabled for HTTP repeater (pentest targets); documented |
| MCP server binding | `127.0.0.1` only — not exposed to network |
