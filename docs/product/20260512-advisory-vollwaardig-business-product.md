# Advisory Report: Next Steps naar Vollwaardig Business Product

**Datum:** 2026-05-12  
**Auteur:** Multi-stakeholder analysis (UX, Requirements, Security, Developer, Tech Lead)  
**Status:** FOR REVIEW — morgen ter discussie

---

## 1. Executive Summary

**Huidig staat:** Latero Control is technisch solide en functioneel breed. Alle vijf drift-types werken, incidents/compliance/consumers zijn operationeel, deployment is geautomatiseerd.

**Kritiek:** Het product is nog steeds **techniek-gedreven** in plaats van **waarde-gedreven**. Er is geen duidelijk verhaal voor elke gebruikersrol en geen focus op wat NU aandacht nodig heeft.

**Risico:** Zonder focus kan het uitgroeien tot "ServiceNow voor data" (te veel knopen) of "Collibra clone" (te governance-heavy, niet snel genoeg).

**Kans:** Data teams hebben dringend behoefte aan **snelle operationele zichtbaarheid** en **automated actionable alerts**. Daar is markt voor.

---

## 2. Stakeholder Analyse

### 🎨 UX Designer

**Bevindingen:**
- `/impact` pagina voelt losstaand — geen duidelijk entry point hoe daar te komen
- `/incidents` is nu functioneel maar niet intuitief — "wat moet ik NU doen?"
- Home/dashboard geeft geen prioriteit-volgorde
- Mobile UX is secondair — veel swipe-gesten nodig op telefoon
- Onboarding: geen "getting started" voor nieuwe teams

**Kritiek:**
- Geen user mental model per rol (data engineer vs data owner vs compliance officer)
- Geen conversie-funnel van "I discovered a problem" → "I fixed it" → "I verified"
- UI toont wat **beschikbaar** is, niet wat **belangrijk** is vandaag

**Aanbevelingen:**
1. **Operatie-inbox** — Een pagina "What needs attention today" (open incidents, failed runs, SLA breaches, pending approvals) — sorteer op severity + age
2. **Role-based home** — Data engineer krijgt "Runs & Quality", Compliance officer krijgt "Policies & Exceptions", Data owner krijgt "Trust & Impact"
3. **Entity detail als hub** — Een data product/entity pagina toont: health score, recent runs, downstream impact, incidents, SLAs — alles in één scherm

---

### 📋 Requirements Engineer

**Bevindingen:**
- Product requirements (LINS-001-016) zijn helder maar niet volledig vertaald naar UX
- V2-visie (run als anchor, drie-laags hiërarchie) is nog niet zichtbaar in de huidige UI
- Go-live checklist (P0/P1/P2) geeft geen timeline
- Geen duidelijke "north star metric"

**Kritiek:**
- Geen product-markt fit gevalideerd — we bouwen features, niet gebruikersverhalen
- Geen SLA-management — "uptime" is niet hetzelfde als "compliance"
- Geen cost allocation — teams weten niet hoeveel hun pipelines kosten

**Aanbevelingen:**
1. **North Star Metric:** % van incidents resolved within SLA (vs. current "incidents created")
2. **SLA Dashboard:** Per data product: uptime, DQ pass rate, run frequency, cost per GB
3. **Runbook integration:** Link Slack/PagerDuty/JIRA — don't try to replace them
4. **Export/Report:** Weekly "data health snapshot" — CSV, email, Slack posting
5. **Scheduled compliance:** Run policies op vast schema (dagelijks om 6am) — niet ad-hoc

---

### 🔒 Security Engineer

**Bevindingen:**
- Session cookie TTL nu gelijk (LADR-078) ✅
- Tenant isolation (LINS-016) is geïmplementeerd maar geen audit UI
- Admin audit log bestaat maar geen dashboard
- Rate limiting is aanwezig maar niet kalibreerd
- Credentials in `.env.prod` nodig maar geen rotation strategy

**Kritiek:**
- Geen audit log viewer voor operators — blindheid naar "wie deed wat wanneer"
- Geen secrets rotation tooling
- Incident detail panel is 480px rechts — kan credentials in URL tonen (XSS risk)
- SSO breakglass (LADR-037) bestaat maar geen runbook

**Aanbevelingen:**
1. **Audit log UI** — Filter op actor, resource, timestamp — export to SIEM
2. **Secrets rotation playbook** — Quarterly OIDC_CLIENT_SECRET rotation + testing
3. **Incident detail:** Never put sensitive data in URL — use POST + session
4. **Rate limit dashboard** — Monitor abuse patterns, alert on spike
5. **Security headers audit** — Current: CSP, HSTS, X-XSS-Protection. Check: Referrer-Policy, Permissions-Policy

---

### 👨‍💻 Developer

**Bevindingen:**
- TypeScript is clean (no errors post-fix)
- Tests are sparse — geen integration tests voor drift detection flow
- Fire-and-forget in meta-ingest.ts (LADR-077) has no retry/DLQ
- Schema migrations work but no rollback tested
- No CI pipeline — deploys zijn manual

