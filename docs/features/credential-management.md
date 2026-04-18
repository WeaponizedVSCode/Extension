# Credential Management

Manage user credentials defined as YAML blocks in Markdown files, with export in multiple pentest tool formats.

## How It Works

Add YAML blocks annotated with `credentials` identity in Markdown files under `users/` directories:

````markdown
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
  props: {}
```
````

## Credential Fields

| Field | Type | Description |
|-------|------|-------------|
| `user` | string | Username |
| `password` | string | Password (mutually exclusive with `nt_hash`) |
| `nt_hash` | string | NTLM hash (mutually exclusive with `password`) |
| `login` | string | Login domain or context |
| `is_current` | boolean | Currently active credential |
| `props` | object | Custom properties |

## Commands

| Command | ID | Description |
|---------|-----|-------------|
| Switch/Set current user | `weapon.switch_user` | Set active credential across all files |
| List/Dump all users | `weapon.dump_users` | Display credentials in chosen format |

## Export Formats

**Impacket format:**
```bash
'CORP'/'administrator':'P@ssw0rd123'
'CORP'/'svc_backup' -hashes ':5fbc3d5fec8206a30f4b6c473d68ae76'
```

**NetExec (nxc) format:**
```bash
'CORP' -u 'administrator' -p 'P@ssw0rd123'
'CORP' -u 'svc_backup' -H ':5fbc3d5fec8206a30f4b6c473d68ae76'
```

## CodeLens Actions

On credential YAML blocks:

- **export to terminal** / **export as current**
- **dump as impacket** / **dump as nxc**
- **set as current** / **unset as current**

## Key Files

- `src/features/targets/commands/switchUser.ts`
- `src/features/targets/commands/dumpUsers.ts`
- `src/features/targets/codelens/yaml/dumpProvider.ts`
