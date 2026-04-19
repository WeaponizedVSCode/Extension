# 主机与凭证管理

本指南介绍在 Weaponized VSCode 中管理目标和凭证的日常工作流程。阅读完本指南后，你将了解如何创建主机和用户笔记、切换目标、以工具可用的格式导出数据，以及理解将一切联系在一起的环境变量机制。

如果你尚未设置工作区，请先阅读[快速上手](./getting-started.md)。

## 创建主机笔记

每次渗透测试都从目标开始。创建方法如下：

1. 打开命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`）
2. 运行 **Weapon: Create/New note (user/host/service/finding/report) from template**
3. 选择 **host**
4. 输入主机名（例如 `target`）

扩展会在以下路径创建一个新的 Markdown 笔记：

```
hosts/target/target.md
```

生成的笔记包含预填充的 YAML 主机块，以及端口、nmap 输出、漏洞和利用证明的骨架章节：

````markdown
```yaml host
- hostname: target
  is_dc: false
  ip: 10.10.10.10
  alias: ["target", "target.htb"]
```

## Ports

## Nmap

## Vulnerabilities

## Proof
````

编辑 `ip` 字段使其与实际目标匹配，添加所需的别名，然后保存文件。就这么简单——扩展会立即检测到变更。

::: tip
`alias` 数组是记录目标所有已知主机名的好地方。对于 HTB 或 OSCP 靶机，建议同时包含短名称和完全限定域名：`alias: ["target", "target.htb"]`。第一个别名对域控制器有特殊意义（见下方 [DC 处理](#dc-域控制器处理)）。
:::

## 主机 YAML 块 -- 字段参考

以下是包含所有字段说明的完整主机块：

```yaml
- hostname: dc01
  is_dc: true
  ip: 192.168.1.10
  alias: ["dc01.corp.local", "corp.local"]
  is_current: true
```

| 字段 | 类型 | 描述 |
|------|------|------|
| `hostname` | string | 主机的显示名称。用于 QuickPick 菜单、状态栏，以及切换主机时的标识键。 |
| `ip` | string | 目标 IP 地址。当此主机为当前目标时，映射为 `$RHOST` 和 `$IP`。 |
| `is_dc` | boolean | 标记此主机为域控制器。当值为 `true` 且此主机为当前目标时，扩展还会设置 `$DC_IP` 和 `$DC_HOST`（从第一个别名派生）。 |
| `alias` | string[] | 目标的备用主机名。当 `is_dc` 为 `true` 时，**第一个别名**将用作 DC 主机名。 |
| `is_current` | boolean | 由扩展管理。标记哪个主机是当前活动目标。你可以手动设置，但使用切换命令或 CodeLens 更方便。 |

::: warning
不要在不同文件中手动将多个主机设置为 `is_current: true`。扩展在切换时会重写所有 Markdown 文件中的该字段，以确保只有一个当前主机。如果你手动编辑造成冲突，下次切换操作会自动清理。
:::

## 切换主机

一旦你创建了一个或多个主机笔记，就可以随时切换活动目标。

### 通过命令面板

1. 打开命令面板
2. 运行 **Weapon: Switch current host**（命令 ID：`weapon.switch_host`）
3. QuickPick 菜单会列出所有已知主机，格式为 `hostname(ip)` —— 例如 `dc01(192.168.1.10)`
4. 选择你要切换的目标

后台执行的操作：

- 扩展扫描工作区中所有 Markdown 文件的 `yaml host` 块
- 将选中主机设置为 `is_current: true`，并将**所有文件**中的**所有其他主机**设置为 `is_current: false`
- 通过 VS Code 的 `EnvironmentVariableCollection` 立即更新环境变量
- 之后打开的任何新终端都会继承更新后的变量

### 通过 CodeLens

当你在编辑器中打开主机笔记时，会在 `yaml host` 块上方看到 CodeLens 操作。点击 **"set as current"** 即可在不离开文件的情况下切换到该主机。主机激活后，操作会变为 **"unset as current"**。

::: tip
CodeLens 切换在你浏览笔记并希望快速切换到另一个目标执行下一条命令时特别有用。无需打开命令面板——直接点击即可。
:::

## 导出主机

需要快速查看所有目标的概览，或者想要将其粘贴到 `/etc/hosts`？使用导出命令。

1. 打开命令面板
2. 运行 **Weapon: Dump all hosts**（命令 ID：`weapon.dump_hosts`）
3. 从 QuickPick 中选择输出格式

### 可用格式

**`env`** —— 可直接在 shell 中 source 的 export 语句：

```bash
export TARGET='dc01'
export RHOST='192.168.1.10'
export IP='192.168.1.10'
export HOST='dc01'
export DOMAIN='dc01'
```

**`hosts`** —— `/etc/hosts` 格式，每行一个主机及其所有别名：

```
192.168.1.10    dc01 dc01.corp.local corp.local
10.10.10.50     web01 web01.corp.local
```

**`yaml`** —— 原始 YAML，适用于备份或迁移：

```yaml
- hostname: dc01
  ip: 192.168.1.10
  is_dc: true
  alias: ["dc01.corp.local", "corp.local"]
