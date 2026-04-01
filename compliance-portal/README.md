# Compliance Portal

A full-stack WCAG accessibility compliance platform that crawls websites, audits pages against WCAG 2.1 criteria using axe-core, tracks results over time, and generates PDF reports.

---

## Table of Contents

- [Summary](#summary)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Environment Setup](#environment-setup)
- [Running the App (Development)](#running-the-app-development)
- [Building for Production](#building-for-production)
- [Deploying to Production](#deploying-to-production)
- [API Reference](#api-reference)
- [Database](#database)
- [PDF Reports](#pdf-reports)

---

## Summary

Compliance Portal lets teams continuously monitor websites for WCAG 2.1 accessibility compliance (levels A, AA, and AAA). Key capabilities:

- **Campaign management** — group multiple sites together, configure scan depth, compliance level, and audit categories (accessibility, performance, SEO)
- **Automated scanning** — BFS crawler powered by Playwright visits up to 5 levels of pages; each page is audited with axe-core and scored 0–100
- **Scheduling** — cron-based recurring scans via `node-cron`
- **WCAG reference data** — full WCAG 2.1 criteria and axe-core rule mappings seeded into SQLite on first run
- **PDF report generation** — cover page, executive summary with category bar charts, per-site breakdowns, detailed findings, and a WCAG appendix
- **Import/export** — import WCAG criteria from CSV, JSON, or PDF files

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        Browser                           │
│              React 18 + Vite (port 5173)                 │
│   React Router · Radix UI · Recharts · Tailwind CSS      │
└────────────────────────┬─────────────────────────────────┘
                         │  /api/* (proxied in dev)
┌────────────────────────▼─────────────────────────────────┐
│                  Express Server (port 3001)               │
│                                                          │
│  Routes:  /api/campaigns  /api/scans  /api/reports       │
│           /api/dashboard  /api/wcag   /api/scheduler      │
│                                                          │
│  Services:                                               │
│    Scanner ──▶ Playwright BFS Crawler                    │
│             ──▶ axe-core Auditor (parallel tabs)         │
│    Reporter ──▶ PDFKit PDF Generator                     │
│    Scheduler──▶ node-cron Recurring Scans                │
│    Importer ──▶ CSV / JSON / PDF WCAG rule import        │
│                                                          │
│  Database: better-sqlite3 (WAL mode)                     │
│    compliance.db ──▶ data/compliance.db                  │
│  Reports:  data/reports/*.pdf                            │
└──────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 6, React Router 6 |
| UI Components | Radix UI primitives, shadcn/ui, Tailwind CSS 3 |
| Charts | Recharts |
| HTTP Client | Axios |
| Backend | Node.js 20+, Express 4, TypeScript |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Browser Automation | Playwright (Chromium) |
| Accessibility Auditing | axe-core via @axe-core/playwright |
| PDF Generation | PDFKit 0.18 |
| Scheduling | node-cron |
| File Import | csv-parse, pdf-parse |
| Monorepo | npm workspaces |

### Data Flow

```
User creates Campaign (sites + config)
        │
        ▼
POST /api/scans/run
        │
        ▼
Scanner Service
  ├── For each site (concurrency: 2):
  │     ├── Playwright BFS crawl → list of page URLs
  │     └── Audit pages in parallel tabs (concurrency: 3)
  │           └── axe-core → violations → score + issues
  └── Store results in SQLite
        │
        ▼
GET /api/scans/:id  →  results rendered in React
        │
        ▼
POST /api/reports/generate  →  PDFKit PDF  →  data/reports/
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 20 LTS or later | [nodejs.org](https://nodejs.org) |
| npm | 10+ | Ships with Node 20 |
| Chromium / Chrome | Latest | Installed automatically by Playwright |
| Disk space | ~500 MB | Node modules + Playwright browser binaries |
| OS | macOS, Linux, Windows WSL2 | Native Windows untested |

---

## Project Structure

```
compliance-portal/
├── package.json          # Root — npm workspaces + dev script
├── client/               # React frontend (Vite)
│   ├── src/
│   │   ├── pages/        # Route-level page components
│   │   ├── components/   # Reusable UI components
│   │   ├── hooks/        # Data-fetching hooks (useCampaigns, etc.)
│   │   ├── lib/          # api.ts (Axios wrappers), utils
│   │   └── types/        # Frontend-only TypeScript types
│   └── vite.config.ts
├── server/               # Express API + services
│   └── src/
│       ├── app.ts        # Express app setup, routes
│       ├── index.ts      # Server entrypoint, graceful shutdown
│       ├── db/           # SQLite schema, queries, seed scripts
│       ├── middleware/    # asyncHandler, errorHandler, validate
│       ├── routes/        # campaigns, scans, reports, wcag, scheduler
│       └── services/
│           ├── scanner/  # Playwright crawler + axe-core auditor
│           ├── reporter/ # PDFKit report generator
│           ├── scheduler/# node-cron recurring scan scheduler
│           └── importer/ # CSV/JSON/PDF WCAG rule importer
├── shared/               # Shared TypeScript types (used by both)
│   └── types/index.ts
└── data/                 # Runtime data (auto-created)
    ├── compliance.db     # SQLite database
    └── reports/          # Generated PDF reports
```

---

## Environment Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd compliance-portal
npm install
```

### 2. Install Playwright browsers

Playwright downloads Chromium automatically during `npm install` via a `postinstall` script. If it didn't run, install manually:

```bash
cd server
npx playwright install chromium
```

### 3. Environment variables (optional)

The server uses sensible defaults. Create `server/.env` to override:

```env
# Server port (default: 3001)
PORT=3001

# SQLite database path (default: data/compliance.db relative to project root)
# DB_PATH=/absolute/path/to/compliance.db
```

No `.env` file is required to run the app locally.

---

## Running the App (Development)

Start both the client (port 5173) and server (port 3001) with a single command from the project root:

```bash
npm run dev
```

This uses `concurrently` to run:
- **Client**: `vite` dev server at `http://localhost:5173` — hot module replacement enabled
- **Server**: `tsx watch` — restarts on TypeScript file changes

The Vite dev server proxies all `/api/*` requests to `http://localhost:3001`, so no CORS issues.

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running individually

```bash
# Server only
npm run dev -w server

# Client only
npm run dev -w client
```

### Database seeding

The database is created and seeded automatically on first server start:
- Schema applied from `server/src/db/schema.sql`
- Full WCAG 2.1 criteria and axe-core rule mappings seeded if `wcag_criteria` is empty
- Sample campaigns seeded if `campaigns` table is empty

---

## Building for Production

```bash
# Build both server (TypeScript → JS) and client (Vite bundle)
npm run build
```

Build outputs:
- **Server**: `server/dist/` — compiled JavaScript ES modules
- **Client**: `client/dist/` — static HTML/CSS/JS bundle ready to serve

---

## Deploying to Production

### Option A — Single Server (serve client as static files)

Serve the compiled client bundle from the Express server by adding a static middleware. Then deploy the whole thing to any Node.js host (Railway, Render, Fly.io, EC2, etc.).

1. **Build**:
   ```bash
   npm run build
   ```

2. **Add static file serving** to `server/src/app.ts` (before the 404 handler):
   ```typescript
   import { fileURLToPath } from 'url';
   import path from 'path';
   const __dirname = path.dirname(fileURLToPath(import.meta.url));
   app.use(express.static(path.join(__dirname, '../../client/dist')));
   app.get('*', (_req, res) =>
     res.sendFile(path.join(__dirname, '../../client/dist/index.html'))
   );
   ```

3. **Start**:
   ```bash
   npm run start   # runs node dist/index.js in the server workspace
   ```

4. **Process manager** (recommended):
   ```bash
   npm install -g pm2
   pm2 start server/dist/index.js --name compliance-portal
   pm2 save && pm2 startup
   ```

### Option B — Separate Frontend CDN + Backend API

1. **Deploy the client** bundle (`client/dist/`) to any static host (Vercel, Netlify, Cloudflare Pages, S3 + CloudFront).

2. **Deploy the server** to a Node.js host:
   - Set `PORT` environment variable as required by the platform
   - Ensure `data/` directory is on a persistent volume (for SQLite DB and PDF reports)
   - Playwright / Chromium must be available — use a Docker image or platform that supports headless Chrome

3. **Update the client API base URL**: In `client/src/lib/api.ts`, set `VITE_API_URL` to your server's public URL, and configure the build:
   ```env
   # client/.env.production
   VITE_API_URL=https://api.your-domain.com
   ```

### Option C — Docker (full-stack, single container)

This option packages **both the React frontend and the Express backend** into one container. The Express server serves the compiled React bundle as static files, so only port 3001 is needed.

#### Step 1 — Add static file serving to the Express app

Add the following lines to `server/src/app.ts` **before** the 404 handler (the `app.use('/api/*', ...)` block):

```typescript
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '../../../client/dist');

// Serve the built React app
app.use(express.static(clientDist));
// Fallback to index.html for client-side routing
app.get(/^(?!\/api).*/, (_req, res) =>
  res.sendFile(path.join(clientDist, 'index.html'))
);
```

#### Step 2 — Create the Dockerfile

Place this file at the **project root** (`compliance-portal/Dockerfile`):

```dockerfile
# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/

RUN npm install

# Copy source and build both workspaces
COPY . .
RUN npm run build
# 'npm run build' produces:
#   server/dist/  — compiled Express server (ES modules)
#   client/dist/  — compiled React bundle (static files)

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.50.0-noble AS runtime

WORKDIR /app

# Copy built artefacts from the builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/shared ./shared

# Install only production dependencies for the server
RUN npm install --omit=dev -w server

# Playwright Chromium is pre-installed in the base image.
# Run the install step to ensure browsers/deps are linked.
RUN npx playwright install --with-deps chromium

# Create the data directory for SQLite DB and PDF reports
RUN mkdir -p /app/data/reports

EXPOSE 3001

ENV NODE_ENV=production \
    PORT=3001

CMD ["node", "server/dist/index.js"]
```

#### Step 3 — Build and run

```bash
# Build the image
docker build -t compliance-portal .

# Run — mount a host volume so the DB and PDFs survive container restarts
docker run -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  compliance-portal
```

Open [http://localhost:3001](http://localhost:3001) — the React UI and the API are both served from the same port.

#### docker-compose (optional)

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3001
    restart: unless-stopped
```

```bash
docker compose up -d
```

> **Important**: Always mount a volume to `/app/data` to persist the SQLite database (`compliance.db`) and generated PDF reports across container restarts. Without it, all scan history and reports are lost when the container is removed.

### Production Checklist

- [ ] Mount a persistent volume for `data/` (SQLite DB + PDFs)
- [ ] Set `NODE_ENV=production`
- [ ] Configure a reverse proxy (nginx/Caddy) with HTTPS
- [ ] Ensure the process has read/write access to the `data/` directory
- [ ] Playwright's Chromium binary is available in the deployment environment
- [ ] Set appropriate memory limits — Playwright/Chromium needs ~512 MB minimum

---

## API Reference

All endpoints are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/dashboard` | Summary stats for dashboard |
| `GET` | `/api/campaigns` | List all campaigns |
| `POST` | `/api/campaigns` | Create a campaign |
| `GET` | `/api/campaigns/:id` | Get campaign with sites |
| `PUT` | `/api/campaigns/:id` | Update campaign (incl. sites) |
| `DELETE` | `/api/campaigns/:id` | Delete campaign |
| `GET` | `/api/scans?campaignId=` | List scans |
| `GET` | `/api/scans/:id` | Get scan with results |
| `POST` | `/api/scans/run` | Trigger a scan |
| `GET` | `/api/reports` | List generated reports |
| `POST` | `/api/reports/generate` | Generate PDF report for a scan |
| `GET` | `/api/reports/:id/download` | Download PDF report |
| `GET` | `/api/wcag/criteria` | List WCAG criteria |
| `POST` | `/api/wcag/import` | Import criteria from file |
| `GET` | `/api/scheduler/status` | Scheduled job status |

---

## Database

The SQLite database is stored at `data/compliance.db` (relative to the project root). It is created automatically on first run.

Key tables:

| Table | Description |
|---|---|
| `campaigns` | Campaign definitions (name, compliance level, scan depth, schedule) |
| `campaign_sites` | URLs belonging to each campaign |
| `scans` | Scan run history and status |
| `scan_results` | Per-page, per-category scores and issue counts |
| `scan_issues` | Individual axe-core violations with severity and WCAG criterion |
| `wcag_principles` | WCAG 2.1 principles (Perceivable, Operable, Understandable, Robust) |
| `wcag_guidelines` | WCAG 2.1 guidelines (1.1, 1.2, …) |
| `wcag_criteria` | Individual success criteria (1.1.1, 1.3.1, …) with level A/AA/AAA |
| `wcag_axe_rules` | Mapping between WCAG criteria and axe-core rule IDs |
| `scan_audit_log` | Tracks expected vs. executed axe rules per scan |

WAL mode is enabled for better concurrent read performance. Foreign keys are enforced.

---

## PDF Reports

Reports are generated on demand via `POST /api/reports/generate` and stored as PDF files in `data/reports/`.

Each PDF contains:
1. **Cover Page** — campaign name, scan date, compliance level, overall score
2. **Executive Summary** — overall score gauge, category bar charts, issue severity counts, sites list
3. **Site Results** (one page per site) — per-site score, category breakdown, top issues
4. **Detailed Findings** *(optional, `includeDetails: true`)* — full issue list with WCAG criterion, severity, element, and help URL
5. **Appendix** — WCAG 2.1 reference, methodology notes, disclaimer
