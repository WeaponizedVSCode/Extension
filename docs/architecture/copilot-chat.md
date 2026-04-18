# Copilot Chat Participant

## Overview

The extension registers a **Chat Participant** (`@weapon`) in GitHub Copilot Chat. Users type `@weapon` in the Copilot Chat panel to get context-aware pentest assistance. The participant reads engagement state (hosts, credentials) from `Context` and builds prompts that include this context alongside the user's query.

Gated by `weaponized.ai.enabled` (default `true`). Requires GitHub Copilot.

---

## Registration

`registerAIFeatures()` in `src/features/ai/index.ts` creates the participant:

- **Participant ID**: `weapon.chat`
- **Handler**: `weaponChatHandler` — receives the request, builds context-enriched prompts, streams responses
- **Followup provider**: suggests relevant next actions based on the command just used
- **Icon**: `images/icon.png`

Registered in the activation sequence inside a try/catch — failure doesn't block other subsystems.

---

## Commands

Users invoke commands via `@weapon /command`:

| Command | Purpose | Behavior |
|---------|---------|----------|
| `/analyze` | Analyze tool output | Asks LLM to extract findings, next steps, and commands from pasted output |
| `/suggest` | Suggest next steps | Asks LLM for 3-5 prioritized actions based on current engagement state |
| `/generate` | Generate commands | Asks LLM to output exact commands using `$TARGET`, `$RHOST`, etc. |
| `/explain` | Explain a concept | Asks LLM to explain a tool, technique, or concept in pentest context |
| `/report` | Engagement summary | Renders a markdown table of hosts and credentials directly (no LLM call) |
| *(default)* | Free chat | Passes the user's query with engagement context to the LLM |

---

## Prompt Construction

Each request builds a message array:

1. **System prompt** — role definition, available tools, guidelines (from `prompts/systemPrompt.ts`)
2. **Engagement context** — current hosts and credentials, formatted by `prompts/hostContext.ts` and `prompts/userContext.ts`
3. **Referenced content** — any files or locations the user attached via `#file` or `#selection`
4. **Task prompt** — command-specific instructions + user's query

The LLM is selected via `vscode.lm.selectChatModels({ vendor: "copilot", family: "gpt-4o" })`. Responses are streamed chunk-by-chunk to the chat panel.

---

## Security

- **Credential redaction**: `AIService.redactCredentials()` replaces passwords and NT hashes with `[REDACTED]` in any text before sending to the LLM
- **Context metadata**: host/user context includes structure (hostname, IP, login) but `buildUserContext` shows auth type ("password" / "NT hash") without the actual values
- **No tool execution**: the participant only generates text — it does not run commands. Users must copy and execute commands themselves.

---

## Followup Flow

After each command, the followup provider suggests logical next steps:

- After `/analyze` → "Suggest next steps" or "Generate commands"
- After `/suggest` → "Generate the first suggested command"
- After `/generate` → "Explain what this command does"

---

## File Structure

```
src/features/ai/
  index.ts              — registerAIFeatures() entry point
  participant.ts        — Chat handler, command routing, LLM interaction
  service.ts            — AIService: state access + credential redaction
  prompts/
    systemPrompt.ts     — Base system prompt text
    hostContext.ts       — Formats hosts into context string
    userContext.ts       — Formats credentials into context string (redacted)
```
