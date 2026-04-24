# Layer2 Meta Insights

SaaS-first metadata operations platform for the Latero Meta Data Control Framework.

## Architecture (Current)

Layer2 Meta Insights now runs on a push-based SaaS architecture:

1. Databricks/Snowflake runtimes push events to `/api/v1/*`
2. Insights persists events in Postgres (`pipeline_runs`, `data_quality_checks`, `data_lineage`)
3. Dashboard read APIs (`/api/pipelines`, `/api/quality`, `/api/lineage`) read from Postgres first
4. Dashboard data is served from the Insights SaaS store (with cache fallback during outages)

This means client-side pipelines do not need a direct Postgres connector.

## Prerequisites

- **Node.js** 20+ (LTS) — install via [nvm](https://github.com/nvm-sh/nvm) or [Homebrew](https://brew.sh)
- **npm** 10+ (ships with Node.js 20)
- **Databricks workspace** with SQL Warehouse access (free tier works)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create local environment file
cp .env.example .env.local

# 3. Edit .env.local with your Databricks credentials (see below)

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Local Azure-Parity Development (MacBook)

Use this mode when you want to develop locally and promote to Azure later with
minimal surprises.

### 1. Install Docker Desktop (one-time)

`npm run infra:up` uses Docker Compose. Install Docker Desktop first:

```bash
brew install --cask docker
open -a Docker
```

Notes:

- During `brew install --cask docker`, macOS may ask for `Password:` to create
    CLI symlinks. Enter your Mac login password and press Enter.
- Wait until Docker Desktop shows `Docker is running`.

Verify:

```bash
docker --version
docker compose version
```

### 2. Start local infrastructure

```bash
npm run infra:up
```

This starts:

- Postgres on `localhost:5432`
- Redis on `localhost:6379`
- Azurite (Azure Storage emulator) on `localhost:10000-10002`

Database bootstrap:

- On first startup, Postgres automatically executes SQL files in `sql/init/`.
- The file `sql/init/001_insights_saas_init.sql` creates the SaaS ingestion schema:
    - `insights_installations`
    - `pipeline_runs`
    - `data_quality_checks`
    - `data_lineage`
    - `ingest_audit`
- If you need to re-run initialization from scratch, remove the Postgres volume first:

```bash
docker compose -f docker-compose.local.yml down -v
npm run infra:up
```

Of gebruik de shortcut:

```bash
npm run infra:reset-db
```

Important:

- `docker-compose.local.yml` starts local infrastructure only.
- The Next.js app itself still runs as a local process via `npm run dev`.
- The default `npm run infra:up` flow is intended for local infra parity while keeping hot reload for the web app.

### 3. Configure local env

```bash
cp .env.example .env.local
```

For local infrastructure parity, keep these values in `.env.local`:

```env
POSTGRES_URL=postgresql://insights:insights@localhost:5432/insights
REDIS_URL=redis://localhost:6379
AZURE_STORAGE_BLOB_ENDPOINT=http://127.0.0.1:10000/devstoreaccount1
AZURE_STORAGE_QUEUE_ENDPOINT=http://127.0.0.1:10001/devstoreaccount1
```

The app now reads dashboard/runtime metadata from local Postgres (SaaS ingest
store).

### 4. Start app

```bash
npm run dev
```

Optional: run the web app in a dev container while keeping local infra in Docker

```bash
npm run dev:docker:up
```

This starts:

- Postgres, Redis, and Azurite from `docker-compose.local.yml`
- the Next.js dev server from `docker-compose.dev.yml`

The app is still a development server with hot reload. Open:

- `http://localhost:3010`

Important dev-container behavior:

- the repository is bind-mounted into the container (`.:/app`)
- your source code still lives on the host
- `.cache`, `data`, and `.next` stay on the host because they are part of the bind mount
- only `node_modules` lives in Docker via a named volume

Useful commands:

```bash
npm run dev:docker:logs   # Follow app logs
npm run dev:docker:down   # Stop app + infra containers
```

### 5. Useful local infra commands

```bash
npm run infra:logs   # Follow Postgres/Redis/Azurite logs
npm run infra:down   # Stop and remove local infra containers
```

### 6. Promotion path to Azure

Use the same app configuration keys per environment (`local`, `staging`,
`production`) and only change values:

- `POSTGRES_URL` -> Azure PostgreSQL Flexible Server connection string
- `REDIS_URL` -> Azure Cache for Redis connection string
- `AZURE_STORAGE_*` -> Azure Blob/Queue endpoints
- secrets move from `.env.local` -> Azure Key Vault references

## Daily Development Workflow

Use this sequence for day-to-day development on macOS:

```bash
# 1) Start local infrastructure (Docker)
npm run infra:up

# 2) Start Next.js app (local process with hot reload)
npm run dev
```

Then:

1. Open the app URL shown by Next.js (usually `http://localhost:3000`).
2. Verify API health at `http://localhost:3000/api/health`.
3. Develop and test your feature with hot reload.

When done:

```bash
# Stop app: Ctrl+C in the dev terminal

# Stop local infrastructure
npm run infra:down
```

## Databricks Connection Setup

### Step 1: Get your workspace hostname

Find your Databricks workspace URL. The hostname is the part after `https://`:

```
https://adb-1234567890123456.7.azuredatabricks.net
       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
       This is your DATABRICKS_HOST
```

### Step 2: Create a Personal Access Token (PAT)

1. Open your Databricks workspace
2. Click your user icon (top right) → **Settings**
3. Go to **Developer** → **Access tokens**
4. Click **Generate new token**
5. Give it a description (e.g. "Layer2 Meta Insights local dev")
6. Set expiry (90 days recommended for dev)
7. Copy the token — you won't see it again

### Step 3: Get your SQL Warehouse ID

1. In Databricks, go to **SQL Warehouses** (left sidebar)
2. Click on your warehouse (or create one — Serverless/Starter works)
3. In the **Connection details** tab, find the **HTTP path**:
   ```
   /sql/1.0/warehouses/abc123def456789
                        ^^^^^^^^^^^^^^^
                        This is your DATABRICKS_WAREHOUSE_ID
   ```
4. Alternatively, the warehouse ID is in the URL when viewing the warehouse

### Step 4: Configure .env.local

Edit `.env.local`:

```env
# Databricks connection
DATABRICKS_HOST=adb-1234567890123456.7.azuredatabricks.net
DATABRICKS_TOKEN=dapi_your_token_here
DATABRICKS_WAREHOUSE_ID=abc123def456

# Meta table location (defaults shown — change if your setup differs)
DATABRICKS_CATALOG=workspace
DATABRICKS_SCHEMA=meta

# Auth (disabled for local development)
INSIGHTS_AUTH_DISABLED=true
INSIGHTS_API_KEY=any-random-string-for-later
```

### Step 5: Verify the connection

Start the dev server and check the health endpoint:

```bash
npm run dev

# In another terminal:
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok","databricks":true,"timestamp":"2026-04-17T12:00:00.000Z"}
```

If you see `"databricks": false`, check:
- Is your SQL Warehouse running? (it may auto-suspend)
- Is the PAT valid and not expired?
- Is the host correct?
- Do the meta tables exist? (`workspace.meta.pipeline_runs`)

## API Endpoints

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/health` | GET | — | Connection health check |
| `/api/pipelines` | GET | `from`, `to` (YYYY-MM-DD) | Pipeline run data |
| `/api/quality` | GET | `from`, `to` (YYYY-MM-DD) | Data quality check results |
| `/api/lineage` | GET | `from`, `to` (YYYY-MM-DD) | Lineage hop data |

### SaaS ingest API (`/api/v1`)

These endpoints are intended for Latero runtime adapters (Databricks/Snowflake jobs)
to push metadata events into Insights-managed Postgres storage.

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/health` | GET | none | API + DB health for ingest path |
| `/api/v1/pipeline-runs` | POST | Bearer token | Ingest pipeline run events |
| `/api/v1/dq-checks` | POST | Bearer token | Ingest DQ check events |
| `/api/v1/lineage` | POST | Bearer token | Ingest lineage events |
| `/api/v1/installations/{installation_id}/status` | GET | Bearer token | Tenant status/counts |

Auth behavior:

- For `/api/v1/*`, `Authorization: Bearer <token>` is used.
- Token + `installation_id` are validated against `insights_installations`.
- If `INSIGHTS_AUTH_DISABLED=true`, token validation is bypassed (local dev only).

SaaS ingestion datastore:

- The Docker Postgres instance now initializes the Insights SaaS event tables automatically.
- This enables running the backend as one SaaS product with Databricks ingestion clients writing events into Insights-managed storage.
- Framework-side adapters can target the Insights SaaS API while notebooks only keep source-system execution config.

Example:
```bash
curl "http://localhost:3000/api/pipelines?from=2026-04-01&to=2026-04-17"
```

When auth is enabled (`INSIGHTS_AUTH_DISABLED` is not `true`), include the API key:
```bash
curl -H "x-api-key: your-key" "http://localhost:3000/api/pipelines?from=2026-04-01&to=2026-04-17"
```

## Meta Tables Required

Layer2 Meta Insights reads from three Latero MDCF meta tables. These are created
by the Latero framework bootstrap SQL:

```sql
-- Run this first if the tables don't exist:
-- sql/databricks/bootstrap.sql (demo schemas)
-- latero/adapters/databricks/bootstrap.sql (meta tables)
```

| Table | Description |
|-------|-------------|
| `{catalog}.{schema}.pipeline_runs` | Pipeline execution records |
| `{catalog}.{schema}.data_quality_checks` | DQ check results |
| `{catalog}.{schema}.data_lineage` | Lineage evidence |

## Project Structure

```

├── .env.example              # Environment template
├── .env.local                 # Your local config (git-ignored)
├── package.json               # Dependencies
├── next.config.ts             # Next.js config + security headers
├── tsconfig.json              # TypeScript config
├── src/
│   ├── middleware.ts           # API authentication
│   ├── app/
│   │   ├── globals.css         # Design tokens + responsive utils
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home redirect
│   │   ├── manifest.ts         # PWA manifest
│   │   ├── api/                # Backend-for-frontend API routes
│   │   │   ├── health/         # Connection health check
│   │   │   ├── pipelines/      # Pipeline runs endpoint
│   │   │   ├── quality/        # DQ checks endpoint
│   │   │   └── lineage/        # Lineage endpoint
│   │   └── (dashboard)/        # Dashboard pages
│   │       ├── layout.tsx      # Dashboard shell (sidebar + content)
│   │       ├── pipelines/      # → DashboardCanvas system:pipelines
│   │       ├── quality/        # → DashboardCanvas system:quality
│   │       ├── bcbs239/        # → DashboardCanvas system:bcbs239
│   │       ├── dashboard/      # Dashboard builder (canvas, widgets, palette)
│   │       ├── lineage/        # Lineage Explorer
│   │       └── openlineage/    # OpenLineage Viewer
│   ├── components/
│   │   ├── dashboard/          # Drawer panels (settings, new dashboard, publish widget)
│   │   ├── navigation/         # Sidebar, bottom nav, nav config
│   │   └── ui/                 # Shared UI components (Card, etc.)
│   ├── hooks/
│   │   └── use-breakpoint.ts   # Responsive breakpoint hook
│   ├── lib/
│   │   ├── adapters/           # Data adapter interface + Databricks impl
│   │   ├── rate-limit.ts       # API rate limiting
│   │   └── utils.ts            # Utilities (cn helper)
│   └── styles/
│       ├── tokens.css          # Design system tokens
│       └── responsive.css      # Responsive utilities
└── ux/
    └── wireframes.md           # UX design specification
```

## Dashboard Builder

Every view in Layer2 Meta Insights is a customisable dashboard. System dashboards (Pipelines, Data Quality, BCBS239) come pre-configured and can be reset to their defaults at any time. User dashboards are created via "New Dashboard" in the sidebar or from the dashboard switcher.

### Switching Dashboards

Click the dashboard title (the italic heading in the canvas header) to open the **dashboard switcher dropdown**. The dropdown lists all system and user dashboards. Select any entry to navigate to it. A "New Dashboard" action at the bottom creates a blank canvas.

To rename a user dashboard, hover over the title — a pencil icon (✎) appears to the right. Click it to edit the name inline.

### Widget Library

The widget library opens as a **right-side drawer** when edit mode is active. Click **+ Add Widget** in the dashboard header to enter edit mode — the drawer slides in automatically from the right. The library is part of the canvas editing surface, not the sidebar.

Available widget categories:

| Category | Widgets |
| -------- | ------- |
| Counters | Total Runs, Failed Runs, DQ Pass Rate, BCBS239 Score |
| Charts | Run Status Trend, DQ Pass Rate Trend, Results by Category, Avg Duration by Step, Event Log |
| Tables | Recent Pipeline Runs, DQ Check Results |
| My Widgets | Custom widgets created from the drawer and saved to your local store |

### Adding Widgets

Widgets can be added in two ways:

- **Click to add** — click any widget card in the library panel; the widget is placed at the first available grid position (left-to-right, top-to-bottom).
- **Drag to canvas** — drag a widget card from the library and drop it anywhere on the grid. A placement preview shows where the widget will land. Dragging automatically enables edit mode if it is not already active.

### Edit Mode

Click **+ Add Widget** in the dashboard header to enter edit mode. In edit mode:

- Drag widgets by their grip handle to reorder
- Resize widgets from the bottom-right corner handle
- Configure a widget via the ⚙ icon (title override, date range override)
- Remove a widget via the trash icon (requires confirmation)
- Click **Done** or **Done editing** to exit edit mode and close the library panel

### Custom Widgets

Click **Create widget** in the right-side drawer to switch the drawer from the widget library to the inline custom-widget builder. You can configure the widget while keeping the dashboard canvas visible, then use **Save and place** to add it directly to the current dashboard.

Custom widgets are saved to the local dashboard store and appear in the **My Widgets** section of the library drawer on all dashboards. The standalone `/dashboard/widget-builder` page still exists as an advanced builder flow, but the primary dashboard UX is now in-place creation and placement.

## Scripts

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
npm run infra:up    # Start local Postgres/Redis/Azurite
npm run infra:logs  # Follow local infra logs
npm run infra:down  # Stop local Postgres/Redis/Azurite
npm run dev:docker:up    # Run app + infra in Docker for development
npm run dev:docker:logs  # Follow dev app logs
npm run dev:docker:down  # Stop dev app + infra containers
```

## Troubleshooting

### "Missing Databricks configuration" error
Ensure all required env vars are set in `.env.local`. Restart `npm run dev` after changing env vars.

### SQL Warehouse is not responding
Databricks free tier warehouses auto-suspend after inactivity. Open your Databricks workspace and start the warehouse manually, or wait ~30 seconds for it to auto-start on the first query.

### "Unauthorized" on API endpoints
If you see 401 errors, either:
- Set `INSIGHTS_AUTH_DISABLED=true` in `.env.local` for local dev
- Or pass `x-api-key` header matching `INSIGHTS_API_KEY`

### Fonts not loading
Inter and Fraunces fonts are loaded via `next/font/google`. Ensure you have internet access on first load (fonts are cached after that).

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, shadcn/ui, Tailwind CSS v4 |
| Charts | Recharts |
| Graph | React Flow (@xyflow/react) |
| Icons | Lucide React |
| Data | Databricks SQL Statement Execution REST API |
| Design | Latero brand (Inter + Fraunces, navy + amber) |
