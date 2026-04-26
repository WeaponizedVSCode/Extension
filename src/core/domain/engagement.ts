import type { Host } from "./host";
import type { UserCredential } from "./user";
import type { Finding } from "./finding";
import type { RelationshipGraph } from "./graph";

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
