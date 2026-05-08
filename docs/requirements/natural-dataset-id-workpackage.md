# Work Package: Natural Dataset Identity (LINS-021 Compliance)

**WP-ID:** WP-NDI-001  
**Datum:** 2026-05-06  
**Auteur:** Leen van der Meer  
**Status:** DRAFT — reviewed, incorporating validation feedback  
**Gerelateerd ADR:** LADR-058 (te herzien), LADR-065 (nieuw — proposed)  
**Requirements:** LINS-021, LINS-016, LINS-020  
**Reviewed by:** Requirements engineer (APPROVED WITH COMMENTS), Data modeler (APPROVED WITH COMMENTS)

---

## Problem Statement

`meta.datasets.dataset_id` is currently a composite string constructed as
`"{entity_name}::{layer}"` (e.g., `"cbs_arbeid::bronze"`), introduced via LADR-058 to
solve self-referencing lineage edges when all layer-versions of an entity shared the
same identifier.

This pattern **violates LINS-021**: the value `"cbs_arbeid::bronze"` does not exist
anywhere in the source system. It is fabricated by `layerScopedId()` in `meta-ingest.ts`
from two separately-observed fields (`entity_name` and `layer`). The `::` separator is an
internal convention with no semantic equivalent in Databricks or any OpenLineage schema.

Note: LINS-021 is marked `✓ IMPLEMENTED` but `layerScopedId()` was never added to its
list of forbidden patterns. This WP closes that gap. The deliverable "Updated LINS-021
note" must add `layerScopedId()` to the forbidden-patterns list and remove the
`✓ IMPLEMENTED` marker until this WP is fully closed.

### Current State (LADR-058)

```
meta.datasets
  dataset_id    TEXT  PRIMARY  -- "cbs_arbeid::bronze"   ← fabricated composite
  fqn           TEXT           -- "cbs_arbeid"           ← actual natural identifier
  layer         TEXT           -- "bronze"
  group_id      TEXT           -- "cbs_arbeid"           ← same as fqn, redundant
```

`fqn` already holds the correct natural value. The composite `dataset_id` is used as:
1. FK target from `meta.jobs.dataset_id`
2. FK target from `meta.run_io.dataset_id`
3. FK target from `meta.lineage_edges` (source_dataset_id, target_dataset_id)
4. FK target from `meta.lineage_columns` (source_dataset_id, target_dataset_id)
5. FK target from `meta.quality_rules.dataset_id`
6. JOIN key in `entities/route.ts`: `j2.dataset_id = d.fqn` (already a mismatch
   that required compensating logic in migration 021)

### Why LADR-058's Problem Was Real

Without a layer dimension in the key, `(entity_name='cbs_arbeid', layer='raw')` and
`(entity_name='cbs_arbeid', layer='bronze')` would both have `dataset_id='cbs_arbeid'`,
causing:
- UPSERT collisions when different pipeline layers write to `meta.datasets`
- Self-referencing lineage edges (`cbs_arbeid → cbs_arbeid`) in `meta.lineage_edges`

The problem is **real** — but the solution (embedding layer in the key string) was
a shortcut that created a LINS-021 violation.

---

## Chosen Design: Option A — (entity_name, layer) as composite PK

After validation review, **Option A** is the recommended approach. Options B and C
were evaluated and rejected (see below).

```sql
meta.datasets
  entity_name   TEXT  NOT NULL   -- natural source identifier, e.g. "cbs_arbeid"
  layer         TEXT  NOT NULL   -- "landing" | "raw" | "bronze" | "silver" | "gold"
  installation_id UUID NOT NULL

  PRIMARY KEY (installation_id, entity_name, layer)
  -- drop dataset_id column (renamed to entity_name)
  -- drop fqn column (was identical to entity_name)
  -- drop group_id column (was identical to entity_name)
```

All FK references change from single-column `dataset_id TEXT` to two-column
`(entity_name TEXT, layer TEXT)`.

**Self-referencing edge protection** via DB constraint (replaces application-level guard):

```sql
ALTER TABLE meta.lineage_edges
  ADD CONSTRAINT lineage_no_self_loop
    CHECK (
      source_entity_name <> target_entity_name
      OR source_layer <> target_layer
    );
```

Same entity name is allowed when layers differ (valid `landing → raw` hop). Only
`(entity_name, layer) = (entity_name, layer)` on both sides is a true self-loop.

