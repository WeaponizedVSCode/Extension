import * as vscode from "vscode";
import { activateExtension } from "./app/activate";

export async function activate(context: vscode.ExtensionContext) {
  return await activateExtension(context);
}

export function deactivate() {}
