import { Context } from "../../../platform/vscode/context";
import { logger } from "../../../platform/vscode/logger";
import { callback } from "../../../shared/types";
import * as vscode from "vscode";
import { fs } from "./assets";
import { createNote } from "./report";

export const CreateNoteFile: callback = async (args) => {
  if (!args) {
    args = {
      type: "",
      name: "",
    };
  }

  const ctx = new Context();
  const foam = await ctx.Foam();

  if (!foam) {
    vscode.window.showErrorMessage(
      "Foam extension is not available. Please ensure it is installed and activated.",
    );
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      "No workspace folder is open. Please open a workspace folder to create a note.",
    );
    return;
  }

  const folder = workspaceFolders[0].uri;

  // args type of notes
  let noteType: string = args.type || "";
  // logger.info(`trying to Creating note of type: ${noteType}`);
  if (
    !noteType ||
    (noteType !== "host" &&
      noteType !== "user" &&
      noteType !== "service" &&
      noteType !== "finding" &&
      noteType !== "report")
  ) {
    const noteTypes = ["host", "user", "service", "finding", "report"];
    const selectedType = await vscode.window.showQuickPick(noteTypes, {
      placeHolder: "Select the type of note to create",
    });
    if (!selectedType) {
      vscode.window.showErrorMessage("No note type selected.");
      return;
    }
    args.type = selectedType;
    noteType = selectedType;
  }
  if (!noteType) {
    vscode.window.showErrorMessage("Note type is not specified.");
    return;
  }
  let noteT = noteType as "host" | "user" | "service" | "finding" | "report";
  logger.info("note type: " + noteT);
  // note name
  let noteName: string = args.name || "";
  if (!noteName) {
    var placeholder = "";
    switch (noteT) {
      case "host":
        placeholder = "xxxx.com";
        break;
      case "user":
        placeholder = "user@domain.com";
        break;
      case "service":
        placeholder = "service@domain.com";
        break;
      case "finding":
        placeholder = "finding@domain.com";
        break;
      case "report":
        placeholder = "report.md";
        break;
      default:
        placeholder = "notename";
        break;
    }

    var input = await vscode.window.showInputBox({
      prompt: "Enter the name of the note",
      placeHolder: `Note Name for ${noteType}, e.g. ${placeholder}`,
    });
    if (!input) {
      vscode.window.showErrorMessage("No note name provided.");
      return;
    }
    noteName = input.trim();
  }

  var name = noteName.split("@"); // sanitize the name
  let domain = "default";
  let id = "default";
  if (name.length === 2) {
    domain = name[1].replace(/[^a-zA-Z0-9-_]/g, "_");
    id = name[0].replace(/[^a-zA-Z0-9-_]/g, "_");
  } else {
    id = name[0].replace(/[^a-zA-Z0-9-_]/g, "_");
    domain = id;
  }

  // Create the note file

  try {
    let uri: vscode.Uri;

    let content: string = "";
    if (noteT === "report") {
      var res = await createNote({
        logger,
        foam,
      });
      content = res.content;
      uri = vscode.Uri.joinPath(folder, noteName);
    } else {
      let templateContent = fs[`${noteT}`];
      if (!templateContent) {
        vscode.window.showErrorMessage(
          `Template for note type '${noteType}' not found.`,
        );
        return;
      }
      content = templateContent.replaceAll("${1:$TM_FILENAME_BASE}", noteName);
      content = content.replaceAll("${DOMAIN}", domain);
      content = content.replaceAll("${USER}", id);
      uri = vscode.Uri.joinPath(
        folder,
        noteType + "s",
        noteName,
        noteName + ".md",
      );
    }
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
    vscode.window.showTextDocument(uri);
    vscode.window.showInformationMessage(
      `[Weaponized] ${noteType} note '${noteName}' created successfully.`,
    );
  } catch (error) {
    logger.error(`Failed to create ${noteType} note: ${error}`);
    vscode.window.showErrorMessage(
      `[Weaponized] Failed to create ${noteType} note: ${error}`,
    );
  }
};
