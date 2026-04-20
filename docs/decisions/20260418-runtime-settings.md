# LADR-004 — Runtime settings store and editable configuration UI

**Datum:** 2026-04-18
**Status:** ACCEPTED

## Context

Layer2 Meta Insights requires Databricks connection credentials and cache
configuration. The initial implementation read all configuration exclusively
from environment variables, which required a server restart to change any
setting. This created friction for demos and local development where operators
frequently switch between Databricks environments or toggle cache-only mode.

## Decision

Introduce a runtime settings store backed by a JSON file at
`.cache/settings.json`. Settings are loaded at request time using the priority
order: `settings.json` > environment variables > defaults. A PUT endpoint at
`/api/settings` allows the settings file to be updated at runtime without
restarting the server.

An editable Settings page (`/settings`) exposes all configurable fields:
Databricks host, token (masked in GET responses), SQL warehouse ID, catalog,
schema, cache TTL, and cache-only toggle. A dedicated `/api/test-connection`
endpoint tests Databricks connectivity independently from the health check.

Saving settings invalidates the full TanStack Query client cache so that all
dashboard pages re-fetch immediately with the new configuration.

## Consequences

- `.cache/settings.json` is the runtime source of truth for configuration
- The file is created on first save and gitignored
- Token values are stored in plaintext in the settings file — operators must
  secure filesystem access accordingly
- Environment variables remain as fallback, enabling container deployments
  without a settings file
- Changes to the settings schema must maintain backward compatibility with
  existing `settings.json` files (missing keys fall back to env/defaults)
- Requirements: LINS-100, LINS-101