```

**`table`** —— 人类可读的格式化表格：

```
Hostname    IP              DC?   Aliases
────────    ──              ───   ───────
dc01        192.168.1.10    yes   dc01.corp.local, corp.local
web01       10.10.10.50     no    web01.corp.local
```

输出会在 VS Code 中以新的只读虚拟文档打开，同时复制到剪贴板，方便你直接粘贴到终端或报告中。

::: tip
`hosts` 格式非常适合在需要 HTB 或实验室靶机的名称解析时追加到 `/etc/hosts`。导出、粘贴到 hosts 文件，搞定。
:::

---

## 创建用户笔记

凭证的操作模式与主机相同，但对于域账户有额外的便捷功能。

1. 打开命令面板
2. 运行 **Weapon: Create/New note (user/host/service/finding/report) from template**
3. 选择 **user**
4. 输入用户名

### `user@domain` 快捷方式

如果你输入 `user@domain` 格式的用户名，扩展会自动拆分：

- **`esonhugh@github.com`** 变为 `login: github.com`，`user: esonhugh`
- **`administrator@corp.local`** 变为 `login: corp.local`，`user: administrator`

这样你就不需要在创建后再编辑 YAML 块了。对于本地账户，只需输入不带 `@` 的用户名即可。

笔记创建在以下路径：

```
users/{name}/{name}.md
```

模板包含一个 `yaml credentials` 代码围栏块：

````markdown
```yaml credentials
- login: github.com
  user: esonhugh
  password: pass
  nt_hash: fffffffffffffffffffffffffffffffffff
```
````

填入实际密码或 NT 哈希，然后保存。

## 用户 YAML 块 -- 字段参考

```yaml
- login: corp.local
  user: administrator
  password: P@ssw0rd123
  nt_hash: fffffffffffffffffffffffffffffffffff
  is_current: true
