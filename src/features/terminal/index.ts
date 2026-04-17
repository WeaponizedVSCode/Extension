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

  // Activate TerminalBridge for each workspace folder
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const bridge = new TerminalBridge(folder);
      bridge.activate().catch((e) => logger.error("TerminalBridge activation failed", e));
      context.subscriptions.push({ dispose: () => bridge.dispose() });
    }
  }

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
