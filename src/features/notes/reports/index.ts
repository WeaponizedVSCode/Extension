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

  if (!Context.Foam) {
    vscode.window.showErrorMessage(
      "Foam extension is not available. Please ensure it is installed and activated."
    );
    return;
  }
  const foam = Context.Foam;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      "No workspace folder is open. Please open a workspace folder to create a note."
    );
    return;
  }

  const folder = workspaceFolders[0].uri;

  // args type of notes
  let noteType: string = args.type || "";
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

  // note name
  let noteName: string = args.name || "";
  if (!noteName) {
    var input = await vscode.window.showInputBox({
      prompt: "Enter the name of the note",
      placeHolder: "Note Name: like domain@user ",
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
    domain = name[0].replace(/[^a-zA-Z0-9-_]/g, "_");
    id = name[1].replace(/[^a-zA-Z0-9-_]/g, "_");
  } else {
    id = name[0].replace(/[^a-zA-Z0-9-_]/g, "_");
    domain = id;
  }

  // Create the note file

  try {
    const uri = vscode.Uri.joinPath(
      folder,
      noteType + "s",
      noteName,
      noteName + ".md"
    );

    let content: string = "";
    if (noteT === "report") {
      var res = await createNote({
        logger,
        foam,
      });
      content = res.content;
    } else {
      let templateContent = fs[`${noteT}`];
      if (!templateContent) {
        vscode.window.showErrorMessage(
          `Template for note type '${noteType}' not found.`
        );
        return;
      }
      content = templateContent.replaceAll("${1:$TM_FILENAME_BASE}", noteName);
      content = content.replaceAll("${DOMAIN}", domain);
      content = content.replaceAll("${USER}", id);
    }
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
    vscode.window.showTextDocument(uri);
    vscode.window.showInformationMessage(
      `[Weaponized] ${noteType} note '${domain}@${id}' created successfully.`
    );
  } catch (error) {
    logger.error(`Failed to create ${noteType} note: ${error}`);
    vscode.window.showErrorMessage(
      `[Weaponized] Failed to create ${noteType} note: ${error}`
    );
  }
};
