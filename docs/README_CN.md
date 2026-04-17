# 文档

Weaponized VSCode Extension 功能文档。

**[English Version](./README.md)**

## 功能列表

| 功能 | 说明 |
|------|------|
| [工作区初始化](./features/zh/workspace-setup.md) | 创建渗透测试工作区模板和配置 |
| [主机管理](./features/zh/host-management.md) | 从 Markdown YAML 块中解析、管理和切换目标主机 |
| [凭证管理](./features/zh/credential-management.md) | 管理用户凭证，支持 Impacket/NetExec 格式导出 |
| [环境变量](./features/zh/environment-variables.md) | 终端环境变量自动管理 |
| [CodeLens](./features/zh/codelens.md) | YAML、Shell、HTTP 代码块上的内联操作按钮 |
| [Shell 命令执行](./features/zh/shell-command-runner.md) | 从 Markdown 代码块直接执行 Shell 命令 |
| [HTTP 请求重放](./features/zh/http-repeater.md) | 从 Markdown 发送原始 HTTP 请求并转换为 cURL |
| [载荷生成](./features/zh/payload-generation.md) | 交互式 MSFVenom 载荷创建向导 |
| [网络扫描](./features/zh/network-scanning.md) | 对目标运行可配置的安全扫描器 |
| [密码破解](./features/zh/password-cracking.md) | 交互式 Hashcat 集成 |
| [终端配置文件](./features/zh/terminal-profiles.md) | 预配置的渗透测试工具终端启动器 |
| [终端录制器](./features/zh/terminal-recorder.md) | 将终端命令和输出记录到日志文件 |
| [终端桥接](./features/zh/terminal-bridge.md) | 用于 MCP 服务器集成的双向终端 IPC |
| [文本解码](./features/zh/text-decoding.md) | CyberChef Magic 自动编码检测与解码 |
| [笔记管理](./features/zh/note-management.md) | 基于 Foam 的笔记系统，含报告生成和攻击路径分析 |
| [代码片段](./features/zh/code-snippets.md) | GTFOBins、LOLBAS、BloodHound 及自定义片段库 |
| [定义提供器](./features/zh/definition-provider.md) | BloodHound 术语悬停提示与跳转定义 |
| [AI 聊天助手](./features/zh/ai-chat-participant.md) | `@weapon` Copilot Chat 集成，具备渗透上下文感知 |
| [MCP 服务器](./features/zh/mcp-server.md) | 模型上下文协议服务器，供外部 AI 客户端集成 |

## 架构文档

- [AI 集成架构](../docs/01-AI-INTEGRATION-ARCHITECTURE.md)
- [Copilot Chat Participant](../docs/02-COPILOT-CHAT-PARTICIPANT.md)
- [MCP 服务器指南](../docs/03-MCP-SERVER-GUIDE.md)
- [代码质量](../docs/04-CODE-QUALITY.md)
- [测试策略](../docs/05-TESTING-STRATEGY.md)
- [功能路线图](../docs/06-FEATURE-ROADMAP.md)
