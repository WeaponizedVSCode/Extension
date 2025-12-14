import * as vscode from "vscode";
import { targetFilePattern } from "../../../shared/globs";
import { markdownCodelens } from "./yaml";

export function registerTargetCodeLens(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "markdown", scheme: "file", pattern: targetFilePattern },
      markdownCodelens
    )
  );
}

