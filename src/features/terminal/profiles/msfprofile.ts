import * as vscode from 'vscode';
import { logger } from '../../../platform/vscode/logger';
import { BaseWeaponizedTerminalProvider } from './base';
import { variables } from '../../../platform/vscode/variables';


export const MsfconsoleWeaponizedTerminalProvider = new BaseWeaponizedTerminalProvider(
  "Msfconsole",
  () => {
    let msfconsolePath = vscode.workspace.getConfiguration("weaponized").get<string>("msf.console");
    if (!msfconsolePath) {
      vscode.window.showErrorMessage("Please set the 'weaponized.msfconsolePath' configuration in settings.");
      return [
        "# Please set the 'weaponized.msfconsolePath' configuration in settings.",
      ];
    }
    msfconsolePath = variables(msfconsolePath);
    let args: string[] = [];
    args.push("-x");
    args.push(
      `'setg LHOST=${variables(vscode.workspace.getConfiguration("weaponized").get("lhost", "$LHOST"))};` + 
      `setg LPORT=${variables(vscode.workspace.getConfiguration("weaponized").get("lport", "$LPORT"))};'`);
    logger.debug(`Starting msfconsole session with args: ${JSON.stringify(args)}`);
    return [
      msfconsolePath,
      ...args
    ];
  },
);

export const MeterpreterWeaponizedTerminalProvider = new BaseWeaponizedTerminalProvider(
  "Meterpreter",
  () => {
    let msfconsolePath = vscode.workspace.getConfiguration("weaponized").get<string>("msf.console");
    if (!msfconsolePath) {
      vscode.window.showErrorMessage("Please set the 'weaponized.msfconsolePath' configuration in settings.");
      return [
        "# Please set the 'weaponized.msfconsolePath' configuration in settings.",
      ];
    }
    msfconsolePath = variables(msfconsolePath);
    let args: string[] = [
      "-q", // quiet mode
    ];
    let resourceFile = vscode.workspace.getConfiguration("weaponized").get<string>("msf.resourcefile");
    if (resourceFile) {
      args.push(`-r`);
      args.push(variables(resourceFile));
    }
    args.push("-x");
    args.push(
      `'setg LHOST=${variables(vscode.workspace.getConfiguration("weaponized").get("lhost", "$LHOST"))};` + 
      `setg LPORT=${variables(vscode.workspace.getConfiguration("weaponized").get("lport", "$LPORT"))};'`);
    logger.debug(`Starting Meterpreter session with args: ${JSON.stringify(args)}`);
    return [
      msfconsolePath,
      ...args
    ];
  }
);
