# 架构概览

## 前置条件与安装

### 必需依赖

- **VS Code** >= 1.101.0
- **Foam 扩展**（`foam.foam-vscode`）— 知识管理骨架。扩展激活时会检查 Foam，没有它将无法正常工作。
- **Shell Integration** — VS Code 的 Shell 集成必须在终端中启用，`TerminalBridge` 才能捕获输出。现代 VS Code 默认启用，但用户设置可以禁用。

### 可选工具依赖

这些外部工具通过终端调用，不打包在扩展内：

| 工具 | 使用方 | 用途 |
|------|--------|------|
| `msfvenom` / `msfconsole` | 载荷生成、终端配置 | Metasploit 框架 |
| `hashcat` | 密码破解任务 | 哈希破解 |
| `rustscan`、`nuclei`、`dirsearch`、`feroxbuster`、`ffuf`、`wfuzz` | 网络扫描 | 可配置的扫描命令 |
| `rlwrap`、`netcat` | 终端配置 | 反向 Shell 处理 |

---

## 分层架构

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
| `features/*` | `core/`、`platform/`、`shared/` | 其他 feature 模块 |
| `platform/vscode/` | `core/`、`shared/`、`vscode` API | `features/` |
| `core/` | 仅 `shared/` | `vscode`、`platform/`、`features/` |
| `shared/` | 无（叶子节点） | 其他所有层 |

关键边界：**`core/` 完全没有 VS Code 导入**。所有领域逻辑都是纯 TypeScript，无需 VS Code 运行时即可测试。

---

## 工作区设计

### `weapon.setup` — 脚手架

`weapon.setup` 命令**仅**创建 `.vscode/` 配置目录：

```
<workspace>/
  .vscode/
    .zshrc              # Shell 环境：venv 激活、历史记录、辅助函数
    extensions.json     # 推荐的 VS Code 扩展
    msfcnosole.rc       # Metasploit 控制台资源文件
    settings.json       # 武器化扩展默认设置
```

这 4 个模板文件通过 base64 编码嵌入在扩展中。Python 脚本 `scripts/gen-setup.py` 读取 `resources/setup-template/.vscode/*` 并生成 `src/features/setup/assets.ts`，其中包含 `{ path: atob(content) }` 形式的 TypeScript 映射。Setup 只写入不存在的文件 — 从不覆盖。

文件创建后，`weapon.setup` 会检查用户的 `~/.zshrc` 是否包含 `weapon_vscode_launch_helper` 函数。如果未找到，它会将辅助函数复制到剪贴板并打开 `~/.zshrc` 供手动粘贴。此辅助函数在 VS Code 终端打开时 source `.vscode/.zshrc`，启用 venv 激活、代理设置和实用函数。

### 工作区目录约定

使用扩展后，典型的工作区结构如下：

