# Intent Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the AI-assisted penetration testing closed-loop system (Intent Loop) that enables AI reasoning → structured action plans → human approval → execution → result analysis → knowledge elevation.

**Architecture:** Intent objects live in VS Code `workspaceState` (not Markdown files). An `IntentQueue` static class manages CRUD. 4 new MCP tools + 1 enhancement drive the loop. A TreeView UI lets humans approve/skip intents. Domain types are pure TypeScript with zero VS Code dependencies.

**Tech Stack:** TypeScript, VS Code Extension API, `@modelcontextprotocol/sdk`, `zod`, Mocha + `assert` (tests)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/core/domain/intent.ts` | Intent / Goal type definitions + validation helpers (zero vscode deps) |
| `src/core/domain/index.ts` | Add barrel exports for intent types |
| `src/features/intent/queue/intentQueue.ts` | IntentQueue static class — workspaceState CRUD |
| `src/features/intent/treeview/intentTreeProvider.ts` | VS Code TreeView data provider |
| `src/features/intent/treeview/register.ts` | TreeView registration |
| `src/features/intent/commands/approveIntent.ts` | `weapon.intent.approve` handler |
| `src/features/intent/commands/skipIntent.ts` | `weapon.intent.skip` handler |
| `src/features/intent/index.ts` | Barrel + `registerIntentFeature()` entry point |
| `src/shared/commands.ts` | Add intent command IDs |
| `src/features/mcp/httpServer.ts` | Add 4 new tools + enhance `get_engagement_summary` |
| `src/app/activate.ts` | Wire up `registerIntentFeature()` |
| `package.json` | viewsContainers + views + commands + menus |
| `resources/icons/intent.svg` | TreeView sidebar icon |
| `src/test/unit/core/domain/intent.test.ts` | Domain model unit tests |

---

### Task 1: Domain Model — Intent & Goal Types + Tests

**Files:**
- Create: `src/core/domain/intent.ts`
- Create: `src/test/unit/core/domain/intent.test.ts`
- Modify: `src/core/domain/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/test/unit/core/domain/intent.test.ts`:

```typescript
import * as assert from "assert";
import {
  INTENT_STATUSES,
  isValidIntentStatus,
  createIntent,
  createGoal,
  type IntentStatus,
  type Intent,
  type Goal,
} from "../../../../core/domain/intent";

suite("IntentStatus", () => {
  test("defines all 6 valid statuses", () => {
    assert.deepStrictEqual(INTENT_STATUSES, [
      "pending",
      "approved",
      "running",
      "completed",
      "dismissed",
      "elevated",
    ]);
  });

  test("isValidIntentStatus accepts valid statuses", () => {
    for (const s of INTENT_STATUSES) {
      assert.strictEqual(isValidIntentStatus(s), true);
    }
  });

  test("isValidIntentStatus rejects invalid strings", () => {
    assert.strictEqual(isValidIntentStatus("invalid"), false);
    assert.strictEqual(isValidIntentStatus(""), false);
    assert.strictEqual(isValidIntentStatus("PENDING"), false);
  });
});

