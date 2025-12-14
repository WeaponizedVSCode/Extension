import * as vscode from "vscode";
import { ConfigType } from "../../../../core";
import { logger } from "../../../../platform/vscode/logger";


export type MarkdownCodeLensGenerator = (type: ConfigType, config: string, startLine: number, document: vscode.TextDocument) => vscode.CodeLens[];

export class MarkdownCodeLensProvider implements vscode.CodeLensProvider {
  private generators: MarkdownCodeLensGenerator[];
  constructor(
    ...generators: MarkdownCodeLensGenerator[]
  ) {
    this.generators = generators;
  }

  provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    const lines = document.getText().split("\n");

    let inYaml = false;
    let configType: ConfigType | undefined = undefined;
    let currentYaml = "";
    let yamlStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (inYaml && configType) {
        if (line === "```") {
          for (const generator of this.generators) {
            try {
              codeLenses.push(...generator(configType, currentYaml, yamlStartLine, document));
            } catch (error) {
              logger.error("Error generating code lenses: ", error);
            }
          }
          inYaml = false;
          configType = undefined;
          currentYaml = "";
        } else {
          currentYaml += line + "\n";
        }
      } else if (line.startsWith("```yaml")) {
        inYaml = true;
        if (line.includes("credentials")) {
          configType = "user";
        } else if (line.includes("host")) {
          configType = "host";
        } else {
          configType = undefined; // Unknown type, skip
        }
        yamlStartLine = i;
      }
    }

    return codeLenses;
  }
}
