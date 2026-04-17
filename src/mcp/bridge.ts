import * as fs from "fs";
import * as path from "path";

export interface BridgeHost {
  hostname: string;
  ip: string;
  alias: string[];
  is_dc: boolean;
  is_current: boolean;
  is_current_dc: boolean;
  props: Record<string, string>;
}

export interface BridgeUser {
  user: string;
  password: string;
  nt_hash: string;
  login: string;
  is_current: boolean;
  props: Record<string, string>;
}

export class StateBridge {
  private stateDir: string;

  constructor(workspacePath: string) {
    this.stateDir = path.join(workspacePath, ".weapon-state");
  }

  private readJSON<T>(filename: string): T | undefined {
    const filePath = path.join(this.stateDir, filename);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return undefined;
    }
  }

  getHosts(): BridgeHost[] {
    return this.readJSON<BridgeHost[]>("hosts.json") ?? [];
  }

  getUsers(): BridgeUser[] {
    return this.readJSON<BridgeUser[]>("users.json") ?? [];
  }

  getEnvVars(): Record<string, string> {
    return this.readJSON<Record<string, string>>("env.json") ?? {};
  }

  getCurrentHost(): BridgeHost | undefined {
    return this.getHosts().find((h) => h.is_current);
  }

  getCurrentUser(): BridgeUser | undefined {
    return this.getUsers().find((u) => u.is_current);
  }

  redactUser(user: BridgeUser): BridgeUser {
    return {
      ...user,
      password: user.password ? "[REDACTED]" : "",
      nt_hash:
        user.nt_hash && user.nt_hash !== "ffffffffffffffffffffffffffffffff"
          ? "[REDACTED]"
          : user.nt_hash,
    };
  }

  getRedactedUsers(): BridgeUser[] {
    return this.getUsers().map((u) => this.redactUser(u));
  }
}