```

| 字段 | 类型 | 描述 |
|------|------|------|
| `login` | string | 域名或服务标识符。映射为 `$LOGIN` 和 `$DOMAIN`（用于凭证上下文）。 |
| `user` | string | 用户名。映射为 `$USER`、`$USERNAME`、`$CURRENT_USER`。 |
| `password` | string | 明文密码。映射为 `$PASS`、`$PASSWORD`。 |
| `nt_hash` | string | NTLM 哈希。模板中以全 `f` 作为占位符——获取到实际哈希后替换即可。映射为 `$NT_HASH`。 |
| `is_current` | boolean | 由扩展管理。标记当前活动的凭证集。 |

::: info
你可以在单个笔记中定义多组凭证——例如，一个用户的密码和 NT 哈希作为单独的条目，或者在同一服务上发现的多个账户。每个条目都是单独的 YAML 列表项。
:::

## 切换用户

切换活动用户的操作与切换主机完全相同。

### 通过命令面板

1. 打开命令面板
2. 运行 **Weapon: Switch current user**（命令 ID：`weapon.switch_user`）
3. QuickPick 列出所有凭证，格式为 `user @ login` —— 例如 `administrator @ corp.local`
4. 选择你要使用的凭证

扩展会像处理主机一样，在所有 Markdown 文件中重写 `is_current`。选中用户的环境变量会立即推送到 VS Code 的 `EnvironmentVariableCollection`。

### 通过 CodeLens

点击任意 `yaml credentials` 块上方的 **"set as current"** 即可内联切换。

## 导出用户

用户的导出命令比主机提供更多格式，因为凭证需要被不同工具消费。

1. 打开命令面板
2. 运行 **Weapon: Dump all user credentials**（命令 ID：`weapon.dump_users`）
3. 选择格式

### 可用格式（共 5 种）

**`env`** —— 所有已知用户的 export 语句：

```bash
export USER='administrator'
export PASS='P@ssw0rd123'
export NT_HASH=''
export LOGIN='corp.local'
```

**`impacket`** —— Impacket 兼容格式，可直接用于 `secretsdump.py`、`psexec.py` 等工具：

```bash
'corp.local'/'administrator':'P@ssw0rd123'
'corp.local'/'svc_backup' -hashes ':5fbc3d5fec8206a30f4b6c473d68ae76'
```

**`nxc`** —— NetExec（前身为 CrackMapExec）兼容格式：

```bash
'corp.local' -u 'administrator' -p 'P@ssw0rd123'
'corp.local' -u 'svc_backup' -H ':5fbc3d5fec8206a30f4b6c473d68ae76'
```

**`yaml`** —— 所有凭证的原始 YAML 导出。

**`table`** —— 人类可读的格式化表格：

```
User            Login        Password       NT Hash
────            ─────        ────────       ───────
administrator   corp.local   P@ssw0rd123    —
svc_backup      corp.local   —              5fbc3d...ae76
```

与主机导出一样，输出会在只读虚拟文档中打开，并复制到剪贴板。

::: tip
`impacket` 和 `nxc` 格式是真正的效率利器。不必为每次工具调用手动构建凭证字符串，只需导出一次然后粘贴。结合 shell 历史记录，可以快速对多个账户进行枚举。
:::

---

## 环境变量 -- 工作原理

这是将主机和凭证与终端工作流联系在一起的核心机制。理解它将帮助你编写"开箱即用"的命令，无论当前活动的目标是哪个。

### 机制

当你切换主机或用户（通过命令面板、CodeLens 或文件保存）时，扩展会将环境变量写入 VS Code 的 **`EnvironmentVariableCollection`**。这是一个 VS Code API，用于向编辑器管理的每个终端会话注入变量。

结果是：**每个新终端自动继承当前目标的变量**。无需 shell 脚本，无需 source，无需 `.env` 文件。打开终端直接开始输入命令：

```bash
nmap -sC -sV $IP
crackmapexec smb $IP -u $USER -p $PASS
impacket-psexec $LOGIN/$USER:$PASS@$IP
```

### 单目标变量

这些变量反映**当前活动的**主机和用户：

| 变量 | 来源 | 描述 |
|------|------|------|
| `$TARGET` | 当前主机 | 主机名 |
| `$RHOST` | 当前主机 | IP 地址 |
| `$IP` | 当前主机 | IP 地址（`$RHOST` 的别名） |
| `$DOMAIN` | 当前主机 | 用作域名的主机名 |
| `$DC_IP` | 当前 DC 主机 | 域控制器 IP（仅当 `is_dc: true` 时） |
| `$DC_HOST` | 当前 DC 主机 | 来自第一个别名的 DC 主机名（仅当 `is_dc: true` 时） |
| `$USER` | 当前用户 | 用户名 |
| `$USERNAME` | 当前用户 | 用户名（`$USER` 的别名） |
| `$CURRENT_USER` | 当前用户 | 用户名（`$USER` 的别名） |
| `$PASS` | 当前用户 | 密码 |
| `$PASSWORD` | 当前用户 | 密码（`$PASS` 的别名） |
| `$NT_HASH` | 当前用户 | NTLM 哈希 |
| `$LOGIN` | 当前用户 | 登录域 |

### 多目标变量

除了上述"当前"变量外，扩展还会导出**按主机和按用户的变量**，以便你可以引用非当前目标：

```bash
# 按主机变量（主机名大写，点号替换为下划线）
$HOST_DC01          # dc01 的主机名
$IP_DC01            # dc01 的 IP

