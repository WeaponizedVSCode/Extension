import * as http from "http";
import * as net from "net";
import * as vscode from "vscode";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { Context } from "../../platform/vscode/context";
import { logger } from "../../platform/vscode/logger";
import type { TerminalBridge } from "../terminal/bridge";
import { Host, dumpHosts } from "../../core/domain/host";
import type { HostDumpFormat } from "../../core/domain/host";
import { UserCredential, dumpUserCredentials } from "../../core/domain/user";
import type { UserDumpFormat } from "../../core/domain/user";
import { buildRelationshipGraph } from "../targets/sync/graphBuilder";
import type { Finding } from "../../core/domain/finding";
import { parseFindingNote, generateFindingMarkdown, filterFindings } from "../../core/domain/finding";
import { buildEngagementSummary } from "../../core/domain/engagement";
import { findAvailablePort } from "./portManager";

function updateFrontmatter(content: string, updates: Record<string, string | undefined>): string {
  const fmMatch = content.match(/^(---\s*\n)([\s\S]*?)(\n---)/);
  if (!fmMatch) {
    // No frontmatter — prepend one
    const lines: string[] = [];
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) {
        lines.push(`${k}: ${v}`);
      }
    }
    return `---\n${lines.join("\n")}\n---\n${content}`;
  }
  let fm = fmMatch[2];
  const applied = new Set<string>();
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }
    const re = new RegExp(`^(${key}:\\s*)(.*)$`, "m");
    if (re.test(fm)) {
      fm = fm.replace(re, `${key}: ${value}`);
    } else {
      fm += `\n${key}: ${value}`;
    }
    applied.add(key);
  }
  return content.replace(fmMatch[0], `${fmMatch[1]}${fm}${fmMatch[3]}`);
}

export class EmbeddedMcpServer {
  private httpServer: http.Server | undefined;
  private port = 0;

  getPort(): number {
    return this.port;
  }

  async start(terminalBridge: TerminalBridge, preferredPort: number): Promise<number> {
    const listenPort = await findAvailablePort(preferredPort);

    // SDK v1.29+ stateless mode requires a fresh transport per request.
    const self = this;
    const handleWithFreshTransport = async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const server = new McpServer({ name: "weaponized-vscode", version: "1.0.0" });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      self.registerResources(server);
      self.registerTools(server, terminalBridge);
      self.registerPrompts(server);
      await server.connect(transport);
      await transport.handleRequest(req, res);
      await transport.close();
      await server.close();
    };

    this.httpServer = http.createServer(async (req, res) => {
      if (req.url !== "/mcp") {
        res.writeHead(404).end();
        return;
      }
      try {
        await handleWithFreshTransport(req, res);
      } catch (err) {
        logger.warn(`MCP request error: ${err}`);
        if (!res.headersSent) {
          res.writeHead(500).end();
        }
      }
    });

