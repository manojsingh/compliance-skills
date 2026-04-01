## {{display_name}} (v{{version}})

{{description}}

### Usage

Run a WCAG accessibility scan on any URL:

```bash
node {{skill_path}}/scripts/a11y-scan.mjs <url> [--level AA] [--depth 1] [--output report.html]
```

Batch scan multiple sites from a file:

```bash
node {{skill_path}}/scripts/a11y-scan.mjs --file urls.txt [--level AA] [--depth 1] [--output report.html]
```

### Parameters

| Flag | Default | Description |
|------|---------|-------------|
| `<url>` | (required\*) | Target URL to scan. `https://` is added if missing. |
| `--file` | — | Path to a text file with URLs (one per line). |
| `--level` | `AA` | WCAG compliance level: `A`, `AA`, or `AAA` |
| `--depth` | `1` | Crawl depth (1-5). Depth 1 = single page only. |
| `--output` | `a11y-report-{hostname}.html` | Output path for the HTML report. |

\* Either `<url>` or `--file` is required, but not both.

### Interpreting Results

The script outputs JSON between `__A11Y_RESULT__` markers:

```json
{"url":"...","level":"AA","score":72,"pass":false,"pages":3,"totalIssues":12,"critical":2,"serious":4,"reportPath":"..."}
```

- **Score ≥ 90**: Excellent — minor issues only.
- **Score 70–89**: Needs improvement — highlight serious/critical issues.
- **Score < 70**: Significant issues — list all critical items with remediation guidance.

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | PASS — score ≥ 80 |
| `1` | FAIL — score < 80 |
| `2` | Error — script failed |

### Prerequisites

- Node.js ≥ 18, npm, internet access (first run downloads Chromium)

### Examples

```bash
# Quick scan
node {{skill_path}}/scripts/a11y-scan.mjs http://localhost:3000 --level AA

# Deep audit
node {{skill_path}}/scripts/a11y-scan.mjs https://example.com --level AAA --depth 3

# Batch scan
node {{skill_path}}/scripts/a11y-scan.mjs --file urls.txt --level AA --depth 2
```
