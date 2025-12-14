import * as vscode from "vscode";
import {
  dumpUserCredentials,
  UserDumpFormat,
} from "../../../core";

import { Context } from "../../../platform/vscode/context";
import { callback } from "../../../shared/types";

let formats = ["env", "impacket", "nxc", "yaml", "table"];

export const dumpalluser: callback = async () => {
  let users = Context.UserState;
  if (!users) {
    return;
  }

  let format = await vscode.window.showQuickPick(formats, {
    placeHolder: "Select a format to dump all hosts in notes",
  });
  if (!format) {
    vscode.window.showErrorMessage("No format selected, aborting.");
    return;
  }

  let content = dumpUserCredentials(users, format as UserDumpFormat).trim();
  await vscode.commands.executeCommand("weapon.display_virtual_content", {
    title: "All User Credentials",
    content: content,
  });
};