# 按用户变量
$USER_ADMINISTRATOR # 用户名
$PASS_ADMINISTRATOR # 密码
$NT_HASH_SVC_BACKUP # NT 哈希
```

当命令需要同时引用两个不同的主机或用户时，这非常有用——例如，从一台机器中继凭证到另一台机器。

### 项目和反向连接变量

| 变量 | 来源 | 描述 |
|------|------|------|
| `$PROJECT_FOLDER` | 工作区 | 工作区根目录的绝对路径 |
| `$LHOST` | `weaponized.lhost` 设置 | 你的攻击机 IP |
| `$LPORT` | `weaponized.lport` 设置 | 你的监听端口 |
| `$LISTEN_ON` | `weaponized.listenon` 设置 | 你的 HTTP 服务器端口 |

### 额外自定义变量

通过 `.vscode/settings.json` 中的 `weaponized.envs` 设置添加任意环境变量：

```json
{
  "weaponized.envs": {
    "WORDLIST_DIR": "/usr/share/wordlists",
    "PROXY": "http://127.0.0.1:8080",
    "TOOLS_DIR": "/opt/tools"
  }
}
```

这些变量与所有自动管理的变量一起导出。

::: info
变量在切换主机/用户和文件保存时更新。如果你直接在 YAML 块中编辑主机的 IP 并保存，对应的环境变量会立即在 `EnvironmentVariableCollection` 中更新。但是，**已打开的终端不会追溯更新**——你需要打开新终端才能获取更改。这是 VS Code 的限制，而非扩展的限制。
:::

---

## YAML 块上的 CodeLens 操作

CodeLens 在 YAML 块上方直接提供内联的可点击操作。这些操作让你无需离开正在阅读的笔记即可管理目标。

### `yaml host` 块上的操作

| 操作 | 功能 |
|------|------|
| **set as current** | 将此主机标记为所有文件中的活动目标。激活后变为 "unset as current"。 |
| **unset as current** | 移除此主机的 `is_current` 标记。 |
| **export to terminal** | 将此主机变量的 `export` 语句发送到活动终端。不改变 `is_current`。 |
| **export as current** | 将此主机设为当前目标**并**导出变量到活动终端。 |
| **Scan host** | 使用此主机的 IP 触发 `weapon.task.scan` 命令。启动你配置的扫描器（默认为 rustscan）。 |

### `yaml credentials` 块上的操作

| 操作 | 功能 |
|------|------|
| **set as current** | 将此凭证标记为所有文件中的活动凭证。 |
| **unset as current** | 移除 `is_current` 标记。 |
| **export to terminal** | 将此凭证的变量导出到活动终端。 |
| **export as current** | 设为当前凭证并导出。 |
| **dump as impacket** | 将此凭证格式化为 Impacket 样式并显示。 |
| **dump as nxc** | 将此凭证格式化为 NetExec 样式并显示。 |

::: tip
**"export to terminal"** 在你想临时使用不同凭证而不改变全局当前用户时特别方便。它仅将变量推送到活动终端，工作区范围内的当前用户保持不变。
:::

---

## DC（域控制器）处理

Active Directory 渗透测试通常需要同时跟踪目标主机和域控制器。Weaponized VSCode 通过 `is_dc` 标志来处理这一需求。

### 设置

在 DC 主机上设置 `is_dc: true`，并将 DC 的完全限定域名作为**第一个别名**：

```yaml
- hostname: dc01
  is_dc: true
  ip: 192.168.1.10
  alias: ["dc01.corp.local", "corp.local"]
```

### 当此主机为当前目标时的行为

当你切换到 `is_dc: true` 的主机时，扩展会设置标准主机变量**以及**：

| 变量 | 值 | 来源 |
|------|---|------|
| `$DC_IP` | `192.168.1.10` | 主机的 `ip` 字段 |
| `$DC_HOST` | `dc01.corp.local` | 数组中的**第一个别名** |

这意味着你可以编写明确引用 DC 的命令：

```bash
# 通过 DC 进行 Kerberoasting
impacket-GetUserSPNs $LOGIN/$USER:$PASS -dc-ip $DC_IP -request

# BloodHound 数据收集
bloodhound-python -u $USER -p $PASS -d $LOGIN -dc $DC_HOST -c all

