import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { StateBridge } from "./bridge";

const workspacePath = process.argv[2] || process.cwd();
const bridge = new StateBridge(workspacePath);

const server = new McpServer({
  name: "weaponized-vscode",
  version: "0.3.0",
});

// --- Resources ---

server.resource("hosts-list", "hosts://list", async () => ({
  contents: [
    {
      uri: "hosts://list",
      mimeType: "application/json",
      text: JSON.stringify(bridge.getHosts(), null, 2),
    },
  ],
}));

server.resource("hosts-current", "hosts://current", async () => ({
  contents: [
    {
      uri: "hosts://current",
      mimeType: "application/json",
      text: JSON.stringify(bridge.getCurrentHost() ?? null, null, 2),
    },
  ],
}));

server.resource("users-list", "users://list", async () => ({
  contents: [
    {
      uri: "users://list",
      mimeType: "application/json",
      text: JSON.stringify(bridge.getUsers(), null, 2),
    },
  ],
}));

server.resource("users-current", "users://current", async () => ({
  contents: [
    {
      uri: "users://current",
      mimeType: "application/json",
      text: JSON.stringify(bridge.getCurrentUser() ?? null, null, 2),
    },
  ],
}));

server.resource("env-variables", "env://variables", async () => ({
  contents: [
    {
      uri: "env://variables",
      mimeType: "application/json",
      text: JSON.stringify(bridge.getEnvVars(), null, 2),
    },
  ],
}));

server.resource("graph-relationships", "graph://relationships", async () => {
  const graph = bridge.getGraph();
  return {
    contents: [
      {
        uri: "graph://relationships",
        mimeType: "application/json",
        text: JSON.stringify(graph, null, 2),
      },
    ],
  };
});

// --- Read-only Tools ---

server.tool("get_targets", "Get all discovered hosts/targets", {}, async () => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(bridge.getHosts(), null, 2),
    },
  ],
}));

server.tool(
  "get_credentials",
  "Get all discovered credentials",
  {},
  async () => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(bridge.getUsers(), null, 2),
      },
    ],
  })
);

server.tool(
  "get_hosts_formatted",
  "Get hosts formatted for direct use in commands or configs",
  {
    format: z
      .enum(["env", "hosts", "yaml", "table"])
      .describe(
        "Output format: env (export shell vars), hosts (/etc/hosts format), yaml, table"
      ),
  },
  async ({ format }) => ({
    content: [
      {
        type: "text" as const,
        text: bridge.getHostsFormatted(format),
      },
    ],
  })
);

server.tool(
  "get_credentials_formatted",
  "Get credentials formatted for direct use with pentest tools",
  {
    format: z
      .enum(["env", "impacket", "nxc", "yaml", "table"])
      .describe(
        "Output format: env (export shell vars), impacket (domain/user:pass), nxc (NetExec -u -p flags), yaml, table"
      ),
  },
  async ({ format }) => ({
    content: [
      {
        type: "text" as const,
        text: bridge.getCredentialsFormatted(format),
      },
    ],
  })
);

// --- Graph Tools ---

server.tool(
  "get_graph",
  "Get full relationship graph — nodes, edges (all/host/user categories), attack path, and Mermaid diagram",
  {},
  async () => {
    const graph = bridge.getGraph();
    if (!graph) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "No graph data available. Foam may not be initialized." }),
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(graph, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get_attack_path",
  "Get the privilege escalation path — ordered list of node IDs representing the longest attack chain",
  {},
  async () => {
    const graph = bridge.getGraph();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(graph?.attackPath ?? [], null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get_mermaid",
  "Get a pre-rendered Mermaid diagram of user relationship edges",
  {},
  async () => {
    const graph = bridge.getGraph();
    return {
      content: [
        {
          type: "text" as const,
          text: graph?.mermaid ?? "graph TD;\n  %% No graph data available",
        },
      ],
    };
  }
);

// --- Terminal Tools ---

server.tool(
  "list_terminals",
  "List all open VS Code terminals",
  {},
  async () => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(bridge.getTerminals(), null, 2),
      },
    ],
  })
);

server.tool(
  "read_terminal",
  "Read recent output from a VS Code terminal",
  {
    terminalId: z.string().describe("Terminal ID or name"),
    lines: z
      .number()
      .optional()
      .describe("Number of trailing lines to return (default: 50)"),
  },
  async ({ terminalId, lines }) => ({
    content: [
      {
        type: "text" as const,
        text: bridge.getTerminalOutput(terminalId, lines ?? 50),
      },
    ],
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
    bridge.sendCommand(terminalId, command);
    return {
      content: [
        {
          type: "text" as const,
          text: `Command sent to terminal ${terminalId}: ${command}`,
        },
      ],
    };
  }
);

// --- Prompt Templates ---

server.prompt(
  "analyze-output",
  "Analyze tool output and identify findings",
  { output: z.string() },
  async ({ output }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text:
            `You are a penetration testing assistant. Analyze the following tool output:\n\n${output}\n\n` +
            `Current targets: ${JSON.stringify(bridge.getHosts().map((h) => ({ hostname: h.hostname, ip: h.ip })))}\n\n` +
            `Provide: 1) Key findings 2) Recommended next steps 3) Commands to run`,
        },
      },
    ],
  })
);

server.prompt(
  "suggest-next-steps",
  "Suggest next pentest actions based on current state",
  async () => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text:
            `You are a penetration testing assistant. Based on the current engagement state:\n\n` +
            `Hosts: ${JSON.stringify(bridge.getHosts().map((h) => ({ hostname: h.hostname, ip: h.ip, is_dc: h.is_dc })))}\n` +
            `Users: ${JSON.stringify(bridge.getUsers().map((u) => ({ user: u.user, login: u.login, password: u.password, nt_hash: u.nt_hash })))}\n\n` +
            `Suggest the next 3-5 actions with exact commands.`,
        },
      },
    ],
  })
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
