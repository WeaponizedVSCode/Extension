import * as vscode from "vscode";
import { AIService } from "./service";
import { buildSystemPrompt } from "./prompts/systemPrompt";
import { buildHostContext } from "./prompts/hostContext";
import { buildUserContext } from "./prompts/userContext";
import type { EngagementState } from "./service";

interface WeaponChatResult extends vscode.ChatResult {
  metadata: {
    command: string;
  };
}

interface PromptParts {
  systemPrompt: string;
  hostCtx: string;
  userCtx: string;
  references?: string;
}

const aiService = new AIService();

export async function weaponChatHandler(
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<WeaponChatResult> {
  const command = request.command ?? "chat";
  const state = aiService.getEngagementState();
  const parts: PromptParts = {
    systemPrompt: buildSystemPrompt(),
    hostCtx: buildHostContext(state.hosts, state.currentHost),
    userCtx: buildUserContext(state.users, state.currentUser),
    references: request.references
      .map((ref) => {
        if (ref.value instanceof vscode.Uri) {
          return `File: ${ref.value.fsPath}`;
        }
        if (ref.value instanceof vscode.Location) {
          return `Location: ${ref.value.uri.fsPath}:${ref.value.range.start.line}`;
        }
        return String(ref.value);
      })
      .join("\n"),
  };

  switch (command) {
    case "analyze":
      return await handleWithLLM(request, stream, token, parts, "analyze");
    case "suggest":
      return await handleWithLLM(request, stream, token, parts, "suggest");
    case "generate":
      return await handleWithLLM(request, stream, token, parts, "generate");
    case "explain":
      return await handleWithLLM(request, stream, token, parts, "explain");
    case "report":
      return handleReport(stream, state);
    default:
      return await handleWithLLM(request, stream, token, parts, "chat");
  }
}

function buildTaskPrompt(command: string, userPrompt: string): string {
  switch (command) {
    case "analyze":
      return (
        `## Task\nAnalyze the following output and provide:\n` +
        `1. Key findings (hosts, services, vulnerabilities)\n` +
        `2. Recommended next steps\n` +
        `3. Relevant commands to run\n\n` +
        `User query: ${userPrompt}`
      );
    case "suggest":
      return (
        `## Task\nBased on the current engagement state, suggest the next 3-5 ` +
        `actions the pentester should take. For each action, provide:\n` +
        `1. What to do and why\n` +
        `2. The exact command to run\n` +
        `3. What to look for in the output\n\n` +
        `Additional context: ${userPrompt || "none"}`
      );
    case "generate":
      return (
        `## Task\nGenerate the exact command(s) for: ${userPrompt}\n\n` +
        `Rules:\n` +
        `- Use environment variables ($TARGET, $RHOST, $USER, $PASS, etc.) when available\n` +
        `- Prefer tools commonly used in Kali Linux\n` +
        `- Output ONLY the command(s) in a fenced code block\n` +
        `- Add a brief explanation after the code block`
      );
    case "explain":
      return `## Task\nExplain the following concept, tool, or technique in the context of penetration testing:\n\n${userPrompt}`;
    default:
      return userPrompt;
  }
}

async function handleWithLLM(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  parts: PromptParts,
  command: string
): Promise<WeaponChatResult> {
  const messages: vscode.LanguageModelChatMessage[] = [
    vscode.LanguageModelChatMessage.User(parts.systemPrompt),
    vscode.LanguageModelChatMessage.User(
      `## Engagement Context\n${parts.hostCtx}\n${parts.userCtx}`
    ),
  ];

  if (parts.references) {
    messages.push(
      vscode.LanguageModelChatMessage.User(
        `## Referenced Content\n${parts.references}`
      )
    );
  }

  messages.push(
    vscode.LanguageModelChatMessage.User(
      buildTaskPrompt(command, request.prompt)
    )
  );

  const [model] = await vscode.lm.selectChatModels({
    vendor: "copilot",
    family: "gpt-4o",
  });

  if (!model) {
    stream.markdown(
      "**Error:** No language model available. Ensure GitHub Copilot is installed and active."
    );
    return { metadata: { command } };
  }

  const response = await model.sendRequest(messages, {}, token);
  for await (const chunk of response.text) {
    stream.markdown(chunk);
  }

  return { metadata: { command } };
}

function handleReport(
  stream: vscode.ChatResponseStream,
  state: EngagementState
): WeaponChatResult {
  stream.markdown("## Engagement Summary\n\n");
  stream.markdown(`**Hosts discovered:** ${state.hosts.length}\n`);
  stream.markdown(`**Credentials obtained:** ${state.users.length}\n\n`);

  if (state.currentHost) {
    stream.markdown(
      `**Current target:** ${state.currentHost.hostname} (${state.currentHost.ip})\n\n`
    );
  }

  if (state.hosts.length > 0) {
    stream.markdown("### Hosts\n\n");
    stream.markdown("| Hostname | IP | DC | Current |\n");
    stream.markdown("|----------|----|----|--------|\n");
    for (const h of state.hosts) {
      stream.markdown(
        `| ${h.hostname} | ${h.ip} | ${h.is_dc ? "Yes" : "No"} | ${h.is_current ? "**Yes**" : "No"} |\n`
      );
    }
    stream.markdown("\n");
  }

  if (state.users.length > 0) {
    stream.markdown("### Credentials\n\n");
    stream.markdown(
      "| Login | User | Has Password | Has Hash | Current |\n"
    );
    stream.markdown("|-------|------|-------------|----------|--------|\n");
    for (const u of state.users) {
      stream.markdown(
        `| ${u.login} | ${u.user} | ${u.password ? "Yes" : "No"} | ${u.nt_hash && u.nt_hash !== "ffffffffffffffffffffffffffffffff" ? "Yes" : "No"} | ${u.is_current ? "**Yes**" : "No"} |\n`
      );
    }
  }

  stream.markdown(
    "\n\n> Use `@weapon /suggest` for AI-powered next step recommendations.\n"
  );

  return { metadata: { command: "report" } };
}

export function handleFollowUp(
  result: WeaponChatResult
): vscode.ChatFollowup[] {
  switch (result.metadata.command) {
    case "analyze":
      return [
        {
          prompt: "Suggest next steps based on this analysis",
          command: "suggest",
          label: "Suggest next steps",
        },
        {
          prompt: "Generate the recommended commands",
          command: "generate",
          label: "Generate commands",
        },
      ];
    case "suggest":
      return [
        {
          prompt: "Generate the first suggested command",
          command: "generate",
          label: "Generate command",
        },
      ];
    case "generate":
      return [
        {
          prompt: "Explain what this command does in detail",
          command: "explain",
          label: "Explain command",
        },
      ];
    default:
      return [];
  }
}