suite("createIntent", () => {
  test("creates intent with required fields and defaults", () => {
    const intent = createIntent({
      hypothesis: "DC01 has Kerberoastable accounts",
      reasoning: "Finding F-003 shows SPN registered on svc_sql",
      command: "GetUserSPNs.py corp.local/user:pass -dc-ip 10.0.0.1",
      expected_outcome: "TGS ticket hashes in hashcat format",
    });
    assert.strictEqual(intent.hypothesis, "DC01 has Kerberoastable accounts");
    assert.strictEqual(intent.reasoning, "Finding F-003 shows SPN registered on svc_sql");
    assert.strictEqual(intent.command, "GetUserSPNs.py corp.local/user:pass -dc-ip 10.0.0.1");
    assert.strictEqual(intent.expected_outcome, "TGS ticket hashes in hashcat format");
    assert.strictEqual(intent.status, "pending");
    assert.ok(intent.id.startsWith("intent-"));
    assert.ok(intent.created_at.length > 0);
    assert.ok(intent.updated_at.length > 0);
    assert.strictEqual(intent.terminal_id, undefined);
    assert.strictEqual(intent.output, undefined);
    assert.strictEqual(intent.finding_id, undefined);
    assert.strictEqual(intent.dismissed_reason, undefined);
  });

  test("accepts optional terminal_id", () => {
    const intent = createIntent({
      hypothesis: "h",
      reasoning: "r",
      command: "c",
      expected_outcome: "e",
      terminal_id: "term-1",
    });
    assert.strictEqual(intent.terminal_id, "term-1");
  });

  test("generates unique IDs", () => {
    const a = createIntent({ hypothesis: "h", reasoning: "r", command: "c", expected_outcome: "e" });
    const b = createIntent({ hypothesis: "h", reasoning: "r", command: "c", expected_outcome: "e" });
    assert.notStrictEqual(a.id, b.id);
  });

  test("timestamps are valid ISO 8601", () => {
    const intent = createIntent({ hypothesis: "h", reasoning: "r", command: "c", expected_outcome: "e" });
    assert.ok(!isNaN(Date.parse(intent.created_at)));
    assert.ok(!isNaN(Date.parse(intent.updated_at)));
  });
});

