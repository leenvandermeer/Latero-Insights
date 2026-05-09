# Latero Control v3 — UX Concepts & Module Breakdown

Companion document to `latero-control-v3-vision.md`.

---

## Part 1 — UX Concepts per Pillar

Each pillar description covers: primary screen(s), key interactions, and the single most important design principle for that pillar.

---

### Pillar 1 — Business Impact Graph

**Primary screen: `/lineage` — enhanced graph view**

The existing lineage graph gets a second visual layer. A toggle switches between two modes:

- **Technical mode** (default): current graph, nodes = datasets/pipelines, edges = data flow
- **Business mode**: same graph, nodes gain color-coded business impact rings, edges show criticality weight

In business mode, clicking any node opens a side panel with two tabs:
- *Technical*: current entity detail (schema, runs, quality)
- *Business*: KPIs fed by this node, dashboards depending on it, business processes, owning team, risk classification

A **Business Impact Banner** appears at the top of every incident and alert: *"This failure affects: [NPS Dashboard] [Weekly Revenue Report] [ESG Scope 3 Input]"* — each item a clickable link.

**Key interaction: impact path highlight**
Hover any business output (KPI, report) → the graph highlights the full upstream chain that feeds it, dimming everything else. This is the "why does this matter" moment.

**Design principle**: business context is always one click away, never a separate app or page.

---

### Pillar 2 — Data Product Control Tower

**Primary screen: `/products` — product index + `/products/[id]` — product detail**

**Index view**: card grid, one card per data product. Each card shows the five most critical signals at a glance:

```
┌─────────────────────────────────────┐
│  ● Orders Silver                    │
│  Owner: Analytics Team              │
│  Trust: ████████░░ 83               │
│  Freshness: ✓ On time               │
│  Quality: 2 open violations         │
│  SLA: 99.1% / 99.5% target  ↘      │
└─────────────────────────────────────┘
```

Cards are sortable and filterable by domain, trust score, owner status, and SLA health. A **"No Owner"** filter surfaces governance gaps immediately.

**Detail view**: single-page layout with six sections as collapsible panels:
1. Identity (owner, domain, description, contract version)
2. Trust Score breakdown (expandable, each factor links to source)
3. SLA/SLO dashboard (sparkline of last 30 runs, freshness timeline)
4. Active incidents and open policy violations
5. Lineage thumbnail (mini-graph, click to open full lineage view)
6. Evidence completeness checklist

**Design principle**: every signal on the detail page is actionable — a red indicator is always a link to the relevant workflow, never a dead end.

---

### Pillar 3 — Trust Score

**Appears on**: product cards, product detail, lineage nodes, alert headers, executive dashboard

**The badge**: a filled circle with a number (0–100) and a trend arrow. Color follows traffic-light convention: green ≥ 80, amber 60–79, red < 60.

**The breakdown**: clicking the badge opens a popover — never a full page, always inline:

```
Trust Score: 73  ↘ (was 81 last week)

  ✓ Owner assigned              +0
  ✗ No freshness SLA defined   −15
  ⚠ SLA missed ×2 this week    −10
  ✗ Lineage coverage < 80%      −7
  ✓ Quality checks passing      +0
  ⚠ No consumer activity 14d    −5
  ✓ Evidence complete            +0
  ────────────────────────────
  Baseline                      100
  Current                        73

  [Fix: Define freshness SLA →]
  [Fix: Complete lineage coverage →]
```

Each negative factor shows a direct action link. The score is recalculated on every pipeline run, quality check, and ownership change — never stale.

**Trend**: a 30-day sparkline lives on the product detail page. Significant drops are annotated with the event that caused them (e.g., "SLA target tightened", "Owner reassigned").

**Design principle**: the score is never just a number. If you cannot explain why it is what it is, and link to a fix, the score has no value.

---

### Pillar 4 — Change Intelligence

**Primary screen: `/changes` — change feed**

A chronological feed of all detected changes across the estate, filterable by:
- Change type (schema / contract / lineage / ownership / semantic / statistical)
- Severity (breaking / significant / informational)
- Domain or product
- Time range

Each feed item is an expandable card:

