import { MarkdownHTTPCodeLensGenerator } from "./base";
import * as vscode from "vscode";

export const httpToCurlCodeLens: MarkdownHTTPCodeLensGenerator = (post: string[], startLine: number, document: vscode.TextDocument): vscode.CodeLens[] => {
  const codeLenses: vscode.CodeLens[] = [];
  const cmd: vscode.Command = {
    title: "Copy in curl (HTTP)",
    command: "weapon.http_raw_request_to_curl",
    arguments: [
      {
        request: post.join("\r\n"),
        isHTTPS: false,
      },
    ],
  };
  let cmd2: vscode.Command = {
    title: "Copy in curl (HTTPS)",
    command: "weapon.http_raw_request_to_curl",
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
