# 快速开始

## 什么是 Weaponized VSCode？

Weaponized VSCode 是一个 VS Code 扩展，将你的编辑器转变为渗透测试和红队行动的**集成开发与攻击环境（ID&AE）**。

它解决的核心问题是：**工具和信息的碎片化**。在典型的渗透测试工作流中，你需要不断在终端、笔记应用、浏览器、文本编辑器和代理工具之间切换。这种上下文切换浪费时间，造成信息孤岛，并使工作难以复现或审计。

Weaponized VSCode 将一切统一到单一工作区中：

- **笔记即数据库** — Markdown 文件中的 YAML 块定义了主机、凭据和发现。编辑笔记，终端环境会自动更新。
- **命令存在于笔记中** — Shell、HTTP 和 PowerShell 代码块可通过编辑器中的 CodeLens 按钮直接执行。
- **工具已集成** — msfvenom、hashcat、rustscan 和自定义扫描器可从命令面板启动，参数自动填充。
- **知识已内嵌** — GTFOBins、LOLBAS 和 BloodHound 代码片段在你输入时自动出现。
- **AI 理解你的上下文** — `@weapon` Copilot Chat 参与者和内嵌 MCP 服务器让 AI 助手完全了解你的目标和发现。

### 设计原则

1. **工作区即项目** — 每个渗透测试任务对应一个 VS Code 工作区。打开文件夹，整个环境（目标、凭据、环境变量、历史记录）即刻恢复。
2. **笔记驱动的工作流** — "写好笔记，执行任务。"每个主机、用户、服务和发现都是结构化的 Markdown 笔记，驱动自动化流程。
3. **上下文感知的自动化** — 设置一次当前主机/用户；所有命令、任务和终端配置文件自动使用正确的参数。
4. **可扩展的工具链** — 该扩展不替代你的工具，而是编排它们。通过设置添加自定义扫描器、终端命令和字典路径。
5. **内嵌知识库** — 安全知识（GTFOBins、LOLBAS、BloodHound）以代码片段和定义的形式提供，无需离开编辑器。

## 前提条件

### 必需

- **Visual Studio Code** 1.96.0 或更高版本
- **Foam** 扩展 (`foam.foam-vscode`) — 提供 wiki-link、图形可视化和笔记模板

### 推荐

以下工具用于特定功能。扩展在没有它们的情况下也能工作，但相应的命令将不会生效。

| 工具 | 使用场景 | 备注 |
|------|---------|------|
| `metasploit-framework` | Payload 生成、meterpreter handler、msfconsole 终端 | `msfvenom` 和 `msfconsole` 二进制文件 |
| `hashcat` | 哈希破解任务 | 推荐使用 GPU |
| `rustscan` | 默认扫描器 | 可配置其他扫描器 |
| `simplehttpserver` | Web 投递终端 | 或任何支持 PUT 上传的 HTTP 服务器 |
| `rlwrap` | Netcat handler 终端 | 为 netcat 添加 readline 支持 |
| `zsh` | `.vscode/.zshrc` 中的 Shell 辅助功能 | Kali Linux 默认 Shell |

