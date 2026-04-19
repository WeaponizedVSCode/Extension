import { type callback } from "../../shared/types";
import * as vscode from "vscode";
import { logger } from "../../platform/vscode/logger";
import { fs } from "./assets";

export const setupCommand: callback = async (args?: Record<string, unknown>) => {
  logger.debug(`Setting up environment with args: ${JSON.stringify(args)}`);
  let dir: vscode.Uri | undefined = args?.dir as vscode.Uri | undefined;
  if (!dir) {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
      dir = vscode.workspace.workspaceFolders[0].uri;
    } else {
      logger.warn("No workspace folder found. Please open a workspace first.");
      vscode.window.showErrorMessage(
        "No workspace folder found. Please open a workspace first."
      );
      return;
    }
  }
  logger.debug(`Workspace directory: ${dir}`);
  for (const [filePath, content] of Object.entries(fs)) {
    const fullPath = vscode.Uri.joinPath(dir, filePath);
    const fileExists = await vscode.workspace.fs.stat(fullPath).then(
      () => true,
      () => false
    );
    if (fileExists) {
      logger.debug(`File ${fullPath} already exists, skipping creation.`);
      continue;
    }
    logger.trace(`Creating file: ${fullPath}`);
    await vscode.workspace.fs.writeFile(fullPath, Buffer.from(content));
  }
  let settings = vscode.Uri.joinPath(dir, ".vscode/settings.json");
  vscode.window.showTextDocument(settings);
  logger.info("Setup completed successfully.");
  vscode.window.showInformationMessage(
    "Weaponized setup completed successfully."
  );
};
