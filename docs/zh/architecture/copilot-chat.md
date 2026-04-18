# Copilot Chat 参与者

## 概述

扩展在 GitHub Copilot Chat 中注册了一个 **Chat Participant**（`@weapon`）。用户在 Copilot Chat 面板中输入 `@weapon` 即可获得上下文感知的渗透测试辅助。参与者从 `Context` 读取渗透状态（主机、凭证），构建包含此上下文和用户查询的提示词。

受 `weaponized.ai.enabled`（默认 `true`）控制。需要 GitHub Copilot。

---

## 注册

`src/features/ai/index.ts` 中的 `registerAIFeatures()` 创建参与者：

- **参与者 ID**：`weapon.chat`
- **处理器**：`weaponChatHandler` — 接收请求，构建上下文增强的提示词，流式输出响应
- **后续建议提供者**：基于刚使用的命令建议相关的下一步操作
- **图标**：`images/icon.png`

在激活序列中通过 try/catch 注册 — 失败不会阻塞其他子系统。

---

## 命令

用户通过 `@weapon /command` 调用命令：

| 命令 | 用途 | 行为 |
|------|------|------|
| `/analyze` | 分析工具输出 | 让 LLM 从粘贴的输出中提取发现、下一步和命令 |
| `/suggest` | 建议下一步 | 让 LLM 基于当前渗透状态给出 3-5 个优先操作 |
| `/generate` | 生成命令 | 让 LLM 输出使用 `$TARGET`、`$RHOST` 等变量的精确命令 |
| `/explain` | 解释概念 | 让 LLM 在渗透测试上下文中解释工具、技术或概念 |
| `/report` | 渗透概要 | 直接渲染主机和凭证的 Markdown 表格（无 LLM 调用） |
| *（默认）* | 自由聊天 | 将用户查询与渗透上下文一起传给 LLM |

---

## 提示词构建

每个请求构建一个消息数组：

1. **系统提示词** — 角色定义、可用工具、指南（来自 `prompts/systemPrompt.ts`）
2. **渗透上下文** — 当前主机和凭证，由 `prompts/hostContext.ts` 和 `prompts/userContext.ts` 格式化
3. **引用内容** — 用户通过 `#file` 或 `#selection` 附加的文件或位置
4. **任务提示词** — 命令特定的指令 + 用户查询

LLM 通过 `vscode.lm.selectChatModels({ vendor: "copilot", family: "gpt-4o" })` 选择。响应以逐块流式传输到聊天面板。

---

## 安全性

- **凭证脱敏**：`AIService.redactCredentials()` 在发送到 LLM 前将密码和 NT 哈希替换为 `[REDACTED]`
- **上下文元数据**：主机/用户上下文包含结构（hostname、IP、login），但 `buildUserContext` 仅显示认证类型（"password" / "NT hash"），不显示实际值
- **无工具执行**：参与者仅生成文本 — 不运行命令。用户必须自行复制和执行

---

## 后续建议流程

每个命令执行后，后续建议提供者建议逻辑上的下一步：

- `/analyze` 之后 → "建议下一步" 或 "生成命令"
- `/suggest` 之后 → "生成第一个建议的命令"
- `/generate` 之后 → "详细解释此命令的作用"

---

## 文件结构

```
src/features/ai/
  index.ts              — registerAIFeatures() 入口点
  participant.ts        — 聊天处理器、命令路由、LLM 交互
  service.ts            — AIService：状态访问 + 凭证脱敏
  prompts/
    systemPrompt.ts     — 基础系统提示词文本
    hostContext.ts       — 将主机格式化为上下文字符串
    userContext.ts       — 将凭证格式化为上下文字符串（已脱敏）
```
