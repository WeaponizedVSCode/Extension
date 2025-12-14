import * as vscode from "vscode";
import {
  UserCredential,
  Host,
  parseHostsYaml,
  parseUserCredentialsYaml,
  dumpHosts,
  dumpUserCredentials,
  UserDumpFormat,
} from "../../../../core";
import { logger } from "../../../../platform/vscode/logger";
import { parse as yamlParse } from "yaml";
import { MarkdownCodeLensGenerator } from "./base";

export const GenerateEnvExportCodeLens: MarkdownCodeLensGenerator = (
  configtype,
  config,
  startLine
) => {
  logger.debug(
    `Generating code lens for config type: ${configtype} with content: ${config}`
  );
  let codeLenses: vscode.CodeLens[] = [];

  for (let active of [false, true]) {
    let title = active ? "export as current" : "export to terminal";
    let configs: string = "";
    try {
      if (configtype === "user") {
        let users = parseUserCredentialsYaml(config);
        users.forEach((v) => {
          if (active) {
            return v.setAsCurrent();
          }
          return v;
        });

        configs = dumpUserCredentials(users, "env");
      } else if (configtype === "host") {
        let hosts = parseHostsYaml(config);
        hosts.forEach((v) => {
          if (active) {
            return v.setAsCurrent();
          }
          return v;
        });
        configs = dumpHosts(hosts, "env");
      } else {
        new Error(
          `Unknown config type: ${configtype}. Expected 'user' or 'host'.`
        );
      }
    } catch (error) {
      logger.error(`Error parsing config: ${error}`);
      return codeLenses;
    }

    const cmd: vscode.Command = {
      title: title,
      command: "weapon.run_command",
      arguments: [{ command: `${configs}` }],
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
  }

  return codeLenses;
};

export const GenerateDumpUserCredCodeLens: MarkdownCodeLensGenerator = (
  configtype,
  config,
  startLine
) => {
  logger.debug("Generating code lens for user credentials dump");
  let codeLenses: vscode.CodeLens[] = [];
  if (configtype !== "user") {
    return codeLenses;
  }
  const Users = parseUserCredentialsYaml(config);
  if (Users.length === 0) {
    logger.warn("No user credentials found in the provided YAML.");
    return codeLenses;
  }
  for (let fmt of ["impacket", "nxc"]) {
    var format = fmt as UserDumpFormat;
    const cmd: vscode.Command = {
      title: `dump as ${format}`,
      command: "weapon.display_virtual_content",
      arguments: [
        {
          content: dumpUserCredentials(Users, format).trim(),
          copyToClipboard: true,
        },
      ],
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
  }
  return codeLenses;
};

export const GenerateSetAsCurrentCodeLens: MarkdownCodeLensGenerator = (
  configtype,
  config,
  startLine
) => {
  let codeLenses: vscode.CodeLens[] = [];
  for (let active of [true, false]) {
    let title = active ? "set as current" : "unset as current";
    const cmd: vscode.Command = {
      title: title,
      command: "weapon.replace_document",
      arguments: [
        {
          file: vscode.window.activeTextEditor?.document.uri,
          startLine: startLine,
          current: config,
          target: ((): string => {
            if (configtype === "user") {
              let users = yamlParse(config) as UserCredential[];
              users.forEach((v) => {
                return (v.is_current = active);
              });
              return dumpUserCredentials(users, "yaml");
            } else if (configtype === "host") {
              let hosts = yamlParse(config) as Host[];
              hosts.forEach((v) => {
                return (v.is_current = active);
              });
              return dumpHosts(hosts, "yaml");
            } else {
              throw new Error(
                `Unknown config type: ${configtype}. Expected 'user' or 'host'.`
              );
            }
          })(),
        },
      ],
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
  }

  return codeLenses;
};
