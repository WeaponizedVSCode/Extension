# Tips & Recipes

Practical tips, configuration reference, and workflow recipes for getting the most out of Weaponized VSCode.

## Configuration Reference

### Core Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `weaponized.lhost` | string | `$LHOST` | Attacker IP for reverse shells. Maps to `$LHOST` env var |
| `weaponized.lport` | integer | `6879` | Attacker port for reverse shells. Maps to `$LPORT` |
| `weaponized.listenon` | integer | `8890` | Web delivery listen port. Maps to `$LISTEN_ON` |
| `weaponized.envs` | object | `{}` | Extra environment variables injected into terminals |

### Tool Paths

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `weaponized.hashcat` | string | `hashcat` | Hashcat binary path |
| `weaponized.msf.venom` | string | `msfvenom` | msfvenom binary path |
| `weaponized.msf.console` | string | `msfconsole` | msfconsole binary path |
| `weaponized.msf.resourcefile` | string | — | Metasploit resource file path |

### Terminal Commands

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `weaponized.netcat` | string | `rlwrap -I -cAr netcat -lvvp ${config:weaponized.lport}` | Netcat handler command |
| `weaponized.webdelivery` | string | `simplehttpserver -listen 0.0.0.0:${config:weaponized.listenon} -verbose -upload` | Web delivery server command |

### Scanners

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `weaponized.scanners` | object | *(see below)* | Map of scanner name → command template |

Default scanners:
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

### User Variables

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `weaponized.user_vars` | object | *(Kali paths)* | User-defined variables, referenced via `${config:weaponized.user_vars.X}` |

Default user variables include common Kali paths:
```json
{
  "WORDLIST": "/usr/share/wordlists",
  "ROCKYOU": "/usr/share/wordlists/rockyou.txt",
  "SECLIST": "/usr/share/wordlists/seclists",
  "TOP_DNS": "/usr/share/wordlists/seclists/Discovery/DNS/bitquark-subdomains-top100000.txt"
}
```

### Recording

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `weaponized.terminal-log.enabled` | boolean | `false` | Auto-start terminal recording on activation |
| `weaponized.terminal-log.path` | string | `${workspaceFolder}/.vscode/.terminal.log` | Log file path |
| `weaponized.terminal-log.level` | enum | `command-only` | Recording mode: `command-only`, `output-only`, `command-and-output`, `netcat-handler` |

### AI & MCP

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `weaponized.ai.enabled` | boolean | `true` | Enable @weapon chat and MCP server |
| `weaponized.mcp.port` | integer | `25789` | MCP HTTP server port |

## Environment Variable Quick Reference

### Target Variables (Auto-set from YAML host blocks)

| Variable | Source | Description |
|----------|--------|-------------|
| `$TARGET` | hostname (or RHOST if no domain) | Primary target identifier |
| `$RHOST` | ip field | Target IP address |
| `$IP` | ip field | Same as RHOST |
| `$DOMAIN` | first alias or hostname | Target domain |
| `$DC_IP` | ip (when is_dc: true) | Domain Controller IP |
| `$DC_HOST` | first alias (when is_dc: true) | Domain Controller hostname |
| `$HOST_{name}` | ip field | Multi-host: IP by hostname |
| `$IP_{name}` | ip field | Multi-host: IP by hostname |

### Credential Variables (Auto-set from YAML credentials blocks)

| Variable | Source | Description |
|----------|--------|-------------|
| `$USER` | user field | Current username |
| `$USERNAME` | user field | Same as USER |
| `$PASS` | password field | Current password |
| `$PASSWORD` | password field | Same as PASS |
| `$NT_HASH` | nt_hash field | Current NTLM hash |
| `$LOGIN` | login field | Current login domain |
| `$CURRENT_USER` | user field | Alias for USER |
| `$CURRENT_PASS` | password field | Alias for PASS |
| `$USER_{name}` | user field | Multi-user: username by name |
| `$PASS_{name}` | password field | Multi-user: password by name |
| `$NT_HASH_{name}` | nt_hash field | Multi-user: hash by name |

