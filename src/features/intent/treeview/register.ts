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
