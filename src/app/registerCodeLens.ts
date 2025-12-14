import * as vscode from "vscode";
import { registerTargetCodeLens } from "../features/targets/codelens";
import { registerShellCodeLens } from "../features/shell/codelens";
import { registerNotesCodeLens } from "../features/notes/codelens";
import { registerHttpCodeLens } from "../features/http/codelens";

export function registerCodeLens(context: vscode.ExtensionContext) {
  registerTargetCodeLens(context);
  registerShellCodeLens(context);
  registerNotesCodeLens(context);
  registerHttpCodeLens(context);
}

