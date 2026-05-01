# Intent Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the AI-assisted pentest feedback loop — Intent data model, workspaceState queue, 5 new MCP tools + 1 enhanced tool, VS Code TreeView UI, and Skill doc update.

**Architecture:** `Intent` and `Goal` types live in `src/core/domain/intent.ts` (zero VS Code dependency). `IntentQueue` is a static class in `src/features/intent/queue/intentQueue.ts` that reads/writes `workspaceState` via `Context.context`. `IntentTreeProvider` holds an `EventEmitter` for VS Code refresh; MCP tools and commands both call `provider.refresh()` after mutations.

**Tech Stack:** TypeScript, VS Code Extension API (`workspaceState`, `TreeDataProvider`), MCP SDK (`@modelcontextprotocol/sdk`), Zod (already used for MCP tool schemas)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/core/domain/intent.ts` | Create | `IntentStatus`, `Intent`, `Goal` types — zero VS Code dependency |
| `src/core/domain/index.ts` | Modify | Export new `intent.ts` types |
| `src/features/intent/queue/intentQueue.ts` | Create | Static CRUD class over `workspaceState` |
| `src/features/intent/treeview/intentTreeProvider.ts` | Create | VS Code `TreeDataProvider` for Intent sidebar |
| `src/features/intent/treeview/register.ts` | Create | Register TreeView and return provider reference |
| `src/features/intent/commands/approveIntent.ts` | Create | `weapon.intent.approve` command handler |
| `src/features/intent/commands/skipIntent.ts` | Create | `weapon.intent.skip` command handler |
| `src/features/intent/index.ts` | Create | Barrel — `registerIntentFeature()` |
| `src/features/mcp/httpServer.ts` | Modify | Add 5 MCP tools + enhance `get_engagement_summary` |
| `src/app/activate.ts` | Modify | Call `registerIntentFeature()`, pass provider to `EmbeddedMcpServer` |
| `src/app/registerCommands.ts` | Modify | Register `weapon.intent.approve` and `weapon.intent.skip` |
| `src/shared/commands.ts` | Modify | Add `INTENT_APPROVE` and `INTENT_SKIP` constants |
| `package.json` | Modify | Add viewsContainers, views, commands, menus contribution points |
| `resources/icons/intent.svg` | Create | SVG icon for activity bar |
| `docs/skills/pentest-with-weaponized/SKILL.md` | Modify | Add Goal & Intent tool table + Pattern 5 + rules |
| `src/test/unit/core/domain/intent.test.ts` | Create | Unit tests for `IntentStatus` values, `Intent` fields, `Goal` structure |

---

## Task 1: Domain types — `src/core/domain/intent.ts`

**Files:**
- Create: `src/core/domain/intent.ts`
- Test: `src/test/unit/core/domain/intent.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/test/unit/core/domain/intent.test.ts
import { describe, it } from "mocha";
import * as assert from "assert";
import type { Intent, IntentStatus, Goal } from "../../../core/domain/intent";

