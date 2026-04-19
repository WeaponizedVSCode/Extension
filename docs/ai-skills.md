# AI Skills

Pre-built skills for AI assistants working with Weaponized VS Code.

## Pentest with Weaponized

A comprehensive skill that teaches AI assistants (Claude Code, Cursor, etc.) how to use the Weaponized MCP tools and workspace features for penetration testing.

**Covers:**

- All 13 MCP tools: targets, credentials, findings, terminals, graph
- 6 MCP resources for read-only state access
- 4 workflow patterns: reconnaissance, credential exploitation, listener setup, iterative attack
- Workspace note structure (host YAML, credentials YAML, finding frontmatter)
- Best practices for documenting findings and building commands

### Download

<a href="/Extension/pentest-with-weaponized.zip" download>Download pentest-with-weaponized.zip</a>

### Installation

#### Claude Code

```bash
# Extract to your project's .claude/skills/ directory
unzip pentest-with-weaponized.zip -d .claude/skills/

# Or install globally
unzip pentest-with-weaponized.zip -d ~/.claude/skills/
```

#### Other MCP Clients

Copy the `SKILL.md` content into your AI client's system prompt or knowledge base configuration.

### Preview

::: details View SKILL.md content
<<< ./skills/pentest-with-weaponized/SKILL.md
:::
