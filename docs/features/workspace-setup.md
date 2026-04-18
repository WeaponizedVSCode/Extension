# Workspace Setup

Scaffolds a new penetration testing workspace with all required directories, templates, and configuration files.

## Command

```
weapon management: Setup/Create/Init weaponized vscode folder in current workspace
```

Command ID: `weapon.setup`

## What It Creates

```
workspace/
├── .foam/
│   └── templates/          # Foam note templates
│       ├── finding.md
│       ├── host.md
│       ├── service.md
│       └── user.md
├── .vscode/
│   ├── settings.json       # Extension configuration
│   ├── extensions.json     # Recommended extensions
│   └── .zshrc              # Shell environment config
├── hosts/                  # Host definition files
├── users/                  # Credential definition files
└── services/               # Service information files
```

## Shell Integration

The setup command checks if your shell profile (`.zshrc` / `.bashrc`) contains the helper function that auto-sources per-project shell configs:

```bash
weapon_vscode_launch_helper () {
  if [ -n "$PROJECT_FOLDER" ]; then
    if [ -f "$PROJECT_FOLDER/.vscode/.zshrc" ]; then
      source $PROJECT_FOLDER/.vscode/.zshrc
    fi
  fi
}
weapon_vscode_launch_helper
```

If missing, a copy button is provided to add it.

## Key Files

- `src/features/setup/setupCommand.ts` — Creates workspace scaffolding, checks shell profile
- `src/features/setup/assets.ts` — Contains all template file contents
