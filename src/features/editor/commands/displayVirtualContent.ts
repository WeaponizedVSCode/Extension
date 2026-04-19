import * as vscode from "vscode";
import { type callback } from "../../../shared/types";

export const ReadOnlyProvider = class
  implements vscode.TextDocumentContentProvider
{
  provideTextDocumentContent(uri: vscode.Uri): string {
    return uri.query;
  }
};

export const displayVirtualContent: callback = async (args) => {
  let content = "Empty Content!";
  if (args && args.content) {
    content = args.content as string;
  }
  let title = "Virtual Document";
  if (args && args.title) {
    title = encodeURIComponent(args.title as string);
  }
  let uri = vscode.Uri.parse("weaponized-editor:" + title + "?" + encodeURIComponent(content));
  let doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: false });
  if (args && args.copyToClipboard) {
    await vscode.env.clipboard.writeText(content);
  }
};
