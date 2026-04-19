# Host & Credential Management

This guide covers the day-to-day workflow for managing targets and credentials in Weaponized VSCode. By the end, you will know how to create host and user notes, switch between targets, dump them in tool-ready formats, and understand the environment variables that glue everything together.

If you haven't set up a workspace yet, start with [Getting Started](./getting-started.md).

## Creating Host Notes

Every engagement starts with a target. To create one:

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **Weapon: Create/New note (user/host/service/finding/report) from template**
3. Select **host**
4. Enter the hostname (e.g., `target`)

The extension creates a new Markdown note at:

```
hosts/target/target.md
```

The generated note contains a pre-filled YAML host block, plus skeleton sections for ports, nmap output, vulnerabilities, and proof of exploitation:

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

Edit the `ip` field to match your actual target, add any aliases you need, and save the file. That's it — the extension picks up the change immediately.

::: tip
The `alias` array is a good place to record all known hostnames for a target. For HTB or OSCP machines, include both the short name and the FQDN: `alias: ["target", "target.htb"]`. The first alias has special significance for domain controllers (see [DC Handling](#dc-domain-controller-handling) below).
:::

## Host YAML Block — Field Reference

Here is a complete host block with every field explained:

```yaml
- hostname: dc01
  is_dc: true
  ip: 192.168.1.10
  alias: ["dc01.corp.local", "corp.local"]
  is_current: true
```

| Field | Type | Description |
|-------|------|-------------|
| `hostname` | string | Display name for the host. Used in QuickPick menus, status bar, and as the key when switching hosts. |
| `ip` | string | Target IP address. Maps to `$RHOST` and `$IP` when this host is current. |
| `is_dc` | boolean | Marks this host as a domain controller. When `true` and this host is current, the extension also sets `$DC_IP` and `$DC_HOST` (derived from the first alias). |
| `alias` | string[] | Alternative hostnames for the target. The **first alias** is used as the DC hostname when `is_dc` is `true`. |
| `is_current` | boolean | Managed by the extension. Marks which host is the active target. You can set it manually, but using the switch command or CodeLens is easier. |

::: warning
Do not manually set `is_current: true` on multiple hosts in different files. The extension enforces a single current host by rewriting this field across all Markdown files when you switch. If you edit it by hand and create a conflict, the next switch operation will clean it up.
:::

## Switching Hosts

Once you have one or more host notes, you can switch the active target at any time.

### Via Command Palette

1. Open the Command Palette
2. Run **Weapon: Switch current host** (command ID: `weapon.switch_host`)
3. A QuickPick menu appears listing all known hosts in the format `hostname(ip)` — for example, `dc01(192.168.1.10)`
4. Select the target you want

What happens behind the scenes:

- The extension scans every Markdown file in the workspace for `yaml host` blocks
- It sets `is_current: true` on the selected host and `is_current: false` on **all other hosts** across **all files**
- Environment variables are updated immediately via VS Code's `EnvironmentVariableCollection`
- Any new terminal you open inherits the updated variables

### Via CodeLens

When you have a host note open in the editor, you will see CodeLens actions above the `yaml host` block. Click **"set as current"** to switch to that host without leaving the file. The action toggles to **"unset as current"** once the host is active.

::: tip
CodeLens switching is particularly useful when you are reading through your notes and want to quickly pivot to a different target for your next command. No need to open the Command Palette — just click.
:::

## Dumping Hosts

Need a quick overview of all your targets, or want to paste them into `/etc/hosts`? Use the dump command.

1. Open the Command Palette
2. Run **Weapon: Dump all hosts** (command ID: `weapon.dump_hosts`)
3. Choose an output format from the QuickPick

### Available Formats

**`env`** — Export statements ready for shell sourcing:

```bash
export TARGET='dc01'
export RHOST='192.168.1.10'
export IP='192.168.1.10'
export HOST='dc01'
export DOMAIN='dc01'
```

**`hosts`** — `/etc/hosts` format, one line per host with all aliases:

```
192.168.1.10    dc01 dc01.corp.local corp.local
10.10.10.50     web01 web01.corp.local
```

**`yaml`** — Raw YAML, useful for backup or migration:

```yaml
- hostname: dc01
  ip: 192.168.1.10
  is_dc: true
  alias: ["dc01.corp.local", "corp.local"]
```

**`table`** — Human-readable formatted table:

```
Hostname    IP              DC?   Aliases
────────    ──              ───   ───────
dc01        192.168.1.10    yes   dc01.corp.local, corp.local
web01       10.10.10.50     no    web01.corp.local
```

The output opens in a new virtual read-only document inside VS Code and is also copied to your clipboard, so you can paste it directly into a terminal or report.

::: tip
The `hosts` format is perfect for appending to `/etc/hosts` when you need name resolution for HTB or lab machines. Dump, paste into your hosts file, done.
:::

---

## Creating User Notes

Credentials follow the same pattern as hosts, but with a twist for domain-joined accounts.

1. Open the Command Palette
2. Run **Weapon: Create/New note (user/host/service/finding/report) from template**
3. Select **user**
4. Enter the username

### The `user@domain` Shortcut

If you enter a username in `user@domain` format, the extension automatically splits it:

- **`esonhugh@github.com`** becomes `login: github.com`, `user: esonhugh`
- **`administrator@corp.local`** becomes `login: corp.local`, `user: administrator`

This saves you from editing the YAML block after creation. For local accounts, just enter the username without an `@`.

The note is created at:

```
users/{name}/{name}.md
```

The template contains a `yaml credentials` fenced block:

````markdown
```yaml credentials
- login: github.com
  user: esonhugh
  password: pass
  nt_hash: fffffffffffffffffffffffffffffffffff
```
````

Fill in the actual password or NT hash, and save.

## User YAML Block — Field Reference

```yaml
- login: corp.local
  user: administrator
  password: P@ssw0rd123
  nt_hash: fffffffffffffffffffffffffffffffffff
  is_current: true
```

| Field | Type | Description |
|-------|------|-------------|
| `login` | string | Domain name or service identifier. Maps to `$LOGIN` and `$DOMAIN` (for credential context). |
| `user` | string | Username. Maps to `$USER`, `$USERNAME`, `$CURRENT_USER`. |
| `password` | string | Plaintext password. Maps to `$PASS`, `$PASSWORD`. |
| `nt_hash` | string | NTLM hash. The template fills this with all `f`'s as a placeholder — replace it with the actual hash when you have one. Maps to `$NT_HASH`. |
| `is_current` | boolean | Managed by the extension. Marks the active credential set. |

::: info
You can define multiple credentials in a single note — for example, a user's password and their NT hash as separate entries, or multiple accounts discovered on the same service. Each entry is a separate YAML list item.
:::

## Switching Users

Switching the active user works identically to switching hosts.

### Via Command Palette

1. Open the Command Palette
2. Run **Weapon: Switch current user** (command ID: `weapon.switch_user`)
3. The QuickPick lists all credentials in the format `user @ login` — for example, `administrator @ corp.local`
4. Select the credential you want

The extension rewrites `is_current` across all Markdown files, the same as with hosts. Environment variables for the selected user are pushed to VS Code's `EnvironmentVariableCollection` immediately.

### Via CodeLens

Click **"set as current"** above any `yaml credentials` block to switch inline.

## Dumping Users

The dump command for users offers more formats than hosts, since credentials need to be consumed by different tools.

1. Open the Command Palette
2. Run **Weapon: Dump all user credentials** (command ID: `weapon.dump_users`)
3. Choose a format

### Available Formats (5 total)

**`env`** — Export statements for all known users:

```bash
export USER='administrator'
export PASS='P@ssw0rd123'
export NT_HASH=''
export LOGIN='corp.local'
```

**`impacket`** — Impacket-compatible format, ready for tools like `secretsdump.py`, `psexec.py`, etc.:

```bash
'corp.local'/'administrator':'P@ssw0rd123'
'corp.local'/'svc_backup' -hashes ':5fbc3d5fec8206a30f4b6c473d68ae76'
```

**`nxc`** — NetExec (formerly CrackMapExec) compatible format:

```bash
'corp.local' -u 'administrator' -p 'P@ssw0rd123'
'corp.local' -u 'svc_backup' -H ':5fbc3d5fec8206a30f4b6c473d68ae76'
```

**`yaml`** — Raw YAML dump of all credentials.

**`table`** — Human-readable formatted table:

```
User            Login        Password       NT Hash
────            ─────        ────────       ───────
administrator   corp.local   P@ssw0rd123    —
svc_backup      corp.local   —              5fbc3d...ae76
```

As with host dumps, the output opens in a virtual read-only document and is copied to your clipboard.

::: tip
The `impacket` and `nxc` formats are the real time-savers here. Instead of manually building credential strings for every tool invocation, dump once and paste. Combine with shell history for rapid-fire enumeration across multiple accounts.
:::

---

## Environment Variables — How It Works

This is the mechanism that ties hosts and credentials to your terminal workflow. Understanding it will help you write commands that "just work" regardless of which target is active.

### The Mechanism

When you switch hosts or users (via Command Palette, CodeLens, or file save), the extension writes environment variables to VS Code's **`EnvironmentVariableCollection`**. This is a VS Code API that injects variables into every terminal session managed by the editor.

The result: **every new terminal automatically inherits the current target's variables**. No shell scripts, no sourcing, no `.env` files. Open a terminal and start typing:

```bash
nmap -sC -sV $IP
crackmapexec smb $IP -u $USER -p $PASS
impacket-psexec $LOGIN/$USER:$PASS@$IP
```

### Single-Target Variables

These reflect the **currently active** host and user:

| Variable | Source | Description |
|----------|--------|-------------|
| `$TARGET` | Current host | Hostname |
| `$RHOST` | Current host | IP address |
| `$IP` | Current host | IP address (alias for `$RHOST`) |
| `$DOMAIN` | Current host | Hostname used as domain |
| `$DC_IP` | Current DC host | Domain controller IP (only if `is_dc: true`) |
| `$DC_HOST` | Current DC host | DC hostname from first alias (only if `is_dc: true`) |
| `$USER` | Current user | Username |
| `$USERNAME` | Current user | Username (alias for `$USER`) |
| `$CURRENT_USER` | Current user | Username (alias for `$USER`) |
| `$PASS` | Current user | Password |
| `$PASSWORD` | Current user | Password (alias for `$PASS`) |
| `$NT_HASH` | Current user | NTLM hash |
| `$LOGIN` | Current user | Login domain |

### Multi-Target Variables

In addition to the "current" variables above, the extension also exports **per-host and per-user variables** so you can reference non-current targets:

```bash
# Per-host variables (hostname is uppercased, dots replaced with underscores)
$HOST_DC01          # hostname of dc01
$IP_DC01            # IP of dc01

# Per-user variables
$USER_ADMINISTRATOR # username
$PASS_ADMINISTRATOR # password
$NT_HASH_SVC_BACKUP # NT hash
```

This is useful when a command needs to reference two different hosts or users at once — for example, relaying credentials from one machine to another.

### Project and Reverse Connection Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `$PROJECT_FOLDER` | Workspace | Absolute path to workspace root |
| `$LHOST` | `weaponized.lhost` setting | Your attacker IP |
| `$LPORT` | `weaponized.lport` setting | Your listener port |
| `$LISTEN_ON` | `weaponized.listenon` setting | Your HTTP server port |

### Extra Custom Variables

Add arbitrary environment variables through the `weaponized.envs` setting in `.vscode/settings.json`:

```json
{
  "weaponized.envs": {
    "WORDLIST_DIR": "/usr/share/wordlists",
    "PROXY": "http://127.0.0.1:8080",
    "TOOLS_DIR": "/opt/tools"
  }
}
```

These are exported alongside all the automatically managed variables.

::: info
Variables update on host/user switch and on file save. If you edit a host's IP directly in the YAML block and save, the corresponding environment variables update in the `EnvironmentVariableCollection` immediately. However, **already-open terminals do not retroactively update** — you need to open a new terminal to pick up the changes. This is a VS Code limitation, not an extension limitation.
:::

---

## CodeLens Actions on YAML Blocks

CodeLens provides inline, clickable actions directly above your YAML blocks. These actions let you manage targets without leaving the note you are reading.

### On `yaml host` Blocks

| Action | What It Does |
|--------|-------------|
| **set as current** | Marks this host as the active target across all files. Toggles to "unset as current" once active. |
| **unset as current** | Removes the `is_current` flag from this host. |
| **export to terminal** | Sends `export` statements for this host's variables to the active terminal. Does not change `is_current`. |
| **export as current** | Sets this host as current **and** exports variables to the active terminal. |
| **Scan host** | Triggers the `weapon.task.scan` command with this host's IP pre-populated. Launches your configured scanner (rustscan by default). |

### On `yaml credentials` Blocks

| Action | What It Does |
|--------|-------------|
| **set as current** | Marks this credential as active across all files. |
| **unset as current** | Removes the `is_current` flag. |
| **export to terminal** | Exports this credential's variables to the active terminal. |
| **export as current** | Sets as current and exports. |
| **dump as impacket** | Formats this credential in Impacket style and displays it. |
| **dump as nxc** | Formats this credential in NetExec style and displays it. |

::: tip
**"export to terminal"** is especially handy when you want to temporarily use a different credential without changing the global current user. It pushes the variables to your active terminal only, leaving the workspace-wide current user unchanged.
:::

---

## DC (Domain Controller) Handling

Active Directory engagements often require you to track both a target host and the domain controller simultaneously. Weaponized VSCode handles this with the `is_dc` flag.

### Setup

Set `is_dc: true` on your DC host and put the DC's fully qualified domain name as the **first alias**:

```yaml
- hostname: dc01
  is_dc: true
  ip: 192.168.1.10
  alias: ["dc01.corp.local", "corp.local"]
```

### What Happens When This Host Is Current

When you switch to a host with `is_dc: true`, the extension sets the standard host variables **plus**:

| Variable | Value | Source |
|----------|-------|--------|
| `$DC_IP` | `192.168.1.10` | The host's `ip` field |
| `$DC_HOST` | `dc01.corp.local` | The **first alias** in the array |

This means you can write commands that reference the DC explicitly:

```bash
# Kerberoasting via the DC
impacket-GetUserSPNs $LOGIN/$USER:$PASS -dc-ip $DC_IP -request

# BloodHound collection
bloodhound-python -u $USER -p $PASS -d $LOGIN -dc $DC_HOST -c all

# LDAP queries
ldapsearch -H ldap://$DC_IP -b "DC=corp,DC=local" -D "$USER@$LOGIN" -w $PASS
```

### Multiple Hosts, One DC

In a typical AD engagement, you might have several target hosts but only one DC. Set `is_dc: true` only on the DC. When you switch to a non-DC host, `$DC_IP` and `$DC_HOST` remain set from the last DC you selected — they are not cleared. This way, you can switch between workstations and servers while keeping your DC reference stable.

::: warning
If your engagement spans multiple domains with different DCs, be mindful of which DC is currently active. Switching to a new DC host will overwrite `$DC_IP` and `$DC_HOST`. Use `weapon.dump_hosts` with `env` format to verify your current state if you are unsure.
:::

---

## Practical Workflow Example

Here is a realistic workflow for an AD pentest to show how everything fits together.

### 1. Set Up Hosts

Create notes for each discovered machine:

```
Weapon: Create note → host → dc01
Weapon: Create note → host → web01
Weapon: Create note → host → sql01
```

Edit each note with the correct IPs and aliases. Mark the DC:

```yaml
# In hosts/dc01/dc01.md
- hostname: dc01
  is_dc: true
  ip: 192.168.1.10
  alias: ["dc01.corp.local", "corp.local"]
```

### 2. Add Credentials as You Find Them

```
Weapon: Create note → user → administrator@corp.local
```

This creates `users/administrator/administrator.md` with:

```yaml
- login: corp.local
  user: administrator
  password: pass
  nt_hash: fffffffffffffffffffffffffffffffffff
```

Update with the actual password or hash when you crack or dump it.

### 3. Switch and Attack

```bash
# Terminal — these vars are already set after switching
nmap -sC -sV -oA hosts/dc01/nmap $IP
crackmapexec smb $IP -u $USER -p $PASS --shares
impacket-secretsdump $LOGIN/$USER:$PASS@$IP
```

### 4. Pivot to Another Host

Use the Command Palette or CodeLens to switch to `web01`. Your terminal variables update:

```bash
# $IP is now web01's IP, $USER/$PASS still your current creds
curl -v http://$IP/
gobuster dir -u http://$IP/ -w /usr/share/wordlists/dirb/common.txt
```

### 5. Dump for Reporting

At the end of the engagement, dump everything:

- `weapon.dump_hosts` with `table` format for your report
- `weapon.dump_users` with `table` format for the credentials appendix
- `weapon.dump_hosts` with `hosts` format to document DNS entries

---

## Migration from v0.4.x

::: info Migrating from shell-based Weaponized VSCode?

If you previously used the shell-based version (v0.4.x) with `weapon_vscode`, `set_current_host`, and similar shell commands, here is how the commands map to the new extension:

| Old (v0.4.x shell command) | New (VS Code extension) |
|----------------------------|------------------------|
| `set_current_host hostname` | **Weapon: Switch current host** in Command Palette, or click **"set as current"** CodeLens above a `yaml host` block |
| `set_current_user username` | **Weapon: Switch current user** in Command Palette, or click **"set as current"** CodeLens above a `yaml credentials` block |
| `dump_hosts` | **Weapon: Dump all hosts** command (`weapon.dump_hosts`) |
| `dump_users` | **Weapon: Dump all user credentials** command (`weapon.dump_users`) |
| `update_host_to_env` / `update_user_cred_to_env` | **Automatic.** Environment variables update on every file save via `EnvironmentVariableCollection`. No manual step needed. |
| `current_status` | Check the VS Code status bar, or run `weapon.dump_hosts` with `env` format to see all current variables. |
| `zsh env-invoked` blocks (ran on terminal start) | **No longer needed.** YAML blocks are parsed natively by the extension. No shell sourcing required. For custom shell commands you still want to run, use regular `zsh` or `bash` fenced code blocks with the **"Run command in terminal"** CodeLens action. |

The core workflow is the same — notes drive everything. The difference is that all parsing and environment management now happens inside the VS Code extension rather than through shell functions.
:::
