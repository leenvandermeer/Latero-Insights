# Layer2 Meta Insights — SaaS Positioning, Target Architecture, and Roadmap

Version: 0.1-draft
Status: STRATEGIC
Owner: Latero product
Date: 2026-04-24

---

## Purpose

This document captures the strategic advice for evolving Layer2 Meta Insights
from a deployable metadata application into a marketable B2B SaaS product.

It combines:

- SaaS product positioning
- target architecture
- capability gaps in the current codebase
- roadmap by phase
- market and best-practice references

This document is advisory rather than normative. It is intended to guide
product, architecture, and delivery planning.

---

## Implementation Snapshot (April 2026)

This section records what is already implemented to close the gap between
strategy and delivery.

### Completed in current iteration

- Insights backend now exposes SaaS ingest endpoints under `/api/v1`:
  - `POST /api/v1/pipeline-runs`
  - `POST /api/v1/dq-checks`
  - `POST /api/v1/lineage`
  - `GET /api/v1/health`
  - `GET /api/v1/installations/{installation_id}/status`
- Local Docker infrastructure now bootstraps Postgres ingestion schema
  automatically from `sql/init/001_insights_saas_init.sql`.
- Event storage tables are provisioned in Insights-managed Postgres:
  - `insights_installations`
  - `pipeline_runs`
  - `data_quality_checks`
  - `data_lineage`
  - `ingest_audit`
- Bearer-token auth and installation scoping are enforced for `/api/v1/*`.
- MDCF Databricks runtime can mirror events to Insights SaaS through
  configureerbare `saas_target` config (endpoint + token) with dual-write
  rollout support.

### Remaining SaaS product work

- Multi-tenant identity and organization model beyond installation tokens
- Entitlements, billing, and packaging capabilities
- Dedicated async ingestion/processing worker plane
- Full workflow-first UX migration from dashboard-heavy navigation

---

## 1. Executive Summary

Layer2 Meta Insights should not be positioned as "a dashboard for meta tables".
That framing is too small, too technical, and too easy to commoditize.

The stronger SaaS position is:

**A Databricks-first metadata operations platform for monitoring, investigating,
and governing data products through operational lineage, quality evidence, and
tenant-grade control.**

In practical terms, the product should move:

- from viewer to control plane
- from live connector reads to materialized read models
- from single-tenant runtime configuration to multi-tenant governance
- from dashboard-first UX to workflow-first UX

The most important investment areas are:

1. tenant and user management
2. storage and backend control plane
3. security and enterprise controls
4. UX restructuring around operational workflows
5. packaging and pricing for B2B SaaS

---

## 2. Market Positioning

### 2.1 What category this product should occupy

The product fits best in the overlap of:

- data observability
- metadata operations
- lineage and impact analysis
- lightweight governance execution

It should **not** primarily compete as:

- a generic BI tool
- a passive metadata catalog
- a full enterprise governance suite

It should compete as:

- a Databricks-first operational trust layer
- a control plane for data products
- a practical platform for data reliability workflows

### 2.2 Why this position is stronger

This position matches the current strengths of the product:

- pipeline runs, quality, and lineage already live together
- the product already has an operator-facing experience
- it already speaks to runtime evidence, not only catalog metadata
- it is more implementation-oriented than traditional catalogs

### 2.3 Suggested category language

Recommended product language:

- "Metadata Operations Platform"
- "Operational Trust Layer for Data Products"
- "Databricks-first Data Reliability Control Plane"

Avoid as primary positioning:

- "meta tables dashboard"
- "visualization frontend"
- "monitoring website"

---

## 3. Competitive Signals and Market Patterns

Current market leaders frame their value in operational terms, not in reporting
terms.

### Monte Carlo

Monte Carlo positions around:

- end-to-end data observability
- automated data quality coverage
- field-level lineage
- incident triage and fast resolution
- data product support levels and SLAs

Implication for Latero:

- lineage must support impact analysis and triage
- quality and lineage should converge into incident workflows
- trust and supportability should become product concepts

