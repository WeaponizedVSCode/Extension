export type FencedBlock = {
  language: string;
  info: string;
  startLine: number; // opening fence line (0-based)
  endLine: number; // closing fence line (0-based)
  content: string; // inner text, with trailing newline if non-empty
};

function parseOpeningFence(line: string): { language: string; info: string } | null {
  const match = line.match(/^```(\S+)?(.*)$/);
  if (!match) {
    return null;
  }
  const language = (match[1] ?? "").trim();
  const info = (match[2] ?? "").trim();
  return { language, info };
}

export function extractFencedBlocks(markdown: string): FencedBlock[] {
  const lines = markdown.split("\n");

  const blocks: FencedBlock[] = [];
  let inBlock = false;
  let blockLanguage = "";
  let blockInfo = "";
  let blockStartLine = 0;
  let blockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inBlock) {
      if (line.startsWith("```")) {
        blocks.push({
          language: blockLanguage,
          info: blockInfo,
          startLine: blockStartLine,
          endLine: i,
          content: blockLines.length ? `${blockLines.join("\n")}\n` : "",
        });
        inBlock = false;
        blockLanguage = "";
        blockInfo = "";
        blockLines = [];
        continue;
      }
      blockLines.push(line);
      continue;
    }

    if (line.startsWith("```")) {
      const parsed = parseOpeningFence(line);
      if (!parsed) {
        continue;
      }
      inBlock = true;
      blockLanguage = parsed.language;
      blockInfo = parsed.info;
      blockStartLine = i;
      blockLines = [];
    }
  }

  return blocks;
}

export function replaceFencedBlockContent(
  markdown: string,
  block: Pick<FencedBlock, "startLine" | "endLine">,
  newContent: string
): string {
  const lines = markdown.split("\n");
  const start = block.startLine + 1;
  const end = block.endLine;

  const normalized = newContent.endsWith("\n") ? newContent.slice(0, -1) : newContent;
  const replacementLines = normalized.length ? normalized.split("\n") : [];

  return [
    ...lines.slice(0, start),
    ...replacementLines,
    ...lines.slice(end),
  ].join("\n");
}
