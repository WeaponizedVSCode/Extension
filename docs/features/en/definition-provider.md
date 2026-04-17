# Definition Provider

Hover and go-to-definition support for BloodHound terms in Markdown files.

## How It Works

When hovering over or using go-to-definition on BloodHound-related terms (Active Directory attack edges and relationships), the extension shows:

- **Hover tooltip** — Brief description of the term
- **Go-to-definition** — Opens a virtual Markdown document with extended documentation

This helps pentesters understand AD attack primitives directly in their notes without leaving VS Code.

## Data Source

Descriptions are sourced from a comprehensive BloodHound knowledge base (`blood_desc.json`, ~745KB) covering all BloodHound edges and relationship types.

## Key Files

- `src/features/definitions/blood.ts` — BloodHound-specific provider
- `src/features/definitions/baseProvider.ts` — Base definition/hover provider
- `src/snippets/source/blood/blood_desc.json` — BloodHound term descriptions
