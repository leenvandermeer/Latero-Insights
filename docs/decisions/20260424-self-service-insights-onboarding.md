# LADR-008 — Self-service onboarding boundary for Latero Insights integration

Date: 2026-04-24
Status: Proposed
Owner: Latero product

---

## Context

Latero currently exposes a strong metadata contract for lineage and DQ, but onboarding a new
installation to Latero Insights still depends on developer-operated activities:

- Manual bootstrap and migration execution
- Manual Databricks job wiring for projector/sync notebooks
- Environment-specific checks that are validated after deployment
- Dashboard/query logic that is re-implemented by each consumer team

This creates operational bottlenecks and prevents platform teams from onboarding or upgrading
without developer support.

The product boundary must therefore evolve from "table contract only" to
"table contract + managed integration lifecycle" while staying consumer-agnostic.

---

## Decision

Latero will introduce a **self-service integration boundary** for Insights onboarding.

### 1. Managed onboarding workflow

Latero must provide a managed, idempotent onboarding workflow with explicit phases:

1. `validate` (preflight)
2. `plan` (diff and required actions)
3. `apply` (execute bootstrap/migrations/job provisioning)
4. `verify` (post-apply checks)

The workflow must be runnable in dry-run mode and non-interactive mode.

### 2. Declarative integration manifest

A single declarative manifest will define integration intent (projector enabled, optional
OpenMetadata sync, schedule, environment tags, table/schema targets). The manifest is product
input; implementation-specific runtime details remain adapter-owned.

### 3. Contract-tested consumer read model

Latero Insights integration must target the product read model (`meta.lineage_entities_current`,
`meta.lineage_attributes_current`) through versioned consumer contracts. Changes that can affect
Insights queries require contract tests and explicit versioning/deprecation notes.

### 4. Operational ownership shift

Platform/DataOps teams must be able to run onboarding and upgrades end-to-end without code
changes, using declarative config + tooling + runbooks.

---

## Consequences

### Positive

- Lower developer dependency for new installs and upgrades
- Repeatable onboarding across environments
- Faster rollout of schema and projector changes
- Better auditability via explicit plan/apply/verify lifecycle

### Trade-offs

- Additional product surface to maintain (manifest schema, orchestration tooling, contract tests)
- Stronger release governance required for integration-affecting changes

### Guardrails

- Latero core remains consumer-agnostic
- Demo repository config shape must not become the product runtime contract
- Validation remains before policy resolution and adapter bootstrap

---

## Implementation notes

Normative requirements are defined in:

- `docs/framework/requirements/insights-self-service-integration.md`

Execution planning is documented in:

- `docs/framework/latero-insights-self-service-backlog.md`

---

## References

- LADR-003 — End-to-end lineage state (`20260420-end-to-end-lineage-state.md`)
- LADR-005 — Lineage current-state projection (`20260421-lineage-current-state-projection.md`)
- LADR-007 — Explicit `hop_kind` field (`20260424-hop-kind-field.md`)
- Latero Insights lineage integration guide (`../latero-insights-lineage-integration.md`)
