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
      { source: "dc01", target: "sqli-login" },
      { source: "admin", target: "sqli-login" },
      { source: "dc01", target: "smb-signing" },
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
      { source: "svc_sql", target: "kerberoast" },
      { source: "kerberoast", target: "dcsync" },
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
