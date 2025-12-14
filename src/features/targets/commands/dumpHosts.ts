import * as vscode from "vscode";
import { dumpHosts, HostDumpFormat } from "../../../core";
import { callback } from "../../../shared/types";
import { Context } from "../../../platform/vscode/context";

let formats = ["env", "hosts", "yaml", "table"];

export const dumpetchosts: callback = async () => {
  let hosts = Context.HostState;
  if (!hosts) {
    return;
  }
  let format = await vscode.window.showQuickPick(formats, {
    placeHolder: "Select a format to dump all hosts in notes",
  });
  if (!format) {
    vscode.window.showErrorMessage("No format selected, aborting.");
    return;
  }
  await vscode.commands.executeCommand("weapon.display_virtual_content", {
    title: "/etc/hosts",
    content: dumpHosts(hosts, format as HostDumpFormat).trim(),
    copyToClipboard: true,
  });
};