### Soda

Soda emphasizes:

- practical observability
- bidirectional integration with governance and lineage tools
- governance context powering checks
- issue details flowing back into catalog and lineage workflows

Implication for Latero:

- governance should not remain passive documentation
- ownership, policies, and evidence should feed operational workflows
- integration patterns matter as much as dashboards

### Atlan

Atlan emphasizes:

- active metadata
- always-current context
- lineage as operational graph
- metadata that flows into tools and decisions

Implication for Latero:

- metadata freshness and propagation matter
- static snapshots are not enough
- Latero can win by operationalizing runtime metadata, not just displaying it

---

## 4. Current Product Assessment

### 4.1 Current strengths

- Strong Databricks-first architecture
- Useful operational primitives: pipeline runs, data quality, lineage
- Clear standalone application model
- API proxy pattern is already in place
- Lineage UX is ahead of many internal-only metadata tools

### 4.2 Current limitations for SaaS

- runtime settings are file-based
- shared state still relies partly on local file and browser persistence
- backend logic is embedded inside Next.js route handlers
- no real tenant model
- no enterprise identity model
- no billing or entitlements model
- no durable audit model
- refresh and sync logic is too request-driven
- UX is still too dashboard-centric for a SaaS control plane

### 4.3 Bottom line

The product is a good seed for SaaS, but not yet SaaS-ready. It currently
resembles a strong single-tenant deployment artifact more than a multi-tenant
managed platform.

---

## 5. Target SaaS Position

### 5.1 Core promise

Layer2 Meta Insights should promise:

- reliable visibility into what happened
- fast investigation into what changed
- clear impact analysis across lineage
- ownership and governance context where action happens
- enterprise-grade control of access, scope, and auditability

### 5.2 Personas

Primary personas:

- Data Engineer
- Platform Engineer
- Data Steward
- Governance Lead
- Data Product Owner

Secondary personas:

- Domain analyst
- Executive stakeholder
- Security/compliance reviewer

### 5.3 Product pillars

The product should be organized around four pillars:

1. `Observe`
   pipeline health, quality, freshness, lineage signals, anomaly indicators
2. `Investigate`
   incident triage, root cause, impact analysis, history, evidence
3. `Govern`
   ownership, policies, business metadata, certifications, auditability
4. `Admin`
   users, organizations, workspaces, SSO, SCIM, billing, entitlements

---

## 6. Target Architecture

The recommended architecture is a four-plane SaaS architecture.

### 6.1 Presentation plane

Responsibilities:

- web application
- public API facade / BFF
- admin experience
- incident and operational workflows
- persona-specific navigation and views

Current mapping:

- `src/app/(dashboard)`
- `src/components`
- `src/hooks`
- `src/lib/api`

This plane should stay in Next.js.

### 6.2 Control plane

Responsibilities:

- organizations
- workspaces
- environments
- users, groups, memberships, roles
- SSO and SCIM configuration
- feature flags
- plan entitlements
- billing metadata
- audit event storage and admin actions

Recommended storage:

- PostgreSQL

This is the business and governance heart of the SaaS platform.

### 6.3 Metadata and data plane

Responsibilities:

- Databricks connectors
- connection validation
- metadata synchronization
- ingestion jobs
- normalization
- lineage materialization
- rule evaluation
- usage metering

Recommended architecture:

- background workers
- queue-based orchestration
- retry and backoff
- per-tenant sync scheduling

### 6.4 Platform and operations plane

Responsibilities:

- monitoring
- per-tenant observability
- cost tracking
- backups
- disaster recovery
- secrets management
- security monitoring
- regional deployment and enterprise controls

---

## 7. Logical Component Model

