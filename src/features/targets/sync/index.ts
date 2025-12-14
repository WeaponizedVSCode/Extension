import * as vscode from "vscode";
import { targetFilePattern } from "../../../shared/globs";
import {
  ProcessMarkdownFileToWorkspaceState,
  ProcessWorkspaceStateToEnvironmentCollects,
} from "./markdownSync";
import { logger } from "../../../platform/vscode/logger";
import { Context } from "../../../platform/vscode/context";

async function init(context: vscode.ExtensionContext) {
  // clean update the extension's workspace state
  Context.HostState = [];
  Context.UserState = [];

  let files = await vscode.workspace.findFiles(targetFilePattern);
  for (const file of files) {
    logger.info(`Processing file: ${file.fsPath}`);
    await ProcessMarkdownFileToWorkspaceState(file);
  }
  context.workspaceState.keys().forEach((key) => {
    logger.info(
      `Workspace state key: ${key} => ${JSON.stringify(
        context.workspaceState.get(key)
      )}`
    );
  });

  let wksp = vscode.workspace.workspaceFolders?.[0];
  if (wksp) {
    logger.info(`Processing workspace: ${wksp.name}`);
    await ProcessWorkspaceStateToEnvironmentCollects(wksp);
  } else {
    logger.warn("No workspace found, skipping workspace state processing.");
  }
}

function filewatcher(context: vscode.ExtensionContext): vscode.FileSystemWatcher {
  let filewatcher = vscode.workspace.createFileSystemWatcher(targetFilePattern);
  context.subscriptions.push(
    filewatcher.onDidChange(async (file) => {
      logger.info(`Watched file changed: ${file.fsPath}`);
      await ProcessMarkdownFileToWorkspaceState(file);
      let wksp = vscode.workspace.getWorkspaceFolder(file);
      if (wksp) {
        await ProcessWorkspaceStateToEnvironmentCollects(wksp);
      }
    }),
    filewatcher.onDidDelete(async (file) => {
      logger.info(`Watched file deleted: ${file.fsPath}`);
      let wksp = vscode.workspace.getWorkspaceFolder(file);
      await init(context);
    })
  );
  return filewatcher;
}

export async function registerTargetsSync(context: vscode.ExtensionContext) {
  await init(context);
  filewatcher(context);
}

// Back-compat name (to be removed after migration finishes)
export const registerVariablesWatcher = registerTargetsSync;
