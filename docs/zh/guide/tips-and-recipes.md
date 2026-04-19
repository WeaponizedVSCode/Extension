# 技巧与实战

使用 Weaponized VSCode 的实用技巧、配置参考和工作流程实战指南。

## 配置参考

### 核心设置

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `weaponized.lhost` | string | `$LHOST` | 反弹 Shell 使用的攻击者 IP，映射到 `$LHOST` 环境变量 |
| `weaponized.lport` | integer | `6879` | 反弹 Shell 使用的攻击者端口，映射到 `$LPORT` |
| `weaponized.listenon` | integer | `8890` | Web 投递监听端口，映射到 `$LISTEN_ON` |
| `weaponized.envs` | object | `{}` | 注入到终端的额外环境变量 |

### 工具路径

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `weaponized.hashcat` | string | `hashcat` | Hashcat 二进制文件路径 |
| `weaponized.msf.venom` | string | `msfvenom` | msfvenom 二进制文件路径 |
| `weaponized.msf.console` | string | `msfconsole` | msfconsole 二进制文件路径 |
| `weaponized.msf.resourcefile` | string | — | Metasploit 资源文件路径 |

### 终端命令

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `weaponized.netcat` | string | `rlwrap -I -cAr netcat -lvvp ${config:weaponized.lport}` | Netcat 处理器命令 |
| `weaponized.webdelivery` | string | `simplehttpserver -listen 0.0.0.0:${config:weaponized.listenon} -verbose -upload` | Web 投递服务器命令 |

### 扫描器

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `weaponized.scanners` | object | *（见下方）* | 扫描器名称到命令模板的映射 |

默认扫描器：
```json
{
  "rustscan": "rustscan -a $TARGET -- -A",
  "wfuzz subdomain": "wfuzz -c -w ${config:weaponized.user_vars.TOP_DNS} -H 'Host: FUZZ.$TARGET' --hc 400 http://$TARGET",
  "ffuf subdomain": "ffuf -w ${config:weaponized.user_vars.TOP_DNS} -H 'Host: FUZZ.$TARGET' -u http://$TARGET",
  "nuclei": "nuclei -target $TARGET",
  "dirsearch": "dirsearch -u http://$TARGET",
  "feroxbuster": "feroxbuster --url http://$TARGET"
}
```

### 用户变量

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `weaponized.user_vars` | object | *（Kali 路径）* | 用户自定义变量，通过 `${config:weaponized.user_vars.X}` 引用 |

默认用户变量包含常见的 Kali 路径：
```json
{
  "WORDLIST": "/usr/share/wordlists",
  "ROCKYOU": "/usr/share/wordlists/rockyou.txt",
  "SECLIST": "/usr/share/wordlists/seclists",
  "TOP_DNS": "/usr/share/wordlists/seclists/Discovery/DNS/bitquark-subdomains-top100000.txt"
}
```

### 录制

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `weaponized.terminal-log.enabled` | boolean | `false` | 激活时自动开始终端录制 |
| `weaponized.terminal-log.path` | string | `${workspaceFolder}/.vscode/.terminal.log` | 日志文件路径 |
| `weaponized.terminal-log.level` | enum | `command-only` | 录制模式：`command-only`、`output-only`、`command-and-output`、`netcat-handler` |

### AI 与 MCP

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `weaponized.ai.enabled` | boolean | `true` | 启用 @weapon 聊天和 MCP 服务器 |
| `weaponized.mcp.port` | integer | `25789` | MCP HTTP 服务器端口 |

## 环境变量速查表

### 目标变量（从 YAML host 块自动设置）

| 变量 | 来源 | 描述 |
|----------|--------|-------------|
| `$TARGET` | hostname（如果没有域名则使用 RHOST） | 主要目标标识符 |
| `$RHOST` | ip 字段 | 目标 IP 地址 |
| `$IP` | ip 字段 | 与 RHOST 相同 |
| `$DOMAIN` | 第一个别名或 hostname | 目标域名 |
| `$DC_IP` | ip（当 is_dc: true 时） | 域控制器 IP |
| `$DC_HOST` | 第一个别名（当 is_dc: true 时） | 域控制器主机名 |
| `$HOST_{name}` | ip 字段 | 多主机：按主机名获取 IP |
| `$IP_{name}` | ip 字段 | 多主机：按主机名获取 IP |

### 凭据变量（从 YAML credentials 块自动设置）

| 变量 | 来源 | 描述 |
|----------|--------|-------------|
| `$USER` | user 字段 | 当前用户名 |
| `$USERNAME` | user 字段 | 与 USER 相同 |
| `$PASS` | password 字段 | 当前密码 |
| `$PASSWORD` | password 字段 | 与 PASS 相同 |
| `$NT_HASH` | nt_hash 字段 | 当前 NTLM 哈希 |
| `$LOGIN` | login 字段 | 当前登录域 |
| `$CURRENT_USER` | user 字段 | USER 的别名 |
| `$CURRENT_PASS` | password 字段 | PASS 的别名 |
| `$USER_{name}` | user 字段 | 多用户：按名称获取用户名 |
| `$PASS_{name}` | password 字段 | 多用户：按名称获取密码 |
| `$NT_HASH_{name}` | nt_hash 字段 | 多用户：按名称获取哈希 |

