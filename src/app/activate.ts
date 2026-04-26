import * as vscode from "vscode";
import { logger } from "../platform/vscode/logger";
import { Context } from "../platform/vscode/context";
import { registerTargetsSync } from "../features/targets/sync";
import { registerCommands } from "./registerCommands";
import { registerCodeLens } from "./registerCodeLens";
import { registerTerminalUtils, registerMcpBridge } from "../features/terminal";
import { registerDefinitionProvider } from "../features/definitions";
import { registerAIFeatures } from "../features/ai";
import {
  setEmbeddedMcpServer,
  autoUpdateMcpConfig,
} from "../features/mcp/install";
import { EmbeddedMcpServer } from "../features/mcp/httpServer";
import { DEFAULT_MCP_PORT } from "../features/mcp/portManager";

async function dependencyCheck(): Promise<boolean> {
  const foamExtension = vscode.extensions.getExtension("foam.foam-vscode");
  if (!foamExtension) {
    logger.warn("Foam extension is not installed.");
    vscode.window.showErrorMessage(
      "Foam extension is not installed. please install foam.foam-vscode extension"
    );
    return false;
  }
  logger.info("Foam extension is installed.");
  if (!foamExtension.isActive) {
    logger.info("Activating Foam extension...");
    await foamExtension.activate();
    logger.info("Foam extension activated.");
  }

  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    vscode.window.showErrorMessage(
      "Please open a workspace folder to use this extension."
    );
    return false;
  }
  logger.info("Workspace folder is available.");
  return true;
}

export async function activateExtension(context: vscode.ExtensionContext) {
  Context.context = context;
  if (!(await dependencyCheck())) {
    return;
  }
  logger.info("Activating vscode weaponized extension...");

  const config = vscode.workspace.getConfiguration("weaponized");

  try {
    await registerTargetsSync(context);
  } catch (e) {
    logger.error("Failed to register targets sync:", e);
  }

  try {
    registerCommands(context);
  } catch (e) {
    logger.error("Failed to register commands:", e);
  }

  try {
    registerCodeLens(context);
  } catch (e) {
    logger.error("Failed to register CodeLens:", e);
  }

  try {
    registerTerminalUtils(context);
  } catch (e) {
    logger.error("Failed to register terminal utils:", e);
  }

  try {
    registerDefinitionProvider(context);
  } catch (e) {
    logger.error("Failed to register definition provider:", e);
  }

  if (config.get<boolean>("ai.enabled", true)) {
    let terminalBridge;
    try {
      terminalBridge = registerMcpBridge(context);
    } catch (e) {
      logger.error("Failed to register MCP bridge:", e);
    }

    if (terminalBridge) {
      try {
        const preferredPort = config.get<number>("mcp.port", DEFAULT_MCP_PORT);
        const mcpServer = new EmbeddedMcpServer();
        const port = await mcpServer.start(terminalBridge, preferredPort);
        setEmbeddedMcpServer(mcpServer);
        context.subscriptions.push({ dispose: () => mcpServer.stop() });
        await autoUpdateMcpConfig(port);
        logger.info(`Embedded MCP server started on port ${port}`);
      } catch (e) {
        logger.error("Failed to start embedded MCP server:", e);
      }
    }

    try {
      registerAIFeatures(context);
    } catch (e) {
      logger.error("Failed to register AI features:", e);
    }
  } else {
    logger.info("AI and MCP features disabled by weaponized.ai.enabled setting.");
  }

  logger.info("vscode weaponized extension activated successfully.");
  return Context;
}
