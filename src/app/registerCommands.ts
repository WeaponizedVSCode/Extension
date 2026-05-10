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

/**
 * Registers stateless commands that have no dependency on runtime feature state.
 *
 * Convention: commands that require access to a feature's runtime state (e.g. a
 * TreeView provider, a bridge instance) belong in their own `registerXxxFeature()`
 * function inside `src/features/<feature>/index.ts`, not here.
 * Example: Intent commands (approve/skip/setGoal) live in features/intent/index.ts
 * because they need the IntentTreeProvider reference.
 */
export function registerCommands(context: vscode.ExtensionContext) {
  // ── Exposed ──────────────────────────────────────────────────────────────
  // Commands declared in package.json contributes.commands.
  // These appear in the Command Palette and can be bound to keybindings/menus.
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.SETUP, setupCommand),
    vscode.commands.registerCommand(Commands.DUMP_HOSTS, dumpetchosts),
    vscode.commands.registerCommand(Commands.DUMP_USERS, dumpalluser),
    vscode.commands.registerCommand(Commands.SWITCH_HOST, switchActiveHost),
    vscode.commands.registerCommand(Commands.SWITCH_USER, switchActiveUser),
    vscode.commands.registerCommand(Commands.TASK_MSFVENOM, msfvenomPayloadCreation),
    vscode.commands.registerCommand(Commands.TASK_HASHCAT, hashcatCracker),
    vscode.commands.registerCommand(Commands.TASK_SCAN, scanCommand),
    vscode.commands.registerCommand(Commands.MAGIC_DECODER, cyberChefMagicDecoder),
    vscode.commands.registerCommand(Commands.NOTE_CREATION, CreateNoteFile),
    vscode.commands.registerCommand(Commands.MCP_INSTALL, installMcpServer),
  );

  // ── Internal ─────────────────────────────────────────────────────────────
  // Commands used only via vscode.commands.executeCommand() inside the
  // extension. Not listed in package.json — invisible to the user.
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.RUN_COMMAND, runCommand),
    vscode.commands.registerCommand(Commands.COPY, copyCommand),
    vscode.commands.registerCommand(Commands.REPLACE_DOCUMENT, replacer),
    vscode.commands.registerCommand(Commands.DISPLAY_VIRTUAL, displayVirtualContent),
    vscode.commands.registerCommand(Commands.HTTP_RAW_REQUEST, rawHTTPRequest),
    vscode.commands.registerCommand(Commands.HTTP_TO_CURL, rawHTTPRequestToCurl),
    vscode.workspace.registerTextDocumentContentProvider(
      "weaponized-editor",
      new ReadOnlyProvider()
    ),
  );
}
