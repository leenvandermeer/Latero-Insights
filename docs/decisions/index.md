# Latero Control ADR Index

Naming note:

- newer documentation uses **Latero Control**
- older ADR titles may still use **Layer2 Meta Insights**
- treat those as legacy product naming, not separate products

| ID | Datum | Titel | Status |
| --- | --- | --- | --- |
| [LADR-003](20260417-insights-product.md) | 2026-04-17 | Layer2 Meta Insights: standalone web frontend for metadata visualization | ACCEPTED |
| [LADR-004](20260418-runtime-settings.md) | 2026-04-18 | Runtime settings store and editable configuration UI | ACCEPTED |
| [LADR-005](20260418-cache-only-demo-mode.md) | 2026-04-18 | Cache-only operating mode and demo seed data | ACCEPTED |
| [LADR-006](20260418-insights-theme-architecture.md) | 2026-04-18 | Insights theme architecture: data-theme as single source of truth | ACCEPTED |
| [LADR-007](20260418-dashboard-builder-model.md) | 2026-04-18 | Dashboard Builder: unified model for all views | ACCEPTED |
| [LADR-008](20260418-dashboard-builder-implementation.md) | 2026-04-18 | Dashboard Builder: implementation decisions (widget system, store, QueryEngine, migration) | ACCEPTED |
| [LADR-009](20260419-widget-library-navigation-and-drag.md) | 2026-04-19 | Dashboard Builder: widget library in sidebar navigation and drag-to-canvas placement | PARTIALLY SUPERSEDED |
| [LADR-010](20260419-dashboard-ux-cta-and-placement.md) | 2026-04-19 | Dashboard Builder: canvas CTA pattern, dashboard title switcher, and smart widget placement | ACCEPTED |
| [LADR-011](20260419-remove-static-dashboards.md) | 2026-04-19 | Remove static dashboard views; all routes serve the dashboard builder | ACCEPTED |
| [LADR-012](20260419-shared-widget-library.md) | 2026-04-19 | Shared widget library: three-tier model and server-side JSON persistence | ACCEPTED |
| [LADR-013](20260420-adaptive-nav-breakpoint.md) | 2026-04-20 | Adaptive navigation breakpoints: sidebar expanded threshold raised to 1280px | ACCEPTED |
| [LADR-014](20260420-grid-container-width.md) | 2026-04-20 | Grid container width: custom ResizeObserver in plaats van useContainerWidth | ACCEPTED |
| [LADR-015](20260420-lineage-entity-model-redesign.md) | 2026-04-20 | Lineage Explorer: nieuw entiteitsmodel en drie-perspectief UX | ACCEPTED |
| [LADR-016](20260422-progressive-disclosure-dashboard-ux.md) | 2026-04-22 | Progressive Disclosure as Dashboard UX Baseline | ACCEPTED |
| [LADR-017](20260422-lineage-dataset-titling-and-openlineage-job-label.md) | 2026-04-22 | Dataset-first titling in Lineage and job-name-first labels in OpenLineage | ACCEPTED |
| [LADR-018](20260422-widget-builder-json-configuration-mode.md) | 2026-04-22 | Widget Builder JSON configuration mode for advanced users | ACCEPTED |
| [LADR-019](20260422-dashboard-in-place-custom-widget-editing.md) | 2026-04-22 | In-place custom widget editing from dashboard settings | ACCEPTED |
| [LADR-020](20260424-widget-registry-rationalization.md) | 2026-04-24 | Widget registry rationalization: verwijderen van redundante counter widgets | ACCEPTED |
| [LADR-021](20260424-widget-scalability-improvements.md) | 2026-04-24 | Widget scalability: paginering, configureerbare drempel en failing datasets ranking | ACCEPTED |
| [LADR-022](20260424-lineage-graph-entity-labels-and-dataset-focus.md) | 2026-04-24 | Lineage graph: layer-aware entity labels, dataset focus filter en virtual file node deduplicatie | ACCEPTED |
| [LADR-023](20260424-mdcf-widget-field-values-table.md) | 2026-04-24 | MDCF `widget_field_values` tabel: specificatie en integratie met widget builder | ACCEPTED |
| [LADR-024](20260424-widget-generator-first-architecture.md) | 2026-04-24 | Widget generator-first architectuur: geen out-of-the-box widgets, alles via shared library | PARTIALLY SUPERSEDED (LADR-068) |
| [LADR-025](20260424-insights-saas-ingest-backend.md) | 2026-04-24 | Insights SaaS ingest backend in Next.js with Postgres bootstrap | ACCEPTED |
| [LADR-026](20260424-postgres-as-single-read-store.md) | 2026-04-24 | Postgres als enige read-store voor webapp API routes | ACCEPTED |
| [LADR-027](20260425-installation-aware-ux.md) | 2026-04-25 | Installation-aware UX: multi-tenancy groundwork (stap 1 & 2) | ACCEPTED |
| [LADR-028](20260425-admin-dashboard-architecture.md) | 2026-04-25 | Admin Dashboard: installation and multi-tenant lifecycle management | ACCEPTED |
| [LADR-029](20260425-tenant-data-isolation-security-hardening.md) | 2026-04-25 | Tenant Data Isolation Security Hardening: LINS-016 enforcement (shared widgets, personal dashboards, API routes) | ACCEPTED |
| [LADR-030](20260501-installation-scoped-adapter-settings.md) | 2026-05-01 | Installation-scoped DatabricksAdapter settings resolution | ACCEPTED |
| [LADR-031](20260501-slim-page-header-pattern.md) | 2026-05-01 | Slim page header pattern voor alle dashboard-pagina's | ACCEPTED |
| [LADR-032](20260503-uniform-source-indicator.md) | 2026-05-03 | Uniforme data-statusindicator op alle dashboard-pagina's | ACCEPTED |
| [LADR-033](20260503-global-form-baseline.md) | 2026-05-03 | Globale form-element baseline styling | ACCEPTED |
| [LADR-034](20260503-sso-hybrid-auth-architecture.md) | 2026-05-03 | SSO-first hybrid authentication with installation-scoped policy | ACCEPTED |
| [LADR-035](20260503-keycloak-as-local-dev-idp.md) | 2026-05-03 | Keycloak als lokale dev-IdP voor SSO-testomgeving | ACCEPTED |
| [LADR-036](20260503-totp-2fa-local-accounts.md) | 2026-05-03 | TOTP 2FA voor lokale accounts (break-glass) | ACCEPTED |
| [LADR-037](20260503-admin-login-entrypoint.md) | 2026-05-03 | Separate login entrypoint voor platform operators (/admin/login) | ACCEPTED |
| [LADR-038](20260503-installation-switcher-env-default.md) | 2026-05-03 | Installation switcher: environment indicator en default-installatie | ACCEPTED |
| [LADR-039](20260503-admin-tenant-layout-css-isolation.md) | 2026-05-03 | Admin/Tenant layout- en CSS-isolatie via Next.js route group root layouts | ACCEPTED |
| [LADR-040](20260504-meta-schema-datamodel.md) | 2026-05-04 | meta.* schema: gestructureerd operationeel datamodel (OpenLineage-gebaseerd) | ACCEPTED |
| [LADR-041](20260504-drop-public-event-tables.md) | 2026-05-04 | Drop public.\* event-tabellen na volledige migratie naar meta.\* | ACCEPTED |
| [LADR-058](20260504-lineage-layer-scoped-entity-model.md) | 2026-05-04 | Lineage layer-scoped entity model: dataset_id als {entity}::{layer} compound key | ACCEPTED |
| [LADR-059](LADR-059-20260504-v2-run-centric-observability.md) | 2026-05-04 | V2: Run als primaire observability-anchor (run detail, I/O, DQ context) | PROPOSED |
| [LADR-060](LADR-060-20260504-v2-data-product-hierarchy.md) | 2026-05-04 | V2: Data Product / Entity / Dataset hiërarchie — drietal voor status-aggregatie | PROPOSED |
| [LADR-061](LADR-061-20260504-v2-navigation-and-routing.md) | 2026-05-04 | V2: Navigation en routing herstructurering — drill-down model en nieuwe routes | PROPOSED |
| [LADR-062](LADR-062-20260504-v2-openlineage-compliance.md) | 2026-05-04 | V2: OpenLineage Event Model als primair ingest-formaat (facets, Marquez compat) | PROPOSED |
| [LADR-063](20260504-datasets-explorer.md) | 2026-05-04 | Datasets Explorer: zichtbaarheid voor alle pipeline-lagen in Explore | ACCEPTED |
| [LADR-064](20260506-dataset-vs-entity-split.md) | 2026-05-06 | Dataset vs Entity: conceptuele scheiding, `dataset_name`, `entity_name`, `meta.entity_sources` bridge-tabel en 1-to-many support | PROPOSED |
| [LADR-065](20260507-catalog-hub-data-product-crud.md) | 2026-05-07 | Catalog Hub: data product CRUD, tab-navigatie (Entities / Datasets), navigatiereductie EXPLORE 4→2 | ACCEPTED |
| [LADR-066](20260507-lineage-entity-focus-and-cross-chain-upstream.md) | 2026-05-07 | Lineage: entiteit-centrische focus selector en cross-chain upstream zichtbaarheid bij viewpoint-trace | ACCEPTED |
| [LADR-067](20260508-lineage-map-vs-trace-ux.md) | 2026-05-08 | Lineage UX split: Map for topology, Trace for investigation | PROPOSED |
| [LADR-068](20260508-dashboard-ux-overhaul.md) | 2026-05-08 | Dashboard Navigation & Widget UX Overhaul: OOTB widgets, sidebar nav, pinning, simplified home | ACCEPTED |
| [LADR-069](20260510-schema-maintenance-gap-fix.md) | 2026-05-10 | Schema Maintenance: init-scripts niet automatisch toegepast — source_kind/target_kind, sla_tier, entity_sources fix | ACCEPTED |
| [LADR-070](20260510-environment-id-mismatch-fix.md) | 2026-05-10 | Environment-ID mismatch: latero.yml environment vs Control databricksEnvironment — sync gaf 0 rijen door onjuist environment-label | ACCEPTED |
| [LADR-071](20260510-schema-migration-tracking.md) | 2026-05-10 | Schema Migration Tracking: schema_migrations tabel, eenmalige uitvoering, fatale fouten — vervangt idempotent-alles aanpak | ACCEPTED |
| [LADR-072](20260511-dashboard-time-range-semantics.md) | 2026-05-11 | Dashboard time-range semantics: expliciet onderscheid tussen snapshot metrics en selected-period metrics | PROPOSED |
| [LADR-073](20260511-keycloak-admin-exposure-without-new-subdomain.md) | 2026-05-11 | Keycloak admin exposure hardening without introducing a new public subdomain | PROPOSED |
| [LADR-074](20260511-lineage-default-map-and-advanced-trace.md) | 2026-05-11 | Lineage default map with preserved advanced trace | PROPOSED |
| [LADR-075](20260511-lineage-ux-hardening.md) | 2026-05-11 | Lineage Explorer UX hardening: naamgeving, inline controls, tab-pariteit, verwijdering graph-view.tsx | ACCEPTED |
| [LADR-076](20260511-catalog-products-separation.md) | 2026-05-11 | Catalog/Products separation: één eigenaar per domein — Data Products tab verwijderd uit Catalog | ACCEPTED |
| [LADR-077](20260512-drift-detection-wiring.md) | 2026-05-12 | Drift detection wiring: detectSchemaDrift fix + detectLineageDrift + fire-and-forget integratie in meta-ingest | ACCEPTED |
| [LADR-078](20260512-session-cookie-maxage-alignment.md) | 2026-05-12 | Session cookie maxAge: browser-TTL uitgelijnd met server-TTL — mobiel sessiebeheer gecorrigeerd | ACCEPTED |
| [LADR-079](LADR-079-20260513-stable-entity-guid.md) | 2026-05-13 | Stable Entity GUID for URL-Safe Identification: LINS-021 compliance (no fuzzy matching) | PROPOSED |
| [LADR-080](LADR-080-20260514-cdc-counts-and-temporal-lineage.md) | 2026-05-14 | CDC row counts op meta.runs + SCD2 temporal lineage (time-travel via ?as_of=) | ACCEPTED |
| [LADR-081](LADR-081-20260516-migrate-lineage-attrs-to-scd2-source.md) | 2026-05-16 | Lineage attribute queries migreren van projected table naar SCD2 bron (lineage_attribute) | ACCEPTED |
| [LADR-082](LADR-082-20260517-admin-guard-write-endpoints.md) | 2026-05-17 | Admin guard on infrastructure write endpoints — checkIsAdmin required on sync, cache, settings, test-connection | ACCEPTED |
