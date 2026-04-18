# 架构概览

## 分层架构

本扩展采用严格的分层架构，具有清晰的依赖规则。

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

## 目录结构

```
src/
  extension.ts                    # 入口点（薄封装）
  app/
    activate.ts                   # 引导启动序列
    registerCommands.ts           # 中央命令注册表
    registerCodeLens.ts           # 中央 CodeLens 注册表
  core/                           # 纯领域逻辑
    domain/
      host.ts                     # Host 模型 + 环境变量导出
      user.ts                     # UserCredential 模型 + 环境变量导出
      finding.ts                  # Finding 接口 + 解析
      graph.ts                    # 关系图 + Tarjan SCC 算法
      foam.ts                     # Foam 扩展类型定义
      index.ts                    # 桶导出
    env/
      collects.ts                 # 环境变量集合工具
    markdown/
      fencedBlocks.ts             # 围栏代码块解析器
      yamlBlocks.ts               # 按标识提取 YAML 块
    index.ts                      # 桶重导出
  features/                       # 垂直功能模块
    ai/                           # Copilot Chat @weapon 参与者
    mcp/                          # 内嵌 MCP HTTP 服务器
    targets/                      # 主机/用户同步、切换、导出
    shell/                        # 从 Markdown 运行/复制命令
    http/                         # 原始 HTTP 请求重放器
    terminal/                     # 终端配置文件、录制器、MCP 桥接
    notes/                        # 报告生成、笔记 CodeLens
    tasks/                        # 扫描器、hashcat、msfvenom
    decoder/                      # CyberChef magic 解码器
    definitions/                  # BloodHound 悬停/跳转定义
    editor/                       # 虚拟文档、文本替换
    setup/                        # 工作区脚手架
  platform/vscode/
    context.ts                    # 全局状态单例
    logger.ts                     # OutputChannel 日志记录器
    variables.ts                  # VS Code 变量解析引擎
    defaultCollects.ts            # 默认环境变量集合
  shared/
    types.ts                      # 共享类型别名
    globs.ts                      # 文件 glob 模式
  snippets/                       # 捆绑的代码片段数据
  test/                           # 单元测试（镜像 core/ 结构）
```

---

## 核心数据流

本扩展围绕 **Markdown 即数据库** 构建：渗透测试状态以 YAML 围栏代码块的形式存储在 Markdown 文件中。

```
  工作区 Markdown 文件
  (hosts/*.md, users/*.md)
         │
         │  FileSystemWatcher
         ▼
  ┌─────────────────┐     extractYamlBlocksByIdentity()
  │  targets/sync   │────────────────────────────────────►  core/markdown/
  │  (文件监听器)    │                                       fencedBlocks.ts
  └────────┬────────┘                                       yamlBlocks.ts
           │
           │  Host.init() / UserCredential.init()
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
  提供者    ($TARGET,          (通过 Context 读取状态)
            $RHOST, ...)
```

### 详细步骤

1. **Markdown 文件** 包含 `` ```yaml host `` 和 `` ```yaml credentials `` 围栏块
2. **`targets/sync`** 监听文件变化，通过 `core/markdown` 提取 YAML 块，通过 `core/domain` 解析为领域对象
3. **`Context`** 将 `Host[]` / `UserCredential[]` 存储在 VS Code `workspaceState` 中，使用脏标记缓存
4. **环境变量注入**：遍历所有主机/用户，调用 `exportEnvironmentCollects()`，设置到 `EnvironmentVariableCollection` — 终端接收 `$TARGET`、`$RHOST`、`$USER`、`$PASS` 等变量
5. **CodeLens 提供者** 扫描 Markdown 并提供内联操作（运行、复制、切换主机、发送 HTTP）
6. **MCP 服务器** 通过 HTTP 对外暴露相同状态，供外部 AI 客户端使用
7. **AI 参与者**（`@weapon`）通过 `AIService` 读取状态并构建上下文感知的提示词

---

## 激活序列

