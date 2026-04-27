# Finding Association & Engagement Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable AI (via MCP) to understand what was found, where it was found, and how findings chain together — by deriving associations from Foam's existing wiki-link graph and exposing a single `get_engagement_summary` MCP tool.

**Architecture:** Leverage Foam's wiki-link graph (`getAllConnections()`) to classify finding-related edges. Build a pure `EngagementSummary` type that walks `findingEdges` to compute per-finding associations (which hosts/users/services/findings link to it), groups findings by host and user, and exposes everything through one MCP tool call. Zero changes to the `Finding` interface or frontmatter — associations are a graph property, not a document property.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `zod`, existing Foam API, existing test framework (`mocha` + `assert`)

---

## How associations work (no Finding changes needed)

Users create wiki-links in their notes naturally:

```markdown
<!-- In hosts/dc01/dc01.md -->
#### vulnerabilities / exploits
Found [[sqli-login]] on the web interface.
Leveraged [[smb-signing-disabled]] for relay attack.

<!-- In users/administrator/administrator.md -->
Got password via [[kerberoast-svc_sql]].

<!-- In findings/kerberoast-svc_sql/kerberoast-svc_sql.md -->
Used this to perform [[dcsync-attack]].
```

Foam's `graph.getAllConnections()` already tracks all these links. The `graphBuilder` classifies each node by `type` from frontmatter (`host`, `user`, `service`, `finding`). We just need to:

1. Add a `findingEdges` bucket for edges touching a `finding`-type node
2. Walk those edges to derive "finding X is associated with host Y, user Z, and chains to finding W"

**Finding ↔ Finding links** (attack chains) fall out naturally — no special modeling.

---

## File Structure

### New files
| Path | Responsibility |
|------|---------------|
| `src/core/domain/engagement.ts` | `EngagementSummary` type + `buildEngagementSummary()` pure function |
| `src/test/unit/core/domain/engagement.test.ts` | Tests for engagement summary builder |

### Modified files
| Path | What changes |
|------|-------------|
| `src/core/domain/graph.ts` | Add `findingEdges` to `RelationshipGraph` |
| `src/core/domain/index.ts` | Re-export new types |
| `src/features/targets/sync/graphBuilder.ts` | Classify finding edges |
| `src/features/mcp/httpServer.ts` | Add `get_engagement_summary` tool, `engagement://summary` resource, `analyze-engagement` prompt |
| `src/test/unit/core/domain/graph.test.ts` | Test for `findingEdges` |

---

## Task 1: Add `findingEdges` to RelationshipGraph and graphBuilder

**Files:**
- Modify: `src/core/domain/graph.ts:12-19`
- Modify: `src/features/targets/sync/graphBuilder.ts`
- Test: `src/test/unit/core/domain/graph.test.ts`

- [ ] **Step 1: Write failing test for findingEdges**

In `src/test/unit/core/domain/graph.test.ts`, add the import for `RelationshipGraph` at the top (alongside existing `longestReferencePath` import):

```typescript
import { longestReferencePath, RelationshipGraph } from "../../../../core/domain/graph";
```

Then add a new suite at the end of the file:

```typescript
suite("RelationshipGraph findingEdges", () => {
  test("findingEdges field exists and is an array", () => {
    const graph: RelationshipGraph = {
      nodes: [],
      edges: [],
      hostEdges: [],
      userEdges: [],
      findingEdges: [],
      attackPath: [],
      mermaid: "",
    };
    assert.ok(Array.isArray(graph.findingEdges));
    assert.strictEqual(graph.findingEdges.length, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx mocha --require ts-node/register src/test/unit/core/domain/graph.test.ts --timeout 5000`

Expected: FAIL — `findingEdges` does not exist on type `RelationshipGraph`

- [ ] **Step 3: Add findingEdges to RelationshipGraph interface**

In `src/core/domain/graph.ts`, replace the `RelationshipGraph` interface (lines 12-19):

```typescript
export interface RelationshipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];       // all connections
  hostEdges: GraphEdge[];   // at least one endpoint is type "host"
  userEdges: GraphEdge[];   // at least one endpoint is type "user"
  findingEdges: GraphEdge[]; // at least one endpoint is type "finding"
  attackPath: string[];     // ordered node IDs — privilege escalation chain
  mermaid: string;          // pre-rendered Mermaid diagram
}
```

- [ ] **Step 4: Update graphBuilder to populate findingEdges**

Replace the full content of `src/features/targets/sync/graphBuilder.ts`:

```typescript
import type { Foam, Resource, URI, RelationshipGraph, GraphNode, GraphEdge } from "../../../core";
import { longestReferencePath } from "../../../core";

export function buildRelationshipGraph(foam: Foam): RelationshipGraph {
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const hostEdges: GraphEdge[] = [];
  const userEdges: GraphEdge[] = [];
  const findingEdges: GraphEdge[] = [];

  const getId = (uri: URI) => foam.workspace.getIdentifier(uri) || uri.path;

  foam.workspace.list().forEach((r: Resource) => {
    const type = r.type === "note" ? ((r.properties.type as string) ?? "note") : r.type;
    if (type === "report") {
      return;
    }
    const title = r.type === "note" ? r.title : r.uri.getBasename();
    nodeMap.set(r.uri.path, { id: getId(r.uri), type, title });
  });

  foam.graph.getAllConnections().forEach((c) => {
    const sourceNode = nodeMap.get(c.source.path);
    const targetNode = nodeMap.get(c.target.path);
    if (!sourceNode || !targetNode) {
      return;
    }
    const edge: GraphEdge = { source: sourceNode.id, target: targetNode.id };
    edges.push(edge);
    if (targetNode.type === "user" || sourceNode.type === "user") {
      userEdges.push(edge);
    }
    if (targetNode.type === "host" || sourceNode.type === "host") {
      hostEdges.push(edge);
    }
    if (targetNode.type === "finding" || sourceNode.type === "finding") {
      findingEdges.push(edge);
    }
  });

  const attackPath = longestReferencePath(userEdges);

  let mermaid = "graph TD;\n";
  for (const e of userEdges) {
    mermaid += `  ${e.source} ---> ${e.target}\n`;
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    hostEdges,
    userEdges,
    findingEdges,
    attackPath,
    mermaid,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npx mocha --require ts-node/register src/test/unit/core/domain/graph.test.ts --timeout 5000`

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/domain/graph.ts src/features/targets/sync/graphBuilder.ts src/test/unit/core/domain/graph.test.ts
git commit -m "feat(graph): add findingEdges to RelationshipGraph

Edges where at least one endpoint is type 'finding' are now classified
into findingEdges, enabling downstream code to derive which hosts,
users, and other findings each finding is connected to via wiki-links."
```

---

## Task 2: Create EngagementSummary type and builder

**Files:**
- Create: `src/core/domain/engagement.ts`
- Create: `src/test/unit/core/domain/engagement.test.ts`
- Modify: `src/core/domain/index.ts`

- [ ] **Step 1: Write failing tests**

Create `src/test/unit/core/domain/engagement.test.ts`:

```typescript
import * as assert from "assert";
import { buildEngagementSummary } from "../../../../core/domain/engagement";
import type { Finding } from "../../../../core/domain/finding";
import type { RelationshipGraph, GraphNode, GraphEdge } from "../../../../core/domain/graph";

function makeFinding(id: string, title?: string): Finding {
  return {
    id,
    title: title ?? id,
    severity: "info",
    tags: [],
    description: "",
    references: "",
    props: {},
  };
}

function makeGraph(
  nodes: GraphNode[],
  findingEdges: GraphEdge[],
): RelationshipGraph {
  return {
    nodes,
    edges: findingEdges,
    hostEdges: [],
    userEdges: [],
    findingEdges,
    attackPath: [],
    mermaid: "",
  };
}

