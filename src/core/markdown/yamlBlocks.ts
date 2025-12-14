import { extractFencedBlocks, type FencedBlock } from "./fencedBlocks";

export function extractYamlBlocks(markdown: string): FencedBlock[] {
  return extractFencedBlocks(markdown).filter((b) => b.language === "yaml");
}

export function extractYamlBlocksByIdentity(
  markdown: string,
  identity: string
): FencedBlock[] {
  return extractYamlBlocks(markdown).filter((b) => b.info.includes(identity));
}

