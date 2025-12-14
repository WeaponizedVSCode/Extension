import * as vscode from "vscode";
import { logger } from "../../../platform/vscode/logger";
import { ConfigType } from "../../../core";
import { Context } from "../../../platform/vscode/context";

const FoamCommand = "foam-vscode.create-note-from-template";

function GenerateNoteCreationCodeLens(
  configType: ConfigType,
  targetName: string,
  startLine: number
): vscode.CodeLens[] {
  logger.debug(
    `Generating code lens for note creation with config type: ${configType}`
  );
  try {
    if (configType === "user") {
      let userState = Context.UserState;
      if (userState) {
        if (userState.find((u) => u.user === targetName)) {
          logger.debug(`User ${targetName} already exists.`);
          return []; // User already exists, no need to create a new note
        }
      }
    } else if (configType === "host") {
      let hostState = Context.HostState;
      if (hostState) {
        if (hostState.find((h) => h.hostname === targetName)) {
          logger.debug(`Host ${targetName} already exists.`);
          return []; // Host already exists, no need to create a new note
        }
      }
    } else {
      throw new Error(
        `Unknown config type: ${configType}. Expected 'user' or 'host'.`
      );
    }
  } catch (error) {
    logger.error(`Error generating code lens: ${error}`);
  }
  let codeLenses: vscode.CodeLens[] = [];
  const cmd: vscode.Command = {
    title: `Create note for ${targetName} (${configType})`, // foam command disallow args
    command: FoamCommand,
  };
  codeLenses.push(
    new vscode.CodeLens(
      new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(startLine + 1, 0)
      ),
      cmd
    )
  );
  return codeLenses;
}

export class NoteCreationProvider implements vscode.CodeLensProvider {
  provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    var codeLenses = [];
    const lines = document.getText().split("\n");

    for (var i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lino = i; // Line numbers are 1-based in VSCode
      let configtype: ConfigType | undefined = undefined;
      let targetName: string | undefined = undefined;

      if (line.includes("get user") || line.includes("own user")) {
        try {
          targetName = line.match(/(get|own) user\s+(\w+)/)?.[2];
        } catch (error) {
          logger.error(`Error parsing line ${lino}: ${error}`);
        }
        configtype = "user";
        logger.debug(`Found 'get new user' at line ${lino}`);
      } else if (line.includes("get host") || line.includes("own host")) {
        try {
          targetName = line.match(/(get|own) host\s+(\w+)/)?.[2];
        } catch (error) {
          logger.error(`Error parsing line ${lino}: ${error}`);
        }
        configtype = "host";
        logger.debug(`Found 'get new host' at line ${lino}`);
      } else {
        continue;
      }

      if (configtype && targetName) {
        logger.debug(`Generating code lens for config type: ${configtype}`);
        codeLenses.push(
          ...GenerateNoteCreationCodeLens(configtype, targetName, lino)
        );
        continue;
      }
      continue;
    }
    return codeLenses;
  }
}
