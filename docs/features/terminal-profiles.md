# Terminal Profiles

Pre-configured terminal launchers for common penetration testing tools.

## Available Profiles

Select from the VS Code terminal dropdown menu:

### Msfconsole

Launches `msfconsole` with `LHOST` and `LPORT` pre-configured via `setg`. Automatically loads resource file if configured.

Profile ID: `weaponized.msfconsole`

### Meterpreter Handler

Launches `msfconsole` in quiet mode with handler pre-configured for the selected payload type.

Profile ID: `weaponized.meterpreter-handler`

### Netcat Handler

Starts a netcat listener for reverse shells. Default command:

```bash
rlwrap -I -cAr netcat -lvvp ${config:weaponized.lport}
```

Profile ID: `weaponized.netcat-handler`

### Web Delivery

Starts an HTTP server for payload distribution. Default command:

```bash
simplehttpserver -listen 0.0.0.0:${config:weaponized.listenon} -verbose -upload
```

Displays a cheat-sheet with download/upload one-liners for curl, wget, PowerShell, and certutil.

Profile ID: `weaponized.web-delivery`

## Configuration

| Setting | Description |
|---------|-------------|
| `weaponized.lhost` | Local host IP |
| `weaponized.lport` | Listener port |
| `weaponized.listenon` | Web delivery port |
| `weaponized.netcat` | Netcat command template |
| `weaponized.webdelivery` | Web delivery command template |
| `weaponized.msf.console` | Msfconsole path |
| `weaponized.msf.resourcefile` | MSF resource file path |

## Key Files

- `src/features/terminal/profiles/msfprofile.ts`
- `src/features/terminal/profiles/netcatprofile.ts`
- `src/features/terminal/profiles/webprofile.ts`
- `src/features/terminal/profiles/base.ts`
