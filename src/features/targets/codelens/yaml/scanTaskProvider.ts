import * as vscode from "vscode";
import { MarkdownCodeLensGenerator } from "./base";
import { parseHostsYaml } from "../../../../core";
import { logger } from "../../../../platform/vscode/logger";

export const GenerateScanTaskCodeLens: MarkdownCodeLensGenerator = (
  configtype,
  config,
  startLine,
  document
) => {
  let codeLenses: vscode.CodeLens[] = [];
  if (configtype !== "host") {
    return codeLenses; // Only generate for host type
  }
  startLine = startLine + 1;

  if (false) {
    // version2
    let lns = config.split("\n"); // Ensure config is a string
    let currentSubConfig: string[] = [];
    let old_startLine = startLine;
    // process each line if line first character is "-", it is a new sub-config begin signifier
    for (var i = 0; i < lns.length; i++) {
      if (lns[i].length !== 0 && lns[i][0] === "-") {
        if (currentSubConfig.length > 0) {
          // Process the previous sub-config
          let Hosts = parseHostsYaml(currentSubConfig.join("\n")); // Join the previous sub-config lines
          const cmd: vscode.Command = {
            title: `Scan host`,
            command: "weapon.task.scan",
            arguments: [{ hosts: Hosts }],
          };
          codeLenses.push(
            new vscode.CodeLens(
              new vscode.Range(
                new vscode.Position(old_startLine, 0),
                new vscode.Position(old_startLine, 0)
              ),
              cmd
            )
          );
        }
        old_startLine = startLine + i; // Update the start line for the new sub-config
        currentSubConfig = []; // Reset for the next sub-config
        logger.trace(
          `New sub-config detected at line ${old_startLine}: ${lns[i]}`
        );
      }
      logger.trace(`Adding line to current sub-config: ${lns[i]}`);
      currentSubConfig.push(lns[i]); // Start a new sub-config
    }
    // Process the last sub-config if exists
    if (currentSubConfig.length > 0) {
      let Hosts = parseHostsYaml(currentSubConfig.join("\n")); // Join the last sub-config lines
      logger.debug(`Parsed hosts: ${JSON.stringify(Hosts)}`);
      const cmd: vscode.Command = {
        title: `Scan host`,
        command: "weapon.task.scan",
        arguments: [{ hosts: Hosts }],
      };
      codeLenses.push(
        new vscode.CodeLens(
          new vscode.Range(
            new vscode.Position(old_startLine, 0),
            new vscode.Position(old_startLine, 0)
          ),
          cmd
        )
      );
    }
    return codeLenses; // Return the accumulated code lenses
  }

  // version1
  let Hosts = parseHostsYaml(config);

  const cmd: vscode.Command = {
    title: `Scan host`,
    command: "weapon.task.scan",
    arguments: [{ hosts: Hosts }],
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
};
