# Feature Roadmap

## Current State (v0.0.1)

The extension already provides a strong foundation:
- Markdown-driven target/credential management with YAML blocks
- Environment variable export to all terminals
- CodeLens for shell commands, HTTP requests, YAML blocks
- msfvenom, hashcat, scanner integrations
- Terminal profiles (msfconsole, meterpreter, netcat, web delivery)
- Terminal recorder (command/output logging)
- Foam integration for knowledge graph + Tarjan SCC report generation
- Snippets: BloodHound, GTFOBins, LOLBAS
- CyberChef decoder integration

---

## Phase 1: Foundation Hardening (v0.1.0)

**Goal:** Fix bugs, add tests, prepare for AI integration.

### 1.1 Code Quality Fixes
- [x] Fix missing `await` on Foam activation
- [x] Make `Foam()` a static method
- [x] Add error boundaries in activation
- [x] Convert `let` to `const` throughout
- [x] Fix duplicate `is_dc` assignment
- [x] State getter caching
- [x] `defaultCollects` lazy loading
- [ ] Enable strict TSConfig options

### 1.2 Testing
- [x] Set up test infrastructure with fixtures
- [x] Unit tests for `core/domain/` (Host, UserCredential)
- [x] Unit tests for `core/markdown/` (fencedBlocks, yamlBlocks)
- [x] Unit tests for `core/env/` (collects, envVarSafer, mergeCollects)
- [ ] Integration tests for target sync
- [ ] E2E activation test
- [ ] CI test pipeline

### 1.3 Developer Experience
- [x] Add `AGENTS.md` for AI coding assistants
- [ ] Add `.editorconfig`
- [ ] Rewrite Python generators in TypeScript
- [ ] Document all environment variables in README

---

## Phase 2: AI Integration (v0.2.0)

**Goal:** Add AI assistant and external AI control.

### 2.1 Copilot Chat Participant
- [x] Register `@weapon` Chat Participant
- [x] Implement `/analyze` command (analyze tool output)
- [x] Implement `/suggest` command (suggest next steps)
- [x] Implement `/generate` command (generate commands)
- [x] Implement `/report` command (engagement summary)
- [x] Implement `/explain` command (explain concepts)
- [x] Build system prompt with engagement context
- [x] Add credential redaction in all LLM contexts
- [ ] Add inline action buttons (run command, create note)

### 2.2 MCP Server
- [x] Implement embedded MCP server with Streamable HTTP transport
- [ ] Resources: hosts, users, env-vars, terminal-logs, notes
- [x] Read tools: get_targets, get_credentials, get_graph, list_findings, get_finding
- [x] Write tools: create_finding, update_finding_frontmatter
- [x] Formatted output tools: get_hosts_formatted, get_credentials_formatted
- [x] Terminal tools: list_terminals, read_terminal, send_to_terminal, create_terminal
- [ ] Not yet implemented: search_notes, get_attack_graph, switch_target, switch_user, run_command, run_scanner, generate_report, decode_text
- [ ] Prompt templates: analyze-output, suggest-next-steps, privesc-check
- [ ] MCP Inspector testing
- [ ] Documentation for Claude Code, Cursor, VS Code MCP config

### 2.3 AI Safety
- [ ] Credential redaction in all AI-facing interfaces
- [ ] Command validation for AI-initiated execution
- [ ] AI action audit log
- [ ] `weaponized.ai.redactCredentials` setting
- [ ] Command queue with user approval for MCP write tools

---

## Phase 3: Enhanced Workflows (v0.3.0)

**Goal:** Smart automation and data import.

### 3.1 Auto-Import Scan Results
- [ ] File watcher for `*.xml` (nmap XML output)
- [ ] Nmap XML parser → auto-create host/service notes
- [ ] File watcher for `*.json` (various tool output)
- [ ] Import wizard: show preview, let user confirm before creating notes
- [ ] Support formats: nmap, masscan, nuclei JSON, feroxbuster JSON

### 3.2 Smart Command Suggestions
- [ ] Context-aware command palette: based on current host OS, services
- [ ] "What to try next" sidebar panel
- [ ] Command history with success/failure tracking
- [ ] Integration with terminal recorder: parse output → suggest follow-ups

### 3.3 Credential Vault
- [ ] Encrypt credentials at rest in `workspaceState`
- [ ] Master password on workspace open (or keychain integration)
- [ ] Credential rotation tracking (when was this password obtained?)
- [ ] `weaponized.vault.enabled` setting