### Connection Variables (From settings.json)

| Variable | Source | Description |
|----------|--------|-------------|
| `$LHOST` | `weaponized.lhost` | Attacker IP |
| `$LPORT` | `weaponized.lport` | Attacker port |
| `$LISTEN_ON` | `weaponized.listenon` | Web delivery port |
| `$PROJECT_FOLDER` | workspace root | Project directory path |

## Practical Recipes

### Recipe 1: Full Enumeration Workflow

1. **Create project** → `weapon.setup`
2. **Add first host** → `Weapon: Create note` → host → `target.htb`
3. **Edit the host note** → set IP to `10.10.10.10`, save
4. **Set as current** → click "set as current" CodeLens above the YAML block
5. **Run scan** → `Weapon: Run scanner` → select rustscan
6. **Record output** → start terminal recorder in `command-and-output` mode
7. **Review results** → document open ports in the host note
8. **Create findings** → for each vulnerability, `Weapon: Create note` → finding

### Recipe 2: Credential Harvesting and Reuse

1. **Capture credentials** → `Weapon: Create note` → user → `admin@corp.local`
2. **Fill in YAML** → set password and/or NT hash
3. **Set as current** → credentials are now in all terminal env vars
4. **Use with tools** → in any terminal: `impacket-psexec $LOGIN/$USER:$PASS@$TARGET`
5. **Dump for sharing** → `Weapon: Dump users` → impacket format → copy to colleague

### Recipe 3: Payload and Handler Pipeline

1. **Generate payload** → `Weapon: Create msfvenom payload`
   - Select `windows/x64/meterpreter/reverse_tcp`, format `exe`
   - LHOST and LPORT auto-populated
2. **Start handler** → option to auto-start handler is offered during payload creation
   - Or manually: open terminal dropdown → "meterpreter handler"
3. **Deliver payload** → open terminal dropdown → "web delivery"
   - Use the displayed download commands to transfer the payload
4. **Catch shell** → the handler terminal catches the meterpreter session

### Recipe 4: AI-Assisted Engagement

1. **Connect AI** → `Weapon: Install MCP server` → open Claude Code in the workspace
2. **Ask for analysis** → "Read terminal 1 and tell me what the nmap scan found"
3. **Auto-create findings** → "Create a finding for each critical service you identified"
4. **Get suggestions** → `@weapon /suggest` in Copilot Chat
5. **Generate commands** → `@weapon /generate kerberoasting attack for the current domain`

### Recipe 5: Report Generation

1. **Link your notes** → use `[[wiki-links]]` throughout: `[[target.htb]]`, `[[admin]]`, `[[smb-signing]]`
2. **Check the graph** → `Foam: Show graph` → verify attack path makes sense
3. **Generate report** → `Weapon: Create note` → report
4. **Review** → the report includes host details, privilege escalation path, and Mermaid diagram

## Customization Tips

### Adding Custom Scanners

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

### Custom Environment Variables

Add project-specific variables that are injected into every terminal:

```json
{
  "weaponized.envs": {
    "PROXY": "socks5://127.0.0.1:1080",
    "BURP": "http://127.0.0.1:8080",
    "SCOPE": "*.corp.local"
  }
}
```

### Overriding Wordlist Paths (macOS/custom Linux)

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

## Migrating from v0.4.x {#migrating-from-v04x}

If you used the shell-based Weaponized VSCode (versions before 1.0), here's what changed:

### Command Mapping

