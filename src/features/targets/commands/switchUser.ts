import * as vscode from "vscode";
import { logger } from "../../../platform/vscode/logger";
import { callback } from "../../../shared/types";
import { Context } from "../../../platform/vscode/context";
import {
  dumpUserCredentials,
  parseUserCredentialsYaml,
  UserCredential,
  extractYamlBlocksByIdentity,
  replaceFencedBlockContent,
} from "../../../core";

export const switchActiveUser: callback = async (args) => {
  let user: UserCredential | undefined = args?.user;
  if (!user) {
    let userList = Context.UserState;
    if (!userList || userList.length === 0) {
      vscode.window.showErrorMessage("No users found to switch.");
      return;
    }

    let userOptions = userList.map((u) => `${u.user} @ ${u.login}`); // let user head of the login
    var userString = await vscode.window.showQuickPick(userOptions, {
      placeHolder: "Select a user to switch",
    });
    if (!userString) {
      vscode.window.showErrorMessage("No user selected. Operation cancelled.");
      return;
    }
    user = userList.find((u) => `${u.user} @ ${u.login}` === userString);
    if (!user) {
      vscode.window.showErrorMessage("Selected user not found in user list.");
      return;
    }
  }

  let files = await vscode.workspace.findFiles(`**/*.md`);
  if (files.length === 0) {
    vscode.window.showInformationMessage("No markdown files found.");
    return;
  }

  for (const file of files) {
    try {
      logger.info(`trying to set user active in file: ${file.fsPath}`);
      await setUserActive(file, user);
    } catch (error) {
      logger.error(`Error setting user active in file: ${file.fsPath}`, error);
      vscode.window.showErrorMessage(
        `Failed to set user active in file: ${file.fsPath}`
      );
    }
  }
};

async function setUserActive(file: vscode.Uri, user: UserCredential) {
  let content = await vscode.workspace.fs.readFile(file);
  let contentString = content.toString();
  const userBlocks = extractYamlBlocksByIdentity(contentString, "credentials");
  if (!userBlocks.length) {
    return;
  }
  try {
    for (const block of userBlocks) {
      const userCreds = parseUserCredentialsYaml(block.content);
      for (let i in userCreds) {
        if (userCreds[i].login === user.login && userCreds[i].user === user.user) {
          // Set this user as active
          userCreds[i].is_current = true;
          logger.info(
            `Set user ${userCreds[i].login}/${userCreds[i].user} as active in file: ${file.fsPath}`
          );
        } else {
          // Set other users as inactive
          userCreds[i].is_current = false;
          logger.info(
            `Set user ${userCreds[i].login}/${userCreds[i].user} as inactive in file: ${file.fsPath}`
          );
        }
      }
      contentString = replaceFencedBlockContent(
        contentString,
        block,
        dumpUserCredentials(userCreds, "yaml").trimEnd() + "\n"
      );
      logger.info(`Updated user block in file: ${file.fsPath}`);
    }
    logger.info(`Writing updated content to file: ${file.fsPath}`);
    await vscode.workspace.fs.writeFile(file, Buffer.from(contentString));
  } catch (error) {
    logger.error(`Error setting user active in file: ${file.fsPath}`, error);
  }
}
