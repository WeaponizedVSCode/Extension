export interface GraphNode {
  id: string;       // human-readable identifier (e.g. "dc01", "administrator")
  type: string;     // "host" | "user" | "service" | "finding" | "note"
  title: string;
}

export interface GraphEdge {
  source: string;   // node id
  target: string;   // node id
}

export interface RelationshipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];       // all connections
  hostEdges: GraphEdge[];   // both endpoints involve type "host"
  userEdges: GraphEdge[];   // at least one endpoint is type "user"
  attackPath: string[];     // ordered node IDs — privilege escalation chain
  mermaid: string;          // pre-rendered Mermaid diagram
}

/**
 * Longest path through SCCs (Tarjan) — computes privilege escalation chain.
 * Pure algorithm, no vscode dependency.
 */
export function longestReferencePath(edges: readonly GraphEdge[]): string[] {
  if (!edges || edges.length === 0) {
    return [];
  }
  const nodesSet = new Set<string>();
  edges.forEach(({ source, target }) => {
    nodesSet.add(source);
    nodesSet.add(target);
  });
  const nodes = Array.from(nodesSet);
  const idOf = new Map<string, number>();
  nodes.forEach((node, i) => idOf.set(node, i));
  const n = nodes.length;
  const g: number[][] = Array.from({ length: n }, () => []);
  const firstSeen: number[] = Array(n).fill(Infinity);
  edges.forEach((e, idx) => {
    const u = idOf.get(e.source)!;
    const v = idOf.get(e.target)!;
    g[u].push(v);
    firstSeen[u] = Math.min(firstSeen[u], idx);
    firstSeen[v] = Math.min(firstSeen[v], idx);
  });
  let time = 0;
  const dfn: number[] = Array(n).fill(-1);
  const low: number[] = Array(n).fill(-1);
  const onStack: boolean[] = Array(n).fill(false);
  const stack: number[] = [];
  const compId: number[] = Array(n).fill(-1);
  const comps: number[][] = [];
  function tarjan(u: number): void {
    dfn[u] = low[u] = time++;
    stack.push(u);
    onStack[u] = true;
    for (let i = 0; i < g[u].length; i++) {
      const v = g[u][i];
      if (dfn[v] === -1) {
        tarjan(v);
        low[u] = Math.min(low[u], low[v]);
      } else if (onStack[v]) {
        low[u] = Math.min(low[u], dfn[v]);
      }
    }
    if (low[u] === dfn[u]) {
      const comp: number[] = [];
      while (true) {
        const x = stack.pop()!;
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
  for (let i = 0; i < n; i++) {
    if (dfn[i] === -1) {
      tarjan(i);
    }
  }
  const C = comps.length;
  if (C === 0) {
    return [];
  }
  const dag: number[][] = Array.from({ length: C }, () => []);
  const indeg: number[] = Array(C).fill(0);
  const compSize: number[] = comps.map((c) => c.length);
  const seenEdge = new Set<string>();
  for (let u = 0; u < n; u++) {
    for (let i = 0; i < g[u].length; i++) {
      const v = g[u][i];
      const cu = compId[u];
      const cv = compId[v];
      if (cu !== cv) {
        const key = `${cu}->${cv}`;
        if (!seenEdge.has(key)) {
          seenEdge.add(key);
          dag[cu].push(cv);
          indeg[cv]++;
        }
      }
    }
  }
  const dist: number[] = Array(C).fill(-Infinity);
  const parent: number[] = Array(C).fill(-1);
  const q: number[] = [];
  for (let c = 0; c < C; c++) {
    if (indeg[c] === 0) {
      dist[c] = compSize[c];
      q.push(c);
    }
  }
  const indegTmp = indeg.slice();
  while (q.length) {
    const u = q.shift()!;
    for (let i = 0; i < dag[u].length; i++) {
      const v = dag[u][i];
      if (dist[u] + compSize[v] > dist[v]) {
        dist[v] = dist[u] + compSize[v];
        parent[v] = u;
      }
      if (--indegTmp[v] === 0) {
        q.push(v);
      }
    }
  }
  let end = 0;
  for (let c = 1; c < C; c++) {
    if (dist[c] > dist[end]) {
      end = c;
    }
  }
  const compPath: number[] = [];
  for (let x = end; x !== -1; x = parent[x]) {
    compPath.push(x);
  }
  compPath.reverse();
  function expandComp(comp: number[]): number[] {
    if (comp.length === 1) {
      return comp.slice();
    }
    return comp.slice().sort((a, b) => {
      const fa = firstSeen[a];
      const fb = firstSeen[b];
      if (fa !== fb) {
        return fa - fb;
      }
      return nodes[a] < nodes[b] ? -1 : nodes[a] > nodes[b] ? 1 : 0;
    });
  }
  const pathNodeIds: number[] = [];
  for (let i = 0; i < compPath.length; i++) {
    const expanded = expandComp(comps[compPath[i]]);
    for (let j = 0; j < expanded.length; j++) {
      const v = expanded[j];
      if (pathNodeIds.length === 0 || pathNodeIds[pathNodeIds.length - 1] !== v) {
        pathNodeIds.push(v);
      }
    }
  }
  return pathNodeIds.map((nodeId) => nodes[nodeId]);
}
