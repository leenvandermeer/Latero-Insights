# Latero Control v3 — Product Vision

> **"Operational governance for data teams that ship."**

---

## North Star

Latero Control v3 is not a prettier observability dashboard. It is a **data operations control system** for business-critical data products.

The step from v2 to v3 is the step from monitoring to **decision-grade data operations**.

v3 must solve three things simultaneously:

1. Show what is broken
2. Show what the business is affected by as a result
3. Help operators take the right action faster

Every feature, every screen, and every API must serve one of these three goals.

---

## Positioning

| Dimension | v2 | v3 |
|---|---|---|
| Core promise | "We see that pipelines fail" | "We know what it means for the business" |
| Primary buyer | Data engineers | Data leads, CDOs, domain owners |
| Category | Observability tool | **Operational Data Intelligence Platform** |
| Deployment | 30-minute setup | 30-minute setup (non-negotiable moat) |
| Differentiator | Pipeline monitoring + lineage | Evidence-first, business-aware, decision-grade |

### Competitive wedge

- **vs. Collibra / Atlan**: They are metadata museums. We are an operational system. Their implementation takes 6 months; ours takes 30 minutes.
- **vs. Monte Carlo / Soda**: They detect anomalies. We tell you what it costs the business and what to do next.
- **vs. Databricks / dbt**: They are platforms. We are the control layer on top of any platform.
- **vs. Great Expectations**: A testing library, not a product. No ownership, no evidence, no business context.

**The gap we own**: operational governance for mid-market and scale-up data teams that ship data products but cannot afford 6-month implementations.

---

## The 12 Capability Pillars

### 1. Business Impact Graph

Lineage becomes business-aware. Every node in the graph carries not just technical upstream/downstream but also business context.

- Link entities and datasets to KPIs, dashboards, reports, business processes, teams, and risks
- Show business impact next to technical lineage: *"This silver entity feeds 3 gold metrics, 2 BI dashboards, and 1 ESG report"*
- Impact propagation: when a pipeline fails, automatically surface which business outputs are at risk
- Business context is editable by domain owners, not just platform engineers

**Why this matters**: prioritization becomes defensible, management understands why an issue counts, technical discussions gain business anchoring.

---

### 2. Data Product Control Tower

Every data product gets one operating surface — a single pane that makes it governable.

Per product, visible at a glance:
- Owner and escalation path
- SLO / SLA with current status
- Freshness score
- Quality score (composite)
- Active incidents
- Contract version and last change
- Dependency risk (upstream health)
- Evidence completeness
- Trust Score (see pillar 4)

**Why this matters**: data products become steerable, ownership and governance actually land.

---

### 3. Trust Score — Explainable by Design

A single operational trust indicator per dataset, entity, and data product. Not a gimmick — a decision tool.

The score combines:
- Lineage health (coverage, completeness)
- Quality (check pass rate, anomaly frequency)
- Freshness (SLA adherence)
- Incident history (recency, severity, resolution time)
- Evidence completeness
- Owner status (assigned, active)
- Consumer adoption (see pillar 11)

**Explainability is the product.** The score is worthless without the breakdown:

> *"Trust: 73/100 — No owner assigned (−15), freshness SLA missed twice this week (−10), lineage coverage incomplete (−7)"*

The breakdown is the action agenda. Every factor is a direct link to the relevant screen.

**Why this matters**: fast decisions, clear communication to business stakeholders, strong input signal for escalations and executive dashboards.

---

### 4. Change Intelligence

Not just run failures — meaningful change across all dimensions.

Latero detects and explains:
- **Schema drift**: columns added, removed, type changed
- **Contract drift**: SLA tightened or loosened, ownership transferred
- **Lineage drift**: new dependencies, orphaned nodes, unexpected upstream changes
- **Ownership drift**: no owner, owner inactive, team restructure impact
- **Semantic drift**: business entity definition changed, conflicting definitions introduced
- **Statistical drift**: volume, distribution, null rate deviations from baseline

For every detected change, Latero answers:
1. What changed
2. What is affected (business + technical)
3. What the risk level is
4. Who needs to look at it

**Why this matters**: prevents silent regressions, makes platform changes safer, separates signal from noise.

---

### 5. Policy + Controls Engine

Latero does not just observe — it enforces.

- Define policies: freshness thresholds, lineage coverage requirements, mandatory column evidence, ownership rules, naming conventions, contract requirements
- Policy verdicts per product, team, and tenant
- Exceptions with expiry dates and approver trail
- Policy compliance score per domain