```
┌──────────────────────────────────────────────────────────┐
│  SCHEMA DRIFT  ·  Breaking  ·  2 min ago                 │
│  orders_silver · column `discount_pct` removed           │
│                                                          │
│  Affected downstream:  3 gold metrics  ·  1 BI report    │
│  Risk: HIGH — feeds ESG Scope 2 calculation              │
│                                                          │
│  [View diff]  [Open incident]  [Notify owner]            │
└──────────────────────────────────────────────────────────┘
```

**Diff view**: for schema and contract changes, a side-by-side diff modal (before/after) with highlighted additions and removals. For lineage drift, the mini-graph shows what was added or removed.

**Digest mode**: operators can configure a daily or weekly digest that groups low-severity changes into a summary email/Slack message per domain. Individual breaking changes always trigger immediate routing.

**Design principle**: every change card answers the same four questions in the same order — what, affected by what, risk level, next action.

---

### Pillar 5 — Policy + Controls Engine

**Primary screens: `/policies` — policy library, `/compliance` — compliance overview**

**Policy library**: a list of all active policies, grouped by pack (ESG, BCBS, custom). Each policy shows:
- Rule description in plain language
- Scope (all products / specific domain / specific product)
- Current pass/fail count across estate
- Active exceptions

**Creating a policy**: a structured form — no custom query language. Operators select the subject (dataset / entity / product), the condition (freshness ≥ X, owner assigned, lineage coverage ≥ Y%, etc.), and the action (warn / block / notify). Policies are saved as JSON and version-controlled.

**Compliance overview**: a matrix view — products on rows, policy packs on columns, cells show pass/fail/exception. Drill into any cell for the verdict detail.

```
                   BCBS Pack    ESG Pack    Custom
orders_silver        ✓ Pass      ⚠ 1 warn    ✓ Pass
revenue_gold         ✗ 2 fail    ✓ Pass      ✓ Pass
nps_bronze           ✓ Pass      — N/A       ⚠ 1 warn
```

**Exception management**: exceptions are requested inline (from the compliance matrix or from a policy violation alert). Each exception requires a justification, an expiry date, and an approver. Expired exceptions are automatically re-evaluated.

**Design principle**: compliance is visible at product level, not just as a global list. A product owner sees only the policies that apply to their products.

---

### Pillar 6 — Evidence Ledger

**Primary screen: `/evidence/[product-id]` — product evidence trail**

A reverse-chronological audit log for a data product. Each entry is an immutable record:

```
2026-04-15 08:14:32 UTC  ·  Quality check passed
  Check: null_rate(order_id) < 0.001
  Result: 0.00032 — PASS
  Run: pipeline-run-8821
  Hash: sha256:a3f9...

2026-04-15 08:14:28 UTC  ·  Transformation applied
  Step: silver_orders_transform v2.4.1
  Input hash: sha256:c12e...
  Output hash: sha256:d94b...

2026-04-14 23:59:01 UTC  ·  Source snapshot ingested
  Source: raw.orders partition 2026-04-14
  Row count: 482,291
  Hash: sha256:9ab1...
```

**Export**: one-click export to signed PDF for auditors. The export includes a cover page with the product metadata, Trust Score at export time, and a table of contents by date range.

**Evidence gap indicator**: if a product is missing evidence for a required step (e.g., no quality check recorded for a gold entity), a banner shows the gap and links to the policy that requires it.

**Design principle**: the Evidence Ledger is read-only for everyone. No editing, no deletions, no backdating. Append-only is a hard technical constraint, not a UI convention.

---

### Pillar 7 — Issue-to-Action Workflows

**Primary screen: `/incidents` — incident list + `/incidents/[id]` — incident detail**

**Incident list**: a sorted list with status columns (Open / In Progress / Resolved), severity badges, and a "Time to resolve" metric for closed incidents. Filterable by product, domain, assignee, and severity.

**Creating an incident**: from any alert, anomaly, Trust Score factor, or policy violation, a single button opens the incident creation drawer. Pre-filled fields:
- Linked product and component
- Suggested severity (based on Trust Score delta and business impact)
- Suggested owner (based on ownership graph)
- Relevant evidence already attached

**Incident detail**: a vertical workflow timeline:

