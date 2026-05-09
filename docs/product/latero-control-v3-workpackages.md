# Latero Control v3 — Werk­pakketten

Uitvoeringsplan op basis van `latero-control-v3-vision.md` en `latero-control-v3-ux-modules.md`.

Elk werkpakket is onafhankelijk uitvoerbaar binnen zijn fase. Volgorde binnen een fase is aanbevolen maar niet altijd verplicht — zie de dependency-kolom per pakket.

Conventies die worden aangehouden:
- SQL-migraties: `infra/sql/init/0XX_naam.sql` (volgt bestaande nummering)
- API-routes: `web/src/app/api/[route]/route.ts`
- Hooks: `web/src/hooks/use-[domein].ts`
- Lib-modules: `web/src/lib/[naam].ts`
- Alle tabellen in `meta` schema, altijd met `installation_id` kolom
- TIMESTAMPTZ voor alle tijden, JSONB voor flexibele payloads

---

## Fase 1 — Operationeel Fundament

> Maakt bestaande monitoring beslissingsklaar. Fundament voor alle latere fasen.

---

### WP-101 — Temporele Metadata Fundament

**Prioriteit: eerste uitvoeren — alle andere WPs bouwen hierop**

**Wat**: voeg `valid_from` / `valid_to` aan bestaande tabellen toe zodat elke tabel historische snapshots bewaart. Updates worden inserts; oude rijen krijgen `valid_to = now()`.

**Scope**:
- Migratie `024_temporal_foundation.sql`:
  ```sql
  ALTER TABLE meta.data_products   ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now();
  ALTER TABLE meta.data_products   ADD COLUMN IF NOT EXISTS valid_to   TIMESTAMPTZ;
  ALTER TABLE meta.entities        ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now();
  ALTER TABLE meta.entities        ADD COLUMN IF NOT EXISTS valid_to   TIMESTAMPTZ;
  ALTER TABLE meta.datasets        ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now();
  ALTER TABLE meta.datasets        ADD COLUMN IF NOT EXISTS valid_to   TIMESTAMPTZ;
  -- Indexes voor as_of queries:
  CREATE INDEX IF NOT EXISTS idx_data_products_temporal ON meta.data_products (installation_id, valid_from, valid_to);
  CREATE INDEX IF NOT EXISTS idx_entities_temporal      ON meta.entities (installation_id, valid_from, valid_to);
  CREATE INDEX IF NOT EXISTS idx_datasets_temporal      ON meta.datasets (installation_id, valid_from, valid_to);
  ```
- Helper-functie in `web/src/lib/temporal.ts`:
  ```ts
  // Voegt WHERE valid_from <= $asOf AND (valid_to IS NULL OR valid_to > $asOf) toe
  export function asOfClause(asOf?: Date): string
  export function currentClause(): string  // valid_to IS NULL
  ```
- Alle bestaande read-queries in `insights-saas-read.ts` updaten met `currentClause()` — geen gedragswijziging, maar klaarstomen voor time-travel

**Niet in scope**: UI voor time-travel (dat is WP-412), lineage tabellen (apart WP), nieuwe tabellen

**Afhankelijkheden**: geen

**Acceptatiecriteria**:
- Alle bestaande queries retourneren zelfde resultaten als voor de migratie
- `asOfClause(new Date('2026-01-01'))` retourneert correcte WHERE-conditie
- Geen breaking changes in bestaande API routes

**Omvang**: M

---

### WP-102 — Data Product Registry: Data Model & API

**Wat**: data products upgraden van impliciete metadata naar een first-class beheerd entiteit met owner, SLA en contract-versie.

**Scope**:
- Migratie `025_data_product_v3.sql`:
  ```sql
  ALTER TABLE meta.data_products
    ADD COLUMN IF NOT EXISTS sla           JSONB,        -- { freshness_minutes, quality_threshold }
    ADD COLUMN IF NOT EXISTS contract_ver  TEXT,
    ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ;
  ```
- API-routes uitbreiden / aanmaken:
  - `GET  /api/data-products` — al aanwezig, uitbreiden met `sla`, `contract_ver`, `deprecated_at`
  - `PUT  /api/data-products/[id]` — nieuw: update naam, owner, domain, sla, contract_ver
  - `POST /api/data-products/[id]/deprecate` — nieuw: zet `deprecated_at = now()`
- Lib: `web/src/lib/api/data-products.ts` — typed client-functies voor alle routes

**Niet in scope**: Trust Score (WP-104), incident-koppeling (WP-106), UI (WP-103)

**Afhankelijkheden**: WP-101

**Acceptatiecriteria**:
- `PUT /api/data-products/[id]` persisteert SLA als JSONB
- `GET /api/data-products` retourneert `sla`, `contract_ver`, `deprecated_at`
- Deprecated products zijn gefilterd uit standaard list-response tenzij `?include_deprecated=true`

**Omvang**: S

---

### WP-103 — Data Product Registry: UI

**Wat**: `/products` pagina als card-grid met per-product signalen, plus `/products/[id]` detail-view.

**Scope**:
- `web/src/app/(tenant)/(dashboard)/products/page.tsx` — nieuw
- `web/src/app/(tenant)/(dashboard)/products/[id]/page.tsx` — nieuw
- `web/src/components/products/product-card.tsx` — kaart met naam, owner, domain, Trust Score badge (placeholder), freshness status, SLA-indicator
- `web/src/components/products/product-detail.tsx` — detail-layout met tabs: Overview / Incidents / Lineage / Evidence
- `web/src/hooks/use-products.ts` — TanStack Query hooks: `useProducts()`, `useProduct(id)`, `useUpdateProduct()`
- Navigatie-item toevoegen in de sidebar

**Niet in scope**: Trust Score badge met echte data (WP-105), Incidents tab inhoud (WP-107), Evidence tab inhoud (WP-310)

**Afhankelijkheden**: WP-102

**Acceptatiecriteria**:
- `/products` toont alle non-deprecated producten als cards
- Filteren op domain werkt
- `/products/[id]` toont alle beschikbare velden; lege tabs tonen een placeholder
- Breadcrumb en navigatie werken correct

**Omvang**: M

