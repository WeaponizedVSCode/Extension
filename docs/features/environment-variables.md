# Environment Variables

Automatic environment variable management that keeps terminal sessions in sync with workspace state.

## How It Works

When hosts and credentials are modified in Markdown files, the extension:

1. Parses YAML blocks and updates workspace state
2. Writes current target info to `.vscode/.zshrc`
3. New terminals automatically source these variables

## Built-in Variables

### Host Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `$TARGET` | Current host | Target hostname |
| `$HOST` | Current host | Hostname (same as TARGET) |
| `$DOMAIN` | Current host | Domain name |
| `$RHOST` | Current host | Target IP address |
| `$IP` | Current host | IP address (same as RHOST) |
| `$DC_HOST` | Current DC | Domain controller hostname |
| `$DC_IP` | Current DC | Domain controller IP |

### Credential Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `$USER` | Current user | Username |
| `$USERNAME` | Current user | Username (same as USER) |
| `$PASS` | Current user | Password |
| `$PASSWORD` | Current user | Password (same as PASS) |
| `$NT_HASH` | Current user | NTLM hash |
| `$LOGIN` | Current user | Login domain |

### Config Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `$LHOST` | Config | Local listening IP |
| `$LPORT` | Config | Local listening port |

## Custom Variables

Add custom env vars via host/user `props` with `ENV_` prefix:

```yaml host
- hostname: target.htb
  ip: 10.10.10.100
  props:
    ENV_WEB_PORT: "8080"
```

Exports as: `export WEB_PORT='8080'`

Additional custom variables via settings:

```json
{
  "weaponized.envs": {
    "WORDLIST_DIR": "/usr/share/wordlists"
  }
}
```

## Shell Helper Functions

`.vscode/.zshrc` also provides utilities:

```bash
current_status          # View current target status
url encode "string"     # URL encode
url decode "string"     # URL decode
ntlm "password"         # Generate NTLM hash
proxys on|off|show      # Proxy switching
```

## Key Files

- `src/features/targets/sync/markdownSync.ts` — Parses and exports variables
- `src/features/targets/sync/index.ts` — Sync entry point
- `src/features/targets/sync/graphBuilder.ts` — Builds the target graph
