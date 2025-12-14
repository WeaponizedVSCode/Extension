import * as vscode from "vscode";
import { logger } from "../../../platform/vscode/logger";
import { callback } from "../../../shared/types";
import { Context } from "../../../platform/vscode/context";
import { dumpHosts, parseHostsYaml, Host, extractYamlBlocksByIdentity, replaceFencedBlockContent } from "../../../core";

export const switchActiveHost: callback = async (args) => {
  let host: Host | undefined = args?.host;
  if (!host) {
    let hostList = Context.HostState;
    if (!hostList || hostList.length === 0) {
      vscode.window.showErrorMessage("No hosts found to switch.");
      return;
    }

    let hostOptions = hostList.map((h) => `${h.hostname}(${h.ip})`);
    var hostString = await vscode.window.showQuickPick(hostOptions, {
      placeHolder: "Select a host to switch",
    });
    if (!hostString) {
      vscode.window.showErrorMessage("No host selected. Operation cancelled.");
      return;
    }
    host = hostList.find((h) => `${h.hostname}(${h.ip})` === hostString);
    if (!host) {
      vscode.window.showErrorMessage("Selected host not found in host list.");
      return;
    }
  }

  let files = await vscode.workspace.findFiles(`**/*.md`);
  if (files.length === 0) {
    vscode.window.showInformationMessage("No markdown files found.");
    return;
  }

  for (const file of files) {
    await setHostActive(file, host);
  }
};

async function setHostActive(file: vscode.Uri, host: Host) {
  let content = await vscode.workspace.fs.readFile(file);
  let contentString = content.toString();
  const hostBlocks = extractYamlBlocksByIdentity(contentString, "host");
  if (!hostBlocks.length) {
    return;
  }
  try {
    for (const block of hostBlocks) {
      const hostCreds = parseHostsYaml(block.content);
      for (const hostCred of hostCreds) {
        if (hostCred.hostname === host.hostname && hostCred.ip === host.ip) {
          // Set this host as active
          hostCred.is_current = true;
          logger.info(
            `Set host ${host.hostname}(${host.ip}) as active in file: ${file.fsPath}`
          );
        } else {
          // Set other hosts as inactive
          hostCred.is_current = false;
        }
      }
      contentString = replaceFencedBlockContent(
        contentString,
        block,
        dumpHosts(hostCreds, "yaml").trimEnd() + "\n"
      );
    }
    await vscode.workspace.fs.writeFile(file, Buffer.from(contentString));
  } catch (error) {
    logger.error(`Error setting host active in file: ${file.fsPath}`);
  }
}
