import { callback } from "../../../shared/types";
import { parseRequest, ParseRequestResult } from "http-string-parser";
import * as vscode from "vscode";
import { logger } from "../../../platform/vscode/logger";
import fetch, { type RequestInit, type Response } from "node-fetch";
import { Agent as httpsAgent } from "https";
import { Agent as HttpAgent } from "http";

export const rawHTTPRequest: callback = async (args) => {
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
    var url = headers["Host"]
      ? `${isHTTPS ? "https" : "http"}://${headers["Host"]}${uri}`
      : uri;
    logger.debug(
      `sending request: ${method} ${url}, headers: ${JSON.stringify(
        headers
      )}, body: ${body ? body : "none"}`
    );
    let requestInit: RequestInit = {
      method,
      headers,
      redirect: 'manual',
      follow: 0, // Disable automatic following of redirects
    };
    if (method === "GET" || method === "HEAD") {
      // For GET and HEAD requests, we should not send a body
      requestInit.body = undefined;
      // requestInit.body = body; // Explicitly set body to null for clarity
    } else {
      requestInit.body = body;
    }
    if (isHTTPS) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      requestInit.agent = new httpsAgent({
        rejectUnauthorized: false, // Disable SSL verification for testing purposes
      });
    }
    let response: Response = await fetch(url, requestInit);
    let responseText: string = `HTTP/1.1 ${response.status} ${response.statusText}\n`;
    for (const [key, value] of response.headers.entries()) {
      responseText += `${key}: ${value}\n`;
    }
    responseText += "\n" + (await response.text());

    await vscode.window.showTextDocument(
      vscode.Uri.parse(
        "weaponized-editor:response.http?" + encodeURIComponent(responseText)
      ),
      {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside,
      }
    );
  } catch (e: any) {
    logger.error("raise Error fetching request", e);
    vscode.window.showErrorMessage(`Error fetching request: ${e.message}`);
    return;
  }
};
