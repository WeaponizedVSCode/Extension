import * as vscode from "vscode";
import { logger } from "../../../platform/vscode/logger";
import { variables } from "../../../platform/vscode/variables";
import { callback } from "../../../shared/types";
import {
  registerTerminalForCapture,
  unregisterTerminalForCapture,
} from "./record_append";
import { basename, dirname } from "path";
import { TerminalCaptureRecorder } from "./store";
import { TerminalRecorderModeList, TerminalRecorderMode } from "./mode";

export const startTempTerminalRecord: callback = async (args: any) => {
  if (!vscode.workspace.workspaceFolders) {
    logger.error(
      "No workspace folders found. Cannot start temporary terminal record."
    );
    vscode.window.showErrorMessage(
      "No workspace folders found. Cannot start temporary terminal record."
    );
    return;
  }
  let fp = args?.file;
  if (!fp) {
    fp = await vscode.window.showInputBox({
      prompt: "Enter the file path to save terminal log",
      value: "${workspaceFolder}/.vscode/.terminal.log",
    });
    if (!fp) {
      logger.error("No file path provided for terminal log.");
      vscode.window.showErrorMessage("No file path provided for terminal log.");
      return;
    }
  }
  fp = variables(fp);
  let loglevel = args?.loglevel;
  if (!loglevel) {
    loglevel = await vscode.window.showQuickPick(TerminalRecorderModeList, {
      placeHolder: "Select log level for terminal capture",
    });
  }
  if (!loglevel) {
    logger.error("No log level provided for terminal capture.");
    vscode.window.showErrorMessage(
      "No log level provided for terminal capture."
    );
    return;
  }

  let processIds: number[] = [];
  // only register terminal capture if the log level is set to OutputOnly, CommandOnly, or CommandAndOutput
  if (
    loglevel === TerminalRecorderMode.OutputOnly ||
    loglevel === TerminalRecorderMode.CommandOnly ||
    loglevel === TerminalRecorderMode.CommandAndOutput
  ) {
    if (args?.processIds) {
      processIds = args.processIds;
    } else {
      let choiceMaps = new Map<number, string>();
      for (const t of vscode.window.terminals) {
        let pid = await t.processId;
        if (pid) {
          choiceMaps.set(pid, `${pid} - ${t.name}`);
        }
      }
      choiceMaps.set(0, "All terminals");
      let idlist = await vscode.window.showQuickPick(
        Array.from(choiceMaps.values()),
        {
          placeHolder: "Select terminal process IDs to capture",
          canPickMany: true,
        }
      );
      if (idlist && idlist.length > 0) {
        idlist.map((item) => {
          for (const [pid, name] of choiceMaps.entries()) {
            if (item === name) {
              processIds.push(pid);
            }
          }
        });
      } else {
        logger.warn(
          "No terminal process IDs selected for capture. Capturing all terminals."
        );
        vscode.window.showWarningMessage(
          "No terminal process IDs selected for capture. Capturing all terminals."
        );
      }
      if (idlist && idlist.length > 0) {
        for (const id of processIds) {
          if (id === 0) {
            logger.info("detect 'All terminals' selected, breaking the loop.");
            processIds = [];
            break; // If 'All terminals' is selected, we break the loop
          }
        }
      }
    }
  }
  if (processIds.length === 0) {
    registerTerminalForCapture(fp, loglevel);
  } else {
    logger.info(
      `Registering terminal capture for process IDs: ${processIds.join(", ")}`
    );
    logger.info(`Log level: ${loglevel}`);
    // Register terminal capture with specified process IDs
    registerTerminalForCapture(fp, loglevel, processIds);
  }
  logger.info(`Starting terminal logging at ${fp} with log level: ${loglevel}, process IDs: ${processIds.join(", ")}`);
  vscode.window.showInformationMessage(
    `Terminal logging started. Logs will be saved to ${fp} with log level: ${loglevel}, process IDs: ${processIds.join(", ")}`
  );
};

export const stopTempTerminalForCapture: callback = async (args: any) => {
  // empty the listener
  logger.info("Unregistering terminal for capture.");
  let fp = args?.file;
  if (!fp) {
    let options: string[] = [];
    for (const capture of TerminalCaptureRecorder.captures) {
      options.push(
        `${capture.logLevel} - ${basename(capture.filePath)} - ${dirname(
          capture.filePath
        )}`
      ); // Use the first registered file path
    }
    let choice = await vscode.window.showQuickPick(options, {
      placeHolder: "Select the terminal log file to unregister",
    });
    if (!choice) {
      logger.error("No file path selected for terminal log unregistration.");
      vscode.window.showErrorMessage(
        "No file path selected for terminal log unregistration."
      );
      return;
    }
    for (const capture of TerminalCaptureRecorder.captures) {
      if (
        choice ===
        `${capture.logLevel} - ${basename(capture.filePath)} - ${dirname(
          capture.filePath
        )}`
      ) {
        fp = capture.filePath; // Get the file path from the selected option
        break;
      }
    }
  }
  if (fp) {
    unregisterTerminalForCapture(fp);
  }
  vscode.window.showInformationMessage(
    "Terminal logging has been unregistered. No further logs will be captured."
  );
};

export function activate() {
  if (
    vscode.workspace
      .getConfiguration("weaponized")
      .get<boolean>("terminal-log.enabled", false)
  ) {
    logger.info("Registering terminal for capture...");
    if (!vscode.workspace.workspaceFolders) {
      logger.error(
        "No workspace folders found. Cannot register terminal for capture."
      );
      return;
    }
    let fp = vscode.workspace
      .getConfiguration("weaponized")
      .get<string>(
        "terminal-log.path",
        "${workspaceFolder}/.vscode/.terminal.log"
      );
    fp = variables(fp);
    const loglevel = vscode.workspace
      .getConfiguration("weaponized")
      .get<string>("terminal-log.level", "command-only");
    registerTerminalForCapture(fp, loglevel);
  } else {
    logger.info("Terminal logging is disabled in settings.");
  }

  vscode.window.onDidStartTerminalShellExecution(
    async (event: vscode.TerminalShellExecutionStartEvent) => {
      for (const capture of TerminalCaptureRecorder.captures) {
        await capture.listener(event);
      }
    }
  );
}
