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
import { Commands } from "../../shared/commands";

export function registerTerminalUtils(context: vscode.ExtensionContext) {
  activate(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      Commands.TERMINAL_LOGGER_REGISTER,
      startTempTerminalRecord
    ),
    vscode.commands.registerCommand(
      Commands.TERMINAL_LOGGER_UNREGISTER,
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
    ),

    // Dispose profile providers' internal listeners
    MsfconsoleWeaponizedTerminalProvider,
    MeterpreterWeaponizedTerminalProvider,
    NetcatWeaponizedTerminalProvider,
    WebDeliveryWeaponizedTerminalProvider,
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

  // Register profile providers so the MCP create_terminal tool can reference them
  const providers = new Map<string, vscode.TerminalProfileProvider>([
    ["netcat", NetcatWeaponizedTerminalProvider],
    ["msfconsole", MsfconsoleWeaponizedTerminalProvider],
    ["meterpreter", MeterpreterWeaponizedTerminalProvider],
    ["web-delivery", WebDeliveryWeaponizedTerminalProvider],
  ]);
  bridge.setProfileProviders(providers);

  context.subscriptions.push({ dispose: () => bridge.dispose() });
  return bridge;
}