### 3.4 Multi-Engagement Support
- [ ] Engagement profiles (different state per engagement)
- [ ] Quick-switch between engagements
- [ ] Engagement archiving (export all notes + state as ZIP)

---

## Phase 4: Visualization & Reporting (v0.4.0)

**Goal:** Rich visual analysis tools.

### 4.1 Attack Graph Webview
- [ ] Interactive webview panel for the attack graph (not just Mermaid in markdown)
- [ ] Clickable nodes → open corresponding Foam note
- [ ] Color-coded by node type (host, user, service, finding)
- [ ] Filter by severity, host, technique

### 4.2 Timeline View
- [ ] Webview panel showing chronological timeline of:
  - Terminal commands executed
  - Hosts discovered
  - Credentials obtained
  - Findings documented
- [ ] Filterable by host, user, time range
- [ ] Export as markdown for report appendix

### 4.3 Report Templates
- [ ] Multiple report formats: markdown, HTML, PDF (via pandoc)
- [ ] Executive summary template
- [ ] Technical findings template (per-finding: description, evidence, remediation)
- [ ] CVSS scoring integration
- [ ] Report diff: compare two engagement snapshots

### 4.4 Dashboard
- [ ] Status bar items: current host, current user, # findings
- [ ] Tree view: engagement overview (hosts → services → findings)
- [ ] Quick stats: hosts owned, users compromised, findings by severity

---

## Phase 5: Collaboration & Ecosystem (v0.5.0)

**Goal:** Team features and tool ecosystem.

### 5.1 Team Collaboration
- [ ] Shared engagement state via Git (already markdown-based!)
- [ ] Conflict resolution for simultaneous edits
- [ ] Activity feed: what did other team members discover?
- [ ] Shared terminal log aggregation

### 5.2 Tool Ecosystem
- [ ] Plugin API for custom tool integrations
- [ ] Community snippet packs (beyond BloodHound/GTFOBins/LOLBAS)
- [ ] Custom scanner definitions (beyond `weaponized.scanners` config)
- [ ] Integration with:
  - Burp Suite (import/export)
  - BloodHound CE (direct API)
  - Cobalt Strike (team server listener status)
  - Sliver C2
  - Havoc C2

### 5.3 AI Enhancements
- [ ] Local LLM support (ollama) for air-gapped engagements
- [ ] AI-powered finding deduplication
- [ ] Auto-remediation suggestions per finding
- [ ] AI report writing assistant (draft → review → finalize)
- [ ] VS Code `vscode.lm.registerTool()` when API stabilizes (replaces standalone MCP)

---

## Feature Priority Matrix

| Feature | User Value | Effort | Dependencies | Phase |
|---------|-----------|--------|-------------|-------|
| Code quality fixes | Medium | Low | None | 1 |
| Unit tests for core/ | High | Low | None | 1 |
| Copilot Chat Participant | High | Medium | None | 2 |
| MCP Server (read-only) | High | Medium | None | 2 |
| MCP Server (tools) | High | Medium | MCP read-only | 2 |
| Nmap XML auto-import | High | Medium | None | 3 |
| Credential vault | High | Medium | None | 3 |
| Attack graph webview | Medium | High | Report generator | 4 |
| Timeline view | Medium | High | Terminal recorder | 4 |
| Local LLM support | Medium | High | AI service layer | 5 |
| Team collaboration | Medium | High | Git workflow | 5 |
| Tool ecosystem plugins | Low | Very High | Plugin API design | 5 |

---

## Non-Goals

These are explicitly out of scope:

- **Building a C2 framework** — use existing ones (Sliver, Cobalt Strike)
- **Replacing Burp Suite** — focus on the terminal/note-taking workflow
- **Web-based UI** — this is a VS Code extension, not a web app
- **Automated exploitation** — the AI assists, the human decides and acts
- **Supporting non-VS Code editors** — the MCP server enables AI tool integration, but the core experience is VS Code

---

## Success Metrics

| Metric | Current | Phase 1 Target | Phase 2 Target |
|--------|---------|----------------|----------------|
| Test coverage (core/) | ~90% | 90% | 90% |
| Test coverage (overall) | 0% | 40% | 60% |
| Known bugs | ~5 | 0 | 0 |
| AI commands available | 5 | 0 | 5+ |
| MCP tools available | 13 | 0 | 10+ |
| Scan result auto-import | 0 formats | 0 | 0 |
| Supported scanner configs | 9 | 9 | 12+ |
