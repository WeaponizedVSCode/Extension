# Shell 命令执行

从 Markdown 代码块中直接执行 Shell 命令。

## 支持的代码块类型

- ```` ```bash ````
- ```` ```sh ````
- ```` ```zsh ````
- ```` ```powershell ````

## CodeLens 操作

每个 Shell 代码块显示两个按钮：

- **Run command in terminal** — 将代码块内容发送到活动终端执行（如无终端则自动创建）
- **Copy commands** — 将代码块内容复制到剪贴板

## 变量替换

命令可以使用从当前渗透状态自动填充的环境变量：

```bash
nmap -sS -sV $RHOST
crackmapexec smb $RHOST -u $USER -p $PASS
evil-winrm -i $RHOST -u $USER -p $PASS
```

## 关键文件

- `src/features/shell/commands/runCommand.ts` — 终端执行
- `src/features/shell/commands/copy.ts` — 剪贴板复制
- `src/features/shell/codelens/commandProvider.ts` — 代码块检测与 CodeLens 生成
