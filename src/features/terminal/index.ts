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
import * as vscode from "vscode";

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