### 连接变量（来自 settings.json）

| 变量 | 来源 | 描述 |
|----------|--------|-------------|
| `$LHOST` | `weaponized.lhost` | 攻击者 IP |
| `$LPORT` | `weaponized.lport` | 攻击者端口 |
| `$LISTEN_ON` | `weaponized.listenon` | Web 投递端口 |
| `$PROJECT_FOLDER` | 工作区根目录 | 项目目录路径 |

## 实战指南

### 实战 1：完整枚举工作流

1. **创建项目** → `weapon.setup`
2. **添加第一台主机** → `Weapon: Create note` → host → `target.htb`
3. **编辑主机笔记** → 将 IP 设置为 `10.10.10.10`，保存
4. **设为当前** → 点击 YAML 块上方的 "set as current" CodeLens
5. **运行扫描** → `Weapon: Run scanner` → 选择 rustscan
6. **录制输出** → 以 `command-and-output` 模式启动终端录制器
7. **查看结果** → 在主机笔记中记录开放端口
8. **创建发现** → 对每个漏洞执行 `Weapon: Create note` → finding

### 实战 2：凭据收集与复用

1. **捕获凭据** → `Weapon: Create note` → user → `admin@corp.local`
2. **填写 YAML** → 设置密码和/或 NT 哈希
3. **设为当前** → 凭据现已注入所有终端环境变量
4. **配合工具使用** → 在任意终端中：`impacket-psexec $LOGIN/$USER:$PASS@$TARGET`
5. **导出分享** → `Weapon: Dump users` → impacket 格式 → 复制给同事

### 实战 3：载荷与处理器流水线

1. **生成载荷** → `Weapon: Create msfvenom payload`
   - 选择 `windows/x64/meterpreter/reverse_tcp`，格式 `exe`
   - LHOST 和 LPORT 自动填充
2. **启动处理器** → 在载荷创建过程中会提供自动启动处理器的选项
   - 或手动操作：打开终端下拉菜单 → "meterpreter handler"
3. **投递载荷** → 打开终端下拉菜单 → "web delivery"
   - 使用显示的下载命令传输载荷
4. **捕获 Shell** → 处理器终端捕获 meterpreter 会话

### 实战 4：AI 辅助攻击

1. **连接 AI** → `Weapon: Install MCP server` → 在工作区中打开 Claude Code
2. **请求分析** → "读取终端 1 并告诉我 nmap 扫描发现了什么"
3. **自动创建发现** → "为你识别的每个关键服务创建一个 finding"
4. **获取建议** → 在 Copilot Chat 中使用 `@weapon /suggest`
5. **生成命令** → `@weapon /generate kerberoasting attack for the current domain`

### 实战 5：报告生成

1. **关联笔记** → 全程使用 `[[wiki-links]]`：`[[target.htb]]`、`[[admin]]`、`[[smb-signing]]`
2. **查看图谱** → `Foam: Show graph` → 验证攻击路径是否合理
3. **生成报告** → `Weapon: Create note` → report
4. **审阅** → 报告包含主机详情、权限提升路径和 Mermaid 图表

## 自定义技巧

### 添加自定义扫描器

```json
{
  "weaponized.scanners": {
    "nikto": "nikto -h http://$TARGET",
    "gobuster": "gobuster dir -u http://$TARGET -w ${config:weaponized.user_vars.SECLIST}/Discovery/Web-Content/directory-list-2.3-medium.txt",
    "enum4linux": "enum4linux-ng -A $TARGET",
    "bloodhound-python": "bloodhound-python -d $DOMAIN -u $USER -p $PASS -dc $DC_HOST -c all"
  }
}
```

### 自定义环境变量

添加项目特定的变量，它们会被注入到每个终端中：

```json
{
  "weaponized.envs": {
    "PROXY": "socks5://127.0.0.1:1080",
    "BURP": "http://127.0.0.1:8080",
    "SCOPE": "*.corp.local"
  }
}
```

### 覆盖字典路径（macOS/自定义 Linux）

```json
{
  "weaponized.user_vars": {
    "WORDLIST": "/opt/wordlists",
    "ROCKYOU": "/opt/wordlists/rockyou.txt",
    "SECLIST": "/opt/wordlists/seclists",
    "TOP_DNS": "/opt/wordlists/seclists/Discovery/DNS/bitquark-subdomains-top100000.txt"
  }
}
```

## 从 v0.4.x 迁移 {#migrating-from-v04x}

如果你使用过基于 Shell 的 Weaponized VSCode（1.0 之前的版本），以下是主要变化：

### 命令映射

