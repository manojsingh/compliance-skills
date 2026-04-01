# a11y-scan

> WCAG accessibility scanner — universal skill package for coding agents

Run WCAG 2.1 accessibility scans on any URL directly from chat. Uses Playwright and axe-core to perform automated accessibility testing and produces a self-contained HTML report with scores, violations, and code snippets. Works with GitHub Copilot or any coding agent.

The installer auto-detects which coding agents you use and configures each one.

## Supported Agents

| Agent | Detection Signal | What Gets Installed |
|-------|-----------------|-------------------|
| **GitHub Copilot** | `.github/` or `.github/copilot-instructions.md` | SKILL.md + prompt files |
| **Generic** | (fallback) | Instructions in `.skills/` |

Multiple agents can be active simultaneously — the installer configures all detected agents.

## Install Options

### Manual Install (from zip or clone)

```bash
# Clone or extract the package
cd a11y-scan/
node install.mjs install --target /path/to/your/project
```

## Uninstall


This reads the `skill.lock` file and removes all installed files cleanly.

## Installed Files

### Runtime (all agents)

| Path | Description |
|------|-------------|
| `.skills/a11y-scan/scripts/a11y-scan.mjs` | Scanner script (Playwright + axe-core) |
| `.skills/a11y-scan/prompts/*.md` | Agent-agnostic prompt templates |
| `.skills/a11y-scan/skill.lock` | Install manifest for clean uninstall |

### GitHub Copilot

| Path | Description |
|------|-------------|
| `.github/skills/a11y-scan/SKILL.md` | Skill definition |
| `.github/skills/a11y-scan/scripts/a11y-scan.mjs` | Scanner script |
| `.github/prompts/a11y-*.prompt.md` | One prompt file per scan type |

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `quick-scan` | Quick WCAG AA scan of a single URL |
| `deep-audit` | Deep WCAG AAA audit with full crawl (depth 3) |
| `scan-localhost` | Scan your local dev server |
| `batch-scan` | Scan multiple URLs from a file |
| `compare-before-after` | Compare accessibility between two URLs |

## Creating Your Own Skills

Skills use a `skill.yaml` manifest as the single source of truth. See the [Universal Skill Packaging Format](../docs/skill-packaging.md) for the full schema, or use this package as a reference.

Key files:
- **`skill.yaml`** — Metadata, triggers, parameters, prompts, output contract
- **`install.mjs`** — Zero-dependency installer CLI
- **`scripts/`** — Runtime scripts
- **`prompts/`** — Agent-agnostic prompt templates
- **`agents/`** — Per-agent adapter templates with `_config.json`

## License

MIT