suite("createGoal", () => {
  test("creates goal with required description", () => {
    const goal = createGoal({ description: "Get Domain Admin on corp.local" });
    assert.strictEqual(goal.description, "Get Domain Admin on corp.local");
    assert.strictEqual(goal.phase, undefined);
    assert.strictEqual(goal.constraints, undefined);
    assert.ok(goal.updated_at.length > 0);
  });

  test("accepts optional phase and constraints", () => {
    const goal = createGoal({
      description: "Pivot to DMZ",
      phase: "post-exploitation",
      constraints: "No noisy scans",
    });
    assert.strictEqual(goal.phase, "post-exploitation");
    assert.strictEqual(goal.constraints, "No noisy scans");
  });

  test("timestamp is valid ISO 8601", () => {
    const goal = createGoal({ description: "test" });
    assert.ok(!isNaN(Date.parse(goal.updated_at)));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx mocha --require ts-node/register src/test/unit/core/domain/intent.test.ts`
Expected: FAIL — module `../../../../core/domain/intent` does not exist

- [ ] **Step 3: Implement the domain model**

Create `src/core/domain/intent.ts`:

```typescript
export type IntentStatus =
  | "pending"
  | "approved"
  | "running"
  | "completed"
  | "dismissed"
  | "elevated";

export const INTENT_STATUSES: IntentStatus[] = [
  "pending",
  "approved",
  "running",
  "completed",
  "dismissed",
  "elevated",
];

export function isValidIntentStatus(value: string): value is IntentStatus {
  return INTENT_STATUSES.includes(value as IntentStatus);
}

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

let intentCounter = 0;

export interface CreateIntentInput {
  hypothesis: string;
  reasoning: string;
  command: string;
  expected_outcome: string;
  terminal_id?: string;
}

export function createIntent(input: CreateIntentInput): Intent {
  const now = new Date().toISOString();
  return {
    id: `intent-${Date.now()}-${++intentCounter}`,
    hypothesis: input.hypothesis,
    reasoning: input.reasoning,
    command: input.command,
    expected_outcome: input.expected_outcome,
    status: "pending",
    terminal_id: input.terminal_id,
    output: undefined,
    finding_id: undefined,
    dismissed_reason: undefined,
    created_at: now,
    updated_at: now,
  };
}

export interface CreateGoalInput {
  description: string;
  phase?: string;
  constraints?: string;
}

export function createGoal(input: CreateGoalInput): Goal {
  return {
    description: input.description,
    phase: input.phase,
    constraints: input.constraints,
    updated_at: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx mocha --require ts-node/register src/test/unit/core/domain/intent.test.ts`
Expected: All 11 tests PASS

- [ ] **Step 5: Add barrel exports**

In `src/core/domain/index.ts`, add at the end (before the `import` block for Config types):

```typescript
export {
    Intent,
    IntentStatus,
    Goal,
    INTENT_STATUSES,
    isValidIntentStatus,
    createIntent,
    createGoal,
    CreateIntentInput,
    CreateGoalInput,
} from "./intent";
```

- [ ] **Step 6: Commit**

```bash
git add src/core/domain/intent.ts src/core/domain/index.ts src/test/unit/core/domain/intent.test.ts
git commit -m "feat(intent): add Intent and Goal domain types with factory functions"
```

---

### Task 2: IntentQueue — workspaceState CRUD

**Files:**
- Create: `src/features/intent/queue/intentQueue.ts`

- [ ] **Step 1: Create IntentQueue**

```typescript
import * as vscode from "vscode";
import type { Intent, IntentStatus, Goal } from "../../../core/domain/intent";

const QUEUE_KEY = "weaponized.intentQueue";
const GOAL_KEY = "weaponized.goal";
const MAX_ARCHIVED = 50;
const ARCHIVED_STATUSES: IntentStatus[] = ["completed", "dismissed", "elevated"];

let workspaceState: vscode.Memento | undefined;

export class IntentQueue {
  static init(state: vscode.Memento): void {
    workspaceState = state;
  }

  static getAll(): Intent[] {
    return workspaceState?.get<Intent[]>(QUEUE_KEY) ?? [];
  }

  static add(intent: Intent): void {
    const all = IntentQueue.getAll();
    all.push(intent);
    IntentQueue.saveAll(all);
    IntentQueue.pruneArchived();
  }

  static update(id: string, updates: Partial<Intent>): Intent | undefined {
    const all = IntentQueue.getAll();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) {
      return undefined;
    }
    all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
    IntentQueue.saveAll(all);
    return all[idx];
  }

  static getById(id: string): Intent | undefined {
    return IntentQueue.getAll().find((i) => i.id === id);
  }

  static getByStatus(status: IntentStatus): Intent[] {
    return IntentQueue.getAll().filter((i) => i.status === status);
  }

  static getGoal(): Goal | null {
    return workspaceState?.get<Goal | null>(GOAL_KEY) ?? null;
  }

  static setGoal(goal: Goal): void {
    workspaceState?.update(GOAL_KEY, goal);
  }

  private static saveAll(intents: Intent[]): void {
    workspaceState?.update(QUEUE_KEY, intents);
  }

  private static pruneArchived(): void {
    const all = IntentQueue.getAll();
    const archived = all
      .filter((i) => ARCHIVED_STATUSES.includes(i.status))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (archived.length > MAX_ARCHIVED) {
      const idsToRemove = new Set(
        archived.slice(0, archived.length - MAX_ARCHIVED).map((i) => i.id)
      );
      IntentQueue.saveAll(all.filter((i) => !idsToRemove.has(i.id)));
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/intent/queue/intentQueue.ts
git commit -m "feat(intent): add IntentQueue workspaceState CRUD"
```

---

### Task 3: TreeView Provider

**Files:**
- Create: `src/features/intent/treeview/intentTreeProvider.ts`
- Create: `src/features/intent/treeview/register.ts`

- [ ] **Step 1: Create IntentTreeProvider**

```typescript
import * as vscode from "vscode";
import type { Intent, IntentStatus, Goal } from "../../../core/domain/intent";
import { IntentQueue } from "../queue/intentQueue";

type TreeElement = GoalItem | GroupItem | IntentItem;

class GoalItem extends vscode.TreeItem {
  constructor(goal: Goal) {
    super(`🎯 ${goal.description}`, vscode.TreeItemCollapsibleState.None);
    const parts: string[] = [];
    if (goal.phase) {
      parts.push(`Phase: ${goal.phase}`);
    }
    if (goal.constraints) {
      parts.push(`Constraints: ${goal.constraints}`);
    }
    this.description = parts.join(" | ");
    this.contextValue = "goal";
  }
}

class GroupItem extends vscode.TreeItem {
  constructor(
    public readonly status: IntentStatus,
    public readonly count: number
  ) {
    const collapsed = ["completed", "dismissed", "elevated"].includes(status)
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.Expanded;
    super(`${status.charAt(0).toUpperCase() + status.slice(1)} (${count})`, collapsed);
    this.contextValue = `intent-group-${status}`;
  }
}

class IntentItem extends vscode.TreeItem {
  constructor(public readonly intent: Intent) {
    const icons: Record<IntentStatus, string> = {
      pending: "●",
      approved: "►",
      running: "⟳",
      completed: "✓",
      dismissed: "✗",
      elevated: "⬆",
    };
    super(
      `[${icons[intent.status]}] ${intent.hypothesis}`,
      vscode.TreeItemCollapsibleState.None
    );
    this.description = intent.command.length > 50
      ? intent.command.slice(0, 47) + "..."
      : intent.command;
    this.tooltip = new vscode.MarkdownString(
      `**${intent.hypothesis}**\n\n` +
      `_Reasoning:_ ${intent.reasoning}\n\n` +
      `\`\`\`\n${intent.command}\n\`\`\`\n\n` +
      `_Expected:_ ${intent.expected_outcome}`
    );
    this.contextValue = this.resolveContextValue(intent.status);
  }

  private resolveContextValue(status: IntentStatus): string {
    switch (status) {
      case "pending":
        return "intent-pending";
      case "approved":
        return "intent-approved";
      case "running":
        return "intent-running";
      default:
        return "intent-done";
    }
  }
}

export class IntentTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      return this.getRootElements();
    }
    if (element instanceof GroupItem) {
      return IntentQueue.getByStatus(element.status).map((i) => new IntentItem(i));
    }
    return [];
  }

  private getRootElements(): TreeElement[] {
    const items: TreeElement[] = [];

    const goal = IntentQueue.getGoal();
    if (goal) {
      items.push(new GoalItem(goal));
    }

    const all = IntentQueue.getAll();
    const groups: IntentStatus[] = ["pending", "approved", "running", "completed", "dismissed", "elevated"];
    for (const status of groups) {
      const count = all.filter((i) => i.status === status).length;
      if (count > 0) {
        items.push(new GroupItem(status, count));
      }
    }

    return items;
  }
}
```

- [ ] **Step 2: Create register.ts**

```typescript
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
git commit -m "feat(intent): add TreeView provider for Intent queue"
```

---

### Task 4: Intent Commands (approve / skip)

**Files:**
- Create: `src/features/intent/commands/approveIntent.ts`
- Create: `src/features/intent/commands/skipIntent.ts`
- Modify: `src/shared/commands.ts`

- [ ] **Step 1: Add command IDs to shared/commands.ts**

Add to the `Commands` object, inside the `// Features` section:

```typescript
  // Intent
  INTENT_APPROVE: 'weapon.intent.approve',
  INTENT_SKIP: 'weapon.intent.skip',
  INTENT_SET_GOAL: 'weapon.intent.setGoal',
```

- [ ] **Step 2: Create approveIntent.ts**

```typescript
import { IntentQueue } from "../queue/intentQueue";
import type { IntentTreeProvider } from "../treeview/intentTreeProvider";

export function approveIntent(treeProvider: IntentTreeProvider) {
  return (item: { intent?: { id: string } }) => {
    if (!item?.intent?.id) {
      return;
    }
    IntentQueue.update(item.intent.id, { status: "approved" });
    treeProvider.refresh();
  };
}
```

- [ ] **Step 3: Create skipIntent.ts**

```typescript
import { IntentQueue } from "../queue/intentQueue";
import type { IntentTreeProvider } from "../treeview/intentTreeProvider";

export function skipIntent(treeProvider: IntentTreeProvider) {
  return (item: { intent?: { id: string } }) => {
    if (!item?.intent?.id) {
      return;
    }
    IntentQueue.update(item.intent.id, {
      status: "dismissed",
      dismissed_reason: "Skipped by user",
    });
    treeProvider.refresh();
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/intent/commands/approveIntent.ts src/features/intent/commands/skipIntent.ts src/shared/commands.ts
git commit -m "feat(intent): add approve and skip commands"
```

---

### Task 5: Feature Barrel + Registration

**Files:**
- Create: `src/features/intent/index.ts`

- [ ] **Step 1: Create feature barrel**

```typescript
import * as vscode from "vscode";
import { IntentQueue } from "./queue/intentQueue";
import { registerIntentTreeView } from "./treeview/register";
import { approveIntent } from "./commands/approveIntent";
import { skipIntent } from "./commands/skipIntent";
import { Commands } from "../../shared/commands";
import type { IntentTreeProvider } from "./treeview/intentTreeProvider";

export { IntentQueue } from "./queue/intentQueue";
export { IntentTreeProvider } from "./treeview/intentTreeProvider";

export function registerIntentFeature(context: vscode.ExtensionContext): IntentTreeProvider {
  IntentQueue.init(context.workspaceState);

  const treeProvider = registerIntentTreeView(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.INTENT_APPROVE, approveIntent(treeProvider)),
    vscode.commands.registerCommand(Commands.INTENT_SKIP, skipIntent(treeProvider))
  );

  return treeProvider;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/intent/index.ts
git commit -m "feat(intent): add feature barrel and registerIntentFeature entry"
```

---

### Task 6: MCP Tools — 4 New + 1 Enhancement

**Files:**
- Modify: `src/features/mcp/httpServer.ts`

- [ ] **Step 1: Add imports**

At the top of `httpServer.ts`, add:

```typescript
import { IntentQueue, IntentTreeProvider } from "../intent";
import { createIntent, createGoal, isValidIntentStatus } from "../../core/domain/intent";
import type { IntentStatus } from "../../core/domain/intent";
```

- [ ] **Step 2: Update EmbeddedMcpServer to accept IntentTreeProvider**

Change the `start` method signature and store the provider:

```typescript
export class EmbeddedMcpServer {
  private httpServer: http.Server | undefined;
  private port = 0;
  private findingMap = new FindingMap();
  private intentTreeProvider: IntentTreeProvider | undefined;

  // ...

  async start(terminalBridge: TerminalBridge, preferredPort: number, intentTreeProvider?: IntentTreeProvider): Promise<number> {
    this.intentTreeProvider = intentTreeProvider;
    // rest unchanged...
```

- [ ] **Step 3: Add `set_goal` tool**

Inside `registerTools()`, after the `get_engagement_summary` tool block, add:

```typescript
    server.tool(
      "set_goal",
      "Set the current penetration testing engagement goal. Use at the start of an engagement or when switching attack phases.",
      {
        description: z.string().describe("Goal description, e.g. 'Get Domain Admin on corp.local'"),
        phase: z.string().optional().describe("Attack phase: reconnaissance, exploitation, post-exploitation"),
        constraints: z.string().optional().describe("Operational constraints, e.g. 'No noisy scans'"),
      },
      async ({ description, phase, constraints }) => {
        logger.debug(`MCP tool: set_goal (description=${description})`);
        const goal = createGoal({ description, phase, constraints });
        IntentQueue.setGoal(goal);
        this.intentTreeProvider?.refresh();
        return { content: [{ type: "text" as const, text: JSON.stringify({ set: true, goal }) }] };
      }
    );
```

- [ ] **Step 4: Add `create_intent` tool**

```typescript
    server.tool(
      "create_intent",
      "Create a structured action intent based on AI reasoning. The intent enters 'pending' status and awaits human approval in the TreeView before execution. Reasoning must reference specific Finding IDs or engagement facts.",
      {
        hypothesis: z.string().describe("Hypothesis statement, e.g. 'DC01 has Kerberoastable accounts'"),
        reasoning: z.string().min(10).describe("Reasoning basis — MUST reference specific Finding IDs or engagement facts"),
        command: z.string().describe("Full executable command"),
        expected_outcome: z.string().describe("What output would confirm the hypothesis"),
        terminal_id: z.string().optional().describe("Target terminal ID (uses default terminal if omitted)"),
      },
      async ({ hypothesis, reasoning, command, expected_outcome, terminal_id }) => {
        logger.debug(`MCP tool: create_intent (hypothesis=${hypothesis})`);
        const intent = createIntent({ hypothesis, reasoning, command, expected_outcome, terminal_id });
        IntentQueue.add(intent);
        this.intentTreeProvider?.refresh();
        return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, id: intent.id, status: intent.status }) }] };
      }
    );
```

- [ ] **Step 5: Add `update_intent_status` tool**

```typescript
    server.tool(
      "update_intent_status",
      "Update an intent's status after analyzing its execution output. Use 'elevated' when the hypothesis is confirmed (requires finding_id). Use 'dismissed' when the hypothesis is disproven (requires dismissed_reason).",
      {
        id: z.string().describe("Intent ID"),
        status: z.enum(["dismissed", "elevated"]).describe("New status: 'dismissed' (hypothesis disproven) or 'elevated' (confirmed, linked to Finding)"),
        dismissed_reason: z.string().optional().describe("Required when status=dismissed: why the hypothesis was wrong"),
        finding_id: z.string().optional().describe("Required when status=elevated: the Finding ID this intent confirmed"),
      },
      async ({ id, status, dismissed_reason, finding_id }) => {
        logger.debug(`MCP tool: update_intent_status (id=${id}, status=${status})`);
        if (status === "dismissed" && !dismissed_reason) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: "dismissed_reason is required when status=dismissed" }) }] };
        }
        if (status === "elevated" && !finding_id) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: "finding_id is required when status=elevated" }) }] };
        }
        const existing = IntentQueue.getById(id);
        if (!existing) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Intent '${id}' not found` }) }] };
        }
        const updates: Record<string, unknown> = { status };
        if (dismissed_reason) {
          updates.dismissed_reason = dismissed_reason;
        }
        if (finding_id) {
          updates.finding_id = finding_id;
        }
        const updated = IntentQueue.update(id, updates as any);
        this.intentTreeProvider?.refresh();
        return { content: [{ type: "text" as const, text: JSON.stringify({ updated: true, id, status: updated?.status }) }] };
      }
    );
