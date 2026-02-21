export interface URI {
  path: string;
  getBasename(): string;
}

export interface Resource {
  uri: URI;
  type: string;
  title: string;
  properties: Record<string, unknown> & {
    type?: string;
  };
  tags: unknown[];
}

export interface Connection {
  source: URI;
  target: URI;
}

export interface FoamWorkspace {
  list(): Resource[];
  getIdentifier(forResource: URI): string;
}

export interface FoamGraph {
  getAllConnections(): Connection[];
}

export interface Foam {
  workspace: FoamWorkspace;
  graph: FoamGraph;
}
