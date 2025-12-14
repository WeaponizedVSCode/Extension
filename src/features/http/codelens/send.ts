import { MarkdownHTTPCodeLensGenerator } from "./base";
import * as vscode from "vscode";

export const httpRepeaterCodeLens: MarkdownHTTPCodeLensGenerator = (post: string[], startLine: number, document: vscode.TextDocument): vscode.CodeLens[] => {
  const codeLenses: vscode.CodeLens[] = [];
  const cmd: vscode.Command = {
    title: "Send HTTP Request",
    command: "weapon.http_raw_request",
    arguments: [
      {
        request: post.join("\r\n"),
        isHTTPS: false,
      },
    ],
  };
  let cmd2: vscode.Command = {
    title: "Send HTTPS Request",
    command: "weapon.http_raw_request",
    arguments: [
      {
        request: post.join("\r\n"),
        isHTTPS: true,
      },
    ],
  };
  codeLenses.push(
    new vscode.CodeLens(
      new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(startLine + 1, 0)
      ),
      cmd
    ),
    new vscode.CodeLens(
      new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(startLine + 1, 0)
      ),
      cmd2
    )
  );

  return codeLenses;
};
