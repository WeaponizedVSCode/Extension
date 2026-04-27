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
import { generateFindingMarkdown } from "../../core/domain/finding";
import { buildEngagementSummary } from "../../core/domain/engagement";
import { findAvailablePort } from "./portManager";
import { FindingMap } from "./findingMap";

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

/** Replace or append the body of a `#### <section>` markdown heading. */
function updateSection(content: string, section: string, newBody: string): string {
  const header = `#### ${section}`;
  const headerRe = new RegExp(`^${header}\\s*$`, "im");
  const match = headerRe.exec(content);
  if (match) {
    // Find end of this section (next #### or EOF)
    const afterHeader = match.index + match[0].length;
    const nextHeader = content.slice(afterHeader).search(/^####\s+/m);
    const sectionEnd = nextHeader !== -1 ? afterHeader + nextHeader : content.length;
    return content.slice(0, afterHeader) + `\n\n${newBody}\n\n` + content.slice(sectionEnd);
  }
  // Section doesn't exist — append it
  return content.trimEnd() + `\n\n${header}\n\n${newBody}\n`;
}

export class EmbeddedMcpServer {
  private httpServer: http.Server | undefined;
  private port = 0;
  private findingMap = new FindingMap();

  getPort(): number {
    return this.port;
  }

  async start(terminalBridge: TerminalBridge, preferredPort: number): Promise<number> {
    const listenPort = await findAvailablePort(preferredPort);
    await this.findingMap.activate();

    // SDK v1.29+ stateless mode requires a fresh transport per request.
    const self = this;
    const handleWithFreshTransport = async (req: http.IncomingMessage, res: http.ServerResponse) => {
      logger.debug(`MCP: handling ${req.method} request`);
      const server = new McpServer({ name: "weaponized-vscode", version: "1.0.0" });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      self.registerResources(server);
      self.registerTools(server, terminalBridge);
      self.registerPrompts(server);
      await server.connect(transport);
      await transport.handleRequest(req, res);
      await transport.close();
      await server.close();
      logger.debug("MCP: request handled successfully");
    };

    this.httpServer = http.createServer(async (req, res) => {
      if (req.url !== "/mcp") {
        logger.debug(`MCP: rejected non-MCP request to ${req.url}`);
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
    logger.info("MCP server shutting down");
    this.findingMap.dispose();
    return new Promise((resolve) => {
      if (this.httpServer) {
        this.httpServer.close(() => {
          logger.debug("MCP server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private registerResources(server: McpServer): void {
    server.resource("hosts-list", "hosts://list", async () => {
      logger.debug("MCP resource: hosts-list");
      return { contents: [{
        uri: "hosts://list",
        mimeType: "application/json",
        text: JSON.stringify(Context.HostState ?? [], null, 2),
      }] };
    });

    server.resource("hosts-current", "hosts://current", async () => {
      logger.debug("MCP resource: hosts-current");
      return { contents: [{
        uri: "hosts://current",
        mimeType: "application/json",
        text: JSON.stringify(Context.HostState?.find((h) => h.is_current) ?? null, null, 2),
      }] };
    });

    server.resource("users-list", "users://list", async () => {
      logger.debug("MCP resource: users-list");
      return { contents: [{
        uri: "users://list",
        mimeType: "application/json",
        text: JSON.stringify(Context.UserState ?? [], null, 2),
      }] };
    });

    server.resource("users-current", "users://current", async () => {
      logger.debug("MCP resource: users-current");
      return { contents: [{
        uri: "users://current",
        mimeType: "application/json",
        text: JSON.stringify(Context.UserState?.find((u) => u.is_current) ?? null, null, 2),
      }] };
    });

    server.resource("graph-relationships", "graph://relationships", async () => {
      logger.debug("MCP resource: graph-relationships");
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
      logger.debug("MCP resource: findings-list");
      const findings = this.findingMap.getAll();
      return {
        contents: [{
          uri: "findings://list",
          mimeType: "application/json",
          text: JSON.stringify(findings, null, 2),
        }],
      };
    });

    server.resource("engagement-summary", "engagement://summary", async () => {
      logger.debug("MCP resource: engagement-summary");
      const summary = await this.buildSummary();
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
    server.tool("get_targets", "Get all discovered hosts/targets", {}, async () => {
      logger.debug("MCP tool: get_targets");
      return { content: [{ type: "text" as const, text: JSON.stringify(Context.HostState ?? [], null, 2) }] };
    });

    server.tool("get_credentials", "Get all discovered credentials", {}, async () => {
      logger.debug("MCP tool: get_credentials");
      return { content: [{ type: "text" as const, text: JSON.stringify(Context.UserState ?? [], null, 2) }] };
    });

    server.tool(
      "get_hosts_formatted",
      "Get hosts formatted for direct use in commands or configs",
      {
        format: z.enum(["env", "hosts", "yaml", "table"]).describe(
          "Output format: env (export shell vars), hosts (/etc/hosts format), yaml, table"
        ),
      },
      async ({ format }) => {
        logger.debug(`MCP tool: get_hosts_formatted (format=${format})`);
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
        logger.debug(`MCP tool: get_credentials_formatted (format=${format})`);
        const users = (Context.UserState ?? []).map((u) => new UserCredential().init(u));
        return { content: [{ type: "text" as const, text: dumpUserCredentials(users, format as UserDumpFormat) }] };
      }
    );

    server.tool("get_graph", "Get full relationship graph — nodes, edges, attack path, and Mermaid diagram", {}, async () => {
      logger.debug("MCP tool: get_graph");
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
        logger.debug(`MCP tool: list_findings (severity=${severity}, tags=${tags?.join(",")}, query=${query})`);
        const findings = (severity || tags?.length || query)
          ? this.findingMap.filter({ severity, tags, query })
          : this.findingMap.getAll();
        return { content: [{ type: "text" as const, text: JSON.stringify(findings, null, 2) }] };
      }
    );

    server.tool(
      "get_finding",
      "Get a specific finding by ID",
      { id: z.string().describe("Finding ID (note filename)") },
      async ({ id }) => {
        logger.debug(`MCP tool: get_finding (id=${id})`);
        const finding = this.findingMap.getById(id);
        if (!finding) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Finding '${id}' not found` }) }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(finding, null, 2) }] };
      }
    );

    server.tool(
      "create_finding",
      "Create a new finding note as a markdown file in the workspace. Pass the full finding content here — title, severity, tags, description, and references are written into the file's YAML frontmatter and body. The file is immediately available to Foam and will appear in get_engagement_summary. To read it back, use get_finding with the returned ID.",
      {
        title: z.string().describe("Finding title (also used as filename)"),
        severity: z.enum(["critical", "high", "medium", "low", "info"]).optional().describe("Severity level (default: info)"),
        tags: z.array(z.string()).optional().describe("Tags for categorization (e.g. ['sqli', 'web', 'owasp'])"),
        description: z.string().optional().describe("Description of the finding"),
        references: z.string().optional().describe("References or links"),
      },
      async ({ title, severity, tags, description, references }) => {
        logger.debug(`MCP tool: create_finding (title=${title}, severity=${severity ?? "info"})`);
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
      "Update a finding note's YAML frontmatter fields (severity, custom properties) and/or markdown body sections (description, references)",
      {
        id: z.string().describe("Finding ID (note filename)"),
        severity: z.enum(["critical", "high", "medium", "low", "info"]).optional().describe("New severity level"),
        description: z.string().optional().describe("New description (replaces #### description section body)"),
        references: z.string().optional().describe("New references (replaces #### references section body)"),
        props: z.record(z.string(), z.string()).optional().describe("Additional YAML frontmatter key-value pairs to set"),
      },
      async ({ id, severity, description, references, props }) => {
        logger.debug(`MCP tool: update_finding_frontmatter (id=${id})`);
        const uri = this.findingMap.getUri(id);
        if (!uri) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Finding note '${id}' not found` }) }] };
        }
        let content: string;
        try {
          const raw = await vscode.workspace.fs.readFile(uri);
          content = new TextDecoder().decode(raw);
        } catch {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Failed to read finding '${id}'` }) }] };
        }
        // Update YAML frontmatter (severity + custom props only)
        content = updateFrontmatter(content, { severity, ...props });
        // Update markdown body sections
        if (description !== undefined) {
          content = updateSection(content, "description", description);
        }
        if (references !== undefined) {
          content = updateSection(content, "references", references);
        }
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
        return { content: [{ type: "text" as const, text: JSON.stringify({ updated: id, path: uri.fsPath }) }] };
      }
    );

    server.tool("list_terminals", "List all open VS Code terminals", {}, async () => {
      logger.debug("MCP tool: list_terminals");
      return { content: [{ type: "text" as const, text: JSON.stringify(bridge.getTerminals(), null, 2) }] };
    });

    server.tool(
      "read_terminal",
      "Read output from a VS Code terminal. By default returns only the output of the last command (everything after the most recent '$ cmd' prompt marker), with ANSI escape codes stripped. Set last_command_only=false to get a tail of the full session history instead.",
      {
        terminalId: z.string().describe("Terminal ID or name"),
        last_command_only: z.boolean().optional().describe("Return only the output of the last command (default: true). Set false to get a tail of full session history."),
        lines: z.number().optional().describe("Number of trailing lines to return when last_command_only=false (default: 50)"),
      },
      async ({ terminalId, last_command_only, lines }) => {
        const lastOnly = last_command_only ?? true;
        logger.debug(`MCP tool: read_terminal (id=${terminalId}, last_command_only=${lastOnly})`);
        return { content: [{ type: "text" as const, text: await bridge.getTerminalOutput(terminalId, lines ?? 50, lastOnly) }] };
      }
    );

    server.tool(
      "send_to_terminal",
      "Send a command to a VS Code terminal (fire-and-forget). Returns immediately after dispatching — does not wait for the command to finish or capture output. Use read_terminal afterwards to collect results. This is intentional: long-running commands (listeners, interactive tools) would otherwise block the MCP context indefinitely.",
      {
        terminalId: z.string().describe("Terminal ID or name"),
        command: z.string().describe("Command to execute"),
      },
      async ({ terminalId, command }) => {
        logger.debug(`MCP tool: send_to_terminal (id=${terminalId})`);
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
        profile: z.enum(["netcat", "msfconsole", "meterpreter", "web-delivery", "shell"]).optional().describe(
          "Terminal profile to use. Available profiles: netcat (reverse shell listener), msfconsole (Metasploit console), meterpreter (Meterpreter handler), web-delivery (HTTP file server), shell (plain terminal)"
        ),
        name: z.string().optional().describe("Custom terminal name (only used when profile is 'shell' or omitted)"),
        cwd: z.string().optional().describe("Working directory for the terminal"),
      },
      async ({ profile, name, cwd }) => {
        logger.debug(`MCP tool: create_terminal (profile=${profile ?? "shell"}, name=${name})`);
        const effectiveProfile = profile === "shell" ? undefined : profile;
        const result = bridge.createTerminal({ name, profile: effectiveProfile, cwd });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ created: true, id: result.id, name: result.name, profile: profile ?? "shell" }) }],
        };
      }
    );

    server.tool(
      "get_engagement_summary",
      "Get a comprehensive summary of the current penetration testing engagement. Returns: all hosts, credentials, findings with their wiki-link associations (which hosts/users/findings each finding connects to), per-host and per-user finding breakdowns, orphan findings, and computed statistics. Optionally includes the full relationship graph (nodes, edges, attack path, Mermaid diagram) — omit it when you only need counts and associations to reduce response size. Use this as your first call to understand the full engagement state.",
      {
        include_graph: z.boolean().optional().describe("Include the full relationship graph in the response (default: false). Set to true when you need the Mermaid diagram, attack path, or raw edge data."),
      },
      async ({ include_graph }) => {
        logger.debug(`MCP tool: get_engagement_summary (include_graph=${include_graph ?? false})`);
        const summary = await this.buildSummary();
        const result = include_graph ? summary : { ...summary, graph: undefined };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
    );
  }

  private registerPrompts(server: McpServer): void {
    server.prompt(
      "analyze-output",
      "Analyze tool output and identify findings",
      { output: z.string() },
      async ({ output }) => {
        logger.debug("MCP prompt: analyze-output");
        return {
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
        };
      }
    );

    server.prompt(
      "suggest-next-steps",
      "Suggest next pentest actions based on current state",
      async () => {
        logger.debug("MCP prompt: suggest-next-steps");
        return {
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
        };
      }
    );

    server.prompt(
      "analyze-engagement",
      "Analyze the full engagement — findings, associations, attack chains — and identify gaps",
      async () => {
        logger.debug("MCP prompt: analyze-engagement");
        const summary = await this.buildSummary();
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

  private async buildSummary() {
    const hosts = Context.HostState ?? [];
    const users = Context.UserState ?? [];
    const findings = this.findingMap.getAll();
    const graph = await this.buildGraph();
    return buildEngagementSummary({ hosts, users, findings, graph });
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
}
