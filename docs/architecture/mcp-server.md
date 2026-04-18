# MCP Server Implementation Guide

## What is MCP?

The **Model Context Protocol (MCP)** is an open standard for connecting AI assistants to external data sources and tools. By exposing an MCP server from your extension, any MCP-compatible AI tool (Claude Code, Cursor, Windsurf, Continue, custom agents) can:

- **Read** your engagement state (hosts, users, notes, terminal logs)
- **Execute** pentest actions (run scans, switch targets, create findings)
- **Use** pre-built prompt templates for common analysis tasks

This turns your VS Code extension into an AI-controllable pentest platform.

---

## Architecture

```
┌─────────────────────────┐     MCP Protocol      ┌──────────────────────┐
│  AI Tool                │     (stdio / SSE)      │  MCP Server          │
│  (Claude Code, Cursor,  │◄─────────────────────► │  (in extension)      │
│   custom agent, etc.)   │                        │                      │
└─────────────────────────┘                        │  Resources:          │
                                                   │   - hosts            │
                                                   │   - users            │
                                                   │   - notes            │
                                                   │   - terminal-logs    │
                                                   │   - env-vars         │
                                                   │                      │
                                                   │  Tools:              │
                                                   │   - get_targets      │
                                                   │   - switch_target    │
                                                   │   - run_scanner      │
                                                   │   - run_command      │
                                                   │   - create_finding   │
                                                   │   - generate_report  │
                                                   │   - search_notes     │
                                                   │   - decode_text      │
                                                   │                      │
                                                   │  Prompts:            │
                                                   │   - analyze-output   │
                                                   │   - suggest-next     │
                                                   │   - privesc-check    │
                                                   └──────────────────────┘
```

---

## Option A: Standalone MCP Server (Recommended)

Run a separate Node.js process as an MCP server that communicates with the extension via IPC.

### Why standalone?
- VS Code extensions run in the Extension Host — they can't directly serve stdio
- A separate process is the standard MCP pattern
- The extension writes state to files; the MCP server reads them
- No complex IPC needed if you use the filesystem as the interchange

### File Structure

```
src/features/ai/mcp/
  server.ts             -- MCP server entry point (standalone Node.js)
  tools.ts              -- Tool definitions and handlers
  resources.ts          -- Resource definitions
  prompts.ts            -- Prompt templates
  state-bridge.ts       -- Reads extension state from workspace files
```

Plus a separate entry point:

```
src/mcp-server.ts       -- Standalone entry for the MCP server process
```

### Dependencies

```bash
pnpm add @modelcontextprotocol/sdk
```

---

## Step 1: Define the MCP Server

```typescript
// src/mcp-server.ts
// This is a STANDALONE Node.js script, NOT part of the VS Code extension bundle.
// It runs as a separate process and communicates via stdio.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registerTools } from "./features/ai/mcp/tools";
import { registerResources } from "./features/ai/mcp/resources";
import { registerPrompts } from "./features/ai/mcp/prompts";

const server = new McpServer({
  name: "weaponized-vscode",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
    prompts: {},
  },
});

// Register all capabilities
registerTools(server);
registerResources(server);
registerPrompts(server);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weaponized MCP server started on stdio");
}

main().catch(console.error);
```

---

## Step 2: Define Resources

Resources are read-only data that AI tools can access.