```text
[Browser / API Clients]
        |
        v
[API Gateway / BFF]
        |
        +------------------------------+
        |                              |
        v                              v
[Control Plane Services]        [Read / Query API]
        |                              |
        v                              v
[Postgres / Control DB]         [Search Index + Read Models]
        |                              ^
        |                              |
        v                              |
[Billing / Entitlements]               |
                                       |
                             [Metadata Processing Layer]
                                       |
                      +----------------+----------------+
                      |                |                |
                      v                v                v
               [Connector Jobs] [Rule Engine] [Lineage Materializer]
                      |
                      v
               [Databricks / Customer Data Platforms]
```

---

## 8. Storage Strategy

### 8.1 Current state

Current storage patterns include:

- `.cache/settings.json`
- `data/shared-widgets.json`
- browser `localStorage`
- cache files for API data

These are acceptable for a single-tenant deployment but unsuitable as primary
state for a SaaS platform.

### 8.2 Target storage model

Use fit-for-purpose storage:

- `Postgres`
  organizations, workspaces, users, roles, settings metadata, dashboards,
  saved views, incidents, alerts, entitlements, audit refs, sync job state
- `Object storage`
  exports, snapshots, large cached payloads, lineage artifacts
- `Search index`
  dataset search, lineage search, incidents, owners, columns
- `Queue / event bus`
  sync jobs, alerts, notifications, retries, metering events
- `Secrets manager`
  Databricks tokens, SCIM credentials, webhook secrets

### 8.3 Design principle

No filesystem-based secret or shared configuration state should remain the
source of truth in SaaS mode.

---

## 9. API and Backend Strategy

### 9.1 Current state

The current `src/app/api/*` layer acts as:

- backend-for-frontend
- integration layer
- operational job layer
- data access layer

That is too much responsibility in one place.

### 9.2 Target split

The backend should split into three logical layers:

1. `Control API`
   organizations, workspaces, roles, auth, billing, entitlements, settings
2. `Sync services`
   connectors, refresh jobs, schema inspection, materialization
3. `Read API`
   fast tenant-scoped reads for dashboards and workflows

### 9.3 Recommended design principles

- async background processing for all refresh and sync work
- API versioning from day one
- typed internal services
- explicit tenant context on every request
- read APIs should read from materialized models, not directly from connectors

---

## 10. Frontend Strategy

### 10.1 Current state

The current frontend is dashboard-first and technically oriented. It is already
useful, but still feels like a powerful viewer rather than a SaaS control plane.

### 10.2 Target state

The product should become workflow-first.

Suggested navigation:

- `Home`
- `Incidents`
- `Datasets`
- `Lineage`
- `Quality`
- `Policies`
- `Admin`

### 10.3 Persona-driven defaults

Recommended default views:

- Data Engineer: incidents, failed runs, lineage impact
- Steward: quality, ownership, policy compliance
- Admin: connections, users, environments, audit
- Executive: trust scorecards, SLAs, trends

---

## 11. User Management and Identity

This is the biggest SaaS gap in the current architecture.

### 11.1 Required identity model

The product should support:

- organizations
- workspaces
- memberships
- roles
- invites
- service accounts
- API tokens

### 11.2 Required enterprise identity features

For enterprise readiness, the product should support:

- OIDC and SAML SSO
- SCIM provisioning
- Just-in-Time provisioning
- group-to-role mapping
- tenant-aware session management

### 11.3 Recommended roles

At minimum:

- `Owner`
- `Admin`
- `Editor`
- `Analyst`
- `Viewer`

Longer term:

- scoped roles by workspace
- scoped roles by datasource or environment
- policy-based access for sensitive datasets

---

## 12. Security Strategy

Security must mature significantly before the product should be marketed as
SaaS to enterprise customers.

### 12.1 Core security requirements

- tenant isolation across all layers
- object-level and function-level authorization
- audit logs for admin and security-sensitive actions
- encryption in transit and at rest
- secret rotation
- secure session handling
- API rate limiting
- abuse protection
- immutable audit trail
- environment separation across dev/staging/prod

### 12.2 API-specific concerns

The OWASP API Security Top 10 highlights risks that are especially relevant
here:

