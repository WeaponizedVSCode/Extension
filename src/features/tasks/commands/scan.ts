import * as vscode from "vscode";
import { callback } from "../../../shared/types";
import { logger } from "../../../platform/vscode/logger";
import { CreateTaskLikeInteractiveTerminal } from "../terminals/taskTerminal";
import { Context } from "../../../platform/vscode/context";
import { Collects, Host } from "../../../core";
import { variables } from "../../../platform/vscode/variables";

export const scanCommand: callback = async (args: any) => {
  let selectTargets = Context.HostState;
  if (args?.hosts) {
    selectTargets = args.hosts;
  }

  let target: string | undefined = args?.target;
  if (!target) {
    if (!selectTargets || selectTargets.length === 0) {
      vscode.window.showErrorMessage("No hosts found to scan.");
      target = await vscode.window.showInputBox({
        placeHolder: "Enter a target (ip/domain/...etc) to scan",
      });
    } else {
      let selected: Host | undefined = undefined;
      if (selectTargets.length !== 1) {
        let list: string[] = [];
        selectTargets.forEach((host) => {
          list.push(`${host.hostname} (${host.ip})`);
        });
        target = await vscode.window.showQuickPick(list, {
          placeHolder: "Select a host to scan",
        });
        if (!target) {
          vscode.window.showErrorMessage(
            "No target selected. Operation cancelled."
          );
          return;
        }
        selected = selectTargets.find(
          (host) => `${host.hostname} (${host.ip})` === target
        );
      } else {
        selected = selectTargets[0];
      }

      if (!selected) {
        vscode.window.showErrorMessage(
          "Selected target not found in host list."
        );
        return;
      }
      let options: string[] = Array.from(
        new Set([selected.hostname, selected.ip, ...selected.alias])
      );

      target = await vscode.window.showQuickPick(options, {
        placeHolder: "Select an option to scan",
      });
    }
  }
  if (!target) {
    vscode.window.showErrorMessage("No target selected. Operation cancelled.");
    return;
  }

  let scannerConfig = vscode.workspace
    .getConfiguration("weaponized")
    .get<Collects>("scanners");
  if (!scannerConfig || Object.keys(scannerConfig).length === 0) {
    vscode.window.showErrorMessage("No scanners configured in settings.");
    return;
  }

  let scanner: string | undefined = args?.scanner;
  if (!scanner) {
    let options: string[] = Object.keys(scannerConfig);
    scanner = await vscode.window.showQuickPick(options, {
      placeHolder: "Select a scanner",
    });
    if (!scanner) {
      vscode.window.showErrorMessage(
        "No scanner selected. Operation cancelled."
      );
      return;
    }
  }
  logger.debug(`Selected scanner: ${scanner}`);
  let scannerCommand = variables(scannerConfig[scanner]);
  if (!scannerCommand) {
    vscode.window.showErrorMessage(`Scanner command for ${scanner} not found.`);
    return;
  }
  let finalCommand = scannerCommand.replaceAll("$TARGET", target);
  logger.info(`Scanner command: ${finalCommand}`);
  CreateTaskLikeInteractiveTerminal(
    `${scanner} scanning ${target}`,
    [finalCommand],
    vscode.TerminalLocation.Editor
  );
};
