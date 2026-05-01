# LADR-030 — Installation-scoped DatabricksAdapter settings resolution

**Datum:** 2026-05-01  
**Status:** ACCEPTED  
**Auteur:** Latero product

---

## Context

`DatabricksAdapter` is the server-side client that executes SQL statements against
a Databricks SQL Warehouse. Its internal helper functions (`executeStatement`,
`fqTable`, `resolveEnvironmentScope`) all called `loadSettings()` with no argument,
which reads only the root-level section of `.cache/settings.json`.

The Settings UI (`PUT /api/settings`) saves configuration *scoped* to the active
installation (`saved.scoped[installationId]`). This is correct for multi-tenant
isolation: each installation has its own Databricks credentials and catalog/schema
pair.

The mismatch: the adapter read from root level, the UI wrote to scoped level. The
result was that every adapter invocation — sync, health check via the adapter,
auto-sync — saw empty credentials and threw:

> "Missing Databricks configuration. Configure via Settings page or set
> DATABRICKS_HOST, DATABRICKS_TOKEN, and DATABRICKS_WAREHOUSE_ID."

The `/api/test-connection` route was unaffected because it calls `loadSettings(session.active_installation_id)` directly and never uses the adapter.

## Beslissing

Thread `installationId` through the full adapter call chain:

1. `DatabricksAdapter` constructor accepts an optional `installationId?: string`.
2. All module-level helpers (`executeStatement`, `fqTable`, `resolveEnvironmentScope`,
   `liveDataPredicate`, `scopedWhereClause`, `describeColumns`) accept an optional
   `installationId?` parameter and pass it to `loadSettings(installationId)`.
3. All class methods store `this.installationId` and pass it to every helper call.
4. Callers that construct `DatabricksAdapter` must supply the session's
   `active_installation_id`:
   - `/api/health` — passed at construction time per request
   - `syncFromDatabricks()` — accepts `installationId?`, passed to constructor
   - `/api/sync/databricks` — passes `session.active_installation_id`
   - `databricks-auto-sync` — passes `undefined` (auto-sync reads root-level env
     vars only; scoped sync is triggered manually per installation)

## Gevolgen

- Settings saved through the UI are now correctly resolved for all server-side
  Databricks operations.
- `DatabricksAdapter()` without an `installationId` still works as before for
  installations that rely on environment variables (`DATABRICKS_HOST` etc.) at
  the root level.
- The schema cache (`schemaCache`, `environmentScopeCache`) keys on the
  fully-qualified table name, which already embeds catalog and schema. Scoped
  catalog/schema differences between installations are therefore isolated.
- Auto-sync (`triggerAutoSyncIfDue`) does not carry session context. It continues
  to read root-level settings and is only effective when credentials are set via
  environment variables. Manual sync via `/api/sync/databricks` is the correct
  path for UI-configured installations.
