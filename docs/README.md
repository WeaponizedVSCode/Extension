# Documentation

**[中文版本](./README_CN.md)**

Feature documentation for the Weaponized VSCode Extension.

## Features

| Feature | Description |
|---------|-------------|
| [Workspace Setup](./features/en/workspace-setup.md) | Scaffold a pentest workspace with templates and configuration |
| [Host Management](./features/en/host-management.md) | Parse, manage, and switch target hosts from Markdown YAML blocks |
| [Credential Management](./features/en/credential-management.md) | Manage user credentials with Impacket/NetExec format export |
| [Environment Variables](./features/en/environment-variables.md) | Automatic environment variable management for terminals |
| [CodeLens](./features/en/codelens.md) | Inline action buttons on YAML, shell, and HTTP code blocks |
| [Shell Command Runner](./features/en/shell-command-runner.md) | Execute shell commands from Markdown code blocks |
| [HTTP Repeater](./features/en/http-repeater.md) | Send raw HTTP requests and convert to cURL from Markdown |
| [Payload Generation](./features/en/payload-generation.md) | Interactive MSFVenom payload creation wizard |
| [Network Scanning](./features/en/network-scanning.md) | Run configurable security scanners against targets |
| [Password Cracking](./features/en/password-cracking.md) | Interactive Hashcat integration |
| [Terminal Profiles](./features/en/terminal-profiles.md) | Pre-configured terminal launchers for pentest tools |
| [Terminal Recorder](./features/en/terminal-recorder.md) | Capture terminal commands and output to log files |
| [Terminal Bridge](./features/en/terminal-bridge.md) | Bidirectional terminal IPC for MCP server integration |
| [Text Decoding](./features/en/text-decoding.md) | CyberChef Magic recipe integration for encoding detection |
| [Note Management](./features/en/note-management.md) | Foam-based notes with report generation and attack path analysis |
| [Code Snippets](./features/en/code-snippets.md) | GTFOBins, LOLBAS, BloodHound, and custom snippet libraries |
| [Definition Provider](./features/en/definition-provider.md) | Hover/go-to-definition for BloodHound terms |
| [AI Chat Participant](./features/en/ai-chat-participant.md) | `@weapon` Copilot Chat integration with engagement context |
| [MCP Server](./features/en/mcp-server.md) | Model Context Protocol server for external AI client integration |

## Architecture Docs

Detailed architecture and design documents:

- [AI Integration Architecture](../docs/01-AI-INTEGRATION-ARCHITECTURE.md)
- [Copilot Chat Participant](../docs/02-COPILOT-CHAT-PARTICIPANT.md)
- [MCP Server Guide](../docs/03-MCP-SERVER-GUIDE.md)
- [Code Quality](../docs/04-CODE-QUALITY.md)
- [Testing Strategy](../docs/05-TESTING-STRATEGY.md)
- [Feature Roadmap](../docs/06-FEATURE-ROADMAP.md)
