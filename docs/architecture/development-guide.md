# Development Guide

## Prerequisites

- **Node.js** >= 23.11.0
- **pnpm** >= 10
- **VS Code** >= 1.101.0
- **Python 3** (for `gen-setup.py` and `gen-report-assets.py` code generators)
- **Foam extension** (`foam.foam-vscode`) installed in VS Code

## Quick Start

```bash
# Clone and install
git clone https://github.com/WeaponizedVSCode/Extension.git
cd Extension
pnpm install

# Build
pnpm run compile

# Run tests
pnpm run compile-tests
pnpm run test:unit

# Launch in debug mode
# Press F5 in VS Code (uses .vscode/launch.json)
```

---

## Build System

### Webpack

The extension is bundled with webpack into a single `dist/extension.js` file.

| Script | Command | Purpose |
|--------|---------|---------|
| `compile` | `webpack` | Development build |
| `watch` | `webpack --watch` | Watch mode |
| `package` | `webpack --mode production` | Production build |

**Webpack config** (`webpack.config.js`):
- Target: `node`
- Entry: `./src/extension.ts`
- Output: `dist/extension.js` (`commonjs2`)
- Externals: `vscode` (provided by extension host)
- Loader: `ts-loader`

### TypeScript

**`tsconfig.json`**:
- Module: `Node16`, Target: `ES2022`
- Strict mode enabled
- Types: `node`, `mocha`

Tests compile separately via `compile-tests` → `tsc -p . --outDir out`.

### Code Generation

Two Python scripts run during `pnpm install` (via `prepare` hook):
- `scripts/gen-setup.py` — generates workspace template TypeScript
- `scripts/gen-report-assets.py` — generates report asset TypeScript

---

## Coding Conventions

### Naming

| Category | Convention | Examples |
|----------|-----------|---------|
| Variables, functions, parameters | `camelCase` | `currentHost`, `parseHostsYaml()` |
| Classes | `PascalCase` | `Host`, `EmbeddedMcpServer`, `TerminalBridge` |
| Interfaces & type aliases | `PascalCase` | `Finding`, `GraphNode`, `Collects` |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_MCP_PORT`, `MAX_OUTPUT_BYTES` |
| Command IDs | `dot.separated_lowercase` | `weapon.dump_hosts`, `weapon.switch_host` |
| Settings | `dotted.camelCase` | `weaponized.ai.enabled`, `weaponized.mcp.port` |

### Types vs Interfaces

- **Interfaces**: for domain entities and shapes that may be implemented — `Finding`, `GraphNode`, `Foam`, `TerminalInfo`
- **Type aliases**: for unions, function signatures, and simple mapped types — `HostDumpFormat`, `Collects`, `FencedBlock`

### Command Handlers

All command handlers follow this pattern:

```typescript
// features/<name>/commands/<action>.ts
import { callback } from "../../../shared/types";

export const myCommand: callback = async (args) => {
  // args is a single object with known properties
  const { someParam } = args;
  // ...
};
```

Register in `registerCommands.ts`:

```typescript
context.subscriptions.push(
  vscode.commands.registerCommand("weapon.my_command", myCommand)
);
```

### Feature Registration

Every feature exposes a registration function:

```typescript
// features/<name>/index.ts
export function registerMyFeature(context: vscode.ExtensionContext) {
  // Register commands, providers, watchers
  context.subscriptions.push(/* ... */);
}
```

Called from `activate.ts` inside a try/catch block.

### Error Handling

- **Activation level**: each `register*()` wrapped in try/catch with `logger.error()`
- **Command level**: `vscode.window.showErrorMessage()` for user-facing errors
- **MCP server**: try/catch returning HTTP 500 on failure
- No custom exception classes — use standard `Error`

### State Access

Always go through `Context` for shared state:

```typescript
import { Context } from "../../platform/vscode/context";

// Read
const hosts = Context.HostState;
const users = Context.UserState;
const foam = await Context.Foam();

// Write
Context.HostState = updatedHosts;
```

Never access `workspaceState` directly from feature code.

---

## Adding a New Feature

### 1. Create the feature directory

```
src/features/my-feature/
  index.ts              # Registration function
  commands/
    doSomething.ts      # Command handler
  codelens/             # (if applicable)
    register.ts
    myProvider.ts
