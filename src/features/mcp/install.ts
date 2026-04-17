import * as vscode from "vscode";
import { logger } from "../../platform/vscode/logger";
import type { EmbeddedMcpServer } from "./httpServer";

const MCP_SERVER_ID = "weaponized";

interface McpJson {
  servers?: Record<string, { url: string } | { command: string; args: string[] }>;
  [key: string]: unknown;
}

export async function installMcpServer(): Promise<void> {
  const server = getEmbeddedMcpServer();
  const port = server?.getPort();

  if (!port) {
    vscode.window.showErrorMessage(
      "Weaponized MCP server is not running. Please reload the window and try again."
    );
    return;
  }

  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showErrorMessage(
      "No workspace folder open. Please open a workspace first."
    );
    return;
  }

  await writeMcpJson(workspace, port);

  logger.info(`MCP server installed at http://127.0.0.1:${port}/mcp`);
  vscode.window.showInformationMessage(
    `MCP server installed to .vscode/mcp.json (port ${port}). Reload your AI client to connect.`
  );
}

/** Updates mcp.json if our server entry already exists (called on every activation). */
export async function autoUpdateMcpJson(port: number): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) return;

  const mcpJsonUri = vscode.Uri.joinPath(workspace.uri, ".vscode", "mcp.json");
  let mcpJson: McpJson;
  try {
    const existing = await vscode.workspace.fs.readFile(mcpJsonUri);
    mcpJson = JSON.parse(new TextDecoder().decode(existing));
  } catch {
    return; // mcp.json doesn't exist yet — user hasn't run install command
  }

  if (!mcpJson.servers?.[MCP_SERVER_ID]) {
    return; // our server not configured yet
  }

  // Update the port
  mcpJson.servers[MCP_SERVER_ID] = { url: `http://127.0.0.1:${port}/mcp` };
  await vscode.workspace.fs.writeFile(
    mcpJsonUri,
    new TextEncoder().encode(JSON.stringify(mcpJson, null, 2) + "\n")
  );
  logger.info(`Auto-updated mcp.json: port → ${port}`);
}

async function writeMcpJson(workspace: vscode.WorkspaceFolder, port: number): Promise<void> {
  const vscodeDir = vscode.Uri.joinPath(workspace.uri, ".vscode");
  const mcpJsonUri = vscode.Uri.joinPath(vscodeDir, "mcp.json");

  let mcpJson: McpJson = {};
  try {
    const existing = await vscode.workspace.fs.readFile(mcpJsonUri);
    mcpJson = JSON.parse(new TextDecoder().decode(existing));
  } catch {
    // file doesn't exist yet
  }

  if (!mcpJson.servers) {
    mcpJson.servers = {};
  }

  mcpJson.servers[MCP_SERVER_ID] = { url: `http://127.0.0.1:${port}/mcp` };

  try {
    await vscode.workspace.fs.createDirectory(vscodeDir);
  } catch {
    // already exists
  }

  await vscode.workspace.fs.writeFile(
    mcpJsonUri,
    new TextEncoder().encode(JSON.stringify(mcpJson, null, 2) + "\n")
  );
}

let _embeddedServer: EmbeddedMcpServer | undefined;

export function setEmbeddedMcpServer(s: EmbeddedMcpServer): void {
  _embeddedServer = s;
}

export function getEmbeddedMcpServer(): EmbeddedMcpServer | undefined {
  return _embeddedServer;
}

// Legacy context ref kept for the install command (may be removed later)
let _context: vscode.ExtensionContext | undefined;

export function setExtensionContext(ctx: vscode.ExtensionContext): void {
  _context = ctx;
}

export function getExtensionContext(): vscode.ExtensionContext | undefined {
  return _context;
}

