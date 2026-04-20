# LADR-005 — Cache-only operating mode and demo seed data

**Datum:** 2026-04-18
**Status:** ACCEPTED

## Context

Layer2 Meta Insights is demonstrated to stakeholders who do not have access
to a live Databricks workspace. Previously, demonstrating the application
required a live Databricks connection or manually crafted cache files. A
simpler, self-contained demo mode was needed.

Additionally, when a Databricks connection is available, the previous
cache-first fetch strategy always served stale cache data even when live
data was accessible, making it confusing for operators who had just connected.

## Decision

**1. Cache-only mode toggle.**
Add a `cacheOnly` boolean to the runtime settings store (LADR-004). When
`cacheOnly` is true, data API routes serve exclusively from the file cache
and return HTTP 503 if no cache entry exists. When `cacheOnly` is false,
routes call Databricks first (live-first strategy), write the result to
cache, and fall back to cached data if Databricks is unavailable.

**2. Three-state source indicator.**
API responses include `source: "databricks" | "cache" | "fallback"`. The
`SourceIndicator` UI component renders three distinct visual states:
- `databricks` — green "Live" badge
- `cache` — amber "Cache" badge (cache-only mode active)
- `fallback` — red "Fallback" badge (Databricks unavailable, serving cache)

**3. Synthetic seed data.**
A `POST /api/cache/seed` endpoint generates deterministic synthetic records
for all three ESG demo datasets across a 30-day window and writes them to
the file cache. The endpoint preserves existing Databricks credentials when
it enables cache-only mode. A "Load Demo Data" button in the Settings UI
triggers the endpoint. A CLI script (`scripts/seed-cache.ts`) provides the
same capability outside the running application.

**4. Cache clear safety.**
Cache clear operations skip `settings.json` to prevent accidental loss of
configured credentials.

## Consequences

- Demos run fully offline with realistic synthetic data after one button click
- Switching between live and demo mode is a Settings UI action, not a
  deployment change
- The file cache is the source of truth for data in cache-only mode; TTL
  is configurable (default 7 days for demo, 24 hours for live)
- The live-first strategy means that disabling cache-only mode and saving
  settings immediately triggers fresh Databricks fetches on next page load
- Seed data is deterministic (seeded RNG) — the same button press always
  produces the same dataset
- Requirements: LINS-102, LINS-103
