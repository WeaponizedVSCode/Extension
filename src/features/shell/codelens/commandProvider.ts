import vscode = require('vscode');

export class CommandCodeLensProvider implements vscode.CodeLensProvider {
    onDidChangeCodeLenses?: vscode.Event<void>;

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        var codeLenses = [];
        const lines = document.getText().split('\n');

        var inCommand = false;
        var currentCommand = '';
        var commandStartLine = 0;
        for (var i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (inCommand) {
                if (line === '```') {
                    const cmd: vscode.Command = {
                        title: 'Run command in terminal',
                        command: 'weapon.run_command',
                        arguments: [{ command: currentCommand }]
                    };
                    const copy: vscode.Command = {
                        title: "Copy commands",
                        command: 'weapon.copy',
                        arguments: [{ command: currentCommand }]
                    };
                    codeLenses.push(
                        new vscode.CodeLens(new vscode.Range(new vscode.Position(commandStartLine, 0), new vscode.Position(commandStartLine + 1, 0)), cmd),
                        new vscode.CodeLens(new vscode.Range(new vscode.Position(commandStartLine, 0), new vscode.Position(commandStartLine + 1, 0)), copy)
                    );
                    inCommand = false;
                    currentCommand = '';
                    continue;
                }

                currentCommand += line + '\n';
                continue;
            }

            if (line.startsWith('```zsh') || line.startsWith('```bash') || line.startsWith('```sh') || line.startsWith('```powershell')) {
                inCommand = true;
                commandStartLine = i;
                continue;
            }
        }
        return codeLenses;
    }

    resolveCodeLens?(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        return null;
    }
}
