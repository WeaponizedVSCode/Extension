import * as assert from "assert";
import { envVarSafer, mergeCollects, type Collects } from "../../../../core/env/collects";

suite("envVarSafer", () => {
  test("passes through alphanumeric and underscores", () => {
    assert.strictEqual(envVarSafer("FOO_BAR_123"), "FOO_BAR_123");
  });

  test("replaces dots with underscores", () => {
    assert.strictEqual(envVarSafer("dc01.corp.local"), "dc01_corp_local");
  });

  test("replaces hyphens with underscores", () => {
    assert.strictEqual(envVarSafer("my-host-name"), "my_host_name");
  });

  test("replaces spaces with underscores", () => {
    assert.strictEqual(envVarSafer("has space"), "has_space");
  });

  test("replaces multiple special chars", () => {
    assert.strictEqual(envVarSafer("a@b#c$d"), "a_b_c_d");
  });

  test("handles empty string", () => {
    assert.strictEqual(envVarSafer(""), "");
  });
});

suite("mergeCollects", () => {
  test("merges two non-overlapping objects", () => {
    const a: Collects = { A: "1" };
    const b: Collects = { B: "2" };
    const result = mergeCollects(a, b);
    assert.deepStrictEqual(result, { A: "1", B: "2" });
  });

  test("first-write-wins on key conflicts", () => {
    const a: Collects = { KEY: "first" };
    const b: Collects = { KEY: "second" };
    const result = mergeCollects(a, b);
    assert.strictEqual(result["KEY"], "first");
  });

  test("merges three objects with first-write-wins", () => {
    const a: Collects = { X: "a" };
    const b: Collects = { X: "b", Y: "b" };
    const c: Collects = { Y: "c", Z: "c" };
    const result = mergeCollects(a, b, c);
    assert.deepStrictEqual(result, { X: "a", Y: "b", Z: "c" });
  });

  test("returns empty object for no arguments", () => {
    const result = mergeCollects();
    assert.deepStrictEqual(result, {});
  });

  test("returns copy of single argument", () => {
    const a: Collects = { A: "1" };
    const result = mergeCollects(a);
    assert.deepStrictEqual(result, { A: "1" });
    // should be a new object
    assert.notStrictEqual(result, a);
  });
});
