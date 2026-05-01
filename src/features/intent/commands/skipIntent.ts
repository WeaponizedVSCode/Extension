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
