import { Host, UserCredential } from "../../core";
import { Context } from "../../platform/vscode/context";

export interface EngagementState {
  hosts: Host[];
  users: UserCredential[];
  currentHost: Host | undefined;
  currentUser: UserCredential | undefined;
}

export class AIService {
  getEngagementState(): EngagementState {
    const hosts = Context.HostState ?? [];
    const users = Context.UserState ?? [];
    const currentHost = hosts.find((h) => h.is_current);
    const currentUser = users.find((u) => u.is_current);
    return { hosts, users, currentHost, currentUser };
  }

  redactCredentials(text: string): string {
    const state = this.getEngagementState();
    let result = text;
    for (const user of state.users) {
      if (user.password) {
        result = result.replaceAll(user.password, "[REDACTED]");
      }
      if (user.nt_hash && user.nt_hash !== "ffffffffffffffffffffffffffffffff") {
        result = result.replaceAll(user.nt_hash, "[REDACTED]");
      }
    }
    return result;
  }
}
