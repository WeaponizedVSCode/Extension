import * as vscode from "vscode";
import { logger } from "../../../platform/vscode/logger";

export type MarkdownHTTPCodeLensGenerator = (
  post: string[],
  startLine: number,
  document: vscode.TextDocument
) => vscode.CodeLens[];

export class MarkdownHTTPCodeLensProvider implements vscode.CodeLensProvider {
  private generators: MarkdownHTTPCodeLensGenerator[];
  constructor(...generators: MarkdownHTTPCodeLensGenerator[]) {
    this.generators = generators;
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    const lines = document.getText().split("\n");

    let inYaml = false;
    let currentPost = [];
    let yamlStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (inYaml) {
        if (line === "```") {
          for (const generator of this.generators) {
            try {
              codeLenses.push(
                ...generator(currentPost, yamlStartLine, document)
              );
            } catch (error) {
              logger.error("Error generating code lenses: ", error);
            }
          }
          inYaml = false;
          currentPost = [];
        } else {
          currentPost.push(line);
        }
      } else if (line.startsWith("```http")) {
        inYaml = true;
        yamlStartLine = i;
      }
    }

    return codeLenses;
  }
}
