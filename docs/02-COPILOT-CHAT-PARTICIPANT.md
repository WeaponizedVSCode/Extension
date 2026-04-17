# Copilot Chat Participant Implementation Guide

## What is a Chat Participant?

A **Chat Participant** is a VS Code API that lets your extension register a persona in GitHub Copilot Chat. Users invoke it with `@weapon` and it can:

- Receive natural language queries
- Access the full extension state
- Stream markdown responses
- Suggest follow-up actions
- Reference files, selections, and terminal output

This is the **most natural AI integration** for a VS Code extension because it lives directly in the editor where the pentester works.

---

## Prerequisites

- VS Code >= 1.93.0 (Chat Participant API is stable since 1.93)
- Update `package.json` `engines.vscode` from `^1.101.0` (already satisfied)
- No additional npm dependencies required (it uses the built-in `vscode` API)

---

## File Structure

```
src/features/ai/
  index.ts                    -- registerAIFeatures() entry point
  participant.ts              -- Chat Participant registration + handler
  service.ts                  -- Shared AI service (state access)
  commands/
    suggestNextSteps.ts       -- Suggest next pentest actions
    analyzeOutput.ts          -- Analyze tool output (nmap, bloodhound, etc.)
    generateCommand.ts        -- Generate commands from natural language
  prompts/
    systemPrompt.ts           -- Base system prompt for the participant
    hostContext.ts             -- Host-specific context builder
    userContext.ts             -- User/credential context builder
    foamContext.ts             -- Foam knowledge graph context builder
```

---

## Step 1: Register the Chat Participant

### package.json additions

```jsonc
{
  "contributes": {
    // Add to existing contributes:
    "chatParticipants": [
      {
        "id": "weapon.chat",
        "fullName": "Weaponized Assistant",
        "name": "weapon",
        "description": "AI assistant for penetration testing workflows. Aware of your current targets, credentials, and engagement notes.",
        "isSticky": true,
        "commands": [
          {
            "name": "analyze",
            "description": "Analyze tool output (nmap, BloodHound, etc.)"
          },
          {
            "name": "suggest",
            "description": "Suggest next steps for the current target"
          },
          {
            "name": "generate",
            "description": "Generate a command from natural language"
          },
          {
            "name": "report",
            "description": "Summarize engagement findings"
          },
          {
            "name": "explain",
            "description": "Explain a concept, tool, or technique"
          }
        ]
      }
    ]
  }
}
```

### Registration Code

```typescript
// src/features/ai/index.ts

import * as vscode from "vscode";
import { weaponChatHandler, handleFollowUp } from "./participant";

export function registerAIFeatures(context: vscode.ExtensionContext) {
  const participant = vscode.chat.createChatParticipant(
    "weapon.chat",
    weaponChatHandler
  );

  participant.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    "images",
    "icon.png"
  );

  // Handle follow-up clicks
  participant.followupProvider = {
    provideFollowups(
      result: WeaponChatResult,
      _context: vscode.ChatContext,
      _token: vscode.CancellationToken
    ) {
      return handleFollowUp(result);
    },
  };

  context.subscriptions.push(participant);
}
```

Wire it into `activate.ts`:

```typescript
// In activateExtension():
import { registerAIFeatures } from "../features/ai";

// After existing registrations:
registerAIFeatures(context);
```

---

## Step 2: Implement the Chat Handler

```typescript
// src/features/ai/participant.ts

import * as vscode from "vscode";
import { AIService } from "./service";
import { buildSystemPrompt } from "./prompts/systemPrompt";
import { buildHostContext } from "./prompts/hostContext";
import { buildUserContext } from "./prompts/userContext";
import { buildFoamContext } from "./prompts/foamContext";

/** Result metadata passed to follow-up provider */
interface WeaponChatResult extends vscode.ChatResult {
  metadata: {
    command: string;
    suggestedCommands?: string[];
    suggestedTargets?: string[];
  };
}

const aiService = new AIService();

export async function weaponChatHandler(
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<WeaponChatResult> {
  const command = request.command ?? "chat";

  // Build engagement context
  const state = await aiService.getEngagementState();
  const systemPrompt = buildSystemPrompt();
  const hostCtx = buildHostContext(state.hosts, state.currentHost);
  const userCtx = buildUserContext(state.users, state.currentUser);

  // Gather any referenced files/selections
  const references = request.references
    .map((ref) => {
      if (ref.value instanceof vscode.Uri) {
        return `File: ${ref.value.fsPath}`;
      }
      if (ref.value instanceof vscode.Location) {
        return `Location: ${ref.value.uri.fsPath}:${ref.value.range.start.line}`;
      }
      return String(ref.value);
    })
    .join("\n");

  // Route to command handler
  switch (command) {
    case "analyze":
      return await handleAnalyze(request, stream, token, {
        systemPrompt,
        hostCtx,
        userCtx,
        references,
      });

    case "suggest":
      return await handleSuggest(request, stream, token, {
        systemPrompt,
        hostCtx,
        userCtx,
      });

    case "generate":
      return await handleGenerate(request, stream, token, {
        systemPrompt,
        hostCtx,
        userCtx,
      });

    case "report":
      return await handleReport(stream, token, state);

    default:
      return await handleGeneralChat(request, stream, token, {
        systemPrompt,
        hostCtx,
        userCtx,
        references,
      });
  }
}

// --- Command Handlers ---

interface PromptParts {
  systemPrompt: string;
  hostCtx: string;
  userCtx: string;
  references?: string;
}

async function handleAnalyze(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  parts: PromptParts
): Promise<WeaponChatResult> {
  const messages = [
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
      `## Task\nAnalyze the following output and provide:\n` +
        `1. Key findings (hosts, services, vulnerabilities)\n` +
        `2. Recommended next steps\n` +
        `3. Relevant commands to run\n\n` +
        `User query: ${request.prompt}`
    )
  );

  const response = await requestLanguageModel(messages, token);
  for await (const chunk of response.text) {
    stream.markdown(chunk);
  }

  return { metadata: { command: "analyze" } };
}