```
1. [✓] Incident opened — 08:21
        Linked: orders_silver · Schema drift (column removed)
        Severity: HIGH (auto-suggested, confirmed by owner)

2. [✓] Assigned to: M. de Vries (Analytics Team) — 08:23

3. [✓] Playbook attached: "Schema drift — breaking change" — 08:23
        Step 1: Verify downstream consumers notified ✓
        Step 2: Roll back transformation or update schema contract
        Step 3: Re-run affected quality checks
        Step 4: Update Evidence Ledger entry

4. [ ] Resolution verified — pending
        [Mark resolved + attach evidence]
```

**Design principle**: the incident is a workflow, not a ticket. It has a beginning, a middle, and an end — and Latero guides the operator through all three.

---

### Pillar 8 — Alert Intelligence

**Primary screen: `/alerts` — alert feed + `/settings/alerts` — routing configuration**

**Alert feed**: similar to the change feed but action-oriented. Each alert has a status (New / Acknowledged / Suppressed / Escalated) and a routing trace ("Routed to: M. de Vries via ownership graph · 3 min ago").

**Routing configuration**: a visual rule builder, not a raw config file. Operators define routing rules as:

```
IF  alert.type = freshness_breach
AND alert.product.domain = "Finance"
THEN  notify: domain-owner (immediate)
      escalate-after: 30 minutes → team-lead
      suppress-cascade: true
```

Rules are evaluated in order. Conflicts are flagged with a preview of which rule wins.

**Suppression**: when a known incident is active, operators can mark it as the root cause. All downstream alerts that trace back to the same origin are automatically suppressed and grouped under the root incident. The suppression expires when the root incident is resolved.

**Digest configuration**: per domain or per owner, configure which alert types go into a daily digest vs. immediate notification. Breaking changes always bypass digest mode.

**Design principle**: alert configuration is done once per domain, not per individual alert. The routing rules encode organizational knowledge, not individual preferences.

---

### Pillar 9 — Demand-Side Visibility

**Primary screen: `/products` — product index (extended), `/products/[id]` — detail (consumer tab)**

**Product index — demand layer**: the product card gains a consumer count badge and a usage sparkline. Sorting by "consumer activity" surfaces the most-used and most-neglected products simultaneously.

**Ghost product detection**: a dedicated filter and callout banner:

```
⚠  4 data products have had no consumer activity in 30+ days.
   Review for deprecation or consolidation. [View ghost products →]
```

**Product detail — Consumers tab**: a new tab on the product detail page:
- List of registered consumers (team or system name, last access, access frequency)
- Usage trend chart (30 / 90 day)
- Consumer-requested SLAs (with status: active, pending approval, declined)

**Consumer-driven contract request**: a consumer submits a request form — *"I need this product to be available by 07:00 CET daily with max 0.1% null rate on `order_id`"* — which creates a contract proposal visible to the product owner for approval or negotiation.

**Design principle**: demand data is always shown next to supply data. A healthy product has both good quality and active consumers. A product with high quality and zero consumers is still a problem.

---

### Pillar 10 — Cost & ROI Attribution

**Primary screen: `/products` — product index (extended), `/costs` — cost overview**

**Cost overview**: a sortable table of all products with:
- Estimated monthly infrastructure cost
- Consumer count and criticality score
- Trust Score
- ROI indicator: High / Medium / Low / At Risk

**ROI matrix**: a 2×2 scatter plot with cost on X axis and business value (consumer count × criticality) on Y axis. Quadrants:
- Top-right: strategic assets (high cost, high value) — protect
- Top-left: efficient workhorses (low cost, high value) — invest
- Bottom-right: cost sinkholes (high cost, low value) — review
- Bottom-left: candidates for deprecation (low cost, low value) — monitor

Clicking any point navigates to the product detail.

**Cost trend**: per product, a monthly cost trend chart. Anomalous cost spikes are flagged automatically (e.g., "Run cost 340% above 30-day average on 2026-04-12").

**Design principle**: cost data is only useful when shown alongside value data. Never show cost in isolation.

---

### Pillar 11 — Business Glossary + Semantic Model

**Primary screen: `/glossary` — term browser, `/glossary/[term-id]` — term detail**

**Term browser**: a searchable list of all defined business terms and canonical metrics. Each term shows:
- Canonical definition (one sentence)
- Owner (person or team)
- Linked datasets and columns
- Conflict indicator (if another definition exists elsewhere)

