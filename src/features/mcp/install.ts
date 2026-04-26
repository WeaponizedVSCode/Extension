import * as vscode from "vscode";
import { logger } from "../../platform/vscode/logger";
import type { EmbeddedMcpServer } from "./httpServer";

const MCP_SERVER_ID = "weaponized";

type CliTarget = "vscode" | "claude" | "codex" | "gemini" | "opencode";

const CLI_LABELS: Record<CliTarget, string> = {
  vscode: "VSCode",
  claude: "Claude Code",
  codex: "Codex (OpenAI)",
  gemini: "Gemini CLI",
  opencode: "OpenCode",
};

const CLI_CONFIG_PATHS: Record<CliTarget, string> = {
  vscode: ".vscode/mcp.json",
  claude: ".mcp.json",
  codex: ".codex/config.toml",
  gemini: ".gemini/settings.json",
  opencode: ".opencode.json",
};

// ─── Public API ──────────────────────────────────────────────────────────────

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

  const cli = await resolveCliTarget();
  if (!cli) {
    return; // user cancelled
  }

  await writeConfigFor(cli, workspace.uri, port);

  const configPath = CLI_CONFIG_PATHS[cli];
  logger.info(`MCP config installed: ${configPath} (port ${port})`);
  vscode.window.showInformationMessage(
    `MCP server installed to ${configPath} for ${CLI_LABELS[cli]} (port ${port}). Reload your AI client to connect.`
  );
}

/** Updates the config file if it already contains a weaponized entry (called on every activation). */
export async function autoUpdateMcpConfig(port: number): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    return;
  }

  const config = vscode.workspace.getConfiguration("weaponized");
  const cli = config.get<string>("mcp.cli", "");
  if (!cli) {
    return; // no target configured yet
  }

  const target = cli as CliTarget;
  const updater = CONFIG_UPDATERS[target];
  if (!updater) {
    return;
  }

  try {
    await updater(workspace.uri, port);
    logger.info(`Auto-updated ${CLI_CONFIG_PATHS[target]}: port → ${port}`);
  } catch {
    // config file doesn't exist or doesn't contain our entry — skip silently
  }
}

// ─── CLI Target Resolution ───────────────────────────────────────────────────

async function resolveCliTarget(): Promise<CliTarget | undefined> {
  const config = vscode.workspace.getConfiguration("weaponized");
  const saved = config.get<string>("mcp.cli", "");

  if (saved && saved in CLI_LABELS) {
    return saved as CliTarget;
  }

  // Prompt user to pick one
  const items = (Object.keys(CLI_LABELS) as CliTarget[]).map((key) => ({
    label: CLI_LABELS[key],
    description: CLI_CONFIG_PATHS[key],
    target: key,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "Select the AI CLI tool to install MCP config for",
    title: "MCP Install Target",
  });

  if (!picked) {
    return undefined;
  }

  // Save to workspace settings
  await config.update("mcp.cli", picked.target, vscode.ConfigurationTarget.Workspace);
  return picked.target;
}

// ─── Config Writers ──────────────────────────────────────────────────────────

async function writeConfigFor(cli: CliTarget, workspaceUri: vscode.Uri, port: number): Promise<void> {
  const url = `http://127.0.0.1:${port}/mcp`;

  switch (cli) {
    case "vscode":
      return writeJsonConfig(workspaceUri, [".vscode", "mcp.json"], (json) => {
        if (!json.servers) { json.servers = {}; }
        json.servers[MCP_SERVER_ID] = { url };
      });

    case "claude":
      return writeJsonConfig(workspaceUri, [".mcp.json"], (json) => {
        if (!json.mcpServers) { json.mcpServers = {}; }
        json.mcpServers[MCP_SERVER_ID] = { type: "http", url };
      });

    case "gemini":
      return writeJsonConfig(workspaceUri, [".gemini", "settings.json"], (json) => {
        if (!json.mcpServers) { json.mcpServers = {}; }
        json.mcpServers[MCP_SERVER_ID] = { httpUrl: url };
      });

    case "opencode":
      return writeJsonConfig(workspaceUri, [".opencode.json"], (json) => {
        if (!json.mcpServers) { json.mcpServers = {}; }
        json.mcpServers[MCP_SERVER_ID] = { type: "sse", url };
      });

    case "codex":
      return writeCodexToml(workspaceUri, url);
  }
}

// ─── JSON helper (read-merge-write) ─────────────────────────────────────────

type JsonObject = Record<string, any>;

async function writeJsonConfig(
  workspaceUri: vscode.Uri,
  pathSegments: string[],
  mutate: (json: JsonObject) => void
): Promise<void> {
  const fileUri = vscode.Uri.joinPath(workspaceUri, ...pathSegments);

  // Ensure parent directories exist
  if (pathSegments.length > 1) {
    const dirUri = vscode.Uri.joinPath(workspaceUri, ...pathSegments.slice(0, -1));
    try { await vscode.workspace.fs.createDirectory(dirUri); } catch { /* exists */ }
  }

  let json: JsonObject = {};
  try {
    const existing = await vscode.workspace.fs.readFile(fileUri);
    json = JSON.parse(new TextDecoder().decode(existing));
  } catch {
    // file doesn't exist yet
  }

  mutate(json);

  await vscode.workspace.fs.writeFile(
    fileUri,
    new TextEncoder().encode(JSON.stringify(json, null, 2) + "\n")
  );
}

// ─── TOML helper for Codex ──────────────────────────────────────────────────

const CODEX_SECTION_HEADER = `[mcp_servers.${MCP_SERVER_ID}]`;

async function writeCodexToml(workspaceUri: vscode.Uri, url: string): Promise<void> {
  const dirUri = vscode.Uri.joinPath(workspaceUri, ".codex");
  const fileUri = vscode.Uri.joinPath(dirUri, "config.toml");

  try { await vscode.workspace.fs.createDirectory(dirUri); } catch { /* exists */ }

  const entry = `${CODEX_SECTION_HEADER}\nurl = "${url}"\n`;

  let content = "";
  try {
    const existing = await vscode.workspace.fs.readFile(fileUri);
    content = new TextDecoder().decode(existing);
  } catch {
    // file doesn't exist
  }

  if (!content) {
    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(entry));
    return;
  }

  // Replace existing section or append
  const sectionIdx = content.indexOf(CODEX_SECTION_HEADER);
  if (sectionIdx !== -1) {
    // Find the end of this section (next [section] or EOF)
    const afterHeader = sectionIdx + CODEX_SECTION_HEADER.length;
    const nextSection = content.indexOf("\n[", afterHeader);
    const sectionEnd = nextSection !== -1 ? nextSection + 1 : content.length;
    content = content.slice(0, sectionIdx) + entry + content.slice(sectionEnd);
  } else {
    // Append with a blank line separator
    content = content.trimEnd() + "\n\n" + entry;
  }

  await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(content));
}

