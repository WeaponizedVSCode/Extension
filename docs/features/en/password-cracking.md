# Password Cracking

Interactive Hashcat integration for hash cracking.

## Command

```
weapon task: Crack hashes with hashcat
```

Command ID: `weapon.task.hashcat_cracker`

## Interactive Flow

1. **Select hash file** via file picker
2. **Select attack mode**: Dictionary (0), Combination (1), Brute-force (3), Rule-based (6)
3. **Select hash type**: MD5, SHA1, SHA256, NTLM, NetNTLMv2, Kerberos TGS/AS-REP, etc.
4. **Select device**: CPU or GPU
5. **Specify wordlist**: Default `$ROCKYOU`

## Configuration

| Setting | Description |
|---------|-------------|
| `weaponized.hashcat` | Hashcat executable path |

## Key Files

- `src/features/tasks/commands/hashcat.ts`
- `src/features/tasks/ui/filePicker.ts`
