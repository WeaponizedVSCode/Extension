import { callback } from "../../../shared/types";
import * as vscode from "vscode";
import * as path from "path";
import { logger } from "../../../platform/vscode/logger";

interface FileOptionItem {
  label: string;
  name: string;
  fullpath: string;
  type: vscode.FileType;
}

export const filepicker: callback = async (
  args: any
): Promise<string | undefined> => {
  if (!vscode.workspace.workspaceFolders?.length) {
    return;
  }

  let dir: vscode.Uri | undefined = args?.dir;
  if (!dir) {
    if (vscode.workspace.workspaceFolders.length > 0) {
      dir = vscode.workspace.workspaceFolders[0].uri;
    } else {
      logger.warn("workspace is empty");
      return;
    }
  }

  while (true) {
    // @ts-ignore
    const { type, uri } = await chooseFile(dir!);
    if (!uri) {
      return;
    }

    if (type !== vscode.FileType.Directory) {
      return uri.fsPath;
    } else {
      dir = uri;
    }
  }
};

async function chooseFile(
  dir: vscode.Uri
): Promise<{ uri?: vscode.Uri; type: vscode.FileType }> {
  const { name, type } = (await vscode.window.showQuickPick(
    (async () => {
      const entries = await vscode.workspace.fs.readDirectory(dir);
      const items = entries.map(([name, type]) => {
        const label = type === vscode.FileType.Directory ? `${name}/` : name;
        const fullpath = vscode.Uri.joinPath(dir, name).fsPath;
        return { label, name, fullpath, type } as FileOptionItem;
      });
      items.unshift({
        label: "../",
        name: "..",
        type: vscode.FileType.Directory,
        fullpath: path.join(dir.fsPath, ".."),
      });
      return items;
    })(),
    { title: "Select File" }
  )) || { type: vscode.FileType.Unknown };
  if (!name) {
    return { type };
  }

  const uri = vscode.Uri.joinPath(dir, name);
  return { uri, type };
}
