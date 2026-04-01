---
name: {{name}}
description: {{description}}
---

# {{name}}

## Overview

Run WCAG 2.1 accessibility scans against any URL and generate a self-contained HTML report. Uses Playwright and axe-core to perform automated accessibility testing at Level A, AA, or AAA compliance. Designed for quick checks during development — scan a localhost page or production URL right from the chat.

## When to Use

Trigger this skill when the user:
- Asks to "check accessibility" or "run a11y scan" on a URL
- Wants a WCAG compliance check on their app or a webpage
- Requests an accessibility audit or report
- Mentions scanning localhost, staging, or production URLs for accessibility issues

## Quick Scan Workflow

To run an accessibility scan:

1. Execute the scan script with the target URL:

```bash
node {{skill_path}}/scripts/a11y-scan.mjs <url> [--level AA] [--depth 1] [--output report.html]
```

For batch scanning multiple sites from a file:

```bash
node {{skill_path}}/scripts/a11y-scan.mjs --file urls.txt [--level AA] [--depth 1] [--output report.html]
```

2. The script automatically:
   - Installs Playwright + axe-core if not present
   - Launches a headless browser
   - Crawls pages up to the specified depth
   - Runs axe-core with WCAG tag filters matching the compliance level
   - Generates a self-contained HTML report
   - Prints a structured summary to stdout

3. After the script completes, present the results to the user:
   - Overall score and PASS/FAIL verdict (≥80 = PASS)
   - Count of issues by severity (critical, serious, moderate, minor)
   - Location of the HTML report file
   - Key findings: highlight critical and serious issues with their descriptions

4. Parse the JSON summary from stdout (between `__A11Y_RESULT__` markers) for structured data:
   ```json
   {"url":"...","level":"AA","score":72,"pass":false,"pages":3,"totalIssues":12,"critical":2,"serious":4,"reportPath":"/path/to/report.html"}
   ```
   In batch mode, the result is an array:
   ```json
   [{"url":"...","score":85,"pass":true,...},{"url":"...","score":72,"pass":false,...}]
   ```

## Parameters

| Flag | Default | Description |
|------|---------|-------------|
| `<url>` | (required\*) | Target URL to scan. Prefix `https://` is added if missing. |
| `--file` | — | Path to a text file containing URLs to scan (one per line). Cannot be used with `<url>`. |
| `--level` | `AA` | WCAG compliance level: `A`, `AA`, or `AAA` |
| `--depth` | `1` | Crawl depth (1-5). Depth 1 scans only the given URL. |
| `--output` | `a11y-report-{hostname}.html` | Output path for the HTML report. Defaults to `a11y-batch-report.html` when using `--file`. |

\* Either `<url>` or `--file` is required, but not both.

### URL File Format

When using `--file`, the text file should contain one URL per line. Empty lines and lines starting with `#` are ignored (comments). Whitespace is trimmed.

```text
# Production sites
https://example.com
https://example.com/about

# Staging
https://staging.example.com

# Local dev
http://localhost:3000
```

## Examples

**Quick check of a local dev server:**
```bash
node {{skill_path}}/scripts/a11y-scan.mjs http://localhost:3000 --level AA
```

**Deep scan of a production site at AAA level:**
```bash
node {{skill_path}}/scripts/a11y-scan.mjs https://example.com --level AAA --depth 3 --output compliance-report.html
```

**Scan a specific page:**
```bash
node {{skill_path}}/scripts/a11y-scan.mjs https://example.com/checkout --level AA --depth 1
```

**Batch scan multiple sites from a file:**
```bash
node {{skill_path}}/scripts/a11y-scan.mjs --file urls.txt --level AA --depth 2
```

**Batch scan with custom output path:**
```bash
node {{skill_path}}/scripts/a11y-scan.mjs --file urls.txt --level AAA --output full-audit.html
```

## Interpreting Results

Present scan results using this guidance:

- **Score ≥ 90**: Excellent. Minor issues only. Report the score and note any remaining items.
- **Score 70–89**: Needs improvement. Highlight serious/critical issues first with their element snippets.
- **Score < 70**: Significant issues. List all critical issues with remediation guidance from the help URLs.

For each critical/serious issue, explain:
1. What the violation is (from the description)
2. Which element is affected (from the code snippet)
3. How to fix it (brief guidance + helpUrl link)

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | PASS — Score ≥ 80 (single mode) or ALL sites ≥ 80 (batch mode) |
| `1` | FAIL — Score < 80 (single mode) or ANY site < 80 (batch mode) |
| `2` | Error — Script failed to run |

## Prerequisites

The script auto-installs dependencies if missing. Requirements:
- Node.js ≥ 18
- npm (for auto-installing playwright and @axe-core/playwright)
- Internet access to download Chromium browser on first run

## Resources

### scripts/
- `a11y-scan.mjs` — Standalone Node.js script that runs WCAG accessibility scans using Playwright + axe-core and generates HTML reports
