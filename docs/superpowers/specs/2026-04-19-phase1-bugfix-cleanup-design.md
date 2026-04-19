# Phase 1: Bug Fixes & Code Cleanup

**Date:** 2026-04-19
**Scope:** Fix real bugs, clean up code quality, extract command constants, update stale extension ID references in docs.

---

## 1. Memory Leak Fixes

### 1.1 Terminal Profile Disposables

**File:** `src/features/terminal/profiles/base.ts`

**Problem:** `onDidOpenTerminal` listener (line 22) is registered in the constructor but the returned `Disposable` is discarded. Four profile providers each leak one listener.

**Fix:**
- Store the disposable returned by `onDidOpenTerminal()` as a class field
- Implement `vscode.Disposable` interface on `BaseWeaponizedTerminalProvider`
- In the registration site (wherever profiles are pushed to subscriptions), ensure the disposable is tracked

### 1.2 Terminal Recorder Listener

**File:** `src/features/terminal/recorder/index.ts`

**Problem:** `onDidStartTerminalShellExecution` listener (line 189) is never stored or pushed to `context.subscriptions`.

**Fix:** Push the returned disposable to `context.subscriptions`.

### 1.3 FileSystemWatcher Disposal + onDidCreate

**File:** `src/features/targets/sync/index.ts`

**Problem:** The `FileSystemWatcher` object (line 38) is stored locally but never pushed to `context.subscriptions`. Also, `onDidCreate` is not handled — new markdown files are not detected until modified.

**Fix:**
- Push the watcher itself to `context.subscriptions`
- Add `watcher.onDidCreate` handler that calls `ProcessMarkdownFileToWorkspaceState()` for the new file and `ProcessWorkspaceStateToEnvironmentCollects()` — same as the existing `onDidChange` handler

---

## 2. Terminal Bridge Fixes

### 2.1 Data Loss on Dispose

**File:** `src/features/terminal/bridge.ts`

**Problem:** In `dispose()` (line 233-234), `appendOutput` calls are fire-and-forget — promises not awaited. Terminal output data can be lost on extension deactivation.

**Fix:** Await `flushAllBuffers()` in `dispose()`. Change `dispose()` to return `Promise<void>` or use a sync guard pattern. Ensure the flush interval is cleared before flushing.

### 2.2 Byte/Character Truncation Mismatch

**File:** `src/features/terminal/bridge.ts`

**Problem:** Line 206: `content.slice(-MAX_OUTPUT_BYTES)` slices by character count, not byte count. Multi-byte UTF-8 content may exceed 64KB after encoding.

**Fix:** Use `Buffer.from(content, 'utf-8')` to get actual bytes, then `buffer.slice(-MAX_OUTPUT_BYTES).toString('utf-8')` to truncate correctly by bytes.

---

## 3. MCP Request Body Size Limit

**File:** `src/features/mcp/httpServer.ts`

**Problem:** No limit on incoming POST body size. Any local process can send a multi-GB request and exhaust memory.

**Fix:** In the HTTP request handler, accumulate body chunks and reject with 413 if total exceeds 1MB:
```typescript
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB
let bodySize = 0;
req.on('data', (chunk) => {
  bodySize += chunk.length;
  if (bodySize > MAX_BODY_SIZE) {
    res.writeHead(413).end('Request body too large');
    req.destroy();
  }
});
```

---

## 4. `var` → `const`/`let`

**19 occurrences across 11 files.** Replace each `var` with `const` (if never reassigned) or `let` (if reassigned).

Files:
- `src/features/notes/reports/index.ts`
- `src/features/http/commands/rawRequest.ts`
- `src/features/notes/noteProvider.ts`
- `src/features/targets/commands/switchHost.ts`
- `src/features/setup/setupCommand.ts`
- `src/features/tasks/ui/scanTaskProvider.ts`
- `src/core/domain/host.ts`
- `src/features/shell/commands/runCommand.ts`
- `src/features/shell/commandProvider.ts`
- `src/features/targets/commands/switchUser.ts`
- `src/features/targets/dumpProvider.ts`

---

## 5. Type Safety

### 5.1 Replace `callback` Type

**File:** `src/shared/types.ts`

**Current:** `export type callback = (...args: any[]) => any`

**Replace with:**
```typescript
export type CommandHandler = (args?: Record<string, unknown>) => unknown | Promise<unknown>;
```

Update all usages across registration sites. If specific command handlers need typed args, use narrower types at the call site.

### 5.2 Eliminate `any` Usage

- `catch (e: any)` → `catch (e: unknown)` + type guard: `if (e instanceof Error) { e.message }` else `String(e)`
- `args: any` → `args?: Record<string, unknown>` or specific types where possible
- `(bloodSnippet as any)[word]` → proper typed access with `Record<string, unknown>` or an index signature
- `(str as any) instanceof String` → `typeof str === 'string' || str instanceof String`

