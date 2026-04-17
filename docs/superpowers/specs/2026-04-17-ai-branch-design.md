# AI Branch Design Spec

**Date:** 2026-04-17
**Branch:** `AI` (off `master`)
**Scope:** Code quality fixes, testing infrastructure, Copilot Chat Participant, MCP Server

---

## Overview

Four sequential phases on a single `AI` branch:

1. **Code Quality Fixes** — 7 Critical + High issues from `04-CODE-QUALITY.md`
2. **Testing Infrastructure** — Unit tests for `core/` (90%+ coverage target)
3. **Copilot Chat Participant** — `@weapon` with 5 commands + shared AIService
4. **MCP Server** — Standalone Node.js process with stdio transport

Dependencies: Phase 1 → 2 → 3 → 4 (AIService built in Phase 3, reused in Phase 4)

---

## Phase 1: Code Quality Fixes

### 1.1 Missing `await` on Foam activation (#1)

**File:** `src/app/activate.ts:10-24`

Change `dependencyCheck()` to `async dependencyCheck()` and add `await` before `foamExtension.activate()`. Update the call site in `activateExtension()` to `await dependencyCheck()`.

### 1.2 `Foam()` instance → static method (#2)

**File:** `src/platform/vscode/context.ts:55-93`

Change `public async Foam()` to `public static async Foam()`. Search all callers of `new Context().Foam()` and replace with `Context.Foam()`.

### 1.3 Error boundaries in activation (#3)

**File:** `src/app/activate.ts:39-51`

Wrap each `register*` call in individual `try/catch` blocks. Log errors via `logger.error()` but continue activating remaining features. This ensures partial activation is possible.

### 1.4 `let` → `const` (#4)

**Files:** `context.ts`, `host.ts`, `user.ts`, and any other files where `let` is used for variables that are never reassigned.

Systematic replacement. Use the pattern: if a variable is assigned once and never reassigned, change `let` to `const`.

### 1.5 State getter caching (#5)

**File:** `src/platform/vscode/context.ts:19-49`

Add private cache fields and dirty flags:

```typescript
private static _hostCache: Host[] | undefined;
private static _hostDirty = true;
private static _userCache: UserCredential[] | undefined;
private static _userDirty = true;
```

`get HostState` checks `_hostDirty` before rebuilding. `set HostState` marks `_hostDirty = true`.
Same pattern for `UserState`.

### 1.6 Duplicate `is_dc` assignment (#6)

**File:** `src/core/domain/host.ts:48`

Remove the duplicate line `this.is_dc = ihost.is_dc ? ihost.is_dc : false;` at line 48. The assignment at line 44 is sufficient.

### 1.7 `defaultCollects` lazy loading (#7)

**File:** `src/platform/vscode/defaultCollects.ts`

Convert exported constants to a `getDefaultCollects()` function that reads config at call time. In `activate.ts`, add a `vscode.workspace.onDidChangeConfiguration` listener that triggers re-export when `weaponized.*` settings change.

---

## Phase 2: Testing Infrastructure

### 2.1 Configuration

**New file:** `.vscode-test.mjs`

```javascript
import { defineConfig } from "@vscode/test-cli";
export default defineConfig([
  {
    label: "unit",
    files: "out/test/unit/**/*.test.js",
    mocha: { timeout: 10000 },
  },
]);
```

**package.json additions:**
- `"test:unit": "vscode-test --label unit"`

### 2.2 Test files

All under `src/test/unit/core/`:

| File | Tests | Target |
|------|-------|--------|
| `domain/host.test.ts` | `Host.init()`, `exportEnvironmentCollects()`, `dump()`, `parseHostsYaml()`, `dumpHosts()` | 90%+ |
| `domain/user.test.ts` | `UserCredential.init()`, `exportEnvironmentCollects()`, `dumpUser()`, `parseUserCredentialsYaml()` | 90%+ |
| `env/collects.test.ts` | `envVarSafer()`, `mergeCollects()` | 95%+ |
| `markdown/fencedBlocks.test.ts` | `extractFencedBlocks()`, `replaceFencedBlockContent()` | 95%+ |
| `markdown/yamlBlocks.test.ts` | `extractYamlBlocks()`, `extractYamlBlocksByIdentity()` | 90%+ |

Test code is based on examples in `docs/05-TESTING-STRATEGY.md`, adapted to match actual source code signatures.

### 2.3 Fixtures

```
src/test/fixtures/
  hosts/dc01.md    — Markdown with yaml host block
  users/admin.md   — Markdown with yaml credentials block
```

---

## Phase 3: Copilot Chat Participant

### 3.1 Shared AIService

**New file:** `src/features/ai/service.ts`

```typescript
export interface EngagementState {
  hosts: Host[];
  users: UserCredential[];
  currentHost: Host | undefined;
  currentUser: UserCredential | undefined;
}

export class AIService {
  getEngagementState(): EngagementState
  // Reads from Context.HostState / Context.UserState
  // Finds current host/user by is_current flag

  redactCredentials(text: string): string
  // Replaces known passwords/hashes with [REDACTED]
}
```

### 3.2 Chat Participant Registration

**New file:** `src/features/ai/index.ts`

- `registerAIFeatures(context)` — creates chat participant `weapon.chat`
- Sets icon, follow-up provider
- Pushes to `context.subscriptions`

**Modified file:** `src/app/activate.ts`

- Import and call `registerAIFeatures(context)` inside a try/catch block

**Modified file:** `package.json`

