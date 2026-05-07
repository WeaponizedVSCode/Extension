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