| v0.4.x (Shell) | v1.0 (Extension) | Notes |
|-----------------|-------------------|-------|
| `weapon_vscode project` | `mkdir project && code project` + `weapon.setup` | No shell launcher needed |
| `set_current_host hostname` | `Weapon: Switch current host` or CodeLens "set as current" | GUI with QuickPick |
| `set_current_user username` | `Weapon: Switch current user` or CodeLens "set as current" | GUI with QuickPick |
| `dump_hosts` | `Weapon: Dump all hosts` | 4 output formats |
| `dump_users` | `Weapon: Dump all user credentials` | 5 output formats (adds nxc) |
| `current_status` | `Weapon: Dump all hosts` (env format) | Or check env vars in terminal |
| `update_host_to_env` | *(automatic)* | Env vars update on file save |
| `update_user_cred_to_env` | *(automatic)* | Env vars update on file save |
| `Tasks: Run Task` → msfvenom | `Weapon: Create msfvenom payload` | Direct command, no task.json |
| `Tasks: Run Task` → hashcat | `Weapon: Crack hashes with hashcat` | Direct command |
| `Tasks: Run Task` → rustscan | `Weapon: Run scanner over target` | Configurable scanners |
| `Tasks: Run Task` → run selection | CodeLens "Run command in terminal" | Click above any code block |
| `Foam: Create Note From Template` | `Weapon: Create note` | Same templates, better UX |

### Architecture Changes

| Component | v0.4.x | v1.0 |
|-----------|--------|------|
| Environment variables | Shell scripts (`.vscode/env.zsh`, `createhackenv.sh`) sourced on terminal start | VS Code `EnvironmentVariableCollection` API — injected into all terminals automatically |
| YAML parsing | `yq` command-line tool | Native TypeScript YAML parser (built into extension) |
| Host/user switching | `set_current_host`/`set_current_user` zsh functions | Extension commands with QuickPick UI + CodeLens inline buttons |
| State storage | `.vscode/env.zsh` file rewritten by shell scripts | VS Code `workspaceState` (persistent key-value store) |
| Terminal profiles | `.zshrc` aliases and functions | VS Code Terminal Profile API providers |
| Knowledge base | None | Embedded snippets (GTFOBins, LOLBAS, BloodHound) |
| AI integration | None | @weapon Copilot Chat + embedded MCP server |
| Code execution | Manual copy-paste or "run selection" task | CodeLens buttons on shell/http blocks |
| Report generation | Manual | Automated from Foam graph |

### What's Still the Same

- **Markdown notes are the source of truth** — YAML host and credentials blocks work exactly the same way
- **Foam integration** — wiki-links, graph visualization, templates
- **Terminal profiles** — same 4 profiles (meterpreter, msfconsole, netcat, web-delivery), now native
- **`.vscode/.zshrc` helpers** — still available for utility functions (differ, ntlm, url, proxys)
- **Project isolation** — each workspace is independent, env vars don't cross-talk

::: tip
Your existing v0.4.x project notes are fully compatible with v1.0. Just open the project folder, run `weapon.setup` to ensure the scaffolding is up to date, and start using the new extension commands. No note migration needed.
:::

## FAQ

**Q: The extension doesn't activate when I open my project folder.**
A: The extension activates when it detects specific files (`.foam/templates/*.md`, `.vscode/settings.json`, `hosts/**/*.md`, etc.). Run `weapon.setup` to create the expected structure.

**Q: Environment variables aren't showing up in my terminal.**
A: Open a *new* terminal after setting the current host/user. Existing terminals don't pick up env var changes. Also verify the YAML block syntax — it must be `` ```yaml host `` or `` ```yaml credentials `` with the type keyword after `yaml`.

**Q: The MCP server port is already in use.**
A: Change `weaponized.mcp.port` in settings, or let the extension auto-assign a port (it falls back to an OS-assigned port if the default is occupied). Re-run `Weapon: Install MCP server` to update `.vscode/mcp.json`.

**Q: Can I use this without Foam?**
A: The extension works for most features (commands, tasks, terminals, MCP) without Foam. However, graph visualization, wiki-links, and report generation require Foam. It's strongly recommended.

**Q: How do I add more note templates?**
A: Add `.md` files to `.foam/templates/`. They'll appear in Foam's template picker. The extension's `Weapon: Create note` command uses its own built-in templates for the 5 standard types.