- broken object level authorization
- broken authentication
- broken function level authorization
- unrestricted resource consumption
- unrestricted access to sensitive business flows
- security misconfiguration
- improper inventory management
- unsafe consumption of APIs

These are relevant because the product:

- exposes multiple operational APIs
- manages tenant data
- talks to customer platforms
- performs connection testing and refresh operations

### 12.3 Enterprise controls

Expected enterprise-grade features:

- SSO
- audit export
- IP allowlisting
- private networking options
- advanced permissions
- support impersonation with audit

---

## 13. UX Design Strategy

UX is mandatory for this product category because the competitive market has
already established a high bar for clarity, trust, and operational usability.

### 13.1 Design principle

The product should not primarily answer:

- "What data exists?"

It should primarily answer:

- "What changed?"
- "What broke?"
- "What is impacted?"
- "Who owns it?"
- "What action should I take next?"

### 13.2 Required UX principles

- task-based information architecture
- progressive disclosure
- business labels first, technical IDs second
- strong empty states and onboarding
- explicit status and stale-data states
- keyboard accessibility
- no drag-only critical interactions
- consistent content and messaging
- high accessibility baseline

### 13.3 Workflow-first information architecture

Recommended sections:

- `Overview`
- `Incidents`
- `Datasets`
- `Lineage`
- `Policies`
- `Owners`
- `Admin`

### 13.4 Accessibility expectations

The product should follow an enterprise accessibility baseline:

- semantic HTML
- visible labels
- keyboard navigability
- reduced-motion respect
- adequate contrast
- no color-only status communication
- consistent components and patterns

---

## 14. Packaging and Pricing

The pricing model should not be purely seat-based.

### 14.1 Recommended commercial model

Use a hybrid model:

- base platform fee per organization or workspace
- usage component based on customer value
- enterprise add-ons for governance and identity controls

### 14.2 Candidate value metrics

Potential usage metrics:

- monitored datasets or assets
- pipeline runs processed
- lineage edges indexed
- active alerts or incidents
- environments connected

### 14.3 Packaging

Suggested plan structure:

- `Team`
- `Business`
- `Enterprise`

Example gates:

- Team
  dashboards, lineage, quality, basic sharing
- Business
  incidents, alerts, ownership, policies, saved investigations
- Enterprise
  SSO, SCIM, audit logs, advanced permissions, private networking, premium SLA

### 14.4 Packaging principle

Core product value should not be overly gated early. Enterprise-specific gates
should focus on governance, identity, compliance, and control.

---

## 15. Target Architecture Applied to the Current Codebase

### 15.1 What should remain

These areas are strong foundations and should remain:

- `src/app/(dashboard)` as presentation shell
- `src/components` as design system and UI primitives
- `src/hooks` as frontend data access layer
- `src/lib/api` as typed client layer
- `src/lib/query-engine.ts` for client-side custom widget logic
- `src/lib/adapters/*` as connector/query primitives

### 15.2 What should change

These areas should evolve:

- `src/app/api/*`
  from monolithic route layer to thin BFF over real services
- `src/lib/settings.ts`
  from filesystem settings to database-backed metadata and secret references
- `data/shared-widgets.json`
  from file-based shared storage to tenant-aware persistence
- browser `localStorage`
  from persistence layer to optional draft/cache layer only

### 15.3 Recommended target folder model

```text
src/
  app/
    (dashboard)/
    admin/
    api/               # thin BFF routes
  components/
  hooks/
  lib/
    api/
    ui/
    query-engine.ts
  server/
    auth/
    authorization/
    control-plane/
    sync/
    read-models/
    connectors/
    billing/
    audit/
    search/
```

---

## 16. New Core Domain Entities

The SaaS platform should introduce at least these entities:

- `organizations`
- `workspaces`
- `environments`
- `connections`
- `users`
- `memberships`
- `roles`
- `dashboards`
- `dashboard_widgets`
- `saved_views`
- `alerts`
- `incidents`
- `ownerships`
- `audit_events`
- `entitlements`
- `usage_events`
- `sync_jobs`
- `sync_runs`