**Term detail**: a single page with:
- Definition history (versioned, with author and timestamp)
- Mapped datasets and columns (clickable, navigates to entity)
- Dependent metrics and reports
- Conflict resolution status (if applicable)

**Conflict detection**: when two teams define the same term differently, Latero surfaces the conflict in both term records and on the product detail pages of the affected products:

```
⚠  Conflict: "Revenue" is defined differently by Finance Team and Analytics Team.
   [View both definitions]  [Request resolution]
```

**Lineage enrichment**: in the lineage graph, nodes linked to a glossary term show a small label with the term name. Hovering shows the definition inline — no navigation required.

**Design principle**: the glossary is not a documentation tool. Every term must be linked to at least one dataset or it has no value. Unlinked terms are flagged for removal.

---

### Pillar 12 — Temporal Metadata

**Appears on**: all product detail views, evidence ledger, compliance overview, lineage graph

**"As of" date picker**: a global date control in the top navigation bar (collapsed by default, opens on click). When an "as of" date is set, a blue banner appears across all affected views:

```
 Viewing state as of: 2026-03-31  ·  [Return to current]
```

All data — Trust Score, lineage graph, policy compliance, ownership, evidence — reflects the state at the selected date. The UI is read-only in historical mode.

**Trust Score timeline**: on the product detail page, a 90-day chart of Trust Score history with annotated events (schema changes, SLA misses, ownership changes, incidents). Click any point to enter historical mode at that date.

**Evidence Ledger time-travel**: the evidence ledger already shows the full append-only history. The time-travel feature adds the ability to export a point-in-time snapshot: *"Export evidence state as of 2026-03-31 for audit submission."*

**Design principle**: historical mode is passive. Operators can view and export but cannot modify historical state. The current date is always one click away.

---

### Pillar 13 — Grounded Copilot

**Primary UI: collapsible side panel (available on all views), keyboard shortcut: `Cmd+K`**

The Copilot panel is a chat interface with three key constraints visible to the user:
1. *"I only know what Latero knows"* — shown as a subtitle under the input
2. Every answer cites its source: *"Based on: orders_silver lineage graph · last updated 08:14"*
3. Confidence is explicit: if Latero's data is incomplete or stale, the Copilot says so

**Interaction modes**:

*Natural language query*:
> "Why is the NPS dashboard showing stale data?"
> → Copilot traces lineage upstream, finds a freshness breach in `nps_bronze`, links to the active incident, shows who is assigned.

*Impact query*:
> "If I remove column discount_pct from orders_silver, what breaks?"
> → Copilot runs a forward-lineage traversal, lists all downstream dependencies, flags policy violations, estimates Trust Score delta.

*Gap query*:
> "Which gold products in the Finance domain have no owner?"
> → Copilot queries ownership graph, returns filtered list with direct links to each product.

*Historical query*:
> "What was the quality profile of revenue_gold during the March close?"
> → Copilot queries temporal snapshots, returns Trust Score, quality check results, and active incidents at that date.

**Suggested queries**: when a user navigates to a product with a low Trust Score or active incident, the Copilot panel shows 2–3 contextual query suggestions based on the current page state.

**Design principle**: the Copilot is a navigation accelerator, not an AI showcase. Every answer must either navigate the user somewhere or give them a number with a source. Answers without grounding are blocked.

---

## Part 2 — Module Breakdown per Phase

Each phase lists: screens, API routes, data model additions, and dependencies.

---

### Phase 1 — Operational Foundation (v3.0)

**Goal**: make existing monitoring decision-grade. The foundation that all later phases build on.

#### 1.1 Trust Score

**Screens**:
- Trust Score badge component (used everywhere)
- Trust Score breakdown popover
- Trust Score trend chart (on product detail)

**API routes**:
- `GET /api/products/[id]/trust` — current score with factor breakdown
- `GET /api/products/[id]/trust/history` — 90-day score history

**Data model**:
- `trust_score_snapshots` table: `(product_id, calculated_at, score, factors JSONB)`
- Snapshot written on every pipeline run completion and quality check result
- Factors schema: `{ factor_id, label, weight, delta, link }`

**Dependencies**: requires products to exist as first-class entities (currently implicit in datasets/entities)

---

#### 1.2 Data Product Registry

