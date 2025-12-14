import * as vscode from "vscode";
import * as os from "os";
import * as process from "process";

export async function variablesWithCommands(str: string, recursive = true) {
  // This function is similar to variables but it also resolves commands
  // It is used for cases where commands need to be executed to resolve variables
  // For example, when using ${command:someCommand}
  str = variables(str, recursive);
  if (str.match(/\${command:(.*?)}/)) {
    // async
    while (str.match(/\${command:(.*?)}/)) {
      const command = str.match(/\${command:(.*?)}/)![1];
      try {
        const result = await vscode.commands.executeCommand(command);
        str = str.replace(
          /\${command:(.*?)}/,
          result !== undefined ? result + "" : ""
        );
      } catch (error) {
        str = str.replace(/\${command:(.*?)}/, "");
      }
    }
  }

  if (
    recursive &&
    str.match(
      /\${(workspaceFolder|workspaceFolder:(.*?)|workspaceFolderBase:(.*?)|workspaceFolderBasename|fileWorkspaceFolder|relativeFile|fileBasename|fileBasenameNoExtension|fileExtname|fileDirname|cwd|pathSeparator|lineNumber|selectedText|env:(.*?)|config:(.*?)|command:(.*?)|userHome)}/
    )
  ) {
    str = await variablesWithCommands(str, recursive);
  }
  return str;
}

export function variables(str: string, recursive = true) {
  if (!((str as any) instanceof String)) {
    str = String(str);
  }
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const activeFile = vscode.window.activeTextEditor?.document;
  const absoluteFilePath = activeFile?.uri.fsPath;
  const workspace = vscode.workspace.workspaceFolders?.[0];
  const activeWorkspace = workspaceFolders?.find((workspace) =>
    absoluteFilePath?.startsWith(workspace.uri.fsPath)
  )?.uri.fsPath;
  const homeDir = os.homedir();
  // ${userHome} - /home/your-username
  str = str.replace(/\${userHome}/g, homeDir);

  // ${workspaceFolder} - /home/your-username/your-project
  str = str.replace(/\${workspaceFolder}/g, workspace?.uri.fsPath ?? "");

  // ${workspaceFolder:name} - /home/your-username/your-project2
  str = str.replace(/\${workspaceFolder:(.*?)}/g, function (_, name) {
    return (
      workspaceFolders?.find((workspace) => workspace.name === name)?.uri
        .fsPath ?? ""
    );
  });

  // ${workspaceFolderBasename} - your-project
  str = str.replace(/\${workspaceFolderBasename}/g, workspace?.name ?? "");

  // ${workspaceFolderBasename:name} - your-project2
  str = str.replace(/\${workspaceFolderBasename:(.*?)}/g, function (_, name) {
    return (
      workspaceFolders?.find((workspace) => workspace.name === name)?.name ?? ""
    );
  });

  // ${file} - /home/your-username/your-project/folder/file.ext
  str = str.replace(/\${file}/g, absoluteFilePath ?? "");

  // ${fileWorkspaceFolder} - /home/your-username/your-project
  str = str.replace(/\${fileWorkspaceFolder}/g, activeWorkspace ?? "");

  // ${relativeFile} - folder/file.ext
  str = str.replace(
    /\${relativeFile}/g,
    absoluteFilePath?.substring(activeWorkspace?.length ?? 0) ?? ""
  );

  // ${relativeFileDirname} - folder
  str = str.replace(
    /\${relativeFileDirname}/g,
    absoluteFilePath?.substring(
      activeWorkspace?.length ?? 0,
      absoluteFilePath?.lastIndexOf(os.platform() === "win32" ? "\\" : "/")
    ) ?? ""
  );

  // ${fileBasename} - file.ext
  str = str.replace(
    /\${fileBasename}/g,
    absoluteFilePath?.split("/")?.pop() ?? ""
  );

  // ${fileBasenameNoExtension} - file
  str = str.replace(
    /\${fileBasenameNoExtension}/g,
    absoluteFilePath?.split("/").pop()?.split(".")?.shift() ?? ""
  );
  // ${fileDirname} - /home/your-username/your-project/folder
  str = str.replace(
    /\${fileDirname}/g,
    absoluteFilePath?.split("/")?.slice(0, -1)?.join("/") ?? ""
  );

  // ${fileExtname} - .ext
  str = str.replace(
    /\${fileExtname}/g,
    absoluteFilePath?.split(".")?.pop() ?? ""
  );

  // ${lineNumber} - line number of the cursor
  str = str.replace(
    /\${lineNumber}/g,
    (vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.selection.start.line + 1
      : 0
    ).toString()
  );

  // ${selectedText} - text selected in your code editor
  str = str.replace(/\${selectedText}/g, function () {
    return (
      vscode.window.activeTextEditor?.document.getText(
        new vscode.Range(
          vscode.window.activeTextEditor.selection.start,
          vscode.window.activeTextEditor.selection.end
        )
      ) ?? ""
    );
  });

  // ${cwd} - current working directory
  str = str.replace(
    /\${cwd}/g,
    absoluteFilePath?.split("/")?.slice(0, -1)?.join("/") ?? ""
  );

  // ${execPath} - location of Code.exe
  str = str.replace(/\${execPath}/g, process.execPath);

  // ${pathSeparator} - / on macOS or linux, \ on Windows
  str = str.replace(
    /\${pathSeparator}/g,
    os.platform() === "win32" ? "\\" : "/"
  );

  // ${/} - short for ${pathSeparator}
  str = str.replace(/\${\/}/g, os.platform() === "win32" ? "\\" : "/");

  // ${env:VARIABLE} - environment variable
  str = str.replace(/\${env:(.*?)}/g, function (variable, _) {
    return process.env[_] || "";
  });

  // ${config:VARIABLE} - configuration variable
  str = str.replace(/\${config:(.*?)}/g, function (variable, _) {
    return vscode.workspace.getConfiguration().get<string>(_, "");
  });

  // still contains ${...}, resolve recursively
  if (
    recursive &&
    str.match(
      /\${(workspaceFolder|workspaceFolder:(.*?)|workspaceFolderBase:(.*?)|workspaceFolderBasename|fileWorkspaceFolder|relativeFile|fileBasename|fileBasenameNoExtension|fileExtname|fileDirname|cwd|pathSeparator|lineNumber|selectedText|env:(.*?)|config:(.*?)|command:(.*?)|userHome)}/
    )
  ) {
    str = variables(str, recursive);
  }
  return str;
}
