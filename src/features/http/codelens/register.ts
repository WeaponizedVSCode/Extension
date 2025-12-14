import * as vscode from "vscode";
import { targetFilePattern } from "../../../shared/globs";
import { httpRepeater, httpToCurl } from "./providers";

export function registerHttpCodeLens(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "markdown", scheme: "file", pattern: targetFilePattern },
      httpToCurl
    ),
    vscode.languages.registerCodeLensProvider(
      { language: "markdown", scheme: "file", pattern: targetFilePattern },
      httpRepeater
    )
  );
}
