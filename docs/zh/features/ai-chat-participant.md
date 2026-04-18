# AI 聊天助手

`@weapon` Copilot Chat 集成，具备完整的渗透测试上下文感知能力。

## 前置条件

需要安装并激活 **GitHub Copilot Chat** 扩展。

## 使用方式

打开 Copilot Chat（`Ctrl+Shift+I` / `Cmd+Shift+I`）并输入 `@weapon`：

| 命令 | 说明 | 示例 |
|------|------|------|
| `@weapon /analyze` | 分析工具输出 | `@weapon /analyze` 然后粘贴 nmap 结果 |
| `@weapon /suggest` | 建议下一步渗透操作 | `@weapon /suggest` |
| `@weapon /generate` | 从自然语言生成命令 | `@weapon /generate 用 impacket 执行 DCSync` |
| `@weapon /report` | 汇总发现（直接输出，不调用 LLM） | `@weapon /report` |
| `@weapon /explain` | 解释概念或技术 | `@weapon /explain Kerberoasting` |
| `@weapon <问题>` | 一般对话 | `@weapon 如何从这个用户提权？` |

## 工作原理

### 上下文注入

每次对话自动包含：

- **系统提示词** — 渗透测试专用指令和指南
- **主机上下文** — 所有发现的主机，含 `$TARGET = 主机名, $RHOST = IP` 映射
- **用户上下文** — 所有凭证，含认证类型信息和 `$USER/$LOGIN` 映射
- **引用内容** — 编辑器中附加的文件或选中的文本

### 命令路由

- `/analyze`、`/suggest`、`/generate`、`/explain` → 完整的 LLM 对话，包含渗透上下文
- `/report` → 直接生成表格（不调用 LLM），以 Markdown 表格输出主机和凭证

### 后续建议

每次响应后会推荐上下文相关的后续操作。例如，`/analyze` 之后会建议 `/suggest` 和 `/generate`。

### 凭证保护

凭证值（密码、哈希）永远不会发送给 LLM。用户上下文构建器（`prompts/userContext.ts` 中的 `buildUserContext()`）仅包含认证类型信息（如"密码"、"哈希"）和用户名/域映射，不会包含实际的凭证值。虽然 `AIService.redactCredentials()` 作为工具函数存在，但主要的保护机制是构建给 LLM 的上下文时根本不包含敏感值。

## 关键文件

- `src/features/ai/participant.ts` — 聊天处理器、命令路由、LLM 交互
- `src/features/ai/service.ts` — 渗透状态访问、凭证脱敏
- `src/features/ai/prompts/systemPrompt.ts` — 系统提示词
- `src/features/ai/prompts/hostContext.ts` — 主机上下文构建器
- `src/features/ai/prompts/userContext.ts` — 用户上下文构建器
