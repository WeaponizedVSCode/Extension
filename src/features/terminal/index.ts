import {
  MsfconsoleWeaponizedTerminalProvider,
  MeterpreterWeaponizedTerminalProvider,
  NetcatWeaponizedTerminalProvider,
  WebDeliveryWeaponizedTerminalProvider,
} from "./profiles";
import {
  activate,
  startTempTerminalRecord,
  stopTempTerminalForCapture,
} from "./recorder";
import { TerminalBridge } from "./bridge";
import * as vscode from "vscode";
import { logger } from "../../platform/vscode/logger";

export function registerTerminalUtils(context: vscode.ExtensionContext) {
  activate();

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "weaponized.terminal-logger.register",
      startTempTerminalRecord
    ),
    vscode.commands.registerCommand(
      "weaponized.terminal-logger.unregister",
      stopTempTerminalForCapture
    ),

    vscode.window.registerTerminalProfileProvider(
      "weaponized.msfconsole",
      MsfconsoleWeaponizedTerminalProvider
    ),
    vscode.window.registerTerminalProfileProvider(
      "weaponized.meterpreter-handler",
      MeterpreterWeaponizedTerminalProvider
    ),
    vscode.window.registerTerminalProfileProvider(
      "weaponized.netcat-handler",
      NetcatWeaponizedTerminalProvider
    ),
    vscode.window.registerTerminalProfileProvider(
      "weaponized.web-delivery",
      WebDeliveryWeaponizedTerminalProvider
    )
  );
}

export function registerMcpBridge(context: vscode.ExtensionContext): TerminalBridge | undefined {
  const stateDir = context.storageUri;
  if (!stateDir) {
    logger.warn("No storageUri available, skipping MCP bridge registration");
    return undefined;
  }
  const bridge = new TerminalBridge(stateDir);
  bridge.activate().catch((e) => logger.error("TerminalBridge activation failed", e));
  context.subscriptions.push({ dispose: () => bridge.dispose() });
  return bridge;
}