```typescript
// src/features/ai/mcp/resources.ts

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StateBridge } from "./state-bridge";

export function registerResources(server: McpServer) {
  const bridge = new StateBridge();

  // List all hosts
  server.resource(
    "hosts",
    "weapon://hosts",
    {
      description: "All known hosts in the current engagement",
      mimeType: "application/json",
    },
    async () => {
      const hosts = await bridge.getHosts();
      return {
        contents: [
          {
            uri: "weapon://hosts",
            mimeType: "application/json",
            text: JSON.stringify(hosts, null, 2),
          },
        ],
      };
    }
  );

  // List all users (credentials redacted by default)
  server.resource(
    "users",
    "weapon://users",
    {
      description:
        "All known user credentials (passwords/hashes redacted). Use get_credential tool for full details.",
      mimeType: "application/json",
    },
    async () => {
      const users = await bridge.getUsers();
      // Redact sensitive fields
      const redacted = users.map((u) => ({
        user: u.user,
        login: u.login,
        has_password: !!u.password,
        has_nt_hash: !!u.nt_hash,
        is_current: u.is_current,
      }));
      return {
        contents: [
          {
            uri: "weapon://users",
            mimeType: "application/json",
            text: JSON.stringify(redacted, null, 2),
          },
        ],
      };
    }
  );

  // Current environment variables
  server.resource(
    "env-vars",
    "weapon://env-vars",
    {
      description:
        "Environment variables exported to terminals ($TARGET, $RHOST, $USER, etc.)",
      mimeType: "application/json",
    },
    async () => {
      const envVars = await bridge.getEnvironmentVariables();
      // Redact credential-related vars
      const safe = Object.fromEntries(
        Object.entries(envVars).filter(
          ([k]) => !k.includes("PASS") && !k.includes("HASH")
        )
      );
      return {
        contents: [
          {
            uri: "weapon://env-vars",
            mimeType: "application/json",
            text: JSON.stringify(safe, null, 2),
          },
        ],
      };
    }
  );

  // Terminal logs
  server.resource(
    "terminal-logs",
    "weapon://terminal-logs",
    {
      description: "Terminal command logs from the current engagement session",
      mimeType: "text/plain",
    },
    async () => {
      const logs = await bridge.getTerminalLogs();
      return {
        contents: [
          {
            uri: "weapon://terminal-logs",
            mimeType: "text/plain",
            text: logs,
          },
        ],
      };
    }
  );

  // Dynamic resource: individual Foam notes
  server.resource(
    "note",
    "weapon://notes/{path}",
    {
      description: "A Foam note by its relative path",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const path = uri.pathname.replace("/notes/", "");
      const content = await bridge.getNoteContent(path);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: content,
          },
        ],
      };
    }
  );
}
```

---

## Step 3: Define Tools

Tools are actions the AI can execute.