---

## 17. Roadmap

### Phase 1 — SaaS foundation

Goal:
Move from deployable single-tenant app to controlled multi-tenant base.

Scope:

- introduce organization, workspace, user, membership, role model
- move runtime settings to control DB
- introduce secrets abstraction
- add hosted auth and RBAC
- add tenant-aware middleware
- move shared dashboards to database persistence
- introduce audit events for admin-sensitive actions

Exit criteria:

- multiple tenants can safely coexist
- no plaintext runtime secrets on disk
- all shared state is server-backed
- each API request is tenant-scoped

### Phase 2 — Enterprise readiness

Goal:
Make the product buyable by larger B2B customers.

Scope:

- OIDC and SAML SSO
- SCIM provisioning
- group-to-role mapping
- usage metering
- entitlements and billing metadata
- admin console
- support and audit tooling
- private connectivity design

Exit criteria:

- enterprise identity requirements can be met
- plan entitlements are technically enforceable
- admin and support workflows are viable

### Phase 3 — Workflow upgrade

Goal:
Transform the product from dashboard viewer into operational control plane.

Scope:

- incidents module
- alert routing
- ownership model
- SLA indicators
- root-cause timelines
- saved investigations
- improved onboarding and setup flows

Exit criteria:

- users can move from issue to action without leaving the product
- operational workflows feel first-class
- setup and adoption become repeatable

### Phase 4 — Differentiation

Goal:
Create durable market differentiation.

Scope:

- active metadata workflows
- governance and catalog integrations
- AI-assisted lineage explanation
- AI-assisted incident triage
- anomaly detection
- executive trust scorecards
- integration marketplace

Exit criteria:

- product clearly differentiates from dashboarding and passive catalog tools
- strong expansion path to Business and Enterprise
- metadata and workflow layer becomes strategically sticky

---

## 18. First Five Concrete Engineering Moves

If execution starts immediately, the first five engineering initiatives should be:

1. Introduce `Organization`, `Workspace`, `User`, `Membership`, and `Role`
2. Replace file-based settings with DB-backed settings and secrets abstraction
3. Add auth and tenant-aware authorization middleware
4. Move Databricks refresh and sync to asynchronous worker jobs
5. Build first materialized read models for datasets, quality, and lineage

---

## 19. Strategic Conclusion

Layer2 Meta Insights has a strong operational foundation, especially for a
Databricks-first environment. However, to become a strong SaaS product, it
must evolve from a deployable metadata UI into a multi-tenant metadata
operations platform.

The architectural and product move is clear:

- from viewer to control plane
- from route-driven refresh to async metadata services
- from local runtime state to managed control-plane storage
- from dashboard-centric UX to task-centric workflows

If this transition is executed well, the product can occupy a credible and
valuable niche between passive catalogs and heavyweight data observability
platforms.

---

## Sources

- AWS SaaS Lens — General design principles  
  https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/general-design-principles.html
- Microsoft — Multitenant SaaS architecture  
  https://learn.microsoft.com/en-us/azure/architecture/guide/saas-multitenant-solution-architecture/
- Microsoft — Multitenant identity considerations  
  https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/identity
- OWASP API Security Top 10 (2023)  
  https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- Microsoft Entra — SCIM support  
  https://learn.microsoft.com/en-us/entra/identity/app-provisioning/scim-support-in-entra-id
- Stripe — SaaS pricing and packaging strategy  
  https://stripe.com/en-ch/resources/more/saas-pricing-and-packaging-strategy
- Monte Carlo — Data Observability Platform  
  https://info.montecarlodata.com/solutions/data-observability-platform
- Soda — Lineage and governance integration  
  https://soda.io/product/lineage
- Atlassian Design — Accessibility  
  https://atlassian.design/foundations/accessibility
- Auth0 — Multiple Organization Architecture overview  
  https://auth0.com/docs/media/articles/architecture-scenarios/planning/Multiple-Organization-Architecture-Multitenancy-Overview.pdf