**Screens**:
- `/products` — product index (card grid)
- `/products/[id]` — product detail (Identity, Trust, SLA, Incidents, Lineage, Evidence tabs)

**API routes**:
- `GET /api/products` — list all products with summary signals
- `GET /api/products/[id]` — full product record
- `POST /api/products` — create product
- `PUT /api/products/[id]` — update product metadata
- `DELETE /api/products/[id]` — deprecate product

**Data model**:
- `data_products` table: `(id, name, domain, owner_id, sla JSONB, contract_version, created_at, deprecated_at)`
- `product_dataset_links` table: `(product_id, dataset_id, role)` — links products to their datasets

**Dependencies**: none — new first-class entity

---

#### 1.3 Issue-to-Action Workflows

**Screens**:
- `/incidents` — incident list
- `/incidents/[id]` — incident detail with workflow timeline
- Incident creation drawer (triggered from alerts, anomalies, Trust Score factors)

**API routes**:
- `GET /api/incidents` — list, filterable
- `POST /api/incidents` — create
- `PUT /api/incidents/[id]` — update status, assignee, severity
- `POST /api/incidents/[id]/steps` — add workflow step completion
- `POST /api/incidents/[id]/evidence` — attach evidence record

**Data model**:
- `incidents` table: `(id, product_id, severity, status, assignee_id, created_at, resolved_at)`
- `incident_steps` table: `(id, incident_id, step_label, completed_at, completed_by)`
- `incident_evidence` table: `(id, incident_id, evidence_type, payload JSONB, attached_at)`

**Dependencies**: product registry (1.2)

---

#### 1.4 Alert Intelligence

**Screens**:
- `/alerts` — alert feed with routing trace
- `/settings/alerts` — routing rule builder

**API routes**:
- `GET /api/alerts` — list alerts with routing metadata
- `PUT /api/alerts/[id]/acknowledge` — acknowledge
- `PUT /api/alerts/[id]/suppress` — suppress with reason
- `GET /api/settings/alert-routing` — routing rule set
- `PUT /api/settings/alert-routing` — update routing rules

**Data model**:
- `alerts` table: extended with `routed_to`, `routing_rule_id`, `suppressed_by_incident_id`, `digest_batch_id`
- `alert_routing_rules` table: `(id, conditions JSONB, actions JSONB, priority, active)`

**Dependencies**: incidents (1.3) for cascade suppression

---

#### 1.5 Temporal Metadata Foundation

**No new screens in this phase** — infrastructure only.

**Data model additions** (applied to existing tables):
- Add `valid_from` / `valid_to` timestamps to: `data_products`, `product_dataset_links`, `quality_checks`, `lineage_edges`, `ownership_records`
- All writes become inserts with `valid_from = now()` and `valid_to = null`; updates set `valid_to = now()` on old row and insert new row
- `GET /api/products/[id]?as_of=ISO8601` — returns product state at given date (all routes gain optional `as_of` param)

**Dependencies**: must be implemented before any Phase 2 or 3 feature — retrofitting is prohibitively expensive

---

### Phase 2 — Business Context (v3.1)

**Goal**: connect technical operations to business meaning.

#### 2.1 Business Impact Graph

**Screens**:
- `/lineage` — mode toggle (Technical / Business)
- Business context side panel (new tab on existing entity detail panel)
- Business Impact Banner component (used in alerts and incidents)

**API routes**:
- `GET /api/lineage/[id]/business-impact` — business outputs reachable from a node
- `POST /api/products/[id]/business-outputs` — link a product to a KPI, dashboard, or process
- `GET /api/lineage/impact-path?from=[id]&to=[business-output-id]` — highlight path

**Data model**:
- `business_outputs` table: `(id, name, type [kpi/dashboard/process/report], owner_team, criticality)`
- `product_business_output_links` table: `(product_id, output_id, description)`

**Dependencies**: product registry (1.2), temporal foundation (1.5)

---

#### 2.2 Change Intelligence

**Screens**:
- `/changes` — change feed
- Change diff modal (schema, contract, lineage)
- Change digest configuration (under `/settings/alerts`)

**API routes**:
- `GET /api/changes` — list detected changes, filterable
- `GET /api/changes/[id]` — change detail with diff payload
- `POST /api/changes/[id]/incidents` — promote change to incident