```typescript
// src/features/ai/mcp/tools.ts

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StateBridge } from "./state-bridge";

export function registerTools(server: McpServer) {
  const bridge = new StateBridge();

  // --- Read-Only Tools ---

  server.tool(
    "get_targets",
    "Get all hosts and the current target with full details",
    {},
    async () => {
      const hosts = await bridge.getHosts();
      const current = hosts.find((h) => h.is_current);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ hosts, currentTarget: current }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_credentials",
    "Get all user credentials with full details (including passwords and hashes)",
    {},
    async () => {
      const users = await bridge.getUsers();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(users, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "search_notes",
    "Search Foam notes by title, type, or content keyword",
    {
      query: z.string().describe("Search query (matches title and content)"),
      type: z
        .enum(["host", "user", "service", "finding", "note", "all"])
        .default("all")
        .describe("Filter by note type"),
    },
    async ({ query, type }) => {
      const results = await bridge.searchNotes(query, type);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_attack_graph",
    "Get the attack path graph (Tarjan SCC analysis) as a Mermaid diagram",
    {},
    async () => {
      const graph = await bridge.getAttackGraph();
      return {
        content: [
          {
            type: "text",
            text: graph,
          },
        ],
      };
    }
  );

  // --- Write Tools (require user confirmation in MCP clients) ---

  server.tool(
    "switch_target",
    "Set a host as the current target (updates $TARGET, $RHOST, etc.)",
    {
      hostname: z.string().describe("Hostname of the target to switch to"),
    },
    async ({ hostname }) => {
      await bridge.switchHost(hostname);
      return {
        content: [
          {
            type: "text",
            text: `Switched current target to: ${hostname}`,
          },
        ],
      };
    }
  );

  server.tool(
    "switch_user",
    "Set a user credential as the current user (updates $USER, $PASS, etc.)",
    {
      login: z.string().describe("Login identifier of the user to switch to"),
    },
    async ({ login }) => {
      await bridge.switchUser(login);
      return {
        content: [
          {
            type: "text",
            text: `Switched current user to: ${login}`,
          },
        ],
      };
    }
  );

  server.tool(
    "run_command",
    "Execute a shell command in the VS Code integrated terminal",
    {
      command: z.string().describe("The shell command to execute"),
      terminal_name: z
        .string()
        .optional()
        .describe("Name for the terminal (default: 'weapon')"),
    },
    async ({ command, terminal_name }) => {
      await bridge.runCommand(command, terminal_name);
      return {
        content: [
          {
            type: "text",
            text: `Command sent to terminal: ${command}`,
          },
        ],
      };
    }
  );

  server.tool(
    "run_scanner",
    "Run a configured scanner against a target",
    {
      scanner: z
        .string()
        .describe(
          "Scanner name (e.g., 'rustscan', 'nuclei', 'feroxbuster')"
        ),
      target: z
        .string()
        .optional()
        .describe("Target override (default: current $TARGET)"),
    },
    async ({ scanner, target }) => {
      await bridge.runScanner(scanner, target);
      return {
        content: [
          {
            type: "text",
            text: `Scanner '${scanner}' started against ${target || "$TARGET"}`,
          },
        ],
      };
    }
  );

  server.tool(
    "create_finding",
    "Create a new finding note in the Foam knowledge base",
    {
      name: z
        .string()
        .describe("Finding name (used as filename, e.g., 'sqli-login')"),
      title: z.string().describe("Human-readable finding title"),
      severity: z
        .enum(["critical", "high", "medium", "low", "info"])
        .describe("Finding severity"),
      description: z.string().describe("Finding description (markdown)"),
      evidence: z
        .string()
        .optional()
        .describe("Evidence/proof (markdown, e.g., command output)"),
      affected_host: z
        .string()
        .optional()
        .describe("Hostname of the affected host (creates a wikilink)"),
    },
    async ({ name, title, severity, description, evidence, affected_host }) => {
      const path = await bridge.createFinding({
        name,
        title,
        severity,
        description,
        evidence,
        affected_host,
      });
      return {
        content: [
          {
            type: "text",
            text: `Finding created: ${path}`,
          },
        ],
      };
    }
  );

  server.tool(
    "generate_report",
    "Generate the full engagement report (attack path analysis)",
    {},
    async () => {
      const reportPath = await bridge.generateReport();
      return {
        content: [
          {
            type: "text",
            text: `Report generated: ${reportPath}`,
          },
        ],
      };
    }
  );

  server.tool(
    "decode_text",
    "Decode encoded text using CyberChef Magic",
    {
      text: z.string().describe("The encoded text to decode"),
    },
    async ({ text }) => {
      const decoded = await bridge.decodeText(text);
      return {
        content: [
          {
            type: "text",
            text: decoded,
          },
        ],
      };
    }
  );
}
```

---

## Step 4: Define Prompts

Prompt templates help AI tools use the server effectively.

```typescript
// src/features/ai/mcp/prompts.ts

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer) {
  server.prompt(
    "analyze-output",
    "Analyze tool output (nmap, BloodHound, etc.) in the context of the current engagement",
    {
      tool_name: z
        .string()
        .describe("Name of the tool that produced the output (e.g., nmap, bloodhound)"),
      output: z.string().describe("The tool output to analyze"),
    },
    async ({ tool_name, output }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `You are a penetration testing assistant. Analyze the following ${tool_name} output.\n\n` +
                `First, call the 'get_targets' tool to understand the current engagement state.\n\n` +
                `Then analyze this output:\n\`\`\`\n${output}\n\`\`\`\n\n` +
                `Provide:\n` +
                `1. Key findings (new hosts, services, vulnerabilities)\n` +
                `2. Suggested next actions (with exact commands using $TARGET/$USER vars)\n` +
                `3. Any findings that should be documented (suggest using 'create_finding' tool)`,
            },
          },
        ],
      };
    }
  );

  server.prompt(
    "suggest-next-steps",
    "Suggest next actions based on current engagement state",
    {},
    async () => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `You are a penetration testing assistant.\n\n` +
                `1. Call 'get_targets' to see all known hosts\n` +
                `2. Call 'get_credentials' to see all known credentials\n` +
                `3. Call 'search_notes' with type 'finding' to see what has been found\n\n` +
                `Based on this state, suggest the 5 most impactful next actions.\n` +
                `For each action, provide the exact command and explain the expected outcome.\n` +
                `Prioritize: privilege escalation > lateral movement > enumeration > scanning.`,
            },
          },
        ],
      };
    }
  );

  server.prompt(
    "privesc-check",
    "Check for privilege escalation opportunities on the current target",
    {
      os: z
        .enum(["linux", "windows", "auto"])
        .default("auto")
        .describe("Target operating system"),
    },
    async ({ os }) => {
      const checks =
        os === "linux" || os === "auto"
          ? `Linux checks: sudo -l, find SUID, cron jobs, writable paths, kernel version`
          : "";
      const winChecks =
        os === "windows" || os === "auto"
          ? `Windows checks: whoami /priv, net localgroup administrators, unquoted services, AlwaysInstallElevated`
          : "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `You are a privilege escalation expert.\n\n` +
                `1. Call 'get_targets' to identify the current target\n` +
                `2. Call 'search_notes' for the target host to see existing enumeration\n\n` +
                `Generate a systematic privilege escalation checklist for ${os === "auto" ? "the detected OS" : os}.\n` +
                `${checks}\n${winChecks}\n\n` +
                `For each check, provide the exact command using 'run_command' tool.\n` +
                `After each command, analyze the output for escalation opportunities.`,
            },
          },
        ],
      };
    }
  );
}
```

---

## Step 5: State Bridge

The State Bridge reads extension state from the filesystem (workspace markdown files).

```typescript
// src/features/ai/mcp/state-bridge.ts

