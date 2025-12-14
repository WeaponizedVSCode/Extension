import * as vscode from "vscode";
import { BloodhoundDefinitionProvider } from "./blood";

export function registerDefinitionProvider(context: vscode.ExtensionContext) {
    BloodhoundDefinitionProvider.registerSelf(context);
    
}
