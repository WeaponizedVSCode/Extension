import * as vscode from "vscode";
import * as cp from "child_process";
import { logger } from "../../../platform/vscode/logger";
import { callback } from "../../../shared/types";

export const runCommand: callback = async (args) => {
  var term = vscode.window.activeTerminal || vscode.window.createTerminal();
  if (vscode.window.activeTerminal) {
    logger.debug("Using existing terminal: " + vscode.window.activeTerminal.name);
  }
  // check if there's a running command in the active terminal, if there is one
  // create a new term
  term.processId.then((pid) => {
    cp.exec("ps -o state= -p " + pid, (error, stdout, stderr) => {
      if (error) {
        // if we can't check just send to the current one...
        term.show();
        term.sendText(args.command);
        return;
      }

      // a + in the state indicates a process running in foreground
      //if (!stdout.includes("+")) {
      //  logger.debug("No running command in the active terminal, creating a new one.", pid);
      //  term = vscode.window.createTerminal();
      // }
      term.show();
      term.sendText(args.command);
    });
  });
};
