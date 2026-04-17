import type { UserCredential } from "../../../core";

export function buildUserContext(
  users: UserCredential[],
  currentUser: UserCredential | undefined
): string {
  if (users.length === 0) {
    return "**Users:** None discovered yet.";
  }

  const lines: string[] = ["### Known Credentials\n"];

  for (const u of users) {
    // NEVER include actual passwords/hashes in LLM context
    const authType = u.nt_hash && u.nt_hash !== "ffffffffffffffffffffffffffffffff"
      ? "NT hash"
      : u.password
        ? "password"
        : "none";
    lines.push(
      `- **${u.login || u.user}**${u.login && u.login !== u.user ? ` (user: ${u.user})` : ""} ` +
        `[auth: ${authType}]${u.is_current ? " **CURRENT**" : ""}`
    );
  }

  if (currentUser) {
    lines.push(
      `\n**Active user:** $USER = ${currentUser.user}, $LOGIN = ${currentUser.login || currentUser.user}`
    );
  }

  return lines.join("\n");
}
