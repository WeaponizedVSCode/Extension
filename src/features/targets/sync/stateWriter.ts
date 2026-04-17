import * as vscode from "vscode";
import { Context } from "../../../platform/vscode/context";
import { logger } from "../../../platform/vscode/logger";

export async function writeStateForMCP(workspace: vscode.WorkspaceFolder) {
  const stateDir = vscode.Uri.joinPath(workspace.uri, ".weapon-state");

  try {
    await vscode.workspace.fs.createDirectory(stateDir);
  } catch {
    // directory may already exist
  }

  const encoder = new TextEncoder();

  const hosts = Context.HostState ?? [];
  await vscode.workspace.fs.writeFile(
    vscode.Uri.joinPath(stateDir, "hosts.json"),
    encoder.encode(JSON.stringify(hosts, null, 2))
  );

  const users = Context.UserState ?? [];
  await vscode.workspace.fs.writeFile(
    vscode.Uri.joinPath(stateDir, "users.json"),
    encoder.encode(JSON.stringify(users, null, 2))
  );

  logger.trace("MCP state files written to .weapon-state/");
}
