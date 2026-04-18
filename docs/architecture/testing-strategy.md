# Testing Strategy

## Current State

The project has 7 unit test files covering `core/` domain logic and markdown parsing. Tests use **Mocha** (`suite`/`test`) with **Node.js `assert`**. The test infrastructure uses `@vscode/test-cli` and `@vscode/test-electron`.

```
src/test/unit/
  core/
    domain/
      host.test.ts          — Host model: init, defaults, env export, dump formats
      user.test.ts          — UserCredential model: init, env export, dump formats
      finding.test.ts       — Finding parsing from markdown frontmatter
      graph.test.ts         — Relationship graph + Tarjan SCC
    env/
      collects.test.ts      — mergeCollects priority behavior
    markdown/
      fencedBlocks.test.ts  — Fenced code block extraction
      yamlBlocks.test.ts    — YAML block extraction by identity
```

---

## Running Tests

```bash
pnpm run compile-tests    # Compile to out/ via tsc
pnpm run test:unit        # Run unit tests
```

In CI, use `xvfb-run` for headless VS Code test execution (Linux).

---

## Testing Pyramid

| Layer | What to Test | How | Target Coverage |
|-------|-------------|-----|----------------|
| `core/` | Domain models, parsing, graph algorithms | Pure unit tests, no mocks needed | 90%+ |
| `platform/vscode/` | Context caching, variable resolution, env collection | Mock `workspaceState` and `vscode.workspace` | 60%+ |
| `features/` | Command handlers, sync logic, MCP tool handlers | Mock Context + VS Code APIs | 70%+ |
| E2E | Activation, file sync, full command workflows | `@vscode/test-electron` with test workspace | Critical paths |

---

## What's Covered

The existing unit tests focus on the `core/` layer:

- **Host/User models**: initialization with full/minimal/missing data, default values, environment variable export (`exportEnvironmentCollects`), dump format outputs (env, hosts file, yaml, table, impacket, nxc)
- **Finding**: parsing frontmatter fields (severity, tags, description) from markdown
- **Graph**: node/edge construction from Foam resources, Tarjan SCC computation, longest path calculation
- **Collects**: `mergeCollects` first-writer-wins behavior, priority ordering
- **Markdown parsing**: fenced block extraction (with/without language tags), YAML block extraction by identity keyword

---

## Gaps

| Area | Gap | Difficulty |
|------|-----|-----------|
| `platform/vscode/context.ts` | Dirty-flag caching, Foam() lifecycle | Medium — needs `workspaceState` mock |
| `platform/vscode/variables.ts` | Variable resolution (`${env:X}`, `${config:X}`) | Easy — pure string processing |
| `features/targets/sync` | File watcher → state rebuild pipeline | Medium — needs filesystem + Context mock |
| `features/mcp/httpServer.ts` | MCP tool handlers return correct data | Medium — needs Context mock |
| `features/ai/participant.ts` | Prompt construction, command routing | Easy — mock `vscode.lm` |
| `features/http/rawRequest.ts` | HTTP request execution | Hard — needs HTTP mock |

---

## Writing Tests

Use Mocha `suite`/`test` with Node.js `assert`. Mirror the source directory structure under `src/test/unit/`:

```
Source: src/core/domain/host.ts
Test:   src/test/unit/core/domain/host.test.ts
```

Key patterns used in existing tests:
- `suite("ClassName")` groups related tests
- `test("method() with scenario")` names describe input conditions
- `assert.equal` / `assert.deepEqual` / `assert.ok` for assertions
- Direct instantiation — no DI framework, just `new Host().init({...})`
- No external test fixtures — test data is inline in each test file
