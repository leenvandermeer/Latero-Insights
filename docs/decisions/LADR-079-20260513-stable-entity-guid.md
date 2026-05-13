# LADR-079: Stable Entity GUID for URL-Safe Identification

**Status:** PROPOSED  
**Date:** 2026-05-13  
**Author:** Leen van der Meer  
**Related Requirements:** LINS-021 (No fabricated values)

## Context

Lineage URLs currently use `?entity_fqn=cbsenergie` to identify entities. This creates
three LINS-021 violations:

1. **Not unique** — `cbsenergie` can exist across multiple layers (bronze, silver, gold)
2. **Fuzzy matching** — `resolveInitialAnchor()` falls back to `.includes()` search when
   exact match fails, which is a form of fabricated derivation
3. **No stable identifier** — `dataset_id` and `layer` are mutable; URLs break on rename

The current code in `trace-view.tsx`:

```typescript
function resolveInitialAnchor(initialFocus: string | undefined, entities: LineageEntity[]) {
  if (!initialFocus) return null;
  const lower = initialFocus.toLowerCase();
  const byKey = entities.find((entity) => lineageNodeKey(entity).toLowerCase() === lower);
  if (byKey) return lineageNodeKey(byKey);
  const byName = entities.find((entity) => entity.name.toLowerCase().includes(lower));  // ← FORBIDDEN
  return byName ? lineageNodeKey(byName) : null;
}
```

The fuzzy match with `.includes()` violates LINS-021: **Construction, parsing, or
derivation of values is forbidden.**

### Database Reality

After LADR-065 (WP-NDI-001), `meta.datasets` has:
- PRIMARY KEY: `(installation_id, dataset_id, layer)`
- No stable identifier suitable for URL sharing

## Decision

Add a stable UUID to `meta.datasets`:

```sql
ALTER TABLE meta.datasets 
  ADD COLUMN entity_guid UUID DEFAULT gen_random_uuid() NOT NULL;

CREATE UNIQUE INDEX idx_meta_datasets_guid 
  ON meta.datasets (entity_guid);
```

### URL Schema

**Before:**
```
/lineage?entity_fqn=cbsenergie  ← not unique, enables fuzzy match
```

**After:**
```
/lineage?guid=550e8400-e29b-41d4-a716-446655440000  ← dataset-level (preferred)
/lineage?entity_fqn=cbsenergie                      ← entity-level (backward compatible, exact match only)
```

Both parameters use **exact match semantics only** (LINS-021 compliant). No fuzzy matching.

### Resolution Logic

**Before (violates LINS-021):**
```typescript
// Fuzzy match as fallback
const byName = entities.find((entity) => 
  entity.name.toLowerCase().includes(lower)
);
```

**After (compliant):**
```typescript
// Exact match only — try GUID first, then dataset_id
if (initialGuid) {
  const byGuid = entities.find((entity) => entity.entity_guid === initialGuid);
  return byGuid ? lineageNodeKey(byGuid) : null;
}
if (initialEntityFqn) {
  const byDatasetId = entities.find((entity) => entity.dataset_id === initialEntityFqn);
  return byDatasetId ? lineageNodeKey(byDatasetId) : null;
}
return null;  // no fallback, no fuzzy match
```

## Consequences

### Positive

- **LINS-021 compliant** — GUID is a direct database field, no derivation; both URL
  parameters use exact match semantics only
- **Globally unique** — one GUID per `(dataset_id, layer)` tuple
- **Stable** — survives entity renames, layer moves
- **Shareable URLs** — `?guid=...` enables precise bookmarking and deep-linking
- **Backward compatible** — `?entity_fqn=...` still works for entity-level links
  (exact match on `dataset_id`)

### Negative

- **Migration cost** — existing URLs with fuzzy-matched `?entity_fqn=...` may break if
  they relied on partial matching (acceptable — no published API contract for this
  parameter, and fuzzy matching violates LINS-021)
- **GUID leakage** — GUIDs in URLs are not human-readable (acceptable trade-off for
  stability and LINS-021 compliance)

### Neutral

- `entity_guid` is generated at INSERT time via `gen_random_uuid()` (Postgres default)
- Existing rows receive GUIDs during migration
- API payloads grow by ~36 bytes per entity (UUID string representation)
- Two URL parameters supported: `?guid=...` (dataset-level) and `?entity_fqn=...`
  (entity-level)

## Implementation

1. **Migration** (`052_entity_guid.sql`):
   - Add `entity_guid UUID DEFAULT gen_random_uuid() NOT NULL`
   - Create unique index `idx_meta_datasets_guid`
   - Backfill existing rows (136 rows received GUIDs on 2026-05-13)

2. **TypeScript types** (`adapters/types.ts`):
   - Add `entity_guid: string` to `LineageEntity` (required, always present)

3. **Read API** (`insights-saas-read.ts`):
   - Include `d.entity_guid` in SELECT from `meta.datasets`
   - All production reads go through Postgres with GUID

4. **Frontend** (`lineage/dashboard.tsx`, `trace-view.tsx`):
   - Support both `?guid=...` (dataset-level) and `?entity_fqn=...` (entity-level)
   - Remove fuzzy match logic from `resolveInitialAnchor`
   - Exact match only on GUID or dataset_id

5. **Cache refresh** (`api/cache/refresh/route.ts`):
   - Updated to read from Postgres via `getLineageEntitiesFromSaaS()`
   - No longer reads directly from Databricks (GUID always present)
   - Requires authenticated session with installation_id

6. **DatabricksAdapter deprecation** (`adapters/databricks.ts`):
   - `getLineageEntities()` now throws deprecation error
   - Legacy method that bypassed Postgres store
   - Production must use sync → Postgres → read flow

7. **LINS-021 update** (`current-product-requirements.md`):
   - Add fuzzy matching to forbidden patterns list
   - Document GUID as canonical entity identifier

## Alternatives Considered

### A. Use `(dataset_id, layer)` composite key in URL
```
/lineage?dataset_id=cbsenergie&layer=bronze
```
**Rejected:** Requires two parameters; not stable on rename; more complex URL parsing.

### B. Use `layer::dataset_id` string key
```
/lineage?key=bronze::cbsenergie
```
**Rejected:** Still mutable on rename; `::` separator is application convention, not a
natural database field (LINS-021 gray area).

### C. Status quo with fuzzy matching
**Rejected:** Direct LINS-021 violation.

## References

- LINS-021: No fabricated values in the data store
- LADR-065: Natural dataset identity (WP-NDI-001)
- WP-NDI-001: Natural Dataset Identity workpackage
