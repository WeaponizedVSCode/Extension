# CodeLens

Inline action buttons that appear above code blocks in Markdown files, providing one-click access to common operations.

## CodeLens Types

### YAML Host Blocks

On ```` ```yaml host ```` blocks:

- **export to terminal** — Export host data as shell environment variables
- **export as current** — Set as current host + export
- **set as current** / **unset as current** — Toggle `is_current` flag in-place
- **Scan host** — Launch a scanner against targets in the block

### YAML Credential Blocks

On ```` ```yaml credentials ```` blocks:

- **export to terminal** / **export as current**
- **dump as impacket** — Format for Impacket tools
- **dump as nxc** — Format for NetExec
- **set as current** / **unset as current**

### Shell Code Blocks

On ```` ```bash ````, ```` ```sh ````, ```` ```zsh ````, ```` ```powershell ```` blocks:

- **Run command in terminal** — Execute in active terminal
- **Copy commands** — Copy to clipboard

### HTTP Code Blocks

On ```` ```http ```` blocks:

- **Send HTTP Request** / **Send HTTPS Request**
- **Copy in curl (HTTP)** / **Copy in curl (HTTPS)**

### Note Creation

On phrases like "get user X" or "own host Y":

- **Create note for X** — Create a Foam note for the referenced entity

## Key Files

- `src/features/targets/codelens/` — YAML host/credential CodeLens
- `src/features/shell/codelens/commandProvider.ts` — Shell block CodeLens
- `src/features/http/codelens/` — HTTP block CodeLens
- `src/features/notes/codelens/noteProvider.ts` — Note creation CodeLens