suite("buildEngagementSummary", () => {
  test("returns empty summary when everything is empty", () => {
    const summary = buildEngagementSummary({
      hosts: [],
      users: [],
      findings: [],
      graph: null,
    });
    assert.strictEqual(summary.stats.totalHosts, 0);
    assert.strictEqual(summary.stats.totalCredentials, 0);
    assert.strictEqual(summary.stats.totalFindings, 0);
    assert.strictEqual(summary.stats.criticalFindings, 0);
    assert.strictEqual(summary.currentTarget, null);
    assert.strictEqual(summary.currentUser, null);
    assert.strictEqual(summary.graph, null);
    assert.strictEqual(summary.findingAssociations.length, 0);
  });

  test("computes severity stats", () => {
    const findings = [
      { ...makeFinding("f1"), severity: "critical" },
      { ...makeFinding("f2"), severity: "high" },
      { ...makeFinding("f3"), severity: "high" },
      { ...makeFinding("f4"), severity: "medium" },
      { ...makeFinding("f5"), severity: "low" },
      { ...makeFinding("f6"), severity: "info" },
    ];
    const summary = buildEngagementSummary({
      hosts: [],
      users: [],
      findings,
      graph: null,
    });
    assert.strictEqual(summary.stats.totalFindings, 6);
    assert.strictEqual(summary.stats.criticalFindings, 1);
    assert.strictEqual(summary.stats.highFindings, 2);
    assert.strictEqual(summary.stats.mediumFindings, 1);
    assert.strictEqual(summary.stats.lowFindings, 1);
    assert.strictEqual(summary.stats.infoFindings, 1);
  });

  test("identifies current target and user", () => {
    const hosts = [
      { hostname: "dc01", ip: "10.10.10.1", alias: [], is_dc: true, is_current: true, is_current_dc: true, props: {} },
      { hostname: "web01", ip: "10.10.10.2", alias: [], is_dc: false, is_current: false, is_current_dc: false, props: {} },
    ];
    const users = [
      { user: "admin", password: "pass", nt_hash: "", login: "corp", is_current: true, props: {} },
    ];
    const summary = buildEngagementSummary({
      hosts: hosts as any,
      users: users as any,
      findings: [],
      graph: null,
    });
    assert.strictEqual(summary.stats.totalHosts, 2);
    assert.strictEqual(summary.stats.totalCredentials, 1);
    assert.strictEqual(summary.currentTarget?.hostname, "dc01");
    assert.strictEqual(summary.currentUser?.user, "admin");
  });

  test("derives finding associations from graph findingEdges", () => {
    const findings = [makeFinding("sqli-login"), makeFinding("smb-signing")];
    const nodes: GraphNode[] = [
      { id: "dc01", type: "host", title: "dc01" },
      { id: "admin", type: "user", title: "administrator" },
      { id: "sqli-login", type: "finding", title: "SQL Injection" },
      { id: "smb-signing", type: "finding", title: "SMB Signing Disabled" },
    ];
    const findingEdges: GraphEdge[] = [
      { source: "dc01", target: "sqli-login" },       // host → finding
      { source: "admin", target: "sqli-login" },       // user → finding
      { source: "dc01", target: "smb-signing" },       // host → finding
    ];
    const graph = makeGraph(nodes, findingEdges);
    const summary = buildEngagementSummary({
      hosts: [],
      users: [],
      findings,
      graph,
    });

    assert.strictEqual(summary.findingAssociations.length, 2);

    const sqli = summary.findingAssociations.find((a) => a.finding.id === "sqli-login");
    assert.ok(sqli);
    assert.deepStrictEqual(sqli.hosts, ["dc01"]);
    assert.deepStrictEqual(sqli.users, ["admin"]);
    assert.deepStrictEqual(sqli.services, []);
    assert.deepStrictEqual(sqli.findings, []);

    const smb = summary.findingAssociations.find((a) => a.finding.id === "smb-signing");
    assert.ok(smb);
    assert.deepStrictEqual(smb.hosts, ["dc01"]);
    assert.deepStrictEqual(smb.users, []);
  });

  test("derives finding-to-finding chains", () => {
    const findings = [makeFinding("kerberoast"), makeFinding("dcsync")];
    const nodes: GraphNode[] = [
      { id: "kerberoast", type: "finding", title: "Kerberoast" },
      { id: "dcsync", type: "finding", title: "DCSync" },
      { id: "svc_sql", type: "user", title: "svc_sql" },
    ];
    const findingEdges: GraphEdge[] = [
      { source: "svc_sql", target: "kerberoast" },      // user → finding
      { source: "kerberoast", target: "dcsync" },        // finding → finding (chain!)
    ];
    const graph = makeGraph(nodes, findingEdges);
    const summary = buildEngagementSummary({
      hosts: [],
      users: [],
      findings,
      graph,
    });

    const kerb = summary.findingAssociations.find((a) => a.finding.id === "kerberoast");
    assert.ok(kerb);
    assert.deepStrictEqual(kerb.users, ["svc_sql"]);
    assert.deepStrictEqual(kerb.findings, ["dcsync"]);

    const dc = summary.findingAssociations.find((a) => a.finding.id === "dcsync");
    assert.ok(dc);
    assert.deepStrictEqual(dc.findings, ["kerberoast"]);
  });

  test("hostBreakdown groups findings by associated host", () => {
    const findings = [makeFinding("f1"), makeFinding("f2"), makeFinding("f3")];
    const nodes: GraphNode[] = [
      { id: "dc01", type: "host", title: "dc01" },
      { id: "web01", type: "host", title: "web01" },
      { id: "f1", type: "finding", title: "f1" },
      { id: "f2", type: "finding", title: "f2" },
      { id: "f3", type: "finding", title: "f3" },
    ];
    const findingEdges: GraphEdge[] = [
      { source: "dc01", target: "f1" },
      { source: "dc01", target: "f2" },
      { source: "web01", target: "f3" },
    ];
    const graph = makeGraph(nodes, findingEdges);
    const summary = buildEngagementSummary({
      hosts: [],
      users: [],
      findings,
      graph,
    });

    assert.strictEqual(Object.keys(summary.hostBreakdown).length, 2);
    assert.strictEqual(summary.hostBreakdown["dc01"].length, 2);
    assert.strictEqual(summary.hostBreakdown["web01"].length, 1);
  });

  test("userBreakdown groups findings by associated user", () => {
    const findings = [makeFinding("f1"), makeFinding("f2")];
    const nodes: GraphNode[] = [
      { id: "admin", type: "user", title: "admin" },
      { id: "f1", type: "finding", title: "f1" },
      { id: "f2", type: "finding", title: "f2" },
    ];
    const findingEdges: GraphEdge[] = [
      { source: "admin", target: "f1" },
      { source: "admin", target: "f2" },
    ];
    const graph = makeGraph(nodes, findingEdges);
    const summary = buildEngagementSummary({
      hosts: [],
      users: [],
      findings,
      graph,
    });

    assert.strictEqual(Object.keys(summary.userBreakdown).length, 1);
    assert.strictEqual(summary.userBreakdown["admin"].length, 2);
  });

  test("unassociatedFindings lists findings with no graph edges", () => {
    const findings = [makeFinding("f1"), makeFinding("orphan")];
    const nodes: GraphNode[] = [
      { id: "dc01", type: "host", title: "dc01" },
      { id: "f1", type: "finding", title: "f1" },
      // "orphan" has no edges
    ];
    const findingEdges: GraphEdge[] = [
      { source: "dc01", target: "f1" },
    ];
    const graph = makeGraph(nodes, findingEdges);
    const summary = buildEngagementSummary({
      hosts: [],
      users: [],
      findings,
      graph,
    });

    assert.strictEqual(summary.unassociatedFindings.length, 1);
    assert.strictEqual(summary.unassociatedFindings[0].id, "orphan");
  });

  test("no graph means all findings are unassociated", () => {
    const findings = [makeFinding("f1"), makeFinding("f2")];
    const summary = buildEngagementSummary({
      hosts: [],
      users: [],
      findings,
      graph: null,
    });
    assert.strictEqual(summary.unassociatedFindings.length, 2);
    assert.strictEqual(summary.findingAssociations.length, 2);
    assert.deepStrictEqual(summary.findingAssociations[0].hosts, []);
    assert.strictEqual(Object.keys(summary.hostBreakdown).length, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx mocha --require ts-node/register src/test/unit/core/domain/engagement.test.ts --timeout 5000`

Expected: FAIL — module `engagement` does not exist

- [ ] **Step 3: Implement EngagementSummary type and builder**

Create `src/core/domain/engagement.ts`:

```typescript
import type { Host } from "./host";
import type { UserCredential } from "./user";
import type { Finding } from "./finding";
import type { RelationshipGraph, GraphNode } from "./graph";

export interface EngagementStats {
  totalHosts: number;
  totalCredentials: number;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  infoFindings: number;
}

/** A finding enriched with its graph-derived associations */
export interface FindingAssociation {
  finding: Finding;
  /** Host IDs linked to this finding via wiki-links */
  hosts: string[];
  /** User IDs linked to this finding via wiki-links */
  users: string[];
  /** Service IDs linked to this finding via wiki-links */
  services: string[];
  /** Other finding IDs linked to this finding (attack chains) */
  findings: string[];
}

export interface EngagementSummary {
  stats: EngagementStats;
  currentTarget: Host | null;
  currentUser: UserCredential | null;
  hosts: Host[];
  users: UserCredential[];
  findings: Finding[];
  /** Every finding with its graph-derived associations */
  findingAssociations: FindingAssociation[];
  /** Findings grouped by associated host ID */
  hostBreakdown: Record<string, Finding[]>;
  /** Findings grouped by associated user ID */
  userBreakdown: Record<string, Finding[]>;
  /** Findings with no wiki-link associations */
  unassociatedFindings: Finding[];
  graph: RelationshipGraph | null;
}

export interface EngagementSummaryInput {
  hosts: Host[];
  users: UserCredential[];
  findings: Finding[];
  graph: RelationshipGraph | null;
}

export function buildEngagementSummary(input: EngagementSummaryInput): EngagementSummary {
  const { hosts, users, findings, graph } = input;

  const currentTarget = hosts.find((h) => h.is_current) ?? null;
  const currentUser = users.find((u) => u.is_current) ?? null;

  // Severity counts
  const sev = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    const s = f.severity as keyof typeof sev;
    if (s in sev) {
      sev[s]++;
    }
  }

  // Build node type lookup from graph
  const nodeType = new Map<string, string>();
  if (graph) {
    for (const n of graph.nodes) {
      nodeType.set(n.id, n.type);
    }
  }

  // Derive per-finding associations from findingEdges
  const findingAssociations: FindingAssociation[] = [];
  const hostBreakdown: Record<string, Finding[]> = {};
  const userBreakdown: Record<string, Finding[]> = {};
  const associatedIds = new Set<string>();

  for (const f of findings) {
    const assoc: FindingAssociation = {
      finding: f,
      hosts: [],
      users: [],
      services: [],
      findings: [],
    };

    if (graph) {
      for (const edge of graph.findingEdges) {
        // Find edges where this finding is one endpoint
        let other: string | null = null;
        if (edge.source === f.id) {
          other = edge.target;
        } else if (edge.target === f.id) {
          other = edge.source;
        }
        if (!other) {
          continue;
        }

        const type = nodeType.get(other) ?? "note";
        switch (type) {
          case "host":
            if (!assoc.hosts.includes(other)) {
              assoc.hosts.push(other);
            }
            break;
          case "user":
            if (!assoc.users.includes(other)) {
              assoc.users.push(other);
            }
            break;
          case "service":
            if (!assoc.services.includes(other)) {
              assoc.services.push(other);
            }
            break;
          case "finding":
            if (!assoc.findings.includes(other)) {
              assoc.findings.push(other);
            }
            break;
        }
      }
    }

    const hasAssociation = assoc.hosts.length > 0 || assoc.users.length > 0
      || assoc.services.length > 0 || assoc.findings.length > 0;
    if (hasAssociation) {
      associatedIds.add(f.id);
    }

    // Populate breakdowns
    for (const h of assoc.hosts) {
      if (!hostBreakdown[h]) {
        hostBreakdown[h] = [];
      }
      hostBreakdown[h].push(f);
    }
    for (const u of assoc.users) {
      if (!userBreakdown[u]) {
        userBreakdown[u] = [];
      }
      userBreakdown[u].push(f);
    }

    findingAssociations.push(assoc);
  }

  const unassociatedFindings = findings.filter((f) => !associatedIds.has(f.id));

  const stats: EngagementStats = {
    totalHosts: hosts.length,
    totalCredentials: users.length,
    totalFindings: findings.length,
    criticalFindings: sev.critical,
    highFindings: sev.high,
    mediumFindings: sev.medium,
    lowFindings: sev.low,
    infoFindings: sev.info,
  };

  return {
    stats,
    currentTarget,
    currentUser,
    hosts,
    users,
    findings,
    findingAssociations,
    hostBreakdown,
    userBreakdown,
    unassociatedFindings,
    graph,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx mocha --require ts-node/register src/test/unit/core/domain/engagement.test.ts --timeout 5000`

Expected: ALL PASS

- [ ] **Step 5: Export from domain index**

In `src/core/domain/index.ts`, add after the `Finding` export block (after line 36):

```typescript
export {
    EngagementSummary,
    EngagementSummaryInput,
    EngagementStats,
    FindingAssociation,
    buildEngagementSummary
} from "./engagement";
```

- [ ] **Step 6: Run all domain tests**

Run: `npx mocha --require ts-node/register 'src/test/unit/core/domain/**/*.test.ts' --timeout 5000`

Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/core/domain/engagement.ts src/core/domain/index.ts src/test/unit/core/domain/engagement.test.ts
git commit -m "feat(engagement): add EngagementSummary with graph-derived associations

Pure function that walks Foam wiki-link graph findingEdges to derive
per-finding associations (hosts, users, services, chained findings).
Groups findings by host and user. Identifies orphan findings with no
wiki-link connections. No changes to Finding interface — associations
are a graph property, not a document property."
```

---

## Task 3: Add MCP tool, resource, and prompt

**Files:**
- Modify: `src/features/mcp/httpServer.ts`

- [ ] **Step 1: Add import**

At the top of `src/features/mcp/httpServer.ts`, add after the existing imports (line 16):

```typescript
import { buildEngagementSummary } from "../../core/domain/engagement";
```

- [ ] **Step 2: Add `get_engagement_summary` tool**

In the `registerTools` method, add after the `create_terminal` tool (after line 357):

```typescript
    server.tool(
      "get_engagement_summary",
      "Get a comprehensive summary of the current penetration testing engagement in one call. Returns: all hosts, credentials, findings with their wiki-link associations (which hosts/users/findings each finding connects to), per-host and per-user finding breakdowns, orphan findings, relationship graph with attack path, and computed statistics. Use this as your first call to understand the full engagement state.",
      {},
      async () => {
        const hosts = Context.HostState ?? [];
        const users = Context.UserState ?? [];
        const findings = await this.getFindings();
        const graph = await this.buildGraph();
        const summary = buildEngagementSummary({ hosts, users, findings, graph });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
        };
      }
    );
```

- [ ] **Step 3: Add `engagement://summary` resource**

In the `registerResources` method, add after the `findings-list` resource (after line 178):

```typescript
    server.resource("engagement-summary", "engagement://summary", async () => {
      const hosts = Context.HostState ?? [];
      const users = Context.UserState ?? [];
      const findings = await this.getFindings();
      const graph = await this.buildGraph();
      const summary = buildEngagementSummary({ hosts, users, findings, graph });
      return {
        contents: [{
          uri: "engagement://summary",
          mimeType: "application/json",
          text: JSON.stringify(summary, null, 2),
        }],
      };
    });
```

- [ ] **Step 4: Add `analyze-engagement` prompt**

In the `registerPrompts` method, add after the `suggest-next-steps` prompt (after line 395):

```typescript
    server.prompt(
      "analyze-engagement",
      "Analyze the full engagement — findings, associations, attack chains — and identify gaps",
      async () => {
        const hosts = Context.HostState ?? [];
        const users = Context.UserState ?? [];
        const findings = await this.getFindings();
        const graph = await this.buildGraph();
        const summary = buildEngagementSummary({ hosts, users, findings, graph });
        return {
          messages: [{
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `You are a penetration testing assistant. Analyze the current engagement and provide strategic guidance.\n\n` +
                `Engagement Summary:\n${JSON.stringify(summary, null, 2)}\n\n` +
                `Provide:\n` +
                `1) Overall assessment — what phase is the engagement in (recon/scanning/exploitation/post-exploitation)?\n` +
                `2) Key findings and their combined impact — look at findingAssociations to see what chains together\n` +
                `3) Attack chains — which findings link to other findings? What is the full exploitation path?\n` +
                `4) Coverage gaps — which hosts have no findings? Which users have no associated findings?\n` +
                `5) Recommended next 3-5 actions with exact commands`,
            },
          }],
        };
      }
    );
```

- [ ] **Step 5: Verify compilation**

Run: `npm run compile`

Expected: No compilation errors

- [ ] **Step 6: Commit**

```bash
git add src/features/mcp/httpServer.ts
git commit -m "feat(mcp): add get_engagement_summary tool and analyze-engagement prompt

AI can now call get_engagement_summary to get the full engagement state
in one call: hosts, credentials, findings with graph-derived associations
(which hosts/users/findings each finding connects to via wiki-links),
per-host and per-user breakdowns, attack chains, and computed stats.

The analyze-engagement prompt asks AI to identify finding chains,
coverage gaps, and recommend next steps."
```

---

## Task 4: Final integration verification

- [ ] **Step 1: Run all unit tests**

Run: `npx mocha --require ts-node/register 'src/test/unit/**/*.test.ts' --timeout 10000`

Expected: ALL PASS

- [ ] **Step 2: Verify full compilation**

Run: `npm run compile`

Expected: No errors

- [ ] **Step 3: Manual smoke test (if VS Code available)**

1. Open a test workspace with hosts/users/findings notes
2. In a host note (e.g. `hosts/dc01/dc01.md`), add `[[sqli-login]]` wiki-link
3. Create `findings/sqli-login/sqli-login.md` with `type: finding` frontmatter
4. Call the MCP tool:
   ```bash
   curl -X POST http://127.0.0.1:<port>/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_engagement_summary","arguments":{}}}'
   ```
5. Verify `findingAssociations` shows `sqli-login` associated with host `dc01`
6. Verify `hostBreakdown` has key `dc01` containing the finding
