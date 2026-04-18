import * as assert from "assert";
import {
  extractYamlBlocks,
  extractYamlBlocksByIdentity,
} from "../../../../core/markdown/yamlBlocks";

suite("extractYamlBlocks", () => {
  test("returns only yaml blocks", () => {
    const md = "```yaml\nfoo: 1\n```\n```js\nvar x;\n```\n```yaml\nbar: 2\n```";
    const blocks = extractYamlBlocks(md);
    assert.strictEqual(blocks.length, 2);
    assert.strictEqual(blocks[0].content, "foo: 1\n");
    assert.strictEqual(blocks[1].content, "bar: 2\n");
  });

  test("returns empty array when no yaml blocks", () => {
    const md = "```js\nvar x;\n```";
    const blocks = extractYamlBlocks(md);
    assert.strictEqual(blocks.length, 0);
  });

  test("returns empty array for plain text", () => {
    const blocks = extractYamlBlocks("no code here");
    assert.strictEqual(blocks.length, 0);
  });
});

suite("extractYamlBlocksByIdentity", () => {
  test("filters by identity in info string", () => {
    const md =
      "```yaml host\n- hostname: a\n```\n```yaml credentials\n- user: b\n```\n```yaml host\n- hostname: c\n```";
    const hosts = extractYamlBlocksByIdentity(md, "host");
    assert.strictEqual(hosts.length, 2);
    assert.strictEqual(hosts[0].content, "- hostname: a\n");
    assert.strictEqual(hosts[1].content, "- hostname: c\n");

    const creds = extractYamlBlocksByIdentity(md, "credentials");
    assert.strictEqual(creds.length, 1);
    assert.strictEqual(creds[0].content, "- user: b\n");
  });

  test("returns empty when identity not found", () => {
    const md = "```yaml host\ndata\n```";
    const blocks = extractYamlBlocksByIdentity(md, "credentials");
    assert.strictEqual(blocks.length, 0);
  });

  test("identity match is substring-based (includes)", () => {
    const md = "```yaml host-primary\ndata\n```";
    const blocks = extractYamlBlocksByIdentity(md, "host");
    assert.strictEqual(blocks.length, 1);
  });
});
