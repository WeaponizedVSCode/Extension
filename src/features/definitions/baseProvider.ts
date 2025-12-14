import * as vscode from "vscode";
import { logger } from "../../platform/vscode/logger";
export interface BigDefinition {
  description: string;
  extra?: string[];
}

export type definitionSearcher = (params: {
  document: vscode.TextDocument;
  position: vscode.Position;
}) => BigDefinition | undefined;

export class BaseDefinitionProvider
  implements vscode.DefinitionProvider, vscode.HoverProvider
{
  private findSnippetDescription: definitionSearcher;
  constructor(findSnippetDescription: definitionSearcher) {
    this.findSnippetDescription = findSnippetDescription;
  }

  public static getWord(
    document: vscode.TextDocument,
    position: vscode.Position
  ): string | undefined {
    const range = document.getWordRangeAtPosition(position);
    if (range) {
      return document.getText(range);
    }
    return undefined;
  }

  // definition return a markdown file uri with content from description
  // if description has extra_markdown_wiki, use it as content instead of description
  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]> {
    const description = this.findSnippetDescription({ document, position });
    if (description) {
      let markdownString = description.description;
      if (description.extra) {
        markdownString = description.extra.join("\n");
      }
      const uri = vscode.Uri.parse(
        `weaponized-editor:${BaseDefinitionProvider.getWord(
          document,
          position
        )}.md?${encodeURIComponent(markdownString)}`
      );
      return new vscode.Location(uri, new vscode.Position(0, 0));
    }
    return null;
  }
  // hover only return description
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const description = this.findSnippetDescription({ document, position });
    if (description) {
      return new vscode.Hover(description.description);
    }
  }

  public registerSelf(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(
        { scheme: "file", language: "markdown" },
        this
      ),
      vscode.languages.registerHoverProvider(
        { scheme: "file", language: "markdown" },
        this
      )
    );
  }
}
