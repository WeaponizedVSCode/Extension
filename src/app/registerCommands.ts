import * as vscode from "vscode";
import { dumpalluser, dumpetchosts, switchActiveHost, switchActiveUser } from "../features/targets";
import { setupCommand } from "../features/setup";
import { runCommand, copyCommand } from "../features/shell";
import { replacer, displayVirtualContent, ReadOnlyProvider } from "../features/editor";
import { msfvenomPayloadCreation, hashcatCracker, scanCommand } from "../features/tasks";
import { cyberChefMagicDecoder } from "../features/decoder";
import { rawHTTPRequest, rawHTTPRequestToCurl } from "../features/http";

export function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("weapon.dump_hosts", dumpetchosts),
    vscode.commands.registerCommand("weapon.dump_users", dumpalluser),
    vscode.commands.registerCommand("weapon.switch_host", switchActiveHost),
    vscode.commands.registerCommand("weapon.switch_user", switchActiveUser),
    vscode.commands.registerCommand(
      "weapon.display_virtual_content",
      displayVirtualContent
    ),
    vscode.commands.registerCommand("weapon.magic_decoder", cyberChefMagicDecoder),
    vscode.commands.registerCommand("weapon.run_command", runCommand),
    vscode.commands.registerCommand("weapon.copy", copyCommand),
    vscode.commands.registerCommand("weapon.replace_document", replacer),
    vscode.commands.registerCommand(
      "weapon.task.msfvenom_creation",
      msfvenomPayloadCreation
    ),
    vscode.commands.registerCommand(
      "weapon.task.hashcat_cracker",
      hashcatCracker
    ),
    vscode.commands.registerCommand("weapon.task.scan", scanCommand),
    vscode.commands.registerCommand("weapon.setup", setupCommand),
    vscode.workspace.registerTextDocumentContentProvider(
      "weaponized-editor",
      new ReadOnlyProvider()
    ),
    vscode.commands.registerCommand("weapon.http_raw_request", rawHTTPRequest),
    vscode.commands.registerCommand(
      "weapon.http_raw_request_to_curl",
      rawHTTPRequestToCurl
    )
  );
}