Out-of-the-box policy packs:
- **ESG / CSRD control pack**: evidence requirements, audit trail rules, reporting lineage coverage
- **Finance / BCBS-239 pack**: data lineage traceability, quality thresholds, ownership mandates
- **Data mesh governance pack**: domain ownership, federated policy with central oversight

Custom packs are operator-defined. Pack definitions are version-controlled.

**Why this matters**: governance becomes measurable, audit and compliance costs drop dramatically, controls are enforceable without manual checklists.

---

### 6. Evidence Ledger

For every important metric, entity, or report: a complete, immutable evidence trail.

Each evidence record captures:
- Source datasets and their version at time of use
- Transformations applied
- Quality checks executed and their verdicts
- Exceptions granted (with approver and expiry)
- Manual approvals
- Timestamps and lineage hashes

The Evidence Ledger is **append-only**. It cannot be edited retroactively. It is the audit backbone for regulated use cases.

**Why this matters**: trust becomes provable, not asserted. Board-level reporting, regulatory submissions, and external audits become dramatically cheaper. This is Latero's strongest differentiator in regulated industries.

---

### 7. Issue-to-Action Workflows

From observation to resolution, without leaving Latero.

- Create incident from any alert, anomaly, or policy violation
- Assign owner with suggested assignment based on data ownership graph
- Suggest severity based on Trust Score impact and downstream business exposure
- Attach remediation playbook (standard or custom)
- Track resolution steps
- Verify-after-fix: re-run checks and confirm closure
- Attach evidence to incident record
- Full incident history per product

**Why this matters**: less context switching, faster resolution, Latero becomes a daily work tool — not a dashboard people check once a week.

---

### 8. Alert Intelligence

Detection without intelligent routing creates alert fatigue. v3 solves this.

- **Smart routing**: alerts reach the right person based on ownership graph, not just email lists
- **Cascade suppression**: if a known upstream outage is active, suppress derivative alerts downstream
- **Digest mode**: low-severity drift bundled into a daily or weekly summary per domain owner
- **Escalation**: no response within X minutes → escalate to secondary owner or team lead
- **Alert quality feedback**: owners can mark alerts as noise; Latero learns routing over time

Alert channels: in-app, email, Slack, webhook. All configurable per policy.

**Why this matters**: the difference between a tool people learn to ignore and a tool people actually work with.

---

### 9. Demand-Side Visibility

Every v2 feature is supply-side. v3 closes the loop to the demand side.

- **Consumer registry**: who uses which data product (integrated or self-reported)
- **Usage analytics**: query frequency, last accessed, active consumers per product
- **Ghost products**: products with zero consumers in 30+ days — candidates for deprecation or consolidation
- **Consumer-driven contracts**: a consumer can *request* an SLA, not just accept what operators define
- **Demand heatmap**: which products are most depended on vs. most neglected

**Why this matters**: prioritization of ownership and SLA investment becomes data-driven. Nobody in the market does this well. "This product costs €1,800/month and has one consumer who opens it twice a month" is a kill/keep decision that currently no tool makes possible.

---

### 10. Cost & ROI Attribution

The missing layer in every data observability tool.

- Infrastructure cost per pipeline and per data product (compute, storage, query cost)
- Value indicator: downstream consumer count, criticality score, business process coverage
- ROI score: cost vs. demand vs. business criticality
- Deprecation candidates: high cost, low demand, low trust
- Cost trend over time per product and domain

**Why this matters**: data teams are increasingly accountable for infrastructure spend. Latero becomes the tool that justifies — or challenges — investment decisions.

---

### 11. Business Glossary + Semantic Model (Lightweight)

Not a heavy enterprise catalog. Pragmatic semantic modeling to bridge business and data.

- **Business entities**: canonical definitions owned by domain, linked to technical datasets
- **Metric definitions**: how a KPI is calculated, which datasets it depends on, approved owner
- **Term-to-dataset mapping**: "revenue" maps to these three tables under these conditions
- **Approved definitions**: one canonical definition per term, with version history
- **Conflict detection**: two teams use the same term differently — Latero flags it

No query engine. No SQL generation. This is a **definition layer** that enriches lineage with meaning.

**Why this matters**: less discussion about what numbers mean, a bridge between business and data teams, lineage becomes readable to non-engineers.

---

### 12. Temporal Metadata (Time-Travel on the Metadata Layer)

Not just current state — historical state of the metadata graph itself.

