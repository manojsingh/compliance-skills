# Compliance Skills — WCAG Compliance Portal

A full-stack web application for auditing websites against **WCAG 2.1** accessibility standards. It crawls sites with a headless browser, runs axe-core accessibility checks, tracks results over time, and presents everything in a clean dashboard.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Key Features](#key-features)
- [Data Flow](#data-flow)
- [Development Notes](#development-notes)

---

## Overview

The portal lets you:

1. **Create campaigns** — group one or more URLs under a named audit campaign with a compliance level (A / AA / AAA) and optional scan schedule.
2. **Run scans** — a headless Chromium browser crawls each site, runs axe-core, and stores per-page results.
3. **Track issues** — every WCAG violation is stored with its criterion, severity, affected element, and a help URL.
4. **View trends** — score history charts let you see whether accessibility is improving over time.
5. **Manage WCAG rules** — the full WCAG 2.1 rule set is stored in the database and can be customised, imported (JSON/CSV), or reset to defaults.
6. **Generate reports** — PDF compliance reports can be generated and downloaded per campaign.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Browser (React)                 │
│  Vite dev server :5173  →  proxies /api → :3001     │
└────────────────────────┬────────────────────────────┘
                         │ HTTP (axios)
┌────────────────────────▼────────────────────────────┐
│              Express API Server  :3001               │
│                                                     │
│  Routes: /campaigns  /scans  /dashboard             │
│          /reports    /wcag   /scheduler             │
│                                                     │
│  Services:                                          │
│    scanner/    — Playwright + axe-core              │
│    scheduler/  — node-cron scheduled scans          │
│    importer/   — JSON / CSV / PDF rule import       │
│    reporter/   — PDF report generation (pdfkit)     │
└────────────────────────┬────────────────────────────┘
                         │ better-sqlite3
┌────────────────────────▼────────────────────────────┐
│         SQLite  (compliance-portal/data/)            │
│                                                     │
│  campaigns  campaign_sites  scans  scan_results     │
│  scan_issues  wcag_principles  wcag_guidelines      │
│  wcag_criteria  wcag_axe_rules  wcag_import_log     │
│  scan_audit_log                                     │
└─────────────────────────────────────────────────────┘
```

The client and server are **npm workspaces** under a single root. They share types via the `@compliance-portal/shared` package.

---

## Project Structure

```
compliance-skills/
├── .gitignore
├── README.md
└── compliance-portal/              # Root npm workspace
    ├── package.json                # Workspace root — dev/build/start scripts
    ├── data/
    │   └── compliance.db           # SQLite database (git-ignored)
    │
    ├── shared/                     # @compliance-portal/shared
    │   └── types/index.ts          # Campaign, Scan, ScanIssue, WCAG types etc.
    │
    ├── client/                     # @compliance-portal/client  (React + Vite)
    │   ├── src/
    │   │   ├── App.tsx             # Router + layout
    │   │   ├── pages/              # DashboardPage, CampaignsPage, CampaignDetailPage,
    │   │   │                       #   CampaignConfigPage, ReportsPage, SettingsPage
    │   │   ├── components/
    │   │   │   ├── layout/         # Header, Sidebar, MainLayout
    │   │   │   ├── dashboard/      # StatCard, RecentScansTable
    │   │   │   ├── campaigns/      # SiteResultsTable, IssuesList, ScanDepthSlider …
    │   │   │   ├── charts/         # ScoreGauge, ScoreTrendChart, IssueSeverityChart
    │   │   │   ├── wcag/           # WcagRulesManager, CriterionEditDialog, WcagImportExport
    │   │   │   └── ui/             # shadcn/ui primitives
    │   │   ├── hooks/              # useDashboard, useCampaigns, useCampaignDetail,
    │   │   │                       #   useWcagRules, useReports
    │   │   ├── lib/
    │   │   │   ├── api.ts          # Axios client + all API call wrappers
    │   │   │   └── utils.ts        # cn() helper
    │   │   └── types/
    │   └── vite.config.ts          # Proxies /api → localhost:3001
    │
    └── server/                     # @compliance-portal/server  (Express + SQLite)
        └── src/
            ├── index.ts            # Entry point — starts server + scheduler
            ├── app.ts              # Express app, routes, middleware
            ├── db/
            │   ├── schema.sql      # Full database schema (CREATE TABLE IF NOT EXISTS)
            │   ├── index.ts        # DB connection, schema exec, WCAG seed check
            │   ├── queries.ts      # All campaign / scan / dashboard DB queries
            │   ├── wcag-queries.ts # WCAG rule CRUD + import log queries
            │   ├── seed.ts         # Sample campaign/scan seed data
            │   └── seed-wcag.ts    # Built-in WCAG 2.1 rule seed data
            ├── routes/
            │   ├── campaigns.ts    # GET/POST/PUT/DELETE campaigns + scan trigger
            │   ├── scans.ts        # GET scan results + issues
            │   ├── dashboard.ts    # Summary stats + recent scans
            │   ├── reports.ts      # PDF report generate + download
            │   ├── wcag.ts         # WCAG rule CRUD + import/export/reset
            │   └── scheduler.ts    # Scheduler status + presets
            ├── services/
            │   ├── scanner/
            │   │   ├── index.ts        # Scan orchestrator (per-site, per-page)
            │   │   ├── crawler.ts      # BFS page crawler (Playwright)
            │   │   ├── accessibility.ts # axe-core audit + severity-weighted scoring
            │   │   ├── performance.ts  # Core Web Vitals (Performance API, median of 3)
            │   │   └── seo.ts          # SEO checks (meta, headings, robots, sitemap)
            │   ├── scheduler/          # node-cron scheduled scan runner
            │   ├── importer/           # JSON / CSV / PDF WCAG rule parsers
            │   └── reporter/           # PDF report builder (pdfkit)
            ├── middleware/
            │   ├── asyncHandler.ts
            │   ├── errorHandler.ts
            │   └── validate.ts
            └── data/
                ├── wcag-guidelines.ts  # Static WCAG 2.1 guideline data
                └── wcag-helpers.ts     # axe-rule → WCAG criterion mapper
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite 6 |
| **UI components** | shadcn/ui (Radix UI primitives + Tailwind CSS) |
| **Charts** | Recharts |
| **Routing** | React Router v6 |
| **HTTP client** | Axios |
| **Backend** | Node.js, Express 4, TypeScript |
| **Database** | SQLite via better-sqlite3 (WAL mode) |
| **Browser automation** | Playwright (headless Chromium) |
| **Accessibility auditing** | @axe-core/playwright |
| **Scheduling** | node-cron |
| **PDF generation** | pdfkit |
| **File import** | csv-parse, pdf-parse |
| **Dev tooling** | tsx watch, concurrently |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9 (workspaces support)
- Playwright browsers (downloaded automatically on first install)

### 1 — Install dependencies

```bash
cd compliance-portal
npm install
```

Playwright will download Chromium automatically as a post-install step.

### 2 — Start in development mode

```bash
npm run dev
```

This runs both the client and server concurrently:

| Service | URL |
|---|---|
| React client (Vite) | http://localhost:5173 |
| Express API server | http://localhost:3001 |
| API health check | http://localhost:3001/api/health |

The database (`data/compliance.db`) is created automatically on first run and seeded with the full WCAG 2.1 rule set.

### 3 — Production build

```bash
npm run build       # Compiles server TS + bundles client
npm run start       # Runs the compiled server (serves API only)
```

For production, serve the client `dist/` via a static file server (nginx, Caddy, etc.) or add static serving to the Express app.

---

## Environment Variables

The server reads the following optional environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the Express server listens on |

Create a `compliance-portal/server/.env` file to override defaults (it is git-ignored).

---

## API Reference

All routes are prefixed with `/api`.

### Campaigns
| Method | Path | Description |
|---|---|---|
| `GET` | `/campaigns` | List all campaigns (with site count, latest scan score/date) |
| `POST` | `/campaigns` | Create a campaign |
| `GET` | `/campaigns/:id` | Get campaign detail (with sites + latest scan) |
| `PUT` | `/campaigns/:id` | Update campaign |
| `DELETE` | `/campaigns/:id` | Delete campaign |
| `POST` | `/campaigns/:id/scan` | Trigger a new scan (runs in background) |
| `GET` | `/campaigns/:id/scans` | List all scans for a campaign |

### Scans
| Method | Path | Description |
|---|---|---|
| `GET` | `/scans` | List all scans (optional `?campaignId=`) |
| `GET` | `/scans/:id` | Get scan with results |
| `GET` | `/scans/:id/results` | Get scan results (optional `?category=` / `?siteId=`) |
| `GET` | `/scans/:id/issues` | Get all issues (optional `?severity=`) |

### Dashboard
| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard/summary` | Aggregate stats (campaigns, scores, issues by severity) |
| `GET` | `/dashboard/recent-scans` | Recent scans with live issue count (optional `?limit=`) |

### WCAG Rules
| Method | Path | Description |
|---|---|---|
| `GET` | `/wcag/criteria` | List all criteria (optional `?level=A\|AA\|AAA`) |
| `GET` | `/wcag/criteria/:id` | Get single criterion |
| `POST` | `/wcag/criteria` | Create criterion |
| `PUT` | `/wcag/criteria/:id` | Update criterion |
| `DELETE` | `/wcag/criteria/:id` | Delete criterion |
| `GET` | `/wcag/principles` | List WCAG principles |
| `GET` | `/wcag/guidelines` | List WCAG guidelines |
| `GET` | `/wcag/stats` | Criteria counts by level + automation coverage |
| `POST` | `/wcag/import` | Upload file (JSON/CSV) → preview |
| `POST` | `/wcag/import/confirm` | Commit a previewed import |
| `GET` | `/wcag/export?format=json\|csv` | Download all rules |
| `GET` | `/wcag/imports` | Import history |
| `POST` | `/wcag/reset` | Reset to built-in WCAG 2.1 defaults |

### Reports
| Method | Path | Description |
|---|---|---|
| `POST` | `/reports/generate` | Generate PDF report for a scan |
| `GET` | `/reports/:id/download` | Download generated PDF |

### Scheduler
| Method | Path | Description |
|---|---|---|
| `GET` | `/scheduler/status` | Active scheduled jobs |
| `GET` | `/scheduler/presets` | Common cron presets (daily, weekly, etc.) |

---

## Key Features

### Severity-weighted accessibility scoring
Rather than a simple pass/fail rule ratio, each scan computes a weighted score:
- **Critical** violations: 4× weight
- **Serious**: 3×, **Moderate**: 2×, **Minor**: 1×
- Passing rules: 1× weight

This prevents a single extra passing rule from causing a 3-point score swing between identical runs.

### Deterministic page crawling
The BFS crawler sorts discovered links alphabetically before queuing them. Combined with `networkidle` page waits, this ensures the same set of pages is audited in the same order on every run.

### Two-step WCAG import
File imports are previewed first (showing new / updated / unchanged criteria) before being committed to the database. Pending imports are held server-side and confirmed by `importId`.

### Scheduled scans
Campaigns can have a cron expression. The scheduler boots with the server and re-registers all active schedules. Pausing or completing a campaign automatically unschedules it.

---

## Data Flow

```
User clicks "Run Scan"
        │
        ▼
POST /api/campaigns/:id/scan
        │  creates scan row (status: pending)
        │  kicks off executeScan() in background
        ▼
executeScan()
  ├── updateScanStatus → running
  ├── for each site:
  │     crawlSite()  — BFS, sorted links, networkidle
  │     for each page:
  │       auditAccessibility()  — axe-core, weighted score
  │       insertScanResult() + insertScanIssues()
  └── updateScanStatus → completed  (with ScanSummary JSON)

Client polls via useCampaignDetail (5s interval while running)
        │
        ▼
GET /api/campaigns/:id  →  GET /api/scans/:id/issues
        │
        ▼
Issues list + score gauges + trend chart rendered
```

---

## Development Notes

- **Database** is created fresh from `schema.sql` on every cold start (all tables use `CREATE TABLE IF NOT EXISTS` so existing data is preserved across restarts).
- **WCAG seed data** is inserted only once — when `wcag_criteria` is empty.
- **Hot reload** — `tsx watch` restarts the server on any `.ts` change; Vite handles HMR for the client.
- **Proxy** — Vite proxies all `/api/*` requests to `localhost:3001` in dev, so there are no CORS issues.
- **WAL mode** — SQLite is opened in WAL journal mode for better concurrent read performance during active scans.
- The `shared/` package is referenced by path in both `client` and `server` `tsconfig.json` — no build step is needed for shared types.