async function handleSuggest(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  parts: PromptParts
): Promise<WeaponChatResult> {
  const messages = [
    vscode.LanguageModelChatMessage.User(parts.systemPrompt),
    vscode.LanguageModelChatMessage.User(
      `## Current Engagement State\n${parts.hostCtx}\n${parts.userCtx}`
    ),
    vscode.LanguageModelChatMessage.User(
      `## Task\nBased on the current engagement state, suggest the next 3-5 ` +
        `actions the pentester should take. For each action, provide:\n` +
        `1. What to do and why\n` +
        `2. The exact command to run\n` +
        `3. What to look for in the output\n\n` +
        `Additional context from user: ${request.prompt || "none"}`
    ),
  ];

  const response = await requestLanguageModel(messages, token);
  for await (const chunk of response.text) {
    stream.markdown(chunk);
  }

  return { metadata: { command: "suggest" } };
}

async function handleGenerate(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  parts: PromptParts
): Promise<WeaponChatResult> {
  const messages = [
    vscode.LanguageModelChatMessage.User(parts.systemPrompt),
    vscode.LanguageModelChatMessage.User(
      `## Environment Variables Available\n${parts.hostCtx}\n${parts.userCtx}`
    ),
    vscode.LanguageModelChatMessage.User(
      `## Task\nGenerate the exact command(s) for: ${request.prompt}\n\n` +
        `Rules:\n` +
        `- Use environment variables ($TARGET, $RHOST, $USER, $PASS, etc.) when available\n` +
        `- Prefer tools commonly used in Kali Linux\n` +
        `- Output ONLY the command(s) in a fenced code block\n` +
        `- Add a brief explanation after the code block`
    ),
  ];

  const response = await requestLanguageModel(messages, token);
  for await (const chunk of response.text) {
    stream.markdown(chunk);
  }

  return { metadata: { command: "generate" } };
}

async function handleReport(
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  state: import("./service").EngagementState
): Promise<WeaponChatResult> {
  // Build report from state without calling LLM for sensitive data
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
    stream.markdown("| Login | User | Has Password | Has Hash | Current |\n");
    stream.markdown("|-------|------|-------------|----------|--------|\n");
    for (const u of state.users) {
      stream.markdown(
        `| ${u.login} | ${u.user} | ${u.password ? "Yes" : "No"} | ${u.nt_hash ? "Yes" : "No"} | ${u.is_current ? "**Yes**" : "No"} |\n`
      );
    }
  }

  stream.markdown(
    "\n\n> Use `@weapon /suggest` for AI-powered next step recommendations.\n"
  );

  return { metadata: { command: "report" } };
}

async function handleGeneralChat(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  parts: PromptParts
): Promise<WeaponChatResult> {
  const messages = [
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
    vscode.LanguageModelChatMessage.User(request.prompt)
  );

  const response = await requestLanguageModel(messages, token);
  for await (const chunk of response.text) {
    stream.markdown(chunk);
  }

  return { metadata: { command: "chat" } };
}

// --- Helpers ---

async function requestLanguageModel(
  messages: vscode.LanguageModelChatMessage[],
  token: vscode.CancellationToken
) {
  // Select the best available model
  const [model] = await vscode.lm.selectChatModels({
    vendor: "copilot",
    family: "gpt-4o",
  });

  if (!model) {
    throw new Error(
      "No language model available. Ensure GitHub Copilot is installed and active."
    );
  }

  return await model.sendRequest(messages, {}, token);
}

// --- Follow-ups ---

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
```

---

## Step 3: Build the System Prompt

```typescript
// src/features/ai/prompts/systemPrompt.ts

