import type { Foam, Resource, URI } from "../../../core";
import { longestReferencePath } from "../../../core";
import * as vscode from "vscode";

type Edge = { source: string; target: string };

type GraphNodeInfo = {
  id: string;
  type: string;
  uri: URI;
  title: string;
  properties: Resource["properties"];
  tags: Resource["tags"];
};

type FoamGraphModel = {
  nodeInfo: Record<string, GraphNodeInfo>;
  edges: Set<Edge>;
  userEdges: Set<Edge>;
  hostEdges: Set<Edge>;
};

type MermaidGraph = {
  hostEdges: string[];
  userEdges: string[];
};

type CreateNoteArgs = {
  logger: vscode.LogOutputChannel;
  foam: Foam;
};

type CreateNoteResult = {
  filepath: string;
  content: string;
};

function generateFoamGraph(
  foam: Foam,
  log: vscode.LogOutputChannel,
): FoamGraphModel {
  const graph: FoamGraphModel = {
    nodeInfo: {},
    edges: new Set<Edge>(),
    userEdges: new Set<Edge>(),
    hostEdges: new Set<Edge>(),
  };
  if (!foam) {
    log.error("Foam is not initialized.");
    return graph;
  }
  if (!foam.graph) {
    log.error("Foam graph is not initialized.");
    log.debug("Foam is ", foam);
    return graph;
  }
  if (!foam.workspace) {
    log.error("Foam workspace is not initialized.");
    return graph;
  }
  log.debug("Generating Foam graph...");
  foam.workspace.list().forEach((n: Resource) => {
    const type = n.type === "note" ? (n.properties.type ?? "note") : n.type;
    const title = n.type === "note" ? n.title : n.uri.getBasename();
    if (type === "report") {
      return; // ignore all report type notes
    }
    graph.nodeInfo[n.uri.path] = {
      id: n.uri.path,
      type: type,
      uri: n.uri,
      title: title,
      properties: n.properties,
      tags: n.tags,
    };
  });
  foam.graph.getAllConnections().forEach((c) => {
    const sourcePath = c.source.path;
    const targetPath = c.target.path;
    graph.edges.add({
      source: sourcePath,
      target: targetPath,
    });
    const sourceNode = graph.nodeInfo[sourcePath];
    const targetNode = graph.nodeInfo[targetPath];
    if (
      sourceNode &&
      targetNode &&
      (targetNode.type === "user" || sourceNode.type === "user")
    ) {
      graph.userEdges.add({
        source: sourceNode.id,
        target: targetNode.id,
      });
    }
    if (
      sourceNode &&
      targetNode &&
      (targetNode.type === "host" || sourceNode.type === "host")
    ) {
      graph.hostEdges.add({
        source: sourceNode.id,
        target: targetNode.id,
      });
    }
  });
  // logger.trace("Graph nodes:", graph.nodeInfo);
  // logger.trace("Graph edges: ", foam.graph.getAllConnections());
  // logger.trace("Graph edges sets:", (Array.from(graph.edges)));
  // logger.trace("Graph user edges sets:", (Array.from(graph.userEdges)));
  return graph;
}

function calcTheMermaid(foam: Foam, graph: FoamGraphModel): MermaidGraph {
  const getId = (uri: URI) => foam.workspace.getIdentifier(uri) || "";
  const ret: MermaidGraph = {
    hostEdges: [],
    userEdges: [],
  };
  for (const hostEdge of Array.from(graph.hostEdges)) {
    // Perform calculations or modifications based on host edges
    const { source, target } = hostEdge;
    const sourceNode = graph.nodeInfo[source];
    const targetNode = graph.nodeInfo[target];
    if (
      sourceNode &&
      targetNode &&
      targetNode.type === "host" &&
      sourceNode.type === "host"
    ) {
      ret.hostEdges.push(
        `${getId(sourceNode.uri)} ---> ${getId(targetNode.uri)}`,
      );
    }
  }
  for (const userEdge of Array.from(graph.userEdges)) {
    // Perform calculations or modifications based on user edges
    const { source, target } = userEdge;
    const sourceNode = graph.nodeInfo[source];
    const targetNode = graph.nodeInfo[target];
    if (sourceNode && targetNode) {
      ret.userEdges.push(
        `${getId(sourceNode.uri)} ---> ${getId(targetNode.uri)}`,
      );
    }
  }
  return ret;
}