> **Kali Linux** 开箱即用地包含了大多数这些工具。在 macOS 上，考虑使用 [OrbStack](https://orbstack.dev/) 来获取 Linux 环境。

### 推荐扩展

设置完成后，VS Code 会建议安装推荐的扩展。最重要的有：

- `foam.foam-vscode` — 知识图谱和 wiki-link（必需）
- `redhat.vscode-yaml` — 主机/凭据块的 YAML 验证
- `ms-vscode-remote.remote-ssh` — 在目标机器上进行远程开发

## 安装

### 从 VSIX 安装

1. 从 [Releases 页面](https://github.com/WeaponizedVSCode/Extension/releases) 下载 `.vsix` 文件
2. 在 VS Code 中，打开命令面板 (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. 运行 **Extensions: Install from VSIX...** 并选择下载的文件

### 从 Marketplace 安装

在 VS Code 扩展侧边栏中搜索 **Weaponized** 并安装 `WeaponizedVSCode.core`。

你也可以从 [OpenVSX](https://open-vsx.org/extension/WeaponizedVSCode/core) 安装。

## 设置你的第一个工作区

### 步骤 1：创建项目文件夹

为你的任务创建一个目录：

```bash
mkdir -p ~/workspace/hackthebox/target.htb
code ~/workspace/hackthebox/target.htb
```

### 步骤 2：初始化工作区

打开命令面板 (`Ctrl+Shift+P` / `Cmd+Shift+P`) 并运行：

```
Weapon: Setup/Create/Init weaponized vscode folder in current workspace
```

这将创建以下结构：

```
your-project/
├── .foam/
│   └── templates/          # 笔记模板（主机、用户、服务、发现）
├── .vscode/
│   ├── .zshrc              # Shell 辅助功能（虚拟环境、历史记录、工具函数）
│   ├── extensions.json     # 推荐扩展列表
│   ├── msfconsole.rc       # Metasploit 资源文件模板
│   └── settings.json       # 预配置的扩展设置
├── hosts/                  # 主机笔记（按需创建）
├── users/                  # 用户笔记（按需创建）
├── services/               # 服务笔记（按需创建）
└── findings/               # 发现笔记（按需创建）
```

### 步骤 3：配置你的环境

打开 `.vscode/settings.json` 并设置你的攻击者参数：

```json
{
  "weaponized.lhost": "10.10.14.5",
  "weaponized.lport": 4444,
  "weaponized.listenon": 8080
}
```

这些值会填充到每个新终端的 `$LHOST`、`$LPORT` 和 `$LISTEN_ON` 环境变量中。

### 步骤 4：Shell 辅助功能设置

初始化后，扩展会检查你的 `~/.zshrc` 是否包含 `weapon_vscode_launch_helper` 函数。如果缺少，它将：

1. 打开你的 `~/.zshrc` 进行编辑
2. 将辅助函数复制到你的剪贴板

粘贴并重新加载你的 Shell。此辅助函数会在你在工作区中打开终端时自动加载项目的 `.vscode/.zshrc`，使你可以使用 `differ()`、`ntlm()`、`url()` 和 `proxys()` 等工具函数。

### 步骤 5：创建你的第一个主机

打开命令面板并运行：

```
Weapon: Create/New note (user/host/service/finding/report) from template
```

选择 **host**，输入目标主机名（例如 `target`），一个新笔记将在 `hosts/target/target.md` 创建，包含预填充的 YAML 主机块：

````markdown
```yaml host
- hostname: target
  is_dc: false
  ip: 10.10.10.10
  alias: ["target"]
```
````

编辑 IP 地址，保存文件，即可开始使用。打开一个新终端 — 环境变量 `$TARGET`、`$RHOST` 和 `$IP` 会自动设置。

## 工作区导览

### 命令面板命令

所有扩展命令都可通过命令面板 (`Ctrl+Shift+P`) 使用。它们以 **Weapon:** 为前缀。

| 命令 | 功能说明 |
|---------|-------------|
| `Weapon: Setup` | 初始化工作区结构 |
| `Weapon: Switch current host` | 从笔记中设置当前活动主机 |
| `Weapon: Switch current user` | 从笔记中设置当前活动用户 |
| `Weapon: Dump all hosts` | 以 env/hosts/yaml/table 格式导出主机 |
| `Weapon: Dump all user credentials` | 以 env/impacket/nxc/yaml/table 格式导出用户 |
| `Weapon: Create msfvenom payload` | 交互式 payload 构建器 |
| `Weapon: Crack hashes with hashcat` | 交互式 hashcat 启动器 |
| `Weapon: Run scanner over target` | 启动可配置的扫描器 |
| `Weapon: Decode selected text` | 在 CyberChef 中打开选中的文本 |
| `Weapon: Start terminal logger` | 开始记录终端活动 |
| `Weapon: Stop terminal logger` | 停止记录 |
| `Weapon: Create note` | 创建主机/用户/服务/发现/报告笔记 |
| `Weapon: Install MCP server` | 写入 `.vscode/mcp.json` 用于 AI 客户端集成 |

### CodeLens 操作

在 `hosts/`、`users/` 或 `services/` 下编辑 Markdown 文件时，你会在代码块上方看到可点击的操作：

- **`yaml host` 块**："set as current" / "export to terminal" / "Scan host"
- **`yaml credentials` 块**："set as current" / "dump as impacket" / "dump as nxc"
- **`zsh`/`bash`/`sh`/`powershell` 块**："Run command in terminal" / "Copy commands"
- **`http` 块**："Send HTTP Request" / "Send HTTPS Request" / "Copy in curl"

### 终端配置

从终端下拉菜单（`+` 按钮）创建专用终端：

- **meterpreter handler** — 启动 multi/handler 监听器
- **msfconsole** — 使用你的 RC 文件启动 msfconsole
- **netcat handler** — rlwrap + netcat 监听器，附带反向 Shell 速查表
- **web delivery** — 用于文件传输的 HTTP 服务器，附带下载/上传命令

## 下一步

- [主机与凭据管理](./host-management.md) — 深入了解目标管理
- [攻击工作流](./offensive-workflows.md) — CodeLens、HTTP 重放器、任务
- [笔记与报告](./notes-and-reports.md) — Foam 集成和报告生成
- [终端工具](./terminal-tools.md) — 终端配置和录制
- [AI 与 MCP 集成](./ai-and-mcp.md) — AI 对话和外部 AI 客户端设置
- [技巧与方案](./tips-and-recipes.md) — 配置参考和实用工作流

---

::: info 从 v0.4.x 迁移？
如果你之前使用的是基于 Shell 的 Weaponized VSCode（使用 `weapon_vscode`、`set_current_host`、`dump_hosts` 等 Shell 命令），请参阅技巧与方案中的[迁移表](./tips-and-recipes.md#migrating-from-v04x)。核心工作流保持不变 — 笔记仍然驱动一切 — 但所有 Shell 命令现已成为原生 VS Code 扩展命令。
:::
