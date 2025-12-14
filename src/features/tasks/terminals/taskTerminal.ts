import * as vscode from 'vscode';
import { logger } from '../../../platform/vscode/logger';

export function CreateTaskLikeInteractiveTerminal(title: string,commands: string[], location?: vscode.TerminalLocation, msg?: string): vscode.Terminal {
  let term = vscode.window.createTerminal({
    name: title,
    isTransient: true,
    iconPath: new vscode.ThemeIcon("terminal"),
    location: location || vscode.TerminalLocation.Panel,
    message: msg
  });
  term.sendText(commands.join(" "));
  logger.info("creating a task like terminal: commands " + commands);
  term.processId.then((pid) => {
    logger.info(`msfvenom terminal started with PID: ${pid}`);
  });
  term.show();
  return term;
};
