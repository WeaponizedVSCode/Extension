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
