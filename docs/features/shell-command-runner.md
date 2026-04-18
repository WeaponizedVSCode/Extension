# Shell Command Runner

Execute shell commands directly from Markdown code blocks in your penetration testing notes.

## Supported Block Types

- ```` ```bash ````
- ```` ```sh ````
- ```` ```zsh ````
- ```` ```powershell ````

## CodeLens Actions

Each shell code block shows two buttons:

- **Run command in terminal** — Sends the block content to the active terminal (creates one if needed)
- **Copy commands** — Copies the block content to clipboard

## Variable Substitution

Commands can use environment variables that are automatically populated from the current engagement state:

```bash
nmap -sS -sV $RHOST
crackmapexec smb $RHOST -u $USER -p $PASS
evil-winrm -i $RHOST -u $USER -p $PASS
```

## Key Files

- `src/features/shell/commands/runCommand.ts` — Terminal execution
- `src/features/shell/commands/copy.ts` — Clipboard copy
- `src/features/shell/codelens/commandProvider.ts` — Block detection + CodeLens