```
<workspace>/
  .vscode/                          # 扩展配置（由 weapon.setup 创建）
    .zshrc
    settings.json
    mcp.json                        # MCP 服务器配置（由 weapon.mcp.install 创建）
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

文件发现 glob 为 `**/{users,hosts,services}/{*.md,*/*.md}` — 匹配 `users/`、`hosts/` 或 `services/` 目录内一级或两级的 `.md` 文件。

### 笔记模板

笔记模板通过 `scripts/gen-report-assets.py` 嵌入，该脚本将 `resources/foam/templates/` 中的文件 base64 编码到 `src/features/notes/reports/assets.ts`。`weapon.note.creation` 命令提供 5 种笔记类型：

| 类型 | 模板来源 | 创建位置 | 关键内容 |
|------|---------|---------|---------|
| `host` | `resources/foam/templates/host.md` | `hosts/<name>/<name>.md` | `yaml host` 块（hostname、ip、is_dc、alias、props）、端口、nmap、漏洞 |
| `user` | `resources/foam/templates/user.md` | `users/<name>/<name>.md` | `yaml credentials` 块（login、user、password、nt_hash、props）、权限 |
| `service` | `resources/foam/templates/service.md` | `services/<name>/<name>.md` | 服务别名、位置、漏洞 |
| `finding` | `resources/foam/templates/finding.md` | `findings/<name>/<name>.md` | 严重程度、标签、描述、参考链接 |
| `report` | 动态生成 | `report.md`（工作区根目录） | 通过 Foam 图分析从所有笔记聚合 |

笔记名中的 `@` 字符作为分隔符解析：`admin@example.com` → id=`admin`，domain=`example_com`。

---

## 核心数据流 — Markdown 即数据库

本扩展围绕 **Markdown 即数据库** 构建：渗透测试状态以 YAML 围栏代码块的形式存储在 Markdown 文件中。

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

- **冷扫描**（`init`）：清除所有状态，扫描所有匹配文件，重建主机/用户列表
- **文件变更**（`onDidChange`）：重新处理变更文件，合并到现有状态（增量式 — 从文件中删除 YAML 块不会移除主机/用户，直到完整重扫描）
- **文件删除**（`onDidDelete`）：触发完整冷扫描以正确移除被删除的条目
- **去重**：在去重前反转列表，因此给定 hostname 或 login/user 对的最新添加条目优先

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

## 内嵌 MCP 服务器设计

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
- **无状态**：`sessionIdGenerator: undefined` — 每个 HTTP 请求获得全新的 `McpServer` + transport，无会话持久化。扩展的 `Context` 单例保存所有状态。
- **单端点**：`POST /mcp` — 所有其他路径返回 404
- **仅本地**：绑定到 `127.0.0.1`，绝不绑定 `0.0.0.0`
- **端口策略**：尝试 `weaponized.mcp.port`（默认 `25789`），如被占用则回退到操作系统分配的端口。无范围扫描 — 二选一。
- **配置门控**：`weaponized.ai.enabled`（默认 `true`）控制整个 MCP + AI 子系统

### MCP 配置（`mcp.json`）

`weapon.mcp.install` 命令写入 `.vscode/mcp.json`：

```json
{
  "servers": {
    "weaponized": {
      "url": "http://127.0.0.1:<port>/mcp"
    }
  }
}
```

这是 URL 条目（Streamable HTTP），而非 command+args 条目（stdio）。每次激活时，`autoUpdateMcpJson()` 会静默修补端口（如果条目已存在）。

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
| `read_terminal` | `terminalId`、`lines?` | 读取终端最近的输出 |
| `send_to_terminal` | `terminalId`、`command` | 向终端发送命令 |
| `create_terminal` | `profile?`、`name?`、`cwd?` | 创建终端（可选配置：netcat/msfconsole/meterpreter/web-delivery） |

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

`TerminalBridge` 类为 MCP 工具提供终端交互能力。它**依赖 VS Code Shell Integration** 来捕获输出。

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

没有 Shell Integration，`TerminalBridge` 无法捕获命令执行事件或输出。用户必须确保终端配置已启用 Shell 集成（VS Code 默认启用）。这影响 `read_terminal` 和输出日志 — `send_to_terminal` 和 `create_terminal` 不受影响。

---

## 报告生成 — Tarjan SCC 分析

`report` 笔记类型触发从 Foam 知识图谱动态构建的报告：

1. **构建图模型**：遍历所有 Foam 资源，从 wiki-links 构建节点/边，分离为主机边和用户边
2. **Tarjan SCC**：在用户边上运行强连通分量算法
3. **最长路径**：构建 SCC 的 DAG，通过拓扑排序 DP 找到最长路径 — 这代表权限提升链
4. **Mermaid 图**：从主机边和用户边生成 `graph TD` 图
5. **报告组装**：主机信息 → 关系图 → 攻击路径 → 额外被控用户

---

## 激活序列

```
extension.ts
  └─► activate.ts: activateExtension(context)
        ├─ Context.context = context
        ├─ dependencyCheck()            // Foam 已安装？工作区已打开？
        ├─ registerTargetsSync()        // 文件监听器 + 初始冷扫描
        ├─ registerCommands()           // 14 个 weapon.* 命令
        ├─ registerCodeLens()           // YAML、shell、HTTP、notes
        ├─ registerTerminalUtils()      // 终端配置 + 录制器
        ├─ registerDefinitionProvider() // BloodHound 悬停
        └─ if (weaponized.ai.enabled)
             ├─ registerMcpBridge()     // TerminalBridge + 配置提供者
             ├─ EmbeddedMcpServer.start(bridge, port)
             ├─ autoUpdateMcpJson(port) // 修补 .vscode/mcp.json
             └─ registerAIFeatures()    // @weapon Copilot Chat 参与者
```

每个注册操作都包裹在 try/catch 中 — 一个子系统的失败不会阻塞其他子系统。

---

## 安全模型

| 关注点 | 处理方式 |
|--------|---------|
| AI 上下文中的凭证 | `AIService` 从不向 LLM 发送密码/哈希 — 仅发送 "auth: password" / "auth: NT hash" |
| MCP 凭证访问 | `get_credentials` 返回完整数据；MCP 客户端处理用户审批 |
| 命令执行 | 基于终端；用户在 VS Code UI 中可见所有命令 |
| SSL 验证 | HTTP 重放器禁用（用于渗透测试目标的自签名证书） |
| MCP 服务器绑定 | 仅 `127.0.0.1` — 不暴露到网络 |
| AI 功能门控 | `weaponized.ai.enabled` 设置可禁用整个 MCP + AI 子系统 |
