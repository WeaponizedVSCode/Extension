import * as vscode from "vscode";
import * as path from "path";
import { logger } from "../../platform/vscode/logger";

const MCP_SERVER_ID = "weaponized";

interface McpServerConfig {
  command: string;
  args: string[];
  description?: string;
}

interface McpJson {
  servers?: Record<string, McpServerConfig>;
  [key: string]: unknown;
}

export async function installMcpServer(): Promise<void> {
  const context = getExtensionContext();
  if (!context) {
    vscode.window.showErrorMessage("Extension context not available.");
    return;
  }

  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showErrorMessage(
      "No workspace folder open. Please open a workspace first."
    );
    return;
  }

  const mcpServerPath = path.join(
    context.extensionPath,
    "dist",
    "mcp-server.js"
  );

  const mcpJsonUri = vscode.Uri.joinPath(workspace.uri, ".vscode", "mcp.json");

  // Read existing .vscode/mcp.json or start fresh
  let mcpJson: McpJson = {};
  try {
    const existing = await vscode.workspace.fs.readFile(mcpJsonUri);
    mcpJson = JSON.parse(new TextDecoder().decode(existing));
  } catch {
    // file doesn't exist yet — that's fine
  }

  if (!mcpJson.servers) {
    mcpJson.servers = {};
  }

  // Check if already installed
  if (mcpJson.servers[MCP_SERVER_ID]) {
    const overwrite = await vscode.window.showWarningMessage(
      `MCP server "${MCP_SERVER_ID}" already configured. Overwrite?`,
      "Overwrite",
      "Cancel"
    );
    if (overwrite !== "Overwrite") {
      return;
    }
  }

  mcpJson.servers[MCP_SERVER_ID] = {
    command: "node",
    args: [mcpServerPath, "${workspaceFolder}"],
  };

  // Ensure .vscode dir exists
  const vscodeDir = vscode.Uri.joinPath(workspace.uri, ".vscode");
  try {
    await vscode.workspace.fs.createDirectory(vscodeDir);
  } catch {
    // already exists
  }

  // Write .vscode/mcp.json
  const content = JSON.stringify(mcpJson, null, 2) + "\n";
  await vscode.workspace.fs.writeFile(
    mcpJsonUri,
    new TextEncoder().encode(content)
  );

  logger.info(`MCP server config written to ${mcpJsonUri.fsPath}`);
  vscode.window.showInformationMessage(
    `MCP server installed to .vscode/mcp.json. Reload window or restart your AI client to connect.`
  );
}

let _context: vscode.ExtensionContext | undefined;

export function setExtensionContext(ctx: vscode.ExtensionContext): void {
  _context = ctx;
}

function getExtensionContext(): vscode.ExtensionContext | undefined {
  return _context;
}
