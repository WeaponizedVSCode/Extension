import * as vscode from "vscode";
import {
  dumpalluser,
  dumpetchosts,
  switchActiveHost,
  switchActiveUser,
} from "../features/targets";
import { setupCommand } from "../features/setup";
import { runCommand, copyCommand } from "../features/shell";
import {
  replacer,
  displayVirtualContent,
  ReadOnlyProvider,
} from "../features/editor";
import {
  msfvenomPayloadCreation,
  hashcatCracker,
  scanCommand,
} from "../features/tasks";
import { cyberChefMagicDecoder } from "../features/decoder";
import { rawHTTPRequest, rawHTTPRequestToCurl } from "../features/http";
import { CreateNoteFile } from "../features/notes/reports";
import { installMcpServer } from "../features/mcp/install";
import { Commands } from "../shared/commands";

export function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.DUMP_HOSTS, dumpetchosts),
    vscode.commands.registerCommand(Commands.DUMP_USERS, dumpalluser),
    vscode.commands.registerCommand(Commands.SWITCH_HOST, switchActiveHost),
    vscode.commands.registerCommand(Commands.SWITCH_USER, switchActiveUser),
    vscode.commands.registerCommand(
      Commands.DISPLAY_VIRTUAL,
      displayVirtualContent
    ),
    vscode.commands.registerCommand(
      Commands.MAGIC_DECODER,
      cyberChefMagicDecoder
    ),
    vscode.commands.registerCommand(Commands.RUN_COMMAND, runCommand),
    vscode.commands.registerCommand(Commands.COPY, copyCommand),
    vscode.commands.registerCommand(Commands.REPLACE_DOCUMENT, replacer),
    vscode.commands.registerCommand(
      Commands.TASK_MSFVENOM,
      msfvenomPayloadCreation
    ),
    vscode.commands.registerCommand(
      Commands.TASK_HASHCAT,
      hashcatCracker
    ),
    vscode.commands.registerCommand(Commands.TASK_SCAN, scanCommand),
    vscode.commands.registerCommand(Commands.SETUP, setupCommand),
    vscode.workspace.registerTextDocumentContentProvider(
      "weaponized-editor",
      new ReadOnlyProvider()
    ),
    vscode.commands.registerCommand(Commands.HTTP_RAW_REQUEST, rawHTTPRequest),
    vscode.commands.registerCommand(
      Commands.HTTP_TO_CURL,
      rawHTTPRequestToCurl
    ),
    vscode.commands.registerCommand(Commands.NOTE_CREATION, CreateNoteFile),
    vscode.commands.registerCommand(Commands.MCP_INSTALL, installMcpServer)
  );
}