- Historical snapshots of Trust Score, lineage graph, contract state, and ownership
- "What did this product look like during the Q1 close in March?"
- "What was the quality profile of this entity when we submitted the ESG report?"
- Time-travel on the Evidence Ledger: reconstruct the exact state at any past point

Must be built into the data model from day one. Retrofitting is near-impossible.

**Why this matters**: compliance, audit, and executive reporting use cases become far stronger. Root cause analysis across time becomes possible.

---

### 13. Grounded Copilot

An AI assistant grounded exclusively in Latero's own metadata graph. Not a generic LLM wrapper.

The Copilot only knows what Latero knows. This is the moat.

Example queries:
- *"Why is this KPI red?"* → traces lineage, finds upstream failure, shows impacted outputs
- *"Which gold outputs are affected by this bronze failure?"* → live impact traversal
- *"Which entities are missing column evidence?"* → policy gap query
- *"Which products have high risk and no owner?"* → Trust Score + ownership filter
- *"What changed in this product since last Monday?"* → temporal diff

The Copilot has no access to your data — only to Latero's metadata graph. It cannot hallucinate facts about your pipeline because it is querying structured graph data, not generating from training weights.

**Why this matters**: lowers the barrier enormously for domain owners and non-engineers, makes metadata actionable for people who don't live in the tool.

---

## Out-of-the-Box Operating Models

v3 ships with prefab dashboards for the five most common operator roles:

| Dashboard | Primary user | Core view |
|---|---|---|
| Executive Trust Dashboard | CDO, CTO, CFO | Trust scores, policy compliance, incident trend, cost/ROI |
| Domain Owner Dashboard | Data domain lead | Products under ownership, SLA status, open incidents, ghost products |
| Data Platform Operator | Platform engineer | Pipeline health, change intelligence, alert routing |
| Compliance & Audit Pack | Risk, compliance | Evidence ledger, policy verdicts, exception trail |
| ESG / Finance Control Pack | Regulatory reporting | CSRD/BCBS coverage, evidence completeness, report lineage |

All dashboards are built on the existing widget and DashboardCanvas system — no hardcoded layouts.

---

## What We Will Not Build

- **Query engine or SQL generation** — that is dbt, Cube, and Snowflake's domain
- **Own data storage or warehouse** — the JSON + Postgres store is intentional
- **Multi-tenant SaaS complexity** before the core is solid
- **Generic AI chat** not grounded in Latero metadata — it would hallucinate
- **Full enterprise catalog** (Alation, Collibra territory) — different buyer, different budget cycle, different ICP
- **New top-level directories** without an ADR

---

## Deployment Commitment

**30 minutes from zero to working system.** This is a non-negotiable strategic constraint, not a stretch goal.

Every feature added to v3 must be deployable in the existing single-tenant, single-Postgres, no-external-dependencies model. Complexity is added to the product surface, not to the operational requirements.

This is the single largest differentiator against Collibra (6-month implementation), Atlan (complex SaaS onboarding), and Monte Carlo (sales-led enterprise deal). Latero must remain the tool a 3-person data team can deploy on a Friday afternoon.

---

## Phased Roadmap

### Phase 1 — Operational Foundation (v3.0)
Core pillars that make existing monitoring decision-grade.

- Trust Score with explainable breakdown
- Data Product Control Tower
- Issue-to-Action Workflows (basic)
- Alert Intelligence (routing + suppression)
- Temporal metadata model (schema-level, enables future features)

### Phase 2 — Business Context (v3.1)
Connect technical operations to business meaning.

- Business Impact Graph (lineage + business output mapping)
- Change Intelligence (all drift types)
- Demand-Side Visibility (consumer registry + usage analytics)
- Business Glossary + Semantic Model (lightweight)

### Phase 3 — Governance & Evidence (v3.2)
Make Latero the compliance backbone for regulated use cases.

- Policy + Controls Engine (with standard packs)
- Evidence Ledger (append-only, audit-ready)
- Cost & ROI Attribution
- Out-of-the-box Operating Models (5 roles)

### Phase 4 — Intelligence Layer (v3.3)
Make the metadata graph queryable and the Copilot production-ready.

- Grounded Copilot (metadata-graph-backed, no hallucination)
- Temporal time-travel queries
- Consumer-driven contracts
- Advanced policy packs (ESG/CSRD, BCBS-239)

---

## One-Sentence Summary

> Latero Control v3 is the control plane for trusted data products: it shows what changed, what it impacts, and what to do next — deployable in 30 minutes, built for teams that ship.