    return new Promise((resolve, reject) => {
      this.httpServer!.listen(listenPort, "127.0.0.1", () => {
        this.port = (this.httpServer!.address() as net.AddressInfo).port;
        logger.info(`Embedded MCP server listening on http://127.0.0.1:${this.port}/mcp`);
        resolve(this.port);
      });
      this.httpServer!.on("error", reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.httpServer) {
        this.httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private registerResources(server: McpServer): void {
    server.resource("hosts-list", "hosts://list", async () => ({
      contents: [{
        uri: "hosts://list",
        mimeType: "application/json",
        text: JSON.stringify(Context.HostState ?? [], null, 2),
      }],
    }));

    server.resource("hosts-current", "hosts://current", async () => ({
      contents: [{
        uri: "hosts://current",
        mimeType: "application/json",
        text: JSON.stringify(Context.HostState?.find((h) => h.is_current) ?? null, null, 2),
      }],
    }));

    server.resource("users-list", "users://list", async () => ({
      contents: [{
        uri: "users://list",
        mimeType: "application/json",
        text: JSON.stringify(Context.UserState ?? [], null, 2),
      }],
    }));

    server.resource("users-current", "users://current", async () => ({
      contents: [{
        uri: "users://current",
        mimeType: "application/json",
        text: JSON.stringify(Context.UserState?.find((u) => u.is_current) ?? null, null, 2),
      }],
    }));

    server.resource("graph-relationships", "graph://relationships", async () => {
      const graph = await this.buildGraph();
      return {
        contents: [{
          uri: "graph://relationships",
          mimeType: "application/json",
          text: JSON.stringify(graph, null, 2),
        }],
      };
    });

    server.resource("findings-list", "findings://list", async () => {
      const findings = await this.getFindings();
      return {
        contents: [{
          uri: "findings://list",
          mimeType: "application/json",
          text: JSON.stringify(findings, null, 2),
        }],
      };
    });

    server.resource("engagement-summary", "engagement://summary", async () => {
      const hosts = Context.HostState ?? [];
      const users = Context.UserState ?? [];
      const findings = await this.getFindings();
      const graph = await this.buildGraph();
      const summary = buildEngagementSummary({ hosts, users, findings, graph });
      return {
        contents: [{
          uri: "engagement://summary",
          mimeType: "application/json",
          text: JSON.stringify(summary, null, 2),
        }],
      };
    });
  }

  private registerTools(server: McpServer, bridge: TerminalBridge): void {
    server.tool("get_targets", "Get all discovered hosts/targets", {}, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify(Context.HostState ?? [], null, 2) }],
    }));

