import * as vscode from "vscode";
import { logger } from "../../../platform/vscode/logger";
import "fs";
import { appendFileSync } from "fs";
import { TerminalCapture, TerminalCaptureRecorder } from "./store";
import { TerminalRecorderMode } from "./mode";

async function ForceFileExist(file: vscode.Uri) {
  try {
    let stat = await vscode.workspace.fs.stat(file);
    if (stat) {
      logger.info(`File ${file.fsPath} already exists.`);
      return stat;
    }
  } catch (error) {
    logger.info(`File ${file.fsPath} does not exist, creating it...`);
    await vscode.workspace.fs.writeFile(file, Buffer.from(""));
  }
}

export function registerTerminalForCapture(fp: string, loglevel: string, processIds?: number[]) {
  logger.info(
    `Registering terminal for capture at ${fp}, with log level: ${loglevel}`
  );
  let logFile = vscode.Uri.parse(fp);
  if (processIds) {
    logger.info(
      `Registering terminal for capture at ${fp} for specific process IDs: ${processIds.join(", ")}`
    );
  }

  let newCapture: TerminalCapture = {
    filePath: logFile.fsPath,
    logLevel: loglevel,
    
    listener: async (event: vscode.TerminalShellExecutionStartEvent) => {
      // perparing the basic infomations
      await ForceFileExist(logFile);
      const terminal = event.terminal;
      const terminalid = await event.terminal.processId;
      if (processIds) {
        if (!processIds.some((pid) => {
          return pid === terminalid;
        })) {
          logger.debug(
            `Skipping terminal capture for terminal ID ${terminalid} as it is not in the specified process IDs: ${processIds.join(", ")}`
          );
          return; // Skip this terminal if its ID is not in the specified process IDs
        }
      }
      let startTime = new Date();
      let cmd = event.execution.commandLine.value;
      let cwd =
        event.execution.cwd?.fsPath || event.shellIntegration?.cwd || "unknown";
      let logMessage = `\nweaponized-terminal-logging:[${startTime.getTime()}][terminalid: ${terminalid}][terminalName: ${
        terminal.name
      }] user@${cwd}$ ${cmd}\n`;
      logger.debug(logMessage);

      const recordInput = () => {
        appendFileSync(logFile.fsPath, logMessage);
      };
      const recordOutput = async () => {
        let stream = await event.execution.read();
        for await (const streamPart of stream) {
          appendFileSync(logFile.fsPath, `${streamPart}`);
        }
      };

      switch (loglevel) {
        case TerminalRecorderMode.CommandOnly:
          recordInput();
          break;
        case TerminalRecorderMode.OutputOnly:
          recordOutput();
          break;
        // Log both input and output
        case TerminalRecorderMode.CommandAndOutput:
          recordInput();
          recordOutput();
          break;
        case TerminalRecorderMode.NetcatHandler:
          if (terminal.name === "netcat handler") {
            recordOutput();
          }
          break;
        default:
          logger.warn(
            `Unknown log level: ${loglevel}. Defaulting to CommandOnly mode.`
          );
      }
    },
  };
  TerminalCaptureRecorder.addCapture(newCapture);
}

export function unregisterTerminalForCapture(fp: string) {
  for (let i = 0; i < TerminalCaptureRecorder.length; i++) {
    if (TerminalCaptureRecorder.captures[i].filePath === fp) {
      TerminalCaptureRecorder.removeCapture(fp);
      logger.info(`Unregistered terminal capture for file: ${fp}`);
      return;
    }
  }
  logger.warn(`No terminal capture found for file: ${fp}`);
  vscode.window.showWarningMessage(
    `No terminal capture found for file: ${fp}. Nothing to unregister.`
  );
  return;
}