# LDAP 查询
ldapsearch -H ldap://$DC_IP -b "DC=corp,DC=local" -D "$USER@$LOGIN" -w $PASS
```

### 多主机，一个 DC

在典型的 AD 渗透测试中，你可能有多个目标主机但只有一个 DC。仅在 DC 上设置 `is_dc: true`。当你切换到非 DC 主机时，`$DC_IP` 和 `$DC_HOST` 会保留上次选择的 DC 的值——它们不会被清除。这样，你可以在工作站和服务器之间切换，同时保持 DC 引用稳定。

::: warning
如果你的渗透测试涉及多个域和不同的 DC，请注意当前激活的是哪个 DC。切换到新的 DC 主机会覆盖 `$DC_IP` 和 `$DC_HOST`。如果不确定当前状态，可以使用 `weapon.dump_hosts` 的 `env` 格式进行验证。
:::

---

## 实战工作流示例

以下是一个真实的 AD 渗透测试工作流，展示各功能如何协同工作。

### 1. 设置主机

为每台发现的机器创建笔记：

```
Weapon: Create note → host → dc01
Weapon: Create note → host → web01
Weapon: Create note → host → sql01
```

编辑每个笔记，填入正确的 IP 和别名。标记 DC：

```yaml
# 在 hosts/dc01/dc01.md 中
- hostname: dc01
  is_dc: true
  ip: 192.168.1.10
  alias: ["dc01.corp.local", "corp.local"]
```

### 2. 发现凭证后添加

```
Weapon: Create note → user → administrator@corp.local
```

这会创建 `users/administrator/administrator.md`，内容为：

```yaml
- login: corp.local
  user: administrator
  password: pass
  nt_hash: fffffffffffffffffffffffffffffffffff
```

破解或转储出实际密码或哈希后更新。

### 3. 切换并攻击

```bash
# 终端 -- 切换后这些变量已自动设置
nmap -sC -sV -oA hosts/dc01/nmap $IP
crackmapexec smb $IP -u $USER -p $PASS --shares
impacket-secretsdump $LOGIN/$USER:$PASS@$IP
```

### 4. 转向另一台主机

使用命令面板或 CodeLens 切换到 `web01`。终端变量随即更新：

```bash
# $IP 现在是 web01 的 IP，$USER/$PASS 仍然是你当前的凭证
curl -v http://$IP/
gobuster dir -u http://$IP/ -w /usr/share/wordlists/dirb/common.txt
```

### 5. 导出用于报告

渗透测试结束时，导出所有数据：

- `weapon.dump_hosts` 使用 `table` 格式用于报告
- `weapon.dump_users` 使用 `table` 格式用于凭证附录
- `weapon.dump_hosts` 使用 `hosts` 格式用于记录 DNS 条目

---

## 从 v0.4.x 迁移

::: info 从基于 shell 的 Weaponized VSCode 迁移？

如果你之前使用的是基于 shell 的版本（v0.4.x），包含 `weapon_vscode`、`set_current_host` 等 shell 命令，以下是新旧命令的对应关系：

| 旧版（v0.4.x shell 命令） | 新版（VS Code 扩展） |
|---------------------------|---------------------|
| `set_current_host hostname` | 在命令面板中运行 **Weapon: Switch current host**，或点击 `yaml host` 块上方的 **"set as current"** CodeLens |
| `set_current_user username` | 在命令面板中运行 **Weapon: Switch current user**，或点击 `yaml credentials` 块上方的 **"set as current"** CodeLens |
| `dump_hosts` | **Weapon: Dump all hosts** 命令（`weapon.dump_hosts`） |
| `dump_users` | **Weapon: Dump all user credentials** 命令（`weapon.dump_users`） |
| `update_host_to_env` / `update_user_cred_to_env` | **自动完成。** 每次文件保存时，环境变量通过 `EnvironmentVariableCollection` 自动更新。无需手动操作。 |
| `current_status` | 查看 VS Code 状态栏，或运行 `weapon.dump_hosts` 的 `env` 格式查看所有当前变量。 |
| `zsh env-invoked` 块（在终端启动时运行） | **不再需要。** YAML 块由扩展原生解析。无需 shell source。如果仍需运行自定义 shell 命令，可使用常规 `zsh` 或 `bash` 代码围栏块配合 **"Run command in terminal"** CodeLens 操作。 |

核心工作流不变——笔记驱动一切。区别在于所有解析和环境管理现在都在 VS Code 扩展内部完成，而不是通过 shell 函数。
:::
