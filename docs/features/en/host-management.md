# Host Management

Parse and manage target hosts defined as YAML blocks in Markdown files.

## How It Works

Add YAML blocks annotated with `host` identity in Markdown files under `hosts/` directories:

````markdown
```yaml host
- hostname: dc01.corp.local
  ip: 192.168.1.10
  alias:
    - corp.local
  is_dc: true
  is_current: true
  is_current_dc: true
  props:
    ENV_DOMAIN: corp.local
```
````

The extension automatically parses these blocks on file save, builds a centralized host list, and exports environment variables.

## Host Fields

| Field | Type | Description |
|-------|------|-------------|
| `hostname` | string | Target hostname |
| `ip` | string | IP address |
| `alias` | string[] | Host aliases |
| `is_dc` | boolean | Domain controller flag |
| `is_current` | boolean | Currently active target |
| `is_current_dc` | boolean | Currently active DC |
| `props` | object | Custom properties (`ENV_` prefix exported as env vars) |

## Commands

| Command | ID | Description |
|---------|-----|-------------|
| Switch/Set current host | `weapon.switch_host` | Set active host across all Markdown files |
| List/Dump all hosts | `weapon.dump_hosts` | Display hosts in env/hosts/yaml/table format |

## CodeLens Actions

On host YAML blocks:

- **export to terminal** — Export as environment variables
- **export as current** — Set as current + export
- **set as current** / **unset as current** — Toggle `is_current` flag
- **Scan host** — Launch scanner against this host

## Exported Variables

When `is_current: true`:

```bash
export TARGET='dc01.corp.local'
export HOST='dc01.corp.local'
export DOMAIN='dc01.corp.local'
export RHOST='192.168.1.10'
export IP='192.168.1.10'
```

## Key Files

- `src/features/targets/commands/switchHost.ts`
- `src/features/targets/commands/dumpHosts.ts`
- `src/features/targets/sync/markdownSync.ts`
- `src/features/targets/codelens/yaml/dumpProvider.ts`