**Kritiek:**
- Drift detection can silently fail — no visibility into why a drift wasn't detected
- Tests don't cover happy path for incidents + compliance exceptions together
- SQL migrations are idempotent but CREATE TABLE IF NOT EXISTS can mask bugs
- No monitoring for `detectDrift` latency — could slow ingest if overloaded

**Aanbevelingen:**
1. **CI/CD pipeline** — GitHub Actions: test, typecheck, deploy to staging, smoke test
2. **Integration tests:** Full flow: ingest → detect drift → create incident → approve exception → resolve
3. **DLQ for drift:** Store failed detections in `meta.drift_detection_failures` — replay hourly
4. **Alert on long latency:** If any `detectDrift*` takes > 5s, page on-call
5. **Rollback test:** Monthly practice: deploy N-1, verify data consistency

---

### 🏗️ Tech Lead

**Bevindingen:**
- Architecture is modular (web vs infra, LADR-003)
- Database as single read store (LADR-026) ✅
- Dashboard builder is flexible but not all views use it yet (catalog, lineage are hardcoded)
- API versioning: `/api/v1/` and `/api/` mixed — no clear strategy
- Scalability: No caching strategy for expensive queries (lineage impact calculation)

**Kritiek:**
- No SLO defined for Control itself — "what does 99.9% uptime mean for an ops tool?"
- No feature flag system — can't dark-launch exceptions or new incident types
- No tracing/observability — hard to debug slow queries in prod
- Postgres: No connection pooling strategy mentioned
- Schema migrations: No pre-flight validation (can't test on staging before prod)

**Aanbevelingen:**
1. **SLO definition:** 99% API latency < 200ms, 99.95% availability, zero drift-detection misses
2. **Feature flags:** Implement simple flag store (`meta.feature_flags` table) + cache
3. **Query tracing:** Add `X-Request-ID` header, log to observability platform (DataDog / New Relic / self-hosted)
4. **Connection pooling:** PgBouncer in front of Postgres (10 max connections to app)
5. **Staging parity:** Docker Compose staging env identical to prod — test migrations there first
6. **Caching strategy:**
   - Lineage graph: cache 10min (invalidate on run completion)
   - Impact calculation: cache 1h with manual invalidate button
   - Business outputs: cache 5min
   - Use Redis or in-memory with time-based expiry

---

## 3. Prioritized Next Steps (12 Weeks)

### **Weeks 1-4: Operational Clarity (P0)**

**Goal:** Users can see "what needs my attention today" in < 5 clicks.

- [ ] Build "Operations Inbox" — one page, everything that needs action
  - Failed runs (last 7 days, by severity)
  - Open incidents (sorted by age + severity)
  - Policy exceptions pending approval (by criticality)
  - DQ checks failing (by product)
  - SLA breaches (by product, sorted by impact)
- [ ] Entity detail hub — product/entity page combines health, runs, incidents, downstream impact
- [ ] Role-based home — detect user role from session, show relevant dashboard
- [ ] Integration tests — full flow from ingest → drift → incident
- [ ] CI/CD skeleton — GitHub Actions: test, typecheck, deploy to staging
- **Metrics:** Time-to-action (how long to find problem), feature adoption per role

### **Weeks 5-8: Automated Action (P1)**

**Goal:** Problems don't just get detected — they trigger next steps.

- [ ] SLA dashboard — uptime, DQ pass rate, cost per data product
- [ ] Scheduled compliance runs — daily at 6am + manual trigger
- [ ] Slack/PagerDuty/JIRA integration — post incidents and exceptions there
- [ ] Export workflow — weekly health snapshot (CSV + email)
- [ ] Feature flags — allow dark-launch of new incident types without breaking UI
- [ ] Audit log viewer UI — who did what, when, why (export to SIEM)
- [ ] Staging environment — Docker Compose parity with prod
- **Metrics:** Incident SLA compliance %, policy exception approval time

### **Weeks 9-12: Scale & Resilience (P2)**

**Goal:** Works reliably under load, easy to operate, no surprises.

- [ ] Query caching strategy (Redis or in-memory) for lineage + impact
- [ ] PgBouncer connection pooling in prod
- [ ] Drift detection DLQ — retry failed detections, surface via UI
- [ ] SLO dashboard for Control itself — availability, latency, error rate
- [ ] Secrets rotation playbook + quarterly test
- [ ] Tracing / observability — request IDs, slow query logs
- [ ] Rollback test — monthly practice deployment
- [ ] Runbook for common failures (SSO breakglass, session reset, etc.)
- **Metrics:** Mean time to recovery (MTTR), deployment success rate, false alert rate

---

## 4. What NOT to Do (Guardrails)

| Temptation | Why Not | Alternative |
|-----------|--------|-------------|
| Build a data **catalog** feature | ServiceNow trap. You have `Products` and `Entities`. Stop. | Link to Collibra/Unity/Atlan via API if needed |
| Add **data profiling** (nulls %, cardinality) | That's a different tool. Focus on pipeline health. | Emit profiling metrics via OpenLineage facets |
| Build your own **alerting engine** | PagerDuty exists. Don't replicate. | Integrate via API (POST to PagerDuty when incident created) |
| Replace **JIRA/Confluence/Slack** | You'll lose. These are too good. | Be the data source; they are the workflow |
| Add **user-defined metrics** (custom SQL on data products) | Scope creep. That's analytics. | Point to BI tool (Looker, Tableau, etc.) |
| Support **every runtime** (Spark, Airflow, dbt, Fivetran, etc.) | Impossible. Standardize on OpenLineage. | Accept only OL-compliant runtimes |
| Make incident **fields customizable** | Process bloat. Incidents are simple. | Fixed schema: title, severity, steps, evidence, SLA |
| Build **data lineage visualization** from scratch | Existing (D3, Cytoscape) are immature. | Use existing: xyflow (already in codebase) |

---

## 5. Market Positioning

**Current:** "Data operations platform with incidents, compliance, lineage"  
**Generic.** Could be anyone.

**Proposed:** "The fastest way to see what's broken in your data pipelines and who needs to fix it."

**For whom:**
- **Data Engineer:** "I need to know immediately when my pipeline fails, why, and what to do"
- **Data Owner:** "I need to know if my data is meeting SLA and which team is responsible"
- **Compliance Officer:** "I need to know if our data meets policy and why exceptions exist"

**Why now:**
- Databricks, Airflow, dbt are now so easy to use that data teams are growing 5x faster than tooling
- Existing tools (Monte Carlo, Great Expectations, Databand) are slow, heavy, require integration
- OpenLineage standard makes multi-runtime integration possible

**Competitive advantage:**
- Already deployed at Latero customers (you have product-market fit signals!)
- No rip-and-replace; lightweight integration via OpenLineage
- Not trying to be a catalog / BI / warehouse — stays focused

---

## 6. Go/No-Go Check

**Before shipping P0 (4 weeks):**
- [ ] Operations Inbox exists and shows all priority data
- [ ] Entity detail hub is faster than current product page
- [ ] Integration tests pass (ingest → drift → incident)
- [ ] CI/CD runs on every PR (no merge without green checks)
- [ ] Zero cross-tenant data leaks in audit
- [ ] Staging environment identical to prod

**Before shipping P1 (8 weeks):**
- [ ] SLA dashboard populated for >= 3 customers
- [ ] Slack integration tested with live incidents
- [ ] Compliance runs on schedule, no manual failures in 1 week
- [ ] Audit log UI used in incident investigation (evidence)
- [ ] Feature flags deployed for 2 experimental features

**Before shipping P2 (12 weeks):**
- [ ] Query latency p99 < 500ms for lineage view
- [ ] Drift detection DLQ processed 100% of failures within 6h
- [ ] Team can rollback in < 15 minutes (tested monthly)
- [ ] 90% of incidents resolved within SLA
- [ ] NPS >= 40 from active users

---

## 7. Success Metrics (Quarterly OKRs)

| Objective | Key Result | How to Measure |
|-----------|-----------|-----------------|
| **Reduce time-to-awareness** | 80% of incidents detected within 1h of cause | Slack notification timestamp vs. run timestamp |
| **Improve resolution** | 90% of incidents resolved within 4h | Incident created → closed timestamps |
| **Enable compliance** | 100% of policy exceptions have justification & expiry | Audit log entry count |
| **Expand adoption** | 2 new customers / 3 teams per existing customer use Control | Active user growth |
| **Operational reliability** | 99.5% uptime, zero unplanned outages | Uptime dashboard, incident postmortems |
| **Developer velocity** | Deploy 2x per week, zero hotfixes | Git commit rate, rollback count |

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Drift detection silently fails | Teams miss data issues | Implement DLQ + alert on detection latency > 5s |
| Scope creep (catalog, profiling, etc.) | Never ships, loses focus | Strict roadmap review, link to external tools |
| Users don't adopt (still using grep logs) | Feature waste | Active onboarding + role-based dashboard + Slack alerts |
| Compliance gets too heavy (like Collibra) | Becomes irrelevant | Keep exception flow simple, no complex workflows |
| Scaling issues (> 100 products) | Prod incident | Implement caching, connection pooling, query optimization now |

---

## 9. Immediate Action Items (This Week)

1. **Schedule architecture review** — Tech Lead + Requirements Engineer — validate P0 scope doesn't break anything
2. **Design Operations Inbox** — UX Designer + Requirements Engineer — sketch on paper, get user feedback
3. **Set up staging environment** — Tech Lead — Docker Compose parity, test migrations there
4. **Hire or hire-train incident response person** — is on-call duty clear? runbooks written?
5. **Book customer calls** — validate "what needs attention today" resonates with 3+ teams

---

## 10. Approval Gates

**This plan becomes "active roadmap" only when signed off by:**

- ✅ **Product Owner** — aligns with vision (not ServiceNow, not Collibra)
- ✅ **Engineering Lead** — feasible in 12 weeks, doesn't break tenant isolation
- ✅ **Sales/Customer Success** — top 3 customers want Weeks 1-4 features
- ✅ **Operations/Support** — can operate P1-level product without 24/7 on-call

---

**Next Review:** 2026-05-13 10:00 AM (debrief yesterday's findings)