Files: `rawRequest.ts`, `requestToCurl.ts`, `recorder/index.ts`, `replaceDocument.ts`, `setupCommand.ts`, `blood.ts`, `variables.ts`, `filePicker.ts`, `scan.ts`

---

## 6. Dead Code & Dead Dependencies

### 6.1 Remove Dead Dependencies

**package.json:**
- Remove `vscode-variables` from `dependencies` (never imported; project uses its own `src/platform/vscode/variables.ts`)
- Remove `@types/lodash` from `devDependencies` (lodash never imported)
- Investigate `ts-morph` — if only used in scripts, note it; otherwise remove

### 6.2 Remove Dead Exports

Remove the `export` keyword (or delete the entire function if unused internally):

| Symbol | File | Action |
|--------|------|--------|
| `variablesWithCommands` | `src/platform/vscode/variables.ts` | Delete function (30 lines, never called) |
| `checkEnvironmentSetup` | `src/features/setup/setupCommand.ts` | Delete function (never called) |
| `ReadOnlyProvider` | `src/features/editor/commands/displayVirtualContent.ts` | Remove export (keep if used internally) |
| `registerVariablesWatcher` | `src/features/targets/sync/index.ts` | Remove export |
| `EventListener` | `src/features/terminal/recorder/store.ts` | Remove export |
| `FindingFilter` | `src/core/domain/finding.ts` | Remove export |
| `definitionSearcher` | `src/features/definitions/baseProvider.ts` | Remove export |
| `TerminalInfo` | `src/features/terminal/bridge.ts` | Remove export |
| `getExtensionContext` | `src/features/mcp/install.ts` | Delete (legacy, redundant with Context.context) |
| `getCodeblock` | `src/features/targets/sync/markdownSync.ts` | Remove export |
| `hash_mode_collects` | `src/platform/vscode/defaultCollects.ts` | Remove individual export (keep internal) |
| `hash_device_collects` | `src/platform/vscode/defaultCollects.ts` | Remove individual export |
| `hash_type_collects` | `src/platform/vscode/defaultCollects.ts` | Remove individual export |
| `hash_collects` | `src/platform/vscode/defaultCollects.ts` | Remove individual export |

Also remove the duplicate `_context` module-level singleton in `mcp/install.ts` (lines 107-115) — use `Context.context` instead.

---

## 7. Command ID Constants

**New file:** `src/shared/commands.ts`

Extract all command ID strings into a single `Commands` const object:

```typescript
export const Commands = {
  // Management
  SETUP: 'weapon.setup',
  SWITCH_HOST: 'weapon.switch_host',
  SWITCH_USER: 'weapon.switch_user',
  DUMP_HOSTS: 'weapon.dump_hosts',
  DUMP_USERS: 'weapon.dump_users',
  MCP_INSTALL: 'weapon.mcp.install',
  NOTE_CREATION: 'weapon.note.creation',

  // Internal
  RUN_COMMAND: 'weapon.run_command',
  COPY: 'weapon.copy',
  REPLACE_DOCUMENT: 'weapon.replace_document',
  DISPLAY_VIRTUAL: 'weapon.display_virtual_content',

  // Tasks
  TASK_MSFVENOM: 'weapon.task.msfvenom_creation',
  TASK_HASHCAT: 'weapon.task.hashcat_cracker',
  TASK_SCAN: 'weapon.task.scan',

  // HTTP
  HTTP_RAW_REQUEST: 'weapon.http_raw_request',
  HTTP_TO_CURL: 'weapon.http_raw_request_to_curl',

  // Features
  MAGIC_DECODER: 'weapon.magic_decoder',
  TERMINAL_LOGGER_REGISTER: 'weaponized.terminal-logger.register',
  TERMINAL_LOGGER_UNREGISTER: 'weaponized.terminal-logger.unregister',

  // External
  FOAM_SHOW_GRAPH: 'foam-vscode.show-graph',
} as const;
```

Replace all hardcoded command ID strings in `registerCommands.ts` and CodeLens providers with `Commands.X` references.

---

## 8. Documentation: Extension ID Fix

**Problem:** The extension ID changed from `Esonhugh.weaponized` to `WeaponizedVSCode.core`. Docs still reference the old ID.

**Files to update:**
- `docs/guide/getting-started.md` — line 65: `install \`Esonhugh.weaponized\`` → `WeaponizedVSCode.core`
- `docs/zh/guide/getting-started.md` — corresponding line
- `src/features/mcp/httpServer.ts` — line 62: MCP server name `"weaponized-vscode"` version `"0.4.0"` → update version to match package.json
- Any other references found via grep

Also update the MCP server version string to match the actual extension version from `package.json`.

---

## Out of Scope (Phase 2 & 3)

The following are explicitly **not** in Phase 1:
- ESLint config changes (Phase 2)
- tsconfig strict checks (Phase 2)
- httpServer.ts file decomposition (Phase 3)
- MCP cross-feature decoupling (Phase 3)
- Context singleton refactoring (Phase 3)
- Activation parallelization (Phase 3)
- Unit test additions (Phase 3)
