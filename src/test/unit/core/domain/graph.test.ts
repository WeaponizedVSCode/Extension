import * as assert from "assert";
import { longestReferencePath } from "../../../../core/domain/graph";
import type { GraphEdge } from "../../../../core/domain/graph";

suite("longestReferencePath", () => {
  test("returns empty array for empty input", () => {
    assert.deepStrictEqual(longestReferencePath([]), []);
  });

  test("returns empty array for null-ish input", () => {
    assert.deepStrictEqual(longestReferencePath(null as unknown as GraphEdge[]), []);
  });

  test("single edge returns both nodes", () => {
    const edges: GraphEdge[] = [{ source: "a", target: "b" }];
    const result = longestReferencePath(edges);
    assert.strictEqual(result.length, 2);
    assert.ok(result.includes("a"));
    assert.ok(result.includes("b"));
  });

  test("linear chain returns all nodes in order", () => {
    const edges: GraphEdge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "d" },
    ];
    const result = longestReferencePath(edges);
    assert.strictEqual(result.length, 4);
    // a should come before b, b before c, c before d
    assert.ok(result.indexOf("a") < result.indexOf("b"));
    assert.ok(result.indexOf("b") < result.indexOf("c"));
    assert.ok(result.indexOf("c") < result.indexOf("d"));
  });

  test("picks longest branch at fork", () => {
    // a -> b -> c -> d  (length 4)
    // a -> x             (length 2, shorter)
    const edges: GraphEdge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "d" },
      { source: "a", target: "x" },
    ];
    const result = longestReferencePath(edges);
    assert.ok(result.length >= 4, `Expected >=4 nodes, got ${result.length}`);
    assert.ok(result.includes("a"));
    assert.ok(result.includes("d"));
  });

  test("handles cycle (SCC) — all cycle members included", () => {
    // a -> b -> c -> a (cycle of 3)
    const edges: GraphEdge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "a" },
    ];
    const result = longestReferencePath(edges);
    assert.strictEqual(result.length, 3);
    assert.ok(result.includes("a"));
    assert.ok(result.includes("b"));
    assert.ok(result.includes("c"));
  });

  test("cycle plus tail picks longest overall", () => {
    // cycle: a -> b -> a
    // tail:  b -> c -> d
    const edges: GraphEdge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "a" },
      { source: "b", target: "c" },
      { source: "c", target: "d" },
    ];
    const result = longestReferencePath(edges);
    // Should include all 4 nodes: {a,b} SCC + c + d
    assert.strictEqual(result.length, 4);
    assert.ok(result.includes("a"));
    assert.ok(result.includes("b"));
    assert.ok(result.includes("c"));
    assert.ok(result.includes("d"));
  });

  test("disconnected components — picks longest", () => {
    // Component 1: a -> b (2 nodes)
    // Component 2: x -> y -> z (3 nodes)
    const edges: GraphEdge[] = [
      { source: "a", target: "b" },
      { source: "x", target: "y" },
      { source: "y", target: "z" },
    ];
    const result = longestReferencePath(edges);
    assert.ok(result.length >= 3);
    assert.ok(result.includes("x"));
    assert.ok(result.includes("y"));
    assert.ok(result.includes("z"));
  });
});
