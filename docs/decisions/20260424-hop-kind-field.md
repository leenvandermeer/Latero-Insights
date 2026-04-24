# LADR-007 — Explicit `hop_kind` field on `meta.data_lineage`

Date: 2026-04-24
Status: Proposed
Owner: Latero product

---

## Context

`meta.data_lineage` stores all lineage events written by Latero pipeline steps. Not all rows
represent a real dataset transition. Some rows record framework-internal references — for
example, a hop from the Latero runtime context to a landing entity used as evidence — that
are not part of the actual data flow from source to gold.

Consumers (specifically Latero Insights) must currently infer whether a hop is a "real"
data-flow transition or a context reference by combining heuristics on `source_type`,
`target_type`, and `relation_type`. This leads to:

- Incorrect input/output counts on the lineage page (a context hop is counted as an extra input)
- Fragile dashboard logic that breaks when new step types are introduced
- Re-derivation of semantics that are already known at write time

The existing schema already carries `lineage_scope` (`file` | `dataset` | `attribute`) for
granularity and `relation_type` (`copied_to` | `parsed_to` | `transformed_to`) for the
semantic relationship. Neither of these fields distinguishes materiaal data flow from
contextual evidence.

---

## Decision

**LMETA-017 — Add `hop_kind STRING` to `meta.data_lineage`.**

All callers of `EventLogger.lineage()` MUST pass `hop_kind`. The field makes the
intended role of each lineage row explicit at write time so no consumer needs to derive it.

**Valid values:**

| Value | Meaning |
|---|---|
| `data_flow` | A real dataset transition — a medallion hop that moves or transforms data (e.g. `raw → bronze`, `bronze → silver`). These rows count as inputs/outputs in lineage coverage. |
| `context` | A framework-internal or evidence reference that is not a data transition. These rows must be excluded from input/output counts, source/target totals, and lineage depth calculations. |

**NULL treatment for historical rows:**

Rows written before LMETA-017 have `hop_kind = NULL`. Consumers MUST treat `NULL` as
`data_flow` for backward compatibility, since all existing rows in the medallion pipeline
are real data-flow hops. Consumers must not silently drop NULL rows.

---

## Rationale

Adding a single explicit field eliminates an entire class of consumer heuristics. The
producer (Latero) always knows whether a hop is a data transition or context at write time.
Encoding that knowledge once in the source removes the need for every consumer to re-derive
it and prevents divergence between consumers.

`hop_kind` is intentionally separate from:

- `lineage_scope` — which answers "what granularity is this hop?" (file/dataset/attribute),
  not "is this hop part of the data flow?"
- `relation_type` — which answers "how was the data transformed?", not "was this a real
  data transition?"
- `source_type` / `target_type` — which are UI labels for entity type, not flow semantics

Two values are sufficient for now. A third value (`control`) may be added in a future release
if DQ check provenance rows need their own classification. Do not add it preemptively.

---

## Consequences

### For Latero pipeline notebooks

All notebooks calling `logger.lineage()` must pass `hop_kind = 'data_flow'` for all
medallion step hops. All non-data-transition calls (framework context, evidence references)
must pass `hop_kind = 'context'`.

### For Latero Insights

The lineage page must filter on `hop_kind IN ('data_flow') OR hop_kind IS NULL` when
computing:

- input dataset count
- output dataset count
- source/target references
- lineage depth
- end-to-end coverage

`context` rows may still be displayed in a detail view or evidence panel, but must not
be counted as dataset transitions.

### For `lineage_entities_current` projector

The projector query must exclude `hop_kind = 'context'` rows when building
`upstream_entity_fqns` and `downstream_entity_fqns`. Rows where `hop_kind IS NULL`
must be included (treated as `data_flow` per backward-compatibility rule).

---

## DDL Migration

### Databricks

```sql
-- LMETA-017: add hop_kind to data_lineage
ALTER TABLE workspace.meta.data_lineage
  ADD COLUMNS (
    hop_kind STRING COMMENT 'Role of this lineage hop: data_flow (real data transition) or context (framework/evidence reference). NULL = data_flow for historical rows.'
  );
```

### Snowflake

```sql
ALTER TABLE LATERO.META.DATA_LINEAGE
  ADD COLUMN hop_kind VARCHAR
    COMMENT 'Role of this lineage hop: data_flow or context. NULL = data_flow for historical rows.';
```

---

## References

- LMETA-017 in `docs/framework/requirements/meta-table-contract.md`
- LADR-005 — Lineage current-state projection tables (`20260421-lineage-current-state-projection.md`)
- LADR-006 — Deterministic layer columns (`20260422-meta-lineage-layer-columns.md`)
- Latero Insights lineage integration guide (`docs/framework/latero-insights-lineage-integration.md`)