- Add `contributes.chatParticipants` array with id `weapon.chat`, name `weapon`, 5 commands

### 3.3 Chat Handler

**New file:** `src/features/ai/participant.ts`

Routes to 5 command handlers based on `request.command`:

| Command | Handler | Uses LLM | Description |
|---------|---------|----------|-------------|
| `/analyze` | `handleAnalyze` | Yes | Analyze tool output, find actionable items |
| `/suggest` | `handleSuggest` | Yes | Suggest next pentest steps |
| `/generate` | `handleGenerate` | Yes | Generate commands from natural language |
| `/report` | `handleReport` | No | Pure data summary from state |
| `/explain` | `handleExplain` | Yes | Explain security concepts |
| (default) | `handleGeneralChat` | Yes | Free-form conversation |

LLM access via `vscode.lm.selectChatModels({ vendor: "copilot", family: "gpt-4o" })`.

### 3.4 Prompt Builders

**New files in `src/features/ai/prompts/`:**

- `systemPrompt.ts` — Base system prompt (pentest assistant role, rules, output format)
- `hostContext.ts` — `buildHostContext(hosts, currentHost)` → markdown string with host list
- `userContext.ts` — `buildUserContext(users, currentUser)` → markdown string, **never includes actual passwords/hashes**, only auth type (password/NT hash/none)

### 3.5 Security Rules

- Passwords and NT hashes are NEVER sent to any LLM
- `userContext.ts` only reports auth type, not values
- `/report` command outputs credential existence (Yes/No), not values
- `AIService.redactCredentials()` available for any text that might contain credentials

---

## Phase 4: MCP Server

### 4.1 Architecture

Standalone Node.js process, communicates via stdio. Separate from the VS Code extension process.

**New dependency:** `@modelcontextprotocol/sdk` (added to devDependencies)

### 4.2 StateBridge (IPC)

**New file:** `src/mcp/bridge.ts`

The extension writes state to `${workspaceFolder}/.weapon-state/`:
- `hosts.json` — serialized Host[]
- `users.json` — serialized UserCredential[]
- `env.json` — current environment variables
- `config.json` — extension configuration

The MCP server reads these files. One-way communication (extension → MCP).

**Extension side:** Add state write hooks in `src/features/targets/sync/` — after every state update, write JSON files.

### 4.3 File Structure

```
src/mcp/
  server.ts           ← Main entry, creates MCP Server instance
  bridge.ts           ← StateBridge class (reads .weapon-state/)
  resources/
    hosts.ts          ← hosts://list, hosts://current
    users.ts          ← users://list, users://current (redacted)
    envVars.ts        ← env://variables
  tools/
    readTools.ts      ← get_targets, get_credentials, search_notes, get_attack_graph
    writeTools.ts     ← switch_target, switch_user, run_command, run_scanner
  prompts/
    templates.ts      ← analyze-output, suggest-next-steps, privesc-check
```

### 4.4 Resources (Read-Only)

| URI | Description | Redaction |
|-----|-------------|-----------|
| `hosts://list` | All hosts with metadata | None needed |
| `hosts://current` | Current target host | None needed |
| `users://list` | All credentials | Passwords/hashes replaced with `[REDACTED]` |
| `users://current` | Current user | Passwords/hashes replaced with `[REDACTED]` |
| `env://variables` | Environment variables | `PASS`/`PASSWORD`/`NT_HASH` values redacted |

### 4.5 Tools

**Read-only (implement first):**
- `get_targets` — returns host list
- `get_credentials` — returns redacted credential list
- `search_notes` — searches Foam notes by keyword (reads .md files)
- `get_attack_graph` — returns Mermaid diagram from report generator

**Write tools (implement second):**
- `switch_target` — writes to hosts.json, sets is_current
- `switch_user` — writes to users.json, sets is_current
- `run_command` — writes command to a queue file, extension picks up and executes
- `run_scanner` — same pattern as run_command

Write tools use a command queue: MCP writes to `.weapon-state/command-queue.json`, extension watches and executes with user confirmation.

### 4.6 Prompt Templates

3 prompt templates exposed via MCP:
- `analyze-output` — template for analyzing tool output
- `suggest-next-steps` — template for suggesting next actions
- `privesc-check` — template for privilege escalation analysis

### 4.7 Build Configuration

**New file:** `webpack.config.mcp.js`

Separate webpack config that bundles `src/mcp/server.ts` → `dist/mcp-server.js`. Target: `node`, no VS Code dependencies.

**package.json additions:**
- `"compile:mcp": "webpack --config webpack.config.mcp.js"`
- `"package:mcp": "webpack --config webpack.config.mcp.js --mode production"`

---

## Cross-Cutting Concerns

### Git Strategy

- Single branch: `AI`
- One commit per logical change (not per file)
- Commit message format: `fix:`, `test:`, `feat:` prefixes

### Credential Security

- No passwords/hashes in LLM contexts (Chat or MCP)
- `AIService.redactCredentials()` is the single point of control
- MCP resources redact by default
- `/report` command shows existence, not values

### Backward Compatibility

- All existing commands and features continue to work
- `Foam()` static change requires updating callers (Phase 1.2)
- `getDefaultCollects()` function change requires updating importers (Phase 1.7)
- No public API changes beyond these two

### Dependencies Added

| Package | Phase | Purpose |
|---------|-------|---------|
| `@modelcontextprotocol/sdk` | 4 | MCP server framework |

No new dependencies for Phases 1-3 (Chat Participant uses built-in `vscode` API).
