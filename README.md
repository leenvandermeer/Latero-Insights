# Layer2 Meta Insights

Self-service metadata observability portal for the Latero Meta Data Control Framework.

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

### Widget Library

The widget library opens as a left-side panel when edit mode is active. Click **+ Add Widget** in the dashboard header (accent button, always visible) to open it. The library is not in the sidebar — it is part of the canvas editing surface.

Available widget categories:

| Category | Widgets |
| -------- | ------- |
| Counters | Total Runs, Failed Runs, DQ Pass Rate, BCBS239 Score |
| Charts | Run Status Trend, DQ Pass Rate Trend, Results by Category, Avg Duration by Step, Event Log |
| Tables | Recent Pipeline Runs, DQ Check Results |
| My Widgets | Custom widgets created via the widget builder wizard |

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

Click **Build custom widget** (empty canvas state or via the widget builder link) to open the 4-step wizard at `/dashboard/widget-builder`. Custom widgets are saved to the store and appear in the "My Widgets" section of the library panel on all dashboards.

## Scripts

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
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
