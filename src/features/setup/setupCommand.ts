import { type callback } from "../../shared/types";
import * as vscode from "vscode";
import { logger } from "../../platform/vscode/logger";
import { fs } from "./assets";
import process from "process";

const zshrcContent = `# This function is used to set up the environment for Weaponized folders and auto source .vscode/.zshrc files
weapon_vscode_launch_helper () {
  if [ -n "$PROJECT_FOLDER" ]; then
    if [ -f "$PROJECT_FOLDER/.vscode/.zshrc" ]; then
      source $PROJECT_FOLDER/.vscode/.zshrc
    fi
  fi
}
weapon_vscode_launch_helper
`;

const checkShellProfile = async (): Promise<boolean> => {
  try {
    let stats = await vscode.workspace.fs.stat(
      vscode.Uri.file(process.env.HOME + "/.bashrc")
    );
    if (stats.type === vscode.FileType.File) {
      const bashrc = (
        await vscode.workspace.fs.readFile(
          vscode.Uri.file(process.env.HOME + "/.bashrc")
        )
      ).toString();
      if (bashrc.includes("createhackenv.sh")) {
        return true;
      }
      if (bashrc.includes("weapon_vscode_launch_helper")) {
        return true;
      }
    }
  } catch (error) {
    logger.error(`Error checking .bashrc: ${error}`);
  }
  try {
    let stats = await vscode.workspace.fs.stat(
      vscode.Uri.file(process.env.HOME + "/.zshrc")
    );
    if (stats.type === vscode.FileType.File) {
      const zshrc = (
        await vscode.workspace.fs.readFile(
          vscode.Uri.file(process.env.HOME + "/.zshrc")
        )
      ).toString();
      if (zshrc.includes("createhackenv.sh")) {
        return true;
      }
      if (zshrc.includes("weapon_vscode_launch_helper")) {
        return true;
      }
    }
  } catch (error) {
    logger.error(`Error checking .zshrc: ${error}`);
  }
  return false;
};

export const checkEnvironmentSetup = async (): Promise<void> => {
  logger.debug("Checking environment setup...");
  let isSetup = await checkShellProfile();
  if (isSetup) {
    logger.info("shell profile is already set up.");
  } else {
    logger.warn(
      "shell profile is not set up. Please check your shell profile."
    );
    const openPath = vscode.Uri.file(process.env.HOME + "/.zshrc");
    vscode.workspace.openTextDocument(openPath).then((doc) => {
      vscode.window.showTextDocument(doc);
    });
    vscode.env.clipboard.writeText(zshrcContent);
    vscode.window.showWarningMessage(
      "[Weaponized] shell profile looks not setup correctly. Please check your shell profile (e.g., .bashrc, .zshrc).",
      "and Copy the content in clipboard to your .zshrc"
    );
  }
};

export const setupCommand: callback = async (args: any) => {
  logger.debug(`Setting up environment with args: ${JSON.stringify(args)}`);
  let dir: vscode.Uri | undefined = args?.dir;
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
    var fileExists = await vscode.workspace.fs.stat(fullPath).then(
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
  await checkEnvironmentSetup();
};