| v0.4.x（Shell） | v1.0（扩展） | 备注 |
|-----------------|-------------------|-------|
| `weapon_vscode project` | `mkdir project && code project` + `weapon.setup` | 不再需要 Shell 启动器 |
| `set_current_host hostname` | `Weapon: Switch current host` 或 CodeLens "set as current" | 带 QuickPick 的图形界面 |
| `set_current_user username` | `Weapon: Switch current user` 或 CodeLens "set as current" | 带 QuickPick 的图形界面 |
| `dump_hosts` | `Weapon: Dump all hosts` | 4 种输出格式 |
| `dump_users` | `Weapon: Dump all user credentials` | 5 种输出格式（新增 nxc） |
| `current_status` | `Weapon: Dump all hosts`（env 格式） | 或在终端中检查环境变量 |
| `update_host_to_env` | *（自动）* | 文件保存时自动更新环境变量 |
| `update_user_cred_to_env` | *（自动）* | 文件保存时自动更新环境变量 |
| `Tasks: Run Task` → msfvenom | `Weapon: Create msfvenom payload` | 直接命令，无需 task.json |
| `Tasks: Run Task` → hashcat | `Weapon: Crack hashes with hashcat` | 直接命令 |
| `Tasks: Run Task` → rustscan | `Weapon: Run scanner over target` | 可配置扫描器 |
| `Tasks: Run Task` → run selection | CodeLens "Run command in terminal" | 点击任意代码块上方 |
| `Foam: Create Note From Template` | `Weapon: Create note` | 相同模板，更好的用户体验 |

### 架构变化

| 组件 | v0.4.x | v1.0 |
|-----------|--------|------|
| 环境变量 | Shell 脚本（`.vscode/env.zsh`、`createhackenv.sh`）在终端启动时加载 | VS Code `EnvironmentVariableCollection` API — 自动注入所有终端 |
| YAML 解析 | `yq` 命令行工具 | 原生 TypeScript YAML 解析器（内置于扩展中） |
| 主机/用户切换 | `set_current_host`/`set_current_user` zsh 函数 | 扩展命令，配合 QuickPick UI + CodeLens 内联按钮 |
| 状态存储 | `.vscode/env.zsh` 文件由 Shell 脚本重写 | VS Code `workspaceState`（持久化键值存储） |
| 终端配置 | `.zshrc` 别名和函数 | VS Code Terminal Profile API 提供程序 |
| 知识库 | 无 | 内置代码片段（GTFOBins、LOLBAS、BloodHound） |
| AI 集成 | 无 | @weapon Copilot Chat + 内嵌 MCP 服务器 |
| 代码执行 | 手动复制粘贴或 "run selection" 任务 | Shell/HTTP 代码块上的 CodeLens 按钮 |
| 报告生成 | 手动 | 从 Foam 图谱自动生成 |

### 保持不变的部分

- **Markdown 笔记是唯一信息源** — YAML host 和 credentials 块的工作方式完全相同
- **Foam 集成** — wiki-links、图谱可视化、模板
- **终端配置文件** — 同样的 4 个配置文件（meterpreter、msfconsole、netcat、web-delivery），现在是原生实现
- **`.vscode/.zshrc` 辅助工具** — 仍然可用于实用函数（differ、ntlm、url、proxys）
- **项目隔离** — 每个工作区独立，环境变量互不干扰

::: tip
你现有的 v0.4.x 项目笔记与 v1.0 完全兼容。只需打开项目文件夹，运行 `weapon.setup` 确保脚手架是最新的，然后开始使用新的扩展命令即可。无需迁移笔记。
:::

## 常见问题

**问：打开项目文件夹时扩展没有激活。**
答：扩展在检测到特定文件时激活（`.foam/templates/*.md`、`.vscode/settings.json`、`hosts/**/*.md` 等）。运行 `weapon.setup` 来创建预期的目录结构。

**问：终端中没有显示环境变量。**
答：在设置当前主机/用户后，打开一个 *新* 终端。现有终端不会获取环境变量的更改。同时请检查 YAML 块语法 — 必须是 `` ```yaml host `` 或 `` ```yaml credentials ``，类型关键字跟在 `yaml` 后面。

**问：MCP 服务器端口已被占用。**
答：在设置中更改 `weaponized.mcp.port`，或让扩展自动分配端口（如果默认端口被占用，会回退到操作系统分配的端口）。重新运行 `Weapon: Install MCP server` 以更新 `.vscode/mcp.json`。

**问：不安装 Foam 能用吗？**
答：大多数功能（命令、任务、终端、MCP）无需 Foam 即可使用。但图谱可视化、wiki-links 和报告生成需要 Foam。强烈建议安装。

**问：如何添加更多笔记模板？**
答：将 `.md` 文件添加到 `.foam/templates/` 目录。它们会出现在 Foam 的模板选择器中。扩展的 `Weapon: Create note` 命令使用自带的 5 种标准类型内置模板。