// ─── Config Updaters (for auto-update on activation) ─────────────────────────

type ConfigUpdater = (workspaceUri: vscode.Uri, port: number) => Promise<void>;

const CONFIG_UPDATERS: Record<CliTarget, ConfigUpdater> = {
  vscode: async (workspaceUri, port) => {
    const fileUri = vscode.Uri.joinPath(workspaceUri, ".vscode", "mcp.json");
    const json = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri)));
    if (!json.servers?.[MCP_SERVER_ID]) { return; }
    json.servers[MCP_SERVER_ID] = { url: `http://127.0.0.1:${port}/mcp` };
    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(JSON.stringify(json, null, 2) + "\n"));
  },

  claude: async (workspaceUri, port) => {
    const fileUri = vscode.Uri.joinPath(workspaceUri, ".mcp.json");
    const json = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri)));
    if (!json.mcpServers?.[MCP_SERVER_ID]) { return; }
    json.mcpServers[MCP_SERVER_ID] = { type: "http", url: `http://127.0.0.1:${port}/mcp` };
    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(JSON.stringify(json, null, 2) + "\n"));
  },

  gemini: async (workspaceUri, port) => {
    const fileUri = vscode.Uri.joinPath(workspaceUri, ".gemini", "settings.json");
    const json = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri)));
    if (!json.mcpServers?.[MCP_SERVER_ID]) { return; }
    json.mcpServers[MCP_SERVER_ID] = { httpUrl: `http://127.0.0.1:${port}/mcp` };
    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(JSON.stringify(json, null, 2) + "\n"));
  },

  opencode: async (workspaceUri, port) => {
    const fileUri = vscode.Uri.joinPath(workspaceUri, ".opencode.json");
    const json = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri)));
    if (!json.mcpServers?.[MCP_SERVER_ID]) { return; }
    json.mcpServers[MCP_SERVER_ID] = { type: "sse", url: `http://127.0.0.1:${port}/mcp` };
    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(JSON.stringify(json, null, 2) + "\n"));
  },

  codex: async (workspaceUri, port) => {
    const fileUri = vscode.Uri.joinPath(workspaceUri, ".codex", "config.toml");
    let content = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
    const sectionIdx = content.indexOf(CODEX_SECTION_HEADER);
    if (sectionIdx === -1) { return; }
    const url = `http://127.0.0.1:${port}/mcp`;
    const entry = `${CODEX_SECTION_HEADER}\nurl = "${url}"\n`;
    const afterHeader = sectionIdx + CODEX_SECTION_HEADER.length;
    const nextSection = content.indexOf("\n[", afterHeader);
    const sectionEnd = nextSection !== -1 ? nextSection + 1 : content.length;
    content = content.slice(0, sectionIdx) + entry + content.slice(sectionEnd);
    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(content));
  },
};

// ─── Singleton ───────────────────────────────────────────────────────────────

let _embeddedServer: EmbeddedMcpServer | undefined;

export function setEmbeddedMcpServer(s: EmbeddedMcpServer): void {
  _embeddedServer = s;
}

export function getEmbeddedMcpServer(): EmbeddedMcpServer | undefined {
  return _embeddedServer;
}
