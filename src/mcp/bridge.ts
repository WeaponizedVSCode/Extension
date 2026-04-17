import * as fs from "fs";
import * as path from "path";

export interface TerminalInfo {
  id: string;
  name: string;
  isActive: boolean;
  cwd?: string;
  lastCommand?: string;
  lastExitCode?: number;
}

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

  getTerminals(): TerminalInfo[] {
    return this.readJSON<TerminalInfo[]>("terminals.json") ?? [];
  }

  getTerminalOutput(id: string, lines: number = 50): string {
    // Try reading by ID first, then by name lookup
    let logPath = path.join(this.stateDir, "terminals", `${id}.log`);
    if (!fs.existsSync(logPath)) {
      // Try to find by terminal name
      const terminals = this.getTerminals();
      const match = terminals.find((t) => t.name === id);
      if (match) {
        logPath = path.join(this.stateDir, "terminals", `${match.id}.log`);
      }
    }
    try {
      const content = fs.readFileSync(logPath, "utf-8");
      const allLines = content.split("\n");
      return allLines.slice(-lines).join("\n");
    } catch {
      return `No output found for terminal ${id}`;
    }
  }

  sendCommand(terminalId: string, command: string): void {
    const inputFile = path.join(this.stateDir, "terminal-input.json");
    fs.writeFileSync(
      inputFile,
      JSON.stringify({ terminalId, command }, null, 2)
    );
  }
}
