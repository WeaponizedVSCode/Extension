import { MarkdownCodeLensProvider } from "./base";
import {
  GenerateDumpUserCredCodeLens,
  GenerateEnvExportCodeLens,
  GenerateSetAsCurrentCodeLens,
} from "./dumpProvider";
import { GenerateScanTaskCodeLens } from "./scanTaskProvider";

export const markdownCodelens = new MarkdownCodeLensProvider(
  GenerateEnvExportCodeLens,
  GenerateDumpUserCredCodeLens,
  GenerateScanTaskCodeLens,
  GenerateSetAsCurrentCodeLens
);
