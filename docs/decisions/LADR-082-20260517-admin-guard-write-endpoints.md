# LADR-082 — Admin guard on infrastructure write endpoints

**Date:** 2026-05-17
**Status:** Accepted

## Context

During a security review of the API surface, several write endpoints were found to require only an authenticated session (`requireSession`) but not an admin role (`checkIsAdmin`). Any authenticated member of an installation could invoke these endpoints, which control infrastructure-level configuration and operations.

Affected endpoints before this fix:

| Endpoint | Method | Risk |
|---|---|---|
| `GET /api/cache` | GET | Cache metadata exposed without any auth |
| `DELETE /api/cache` | DELETE | Any unauthenticated caller could clear all cached data |
| `POST /api/sync/databricks` | POST | Any member could trigger a full Databricks sync |
| `POST /api/test-connection` | POST | Any member could probe Databricks credentials |
| `POST /api/cache/refresh` | POST | Any member could force-refresh cache from Databricks |
| `PUT /api/settings/alert-routing` | PUT | Any member could overwrite alert routing rules |
| `PUT /api/settings/notifications` | PUT | Any member could overwrite notification credentials (Slack webhooks, PagerDuty tokens) |
| `POST /api/settings/notifications` | POST | Any member could send test notifications |
| `PUT /api/settings` | PUT | Any member could overwrite Databricks credentials |

The settings page (`/settings`) already enforced admin-only via a server-side `checkIsAdmin` redirect, but the underlying API routes were unguarded — bypassing the page guard via direct API calls was trivially possible.

## Decision

All infrastructure write endpoints — those that modify configuration, credentials, or trigger platform-level operations — require both:

1. A valid session (`requireSession`) → 401 if missing
2. Admin role (`checkIsAdmin`) → 403 if not admin

Read endpoints that expose only metadata (e.g., `GET /api/cache`) require at minimum a valid session.

Operational member actions (incidents, alerts, changes, compliance exceptions) remain member-accessible — these are intended to be collaborative and do not expose credentials or platform configuration.

## Consequences

- Non-admin members receive 403 on all infrastructure writes; the UI already hides these controls behind the `/settings` admin guard.
- `DELETE /api/cache` now requires a session, preventing unauthenticated cache invalidation.
- The `checkIsAdmin` DB lookup adds one query per guarded request; this is acceptable given the low frequency of these endpoints.
- Future infrastructure write endpoints must include both guards by default.