describe("Intent domain types", () => {
  it("IntentStatus includes all expected values", () => {
    const statuses: IntentStatus[] = [
      "pending", "approved", "running", "completed", "dismissed", "elevated",
    ];
    assert.strictEqual(statuses.length, 6);
  });

  it("Intent has all required fields", () => {
    const intent: Intent = {
      id: "intent-1",
      hypothesis: "DC01 is Kerberoastable",
      reasoning: "Finding F-001 shows SPNs present",
      command: "impacket-GetUserSPNs corp.local/user:pass -dc-ip 10.0.0.1",
      expected_outcome: "SPN list returned with at least one entry",
      status: "pending",
      created_at: "2026-04-30T00:00:00.000Z",
      updated_at: "2026-04-30T00:00:00.000Z",
    };
    assert.strictEqual(intent.id, "intent-1");
    assert.strictEqual(intent.status, "pending");
    assert.strictEqual(intent.terminal_id, undefined);
    assert.strictEqual(intent.output, undefined);
    assert.strictEqual(intent.finding_id, undefined);
    assert.strictEqual(intent.dismissed_reason, undefined);
  });

  it("Goal has required fields and optional phase/constraints", () => {
    const goal: Goal = {
      description: "Get domain admin on corp.local",
      updated_at: "2026-04-30T00:00:00.000Z",
    };
    assert.strictEqual(goal.description, "Get domain admin on corp.local");
    assert.strictEqual(goal.phase, undefined);
    assert.strictEqual(goal.constraints, undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --grep "Intent domain types"`
Expected: FAIL — `cannot find module '../../../core/domain/intent'`

- [ ] **Step 3: Create `src/core/domain/intent.ts`**

```typescript
// src/core/domain/intent.ts

export type IntentStatus =
  | "pending"
  | "approved"
  | "running"
  | "completed"
  | "dismissed"
  | "elevated";

export interface Intent {
  id: string;
  hypothesis: string;
  reasoning: string;
  command: string;
  expected_outcome: string;
  status: IntentStatus;
  terminal_id?: string;
  output?: string;
  finding_id?: string;
  dismissed_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  description: string;
  phase?: string;
  constraints?: string;
  updated_at: string;
}
```

- [ ] **Step 4: Export from `src/core/domain/index.ts`**

Add to the existing `src/core/domain/index.ts`:
```typescript
export * from "./intent";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --grep "Intent domain types"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/domain/intent.ts src/core/domain/index.ts src/test/unit/core/domain/intent.test.ts
git commit -m "feat(domain): add Intent and Goal types for intent loop"
```

---

## Task 2: IntentQueue — workspaceState CRUD

**Files:**
- Create: `src/features/intent/queue/intentQueue.ts`

- [ ] **Step 1: Create `src/features/intent/queue/intentQueue.ts`**

```typescript
// src/features/intent/queue/intentQueue.ts
import type { Intent, IntentStatus, Goal } from "../../../core/domain/intent";
import { Context } from "../../../platform/vscode/context";

const QUEUE_KEY = "weaponized.intentQueue";
const GOAL_KEY = "weaponized.goal";
const ARCHIVED_STATUSES: IntentStatus[] = ["completed", "dismissed", "elevated"];
const MAX_ARCHIVED = 50;

export class IntentQueue {
  static getAll(): Intent[] {
    return Context.context.workspaceState.get<Intent[]>(QUEUE_KEY) ?? [];
  }

  static getByStatus(status: IntentStatus): Intent[] {
    return IntentQueue.getAll().filter((i) => i.status === status);
  }

  static getById(id: string): Intent | undefined {
    return IntentQueue.getAll().find((i) => i.id === id);
  }

  static add(intent: Intent): void {
    const all = IntentQueue.getAll();
    all.push(intent);
    IntentQueue.saveAll(all);
    IntentQueue.pruneArchived();
  }

  static update(id: string, updates: Partial<Intent>): void {
    const all = IntentQueue.getAll();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
    IntentQueue.saveAll(all);
  }

  static getGoal(): Goal | null {
    return Context.context.workspaceState.get<Goal>(GOAL_KEY) ?? null;
  }

  static setGoal(goal: Goal): void {
    Context.context.workspaceState.update(GOAL_KEY, goal);
  }

  private static saveAll(intents: Intent[]): void {
    Context.context.workspaceState.update(QUEUE_KEY, intents);
  }

  private static pruneArchived(): void {
    const all = IntentQueue.getAll();
    const archived = all
      .filter((i) => ARCHIVED_STATUSES.includes(i.status))
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    if (archived.length > MAX_ARCHIVED) {
      const toRemove = new Set(
        archived.slice(0, archived.length - MAX_ARCHIVED).map((i) => i.id)
      );
      IntentQueue.saveAll(all.filter((i) => !toRemove.has(i.id)));
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/intent/queue/intentQueue.ts
git commit -m "feat(intent): add IntentQueue static class for workspaceState CRUD"
```

---

## Task 3: Intent SVG icon

**Files:**
- Create: `resources/icons/intent.svg`

- [ ] **Step 1: Create the SVG icon**

```xml
<!-- resources/icons/intent.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <line x1="12" y1="8" x2="12" y2="12"/>
  <line x1="12" y1="16" x2="12.01" y2="16"/>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add resources/icons/intent.svg
git commit -m "feat(intent): add intent activity bar icon"
```

---

## Task 4: package.json contribution points

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add viewsContainers, views, intent commands, and menus to `package.json`**

In the `"contributes"` object, add the following sections. Insert `viewsContainers` and `views` as new top-level keys under `contributes`. Add new entries to the existing `"commands"` array. Add a `"menus"` key.

Add to `contributes.viewsContainers`:
```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "weaponized-intent",
      "title": "Weapon Intents",
      "icon": "resources/icons/intent.svg"
    }
  ]
}
```

Add to `contributes.views`:
```json
"views": {
  "weaponized-intent": [
    {
      "id": "weaponized.intentView",
      "name": "Intents"
    }
  ]
}
```

Add to `contributes.commands` array:
```json
{
  "command": "weapon.intent.approve",
  "title": "Approve Intent",
  "icon": "$(check)",
  "category": "weapon intent"
},
{
  "command": "weapon.intent.skip",
  "title": "Skip Intent",
  "icon": "$(close)",
  "category": "weapon intent"
},
{
  "command": "weapon.intent.setGoal",
  "title": "Weapon: Set Engagement Goal",
  "category": "weapon intent"
}
```

Add to `contributes.menus`:
```json
"menus": {
  "view/item/context": [
    {
      "command": "weapon.intent.approve",
      "when": "view == weaponized.intentView && viewItem == intent-pending",
      "group": "inline"
    },
    {
      "command": "weapon.intent.skip",
      "when": "view == weaponized.intentView && viewItem == intent-pending",
      "group": "inline"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat(intent): add TreeView and command contribution points to package.json"
```

---

## Task 5: Add command constants

**Files:**
- Modify: `src/shared/commands.ts`

- [ ] **Step 1: Add intent command constants to `src/shared/commands.ts`**

In the `Commands` object, add after the existing entries:
```typescript
// Intent
INTENT_APPROVE: 'weapon.intent.approve',
INTENT_SKIP: 'weapon.intent.skip',
INTENT_SET_GOAL: 'weapon.intent.setGoal',
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/commands.ts
git commit -m "feat(intent): add intent command constants"
```

---

## Task 6: IntentTreeProvider

**Files:**
- Create: `src/features/intent/treeview/intentTreeProvider.ts`
- Create: `src/features/intent/treeview/register.ts`

- [ ] **Step 1: Create `src/features/intent/treeview/intentTreeProvider.ts`**

```typescript
// src/features/intent/treeview/intentTreeProvider.ts
import * as vscode from "vscode";
import type { Intent, IntentStatus, Goal } from "../../../core/domain/intent";
import { IntentQueue } from "../queue/intentQueue";

type GroupLabel = "Pending" | "Approved" | "Running" | "Completed" | "Dismissed" | "Elevated";

const STATUS_ORDER: IntentStatus[] = [
  "pending", "approved", "running", "completed", "dismissed", "elevated",
];
const STATUS_LABELS: Record<IntentStatus, GroupLabel> = {
  pending: "Pending",
  approved: "Approved",
  running: "Running",
  completed: "Completed",
  dismissed: "Dismissed",
  elevated: "Elevated",
};

export class IntentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly intent: Intent,
  ) {
    super(intent.hypothesis, vscode.TreeItemCollapsibleState.None);
    this.description = intent.command;
    this.tooltip = `${intent.hypothesis}\n\nReasoning: ${intent.reasoning}\nCommand: ${intent.command}\nExpected: ${intent.expected_outcome}`;
    this.contextValue = `intent-${intent.status}`;
  }
}

export class IntentGroupItem extends vscode.TreeItem {
  constructor(label: string, public readonly status: IntentStatus, count: number) {
    super(`${label} (${count})`, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "intent-group";
    if (status === "completed" || status === "dismissed" || status === "elevated") {
      this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }
  }
}

export class GoalItem extends vscode.TreeItem {
  constructor(goal: Goal | null) {
    const label = goal ? `Goal: ${goal.description}` : "Goal: (not set)";
    super(label, vscode.TreeItemCollapsibleState.None);
    if (goal?.phase) {
      this.description = goal.phase;
    }
    this.contextValue = "intent-goal";
    this.command = {
      command: "weapon.intent.setGoal",
      title: "Set Goal",
    };
  }
}

type TreeNode = GoalItem | IntentGroupItem | IntentTreeItem;

export class IntentTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      // Root: goal item + one group per status that has intents
      const goal = IntentQueue.getGoal();
      const all = IntentQueue.getAll();
      const goalItem = new GoalItem(goal);
      const groups: IntentGroupItem[] = [];
      for (const status of STATUS_ORDER) {
        const count = all.filter((i) => i.status === status).length;
        if (count > 0) {
          groups.push(new IntentGroupItem(STATUS_LABELS[status], status, count));
        }
      }
      return [goalItem, ...groups];
    }

    if (element instanceof IntentGroupItem) {
      const intents = IntentQueue.getByStatus(element.status);
      return intents.map((i) => new IntentTreeItem(i));
    }

    return [];
  }
}
```

- [ ] **Step 2: Create `src/features/intent/treeview/register.ts`**

```typescript
// src/features/intent/treeview/register.ts
import * as vscode from "vscode";
import { IntentTreeProvider } from "./intentTreeProvider";

export function registerIntentTreeView(context: vscode.ExtensionContext): IntentTreeProvider {
  const provider = new IntentTreeProvider();
  const treeView = vscode.window.createTreeView("weaponized.intentView", {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);
  return provider;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/intent/treeview/intentTreeProvider.ts src/features/intent/treeview/register.ts
git commit -m "feat(intent): add IntentTreeProvider and TreeView registration"
```

---

## Task 7: Approve and Skip command handlers

**Files:**
- Create: `src/features/intent/commands/approveIntent.ts`
- Create: `src/features/intent/commands/skipIntent.ts`

- [ ] **Step 1: Create `src/features/intent/commands/approveIntent.ts`**

```typescript
// src/features/intent/commands/approveIntent.ts
import type { IntentTreeItem } from "../treeview/intentTreeProvider";
import { IntentQueue } from "../queue/intentQueue";
import type { IntentTreeProvider } from "../treeview/intentTreeProvider";

export function createApproveIntentHandler(provider: IntentTreeProvider) {
  return (item: IntentTreeItem) => {
    if (!item?.intent) return;
    IntentQueue.update(item.intent.id, { status: "approved" });
    provider.refresh();
  };
}
```

- [ ] **Step 2: Create `src/features/intent/commands/skipIntent.ts`**

```typescript
// src/features/intent/commands/skipIntent.ts
import * as vscode from "vscode";
import type { IntentTreeItem } from "../treeview/intentTreeProvider";
import { IntentQueue } from "../queue/intentQueue";
import type { IntentTreeProvider } from "../treeview/intentTreeProvider";

export function createSkipIntentHandler(provider: IntentTreeProvider) {
  return async (item: IntentTreeItem) => {
    if (!item?.intent) return;
    const reason = await vscode.window.showInputBox({
      prompt: "Reason for dismissing this intent",
      placeHolder: "e.g. target not reachable, assumption invalidated",
    });
    IntentQueue.update(item.intent.id, {
      status: "dismissed",
      dismissed_reason: reason ?? "dismissed by user",
    });
    provider.refresh();
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/intent/commands/approveIntent.ts src/features/intent/commands/skipIntent.ts
git commit -m "feat(intent): add approve and skip command handlers"
```

---

## Task 8: Feature barrel and `registerIntentFeature()`

**Files:**
- Create: `src/features/intent/index.ts`

- [ ] **Step 1: Create `src/features/intent/index.ts`**

```typescript
// src/features/intent/index.ts
import * as vscode from "vscode";
import { registerIntentTreeView } from "./treeview/register";
import { createApproveIntentHandler } from "./commands/approveIntent";
import { createSkipIntentHandler } from "./commands/skipIntent";
import { Commands } from "../../shared/commands";
import { IntentQueue } from "./queue/intentQueue";
import type { IntentTreeProvider } from "./treeview/intentTreeProvider";

export { IntentQueue } from "./queue/intentQueue";
export type { IntentTreeProvider } from "./treeview/intentTreeProvider";

export function registerIntentFeature(context: vscode.ExtensionContext): IntentTreeProvider {
  const provider = registerIntentTreeView(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      Commands.INTENT_APPROVE,
      createApproveIntentHandler(provider)
    ),
    vscode.commands.registerCommand(
      Commands.INTENT_SKIP,
      createSkipIntentHandler(provider)
    ),
    vscode.commands.registerCommand(Commands.INTENT_SET_GOAL, async () => {
      const description = await vscode.window.showInputBox({
        prompt: "Enter engagement goal",
        placeHolder: "e.g. Get domain admin on corp.local",
      });
      if (!description) return;
      const phase = await vscode.window.showQuickPick(
        ["reconnaissance", "scanning", "exploitation", "post-exploitation"],
        { placeHolder: "Select phase (optional)" }
      );
      const constraints = await vscode.window.showInputBox({
        prompt: "Constraints (optional)",
        placeHolder: "e.g. avoid noisy scans, no persistence",
      });
      IntentQueue.setGoal({
        description,
        phase: phase ?? undefined,
        constraints: constraints || undefined,
        updated_at: new Date().toISOString(),
      });
      provider.refresh();
    })
  );

  return provider;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/intent/index.ts
git commit -m "feat(intent): add registerIntentFeature barrel with all command registrations"
```

---

## Task 9: Wire Intent feature into `activate.ts`

**Files:**
- Modify: `src/app/activate.ts`

- [ ] **Step 1: Modify `src/app/activate.ts` to register Intent feature and pass provider to MCP server**

Add the import at the top:
```typescript
import { registerIntentFeature } from "../features/intent";
```

In `activateExtension`, add the Intent feature registration **before** the MCP server start block, and pass the provider to `EmbeddedMcpServer`. The current MCP server instantiation is:
```typescript
const mcpServer = new EmbeddedMcpServer();
const port = await mcpServer.start(terminalBridge, preferredPort);
```

Replace with:
```typescript
let intentProvider;
try {
  intentProvider = registerIntentFeature(context);
} catch (e) {
  logger.error("Failed to register intent feature:", e);
}

// ...existing mcpServer code...
const mcpServer = new EmbeddedMcpServer();
const port = await mcpServer.start(terminalBridge, preferredPort, intentProvider);
```

The full updated block inside the `if (terminalBridge)` check (lines 94–105 of current `activate.ts`):
```typescript
if (terminalBridge) {
  let intentProvider;
  try {
    intentProvider = registerIntentFeature(context);
  } catch (e) {
    logger.error("Failed to register intent feature:", e);
  }

  try {
    const preferredPort = config.get<number>("mcp.port", DEFAULT_MCP_PORT);
    const mcpServer = new EmbeddedMcpServer();
    const port = await mcpServer.start(terminalBridge, preferredPort, intentProvider);
    setEmbeddedMcpServer(mcpServer);
    context.subscriptions.push({ dispose: () => mcpServer.stop() });
    await autoUpdateMcpConfig(port);
    logger.info(`Embedded MCP server started on port ${port}`);
  } catch (e) {
    logger.error("Failed to start embedded MCP server:", e);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/activate.ts
git commit -m "feat(intent): wire registerIntentFeature into extension activation"
```

---

## Task 10: Update `EmbeddedMcpServer` — accept provider + 5 new MCP tools + enhance `get_engagement_summary`

**Files:**
- Modify: `src/features/mcp/httpServer.ts`

- [ ] **Step 1: Add import for IntentQueue and types at top of `httpServer.ts`**

Add after line 17 (existing imports):
```typescript
import { IntentQueue } from "../intent/queue/intentQueue";
import type { IntentTreeProvider } from "../intent/treeview/intentTreeProvider";
import type { Intent, IntentStatus } from "../../core/domain/intent";
```

- [ ] **Step 2: Update `EmbeddedMcpServer` class to hold provider reference**

Change the class opening and `start` method signature. Currently `start` takes `(terminalBridge: TerminalBridge, preferredPort: number)`. Change to accept an optional third parameter:

```typescript
export class EmbeddedMcpServer {
  private httpServer: http.Server | undefined;
  private port = 0;
  private findingMap = new FindingMap();
  private intentProvider: IntentTreeProvider | undefined;

  getPort(): number {
    return this.port;
  }

  async start(terminalBridge: TerminalBridge, preferredPort: number, intentProvider?: IntentTreeProvider): Promise<number> {
    this.intentProvider = intentProvider;
    // ... rest of start method unchanged
```

- [ ] **Step 3: Update `registerTools` signature to pass provider through**

Change line `self.registerTools(server, terminalBridge);` to:
```typescript
self.registerTools(server, terminalBridge, self.intentProvider);
```

Change the `registerTools` method signature:
```typescript
private registerTools(server: McpServer, bridge: TerminalBridge, intentProvider?: IntentTreeProvider): void {
```

- [ ] **Step 4: Add `set_goal` and `get_goal` MCP tools at the end of `registerTools`, before the closing brace**

```typescript
server.tool(
  "set_goal",
  "Set the current penetration testing engagement goal and phase constraints. Call this at the start of an engagement or when switching attack phase.",
  {
    description: z.string().describe("Goal description — e.g. 'Get domain admin on corp.local'"),
    phase: z.enum(["reconnaissance", "scanning", "exploitation", "post-exploitation"]).optional().describe("Current attack phase"),
    constraints: z.string().optional().describe("Constraints to operate within — e.g. 'avoid noisy scans, no persistence'"),
  },
  async ({ description, phase, constraints }) => {
    logger.debug("MCP tool: set_goal");
    IntentQueue.setGoal({ description, phase, constraints, updated_at: new Date().toISOString() });
    intentProvider?.refresh();
    return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, description, phase, constraints }) }] };
  }
);

server.tool(
  "get_goal",
  "Read the current engagement goal and phase constraints. Call before every Reason step to stay aligned.",
  {},
  async () => {
    logger.debug("MCP tool: get_goal");
    const goal = IntentQueue.getGoal();
    return { content: [{ type: "text" as const, text: JSON.stringify(goal ?? { error: "No goal set. Call set_goal first." }) }] };
  }
);
```

- [ ] **Step 5: Add `create_intent`, `list_intents`, `update_intent_status` MCP tools**

```typescript
server.tool(
  "create_intent",
  "Write a new action intent to the queue (status: pending, awaiting human approval in the TreeView). Create multiple per Reason round — show the human the full attack plan. reasoning MUST reference specific Finding IDs or confirmed facts; vague reasoning is rejected.",
  {
    hypothesis: z.string().describe("The hypothesis being tested — e.g. 'DC01 has Kerberoastable accounts'"),
    reasoning: z.string().min(1).describe("Why this hypothesis is worth testing. MUST reference specific Finding IDs (e.g. F-003) or confirmed state. Vague reasoning not allowed."),
    command: z.string().describe("The exact command to run — must be copy-paste ready"),
    expected_outcome: z.string().describe("What output would confirm the hypothesis"),
    terminal_id: z.string().optional().describe("Terminal ID to run the command in (omit for default terminal)"),
  },
  async ({ hypothesis, reasoning, command, expected_outcome, terminal_id }) => {
    logger.debug("MCP tool: create_intent");
    const intent: Intent = {
      id: `intent-${Date.now()}`,
      hypothesis,
      reasoning,
      command,
      expected_outcome,
      status: "pending",
      terminal_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    IntentQueue.add(intent);
    intentProvider?.refresh();
    return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, id: intent.id, status: "pending" }) }] };
  }
);

server.tool(
  "list_intents",
  "List intents from the queue. Filter by status to find approved intents ready for execution.",
  {
    status: z.enum(["pending", "approved", "running", "completed", "dismissed", "elevated"]).optional().describe("Filter by intent status. Omit to return all."),
  },
  async ({ status }) => {
    logger.debug(`MCP tool: list_intents (status=${status ?? "all"})`);
    const intents = status ? IntentQueue.getByStatus(status as IntentStatus) : IntentQueue.getAll();
    return { content: [{ type: "text" as const, text: JSON.stringify(intents, null, 2) }] };
  }
);

server.tool(
  "update_intent_status",
  "Update an intent's status. Use 'dismissed' when the hypothesis is invalidated (dismissed_reason required). Use 'elevated' after creating a finding that confirms the hypothesis (finding_id required).",
  {
    id: z.string().describe("Intent ID"),
    status: z.enum(["pending", "approved", "running", "completed", "dismissed", "elevated"]).describe("New status"),
    dismissed_reason: z.string().optional().describe("Required when status=dismissed. Why the hypothesis was invalidated."),
    finding_id: z.string().optional().describe("Required when status=elevated. The Finding ID that confirms the hypothesis."),
  },
  async ({ id, status, dismissed_reason, finding_id }) => {
    logger.debug(`MCP tool: update_intent_status (id=${id}, status=${status})`);
    const intent = IntentQueue.getById(id);
    if (!intent) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Intent '${id}' not found` }) }] };
    }
    if (status === "dismissed" && !dismissed_reason) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "dismissed_reason is required when status=dismissed" }) }] };
    }
    if (status === "elevated" && !finding_id) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "finding_id is required when status=elevated" }) }] };
    }
    IntentQueue.update(id, { status: status as IntentStatus, dismissed_reason, finding_id });
    intentProvider?.refresh();
    return { content: [{ type: "text" as const, text: JSON.stringify({ updated: true, id, status }) }] };
  }
);
```

- [ ] **Step 6: Add `execute_intent` MCP tool**

```typescript
server.tool(
  "execute_intent",
  "Execute an approved intent: sends the command to the terminal, waits 2s for initial output, captures the snapshot. Intent must have status='approved'. For long-running commands, note in expected_outcome that output is 'initial progress' and use read_terminal later for complete results.",
  {
    id: z.string().describe("Intent ID (must have status='approved')"),
  },
  async ({ id }) => {
    logger.debug(`MCP tool: execute_intent (id=${id})`);
    const intent = IntentQueue.getById(id);
    if (!intent) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Intent '${id}' not found` }) }] };
    }
    if (intent.status !== "approved") {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Intent '${id}' is not approved (status: ${intent.status}). Approved intents only.` }) }] };
    }

    // Resolve terminal — use specified or default (lowest-id non-running terminal)
    let terminalId = intent.terminal_id;
    if (!terminalId) {
      const terminals = bridge.getTerminals();
      if (terminals.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No terminals available. Call create_terminal first." }) }] };
      }
      // Sort by numeric id ascending, pick first
      const sorted = [...terminals].sort((a, b) => Number(a.id) - Number(b.id));
      terminalId = sorted[0].id;
    }

    // Step 1: mark running
    IntentQueue.update(id, { status: "running" });
    intentProvider?.refresh();

    // Step 2: send command
    const sent = bridge.sendCommandDirect(terminalId, intent.command);
    if (!sent) {
      IntentQueue.update(id, { status: "approved" }); // rollback
      intentProvider?.refresh();
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Terminal '${terminalId}' not found` }) }] };
    }

    // Step 3: wait 2s for shell integration to capture output
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 4: read output
    const output = await bridge.getTerminalOutput(terminalId, 50, true);

    // Step 5: update to completed with output
    IntentQueue.update(id, { status: "completed", output });
    intentProvider?.refresh();

    return { content: [{ type: "text" as const, text: JSON.stringify({ id, command: intent.command, output }) }] };
  }
);
```

- [ ] **Step 7: Enhance `get_engagement_summary` to accept `include_intents` parameter**

Find the existing `get_engagement_summary` tool registration (around line 408–423 of original file). Replace it with:

```typescript
server.tool(
  "get_engagement_summary",
  "Get a comprehensive summary of the current penetration testing engagement. Returns: all hosts, credentials, findings with their wiki-link associations (which hosts/users/findings each finding connects to), per-host and per-user finding breakdowns, orphan findings, and computed statistics. Optionally includes the full relationship graph (nodes, edges, attack path, Mermaid diagram). Optionally includes goal and intent queue. Use this as your first call to understand the full engagement state.",
  {
    include_graph: z.boolean().optional().describe("Include the full relationship graph in the response (default: false). Set to true when you need the Mermaid diagram, attack path, or raw edge data."),
    include_intents: z.boolean().optional().describe("Include current goal and full intent queue with stats (default: false). Set to true during Reason step of the Intent Loop."),
  },
  async ({ include_graph, include_intents }) => {
    logger.debug(`MCP tool: get_engagement_summary (include_graph=${include_graph ?? false}, include_intents=${include_intents ?? false})`);
    const summary = await this.buildSummary();
    const result: Record<string, unknown> = include_graph ? { ...summary } : { ...summary, graph: undefined };
    if (include_intents) {
      const allIntents = IntentQueue.getAll();
      result.goal = IntentQueue.getGoal();
      result.intents = allIntents;
      result.intentStats = {
        pending: allIntents.filter((i) => i.status === "pending").length,
        approved: allIntents.filter((i) => i.status === "approved").length,
        running: allIntents.filter((i) => i.status === "running").length,
        completed: allIntents.filter((i) => i.status === "completed").length,
        dismissed: allIntents.filter((i) => i.status === "dismissed").length,
        elevated: allIntents.filter((i) => i.status === "elevated").length,
      };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);
```

- [ ] **Step 8: Commit**

```bash
git add src/features/mcp/httpServer.ts
git commit -m "feat(mcp): add set_goal, get_goal, create_intent, list_intents, update_intent_status, execute_intent tools; enhance get_engagement_summary with include_intents"
```

---

## Task 11: Update Skill documentation

**Files:**
- Modify: `docs/skills/pentest-with-weaponized/SKILL.md`

- [ ] **Step 1: Read the current SKILL.md to find insertion points**

Read `docs/skills/pentest-with-weaponized/SKILL.md` in full to find the end of the MCP tools table section and the end of the patterns section.

- [ ] **Step 2: Add Goal & Intent tools table section after the existing Terminal tools table**

After the Terminal Management tools table, add:

```markdown
### Goal & Intent（半自动渗透闭环）

| Tool | Purpose | When to use |
|------|---------|-------------|
| `set_goal` | Set engagement goal and phase constraints | Start of engagement or phase switch |
| `get_goal` | Read current goal | Before every Reason step |
| `create_intent` | Write reasoned action intent to queue (pending) | After each Reason round — create multiple |
| `list_intents` | List intent queue, filterable by status | Confirm which intents are approved |
| `update_intent_status` | Update intent status (dismiss/elevate) | When hypothesis invalidated or confirmed |
| `execute_intent` | Execute approved intent, auto-capture output | When intent has status=approved |
```

- [ ] **Step 3: Add Pattern 5: Intent Loop after the last existing pattern**

```markdown
### Pattern 5: AI-Driven Intent Loop（半自动渗透闭环）

**Full loop:**

1. `get_goal`
   → Confirm current goal and phase constraints

2. `get_engagement_summary(include_intents=true)`
   → One call for full context: Findings + Hosts + Users + Graph + existing Intents

3. `create_intent × N` (batch — never one at a time)
   → All action intents from this Reason round
   → `reasoning` MUST reference specific Finding IDs or confirmed state

4. [Wait for human approval in TreeView]
   → `list_intents(status="approved")` to confirm

5. `execute_intent(id)`
   → Auto-executes + captures initial output (no manual send+read needed)

6. Analyze output:
   - Hypothesis confirmed → `create_finding(...)` + `update_intent_status(id, "elevated", finding_id=...)`
   - Hypothesis invalidated → `update_intent_status(id, "dismissed", dismissed_reason="...")`

7. Return to step 2 (loop until Goal achieved or user stops)
```

- [ ] **Step 4: Add Intent usage rules section**

```markdown
## Intent Usage Rules

**Batch creation, never single**
Create all intents from a Reason round in one batch. The human sees the full attack plan.

**reasoning MUST cite specific evidence**
✗ "This target may have vulnerabilities"
✓ "Finding F-003 confirms SMB signing is disabled; credential user@corp.local valid; NTLM relay conditions met"

**Confirm approved before execute_intent**
Call `list_intents(status="approved")` before `execute_intent` to confirm the human approved.

**Findings and Intents are decoupled**
Do NOT pass `intent_id` to `create_finding` — Findings are pure fact records.
After elevating, call `update_intent_status(id, "elevated", finding_id=...)` to link them.
```

- [ ] **Step 5: Commit**

```bash
git add docs/skills/pentest-with-weaponized/SKILL.md
git commit -m "docs(skill): add Intent Loop tools, Pattern 5, and Intent usage rules"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|-----------|
| `Intent` / `Goal` domain types | Task 1 |
| `workspaceState` keys `weaponized.intentQueue` / `weaponized.goal` | Task 2 |
| `IntentQueue` static class with CRUD | Task 2 |
| 50-item archived intent pruning | Task 2 |
| `set_goal` MCP tool | Task 10 |
| `get_goal` MCP tool | Task 10 |
| `create_intent` MCP tool | Task 10 |
| `list_intents` MCP tool | Task 10 |
| `update_intent_status` MCP tool | Task 10 |
| `execute_intent` MCP tool (send+wait 2s+read+update) | Task 10 |
| `get_engagement_summary` enhanced with `include_intents` | Task 10 |
| TreeView `weaponized.intentView` | Task 6 |
| `weapon.intent.approve` command | Tasks 7+8 |
| `weapon.intent.skip` command (with reason input box) | Tasks 7+8 |
| `weapon.intent.setGoal` command | Task 8 |
| `package.json` contributes (viewsContainers, views, commands, menus) | Task 4 |
| `contextValue` `intent-pending` / `intent-approved` etc. | Task 6 |
| SVG icon for activity bar | Task 3 |
| Skill doc: tool table + Pattern 5 + Intent rules | Task 11 |
| Unit test for domain types | Task 1 |
| `EmbeddedMcpServer` receives `IntentTreeProvider` reference | Tasks 9+10 |
| `intentProvider.refresh()` called after all mutations | Tasks 7, 8, 10 |
| Default terminal = lowest-id in `execute_intent` | Task 10 |

**Placeholder scan:** No TBDs, all code shown.

**Type consistency:** `IntentStatus`, `Intent`, `Goal` defined once in Task 1 and imported everywhere. `IntentQueue.getById()` used in `update_intent_status` and `execute_intent`. `IntentQueue.getByStatus()` used in `list_intents` and TreeView. `provider.refresh()` named consistently throughout.
