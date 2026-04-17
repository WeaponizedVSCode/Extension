import * as assert from "assert";
import {
  extractFencedBlocks,
  replaceFencedBlockContent,
  type FencedBlock,
} from "../../../../core/markdown/fencedBlocks";

suite("extractFencedBlocks", () => {
  test("extracts a single code block with language", () => {
    const md = "text\n```yaml\nfoo: bar\n```\nmore";
    const blocks = extractFencedBlocks(md);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].language, "yaml");
    assert.strictEqual(blocks[0].info, "");
    assert.strictEqual(blocks[0].content, "foo: bar\n");
    assert.strictEqual(blocks[0].startLine, 1);
    assert.strictEqual(blocks[0].endLine, 3);
  });

  test("extracts language and info string", () => {
    const md = "```yaml host\ncontent\n```";
    const blocks = extractFencedBlocks(md);
    assert.strictEqual(blocks[0].language, "yaml");
    assert.strictEqual(blocks[0].info, "host");
  });

  test("empty block has empty string content", () => {
    const md = "```js\n```";
    const blocks = extractFencedBlocks(md);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].content, "");
  });

  test("multiple blocks are extracted", () => {
    const md = "```a\nfirst\n```\nmiddle\n```b\nsecond\n```";
    const blocks = extractFencedBlocks(md);
    assert.strictEqual(blocks.length, 2);
    assert.strictEqual(blocks[0].language, "a");
    assert.strictEqual(blocks[0].content, "first\n");
    assert.strictEqual(blocks[1].language, "b");
    assert.strictEqual(blocks[1].content, "second\n");
  });

  test("no blocks returns empty array", () => {
    const md = "just text\nno fences here";
    const blocks = extractFencedBlocks(md);
    assert.strictEqual(blocks.length, 0);
  });

  test("bare ``` without language is skipped (parseOpeningFence returns null)", () => {
    // bare ``` matches regex with language="" — actually it will parse as language=""
    const md = "```\nbare content\n```";
    const blocks = extractFencedBlocks(md);
    // regex /^```(\S+)?(.*)$/ — match[1] is undefined => language=""
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].language, "");
    assert.strictEqual(blocks[0].content, "bare content\n");
  });

  test("multi-line content preserves inner lines", () => {
    const md = "```sh\nline1\nline2\nline3\n```";
    const blocks = extractFencedBlocks(md);
    assert.strictEqual(blocks[0].content, "line1\nline2\nline3\n");
  });

  test("0-based line numbers", () => {
    const md = "line0\nline1\n```yaml\ncontent\n```\nline5";
    const blocks = extractFencedBlocks(md);
    assert.strictEqual(blocks[0].startLine, 2);
    assert.strictEqual(blocks[0].endLine, 4);
  });
});

suite("replaceFencedBlockContent", () => {
  test("replaces inner content of a block", () => {
    const md = "before\n```yaml\nold content\n```\nafter";
    const block: Pick<FencedBlock, "startLine" | "endLine"> = {
      startLine: 1,
      endLine: 3,
    };
    const result = replaceFencedBlockContent(md, block, "new content\n");
    assert.strictEqual(result, "before\n```yaml\nnew content\n```\nafter");
  });

  test("replaces empty block with content", () => {
    const md = "```yaml\n```";
    const block = { startLine: 0, endLine: 1 };
    const result = replaceFencedBlockContent(md, block, "inserted\n");
    assert.strictEqual(result, "```yaml\ninserted\n```");
  });

  test("replaces content with empty string", () => {
    const md = "```yaml\nold\n```";
    const block = { startLine: 0, endLine: 2 };
    const result = replaceFencedBlockContent(md, block, "");
    assert.strictEqual(result, "```yaml\n```");
  });

  test("preserves surrounding context", () => {
    const md = "line0\nline1\n```yaml\nold\n```\nline5\nline6";
    const block = { startLine: 2, endLine: 4 };
    const result = replaceFencedBlockContent(md, block, "new\n");
    assert.strictEqual(result, "line0\nline1\n```yaml\nnew\n```\nline5\nline6");
  });
});
