import * as vscode from "vscode";
import { logger } from "../../../platform/vscode/logger";

export class BaseWeaponizedTerminalProvider
  implements vscode.TerminalProfileProvider
{
  uniqueName: string = "";

  handler = (): string[] => {
    return [];
  };

  msg = (): string => {
    return "";
  };
  constructor(name: string, handler: () => string[], msg?: () => string) {
    this.uniqueName = name;
    this.handler = handler;
    if (msg) {
      this.msg = msg;
    }
    vscode.window.onDidOpenTerminal((terminal) => {
      if (terminal.name === this.uniqueName) {
        let sendCommand = this.handler().join(" ");
        logger.debug(`Terminal ${this.uniqueName} opened. Sending command: ${sendCommand}`);
        terminal.sendText(sendCommand);
      }
    });
  }

  provideTerminalProfile(
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.TerminalProfile> {
    return {
      options: {
        name: this.uniqueName,
        hideFromUser: false,
        message: this.msg(),
      },
    };
  }
}
