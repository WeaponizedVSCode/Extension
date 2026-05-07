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
