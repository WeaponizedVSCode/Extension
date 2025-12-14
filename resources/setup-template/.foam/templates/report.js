function longestReferencePath(edges) {
  if (!edges || edges.length === 0) {
    return [];
  }
  var nodesSet = new Set();
  edges.forEach(function (_a) {
    var source = _a.source,
      target = _a.target;
    nodesSet.add(source);
    nodesSet.add(target);
  });
  var nodes = Array.from(nodesSet);
  var idOf = new Map();
  nodes.forEach(function (n, i) {
    return idOf.set(n, i);
  });
  var n = nodes.length;
  var g = Array.from({ length: n }, function () {
    return [];
  });
  var firstSeen = Array(n).fill(Infinity);
  edges.forEach(function (e, idx) {
    var u = idOf.get(e.source);
    var v = idOf.get(e.target);
    g[u].push(v);
    firstSeen[u] = Math.min(firstSeen[u], idx);
    firstSeen[v] = Math.min(firstSeen[v], idx);
  });
  var time = 0;
  var dfn = Array(n).fill(-1);
  var low = Array(n).fill(-1);
  var onStack = Array(n).fill(false);
  var stack = [];
  var compId = Array(n).fill(-1);
  var comps = [];
  function tarjan(u) {
    dfn[u] = low[u] = time++;
    stack.push(u);
    onStack[u] = true;
    for (var _i = 0, _a = g[u]; _i < _a.length; _i++) {
      var v = _a[_i];
      if (dfn[v] === -1) {
        tarjan(v);
        low[u] = Math.min(low[u], low[v]);
      } else if (onStack[v]) {
        low[u] = Math.min(low[u], dfn[v]);
      }
    }
    if (low[u] === dfn[u]) {
      var comp = [];
      while (true) {
        var x = stack.pop();
        onStack[x] = false;
        compId[x] = comps.length;
        comp.push(x);
        if (x === u) {
          break;
        }
      }
      comps.push(comp);
    }
  }
  for (var i = 0; i < n; i++) {
    if (dfn[i] === -1) {
      tarjan(i);
    }
  }
  var C = comps.length;
  if (C === 0) {
    return [];
  }
  var dag = Array.from({ length: C }, function () {
    return [];
  });
  var indeg = Array(C).fill(0);
  var compSize = comps.map(function (c) {
    return c.length;
  });
  var seenEdge = new Set();
  for (var u = 0; u < n; u++) {
    for (var _i = 0, _a = g[u]; _i < _a.length; _i++) {
      var v = _a[_i];
      var cu = compId[u],
        cv = compId[v];
      if (cu !== cv) {
        var key = "".concat(cu, "->").concat(cv);
        if (!seenEdge.has(key)) {
          seenEdge.add(key);
          dag[cu].push(cv);
          indeg[cv]++;
        }
      }
    }
  }
  var dist = Array(C).fill(-Infinity);
  var parent = Array(C).fill(-1);
  var q = [];
  for (var c = 0; c < C; c++) {
    if (indeg[c] === 0) {
      dist[c] = compSize[c];
      q.push(c);
    }
  }
  var topo = [];
  var indegTmp = indeg.slice();
  while (q.length) {
    var u = q.shift();
    topo.push(u);
    for (var _b = 0, _c = dag[u]; _b < _c.length; _b++) {
      var v = _c[_b];
      if (dist[u] + compSize[v] > dist[v]) {
        dist[v] = dist[u] + compSize[v];
        parent[v] = u;
      }
      if (--indegTmp[v] === 0) {
        q.push(v);
      }
    }
  }
  var end = 0;
  for (var c = 1; c < C; c++) {
    if (dist[c] > dist[end]) {
      end = c;
    }
  }
  var compPath = [];
  for (var x = end; x !== -1; x = parent[x]) {
    compPath.push(x);
  }
  compPath.reverse();
  function expandComp(comp) {
    if (comp.length === 1) {
      return comp.slice();
    }
    return comp.slice().sort(function (a, b) {
      var fa = firstSeen[a],
        fb = firstSeen[b];
      if (fa !== fb) {
        return fa - fb;
      }
      var sa = nodes[a],
        sb = nodes[b];
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
  }
  var pathNodeIds = [];
  for (var _d = 0, compPath_1 = compPath; _d < compPath_1.length; _d++) {
    var c = compPath_1[_d];
    var expanded = expandComp(comps[c]);
    for (var _e = 0, expanded_1 = expanded; _e < expanded_1.length; _e++) {
      var v = expanded_1[_e];
      if (
        pathNodeIds.length === 0 ||
        pathNodeIds[pathNodeIds.length - 1] !== v
      ) {
        pathNodeIds.push(v);
      }
    }
  }
  return pathNodeIds.map(function (i) {
    return nodes[i];
  });
}

function generateFoamGraph(foam) {
  const graph = {
    nodeInfo: {},
    edges: new Set(),
    userEdges: new Set(),
    hostEdges: new Set(),
  };
  foam.workspace.list().forEach((n) => {
    const type = n.type === "note" ? n.properties.type ?? "note" : n.type;
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
    if (sourceNode && targetNode && (targetNode.type === "user" || sourceNode.type === "user")) {
      graph.userEdges.add({
        source: sourceNode.id,
        target: targetNode.id,
      });
    }
    if (sourceNode && targetNode && (targetNode.type === "host" || sourceNode.type === "host")) {
      graph.hostEdges.add({
        source: sourceNode.id,
        target: targetNode.id,
      });
    }
  });
  // console.log("Graph nodes:", graph.nodeInfo);
  // console.log("Graph edges: ", foam.graph.getAllConnections());
  // console.log("Graph edges sets:", (Array.from(graph.edges)));
  // console.log("Graph user edges sets:", (Array.from(graph.userEdges)));
  return graph;
}

function calcTheMermaid(foam, graph) {
  function getId(uri) {
    return foam.workspace.getIdentifier(uri) || "";
  }
  let ret = {
    hostEdges: [],
    userEdges: []
  }
  for (const hostEdge of Array.from(graph.hostEdges)) {
    // Perform calculations or modifications based on host edges
    const { source, target } = hostEdge;
    let sourceNode = graph.nodeInfo[source];
    let targetNode = graph.nodeInfo[target];
    if (sourceNode && targetNode && targetNode.type === "host" && sourceNode.type === "host") {
      ret.hostEdges.push(`${getId(sourceNode.uri)} ---> ${getId(targetNode.uri)}`);
    }
  }
  for (const userEdge of Array.from(graph.userEdges)) {
    // Perform calculations or modifications based on user edges
    const { source, target } = userEdge;
    let sourceNode = graph.nodeInfo[source];
    let targetNode = graph.nodeInfo[target];
    if (sourceNode && targetNode) {
      ret.userEdges.push(`${getId(sourceNode.uri)} ---> ${getId(targetNode.uri)}`);
    }
  }
  return ret;
}

let meta = `---
title: Final Penetration Testing Report
type: report
---

# Final Penetration Testing Report
`;

function checkArrayDiffElements(arr1, arr2) {
  let set1 = new Set(arr1);
  let set2 = new Set(arr2);
  let difference = [];
  for (let item of set1) {
    if (!set2.has(item)) {
      difference.push(item);
    }
  }
  for (let item of set2) {
    if (!set1.has(item)) {
      difference.push(item);
    }
  }
  return difference;
}

async function createNote({ trigger, foam, resolver, foamDate }) {
  function getId(uri) {
    return foam.workspace.getIdentifier(uri) || "";
  }
  console.log("BEGIN ======= Creating note for trigger:", trigger);
  console.log("Foam instance:", Object.keys(foam));
  const graph = generateFoamGraph(foam);
  console.log("Generated graph!");

  let userNoteList = [];
  let hostNoteList = [];
  let userList = [];
  for (const [path, meta] of Object.entries(graph.nodeInfo)) {
    if (meta.type === "user") {
      userNoteList.push(meta);
      userList.push(path);
    } else if (meta.type === "host") {
      hostNoteList.push(meta);
    } else {
      console.log(`Skipping node ${path} of type ${meta.type}`);
    }
  }

  // 1. Hosts Information
  let hostInformation = hostNoteList.map((hostMeta) => {
    return `## Host: ${hostMeta.title}

content-inline![[${getId(hostMeta.uri)}]]
`;
  });

  let attackPath = longestReferencePath(Array.from(graph.userEdges));
  let extraNotePath = checkArrayDiffElements(attackPath, userList);

  // 2. Users Information with Attack Path
  let attackNotes = attackPath.map((userPath, index) => {
    let userMeta = graph.nodeInfo[userPath];
    if (!userMeta) {
      return `> Note with path ${userPath} not found in graph.`;
    }
    var currentNote = `

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
    return `### User ${userMeta.title} `+ currentNote;
  });
  // userInformation = userInformation.concat(attackNotes);

  // 3. Users Information - Extra Users not in attack path
  // userInformation.push("## Extra Users", "");
  
  let extraNotes = extraNotePath.map((path) => {
    let userMeta = graph.nodeInfo[path];
    if (!userMeta) {
      return `> Note with path ${path} not found in graph.`;
    }
    if (userMeta.type !== "user") {
      return `> Note with path ${path} is not a user type.`;
    }
    return `### User: ${userMeta.title}

content-inline![[${getId(userMeta.uri)}]]
`;
  });
  // userInformation.concat(extraNotes);

  // 4. Generate Mermaid graph for Users based attack path
  let grapher = calcTheMermaid(foam, graph);
  console.log("Grapher:", grapher);

  // You can use the grapher object to generate a mermaid diagram
  // For example:
  let mermaidDiagram = `graph TD;\n`;
  for (const edge of grapher.userEdges) {
    mermaidDiagram += `  ${edge}\n`;
  }
  mermaidDiagram = "```mermaid\n" + mermaidDiagram + "```";
  console.log("Mermaid Diagram:", mermaidDiagram);

  // 5. Final assembly in order
  let body = `${meta}
## Hosts Information

${hostInformation.join("\n")}

## Full Relations graph
${mermaidDiagram}

## Privilege Escalation Path

${attackNotes.join("\n")}

## Extra Pwned Users

${extraNotes.join("\n")}

`;

  console.log("attack path:", attackPath);
  console.log("body:", body);
  console.log("extra notes:", extraNotePath);
  console.log("user notes:", userNoteList);

  return {
    filepath: "report.md",
    content: body,
  };
}
