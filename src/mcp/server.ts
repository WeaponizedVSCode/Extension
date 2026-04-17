import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { StateBridge } from "./bridge";

const workspacePath = process.argv[2] || process.cwd();
const bridge = new StateBridge(workspacePath);

const server = new McpServer({
  name: "weaponized-vscode",
  version: "0.2.0",
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
      text: JSON.stringify(bridge.getRedactedUsers(), null, 2),
    },
  ],
}));

server.resource("users-current", "users://current", async () => ({
  contents: [
    {
      uri: "users://current",
      mimeType: "application/json",
      text: JSON.stringify(
        bridge.getCurrentUser()
          ? bridge.redactUser(bridge.getCurrentUser()!)
          : null,
        null,
        2
      ),
    },
  ],
}));

server.resource("env-variables", "env://variables", async () => {
  const vars = bridge.getEnvVars();
  // Redact sensitive env vars
  const redacted = { ...vars };
  for (const key of ["PASS", "PASSWORD", "NT_HASH"]) {
    if (redacted[key]) {
      redacted[key] = "[REDACTED]";
    }
  }
  return {
    contents: [
      {
        uri: "env://variables",
        mimeType: "application/json",
        text: JSON.stringify(redacted, null, 2),
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
  "Get all discovered credentials (redacted)",
  {},
  async () => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(bridge.getRedactedUsers(), null, 2),
      },
    ],
  })
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
            `Users: ${JSON.stringify(bridge.getRedactedUsers().map((u) => ({ user: u.user, login: u.login, has_password: !!u.password, has_hash: u.nt_hash !== "ffffffffffffffffffffffffffffffff" })))}\n\n` +
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