```

- [ ] **Step 6: Add `execute_intent` tool**

```typescript
    server.tool(
      "execute_intent",
      "Execute an approved intent. Internally: sets status to 'running', sends command to terminal, waits for Shell Integration buffer (2s), reads output, sets status to 'completed'. Only works on intents with status='approved'. For long-running commands, the initial output is captured — use read_terminal for follow-up.",
      {
        id: z.string().describe("Intent ID (must be in 'approved' status)"),
      },
      async ({ id }) => {
        logger.debug(`MCP tool: execute_intent (id=${id})`);
        const intent = IntentQueue.getById(id);
        if (!intent) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Intent '${id}' not found` }) }] };
        }
        if (intent.status !== "approved") {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Intent '${id}' is '${intent.status}', must be 'approved'` }) }] };
        }

        // Step 1: Set running
        IntentQueue.update(id, { status: "running" });
        this.intentTreeProvider?.refresh();

        // Step 2: Determine terminal
        const terminalId = intent.terminal_id ?? this.pickDefaultTerminal(bridge);
        if (!terminalId) {
          IntentQueue.update(id, { status: "approved" }); // revert
          this.intentTreeProvider?.refresh();
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No terminal available. Use create_terminal first." }) }] };
        }

        // Step 3: Send command
        const sent = bridge.sendCommandDirect(terminalId, intent.command);
        if (!sent) {
          IntentQueue.update(id, { status: "approved" }); // revert
          this.intentTreeProvider?.refresh();
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Failed to send command to terminal '${terminalId}'` }) }] };
        }

        // Step 4: Wait for shell integration buffer
        await new Promise((r) => setTimeout(r, 2000));

        // Step 5: Read output
        const output = await bridge.getTerminalOutput(terminalId, 50, true);

        // Step 6: Set completed
        IntentQueue.update(id, { status: "completed", output });
        this.intentTreeProvider?.refresh();

        return { content: [{ type: "text" as const, text: JSON.stringify({ id, command: intent.command, output }) }] };
      }
    );
```

- [ ] **Step 7: Add `pickDefaultTerminal` helper**

Add as a private method on `EmbeddedMcpServer`:

```typescript
  private pickDefaultTerminal(bridge: TerminalBridge): string | undefined {
    const terminals = bridge.getTerminals();
    if (terminals.length === 0) {
      return undefined;
    }
    // Pick the first (oldest) terminal
    return terminals[0].id ?? terminals[0].name;
  }
```

- [ ] **Step 8: Enhance `get_engagement_summary` with `include_intents` parameter**

Update the existing `get_engagement_summary` tool definition:

Change the schema from:
```typescript
{ include_graph: z.boolean().optional()... }
```
to:
```typescript
{
  include_graph: z.boolean().optional().describe("Include the full relationship graph in the response (default: false). Set to true when you need the Mermaid diagram, attack path, or raw edge data."),
  include_intents: z.boolean().optional().describe("Include goal, intents queue, and intent stats (default: false). Set to true for the AI Intent Loop workflow."),
}
```

Update the handler to accept `include_intents` and append intent data:

```typescript
async ({ include_graph, include_intents }) => {
  logger.debug(`MCP tool: get_engagement_summary (include_graph=${include_graph ?? false}, include_intents=${include_intents ?? false})`);
  const summary = await this.buildSummary();
  const result: Record<string, unknown> = include_graph ? { ...summary } : { ...summary, graph: undefined };

  if (include_intents) {
    const intents = IntentQueue.getAll();
    const stats: Record<string, number> = { pending: 0, approved: 0, running: 0, completed: 0, dismissed: 0, elevated: 0 };
    for (const i of intents) {
      stats[i.status]++;
    }
    result.goal = IntentQueue.getGoal();
    result.intents = intents;
    result.intentStats = stats;
  }

  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
}
```

- [ ] **Step 9: Commit**

```bash
git add src/features/mcp/httpServer.ts
git commit -m "feat(intent): add 4 MCP tools (set_goal, create_intent, update_intent_status, execute_intent) + enhance get_engagement_summary"
```

---

### Task 7: Wiring — activate.ts + package.json + icon

**Files:**
- Modify: `src/app/activate.ts`
- Modify: `package.json`
- Create: `resources/icons/intent.svg`

- [ ] **Step 1: Wire registerIntentFeature in activate.ts**

Add import at top:

```typescript
import { registerIntentFeature } from "../features/intent";
```

In the `if (config.get<boolean>("ai.enabled", true))` block, BEFORE the MCP server start, add:

```typescript
    let intentTreeProvider;
    try {
      intentTreeProvider = registerIntentFeature(context);
    } catch (e) {
      logger.error("Failed to register intent feature:", e);
    }
```

Update the MCP server start call to pass the provider:

```typescript
const port = await mcpServer.start(terminalBridge, preferredPort, intentTreeProvider);
```

- [ ] **Step 2: Add icon SVG**

Create `resources/icons/intent.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <path d="M12 6v6l4 2"/>
  <path d="M16 16l2 2"/>
</svg>
```

- [ ] **Step 3: Update package.json**

Add to `contributes`:

```jsonc
"viewsContainers": {
  "activitybar": [{
    "id": "weaponized-intent",
    "title": "Weapon Intents",
    "icon": "resources/icons/intent.svg"
  }]
},
"views": {
  "weaponized-intent": [{
    "id": "weaponized.intentView",
    "name": "Intents"
  }]
}
```

Add to `contributes.commands` array:

```jsonc
{
  "command": "weapon.intent.approve",
  "title": "Approve Intent",
  "icon": "$(check)"
},
{
  "command": "weapon.intent.skip",
  "title": "Skip Intent",
  "icon": "$(close)"
},
{
  "command": "weapon.intent.setGoal",
  "title": "Weapon: Set Engagement Goal"
}
```

Add to `contributes.menus`:

```jsonc
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
```

- [ ] **Step 4: Commit**

```bash
git add src/app/activate.ts package.json resources/icons/intent.svg
git commit -m "feat(intent): wire up activation, package.json contributions, and sidebar icon"
```

---

### Task 8: Skill Documentation Update

**Files:**
- Modify: `docs/skills/pentest-with-weaponized/SKILL.md`

- [ ] **Step 1: Add Intent tools to the tool table**

Add a new section after the existing tool tables:

```markdown
### Goal & Intent（半自动渗透闭环）

| 工具 | 用途 | 何时使用 |
|------|------|---------|
| set_goal | 设置渗透目标和阶段约束 | engagement 开始或切换攻击阶段 |
| create_intent | 写入带推理的行动意图 | 每轮推理后批量创建 |
| update_intent_status | 更新意图状态（dismiss/elevate） | 分析输出结果后 |
| execute_intent | 执行已审批意图（自动读取输出） | 有 approved Intent 时 |
| get_engagement_summary | 读取全量上下文含 Intent | include_intents=true 获取 goal+intents |
```

- [ ] **Step 2: Add Pattern 5**

```markdown
### Pattern 5: AI-Driven Intent Loop（半自动渗透闭环）

**完整循环：**

1. get_engagement_summary(include_intents=true)
   → 一次调用获取全量上下文（goal + intents + stats + Findings + Hosts + Users）

2. create_intent × N（批量，不要单条）
   → 本轮推理生成的所有行动意图
   → reasoning 必须引用具体 Finding ID 或态势事实

3. [等待人类在 TreeView 审批]
   → get_engagement_summary(include_intents=true) 确认哪些已 approved

4. execute_intent(id)
   → 自动执行 + 读取输出（无需手动 send+read）

5. 分析 output:
   ├─ 假设确认 → create_finding(...) + update_intent_status(id, "elevated", finding_id=...)
   └─ 假设否定 → update_intent_status(id, "dismissed", dismissed_reason="...")

6. 回到步骤 1（循环，直到 Goal 达成或用户叫停）
```

- [ ] **Step 3: Add Intent usage rules**

```markdown
## Intent 使用规则

**批量创建，不要单条**
每轮 Reason 后一次性 create_intent 多条，让人类看到完整攻击思路再审批。

**reasoning 必须引用具体依据**
✗ "这个目标可能有漏洞"
✓ "Finding F-003 确认 SMB 签名未启用，当前凭证 user@corp.local 有效，具备 relay 条件"

**execute_intent 前确认 approved 状态**
get_engagement_summary(include_intents=true) 确认后再调用 execute_intent，避免操作未审批的 Intent。

**Finding 与 Intent 解耦**
create_finding 不传 intent_id——Finding 是纯粹的事实记录。
升级后单独调用 update_intent_status(id, "elevated", finding_id=...) 建立关联。

**长命令的处理**
对 nmap、hashcat 等长运行命令，expected_outcome 注明"初始输出为进度信息"。
execute_intent 返回后用 read_terminal 在后续轮次跟踪完整结果。
```

- [ ] **Step 4: Commit**

```bash
git add docs/skills/pentest-with-weaponized/SKILL.md
git commit -m "docs(skill): add Intent Loop tools, Pattern 5, and usage rules"
```

---

### Task 9: Compile + Verify

**Files:** None (verification only)

- [ ] **Step 1: Compile TypeScript**

Run: `npm run compile`
Expected: No errors

- [ ] **Step 2: Run domain tests**

Run: `npm test`
Expected: All tests pass including new intent.test.ts

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(intent): resolve compilation issues"
```
(Only if Step 1 or 2 revealed issues needing fixes)

---
