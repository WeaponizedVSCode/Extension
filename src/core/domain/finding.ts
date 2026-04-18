export interface Finding {
  /** Unique identifier — typically the note filename */
  id: string;
  /** Human-readable title from frontmatter */
  title: string;
  /** Severity if set in frontmatter (critical/high/medium/low/info) */
  severity: string;
  /** Description extracted from #### description section */
  description: string;
  /** References extracted from #### references section */
  references: string;
  /** Additional frontmatter properties */
  props: Record<string, string>;
}

/** Default finding template YAML frontmatter fields */
const FINDING_DEFAULTS: Finding = {
  id: "",
  title: "",
  severity: "info",
  description: "",
  references: "",
  props: {},
};

/**
 * Parse a finding markdown note into a Finding object.
 * Expects YAML frontmatter with at minimum `title` and `type: finding`,
 * and markdown body with `#### description` and `#### references` sections.
 */
export function parseFindingNote(id: string, content: string): Finding {
  const finding: Finding = { ...FINDING_DEFAULTS, id, props: {} };

  // Parse YAML frontmatter
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fmBlock = fmMatch[1];
    for (const line of fmBlock.split("\n")) {
      const kv = line.match(/^(\w[\w-]*):\s*(.+)$/);
      if (!kv) {
        continue;
      }
      const [, key, value] = kv;
      const trimmed = value.trim();
      switch (key) {
        case "title":
          finding.title = trimmed;
          break;
        case "severity":
          finding.severity = trimmed;
          break;
        case "description":
          finding.description = trimmed;
          break;
        case "type":
          break; // already know it's finding
        default:
          finding.props[key] = trimmed;
          break;
      }
    }
  }

  // Extract markdown sections by splitting on #### headers
  const sectionRegex = /^####\s+(\S+)\s*$/gim;
  let match: RegExpExecArray | null;
  const headers: { name: string; start: number; contentStart: number }[] = [];
  while ((match = sectionRegex.exec(content)) !== null) {
    headers.push({ name: match[1].toLowerCase(), start: match.index, contentStart: match.index + match[0].length });
  }
  for (let i = 0; i < headers.length; i++) {
    const bodyEnd = i + 1 < headers.length ? headers[i + 1].start : content.length;
    const body = content.slice(headers[i].contentStart, bodyEnd).trim();
    if (headers[i].name === "description" && body) {
      finding.description = body;
    } else if (headers[i].name === "references" && body) {
      finding.references = body;
    }
  }

  return finding;
}

/**
 * Generate markdown content for a new finding note.
 */
export function generateFindingMarkdown(opts: {
  title: string;
  severity?: string;
  description?: string;
  references?: string;
}): string {
  const severity = opts.severity ?? "info";
  let md = `---\ntitle: ${opts.title}\ntype: finding\nseverity: ${severity}\n`;
  md += `---\n\n### ${opts.title}\n\n`;
  md += `#### description\n\n${opts.description ?? ""}\n\n`;
  md += `#### references\n\n${opts.references ?? ""}\n`;
  return md;
}