---

### WP-104 — Trust Score: Berekeningsengine

**Wat**: server-side engine die een Trust Score berekent per data product op basis van meetbare factoren, en snapshots bewaart.

**Scope**:
- Migratie `026_trust_score.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS meta.trust_score_snapshots (
    id              BIGSERIAL   PRIMARY KEY,
    installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
    product_id      TEXT        NOT NULL,
    calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    score           SMALLINT    NOT NULL CHECK (score BETWEEN 0 AND 100),
    factors         JSONB       NOT NULL   -- [{ id, label, weight, delta, link }]
  );
  CREATE INDEX IF NOT EXISTS idx_trust_snapshots_product
    ON meta.trust_score_snapshots (installation_id, product_id, calculated_at DESC);
  ```
- `web/src/lib/trust-score.ts`:
  - `calculateTrustScore(productId, installationId): Promise<TrustScoreResult>`
  - Factoren (initieel): owner assigned (−15 indien ontbreekt), freshness SLA defined (−10), lineage coverage (−7 indien < 80%), quality check pass rate (−10 indien < 95%), open critical incidents (−5 per stuk, max −20)
  - Resultaat wordt geïnsert in `trust_score_snapshots`
- `GET /api/products/[id]/trust` — huidige snapshot + factor-breakdown
- `GET /api/products/[id]/trust/history` — laatste 90 snapshots
- Trust score berekening triggeren na elke pipeline run (aanroep vanuit bestaande run-ingest in `meta-ingest.ts`)

**Niet in scope**: UI (WP-105), consumer-factoren (WP-206), cost-factoren (WP-306)

**Afhankelijkheden**: WP-102, WP-101

**Acceptatiecriteria**:
- Score verandert aantoonbaar wanneer een factor verandert (bijv. owner verwijderen → score daalt)
- Snapshot wordt weggeschreven na elke run-ingest
- `GET /api/products/[id]/trust` retourneert score én factor-breakdown als array
- Score is deterministisch: zelfde input → zelfde output

**Omvang**: M

---

### WP-105 — Trust Score: UI Componenten

**Wat**: herbruikbare Trust Score badge, breakdown-popover en trend-sparkline.

**Scope**:
- `web/src/components/trust/trust-score-badge.tsx` — cirkel met getal, kleur (groen/amber/rood), trend-pijl
- `web/src/components/trust/trust-score-breakdown.tsx` — popover met factor-lijst, delta per factor, directe actie-links
- `web/src/components/trust/trust-score-sparkline.tsx` — 30-daags sparkline met event-annotaties
- `web/src/hooks/use-trust-score.ts` — `useTrustScore(productId)`, `useTrustHistory(productId)`
- Badge integreren op: product card (WP-103), product detail header, lineage nodes

**Niet in scope**: trend-annotaties met change events (WP-204)

**Afhankelijkheden**: WP-104, WP-103

**Acceptatiecriteria**:
- Badge toont correct kleur op basis van score-waarde
- Popover opent inline, sluit bij klik buiten
- Elke negatieve factor heeft een werkende link naar de relevante pagina
- Sparkline toont 30 datapunten; lege state toont een placeholder

**Omvang**: S

---

### WP-106 — Incident Management: Data Model & API

**Wat**: server-side incident-entiteit met statusmachine, stappen en evidence-koppeling.

