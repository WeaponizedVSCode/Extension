# Code Snippets

Four snippet libraries for penetration testing workflows, available in Markdown files.

## Usage

Type the snippet prefix in a Markdown file, then press `Tab` or `Enter` to expand.

## Libraries

### Weapon Snippets

Common pentest templates:

| Prefix | Description |
|--------|-------------|
| `find suid` | Find files with SUID permission |
| `pty python` | Python PTY console |
| `psql` | PostgreSQL login/RCE |
| `` ```yaml credentials `` | User credentials YAML template |
| `` ```yaml host `` | Host info YAML template |
| `` ```sh `` | Shell code block |

### GTFOBins Snippets

Linux binary privilege escalation techniques from [GTFOBins](https://gtfobins.github.io/). Covers file read, file write, SUID exploitation, shell acquisition, and more.

### LOLBAS Snippets

Windows Living Off The Land Binaries and Scripts from [LOLBAS](https://lolbas-project.github.io/).

### BloodHound Snippets

Active Directory relationship query snippets for BloodHound analysis.

## Key Files

- `src/snippets/source/weapon/weapon.json`
- `src/snippets/source/gtfobins/gtfobins.json`
- `src/snippets/source/lolbas/lolbas.json`
- `src/snippets/source/blood/blood.json`
