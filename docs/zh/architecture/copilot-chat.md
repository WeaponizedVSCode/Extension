# Copilot Chat Participant 实现指南

## 什么是 Chat Participant？

**Chat Participant** 是一个 VS Code API，允许你的扩展在 GitHub Copilot Chat 中注册一个角色。用户通过 `@weapon` 调用它，它可以：

- 接收自然语言查询
- 访问完整的扩展状态
- 流式输出 markdown 响应
- 建议后续操作
- 引用文件、选中内容和终端输出

这是 VS Code 扩展**最自然的 AI 集成方式**，因为它直接嵌入在渗透测试人员工作的编辑器中。

---

## 前置条件

- VS Code >= 1.93.0（Chat Participant API 自 1.93 起已稳定）
- 更新 `package.json` 中的 `engines.vscode`，从 `^1.101.0`（已满足）
- 无需额外的 npm 依赖（使用内置的 `vscode` API）

---

## 文件结构

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

## 第 1 步：注册 Chat Participant

### package.json 添加内容

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

### 注册代码

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

将其接入 `activate.ts`：

```typescript
// In activateExtension():
import { registerAIFeatures } from "../features/ai";

// After existing registrations:
registerAIFeatures(context);
```

---

## 第 2 步：实现 Chat 处理器

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

## 第 3 步：构建系统提示词

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

## 第 4 步：添加内联操作（聊天中的按钮）

Chat Participant 可以渲染触发扩展命令的按钮：

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

这使得 AI 可以建议操作，而用户只需一键即可执行。

---

## 第 5 步：变量引用

用户可以在提示中引用文件、选中内容和终端：

```
@weapon /analyze #file:nmap-output.txt
@weapon /generate reverse shell for #selection
@weapon /suggest based on #file:hosts/dc01.md
```

处理器中的 `request.references` 数组提供了这些引用。解析方式如下：

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

## 使用示例

实现后，用户可以：

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

## 测试

### 手动测试
1. 在调试模式下打开扩展（`F5`）
2. 打开 Copilot Chat 面板
3. 输入 `@weapon` 并验证 participant 是否出现
4. 测试每个命令（`/analyze`、`/suggest`、`/generate`、`/report`）
5. 分别在工作区状态中有和没有 hosts/users 的情况下进行测试

### 单元测试
- 测试 `buildSystemPrompt()` 返回有效内容
- 测试 `buildHostContext()` 在空、单个和多个主机情况下的表现
- 测试 `buildUserContext()` 是否正确脱敏凭据
- 测试密码/哈希值永远不会包含在任何提示词构建器的输出中

---

## 局限性

- 需要 GitHub Copilot 订阅（免费层可能有速率限制）
- LLM 模型由 VS Code / Copilot 选择（你无法使用自己的密钥）
- Chat Participant API 不支持工具使用/函数调用（LLM 无法回调你的工具——它只能生成文本）
- 如需双向 AI 控制，请使用 MCP Server（参见 `03-MCP-SERVER-GUIDE.md`）