**Data model**:
- `change_events` table: `(id, type, product_id, entity_id, severity, diff JSONB, detected_at, risk_assessment JSONB)`
- Detection runs as a background job after every sync, comparing current state to previous `valid_from` snapshot

**Dependencies**: temporal foundation (1.5) — change detection diffs temporal snapshots

---

#### 2.3 Demand-Side Visibility

**Screens**:
- Consumer tab on `/products/[id]`
- Ghost product filter and banner on `/products`
- Consumer contract request form

**API routes**:
- `GET /api/products/[id]/consumers` — consumer list with usage stats
- `POST /api/products/[id]/consumers` — register consumer
- `GET /api/products/[id]/usage` — usage timeseries
- `POST /api/products/[id]/contract-requests` — submit consumer contract request

**Data model**:
- `product_consumers` table: `(product_id, consumer_id, consumer_type [team/system], registered_at)`
- `product_usage_events` table: `(product_id, consumer_id, accessed_at)` — append-only
- `contract_requests` table: `(id, product_id, consumer_id, requirements JSONB, status, created_at)`

**Dependencies**: product registry (1.2)

---

#### 2.4 Business Glossary

**Screens**:
- `/glossary` — term browser
- `/glossary/[id]` — term detail
- Conflict banner component (used on product detail and lineage nodes)

**API routes**:
- `GET /api/glossary` — list terms
- `GET /api/glossary/[id]` — term detail with linked datasets
- `POST /api/glossary` — create term
- `PUT /api/glossary/[id]` — update term (creates version)
- `GET /api/glossary/conflicts` — terms with conflicting definitions

**Data model**:
- `glossary_terms` table: `(id, name, definition, owner_team, created_at)` — temporal (valid_from/valid_to)
- `term_dataset_links` table: `(term_id, dataset_id, column_name nullable)`

**Dependencies**: temporal foundation (1.5)

---

### Phase 3 — Governance & Evidence (v3.2)

**Goal**: make Latero the compliance backbone for regulated use cases.

#### 3.1 Policy + Controls Engine

**Screens**:
- `/policies` — policy library
- `/compliance` — compliance matrix
- Exception request and approval flow

**API routes**:
- `GET /api/policies` — list policies
- `POST /api/policies` — create policy
- `PUT /api/policies/[id]` — update policy
- `GET /api/compliance` — compliance matrix (products × policy packs)
- `POST /api/compliance/exceptions` — request exception
- `PUT /api/compliance/exceptions/[id]` — approve or decline exception

**Data model**:
- `policies` table: `(id, pack_id, name, description, rule JSONB, scope JSONB, action [warn/block/notify])`
- `policy_verdicts` table: `(id, policy_id, product_id, verdict [pass/fail/exception], evaluated_at)`
- `policy_exceptions` table: `(id, policy_id, product_id, justification, expiry_date, approved_by, approved_at)`

**Dependencies**: product registry (1.2), temporal foundation (1.5)

---

#### 3.2 Evidence Ledger

**Screens**:
- Evidence tab on `/products/[id]` (replaces stub from Phase 1)
- Evidence gap banner component
- PDF export flow

**API routes**:
- `GET /api/products/[id]/evidence` — paginated evidence trail
- `POST /api/products/[id]/evidence` — append evidence record (internal, called by pipeline hooks)
- `GET /api/products/[id]/evidence/export?from=&to=` — generate signed PDF

**Data model**:
- `evidence_records` table: `(id, product_id, event_type, payload JSONB, run_id nullable, hash, recorded_at)` — insert-only, no updates, no deletes
- Database-level constraint: no UPDATE or DELETE on `evidence_records` (enforced via Postgres row-level security or trigger)

**Dependencies**: product registry (1.2), incident workflows (1.3), policy engine (3.1)

---

#### 3.3 Cost & ROI Attribution

**Screens**:
- Cost & ROI columns on `/products` index
- `/costs` — cost overview with ROI matrix scatter plot
- Cost trend chart on product detail

**API routes**:
- `GET /api/costs` — cost summary per product
- `GET /api/products/[id]/costs` — cost history timeseries
- `POST /api/costs/sync` — ingest cost data from platform (Databricks, etc.)

**Data model**:
- `product_cost_records` table: `(id, product_id, period_start, period_end, cost_usd, cost_breakdown JSONB, source)`