    server.tool("get_credentials", "Get all discovered credentials", {}, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify(Context.UserState ?? [], null, 2) }],
    }));

    server.tool(
      "get_hosts_formatted",
      "Get hosts formatted for direct use in commands or configs",
      {
        format: z.enum(["env", "hosts", "yaml", "table"]).describe(
          "Output format: env (export shell vars), hosts (/etc/hosts format), yaml, table"
        ),
      },
      async ({ format }) => {
        const hosts = (Context.HostState ?? []).map((h) => new Host().init(h));
        return { content: [{ type: "text" as const, text: dumpHosts(hosts, format as HostDumpFormat) }] };
      }
    );

    server.tool(
      "get_credentials_formatted",
      "Get credentials formatted for direct use with pentest tools",
      {
        format: z.enum(["env", "impacket", "nxc", "yaml", "table"]).describe(
          "Output format: env (export shell vars), impacket (domain/user:pass), nxc (NetExec -u -p flags), yaml, table"
        ),
      },
      async ({ format }) => {
        const users = (Context.UserState ?? []).map((u) => new UserCredential().init(u));
        return { content: [{ type: "text" as const, text: dumpUserCredentials(users, format as UserDumpFormat) }] };
      }
    );

    server.tool("get_graph", "Get full relationship graph — nodes, edges, attack path, and Mermaid diagram", {}, async () => {
      const graph = await this.buildGraph();
      if (!graph) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No graph data available. Foam may not be initialized." }) }] };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(graph, null, 2) }] };
    });


    server.tool(
      "list_findings",
      "List or search findings. Filter by severity, tags, or free-text query matching title/description.",
      {
        severity: z.enum(["critical", "high", "medium", "low", "info"]).optional().describe("Filter by severity level"),
        tags: z.array(z.string()).optional().describe("Filter by tags (returns findings matching ANY of the given tags)"),
        query: z.string().optional().describe("Free-text search in title and description"),
      },
      async ({ severity, tags, query }) => {
        let findings = await this.getFindings();
        if (severity || tags?.length || query) {
          findings = filterFindings(findings, { severity, tags, query });
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(findings, null, 2) }] };
      }
    );

    server.tool(
      "get_finding",
      "Get a specific finding by ID",
      { id: z.string().describe("Finding ID (note filename)") },
      async ({ id }) => {
        const findings = await this.getFindings();
        const finding = findings.find((f) => f.id === id);
        if (!finding) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Finding '${id}' not found` }) }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(finding, null, 2) }] };
      }
    );

    server.tool(
      "create_finding",
      "Create a new finding note with YAML frontmatter (title, severity, tags, description)",
      {
        title: z.string().describe("Finding title (also used as filename)"),
        severity: z.enum(["critical", "high", "medium", "low", "info"]).optional().describe("Severity level (default: info)"),
        tags: z.array(z.string()).optional().describe("Tags for categorization (e.g. ['sqli', 'web', 'owasp'])"),
        description: z.string().optional().describe("Description of the finding"),
        references: z.string().optional().describe("References or links"),
      },
      async ({ title, severity, tags, description, references }) => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No workspace folder open" }) }] };
        }
        const safeName = title.replace(/[^a-zA-Z0-9-_]/g, "_");
        const uri = vscode.Uri.joinPath(folders[0].uri, "findings", safeName, `${safeName}.md`);
        const md = generateFindingMarkdown({ title, severity, tags, description, references });
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(md));
        return { content: [{ type: "text" as const, text: JSON.stringify({ created: uri.fsPath, title, severity: severity ?? "info", tags: tags ?? [] }) }] };
      }
    );

    server.tool(
      "update_finding_frontmatter",
      "Update a finding note's YAML frontmatter fields (severity, description, or custom properties)",
      {
        id: z.string().describe("Finding ID (note filename)"),
        severity: z.enum(["critical", "high", "medium", "low", "info"]).optional().describe("New severity level"),
        description: z.string().optional().describe("New description to set in frontmatter"),
        props: z.record(z.string(), z.string()).optional().describe("Additional YAML frontmatter key-value pairs to set"),
      },
      async ({ id, severity, description, props }) => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No workspace folder open" }) }] };
        }
        const uri = vscode.Uri.joinPath(folders[0].uri, "findings", id, `${id}.md`);
        let content: string;
        try {
          const raw = await vscode.workspace.fs.readFile(uri);
          content = new TextDecoder().decode(raw);
        } catch {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Finding note '${id}' not found at ${uri.fsPath}` }) }] };
        }
        content = updateFrontmatter(content, { severity, description, ...props });
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
        return { content: [{ type: "text" as const, text: JSON.stringify({ updated: id, path: uri.fsPath }) }] };
      }
    );

    server.tool("list_terminals", "List all open VS Code terminals", {}, async () => ({
      content: [{ type: "text" as const, text: JSON.stringify(bridge.getTerminals(), null, 2) }],
    }));

    server.tool(
      "read_terminal",
      "Read recent output from a VS Code terminal",
      {
        terminalId: z.string().describe("Terminal ID or name"),
        lines: z.number().optional().describe("Number of trailing lines to return (default: 50)"),
      },
      async ({ terminalId, lines }) => ({
        content: [{ type: "text" as const, text: await bridge.getTerminalOutput(terminalId, lines ?? 50) }],
      })
    );

    server.tool(
      "send_to_terminal",
      "Send a command to a VS Code terminal",
      {
        terminalId: z.string().describe("Terminal ID or name"),
        command: z.string().describe("Command to execute"),
      },
      async ({ terminalId, command }) => {
        const ok = bridge.sendCommandDirect(terminalId, command);
        return {
          content: [{ type: "text" as const, text: ok ? `Command sent to terminal ${terminalId}: ${command}` : `Terminal ${terminalId} not found` }],
        };
      }
    );

    server.tool(
      "create_terminal",
      "Create a new VS Code terminal. Use 'profile' to launch a pre-configured handler (netcat, msfconsole, meterpreter, web-delivery) or omit it for a plain shell.",
      {
        profile: z.enum(["netcat handler", "msfconsole", "meterpreter handler", "web delivery", "shell"]).optional().describe(
          "Terminal profile to use. Available profiles: netcat (reverse shell listener), msfconsole (Metasploit console), meterpreter (Meterpreter handler), web-delivery (HTTP file server), shell (plain terminal)"
        ),
        name: z.string().optional().describe("Custom terminal name (only used when profile is 'shell' or omitted)"),
        cwd: z.string().optional().describe("Working directory for the terminal"),
      },
      async ({ profile, name, cwd }) => {
        const effectiveProfile = profile === "shell" ? undefined : profile;
        const result = bridge.createTerminal({ name, profile: effectiveProfile, cwd });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ created: true, id: result.id, name: result.name, profile: profile ?? "shell" }) }],
        };
      }
    );

    server.tool(
      "get_engagement_summary",
      "Get a comprehensive summary of the current penetration testing engagement in one call. Returns: all hosts, credentials, findings with their wiki-link associations (which hosts/users/findings each finding connects to), per-host and per-user finding breakdowns, orphan findings, relationship graph with attack path, and computed statistics. Use this as your first call to understand the full engagement state.",
      {},
      async () => {
        const hosts = Context.HostState ?? [];
        const users = Context.UserState ?? [];
        const findings = await this.getFindings();
        const graph = await this.buildGraph();
        const summary = buildEngagementSummary({ hosts, users, findings, graph });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
        };
      }
    );
  }

  private registerPrompts(server: McpServer): void {
    server.prompt(
      "analyze-output",
      "Analyze tool output and identify findings",
      { output: z.string() },
      async ({ output }) => ({
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `You are a penetration testing assistant. Analyze the following tool output:\n\n${output}\n\n` +
              `Current targets: ${JSON.stringify((Context.HostState ?? []).map((h) => ({ hostname: h.hostname, ip: h.ip })))}\n\n` +
              `Provide: 1) Key findings 2) Recommended next steps 3) Commands to run`,
          },
        }],
      })
    );

    server.prompt(
      "suggest-next-steps",
      "Suggest next pentest actions based on current state",
      async () => ({
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `You are a penetration testing assistant. Based on the current engagement state:\n\n` +
              `Hosts: ${JSON.stringify((Context.HostState ?? []).map((h) => ({ hostname: h.hostname, ip: h.ip, is_dc: h.is_dc })))}\n` +
              `Users: ${JSON.stringify((Context.UserState ?? []).map((u) => ({ user: u.user, login: u.login, password: u.password, nt_hash: u.nt_hash })))}\n\n` +
              `Suggest the next 3-5 actions with exact commands.`,
          },
        }],
      })
    );

    server.prompt(
      "analyze-engagement",
      "Analyze the full engagement — findings, associations, attack chains — and identify gaps",
      async () => {
        const hosts = Context.HostState ?? [];
        const users = Context.UserState ?? [];
        const findings = await this.getFindings();
        const graph = await this.buildGraph();
        const summary = buildEngagementSummary({ hosts, users, findings, graph });
        return {
          messages: [{
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `You are a penetration testing assistant. Analyze the current engagement and provide strategic guidance.\n\n` +
                `Engagement Summary:\n${JSON.stringify(summary, null, 2)}\n\n` +
                `Provide:\n` +
                `1) Overall assessment — what phase is the engagement in (recon/scanning/exploitation/post-exploitation)?\n` +
                `2) Key findings and their combined impact — look at findingAssociations to see what chains together\n` +
                `3) Attack chains — which findings link to other findings? What is the full exploitation path?\n` +
                `4) Coverage gaps — which hosts have no findings? Which users have no associated findings?\n` +
                `5) Recommended next 3-5 actions with exact commands`,
            },
          }],
        };
      }
    );
  }

  private async buildGraph() {
    try {
      const foam = await Context.Foam();
      if (foam?.graph && foam?.workspace) {
        return buildRelationshipGraph(foam);
      }
    } catch {
      // Foam not available
    }
    return null;
  }

  private async getFindings(): Promise<Finding[]> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return [];
    }
    try {
      const pattern = new vscode.RelativePattern(folders[0], "findings/{*.md,*/*.md}");
      const files = await vscode.workspace.findFiles(pattern);
      const findings: Finding[] = [];
      for (const file of files) {
        const raw = await vscode.workspace.fs.readFile(file);
        const content = new TextDecoder().decode(raw);
        // Check it's actually a finding type note
        if (!content.match(/^type:\s*finding/m)) {
          continue;
        }
        const basename = file.path.split("/").pop()?.replace(/\.md$/, "") ?? file.path;
        findings.push(parseFindingNote(basename, content));
      }
      return findings;
    } catch {
      return [];
    }
  }
}
