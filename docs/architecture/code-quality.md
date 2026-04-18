# Code Quality

## Overview

This document tracks known code quality issues in the codebase, ordered by severity. Previously fixed issues (Foam await, static Foam(), activation error boundaries, let→const, state getter caching, duplicate is_dc) have been removed.

---

## Medium Severity

### 1. `defaultCollects` Partially Eager

**File:** `src/platform/vscode/defaultCollects.ts`

A `getDefaultCollects()` function was added to read configuration lazily, but the module still exports a `const defaultCollects = getDefaultCollects()` that evaluates at import time. This means settings changes at runtime (user edits `settings.json`) won't take effect until extension reload.

**Fix:** Remove the module-level constant. Have `ProcessWorkspaceStateToEnvironmentCollects` call `getDefaultCollects()` directly. Add a `onDidChangeConfiguration` listener to re-run env var injection when `weaponized.*` settings change.

### 2. `callback` Type is Unsafe

**File:** `src/shared/types.ts`

The shared `callback` type is `(...args: any[]) => any`, which defeats TypeScript's type checking. All command handlers use this type.

**Fix:** Either remove it and type each handler properly, or tighten to `(...args: unknown[]) => unknown`.

### 3. SSL Verification Disabled Globally

**File:** `src/features/http/commands/rawRequest.ts`

For HTTPS requests, the code sets `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` (process-wide side effect) and `rejectUnauthorized: false` on the agent. This is intentional for pentest targets with self-signed certs, but:
- The env var leaks to the entire Node process, not just this request
- No user-facing warning is shown

**Fix:** Remove the env var mutation. The per-agent `rejectUnauthorized: false` is sufficient. Optionally add a visual indicator in the response output.

### 4. Inconsistent Error Handling in Foam Access

**File:** `src/platform/vscode/context.ts`

The `Foam()` static method has three code paths. The "extension not active → activate it" path lacks a try/catch. If `foamExtension.activate()` rejects, it becomes an unhandled promise rejection.

**Fix:** Wrap the activate + export-read sequence in a single try/catch, returning `undefined` on failure.

---

## Low Severity / Style

### 5. Missing `.editorconfig`

No `.editorconfig` at project root. Adding one ensures consistent formatting (2-space indent, LF, UTF-8, trailing whitespace trim) across editors.

### 6. Python Dependency for Code Generation

`scripts/gen-setup.py` and `scripts/gen-report-assets.py` only base64-encode files and emit TypeScript. They could be rewritten as TypeScript scripts (via `tsx`) to eliminate the Python 3 prerequisite.

### 7. ESLint Configuration

Consider enabling these rules:

- `@typescript-eslint/no-floating-promises`: catches missing awaits
- `@typescript-eslint/no-explicit-any`: flags `any` usage
- `no-console`: encourages use of the logger

---

## Prioritized Fix Order

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | defaultCollects eager eval (#1) | 30 min | Settings hot-reload |
| 2 | Foam error handling (#4) | 15 min | Reliability |
| 3 | SSL global side effect (#3) | 10 min | Security hygiene |
| 4 | callback type (#2) | 30 min | Type safety |
| 5 | ESLint rules (#7) | 30 min | Long-term quality |
| 6 | .editorconfig (#5) | 5 min | Consistency |
| 7 | Python → TS codegen (#6) | 1 hour | Fewer prerequisites |