export function buildSystemPrompt(): string {
  return `You are a penetration testing assistant integrated into VS Code via the "Weaponized" extension.

## Your Role
- You help pentesters during authorized security assessments
- You have access to the current engagement state (hosts, credentials, notes)
- You generate commands, analyze output, and suggest next steps

## Environment
- The user works in VS Code with integrated terminals
- Environment variables like $TARGET, $RHOST, $USER, $PASS, $NT_HASH are set automatically
- The extension uses Foam for knowledge management (wikilinks, note templates)
- Available tools: nmap, rustscan, ffuf, feroxbuster, dirsearch, nuclei, hashcat, msfvenom, msfconsole, impacket, netexec, bloodhound

## Guidelines
- Always use $VARIABLE references when the data is available in the environment
- Prefer one-liners that can be copied and run directly
- When analyzing output, focus on actionable findings
- Flag potential privilege escalation paths
- Suggest both the action and how to document it (Foam notes)
- Never fabricate findings or output — only analyze what is provided
- Do NOT include credentials in your responses unless specifically asked
- Responses should be concise and terminal-ready

## Output Format
- Use fenced code blocks with the correct language tag (bash, powershell, etc.)
- Structure recommendations as numbered lists
- Use tables for comparing options
- Bold important findings or warnings`;
}
```

```typescript
// src/features/ai/prompts/hostContext.ts

import type { Host } from "../../../core";

export function buildHostContext(
  hosts: Host[],
  currentHost: Host | undefined
): string {
  if (hosts.length === 0) {
    return "**Hosts:** None discovered yet.";
  }

  const lines: string[] = ["### Known Hosts\n"];

  for (const h of hosts) {
    const flags = [
      h.is_current ? "CURRENT" : "",
      h.is_dc ? "DC" : "",
    ]
      .filter(Boolean)
      .join(", ");

    lines.push(
      `- **${h.hostname}** (${h.ip})${flags ? ` [${flags}]` : ""}` +
        (h.alias?.length ? ` aliases: ${h.alias.join(", ")}` : "")
    );
  }

  if (currentHost) {
    lines.push(
      `\n**Active target:** $TARGET = ${currentHost.ip}, $RHOST = ${currentHost.ip}`
    );
  }

  return lines.join("\n");
}
```

```typescript
// src/features/ai/prompts/userContext.ts

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
    const authType = u.nt_hash ? "NT hash" : u.password ? "password" : "none";
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
```

---

## Step 4: Add Inline Actions (Buttons in Chat)

The Chat Participant can render buttons that trigger extension commands:

```typescript
// In any handler, you can add command buttons:
stream.button({
  title: "Run this scan",
  command: "weapon.run_command",
  arguments: [{ command: "nmap -sV -sC $TARGET" }],
});

stream.button({
  title: "Switch to this host",
  command: "weapon.switch_host",
  arguments: [targetHost],
});

stream.button({
  title: "Create finding note",
  command: "weapon.note.creation",
  arguments: [{ type: "finding", name: "sqli-login" }],
});
```

This lets the AI suggest actions and the user can execute them with one click.

---

## Step 5: Variable References

Users can reference files, selections, and terminals in their prompts:

```
@weapon /analyze #file:nmap-output.txt
@weapon /generate reverse shell for #selection
@weapon /suggest based on #file:hosts/dc01.md
```

The `request.references` array in the handler provides these. Parse them:

```typescript
for (const ref of request.references) {
  if (ref.id === "vscode.file") {
    // ref.value is a vscode.Uri — read the file
    const content = await vscode.workspace.fs.readFile(ref.value as vscode.Uri);
    // Include in prompt
  }
  if (ref.id === "vscode.terminal") {
    // ref.value contains terminal output
  }
}
```

---

## Usage Examples

Once implemented, users can:

```
@weapon what services are running on the current target?

@weapon /analyze
<paste nmap output>

@weapon /generate enumerate SMB shares on DC01

@weapon /suggest I just got initial access as user1, what next?

@weapon /report

@weapon /explain what is AS-REP roasting and when should I try it?
```

---

## Testing

### Manual Testing
1. Open the extension in debug mode (`F5`)
2. Open Copilot Chat panel
3. Type `@weapon` and verify the participant appears
4. Test each command (`/analyze`, `/suggest`, `/generate`, `/report`)
5. Test with and without hosts/users in workspace state

### Unit Testing
- Test `buildSystemPrompt()` returns valid content
- Test `buildHostContext()` with empty, single, and multiple hosts
- Test `buildUserContext()` correctly redacts credentials
- Test that passwords/hashes are never included in any prompt builder output

---

## Limitations

- Requires GitHub Copilot subscription (free tier may have rate limits)
- The LLM model is chosen by VS Code / Copilot (you can't bring your own key)
- Chat Participant API does not support tool-use / function-calling (the LLM can't call your tools back — it can only generate text)
- For bidirectional AI control, use the MCP Server instead (see `03-MCP-SERVER-GUIDE.md`)