import * as fs from "fs";
import * as path from "path";
import { parse as parseYaml } from "yaml";
import { extractYamlBlocksByIdentity } from "../../../core/markdown/yamlBlocks";

/**
 * StateBridge reads the extension's state from the workspace filesystem.
 * This allows the MCP server (a separate process) to access the same data
 * that the VS Code extension manages.
 *
 * The workspace root is passed via WEAPONIZED_WORKSPACE env var.
 */
export class StateBridge {
  private workspaceRoot: string;

  constructor() {
    this.workspaceRoot = process.env.WEAPONIZED_WORKSPACE || process.cwd();
  }

  async getHosts(): Promise<any[]> {
    return this.parseMarkdownTargets("host");
  }

  async getUsers(): Promise<any[]> {
    return this.parseMarkdownTargets("credentials");
  }

  async getEnvironmentVariables(): Promise<Record<string, string>> {
    // Read from VS Code settings
    const settingsPath = path.join(
      this.workspaceRoot,
      ".vscode",
      "settings.json"
    );
    if (!fs.existsSync(settingsPath)) return {};

    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    const envs = settings["weaponized.envs"] || {};
    const userVars = settings["weaponized.user_vars"] || {};

    return { ...envs, ...userVars };
  }

  async getTerminalLogs(): Promise<string> {
    const logPath = path.join(
      this.workspaceRoot,
      ".vscode",
      ".terminal.log"
    );
    if (!fs.existsSync(logPath)) return "No terminal logs found.";
    return fs.readFileSync(logPath, "utf-8");
  }

  async searchNotes(
    query: string,
    type: string
  ): Promise<{ path: string; title: string; type: string }[]> {
    const results: { path: string; title: string; type: string }[] = [];
    const dirs = ["hosts", "users", "services", "findings", "notes"];

    for (const dir of dirs) {
      const dirPath = path.join(this.workspaceRoot, dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = this.walkDir(dirPath, ".md");
      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        const frontmatter = this.parseFrontmatter(content);
        const noteType = frontmatter?.type || dir.replace(/s$/, "");

        if (type !== "all" && noteType !== type) continue;

        const title = frontmatter?.title || path.basename(file, ".md");
        if (
          title.toLowerCase().includes(query.toLowerCase()) ||
          content.toLowerCase().includes(query.toLowerCase())
        ) {
          results.push({
            path: path.relative(this.workspaceRoot, file),
            title,
            type: noteType,
          });
        }
      }
    }

    return results;
  }

  async getNoteContent(relativePath: string): Promise<string> {
    const fullPath = path.join(this.workspaceRoot, relativePath);
    if (!fs.existsSync(fullPath)) return `Note not found: ${relativePath}`;
    return fs.readFileSync(fullPath, "utf-8");
  }

