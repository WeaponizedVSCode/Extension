# 终端录制器

将终端命令和输出捕获到日志文件，用于渗透记录。

## 前置条件

需要 VS Code **Shell Integration** 处于 Rich 模式。在 Shell 配置文件中添加：

**Zsh**（`.zshrc`）：
```bash
[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path zsh)"
```

**Bash**（`.bashrc`）：
```bash
[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path bash)"
```

## 命令

| 命令 | ID | 说明 |
|------|-----|------|
| 开始/注册终端日志 | `weaponized.terminal-logger.register` | 开始录制 |
| 停止/注销终端日志 | `weaponized.terminal-logger.unregister` | 停止录制 |

## 配置选项

启动时可选择：

1. **日志文件路径**：默认 `${workspaceFolder}/.vscode/.terminal.log`
2. **日志级别**：
   - `command-only` — 仅记录命令
   - `output-only` — 仅记录输出
   - `command-and-output` — 同时记录命令和输出
   - `netcat-handler` — 专为 netcat 会话设计的模式
3. **终端选择**：指定终端 PID 或所有终端

## 自动启用

```json
{
  "weaponized.terminal-log.enabled": true,
  "weaponized.terminal-log.path": "${workspaceFolder}/.vscode/.terminal.log",
  "weaponized.terminal-log.level": "command-and-output"
}
```

## 日志格式

```
weaponized-terminal-logging:[1701234567890][terminalid: 12345][terminalName: zsh] user@/home/kali/project$ nmap -sS 10.10.10.100
```

## 关键文件

- `src/features/terminal/recorder/index.ts` — 开始/停止逻辑
- `src/features/terminal/recorder/record_append.ts` — 捕获监听器
- `src/features/terminal/recorder/store.ts` — 捕获注册表
- `src/features/terminal/recorder/mode.ts` — 模式定义
