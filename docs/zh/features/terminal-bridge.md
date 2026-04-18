# 终端桥接

内存中的桥接层，使 MCP 服务器能够直接访问 VS Code 终端。MCP 服务器通过进程内 API 调用 `TerminalBridge` 的方法 — 没有基于文件的 IPC。

## 架构

```
MCP Server（进程内）            TerminalBridge（内存中）           VS Code Terminal API
─────────────────────           ──────────────────────────         ────────────────────
list_terminals       ──调用──►  getTerminals()          ──读取──►  terminalMap (Map)
read_terminal        ──调用──►  getTerminalOutput(id)   ──读取──►  磁盘日志 / 缓冲区
send_to_terminal     ──调用──►  sendCommandDirect(id)   ──调用──►  terminal.sendText()
create_terminal      ──调用──►  createTerminal(opts)    ──调用──►  window.createTerminal()
```

所有状态存储在内存中。唯一的磁盘 I/O 是定期刷新输出日志。

## 类：`TerminalBridge`

**源码**：`src/features/terminal/bridge.ts`

使用 `context.storageUri` 作为根目录构造。在 `activate()` 时：

1. 创建 `{storageUri}/terminals/` 目录用于存放日志文件。
2. 为每个已存在的终端分配一个从 1 开始的递增整数 ID，将映射存储在内存中的 `Map<vscode.Terminal, string>` 中。
3. 订阅 `onDidOpenTerminal` 和 `onDidCloseTerminal` 以保持映射的实时更新。
4. 订阅 `onDidStartTerminalShellExecution`（Shell Integration API）以捕获命令输出。
5. 启动 500ms 间隔定时器，将缓冲的输出刷新到磁盘。

## 终端跟踪

每个终端在首次出现时获得一个递增的字符串 ID（`"1"`、`"2"`、...），映射存储在 `terminalMap: Map<vscode.Terminal, string>` 中。

终端关闭时（`onDidCloseTerminal`），桥接层会：
- 从映射中移除该终端
- 删除其内存中的输出缓冲区
- 从磁盘删除其日志文件

## 输出捕获

需要终端中启用 **VS Code Shell Integration**。当 Shell 执行开始时：

1. 桥接层接收 `onDidStartTerminalShellExecution` 事件，获取命令行和异步输出流。
2. 在缓冲区前添加 `$ <command>\n`，然后从 `execution.read()` 读取数据块并追加。
3. 每 500ms，所有已变更的缓冲区被刷新到 `{storageUri}/terminals/{id}.log`。
4. 每个日志文件上限为 **64KB**。当写入超过该限制时，从头部截断内容（丢弃最旧的输出）。

如果未启用 Shell Integration，输出捕获将不工作。`send_to_terminal` 和 `create_terminal` 工具仍可正常使用。

## 暴露给 MCP 的 API

MCP 服务器注册了四个直接调用桥接方法的工具：

### `list_terminals`

调用 `bridge.getTerminals()`。返回数组：

```json
{ "id": "1", "name": "bash", "isActive": true, "cwd": "/home/user" }
```

`cwd` 仅在 Shell Integration 激活时可用（从 `terminal.shellIntegration.cwd` 读取）。

### `read_terminal`

调用 `bridge.getTerminalOutput(terminalId, lines)`。从磁盘读取日志文件，返回最后 N 行（默认 50）。接受数字 ID 或终端名称 — 如果 ID 不直接匹配日志文件，桥接层会按名称查找终端并解析为其数字 ID。

### `send_to_terminal`

调用 `bridge.sendCommandDirect(terminalId, command)`。通过 ID 或名称找到终端，然后调用 `terminal.sendText(command)` 并将终端带到前台。无论是否启用 Shell Integration 都可工作。

### `create_terminal`

调用 `bridge.createTerminal({ profile?, name?, cwd? })`。两种模式：

- **基于配置文件**：传入 `profile`，可选 `netcat`、`msfconsole`、`meterpreter`、`web-delivery`。桥接层查找已注册的 `TerminalProfileProvider`，调用 `provideTerminalProfile()` 获取终端选项，使用这些设置创建终端。
- **普通 Shell**：省略 `profile`（或传入 `"shell"`）。创建一个基本终端，可选自定义名称和工作目录。

返回新创建终端的 `{ id, name }`。

## 配置文件提供者

在激活过程中（`src/features/terminal/index.ts` 中的 `registerMcpBridge`），以下配置文件提供者被注册到桥接层：

| 配置文件键      | 提供者                                     | 用途                     |
|----------------|-------------------------------------------|--------------------------|
| `netcat`       | `NetcatWeaponizedTerminalProvider`        | 反向 Shell 监听器         |
| `msfconsole`   | `MsfconsoleWeaponizedTerminalProvider`    | Metasploit 控制台         |
| `meterpreter`  | `MeterpreterWeaponizedTerminalProvider`   | Meterpreter 处理器        |
| `web-delivery` | `WebDeliveryWeaponizedTerminalProvider`   | HTTP 文件服务器           |

## 终端查找

`sendCommandDirect` 和 `getTerminalOutput` 都接受数字 ID 字符串或终端名称。桥接层首先尝试在映射中精确匹配 ID，然后回退到按 `terminal.name` 匹配。

## 生命周期

- **激活**：由 `src/features/terminal/index.ts` 中的 `registerMcpBridge()` 调用，传入 `context.storageUri` 并设置配置文件提供者。
- **销毁**：清除刷新定时器，执行所有待处理缓冲区的最终刷新，并释放事件订阅。

## 关键文件

- `src/features/terminal/bridge.ts` — `TerminalBridge` 类
- `src/features/terminal/index.ts` — 桥接层激活与配置文件提供者注册
- `src/features/terminal/profiles.ts` — 终端配置文件提供者（netcat、msfconsole 等）
- `src/features/mcp/httpServer.ts` — 调用桥接方法的 MCP 工具定义