### Why Not Option B

Option B (keep `dataset_id` column name, write bare entity name) results in identical
migration cost — every FK table still needs `layer` added. The only difference is that
`dataset_id` and `entity_name` become two columns with the same semantics. Option A
eliminates that redundancy by making the PK the truth.

### Why Not Option C (full workspace FQN)

Option C requires the ingest source to emit the workspace-qualified path
(e.g., `"my_catalog.silver.gemeente_arbeid"`), which is not available at ingest time in
the current framework. Option A leaves a clean migration path when LADR-062 workspace
FQNs become available: `entity_name` simply holds a richer value with no structural
schema change. Do not wait for LADR-062.

---

## Affected Components

| Component | Change |
|---|---|
| `infra/sql/init/022_natural_dataset_id.sql` | Full migration (see below) |
| `web/src/lib/meta-ingest.ts` | Remove `layerScopedId()`; write `entity_name` directly |
| `web/src/lib/databricks-sync.ts` | Remove composite key construction |
| `web/src/app/api/entities/route.ts` | Update JOIN: `j2.entity_name = d.entity_name AND j2.layer = d.layer` |
| `web/src/app/api/pipelines/route.ts` | Update dataset JOIN keys |
| `web/src/app/api/lineage/route.ts` | Update lineage edge JOIN keys |
| `web/src/lib/insights-saas-read.ts` | Update any `fqn`/`dataset_id` references |
| `web/src/types/` | Update TypeScript types; remove composite format assumptions |
| `docs/requirements/current-product-requirements.md` | Add `layerScopedId()` to LINS-021 forbidden list; reopen IMPLEMENTED status |

---

## Migration Plan (5 phases, must run in order)

### Phase 1 — Extend FK tables (non-breaking, nullable)

Add nullable `layer` columns to all FK referencing tables. Backfill from the
existing composite `dataset_id` using `split_part(dataset_id, '::', 2)`.
Verify zero-null counts before proceeding.

```sql
-- Example: meta.jobs
ALTER TABLE meta.jobs ADD COLUMN dataset_layer TEXT;
UPDATE meta.jobs SET dataset_layer = split_part(dataset_id, '::', 2)
  WHERE dataset_id LIKE '%::%';

-- meta.jobs layer note: meta.jobs should store entity_name only (not layer).
-- Layer belongs on meta.run_io where input/output roles are tracked per run.
-- See FK Design Note below.
```

Apply the same pattern to `meta.run_io`, `meta.lineage_edges`, `meta.lineage_columns`,
`meta.quality_rules`.

### Phase 2 — Add constraints

```sql
-- Prepare new PK candidate (still named dataset_id at this point)
ALTER TABLE meta.datasets
  ADD CONSTRAINT datasets_entity_layer_unique UNIQUE (installation_id, dataset_id, layer);

-- Self-loop guard
ALTER TABLE meta.lineage_edges
  ADD CONSTRAINT lineage_no_self_loop
    CHECK (source_entity_name <> target_entity_name OR source_layer <> target_layer);
```

### Phase 3 — Migrate FKs and strip `::` suffix (single transaction)

Strip the `::layer` suffix from all `dataset_id` values in `meta.datasets` and all
referencing FK columns. Perform within a single transaction with row-count assertions
before committing.

```sql
BEGIN;
  -- Strip composite suffix
  UPDATE meta.datasets
    SET dataset_id = split_part(dataset_id, '::', 1)
    WHERE dataset_id LIKE '%::%';

  -- Update FK tables to use bare entity name
  UPDATE meta.jobs
    SET dataset_id = split_part(dataset_id, '::', 1)
    WHERE dataset_id LIKE '%::%';
  -- ... repeat for run_io, lineage_edges, lineage_columns, quality_rules

  -- Verify: no composite values remain
  DO $$ BEGIN
    ASSERT (SELECT COUNT(*) FROM meta.datasets WHERE dataset_id LIKE '%::%') = 0;
  END $$;
COMMIT;
```

### Phase 4 — Update write path

Deploy updated `meta-ingest.ts` and `databricks-sync.ts` that write bare `entity_name`
(no `::` suffix). This phase must be deployed atomically with Phase 3 — run both in
a maintenance window. After deployment, all new writes use the natural identifier.

### Phase 5 — Drop redundant columns, rename

