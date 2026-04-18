# AI Chat Participant

`@weapon` Copilot Chat integration with full engagement context awareness.

## Prerequisites

Requires **GitHub Copilot Chat** extension installed and active.

## Usage

Open Copilot Chat (`Ctrl+Shift+I` / `Cmd+Shift+I`) and type `@weapon`:

| Command | Description | Example |
|---------|-------------|---------|
| `@weapon /analyze` | Analyze tool output | `@weapon /analyze` then paste nmap results |
| `@weapon /suggest` | Suggest next pentest actions | `@weapon /suggest` |
| `@weapon /generate` | Generate commands from natural language | `@weapon /generate DCSync with impacket` |
| `@weapon /report` | Summarize findings (direct output, no LLM) | `@weapon /report` |
| `@weapon /explain` | Explain a concept or technique | `@weapon /explain Kerberoasting` |
| `@weapon <question>` | General conversation | `@weapon how do I escalate from this user?` |

## How It Works

### Context Injection

Every conversation automatically includes:

- **System prompt** — Pentest-focused instructions and guidelines
- **Host context** — All discovered hosts with `$TARGET = hostname, $RHOST = ip` mapping
- **User context** — All credentials with auth type info and `$USER/$LOGIN` mapping
- **References** — Any attached files or selections from the editor

### Command Routing

- `/analyze`, `/suggest`, `/generate`, `/explain` → Full LLM conversation with engagement context
- `/report` → Direct table generation (no LLM call), outputs hosts + credentials as Markdown tables

### Follow-up Suggestions

After each response, contextual follow-up actions are suggested. For example, after `/analyze`, the participant suggests `/suggest` and `/generate`.

### Credential Protection

Credential values (passwords, hashes) are never sent to the LLM. The user context builder (`buildUserContext()` in `prompts/userContext.ts`) only includes authentication type information (e.g., "password", "hash") and username/domain mappings -- it never includes actual credential values. While `AIService.redactCredentials()` exists as a utility, the primary protection is that sensitive values are simply never included in the context that is built for the LLM.

## Key Files

- `src/features/ai/participant.ts` — Chat handler, command routing, LLM interaction
- `src/features/ai/service.ts` — Engagement state access, credential redaction
- `src/features/ai/prompts/systemPrompt.ts` — System prompt
- `src/features/ai/prompts/hostContext.ts` — Host context builder
- `src/features/ai/prompts/userContext.ts` — User context builder
