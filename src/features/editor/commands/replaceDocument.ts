import * as vscode from "vscode";
import { logger } from "../../../platform/vscode/logger";
import { TextEncoder } from "util";
import { type callback } from "../../../shared/types";

export const replacer: callback = async (args: any) => {
  const { file, startLine, current, target } = args;
  if (!file || !startLine || !current || !target) {
    logger.error("Invalid arguments provided to replacer function.");
    return;
  }
  const uri = vscode.Uri.parse(file);
  const doc = await vscode.workspace.openTextDocument(uri);
  const doctext = doc.getText();
  const lines = doctext.split("\n");
  
  let header = lines.slice(0, startLine).join("\n");
  let footer = lines.slice(startLine, lines.length).join("\n");
  let newContent = header + "\n" + footer.replace(current, target);
  let coder = new TextEncoder().encode(newContent);
  await vscode.workspace.fs.writeFile(uri, coder);
  logger.info(`Replaced content in file: ${uri.fsPath}`);
};