```sql
ALTER TABLE meta.datasets
  DROP COLUMN fqn,
  DROP COLUMN group_id;
ALTER TABLE meta.datasets RENAME COLUMN dataset_id TO entity_name;
ALTER TABLE meta.datasets DROP CONSTRAINT IF EXISTS datasets_entity_layer_unique;
-- The renamed PK already covers (installation_id, entity_name, layer)
```

---

## FK Design Note: meta.jobs

`meta.jobs` currently carries `dataset_id` as a 1:1 job-to-dataset reference. A single
job can produce outputs in multiple layers (e.g., `raw → bronze` writing two datasets).
Therefore **layer does not belong on `meta.jobs`**. After this WP, `meta.jobs` stores
`entity_name` only (the primary entity the job operates on). Layer resolution at
query time goes through `meta.run_io`, which tracks input/output roles per run and
will carry `(entity_name, layer)` as its FK reference.

---

## Deliverables

- [ ] LADR-065: ADR documenting Option A, migration approach, and lineage self-loop constraint
- [ ] `infra/sql/init/022_natural_dataset_id.sql`: all 5 migration phases
- [ ] `meta-ingest.ts`: remove `layerScopedId()`, write natural identifier
- [ ] `databricks-sync.ts`: remove composite key construction
- [ ] All affected API routes: updated JOIN keys
- [ ] TypeScript types: remove composite format assumptions
- [ ] `current-product-requirements.md`: add `layerScopedId()` to LINS-021 forbidden list; reopen IMPLEMENTED status until WP closes
- [ ] Verify: `meta.entities` JOIN correctness (`entity_name` reference from `meta.datasets` to `meta.entities`) confirmed in Phase 3 validation
- [ ] Re-sync verification: existing data still queryable after migration

---

## Acceptance Criteria

1. `meta.datasets.entity_name` for a Databricks entity `gemeente_arbeid` in layer `silver`
   stores `"gemeente_arbeid"`, not `"gemeente_arbeid::silver"`.
2. `PRIMARY KEY (installation_id, entity_name, layer)` constraint on `meta.datasets` is
   enforced by the database, not by value construction.
3. `fqn` and `group_id` columns are dropped in Phase 5. No deprecated aliases survive
   in the production schema.
4. `j2.entity_name = d.entity_name AND j2.layer = d.layer` replaces `j2.dataset_id = d.fqn`
   in `entities/route.ts`.
5. `layerScopedId()` function is deleted from `meta-ingest.ts`.
6. No `::` characters appear in any `entity_name` value in `meta.datasets`.
7. No self-referencing edges (`source_entity_name = target_entity_name AND source_layer = target_layer`)
   exist in `meta.lineage_edges`. No `::` characters appear in any node ID in the
   `GET /api/lineage` payload.
8. All read API routes (`/api/lineage`, `/api/pipelines`, `/api/entities`) scope all
   queries by `installation_id`. No JOIN across `meta.datasets`, `meta.jobs`, `meta.run_io`,
   or `meta.lineage_edges` omits the `installation_id` predicate (LINS-016 invariant).
9. `meta.jobs` stores `entity_name` only; no `layer` column is added to `meta.jobs`.
   Layer resolution at query time goes through `meta.run_io`.
10. LINS-020 fallback label (`dataset_id` field, now `entity_name`) remains a direct DB
    value — no constructed or derived string.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phase ordering error leaves orphaned FK rows | Medium | High | Strict phase order; transaction with row-count assertions in Phase 3 |
| `meta.lineage_columns` missed in migration | Medium | Medium | Explicitly included in Phase 1–3 |
| Lineage self-referencing edges reappear after migration | Low | High | DB CHECK constraint added in Phase 2 |
| Databricks sync produces duplicate datasets during transition | Medium | Medium | Run Phase 3+4 atomically in maintenance window |
| External API clients store composite `dataset_id` values | Low | Low | LINS-021 only applies to Latero Control Postgres store |

---

## Non-Goals

- This WP does not redesign the lineage edge model or graph rendering logic.
- This WP does not implement full workspace FQNs (deferred to LADR-062); `entity_name`
  holds the bare natural name pending that work.
- This WP verifies but does not restructure `meta.entities`; JOIN correctness between
  `meta.datasets.entity_name` and `meta.entities.entity_name` is confirmed as part of
  Phase 3 validation.
- This WP does not change `meta.runs`, `meta.quality_results`, or `meta.quality_rules`
  beyond the FK column additions in Phase 1.