  async switchHost(hostname: string): Promise<void> {
    // Rewrite YAML blocks in all markdown files
    // Same logic as switchActiveHost command
    const files = this.walkDir(this.workspaceRoot, ".md");
    for (const file of files) {
      let content = fs.readFileSync(file, "utf-8");
      const blocks = extractYamlBlocksByIdentity(content, "host");
      let modified = false;

      for (const block of blocks.reverse()) {
        const parsed = parseYaml(block.content);
        if (parsed?.hostname === hostname) {
          parsed.is_current = true;
          modified = true;
        } else if (parsed?.is_current) {
          parsed.is_current = false;
          modified = true;
        }

        if (modified) {
          // Replace block content
          const lines = content.split("\n");
          const newYaml = require("yaml").stringify(parsed).trimEnd();
          lines.splice(
            block.startLine + 1,
            block.endLine - block.startLine - 1,
            newYaml
          );
          content = lines.join("\n");
        }
      }

      if (modified) {
        fs.writeFileSync(file, content, "utf-8");
      }
    }
  }

  async switchUser(login: string): Promise<void> {
    // Similar to switchHost but for credentials blocks
    // Implementation follows the same pattern
  }

  async runCommand(
    command: string,
    _terminalName?: string
  ): Promise<void> {
    // For the standalone MCP server, we can't directly access VS Code terminals.
    // Options:
    // 1. Write to a command queue file that the extension watches
    // 2. Use VS Code's extension-to-extension IPC
    // 3. Execute locally via child_process (less ideal)
    const queuePath = path.join(
      this.workspaceRoot,
      ".vscode",
      ".mcp-command-queue.json"
    );
    const queue = fs.existsSync(queuePath)
      ? JSON.parse(fs.readFileSync(queuePath, "utf-8"))
      : [];
    queue.push({
      command,
      terminalName: _terminalName || "weapon-mcp",
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
  }

  async runScanner(scanner: string, target?: string): Promise<void> {
    // Read scanner config from .vscode/settings.json
    const settingsPath = path.join(
      this.workspaceRoot,
      ".vscode",
      "settings.json"
    );
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    const scanners = settings["weaponized.scanners"] || {};
    const cmd = scanners[scanner];
    if (!cmd) throw new Error(`Unknown scanner: ${scanner}`);

    const finalCmd = target ? cmd.replace(/\$TARGET/g, target) : cmd;
    await this.runCommand(finalCmd, `scan-${scanner}`);
  }

  async createFinding(finding: {
    name: string;
    title: string;
    severity: string;
    description: string;
    evidence?: string;
    affected_host?: string;
  }): Promise<string> {
    const findingsDir = path.join(this.workspaceRoot, "findings");
    if (!fs.existsSync(findingsDir)) {
      fs.mkdirSync(findingsDir, { recursive: true });
    }

    const filePath = path.join(findingsDir, `${finding.name}.md`);
    const hostLink = finding.affected_host
      ? `\n## Affected Host\n\n[[${finding.affected_host}]]\n`
      : "";

    const content =
      `---\ntype: finding\ntitle: "${finding.title}"\nseverity: ${finding.severity}\ndate: ${new Date().toISOString().split("T")[0]}\n---\n\n` +
      `# ${finding.title}\n\n` +
      `**Severity:** ${finding.severity}\n\n` +
      `## Description\n\n${finding.description}\n` +
      (finding.evidence
        ? `\n## Evidence\n\n\`\`\`\n${finding.evidence}\n\`\`\`\n`
        : "") +
      hostLink;

    fs.writeFileSync(filePath, content);
    return path.relative(this.workspaceRoot, filePath);
  }

  async getAttackGraph(): Promise<string> {
    // Read the most recent report file if it exists
    const reportsDir = path.join(this.workspaceRoot, "reports");
    if (!fs.existsSync(reportsDir)) return "No reports generated yet.";

    const reports = fs
      .readdirSync(reportsDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();

    if (reports.length === 0) return "No reports generated yet.";

    return fs.readFileSync(path.join(reportsDir, reports[0]), "utf-8");
  }

  async generateReport(): Promise<string> {
    // Trigger report generation via command queue
    await this.runCommand("weapon.note.creation --type report");
    return "reports/";
  }

  async decodeText(text: string): Promise<string> {
    // Use CyberChef API or local decoding
    const b64 = Buffer.from(text).toString("base64");
    return `CyberChef Magic URL: https://gchq.github.io/CyberChef/#recipe=Magic(5,false,false,'')&input=${b64}`;
  }

  // --- Helpers ---

  private parseMarkdownTargets(identity: string): any[] {
    const results: any[] = [];
    const dirs = ["hosts", "users", "services"];

    for (const dir of dirs) {
      const dirPath = path.join(this.workspaceRoot, dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = this.walkDir(dirPath, ".md");
      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        const blocks = extractYamlBlocksByIdentity(content, identity);
        for (const block of blocks) {
          try {
            const parsed = parseYaml(block.content);
            if (parsed) results.push(parsed);
          } catch {
            // Skip invalid YAML
          }
        }
      }
    }

    return results;
  }

  private walkDir(dir: string, ext: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.walkDir(fullPath, ext));
      } else if (entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }

    return results;
  }

  private parseFrontmatter(
    content: string
  ): Record<string, any> | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    try {
      return parseYaml(match[1]);
    } catch {
      return null;
    }
  }
}
```

---

## Step 6: Build Configuration

Add a separate webpack entry for the MCP server:

```javascript
// webpack.config.mcp.js

