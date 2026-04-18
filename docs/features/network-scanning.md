# Network Scanning

Run configurable security scanners against discovered targets.

## Command

```
weapon task: Run scanner over target
```

Command ID: `weapon.task.scan`

## Interactive Flow

1. **Select target host** from discovered hosts list
2. **Select scan option**: hostname, IP, or alias
3. **Select scanner** from configured list

## Default Scanners

| Scanner | Command |
|---------|---------|
| rustscan | `rustscan -a $TARGET -- --script=vuln -A` |
| nuclei | `nuclei -target $TARGET` |
| dirsearch | `dirsearch -u http://$TARGET` |
| dirsearch https | `dirsearch -u https://$TARGET` |
| feroxbuster | `feroxbuster -u http://$TARGET -w ... -x php,html,txt -t 50` |
| wfuzz subdomain | `wfuzz -c -w ... -u http://$TARGET -H 'Host: FUZZ.$TARGET'` |
| ffuf subdomain | `ffuf -c -w ... -u http://$TARGET -H 'Host: FUZZ.$TARGET'` |

## Custom Scanners

Add custom scanners in settings:

```json
{
  "weaponized.scanners": {
    "nmap_full": "nmap -sS -sV -O -A -T4 --script vuln $TARGET",
    "masscan": "masscan -p1-65535 $TARGET --rate=1000"
  }
}
```

The `$TARGET` placeholder is replaced with the selected host.

## Key Files

- `src/features/tasks/commands/scan.ts`
- `src/features/targets/codelens/yaml/scanTaskProvider.ts`
