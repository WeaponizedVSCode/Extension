import type { Foam, Resource, URI, RelationshipGraph, GraphNode, GraphEdge } from "../../../core";
import { longestReferencePath } from "../../../core";

export function buildRelationshipGraph(foam: Foam): RelationshipGraph {
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const hostEdges: GraphEdge[] = [];
  const userEdges: GraphEdge[] = [];

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
    attackPath,
    mermaid,
  };
}