const path = require("path");

module.exports = {
  target: "node",
  mode: "none",
  entry: "./src/mcp-server.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "mcp-server.js",
    libraryTarget: "commonjs2",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: "ts-loader",
      },
    ],
  },
  // Do NOT externalize vscode — the MCP server doesn't use it
};
```

Add build script:

```jsonc
// package.json scripts
{
  "compile:mcp": "webpack --config webpack.config.mcp.js",
  "package:mcp": "webpack --config webpack.config.mcp.js --mode production"
}
```

---

## Step 7: Client Configuration

### Claude Code (`.claude/settings.json` or `mcp_servers` in project)

```jsonc
{
  "mcpServers": {
    "weaponized": {
      "command": "node",
      "args": ["<path-to-extension>/dist/mcp-server.js"],
      "env": {
        "WEAPONIZED_WORKSPACE": "/path/to/engagement/workspace"
      }
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```jsonc
{
  "mcpServers": {
    "weaponized": {
      "command": "node",
      "args": ["<path-to-extension>/dist/mcp-server.js"],
      "env": {
        "WEAPONIZED_WORKSPACE": "/path/to/engagement/workspace"
      }
    }
  }
}
```

### VS Code MCP (settings.json)

VS Code 1.99+ has built-in MCP support:

```jsonc
{
  "mcp": {
    "servers": {
      "weaponized": {
        "command": "node",
        "args": ["${extensionInstallPath}/dist/mcp-server.js"],
        "env": {
          "WEAPONIZED_WORKSPACE": "${workspaceFolder}"
        }
      }
    }
  }
}
```

---

## Option B: In-Extension MCP via VS Code API (Future)

VS Code is adding native MCP server support for extensions via `vscode.lm.registerTool()`. When stable, this is the preferred approach:

```typescript
// Future API (experimental as of VS Code 1.99)
vscode.lm.registerTool("weapon_get_targets", {
  // Tool is automatically available to Copilot and any MCP client
  // connected to VS Code's built-in MCP proxy
});
```

This eliminates the need for a separate process. Monitor the VS Code release notes for when this API stabilizes.

---

## Security Model

| Action | Risk | Mitigation |
|--------|------|------------|
| Read hosts | Low | Always allowed |
| Read credentials | Medium | Redacted in resources; full access via tool (logged) |
| Run command | High | Command queue + user confirmation in extension |
| Run scanner | High | Same as run command |
| Create finding | Low | File creation only |
| Switch target | Low | Modifies markdown files |
| Generate report | Low | Read-only analysis |

The MCP protocol itself supports tool approval in clients — Claude Code, Cursor, etc. will prompt the user before executing tools marked as side-effecting.

---

## Testing the MCP Server

### Manual Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/mcp-server.js
```

This opens a web UI where you can test each tool and resource interactively.

### Integration Testing

```bash
# Set up a test workspace
mkdir -p /tmp/test-engagement/hosts
cat > /tmp/test-engagement/hosts/dc01.md << 'EOF'
```yaml host
hostname: dc01.corp.local
ip: 10.10.10.100
is_dc: true
is_current: true
```
EOF

# Run the MCP server against it
WEAPONIZED_WORKSPACE=/tmp/test-engagement node dist/mcp-server.js
```
