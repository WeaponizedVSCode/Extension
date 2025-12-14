import { MarkdownHTTPCodeLensProvider } from "./base";
import { httpRepeaterCodeLens } from "./send";
import { httpToCurlCodeLens } from "./curl";

export const httpRepeater = new MarkdownHTTPCodeLensProvider(
  httpRepeaterCodeLens
);
export const httpToCurl = new MarkdownHTTPCodeLensProvider(httpToCurlCodeLens);

