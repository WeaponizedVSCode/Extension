# 整体设计 — Weaponized VS Code

## 项目定位与愿景

**Weaponized VS Code** 将 VS Code 工作区变成渗透测试 IDE。它构建在 [Foam](https://foambubble.github.io/foam/)（知识管理扩展）之上，将 **Markdown 文件视为结构化数据库**：渗透测试人员编写笔记的同一个 `.md` 文件，也是主机、凭证、发现和关系的机器可解析的唯一数据源。

### 核心原则

| 原则 | 含义 |
|------|------|
| **笔记即数据** | Markdown 中的 YAML 围栏块是规范状态，无需单独数据库。 |
| **Foam 优先** | Wiki-links 和 Foam 图驱动报告生成（Tarjan SCC 分析）和实体导航（跳转定义）。Foam 是必需依赖。 |
| **终端原生** | 外部工具（nmap、hashcat、msfconsole 等）在 VS Code 终端中运行，不重新实现。 |
| **AI 增强** | Copilot Chat 参与者 + MCP 服务器为 AI 助手提供完整的渗透环境上下文。 |
| **默认安全** | 凭证从不发送给 LLM；MCP 仅绑定 localhost；AI 功能由设置项控制。 |

### 目标用户

通过 HTB、OSCP、红队演练或类似场景工作的渗透测试人员，需要一个统一工作区来组织笔记、管理目标、运行工具和利用 AI 辅助。

### 前置条件

- **VS Code** >= 1.101.0
- **Foam 扩展**（`foam.foam-vscode`）— 知识管理骨架。扩展激活时会检查 Foam；如果缺失，`dependencyCheck()` 提前返回，**不会注册任何子系统**（这是硬性前置条件，不受下述部分激活弹性机制影响）。
- **Shell Integration** — 必须在终端中启用，`TerminalBridge` 才能捕获输出（现代 VS Code 默认启用）。

可选外部工具（通过终端调用，不打包在扩展内）：

| 工具 | 使用方 | 用途 |
|------|--------|------|
| `msfvenom` / `msfconsole` | 载荷生成、终端配置 | Metasploit 框架 |
| `hashcat` | 密码破解任务 | 哈希破解 |
| `rustscan`、`nuclei`、`dirsearch`、`feroxbuster`、`ffuf`、`wfuzz` | 网络扫描 | 可配置的扫描命令 |
| `rlwrap`、`netcat` | 终端配置 | 反向 Shell 处理 |

---

## 架构决策记录

### ADR-1: Markdown 即数据库

**背景：** 渗透测试工作流需要结构化状态（主机、凭证、发现），但也需要丰富的人类可读笔记，包含截图、工具输出和叙述。

**决策：** 使用 Markdown 文件中的 YAML 围栏代码块（` ```yaml host `、` ```yaml credentials `）作为规范数据源。`FileSystemWatcher` 在每次变更时将其解析为内存中的领域对象。

**结果：**
- (+) 单一数据源 — 笔记和数据库之间无需同步
- (+) 兼容任何文本编辑器，git 友好，Foam wiki-links 连接实体
- (+) 用户可以手动编辑 YAML 或使用扩展命令，两者互通
- (-) 没有查询语言 — 所有"查询"都是对匹配文件的全量扫描
- (-) 删除操作仅在全量重扫描时检测（文件删除触发冷扫描，但在文件中删除 YAML 块是仅增量的，直到重启）

### ADR-2: 嵌入式 MCP 服务器（进程内 HTTP）

**背景：** MCP 服务器最初作为独立 Node.js 进程运行，通过 stdio 和基于文件的 IPC（`.weapon-state/` 目录）通信。这需要维护状态同步文件和单独的 webpack 构建目标。

**决策：** 将 MCP 服务器移入扩展宿主，使用 `StreamableHTTPServerTransport` 作为嵌入式 HTTP 服务器。服务器直接从 `Context` 单例读取状态，通过 `TerminalBridge` 与终端交互。

**结果：**
- (+) 零 IPC 开销 — 直接内存访问所有扩展状态
- (+) 无文件同步 bug，无过期的 `.weapon-state/` 数据
- (+) 单进程调试，单 webpack 目标维护
- (-) 服务器生命周期绑定到扩展宿主 — 扩展崩溃则 MCP 也停止
- (-) 需注意不阻塞扩展宿主线程（通过无状态逐请求设计缓解）

### ADR-3: 分层架构与 core 零 VS Code 依赖

**背景：** 领域逻辑（主机解析、凭证格式化、图算法）需要在不启动 VS Code 的情况下可测试。

**决策：** 强制执行严格的分层架构，`core/` 完全没有 `vscode` 导入。所有 VS Code 耦合存在于 `platform/vscode/` 和 `features/`。

**结果：**
- (+) `core/` 可以用普通 Mocha 测试 — 不需要扩展宿主
- (+) 领域模型可在 VS Code 外复用（如未来的 CLI 工具）
- (-) 需要纪律 — 领域模型导出 `Collects` 映射而非直接设置环境变量

### ADR-4: 静态单例 Context

**背景：** 多个子系统（CodeLens 提供者、MCP 服务器、AI 参与者、目标同步）都需要访问相同的主机/用户状态。

**决策：** 使用静态单例类 `Context`，持有 `ExtensionContext`、缓存的 `HostState`/`UserState` 数组和延迟加载的 Foam 引用。状态通过 VS Code 的 `workspaceState` 持久化，带脏标记缓存模式。

**结果：**
- (+) 简单 — 任何模块都可以读取 `Context.HostState` 无需布线
- (+) `workspaceState` 持久化在扩展重启后保留
- (-) 全局可变状态 — 消费者的单元测试更困难（需要模拟 `Context`）
- (-) 没有事件系统 — 消费者轮询状态而非订阅变更

### ADR-5: 无状态 MCP（逐请求新实例）

**背景：** MCP 会话可能积累状态，需要清理和并发管理。

**决策：** 设置 `sessionIdGenerator: undefined` — 每个到 `/mcp` 的 HTTP 请求创建全新的 `McpServer` + `StreamableHTTPServerTransport`。所有持久状态存在于 `Context`，而非 MCP 会话中。

**结果：**
- (+) 无会话泄漏，无需清理，天然并发安全
- (+) 服务器重启只需"停止监听，开始监听"
- (-) 无 MCP 通知/订阅（服务器到客户端推送）
- (-) 每请求重新注册工具/资源的轻微开销（实践中可忽略）

### ADR-6: 凭证安全模型 — 分级暴露

**背景：** AI 工具需要渗透环境上下文，但不能将密码/哈希泄露给外部 LLM。

**决策：** 三级凭证暴露：

| 消费者 | 可见密码/哈希？ | 机制 |
|--------|---------------|------|
| Copilot Chat（`@weapon`） | 从不 | `userContext.ts` 仅报告认证类型（"password"/"NT hash"/"none"） |
| MCP 服务器工具 | 是（完整数据） | MCP 客户端处理用户审批；仅 localhost 绑定 |
| 终端环境变量 | 是（注入为 `$PASS`、`$NT_HASH`） | 用户自己的终端；在 VS Code UI 中可见 |

**结果：**
- (+) LLM 上下文安全 — 无凭证通过模型泄露
- (+) MCP 向需要的本地工具提供完整数据
- (-) MCP 凭证暴露依赖客户端审批（不在我们控制范围内）

---

## 系统架构

### 四层结构

```
┌─────────────────────────────────────────────────────────┐
│                      app/                               │
│                 组合根 & 引导启动                         │
│    activate.ts · registerCommands.ts · registerCodeLens │
├─────────────────────────────────────────────────────────┤
│                   features/                             │
│                  垂直功能切片                             │
│  ai · mcp · targets · shell · http · terminal · ...    │
├──────────────────────┬──────────────────────────────────┤
│   platform/vscode/   │           core/                  │
│  VS Code 抽象层       │       纯领域逻辑                  │
│  Context · Logger    │  domain · markdown · env         │
│  Variables           │  (零 vscode 导入)                 │
├──────────────────────┴──────────────────────────────────┤
│                    shared/                              │
│                   横切工具层                              │
│                 types · globs                           │
└─────────────────────────────────────────────────────────┘
```

### 依赖规则

| 层级 | 可以导入 | 禁止导入 |
|------|---------|---------|
| `app/` | 所有层 | — |
| `features/*` | `core/`、`platform/`、`shared/` | 其他 feature 模块（例外：`features/mcp/` 从 `features/terminal/` 和 `features/targets/` 导入，因为 MCP 服务器需要桥接终端交互和图构建） |
| `platform/vscode/` | `core/`、`shared/`、`vscode` API | `features/` |
| `core/` | 仅 `shared/` | `vscode`、`platform/`、`features/` |
| `shared/` | 无（叶子节点） | 其他所有层 |

关键边界：**`core/` 完全没有 VS Code 导入**。所有领域逻辑都是纯 TypeScript，无需 VS Code 运行时即可测试。

### 运行时组件图

```
┌─ VS Code 扩展宿主 ─────────────────────────────────────────────────────┐
│                                                                       │
│  activate.ts (组合根)                                                  │
│       │                                                               │
│       ├─► targets/sync ──► FileSystemWatcher ──► Context (单例)        │
│       │                         ▲                    │                │
│       │                    .md 文件               ┌──┴──┐            │
│       │                                           │状态  │            │
│       ├─► registerCommands() ◄────────────────────┤缓存  │            │
│       │   (17 个 weapon.* 命令)                    └──┬──┘            │
│       │                                              │                │
│       ├─► registerCodeLens()                         │                │
│       │   (targets, shell, notes, http)              │                │
│       │                                              │                │
│       ├─► registerTerminalUtils()                    │                │
│       │   (终端配置 + 录制器)                          │                │
│       │                                              │                │
│       ├─► registerDefinitionProvider()               │                │
│       │   (BloodHound 悬停)                           │                │
│       │                                              │                │
│       └─► if (ai.enabled)                            │                │
│            ├─► TerminalBridge ◄──────────────────────┤                │
│            ├─► EmbeddedMcpServer ◄───────────────────┘                │
│            │     POST /mcp 于 127.0.0.1:<port>                       │
│            ├─► autoUpdateMcpJson()                                    │
│            └─► @weapon Chat 参与者                                     │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
         ▲
         │ POST /mcp (Streamable HTTP)
         │
  外部 AI 客户端 (Claude Code, Cursor, VS Code Copilot, ...)
```

### 激活序列

```
extension.ts
  └─► activate.ts: activateExtension(context)
        ├─ Context.context = context
        ├─ dependencyCheck()            // Foam 已安装？工作区已打开？
        ├─ registerTargetsSync()        // 文件监听器 + 初始冷扫描
        ├─ registerCommands()           // 17 个 weapon.* 命令
        ├─ registerCodeLens()           // YAML、shell、HTTP、notes
        ├─ registerTerminalUtils()      // 终端配置 + 录制器
        ├─ registerDefinitionProvider() // BloodHound 悬停
        └─ if (weaponized.ai.enabled)
             ├─ registerMcpBridge()     // TerminalBridge + 配置提供者
             ├─ EmbeddedMcpServer.start(bridge, port)
             ├─ autoUpdateMcpJson(port) // 修补 .vscode/mcp.json
             └─ registerAIFeatures()    // @weapon Copilot Chat 参与者
```

每个注册操作都包裹在 try/catch 中 — 一个子系统的失败不会阻塞其他子系统（弹性部分激活）。

---

## 核心数据流 — Markdown 即数据库

```
  工作区 Markdown 文件
  (hosts/**/*.md, users/**/*.md, services/**/*.md)
         │
         │  FileSystemWatcher + 初始扫描
         ▼
  ┌─────────────────┐     extractYamlBlocksByIdentity()
  │  targets/sync   │────────────────────────────────────►  core/markdown/
  │  (文件监听器)    │                                       fencedBlocks.ts
  └────────┬────────┘                                       yamlBlocks.ts
           │
           │  Host.init() / UserCredential.init()
           │  按 hostname / login+user 去重
           ▼
  ┌─────────────────┐
  │    Context       │  workspaceState（带脏标记缓存）
  │  HostState       │
  │  UserState       │
  └────────┬────────┘
           │
     ┌─────┼──────────────────┐
     │     │                  │
     ▼     ▼                  ▼
  CodeLens  环境变量注入       MCP 服务器 / AI 参与者
  提供者    ($TARGET, ...)    (通过 Context 读取状态)
```

### 同步行为

| 事件 | 动作 |
|------|------|
| **冷扫描**（init） | 清除所有状态，扫描所有匹配文件，重建主机/用户列表 |
| **文件变更**（onDidChange） | 重新处理变更文件，合并到现有状态（增量式） |
| **文件删除**（onDidDelete） | 触发完整冷扫描以正确移除条目 |
| **去重** | 在去重前反转列表 — 给定 hostname 或 login/user 对的最新添加条目优先 |

### 文件发现

Glob `**/{users,hosts,services}/{*.md,*/*.md}` 匹配 `users/`、`hosts/` 或 `services/` 目录内一级或两级的 `.md` 文件。

---

## 工作区设计

### 脚手架（`weapon.setup`）

**仅**从 base64 嵌入模板创建 `.vscode/` 配置文件：

```
<workspace>/
  .vscode/
    .zshrc              # Shell 环境：venv 激活、历史记录、辅助函数
    extensions.json     # 推荐的 VS Code 扩展
    msfconsole.rc       # Metasploit 控制台资源文件
    settings.json       # 武器化扩展默认设置
```

模板由 `scripts/gen-setup.py` → `src/features/setup/assets.ts` 生成。Setup 只写入不存在的文件 — 从不覆盖。

文件创建后，检查 `~/.zshrc` 是否包含 `weapon_vscode_launch_helper`。如果未找到，将辅助函数复制到剪贴板并打开 `~/.zshrc` 供手动粘贴。

### 工作区目录约定

```
<workspace>/
  .vscode/                          # 扩展配置（weapon.setup）
    .zshrc
    settings.json
    mcp.json                        # MCP 服务器配置（weapon.mcp.install）
  hosts/
    <hostname>/
      <hostname>.md                 # 主机笔记，包含 ```yaml host 块
  users/
    <username>/
      <username>.md                 # 用户笔记，包含 ```yaml credentials 块
  services/
    <servicename>/
      <servicename>.md              # 服务笔记
  findings/
    <findingname>/
      <findingname>.md              # 发现笔记，包含严重程度和标签
  report.md                         # 自动生成的渗透测试报告
```

### 笔记模板

通过 `scripts/gen-report-assets.py` → `src/features/notes/reports/assets.ts` 嵌入。`weapon.note.creation` 命令提供 5 种类型：

| 类型 | 创建位置 | 关键内容 |
|------|---------|---------|
| `host` | `hosts/<name>/<name>.md` | `yaml host` 块、端口、nmap、漏洞 |
| `user` | `users/<name>/<name>.md` | `yaml credentials` 块、权限 |
| `service` | `services/<name>/<name>.md` | 服务别名、位置、漏洞 |
| `finding` | `findings/<name>/<name>.md` | 严重程度、标签、描述、参考链接 |
| `report` | `report.md`（工作区根目录） | 通过 Foam 图分析聚合 |

笔记名中的 `@` 字符作为分隔符解析：`admin@example.com` → id=`admin`，domain=`example_com`。

---

## 模块职责

### 状态管理域

**`core/domain/`** — 纯 TypeScript 领域模型，零 VS Code 依赖。

| 模型 | 文件 | 职责 |
|------|------|------|
| `Host` | `host.ts` | 目标主机：hostname、IP、别名、DC 标志、当前目标标志、自定义 props。支持 4 种导出格式（env、hosts、yaml、table）。 |
| `UserCredential` | `user.ts` | 凭证：用户名、密码、NT 哈希、登录域、当前标志。支持 5 种导出格式（env、impacket、nxc、yaml、table）。 |
| `Finding` | `finding.ts` | 安全发现：id、标题、严重程度、标签、描述、参考链接。解析 YAML frontmatter + markdown 节。 |
| `Graph` | `graph.ts` | 纯算法：Tarjan SCC + 最长路径，用于权限提升链计算。 |
| `Foam 类型` | `foam.ts` | 镜像 Foam 扩展 API 的 TypeScript 接口，用于类型安全的互操作。 |

**`core/markdown/`** — Markdown 解析原语。

| 模块 | 职责 |
|------|------|
| `fencedBlocks.ts` | 将围栏代码块解析为 `FencedBlock` 对象；`replaceFencedBlockContent()` 用于精确编辑。 |
| `yamlBlocks.ts` | fencedBlocks 上的过滤器：`extractYamlBlocksByIdentity()` 查找 `yaml host` / `yaml credentials` 块。 |

**`core/env/collects.ts`** — `Collects` 类型（string→string 映射）、`envVarSafer()` 清理器、`mergeCollects()` 先写入者优先。

**`features/targets/sync/`** — 监听工作区文件，将 YAML 块解析为领域对象，存入 `Context`，向终端注入环境变量。

- `markdownSync.ts` — 核心同步：文件 → 解析 → 去重 → Context → 环境变量注入
- `graphBuilder.ts` — 从 Foam 工作区构建 `RelationshipGraph`（节点、边、攻击路径、Mermaid 图）

### 终端域

**`features/terminal/`** — 终端配置、输出捕获和 MCP 桥接。

| 组件 | 职责 |
|------|------|
| `bridge.ts`（`TerminalBridge`） | 按 ID 跟踪终端，通过 Shell Integration API 捕获输出，内存缓冲，每 500ms 刷盘（64KB 上限）。为 MCP 工具暴露 `getTerminals()`、`getTerminalOutput()`、`sendCommandDirect()`、`createTerminal()`。 |
| `profiles/` | 抽象 `BaseWeaponizedTerminalProvider` + 4 个具体提供者：msfconsole、meterpreter、netcat、web-delivery。每个在终端打开时发送初始命令。 |
| `recorder/` | 终端日志系统，4 种模式：CommandOnly、OutputOnly、CommandAndOutput、NetcatHandler。用户可手动启停。 |

**`features/tasks/`** — `hashcat`、`msfvenom`、`scan` 的命令处理器 — 创建终端并运行配置的工具命令。

**`features/shell/`** — 在 `bash`/`zsh`/`sh`/`powershell` 围栏块上的 CodeLens → "在终端运行命令" / "复制命令" 按钮。

### AI 域

**`features/ai/`** — Copilot Chat 参与者 `@weapon`。

| 组件 | 职责 |
|------|------|
| `participant.ts` | 路由 `/analyze`、`/suggest`、`/generate`、`/explain`、`/report` 命令。构建包含系统提示词 + 主机/用户上下文的消息，从 `gpt-4o` 流式输出。`/report` 是纯数据（无 LLM 调用）。 |
| `service.ts`（`AIService`） | 从 `Context` 读取渗透状态。包含 `redactCredentials()` 用于去除密码/哈希。 |
| `prompts/systemPrompt.ts` | 静态系统提示词：渗透测试助手角色、输出格式规则、凭证处理。 |
| `prompts/hostContext.ts` | 已知主机的 Markdown 摘要，供 LLM 上下文使用（标记 DC/CURRENT 状态）。 |
| `prompts/userContext.ts` | 凭证的 Markdown 摘要 — **从不包含实际密码或哈希**，仅报告认证类型。 |

**`features/mcp/`** — 嵌入式 MCP HTTP 服务器。

| 组件 | 职责 |
|------|------|
| `httpServer.ts`（`EmbeddedMcpServer`） | 在 `127.0.0.1` 上运行的 HTTP 服务器，无状态逐请求。注册 6 个资源、13 个工具、2 个提示词。 |
| `install.ts` | 管理 `.vscode/mcp.json`：用户命令 + 激活时自动更新。 |
| `portManager.ts` | 端口选择：尝试首选端口（默认 25789），回退到 OS 分配。 |

### 知识管理域

**`features/notes/`** — 笔记创建和报告生成。

| 组件 | 职责 |
|------|------|
| `reports/report.ts` | 生成完整渗透测试报告：Foam 图 → Tarjan SCC → 最长攻击路径 → Mermaid 图 → 组装各节。 |
| `reports/index.ts` | `weapon.note.creation` 命令：5 种笔记类型，模板来自 `assets.ts`。 |
| `codelens/noteProvider.ts` | 扫描 `get user <name>` / `own host <name>` 行，为尚未存在于状态中的实体提供 CodeLens 创建 Foam 笔记。 |

**`features/definitions/`** — BloodHound 悬停提示和跳转定义。

**`features/decoder/`** — `weapon.magic_decoder`：在 VS Code 的 Simple Browser 中打开 CyberChef，使用选中文本和 "Magic" 配方。

### HTTP 域

**`features/http/`** — HTTP 重放功能。

| 组件 | 职责 |
|------|------|
| `codelens/` | 在 ` ```http ` 围栏块上提供 "发送 HTTP/HTTPS 请求" 和 "以 curl 复制" 按钮。 |
| `commands/rawRequest.ts` | 解析原始 HTTP 文本，通过 `node-fetch` 执行（渗透目标禁用 SSL 验证），显示响应。 |
| `commands/requestToCurl.ts` | 将原始 HTTP 请求转换为 curl 命令，复制到剪贴板。 |

### 工程域

**`features/setup/`** — 工作区脚手架（`weapon.setup`）。

**`features/editor/`** — 虚拟文档显示（`displayVirtualContent`）和文件内文本替换（`replacer`），由 CodeLens 操作使用。

**`platform/vscode/`** — VS Code 集成层。

| 组件 | 职责 |
|------|------|
| `context.ts`（`Context`） | 静态单例：持有 `ExtensionContext`、缓存的 `HostState`/`UserState`、延迟加载的 Foam 引用。使用 `workspaceState` 带脏标记缓存。 |
| `logger.ts` | 名为 "Weaponized" 的 `LogOutputChannel`。 |
| `variables.ts` | 解析 `${workspaceFolder}`、`${env:VAR}`、`${config:VAR}`、`${command:CMD}` 占位符。支持递归解析。 |
| `defaultCollects.ts` | Hashcat 常量 + 来自配置的 `LHOST`/`LPORT`/`LISTEN_ON` + 用户自定义环境变量。 |

### 通用 Feature 模式

所有 feature 模块遵循一致的约定：

- **桶导出**：`index.ts` 重新导出公共 API
- **命令处理器**：`commands/` 中的 `callback = (...args: any[]) => any` 类型函数
- **CodeLens 生成器**：基类接受生成器函数，遍历围栏块，产生 `CodeLens[]`
- **隔离性**：features 仅从 `core/`、`platform/`、`shared/` 导入，**绝不从其他 features 导入**
- **自动生成资产**：Python 脚本将模板 base64 编码为 TypeScript — 无运行时文件读取

---

## 环境变量系统

### 变量注入流水线

```
ProcessWorkspaceStateToEnvironmentCollects(workspace)
  │
  ├─ getScoped EnvironmentVariableCollection for workspace
  ├─ collection.clear()                    // 清除过期变量
  │
  ├─ 构建 3 个 Collects 映射：
  │   ├─ 用户环境变量   (UserCredential.exportEnvironmentCollects())
  │   ├─ 主机环境变量   (Host.exportEnvironmentCollects())
  │   └─ 默认 collects (hashcat 常量 + 配置 + 用户自定义环境变量)
  │       └─ + PROJECT_FOLDER = 工作区路径
  │
  ├─ mergeCollects(users, hosts, defaults)  // 先写入者优先
  │                                          // 优先级：users > hosts > defaults
  └─ 对每个键: collection.replace(key, value)
      └─ 新终端将接收这些环境变量
```

### 当前主机导出的变量（`is_current: true`）

| 变量 | 值 |
|------|-----|
| `TARGET` | `hostname` |
| `RHOST` | `ip` |
| `HOST` | `hostname` |
| `DOMAIN` | `hostname` |
| `IP` | `ip` |
| `CURRENT_HOST` | `hostname` |

### 所有主机导出的变量

| 变量 | 值 |
|------|-----|
| `HOST_<safename>` | `hostname` |
| `IP_<safename>` | `ip` |
| `DC_HOST_<safename>` | `alias[0]`（如果 `is_dc`） |
| `DC_IP_<safename>` | `ip`（如果 `is_dc`） |
| `DC_HOST` / `DC_IP` | （如果 `is_current_dc`） |

### 当前用户导出的变量（`is_current: true`）

| 变量 | 值 |
|------|-----|
| `USER` / `USERNAME` / `CURRENT_USER` | `user` |
| `LOGIN` | `login` |
| `PASS` / `PASSWORD` | `password`（无 NT 哈希时） |
| `NT_HASH` | `nt_hash`（存在有效哈希时） |

### 自定义 Props

Host 和 UserCredential 都支持任意 `props`。以 `ENV_` 为前缀的键会作为环境变量导出（去掉前缀）：`props: { ENV_CUSTOM: "value" }` → `$CUSTOM=value`。

### 默认 Collects

包括 hashcat 模式/设备/哈希类型常量（如 `$HASH_NTLM=1000`），以及来自 `weaponized.lhost`、`weaponized.lport`、`weaponized.listenon` 和用户自定义 `weaponized.envs` 的配置值。

### VS Code 变量解析器

独立的系统（`platform/vscode/variables.ts`）解析字符串中的 `${workspaceFolder}`、`${file}`、`${env:VAR}`、`${config:VAR}`、`${command:CMD}` 占位符。由终端配置、扫描器命令和任务定义使用 — **不在**环境变量注入流水线中使用。

---

## 内嵌 MCP 服务器

### 架构

MCP 服务器在 **VS Code 扩展宿主内** 作为 Node.js `http.Server` 运行，而非独立进程。

```
外部 AI 工具                        VS Code 扩展宿主
(Claude Code, Cursor, ...)
     │                              ┌──────────────────────────────┐
     │  POST /mcp                   │  EmbeddedMcpServer           │
     │─────────────────────────────►│  http.Server 绑定 127.0.0.1  │
     │                              │                              │
     │                              │  每请求处理：                 │
     │                              │  new McpServer()             │
     │                              │  + StreamableHTTPTransport   │
     │                              │  + registerResources/Tools/  │
     │                              │    Prompts                   │
     │                              │                              │
     │◄─────────────────────────────│  从 Context 读取数据         │
     │  JSON 响应                    │  (HostState, UserState, ...) │
     │                              └──────────────────────────────┘
```

### 关键设计决策

- **传输协议**：`StreamableHTTPServerTransport`（来自 `@modelcontextprotocol/sdk` v1.29+）— **非** stdio 或 SSE
- **无状态**：`sessionIdGenerator: undefined` — 每个 HTTP 请求获得全新的 `McpServer` + transport，无会话持久化
- **单端点**：`POST /mcp` — 所有其他路径返回 404
- **仅本地**：绑定到 `127.0.0.1`，绝不绑定 `0.0.0.0`
- **端口策略**：尝试 `weaponized.mcp.port`（默认 `25789`），如被占用则回退到 OS 分配
- **配置门控**：`weaponized.ai.enabled`（默认 `true`）控制整个 MCP + AI 子系统

### MCP 配置（`mcp.json`）

```json
{
  "servers": {
    "weaponized": {
      "url": "http://127.0.0.1:<port>/mcp"
    }
  }
}
```

URL 条目（Streamable HTTP），而非 command+args（stdio）。每次激活时，`autoUpdateMcpJson()` 会静默修补端口。

### 注册的 MCP 工具（共 13 个）

| 工具 | 参数 | 描述 |
|------|------|------|
| `get_targets` | — | 所有已发现主机的 JSON |
| `get_credentials` | — | 所有已发现凭证的 JSON |
| `get_hosts_formatted` | `format`: env/hosts/yaml/table | 格式化的主机数据，可直接用于工具 |
| `get_credentials_formatted` | `format`: env/impacket/nxc/yaml/table | 格式化的凭证，适配渗透测试工具 |
| `get_graph` | — | 关系图，含攻击路径和 Mermaid 图 |
| `list_findings` | `severity?`、`tags?[]`、`query?` | 列出/搜索/过滤发现 |
| `get_finding` | `id` | 按 ID 获取特定发现 |
| `create_finding` | `title`、`severity?`、`tags?[]`、`description?`、`references?` | 创建发现笔记 |
| `update_finding_frontmatter` | `id`、`severity?`、`description?`、`props?` | 更新发现的 YAML frontmatter |
| `list_terminals` | — | 列出所有打开的 VS Code 终端 |
| `read_terminal` | `terminalId`（字符串：数字 ID 或终端名称）、`lines?` | 读取终端最近的输出 |
| `send_to_terminal` | `terminalId`、`command` | 向终端发送命令 |
| `create_terminal` | `profile?`、`name?`、`cwd?` | 创建终端（可选配置） |

### 注册的 MCP 资源（共 6 个）

| 资源 | URI | 内容 |
|------|-----|------|
| `hosts-list` | `hosts://list` | 所有主机数组 |
| `hosts-current` | `hosts://current` | 当前目标主机 |
| `users-list` | `users://list` | 所有凭证数组 |
| `users-current` | `users://current` | 当前用户 |
| `graph-relationships` | `graph://relationships` | 完整关系图 |
| `findings-list` | `findings://list` | 所有已解析的发现 |

### 注册的 MCP 提示词（共 2 个）

| 提示词 | 参数 | 用途 |
|--------|------|------|
| `analyze-output` | `output`（必需） | 在渗透环境上下文中分析工具输出 |
| `suggest-next-steps` | — | 基于当前状态建议下一步渗透测试操作 |

---

## 终端桥接与 Shell 集成

### 工作原理

```
VS Code 终端
     │
     │  onDidStartTerminalShellExecution (Shell Integration API)
     ▼
  TerminalBridge
     ├─ 按顺序 ID 跟踪终端
     ├─ 在内存中缓冲输出
     ├─ 每 500ms 刷新到磁盘
     ├─ 每终端上限 64KB（从前端截断）
     └─ 日志文件位于 <storageUri>/terminals/<id>.log
```

- **跟踪**：每个终端获得一个顺序整数 ID。查找支持 ID 和名称匹配。
- **输出捕获**：挂钩 `onDidStartTerminalShellExecution`，读取异步输出流，在内存中缓冲
- **基于配置的创建**：通过注册的 `TerminalProfileProvider` 支持 `netcat`、`msfconsole`、`meterpreter`、`web-delivery` 配置
- **清理**：终端关闭时，从映射中移除、清除缓冲区、删除日志文件

### Shell Integration 要求

没有 Shell Integration，`TerminalBridge` 无法捕获命令执行事件或输出。这影响 `read_terminal` 和输出日志 — `send_to_terminal` 和 `create_terminal` 不受影响。

---

## 报告生成 — Tarjan SCC 分析

`report` 笔记类型触发从 Foam 知识图谱动态构建的报告：

1. **构建图模型**：遍历所有 Foam 资源，从 wiki-links 构建节点/边，分离为主机边和用户边
2. **Tarjan SCC**：在用户边上运行强连通分量算法
3. **最长路径**：构建 SCC 的 DAG，通过拓扑排序 DP 找到最长路径 — 这代表权限提升链
4. **Mermaid 图**：从主机边和用户边生成 `graph TD` 图
5. **报告组装**：主机信息 → 关系图 → 攻击路径 → 额外被控用户

---

## 安全模型

### 凭证暴露矩阵

| 消费者 | 密码 | NT 哈希 | 机制 |
|--------|------|---------|------|
| Copilot Chat（`@weapon`） | 从不 | 从不 | `userContext.ts` 仅报告认证类型 |
| MCP `get_credentials` | 是 | 是 | 完整数据；MCP 客户端处理审批 |
| MCP `users://list` 资源 | 是 | 是 | 完整数据；MCP 客户端处理审批 |
| MCP 提示词（`suggest-next-steps`） | 是 | 是 | 提示词文本包含凭证供 LLM 使用；依赖 MCP 客户端审批 |
| 终端环境变量 | 是（`$PASS`） | 是（`$NT_HASH`） | 注入到用户自己的终端 |
| CodeLens 导出命令 | 是 | 是 | 显示在虚拟文档中（用户主动触发） |

### 其他安全措施

| 关注点 | 处理方式 |
|--------|---------|
| MCP 服务器绑定 | 仅 `127.0.0.1` — 不暴露到网络 |
| AI 功能门控 | `weaponized.ai.enabled` 可禁用整个 MCP + AI 子系统 |
| 命令执行 | 基于终端；用户在 VS Code UI 中可见所有命令 |
| SSL 验证 | HTTP 重放器禁用（用于渗透测试目标的自签名证书） |
| `AIService.redactCredentials()` | 从任意文本中去除凭证的单一控制点 |

---

## 测试策略

### 当前覆盖

测试**仅覆盖 `core/` 层** — 验证 `core/` 无 VS Code 依赖可独立测试的架构边界：

| 测试文件 | 覆盖范围 |
|---------|---------|
| `domain/host.test.ts` | `Host.init`、导出格式、`parseHostsYaml`、`dumpHosts` |
| `domain/user.test.ts` | `UserCredential.init`、导出格式、环境变量导出 |
| `domain/finding.test.ts` | `parseFindingNote`、`generateFindingMarkdown`、`filterFindings` |
| `domain/graph.test.ts` | `longestReferencePath`（Tarjan SCC 算法） |
| `env/collects.test.ts` | `envVarSafer`、`mergeCollects` |
| `markdown/fencedBlocks.test.ts` | `extractFencedBlocks`、`replaceFencedBlockContent` |
| `markdown/yamlBlocks.test.ts` | `extractYamlBlocks`、`extractYamlBlocksByIdentity` |

### 测试基础设施

- **框架**：`@vscode/test-cli` + `@vscode/test-electron` + Mocha
- **配置**：`.vscode-test.mjs` 定义 `unit` 标签
- **编译**：测试通过 `tsc`（非 webpack）编译到 `out/`
- **运行**：`pnpm run test:unit`

### 未覆盖区域与建议

| 区域 | 当前状态 | 建议 |
|------|---------|------|
| `features/` 层 | 无测试 | 使用模拟 VS Code API 的集成测试 |
| MCP 工具处理器 | 无测试 | 使用模拟 Context 测试请求→响应 |
| AI 提示词构建器 | 无测试 | 可单元测试（纯字符串函数） |
| `platform/vscode/variables.ts` | 无测试 | 复杂解析器；边缘情况测试很有价值 |

---

## 扩展指南 — 如何添加新组件

### 添加新的 Feature 模块

1. 创建 `src/features/<name>/`，包含：
   - `index.ts` — 桶重导出
   - `commands/` — 命令处理器函数（`callback` 类型）
   - （可选）`codelens/`，含 `register.ts`
2. 仅从 `core/`、`platform/`、`shared/` 导入
3. 在 `app/registerCommands.ts` 和/或 `app/registerCodeLens.ts` 中接线
4. 在 `app/activate.ts` 中注册激活（带 try/catch）

### 添加新的 MCP 工具

1. 在 `src/features/mcp/httpServer.ts` 的 `registerToolsAndResources` 函数中
2. 添加 `server.tool("tool_name", "description", { schema }, handler)`
3. Schema 使用 Zod 进行参数验证
4. Handler 从 `Context` 或 `TerminalBridge` 读取

### 添加新的 CodeLens 提供者

1. 创建提供者类或使用现有基类的生成器模式
2. 在 feature 的 `codelens/register.ts` 中注册
3. 在 `app/registerCodeLens.ts` 中接线

### 添加新的终端配置

1. 在 `features/terminal/profiles/` 中扩展 `BaseWeaponizedTerminalProvider`
2. 实现 `getInitialCommand()` 返回终端打开时发送的命令
3. 在 `package.json` → `contributes.terminal.profiles` 中注册
4. 在 `features/terminal/index.ts` 中接线

### 添加新的领域模型

1. 在 `core/domain/` 中创建 — **零 vscode 导入**
2. 实现 `init()` 工厂方法，如适用则实现 `exportEnvironmentCollects()`
3. 添加解析函数（如 `parseXxxYaml()`）
4. 在 `src/test/unit/core/domain/` 中编写单元测试
5. 从 `core/index.ts` 重导出
