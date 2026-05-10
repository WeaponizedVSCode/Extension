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