const meta = `---
title: Final Penetration Testing Report
type: report
---

# Final Penetration Testing Report
`;

function checkArrayDiffElements<T>(
  arr1: readonly T[],
  arr2: readonly T[],
): T[] {
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  const difference: T[] = [];
  for (const item of set1) {
    if (!set2.has(item)) {
      difference.push(item);
    }
  }
  for (const item of set2) {
    if (!set1.has(item)) {
      difference.push(item);
    }
  }
  return difference;
}

export async function createNote({
  logger,
  foam,
}: CreateNoteArgs): Promise<CreateNoteResult> {
  logger.debug("Starting to create note...");
  const getId = (uri: URI) => foam.workspace.getIdentifier(uri) || "";
  logger.trace("Foam instance:", Object.keys(foam));
  const graph = generateFoamGraph(foam, logger);
  logger.trace("Generated graph!");

  const userNoteList: GraphNodeInfo[] = [];
  const hostNoteList: GraphNodeInfo[] = [];
  const userList: string[] = [];
  for (const [path, node] of Object.entries(graph.nodeInfo)) {
    if (node.type === "user") {
      userNoteList.push(node);
      userList.push(path);
    } else if (node.type === "host") {
      hostNoteList.push(node);
    } else {
      logger.trace(`Skipping node ${path} of type ${node.type}`);
    }
  }

  // 1. Hosts Information
  const hostInformation: string[] = hostNoteList.map((hostMeta) => {
    return `## Host: ${hostMeta.title}

content-inline![[${getId(hostMeta.uri)}]]
`;
  });

  const attackPath = longestReferencePath(Array.from(graph.userEdges));
  const extraNotePath = checkArrayDiffElements(attackPath, userList);

  // 2. Users Information with Attack Path
  const attackNotes: string[] = attackPath.map((userPath, index) => {
    const userMeta = graph.nodeInfo[userPath];
    if (!userMeta) {
      return `> Note with path ${userPath} not found in graph.`;
    }
    const currentNote = `

content-inline![[${getId(userMeta.uri)}]]
`;
    if (index === 0) {
      if (userMeta.type === "host") {
        return "";
      }
      if (userMeta.type === "user") {
        return `### Initial User: ${userMeta.title}` + currentNote;
      }
      return `### Initial Access: ${userMeta.title}` + currentNote;
    }
    return `### User ${userMeta.title} ` + currentNote;
  });
  // userInformation = userInformation.concat(attackNotes);

  // 3. Users Information - Extra Users not in attack path
  // userInformation.push("## Extra Users", "");

  const extraNotes: string[] = extraNotePath.map((path) => {
    const userMeta = graph.nodeInfo[path];
    if (!userMeta) {
      return ``;
    }
    if (userMeta.type !== "user") {
      return ``;
    }
    return `### User: ${userMeta.title}

content-inline![[${getId(userMeta.uri)}]]
`;
  });
  // userInformation.concat(extraNotes);

  // 4. Generate Mermaid graph for Users based attack path
  const grapher = calcTheMermaid(foam, graph);
  logger.trace("Grapher:", grapher);

  // You can use the grapher object to generate a mermaid diagram
  // For example:
  let mermaidDiagram = `graph TD;\n`;
  for (const edge of grapher.userEdges) {
    mermaidDiagram += `  ${edge}\n`;
  }
  mermaidDiagram = "```mermaid\n" + mermaidDiagram + "```";
  logger.trace("Mermaid Diagram:", mermaidDiagram);

  // 5. Final assembly in order
  const body = `${meta}
## Hosts Information

${hostInformation.join("\n")}

## Full Relations graph
${mermaidDiagram}

## Privilege Escalation Path

${attackNotes.join("\n")}

## Extra Pwned Users

${extraNotes.join("\n")}

`;

  logger.trace("attack path:", attackPath);
  logger.trace("body:", body);
  logger.trace("extra notes:", extraNotePath);
  logger.trace("user notes:", userNoteList);

  return {
    filepath: "report.md",
    content: body,
  };
}
