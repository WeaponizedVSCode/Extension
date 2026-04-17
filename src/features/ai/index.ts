import * as vscode from "vscode";
import { weaponChatHandler, handleFollowUp } from "./participant";

interface WeaponChatResult extends vscode.ChatResult {
  metadata: {
    command: string;
  };
}

export function registerAIFeatures(context: vscode.ExtensionContext) {
  const participant = vscode.chat.createChatParticipant(
    "weapon.chat",
    weaponChatHandler
  );

  participant.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    "images",
    "icon.png"
  );

  participant.followupProvider = {
    provideFollowups(
      result: WeaponChatResult,
      _context: vscode.ChatContext,
      _token: vscode.CancellationToken
    ) {
      return handleFollowUp(result);
    },
  };

  context.subscriptions.push(participant);
}