**Scope**:
- Migratie `027_incidents.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS meta.incidents (
    id              BIGSERIAL   PRIMARY KEY,
    installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
    product_id      TEXT,
    title           TEXT        NOT NULL,
    severity        TEXT        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    status          TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
    assignee        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    source_type     TEXT,       -- 'alert' | 'policy_violation' | 'manual'
    source_id       TEXT
  );
  CREATE TABLE IF NOT EXISTS meta.incident_steps (
    id          BIGSERIAL   PRIMARY KEY,
    incident_id BIGINT      NOT NULL REFERENCES meta.incidents (id) ON DELETE CASCADE,
    label       TEXT        NOT NULL,
    completed_at TIMESTAMPTZ,
    completed_by TEXT
  );
  CREATE TABLE IF NOT EXISTS meta.incident_evidence (
    id           BIGSERIAL   PRIMARY KEY,
    incident_id  BIGINT      NOT NULL REFERENCES meta.incidents (id) ON DELETE CASCADE,
    evidence_type TEXT       NOT NULL,
    payload      JSONB       NOT NULL,
    attached_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
- API-routes:
  - `GET    /api/incidents` — lijst met filters: `status`, `product_id`, `severity`
  - `POST   /api/incidents` — aanmaken
  - `GET    /api/incidents/[id]` — detail incl. stappen en evidence
  - `PUT    /api/incidents/[id]` — update status, assignee, severity
  - `POST   /api/incidents/[id]/steps` — stap als voltooid markeren
  - `POST   /api/incidents/[id]/evidence` — evidence toevoegen
- `web/src/lib/api/incidents.ts` — typed client

**Afhankelijkheden**: WP-102

**Acceptatiecriteria**:
- Incident aanmaken met `POST` persisteert correct en retourneert het nieuwe record
- Status-transitie `open → in_progress → resolved` werkt; `resolved_at` wordt gezet bij resolved
- Evidence is opvraagbaar via GET detail

**Omvang**: M

---

### WP-107 — Incident Management: UI

**Wat**: `/incidents` overzicht en `/incidents/[id]` workflow-detail.

**Scope**:
- `web/src/app/(tenant)/(dashboard)/incidents/page.tsx`
- `web/src/app/(tenant)/(dashboard)/incidents/[id]/page.tsx`
- `web/src/components/incidents/incident-list.tsx` — gesorteerde lijst met status-badges, severity, product-link, time-to-resolve
- `web/src/components/incidents/incident-detail.tsx` — workflow-tijdlijn (create → assign → steps → resolve)
- `web/src/components/incidents/create-incident-drawer.tsx` — drawer die vanuit alert, Trust Score factor of policy-violation geopend kan worden; pre-filled velden
- `web/src/hooks/use-incidents.ts` — `useIncidents()`, `useIncident(id)`, `useCreateIncident()`, `useUpdateIncident()`
- "Open incident" knop toevoegen aan: alert-cards, Trust Score breakdown popover

**Afhankelijkheden**: WP-106, WP-103

**Acceptatiecriteria**:
- Incident aanmaken via drawer werkt end-to-end
- Workflow-tijdlijn toont elke stap in juiste volgorde
- Filteren op status en severity werkt
- Linken vanuit Trust Score breakdown naar nieuw incident opent drawer met pre-filled product_id

**Omvang**: M

---

### WP-108 — Alert Intelligence: Routing & Suppressie

**Wat**: slimme alert-routing op basis van eigenaarschap, cascade-suppressie bij root cause incident, en digest-modus.

**Scope**:
- Migratie `028_alert_routing.sql`:
  ```sql
  ALTER TABLE meta.alerts   -- indien nog niet aanwezig, anders uitbreiden
    ADD COLUMN IF NOT EXISTS routed_to           TEXT,
    ADD COLUMN IF NOT EXISTS routing_rule_id     TEXT,
    ADD COLUMN IF NOT EXISTS suppressed_by       BIGINT REFERENCES meta.incidents (id),
    ADD COLUMN IF NOT EXISTS digest_batch_id     TEXT;
  CREATE TABLE IF NOT EXISTS meta.alert_routing_rules (
    id              TEXT        PRIMARY KEY,
    installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
    conditions      JSONB       NOT NULL,
    actions         JSONB       NOT NULL,
    priority        SMALLINT    NOT NULL DEFAULT 0,
    active          BOOLEAN     NOT NULL DEFAULT true
  );
  ```
- `web/src/lib/alert-routing.ts`:
  - `routeAlert(alert, installationId)` — evalueert regels in volgorde van prioriteit, schrijft `routed_to` en `routing_rule_id`
  - `suppressCascade(rootIncidentId, installationId)` — markeert alle alerts met zelfde `source_id`-keten als suppressed
- API-routes:
  - `GET /api/alerts` — uitbreiden: voeg `routed_to`, `suppressed_by` toe aan response
  - `GET /api/settings/alert-routing` — routing rules ophalen
  - `PUT /api/settings/alert-routing` — rules opslaan
  - `PUT /api/alerts/[id]/suppress` — handmatig suppressie met reden
- `web/src/app/(tenant)/(dashboard)/alerts/page.tsx` — nieuw: feed met routing-trace per alert
- `web/src/app/(tenant)/(dashboard)/settings/alert-routing.tsx` — rule-builder UI (condition + action select, volgorde drag)

**Afhankelijkheden**: WP-106

**Acceptatiecriteria**:
- Alert met `type=freshness_breach` en `domain=Finance` rout naar de geconfigureerde eigenaar
- Suppressie via root-incident markeert alle afgeleide alerts als suppressed
- Regels worden in prioriteitsvolgorde geëvalueerd
- Digest-batch-ID wordt gezet voor lage-prioriteit alerts

**Omvang**: L

---

## Fase 2 — Business Context

> Verbindt technische operaties aan zakelijke betekenis.

---

### WP-201 — Business Impact Graph: Data Model & API

**Wat**: koppel producten en entities aan zakelijke outputs (KPI's, dashboards, processen).

**Scope**:
- Migratie `029_business_outputs.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS meta.business_outputs (
    id              TEXT        PRIMARY KEY,
    installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
    name            TEXT        NOT NULL,
    output_type     TEXT        NOT NULL CHECK (output_type IN ('kpi','dashboard','process','report','risk')),
    owner_team      TEXT,
    criticality     TEXT        NOT NULL DEFAULT 'medium' CHECK (criticality IN ('low','medium','high','critical')),
    description     TEXT
  );
  CREATE TABLE IF NOT EXISTS meta.product_output_links (
    installation_id TEXT NOT NULL,
    product_id      TEXT NOT NULL,
    output_id       TEXT NOT NULL REFERENCES meta.business_outputs (id) ON DELETE CASCADE,
    description     TEXT,
    PRIMARY KEY (installation_id, product_id, output_id)
  );
  ```
- API-routes:
  - `GET  /api/business-outputs` — lijst per installatie
  - `POST /api/business-outputs` — aanmaken
  - `GET  /api/products/[id]/business-outputs` — outputs voor een product
  - `POST /api/products/[id]/business-outputs` — koppeling toevoegen
  - `DELETE /api/products/[id]/business-outputs/[outputId]` — koppeling verwijderen
  - `GET  /api/lineage/[id]/impact` — alle business outputs die bereikbaar zijn vanuit een node (lineage traversal)
- `web/src/lib/api/business-outputs.ts`

**Afhankelijkheden**: WP-102

**Acceptatiecriteria**:
- `GET /api/lineage/[id]/impact` traverseert downstream lineage en retourneert unieke set van gekoppelde outputs
- Koppelen en ontkoppelen werkt zonder side effects op andere producten
- Impact-response bevat `criticality` en `output_type` per output

**Omvang**: M

---

### WP-202 — Business Impact Graph: UI

**Wat**: business-modus toggle op de lineage graph en Business Impact Banner in alerts en incidents.

**Scope**:
- `web/src/app/(tenant)/(dashboard)/lineage/graph-view.tsx` uitbreiden:
  - Toggle "Technical / Business" in toolbar
  - In business-modus: nodes krijgen gekleurde impact-ring op basis van hoogste criticality van gekoppelde outputs
  - Node-klik opent bestaande entity-detail panel uitgebreid met "Business" tab
- `web/src/components/lineage/business-tab.tsx` — lijst van gekoppelde outputs met type-icoon, criticality badge, directe link
- `web/src/components/lineage/business-output-editor.tsx` — inline form om outputs te koppelen / beheren
- `web/src/components/shared/business-impact-banner.tsx` — herbruikbare banner: "This affects: [NPS Dashboard] [Revenue Report]", elke badge is een link
- Banner integreren in: incident detail header, alert cards, Change Intelligence cards (WP-204)
- `web/src/hooks/use-business-outputs.ts`

**Afhankelijkheden**: WP-201

**Acceptatiecriteria**:
- Toggle schakelt visuele modus zonder pagina-herlaad
- Impact-ring is zichtbaar op nodes met gekoppelde outputs
- Banner toont correcte outputs bij een incident dat aan een product is gekoppeld
- Output-koppeling via de editor persisteert direct

**Omvang**: M

---

### WP-203 — Change Intelligence: Detectie-engine

**Wat**: server-side detectie van schema-drift, contract-drift, eigenaarsdrift en statistisch-drift. Resultaten worden opgeslagen als change events.

**Scope**:
- Migratie `030_change_events.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS meta.change_events (
    id              BIGSERIAL   PRIMARY KEY,
    installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
    change_type     TEXT        NOT NULL,  -- schema_drift | contract_drift | ownership_drift | statistical_drift | lineage_drift
    severity        TEXT        NOT NULL CHECK (severity IN ('informational','significant','breaking')),
    entity_type     TEXT,                  -- product | entity | dataset
    entity_id       TEXT,
    diff            JSONB       NOT NULL,  -- { before, after, affected_fields }
    risk_assessment JSONB,                 -- { level, affected_outputs, recommended_action }
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_change_events_entity
    ON meta.change_events (installation_id, entity_id, detected_at DESC);
  ```
- `web/src/lib/change-detection.ts`:
  - `detectSchemaDrift(datasetId, installationId)` — vergelijk huidige schema met vorige `valid_from` snapshot (WP-101)
  - `detectOwnershipDrift(productId, installationId)` — eigenaar veranderd of leeggemaakt
  - `detectStatisticalDrift(datasetId, installationId)` — run volume, null-rate buiten Z-score drempel
  - `detectContractDrift(productId, installationId)` — SLA of contract_ver gewijzigd
  - Alle detectors schrijven naar `change_events`; geen dubbelingen binnen 5 minuten voor zelfde entiteit+type
- Detectie triggeren vanuit run-ingest en sync-cycle (aanroep toevoegen in `meta-ingest.ts` en `databricks-sync.ts`)
- `GET /api/changes` — lijst met filters: `type`, `severity`, `entity_id`, `from`, `to`
- `GET /api/changes/[id]` — detail met volledige diff

**Afhankelijkheden**: WP-101, WP-102

**Acceptatiecriteria**:
- Schema-drift wordt gedetecteerd wanneer een kolom wordt verwijderd uit een dataset
- Eigenaarsdrift wordt gedetecteerd wanneer `owner` op null wordt gezet
- Geen dubbel event voor dezelfde wijziging binnen 5 minuten
- Risk assessment bevat een lijst van gerakte business outputs (indien WP-201 aanwezig)

**Omvang**: L

---

### WP-204 — Change Intelligence: UI

**Wat**: `/changes` feed met uitklapbare kaarten, diff-modal en digest-configuratie.

**Scope**:
- `web/src/app/(tenant)/(dashboard)/changes/page.tsx`
- `web/src/components/changes/change-feed.tsx` — gesorteerde feed, filterbaar op type/severity/domain/periode
- `web/src/components/changes/change-card.tsx` — uitklapbare kaart: wat/geraakt/risico/actie; met "Open incident" knop
- `web/src/components/changes/change-diff-modal.tsx` — side-by-side diff voor schema en contract wijzigingen
- Trust Score sparkline uitbreiden (WP-105): annoteer datapunten die overeenkomen met change events
- `web/src/hooks/use-changes.ts`

**Afhankelijkheden**: WP-203, WP-107

**Acceptatiecriteria**:
- Feed toont maximaal 100 meest recente events; "load more" laadt oudere events
- Diff-modal toont before/after voor schema wijziging correct
- "Open incident" op een change card opent de create-drawer met pre-filled velden (WP-107)
- Filteren op severity=breaking toont alleen breaking changes

**Omvang**: M

---

### WP-205 — Demand-Side Visibility: Data Model & API

**Wat**: consumer-registratie en usage-tracking per data product.

**Scope**:
- Migratie `031_demand_side.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS meta.product_consumers (
    installation_id TEXT        NOT NULL,
    product_id      TEXT        NOT NULL,
    consumer_id     TEXT        NOT NULL,
    consumer_type   TEXT        NOT NULL CHECK (consumer_type IN ('team','system','person')),
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (installation_id, product_id, consumer_id)
  );
  CREATE TABLE IF NOT EXISTS meta.product_usage_events (
    id              BIGSERIAL   PRIMARY KEY,
    installation_id TEXT        NOT NULL,
    product_id      TEXT        NOT NULL,
    consumer_id     TEXT,
    accessed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );  -- append-only, geen deletes
  CREATE TABLE IF NOT EXISTS meta.contract_requests (
    id              BIGSERIAL   PRIMARY KEY,
    installation_id TEXT        NOT NULL,
    product_id      TEXT        NOT NULL,
    consumer_id     TEXT        NOT NULL,
    requirements    JSONB       NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    resolved_by     TEXT
  );
  ```
- API-routes:
  - `GET  /api/products/[id]/consumers` — lijst met usage-statistieken per consumer
  - `POST /api/products/[id]/consumers` — consumer registreren
  - `GET  /api/products/[id]/usage` — timeseries (dagelijks, 90 dagen)
  - `POST /api/products/[id]/usage` — usage event loggen (voor integraties)
  - `POST /api/products/[id]/contract-requests` — aanvraag indienen
  - `PUT  /api/products/[id]/contract-requests/[reqId]` — goedkeuren of afwijzen
- Ghost product query toevoegen aan `GET /api/products`: veld `last_consumer_activity_at` en `consumer_count`

**Afhankelijkheden**: WP-102

**Acceptatiecriteria**:
- Usage event loggen via POST is idempotent voor duplicate events binnen 1 minuut
- Ghost product filter werkt: `GET /api/products?ghost=true` retourneert producten zonder activiteit in 30 dagen
- Contract request aanmaken en goedkeuren werkt end-to-end

**Omvang**: M

---

### WP-206 — Demand-Side Visibility: UI

**Wat**: consumers-tab op product detail, ghost product waarschuwing op product index.

**Scope**:
- Consumers-tab toevoegen aan `/products/[id]` (WP-103 uitbreiden):
  - Tabel: consumer naam, type, last accessed, toegangsfrequentie (grafiek)
  - Contract request lijst met status badges
  - "Request contract" form voor consumers
- Ghost product banner op `/products`:
  ```
  ⚠  4 data products have had no consumer activity in 30+ days. [View →]
  ```
- Ghost product filter toevoegen aan filter-bar
- Usage trend chart op product detail (30/90 dag toggle)
- Trust Score engine (WP-104) uitbreiden: consumer_inactivity factor toevoegen (−5 bij 0 consumers > 30 dagen)
- `web/src/hooks/use-consumers.ts`

**Afhankelijkheden**: WP-205, WP-103, WP-104

**Acceptatiecriteria**:
- Consumers-tab toont correcte consumer-lijst en usage-grafiek
- Ghost product banner verdwijnt wanneer alle producten recent activity hebben
- Trust Score daalt aantoonbaar bij product zonder consumers

**Omvang**: S

---

### WP-207 — Business Glossary: Data Model & API

**Scope**:
- Migratie `032_glossary.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS meta.glossary_terms (
    id              TEXT        NOT NULL,
    installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
    name            TEXT        NOT NULL,
    definition      TEXT        NOT NULL,
    owner_team      TEXT,
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to        TIMESTAMPTZ,
    PRIMARY KEY (installation_id, id, valid_from)
  );
  CREATE TABLE IF NOT EXISTS meta.term_dataset_links (
    installation_id TEXT NOT NULL,
    term_id         TEXT NOT NULL,
    dataset_id      TEXT NOT NULL,
    column_name     TEXT,         -- null = gehele dataset
    PRIMARY KEY (installation_id, term_id, dataset_id)
  );
  ```
- Conflict-detectie query: terms met zelfde `name` maar verschillende `definition` binnen dezelfde installatie
- API-routes:
  - `GET    /api/glossary` — lijst, met `?conflict=true` filter
  - `POST   /api/glossary` — term aanmaken
  - `GET    /api/glossary/[id]` — detail met dataset-links en versiehistorie
  - `PUT    /api/glossary/[id]` — update (slaat nieuwe versie via valid_from/valid_to)
  - `DELETE /api/glossary/[id]` — soft delete (valid_to = now())
  - `GET    /api/glossary/conflicts` — alle conflicterende term-paren

**Afhankelijkheden**: WP-101

**Acceptatiecriteria**:
- Versiehistorie is zichtbaar via `GET /api/glossary/[id]?history=true`
- Conflict-detectie werkt: twee teams definiëren "Revenue" anders → retourneert beide als conflict-paar
- Term aan dataset koppelen werkt, koppeling is zichtbaar in term-detail

**Omvang**: M

---

### WP-208 — Business Glossary: UI

**Scope**:
- `web/src/app/(tenant)/(dashboard)/glossary/page.tsx`
- `web/src/app/(tenant)/(dashboard)/glossary/[id]/page.tsx`
- `web/src/components/glossary/term-browser.tsx` — zoekbare lijst met conflict-indicatoren
- `web/src/components/glossary/term-detail.tsx` — definitie, versiehistorie, gekoppelde datasets, conflict-resolutie banner
- `web/src/components/glossary/term-editor.tsx` — form voor aanmaken en bewerken
- Conflictbanner ook tonen op product detail (WP-103) wanneer een gekoppelde term een conflict heeft
- Lineage nodes: toon term-label bij hover indien node is gekoppeld aan een glossary-term
- `web/src/hooks/use-glossary.ts`

**Afhankelijkheden**: WP-207

**Acceptatiecriteria**:
- Conflict-indicator is zichtbaar in de term-browser voor conflicterende termen
- Versiehistorie toont correcte tijdlijn van wijzigingen
- Term aanmaken en koppelen aan dataset werkt end-to-end

**Omvang**: M

---

## Fase 3 — Governance & Evidence

> Maakt Latero de compliance-backbone voor gereguleerde use cases.

---

### WP-301 — Policy Engine: Data Model & API

**Scope**:
- Migratie `033_policy_engine.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS meta.policy_packs (
    id              TEXT PRIMARY KEY,
    installation_id TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT
  );
  CREATE TABLE IF NOT EXISTS meta.policies (
    id              TEXT        PRIMARY KEY,
    installation_id TEXT        NOT NULL,
    pack_id         TEXT        REFERENCES meta.policy_packs (id),
    name            TEXT        NOT NULL,
    description     TEXT,
    rule            JSONB       NOT NULL,   -- { subject, condition, threshold }
    scope           JSONB       NOT NULL,   -- { all | domains[] | products[] }
    action          TEXT        NOT NULL CHECK (action IN ('warn','block','notify')),
    active          BOOLEAN     NOT NULL DEFAULT true
  );
  CREATE TABLE IF NOT EXISTS meta.policy_verdicts (
    id          BIGSERIAL   PRIMARY KEY,
    policy_id   TEXT        NOT NULL REFERENCES meta.policies (id),
    product_id  TEXT        NOT NULL,
    installation_id TEXT    NOT NULL,
    verdict     TEXT        NOT NULL CHECK (verdict IN ('pass','fail','exception')),
    detail      JSONB,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS meta.policy_exceptions (
    id              BIGSERIAL   PRIMARY KEY,
    policy_id       TEXT        NOT NULL REFERENCES meta.policies (id),
    product_id      TEXT        NOT NULL,
    installation_id TEXT        NOT NULL,
    justification   TEXT        NOT NULL,
    expiry_date     DATE        NOT NULL,
    approved_by     TEXT,
    approved_at     TIMESTAMPTZ,
    status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined'))
  );
  ```
- `web/src/lib/policy-engine.ts`:
  - `evaluatePolicy(policy, productId, installationId)` — evalueert één policy voor één product
  - `runPolicyCheck(installationId)` — evalueert alle actieve policies, schrijft verdicts
  - Policy check triggeren na run-ingest
- API-routes:
  - `GET/POST /api/policies` — library
  - `GET/PUT  /api/policies/[id]`
  - `GET      /api/compliance` — matrix: producten × policy packs met pass/fail/exception
  - `GET      /api/compliance/[productId]` — alle verdicts voor één product
  - `POST     /api/compliance/exceptions` — uitzondering aanvragen
  - `PUT      /api/compliance/exceptions/[id]` — goedkeuren of afwijzen

**Afhankelijkheden**: WP-102

**Acceptatiecriteria**:
- Policy met `condition: owner_missing` scoort `fail` voor producten zonder owner
- Compliance matrix retourneert correcte verdicts voor 3 producten × 2 packs
- Goedgekeurde uitzondering resulteert in `verdict=exception` in de matrix
- Verlopen uitzondering (expiry_date < today) resulteert automatisch in heroverweging

**Omvang**: L

---

### WP-302 — Policy Engine: UI

**Scope**:
- `web/src/app/(tenant)/(dashboard)/policies/page.tsx` — policy library
- `web/src/app/(tenant)/(dashboard)/compliance/page.tsx` — compliance matrix
- `web/src/components/policies/policy-list.tsx` — per pack gegroepeerd, met pass/fail teller
- `web/src/components/policies/policy-editor.tsx` — form: subject (dropdown), condition (dropdown + waarde), scope, action
- `web/src/components/compliance/compliance-matrix.tsx` — tabel met gekleurde cellen; drill-down bij klik
- `web/src/components/compliance/exception-request-form.tsx` — justification, expiry, approver
- Compliance-tab toevoegen aan product detail (WP-103)
- `web/src/hooks/use-policies.ts`, `use-compliance.ts`

**Afhankelijkheden**: WP-301

**Acceptatiecriteria**:
- Policy aanmaken via form werkt zonder code schrijven
- Matrix toont visueel onderscheid tussen pass (groen), fail (rood) en exception (amber)
- Uitzondering aanvragen vanuit matrix-cel werkt end-to-end

**Omvang**: M

---

### WP-303 — Evidence Ledger: Data Model & API

**Wat**: append-only bewijs­trail per data product. Technisch onmogelijk om te bewerken of te verwijderen.

**Scope**:
- Migratie `034_evidence_ledger.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS meta.evidence_records (
    id              BIGSERIAL   PRIMARY KEY,
    installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
    product_id      TEXT        NOT NULL,
    event_type      TEXT        NOT NULL,  -- quality_check | transformation | source_snapshot | approval | exception | incident_resolved
    run_id          TEXT,
    payload         JSONB       NOT NULL,
    hash            TEXT        NOT NULL,  -- SHA-256 van payload
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- Triggers om UPDATE en DELETE te blokkeren:
  CREATE OR REPLACE RULE no_update_evidence AS ON UPDATE TO meta.evidence_records DO INSTEAD NOTHING;
  CREATE OR REPLACE RULE no_delete_evidence AS ON DELETE TO meta.evidence_records DO INSTEAD NOTHING;
  ```
- `web/src/lib/evidence-ledger.ts`:
  - `appendEvidence(record)` — berekent hash, schrijft naar tabel
  - `getEvidenceGaps(productId, installationId)` — vergelijkt aanwezige records met verplichte types per actief policy pack
  - Automatisch evidence schrijven vanuit: run-ingest (quality checks), sync (source snapshots), incident resolve (WP-106)
- API-routes:
  - `GET  /api/products/[id]/evidence` — gepagineerde trail (nieuwste eerst)
  - `POST /api/products/[id]/evidence` — handmatig record toevoegen (voor approvals)
  - `GET  /api/products/[id]/evidence/gaps` — ontbrekende verplichte records
  - `GET  /api/products/[id]/evidence/export` — gesigneerde PDF genereren

**Afhankelijkheden**: WP-102, WP-301

**Acceptatiecriteria**:
- UPDATE en DELETE op `evidence_records` zijn geblokkeerd op databaseniveau
- Hash is consistent: zelfde payload → zelfde hash
- Gap-detectie retourneert correcte ontbrekende types ten opzichte van actieve policies
- PDF-export bevat alle records in het gevraagde datumbereik

**Omvang**: L

---

### WP-304 — Evidence Ledger: UI

**Scope**:
- Evidence-tab op product detail vullen (placeholder uit WP-103 vervangen):
  - Reverse-chronologische tijdlijn met event-type iconen
  - Gap-banner bovenaan: "Missing: quality_check evidence for 3 runs"
  - Per record: expand voor payload detail, hash tonen
- `web/src/components/evidence/evidence-timeline.tsx`
- `web/src/components/evidence/evidence-gap-banner.tsx`
- `web/src/components/evidence/evidence-export-button.tsx` — opent date-range picker, triggert PDF
- `web/src/hooks/use-evidence.ts`

**Afhankelijkheden**: WP-303

**Acceptatiecriteria**:
- Tijdlijn toont minimaal 50 records; pagination werkt
- Gap-banner is zichtbaar wanneer een verplicht record ontbreekt, afwezig wanneer volledig
- PDF-export genereert een downloadbaar bestand met correcte metadata op de voorpagina

**Omvang**: M

---

### WP-305 — Cost & ROI Attributie: Data Model & API

**Scope**:
- Migratie `035_cost_attribution.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS meta.product_cost_records (
    id              BIGSERIAL   PRIMARY KEY,
    installation_id TEXT        NOT NULL,
    product_id      TEXT        NOT NULL,
    period_start    DATE        NOT NULL,
    period_end      DATE        NOT NULL,
    cost_usd        NUMERIC(12,4) NOT NULL,
    cost_breakdown  JSONB,       -- { compute, storage, query, other }
    source          TEXT         NOT NULL  -- 'databricks' | 'manual' | 'estimated'
  );
  ```
- `web/src/lib/cost-attribution.ts`:
  - `roiScore(productId, installationId)` — cost_usd / (consumer_count × criticality_weight)
  - `getProductCostSummary(installationId)` — per product: total cost (laatste 30d), roi_score, roi_category (high/medium/low/at_risk)
- API-routes:
  - `GET /api/costs` — overzicht alle producten met roi_score en roi_category
  - `GET /api/products/[id]/costs` — cost timeseries per maand
  - `POST /api/costs/sync` — cost-data inladen (handmatig of via Databricks-integratie)

**Afhankelijkheden**: WP-205, WP-102

**Acceptatiecriteria**:
- ROI-categorie "at_risk" verschijnt bij hoge kosten + lage consumer-activiteit
- Cost timeseries retourneert maandelijkse totalen voor de laatste 12 maanden
- Handmatig inladen via POST werkt (voor CSV-import use case)

**Omvang**: M

---

### WP-306 — Cost & ROI: UI

**Scope**:
- `web/src/app/(tenant)/(dashboard)/costs/page.tsx`
- `web/src/components/costs/cost-overview-table.tsx` — gesorteerd op cost_usd of roi_score; kolommen: product, domain, cost (30d), consumers, ROI-badge
- `web/src/components/costs/roi-matrix.tsx` — scatter plot: X = cost, Y = business value (consumer × criticality); vier kwadranten gelabeld
- `web/src/components/costs/cost-trend-chart.tsx` — 12-maands lijndiagram per product; anomalie-annotaties
- Cost-kolom toevoegen aan product index (WP-103): cost badge naast Trust Score
- Trust Score engine uitbreiden (WP-104): hoog-kosten + lage ROI als factor (−5 bij roi_category=at_risk)
- `web/src/hooks/use-costs.ts`

**Afhankelijkheden**: WP-305, WP-103

**Acceptatiecriteria**:
- ROI-matrix toont alle producten als punten met correcte kwadrant-kleuring
- Klikken op een punt in de matrix navigeert naar het product detail
- Cost-badge op product card is zichtbaar en heeft correcte kleur

**Omvang**: M

---

### WP-307 — Operating Model Dashboards

**Wat**: vijf system dashboards als widget-registry entries, gebouwd op bestaand DashboardCanvas.

**Scope**:
- `web/src/lib/system-dashboards/executive-trust.ts`
- `web/src/lib/system-dashboards/domain-owner.ts`
- `web/src/lib/system-dashboards/platform-operator.ts`
- `web/src/lib/system-dashboards/compliance-audit.ts`
- `web/src/lib/system-dashboards/esg-finance.ts`
- Elk dashboard is een array van widget-configuraties die worden geregistreerd in `registry.ts` als system-tier dashboards
- Nieuwe system-widgets aanmaken voor ontbrekende visualisaties:
  - `trust-score-overview-widget` — top-5 producten op Trust Score
  - `policy-compliance-summary-widget` — pass/fail ratio per pack
  - `incident-trend-widget` — open/gesloten incidents over 30 dagen
  - `ghost-products-widget` — lijst van producten zonder consumer activity

**Afhankelijkheden**: alle WPs in Fase 1–3

**Acceptatiecriteria**:
- Alle vijf dashboards zijn toegankelijk via het systeem-dashboard-menu
- Elk dashboard toont relevante data zonder handmatige configuratie
- Operators kunnen een system dashboard klonen naar persoonlijk of gedeeld

**Omvang**: M

---

## Fase 4 — Intelligence Layer

> Maakt de metadata-graph bevraagbaar en de Copilot productie-klaar.

---

### WP-401 — Temporal Time-Travel: UI

**Wat**: globale "as of" datum-picker die alle views naar een historische toestand zet.

**Scope**:
- `web/src/components/shared/temporal-mode-bar.tsx` — datum-picker in topnavigatie, toont blauwe banner wanneer actief
- `web/src/contexts/TemporalContext.tsx` — `asOf: Date | null`, gedeeld via context
- Alle TanStack Query hooks uitbreiden met `asOf` parameter die wordt meegegeven aan API-routes
- Alle API-routes die temporele tabellen bevragen uitbreiden met optionele `?as_of=ISO8601` query-param (maakt gebruik van `asOfClause` uit WP-101)
- Read-only modus in UI wanneer `asOf !== null`: formulieren en knoppen zijn disabled, tooltip: "Viewing historical state"
- "Export as of [datum]" knop op evidence ledger (WP-304) en compliance matrix (WP-302)

**Afhankelijkheden**: WP-101, WP-103, WP-302, WP-304

**Acceptatiecriteria**:
- "As of 2026-01-01" instellen toont Trust Score en compliance zoals ze waren op die datum
- Alle mutatie-UI is disabled in historische modus
- Terugkeren naar "huidig" werkt via één klik

**Omvang**: M

---

### WP-402 — Metadata Query Layer

**Wat**: server-side graph-traversal API die natuurlijke-taal-intents vertaalt naar gestructureerde Postgres-queries op de metadata-graph.

**Scope**:
- `web/src/lib/metadata-graph.ts`:
  - `traverseDownstream(entityId, installationId, maxDepth)` — alle downstream nodes
  - `traverseUpstream(entityId, installationId, maxDepth)` — alle upstream nodes
  - `findProductsByFilter(filter: ProductFilter, installationId)` — gestructureerde filter op alle product-attributen
  - `getProductSnapshot(productId, asOf, installationId)` — complete product-staat op een datum
- `web/src/lib/copilot-intents.ts`:
  - `parseIntent(query: string)` — eerste LLM-call: classificeer naar een van ~10 bekende intent-types
  - `executeIntent(intent, installationId)` — voert de bijbehorende graph-query uit, retourneert gestructureerd resultaat
  - Intent types: `impact_analysis`, `gap_query`, `historical_state`, `owner_lookup`, `cost_query`, `compliance_query`, `incident_lookup`, `change_history`
- `POST /api/copilot/query` — accepteert `{ query: string }`, retourneert `{ answer, citations, navigation_links }`
- Nooit ruwe data naar LLM sturen — alleen gestructureerde metadata-samenvattingen

**Afhankelijkheden**: alle vorige WPs

**Acceptatiecriteria**:
- Impact query voor een falende entity retourneert correcte lijst van downstream business outputs
- Gap query voor ontbrekende owners retourneert gefilterde lijst van producten
- Historische query gebruikt `asOfClause` uit WP-101
- Gemiddelde responstijd < 3 seconden voor eenvoudige queries

**Omvang**: XL

---

### WP-403 — Grounded Copilot: UI

**Scope**:
- `web/src/components/copilot/copilot-panel.tsx` — uitschuifbaar side panel, bereikbaar via `Cmd+K` of toolbar-knop
- `web/src/components/copilot/copilot-chat.tsx` — chat-interface met message-history per sessie
- `web/src/components/copilot/copilot-citation.tsx` — per antwoord: "Based on: [product] · last updated [tijdstip]"; klikbaar
- `web/src/components/copilot/suggested-queries.tsx` — 2–3 contextuele query-suggesties op basis van huidige pagina en Trust Score status
- Suggesties tonen op product-detail wanneer Trust Score < 70 of een actief incident aanwezig is
- `web/src/hooks/use-copilot.ts`

**Afhankelijkheden**: WP-402

**Acceptatiecriteria**:
- Panel opent via `Cmd+K` op elke pagina
- Antwoord bevat altijd minimaal één citation met link
- Contextuele suggesties zijn relevant voor de huidige pagina (niet generiek)
- Foutmelding is informatief wanneer Latero onvoldoende data heeft om te antwoorden

**Omvang**: M

---

### WP-404 — Geavanceerde Policy Rule Types

**Wat**: nieuwe rule-types toevoegen aan de Policy Engine (WP-301) voor statistische en temporele condities.

**Scope**:
- `web/src/lib/policy-engine.ts` uitbreiden met:
  - `statistical_drift` — Z-score afwijking > drempel op volume of null-rate
  - `volume_anomaly` — run-volume > X% afwijking van 30-daags gemiddelde
  - `consumer_inactivity` — geen consumer-activiteit gedurende N dagen (WP-205)
  - `evidence_gap` — verplicht evidence-type ontbreekt in de afgelopen N dagen (WP-303)
  - `temporal_coverage` — evidence-ledger heeft gaten in een vereist datumbereik
- Policy-editor (WP-302) uitbreiden met de nieuwe rule-types als selecteerbare opties

**Afhankelijkheden**: WP-301, WP-205, WP-303

**Acceptatiecriteria**:
- Statistische drift-policy detecteert volume-anomalie in testdata
- Evidence-gap policy faalt voor producten met ontbrekende quality-check records
- Alle nieuwe rule-types zijn selecteerbaar in de policy-editor zonder code-wijziging

**Omvang**: M

---

### WP-405 — Policy Pack Fixtures

**Wat**: drie kant-en-klare policy packs als JSON-fixtures, ingeladen bij bootstrap.

**Scope**:
- `infra/sql/init/036_policy_pack_fixtures.sql` — inserts voor drie packs en hun policies:
  - **ESG/CSRD pack**: verplichte lineage coverage ≥ 90% voor ESG-gerelateerde producten, evidence completeness, owner verplicht
  - **BCBS-239 pack**: data lineage traceability, kwaliteitsdrempels, eigenaarsmandaat, wijzigingslog verplicht
  - **Data Mesh Governance pack**: domein-eigenaarschap verplicht, consumer-registratie verplicht, cross-domain lineage gedocumenteerd
- Fixture-data is idempotent: `INSERT ... ON CONFLICT DO NOTHING`
- Documentatie per pack: korte beschrijving van welke compliancevereiste het adresseert

**Afhankelijkheden**: WP-301, WP-404

**Acceptatiecriteria**:
- Na bootstrap zijn de drie packs zichtbaar in de policy library
- Elke pack bevat minimaal 3 actieve policies
- Fixtures breken niet bij herhaalde bootstrap (idempotent)

**Omvang**: S

---

## Overzichtstabel

| WP | Naam | Fase | Omvang | Afhankelijk van |
|---|---|---|---|---|
| WP-101 | Temporele Metadata Fundament | 1 | M | — |
| WP-102 | Product Registry: API | 1 | S | WP-101 |
| WP-103 | Product Registry: UI | 1 | M | WP-102 |
| WP-104 | Trust Score: Engine | 1 | M | WP-101, WP-102 |
| WP-105 | Trust Score: UI | 1 | S | WP-104, WP-103 |
| WP-106 | Incident Management: API | 1 | M | WP-102 |
| WP-107 | Incident Management: UI | 1 | M | WP-106, WP-103 |
| WP-108 | Alert Intelligence | 1 | L | WP-106 |
| WP-201 | Business Impact Graph: API | 2 | M | WP-102 |
| WP-202 | Business Impact Graph: UI | 2 | M | WP-201 |
| WP-203 | Change Intelligence: Engine | 2 | L | WP-101, WP-102 |
| WP-204 | Change Intelligence: UI | 2 | M | WP-203, WP-107 |
| WP-205 | Demand-Side: API | 2 | M | WP-102 |
| WP-206 | Demand-Side: UI | 2 | S | WP-205, WP-103, WP-104 |
| WP-207 | Business Glossary: API | 2 | M | WP-101 |
| WP-208 | Business Glossary: UI | 2 | M | WP-207 |
| WP-301 | Policy Engine: API | 3 | L | WP-102 |
| WP-302 | Policy Engine: UI | 3 | M | WP-301 |
| WP-303 | Evidence Ledger: API | 3 | L | WP-102, WP-301 |
| WP-304 | Evidence Ledger: UI | 3 | M | WP-303 |
| WP-305 | Cost & ROI: API | 3 | M | WP-205, WP-102 |
| WP-306 | Cost & ROI: UI | 3 | M | WP-305, WP-103 |
| WP-307 | Operating Model Dashboards | 3 | M | alle Fase 1–3 |
| WP-401 | Temporal Time-Travel: UI | 4 | M | WP-101, WP-103, WP-302, WP-304 |
| WP-402 | Metadata Query Layer | 4 | XL | alle vorige |
| WP-403 | Grounded Copilot: UI | 4 | M | WP-402 |
| WP-404 | Geavanceerde Policy Rule Types | 4 | M | WP-301, WP-205, WP-303 |
| WP-405 | Policy Pack Fixtures | 4 | S | WP-301, WP-404 |

**Omvang**: S = 1–2 dagen · M = 3–5 dagen · L = 6–10 dagen · XL = 2–3 weken