**Dependencies**: product registry (1.2), demand-side visibility (2.3) for ROI calculation

---

#### 3.4 Out-of-the-Box Operating Models

**Screens**: five new system dashboards registered in the widget registry:
- `executive-trust-dashboard` — Trust Score overview, policy compliance, incident KPIs, cost/ROI summary
- `domain-owner-dashboard` — products under ownership, SLA status, open incidents, ghost products
- `platform-operator-dashboard` — pipeline health, change feed, alert routing status
- `compliance-audit-dashboard` — evidence ledger access, policy verdicts, exception trail
- `esg-finance-control-pack` — CSRD/BCBS coverage, evidence completeness, report lineage

Each is a system dashboard (tier 1 widget) registered in `registry.ts`. Operators can clone any to a personal or shared dashboard for customization.

**Dependencies**: all Phase 1–3 pillars

---

### Phase 4 — Intelligence Layer (v3.3)

**Goal**: make the metadata graph queryable and the Copilot production-ready.

#### 4.1 Grounded Copilot

**Screens**:
- Copilot side panel (global, `Cmd+K`)
- Contextual query suggestions (per-page)
- Source citation component

**API routes**:
- `POST /api/copilot/query` — natural language query → structured graph traversal + LLM synthesis
- The route never sends raw data to the LLM; it sends structured metadata summaries only

**Architecture**:
1. Parse intent from natural language (LLM call 1)
2. Translate intent to graph queries against Latero's Postgres metadata store (structured queries, no LLM)
3. Format results as structured context (LLM call 2 — synthesis only)
4. Return answer + citations + navigation links

**Dependencies**: all prior phases — Copilot quality scales with metadata completeness

---

#### 4.2 Advanced Policy Packs

**No new screens** — extends policy engine (3.1) with new rule types.

New rule types:
- `statistical_drift`: triggers on Z-score or IQR deviation from baseline
- `volume_anomaly`: triggers on run volume deviating > X% from 30-day average
- `consumer_inactivity`: triggers when no consumer activity for N days
- `temporal_coverage`: triggers when evidence ledger has gaps in required date range

New packs shipped as JSON fixtures:
- `esg-csrd-pack.json`
- `bcbs-239-pack.json`
- `data-mesh-governance-pack.json`

**Dependencies**: policy engine (3.1), demand-side visibility (2.3), evidence ledger (3.2)

---

## Summary Table

| Pillar | Phase | Primary Screen | New Tables | External Dependencies |
|---|---|---|---|---|
| Trust Score | 1.1 | badge / popover | `trust_score_snapshots` | none |
| Product Registry | 1.2 | `/products` | `data_products`, `product_dataset_links` | none |
| Issue-to-Action | 1.3 | `/incidents` | `incidents`, `incident_steps`, `incident_evidence` | 1.2 |
| Alert Intelligence | 1.4 | `/alerts` | `alert_routing_rules` (extend alerts) | 1.3 |
| Temporal Foundation | 1.5 | none (infra) | `valid_from/valid_to` on existing tables | none |
| Business Impact Graph | 2.1 | `/lineage` extended | `business_outputs`, `product_business_output_links` | 1.2, 1.5 |
| Change Intelligence | 2.2 | `/changes` | `change_events` | 1.5 |
| Demand-Side | 2.3 | `/products` extended | `product_consumers`, `product_usage_events`, `contract_requests` | 1.2 |
| Business Glossary | 2.4 | `/glossary` | `glossary_terms`, `term_dataset_links` | 1.5 |
| Policy Engine | 3.1 | `/policies`, `/compliance` | `policies`, `policy_verdicts`, `policy_exceptions` | 1.2, 1.5 |
| Evidence Ledger | 3.2 | `/products` evidence tab | `evidence_records` (insert-only) | 1.2, 1.3, 3.1 |
| Cost & ROI | 3.3 | `/costs` | `product_cost_records` | 1.2, 2.3 |
| Operating Models | 3.4 | 5 system dashboards | none (widget registry) | all Phase 1–3 |
| Grounded Copilot | 4.1 | global side panel | none (query layer) | all prior phases |
| Advanced Policy Packs | 4.2 | `/policies` extended | none (new rule types + pack fixtures) | 3.1, 2.3, 3.2 |
