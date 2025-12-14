import * as vscode from "vscode";
import { targetFilePattern } from "../../../shared/globs";
import { NoteCreationProvider } from "./noteProvider";

export function registerNotesCodeLens(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "markdown", scheme: "file", pattern: targetFilePattern },
      new NoteCreationProvider()
    )
  );
}

