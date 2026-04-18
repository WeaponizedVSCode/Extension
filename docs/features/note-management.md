# Note Management

Foam-based structured notes with automated report generation and attack path analysis.

## Prerequisites

Requires the **Foam** extension (`foam.foam-vscode`).

## Note Creation

```
weapon foam: Create/New note (user/host/service) from foam template
```

Command ID: `weapon.note.creation`

### Available Templates

| Template | Description |
|----------|-------------|
| `host.md` | Host information note |
| `user.md` | User credential note |
| `service.md` | Service information note |
| `finding.md` | Finding/vulnerability note |
| `report.js` | Auto-generated penetration test report |

## Report Generation

The `report.js` template performs automated analysis:

1. **Graph relationship analysis** — Parses all notes, builds reference graph
2. **Attack path computation** — Uses **Tarjan's SCC algorithm** + DAG topological sort to find the longest privilege escalation chain
3. **Mermaid diagram generation** — Visualizes user relationship graph
4. **Report contents**:
   - Host information summary
   - Full relationship graph (Mermaid format)
   - Privilege escalation path (ordered by attack sequence)
   - Extra pwned users

### Best Practices

- Use `[[link]]` syntax in user notes to link to the next acquired user
- Set note `type` property to `user`, `host`, or `service`
- Maintain clear reference relationships for accurate attack path generation

## Relationship Graph

```
weapon foam: Show Foam Graph
```

Visualize relationships between hosts, users, and services.

## Note Creation CodeLens

The extension detects phrases like "get user X" or "own host Y" in notes and offers a **Create note for X** CodeLens button.

## Key Files

- `src/features/notes/reports/report.ts` — Report generation with graph analysis
- `src/features/notes/reports/assets.ts` — Note templates
- `src/features/notes/codelens/noteProvider.ts` — Note creation CodeLens
