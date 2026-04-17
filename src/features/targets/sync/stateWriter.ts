import * as vscode from "vscode";
import { Context } from "../../../platform/vscode/context";
import { logger } from "../../../platform/vscode/logger";
import type { Foam, Resource, URI, RelationshipGraph, GraphNode, GraphEdge } from "../../../core";
import { longestReferencePath } from "../../../core";

function buildRelationshipGraph(foam: Foam): RelationshipGraph {
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const hostEdges: GraphEdge[] = [];
  const userEdges: GraphEdge[] = [];

  const getId = (uri: URI) => foam.workspace.getIdentifier(uri) || uri.path;

  // Build nodes
  foam.workspace.list().forEach((r: Resource) => {
    const type = r.type === "note" ? ((r.properties.type as string) ?? "note") : r.type;
    if (type === "report") {
      return;
    }
    const title = r.type === "note" ? r.title : r.uri.getBasename();
    nodeMap.set(r.uri.path, {
      id: getId(r.uri),
      type,
      title,
    });
  });

  // Build edges
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
  });

  const attackPath = longestReferencePath(userEdges);

  // Build mermaid
  let mermaid = "graph TD;\n";
  for (const e of userEdges) {
    mermaid += `  ${e.source} ---> ${e.target}\n`;
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    hostEdges,
    userEdges,
    attackPath,
    mermaid,
  };
}

export async function writeStateForMCP(workspace: vscode.WorkspaceFolder) {
  const stateDir = vscode.Uri.joinPath(workspace.uri, ".weapon-state");

  try {
    await vscode.workspace.fs.createDirectory(stateDir);
  } catch {
    // directory may already exist
  }

  const encoder = new TextEncoder();

  const hosts = Context.HostState ?? [];
  await vscode.workspace.fs.writeFile(
    vscode.Uri.joinPath(stateDir, "hosts.json"),
    encoder.encode(JSON.stringify(hosts, null, 2))
  );

  const users = Context.UserState ?? [];
  await vscode.workspace.fs.writeFile(
    vscode.Uri.joinPath(stateDir, "users.json"),
    encoder.encode(JSON.stringify(users, null, 2))
  );

  // Build and write relationship graph from Foam
  try {
    const foam = await Context.Foam();
    if (foam?.graph && foam?.workspace) {
      const graphData = buildRelationshipGraph(foam);
      await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(stateDir, "graph.json"),
        encoder.encode(JSON.stringify(graphData, null, 2))
      );
      logger.trace("Graph data written to .weapon-state/graph.json");
    }
  } catch (e) {
    logger.trace("Skipping graph.json (Foam not available):", e);
  }

  logger.trace("MCP state files written to .weapon-state/");
}
