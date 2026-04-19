import * as vscode from "vscode";
import { logger } from "../../../platform/vscode/logger";

export class BaseWeaponizedTerminalProvider
  implements vscode.TerminalProfileProvider, vscode.Disposable
{
  uniqueName: string = "";
  private readonly _disposable: vscode.Disposable;

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
    this._disposable = vscode.window.onDidOpenTerminal((terminal) => {
      if (terminal.name === this.uniqueName) {
        const sendCommand = this.handler().join(" ");
        logger.debug(`Terminal ${this.uniqueName} opened. Sending command: ${sendCommand}`);
        terminal.sendText(sendCommand);
      }
    });
  }

  dispose(): void {
    this._disposable.dispose();
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