```

### 2. Implement command handlers

```typescript
// src/features/my-feature/commands/doSomething.ts
import { callback } from "../../../shared/types";
import { Context } from "../../../platform/vscode/context";
import * as vscode from "vscode";

export const doSomething: callback = async () => {
  const hosts = Context.HostState;
  if (!hosts) {
    vscode.window.showWarningMessage("No hosts found.");
    return;
  }
  // Feature logic...
};
```

### 3. Register in index.ts

```typescript
// src/features/my-feature/index.ts
import * as vscode from "vscode";
import { doSomething } from "./commands/doSomething";

export function registerMyFeature(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("weapon.my_feature", doSomething)
  );
}
```

### 4. Wire into activation

```typescript
// src/app/activate.ts
import { registerMyFeature } from "../features/my-feature";

// In activateExtension():
try {
  registerMyFeature(context);
} catch (e) {
  logger.error("Failed to register my feature:", e);
}
```

### 5. Add command to package.json

```jsonc
{
  "contributes": {
    "commands": [
      {
        "command": "weapon.my_feature",
        "title": "My Feature Action",
        "category": "weapon feature"
      }
    ]
  }
}
```

---

## Adding Domain Logic

Domain logic belongs in `core/` — **never import `vscode` here**.

```typescript
// src/core/domain/myModel.ts
import type { Collects } from "../env/collects";

export interface MyModel {
  name: string;
  value: number;
}

export function parseMyModel(yaml: string): MyModel[] {
  // Pure parsing logic, no VS Code dependency
}
```

Re-export from `core/domain/index.ts` and `core/index.ts`.

---

## Adding an MCP Tool

Add to `EmbeddedMcpServer.registerTools()` in `src/features/mcp/httpServer.ts`:

```typescript
server.tool(
  "my_tool",
  "Description of what this tool does",
  {
    param: z.string().describe("Parameter description"),
  },
  async ({ param }) => {
    // Implementation using Context, TerminalBridge, etc.
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);
```

---

## Testing

### Structure

Tests live in `src/test/unit/` and mirror the `core/` directory structure:

```
src/test/unit/
  core/
    domain/
      host.test.ts
      user.test.ts
      finding.test.ts
      graph.test.ts
    env/
      collects.test.ts
    markdown/
      fencedBlocks.test.ts
      yamlBlocks.test.ts
```

### Writing Tests

Use Mocha `suite`/`test` with Node.js `assert`:

```typescript
import { strict as assert } from "assert";
import { Host } from "../../../core/domain/host";

suite("Host", () => {
  test("init() with full data", () => {
    const host = new Host().init({
      hostname: "dc01.corp.local",
      ip: "10.10.10.100",
      is_dc: true,
    });
    assert.equal(host.hostname, "dc01.corp.local");
    assert.equal(host.is_dc, true);
  });
});
```

### Running Tests

```bash
pnpm run compile-tests    # Compile tests to out/
pnpm run test:unit        # Run unit tests (requires Xvfb on Linux)
```

In CI, use `xvfb-run` for headless VS Code test execution.

---

## Configuration

All settings live under the `weaponized.*` namespace. Read via:

```typescript
const config = vscode.workspace.getConfiguration("weaponized");
const port = config.get<number>("mcp.port", 25789);
const aiEnabled = config.get<boolean>("ai.enabled", true);
```

To add a new setting, add it to `package.json` under `contributes.configuration.properties`.

---

## Git Workflow

- **`master`**: stable branch, CI + docs deploy on push
- **Feature branches**: develop on topic branches, merge via PR
- **Commit message format**: `type(scope): description`
  - Types: `feat`, `fix`, `refactor`, `docs`, `ci`, `test`, `chore`
  - Scope: feature name or general area
  - Examples: `feat(mcp): add create_terminal tool`, `fix: CI build chain`
- **Tags**: trigger release builds (`.github/workflows/build.yml`)

---

## Linting

```bash
pnpm run lint     # ESLint on src/
```

ESLint config is in `eslint.config.mjs`. Key rules: `prefer-const`, TypeScript strict checks.
