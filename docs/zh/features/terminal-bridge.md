# 终端桥接

双向文件 IPC 层，将 VS Code 终端与 MCP 服务器桥接。

## 架构

```
Extension Host                .weapon-state/              MCP Server (Node.js)
──────────────                ──────────────              ──────────────────────
跟踪终端         ──写入──►  terminals.json       ◄──读取──  list_terminals
捕获输出         ──写入──►  terminals/{id}.log   ◄──读取──  read_terminal
监听命令         ◄──读取──  terminal-input.json  ──写入──  send_to_terminal
```

## 工作原理

`TerminalBridge` 类在每个工作区文件夹中激活，执行以下操作：

1. **跟踪所有打开的终端** — 分配数字 ID，将元数据写入 `terminals.json`
2. **捕获命令输出** — 使用 VS Code Shell Integration API（`onDidStartTerminalShellExecution` + `execution.read()`）将输出流写入每个终端的 `.log` 文件
3. **监听输入命令** — 监视 `terminal-input.json` 文件获取来自 MCP 服务器的命令请求，通过 `terminal.sendText()` 分发到目标终端
4. **管理输出大小** — 每个日志文件上限 64KB（保留尾部）
5. **定期刷新** — 缓冲输出，每 500ms 刷新一次以减少 I/O

## 状态文件

| 文件 | 内容 |
|------|------|
| `.weapon-state/terminals.json` | `{id, name, isActive, cwd}` 数组 |
| `.weapon-state/terminals/{id}.log` | 每个终端的滚动输出日志 |
| `.weapon-state/terminal-input.json` | `{terminalId, command}` — 读取后即消费 |

## 终端查找

命令可以通过数字 ID 或终端名称来定位目标终端。

## 关键文件

- `src/features/terminal/bridge.ts` — TerminalBridge 实现
- `src/features/terminal/index.ts` — 桥接激活
