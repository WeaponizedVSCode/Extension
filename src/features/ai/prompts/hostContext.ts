import type { Host } from "../../../core";

export function buildHostContext(
  hosts: Host[],
  currentHost: Host | undefined
): string {
  if (hosts.length === 0) {
    return "**Hosts:** None discovered yet.";
  }

  const lines: string[] = ["### Known Hosts\n"];

  for (const h of hosts) {
    const flags = [h.is_current ? "CURRENT" : "", h.is_dc ? "DC" : ""]
      .filter(Boolean)
      .join(", ");

    lines.push(
      `- **${h.hostname}** (${h.ip})${flags ? ` [${flags}]` : ""}` +
        (h.alias?.length ? ` aliases: ${h.alias.join(", ")}` : "")
    );
  }

  if (currentHost) {
    lines.push(
      `\n**Active target:** $TARGET = ${currentHost.hostname}, $RHOST = ${currentHost.ip}`
    );
  }

  return lines.join("\n");
}