```
extension.ts
  └─► activate.ts: activateExtension(context)
        ├─ Context.context = context
        ├─ dependencyCheck()           // Foam 已安装？工作区已打开？
        ├─ registerTargetsSync()       // 文件监听器 + 初始扫描
        ├─ registerCommands()          // 14 个 weapon.* 命令
        ├─ registerCodeLens()          // YAML、shell、HTTP、notes
        ├─ registerTerminalUtils()     // 终端配置文件 + 录制器
        ├─ registerDefinitionProvider() // BloodHound 悬停
        └─ if (ai.enabled)
             ├─ registerMcpBridge()    // 终端输出捕获
             ├─ EmbeddedMcpServer.start()
             ├─ autoUpdateMcpJson()
             └─ registerAIFeatures()   // @weapon 参与者
```

每个注册操作都包裹在 try/catch 中 — 一个子系统的失败不会阻塞其他子系统。

---

## 功能模块模式

每个功能都遵循相同的内部结构：

```
features/<name>/
  index.ts              # 桶导出 + 注册函数
  commands/             # 命令处理器（导出为回调函数）
  codelens/             # CodeLens 提供者 + 注册
    register.ts         # registerXxxCodeLens(context)
    *Provider.ts        # 具体提供者类
```

注册遵循：`export function registerXxx(context: ExtensionContext)`

订阅始终推送到 `context.subscriptions` 以实现自动释放。

---

## 状态管理

所有可变状态都通过 `Context` 流转 — 一个静态单例类：

```typescript
// 读取（缓存，从 workspaceState 重新水合）
const hosts = Context.HostState;      // Host[] | undefined
const users = Context.UserState;      // UserCredential[] | undefined
const foam  = await Context.Foam();   // Foam | undefined

// 写入（持久化到 workspaceState，标记缓存为脏）
Context.HostState = updatedHosts;
Context.UserState = updatedUsers;
```

脏标记模式避免了重复反序列化：
- Getter 仅在脏标记设置时才从 `workspaceState` 读取并通过 `.init()` 重新水合
- Setter 写入 `workspaceState` 并设置脏标记

---

## MCP 服务器架构

内嵌的 MCP 服务器在扩展宿主中作为 Node.js HTTP 服务器运行：

```
外部 AI 工具                        VS Code 扩展宿主
(Claude Code, Cursor, ...)
     │                              ┌──────────────────────────┐
     │  POST /mcp                   │  EmbeddedMcpServer       │
     │─────────────────────────────►│  (http.Server 127.0.0.1) │
     │                              │                          │
     │                              │  每个请求：               │
     │                              │  McpServer + Transport   │
     │                              │                          │
     │                              │  ┌─ Resources ──────┐   │
     │                              │  │ hosts, users,     │   │
     │                              │  │ findings, graph   │   │
     │                              │  └──────────────────┘   │
     │                              │  ┌─ Tools ──────────┐   │
     │                              │  │ get_targets,      │   │
     │                              │  │ create_finding,   │   │
     │                              │  │ send_to_terminal, │   │
     │                              │  │ ...               │   │
     │◄─────────────────────────────│  └──────────────────┘   │
     │  JSON 响应                    └──────────────────────────┘
```

关键设计：**每请求无状态** — 每个 HTTP 请求获得一个全新的 `McpServer` + `StreamableHTTPServerTransport`。无会话持久化。这简化了内嵌模型，因为扩展已经在 `Context` 中保存了所有状态。

---

## 安全模型

| 关注点 | 处理方式 |
|--------|---------|
| AI 上下文中的凭证 | `AIService` 从不向 LLM 发送密码/哈希 — 仅发送元数据（"auth: password"） |
| MCP 凭证访问 | 读取工具返回完整数据；MCP 客户端处理用户审批 |
| 命令执行 | 基于终端；用户可见所有命令；MCP 工具有日志记录 |
| SSL 验证 | HTTP 重放器禁用（用于渗透测试目标）；已在文档中说明 |
| MCP 服务器绑定 | 仅 `127.0.0.1` — 不暴露到网络 |
