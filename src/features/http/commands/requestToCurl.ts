import { callback } from "../../../shared/types";
import { parseRequest, ParseRequestResult } from "http-string-parser";
import * as vscode from "vscode";
import { logger } from "../../../platform/vscode/logger";
import fetchToCurl from "fetch-to-curl";

export const rawHTTPRequestToCurl: callback = async (args) => {
  let request: string | undefined = args.request ? args.request : undefined;
  if (!request) {
    vscode.window.showErrorMessage("No request provided");
    return;
  }
  let isHTTPS = args.isHTTPS ? args.isHTTPS : false;

  let res: ParseRequestResult;
  try {
    res = parseRequest(request);
    if (!res) {
      logger.error("Failed to parse request", request);
      vscode.window.showErrorMessage("Invalid request format");
      return;
    }
  } catch (e: any) {
    logger.error("raise Error parsing request", e);
    vscode.window.showErrorMessage(`Error parsing request: ${e.message}`);
    return;
  }
  try {
    const { method, uri, headers, body } = res;
    let url = headers["Host"]
      ? `${isHTTPS ? "https" : "http"}://${headers["Host"]}${uri}`
      : uri;
    let command = fetchToCurl({
      method,
      url,
      headers,
      body
    });
    await vscode.window.showTextDocument(
      vscode.Uri.parse(
        "weaponized-editor:response.http?" + encodeURIComponent(command)
      ),
      {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside,
      }
    );
    vscode.env.clipboard.writeText(command);
    vscode.window.showInformationMessage("cURL command copied to clipboard");
  } catch (e: any) {
    logger.error("raise Error fetching request", e);
    vscode.window.showErrorMessage(`Error fetching request: ${e.message}`);
    return;
  }
};
