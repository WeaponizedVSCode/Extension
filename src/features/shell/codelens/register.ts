import * as vscode from "vscode";
import { targetFilePattern } from "../../../shared/globs";
import { CommandCodeLensProvider } from "./commandProvider";

export function registerShellCodeLens(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "markdown", scheme: "file", pattern: targetFilePattern },
      new CommandCodeLensProvider()
    )
  );
}

