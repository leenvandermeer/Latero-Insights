# Latero Meta Data Control Framework — positionering

## Latero in één zin

Latero is een platformonafhankelijk metadata control framework dat datapipelines voorziet van een policy-gedreven DQ-engine, een event-sourced audit trail en OpenLineage-compatibele lineage-registratie — als ingebouwde eigenschap van elke pipeline-uitvoering, niet als naderhand toe te voegen laag.

---

## Doelgroep

**Data engineers** — de primaire implementerende doelgroep. Latero integreert in elke pipeline-notebook of -taak via een gestandaardiseerde initialisatievolgorde en een kleine set Python-functies. De check library biedt ~35 kant-en-klare DQ-checks voor PySpark DataFrames, bestanden en scalaire waarden.

**Data architects** — Latero definieert een platformonafhankelijk runtime contract en adapter-interface. Architecten bepalen welke adapter (Databricks, Snowflake) van toepassing is en hoe het check-beleid is gestructureerd. De architecturale grens tussen Latero kern, adapters en consumer-configuratie is scherp en normatief gedocumenteerd.

**CDOs en data managers** — Latero produceert per pipeline-uitvoering aantoonbaar bewijs van datakwaliteitscontrole. Dat bewijs is auditeerbaar, herhaalbaar en raadpleegbaar zonder dat operators actief logging hoeven te implementeren. Het framework ondersteunt BCBS239-compliancebehoeften en aanverwante regulatoire frameworks.

---

## Marktpositie

### t.o.v. dbt

dbt is een transformatietool met een ingebouwde testrunner. dbt-tests evalueren SQL-logica op tabelniveau en produceren `run_results.json`. Latero is geen vervanging voor dbt — het is een complementaire controlelaag. Latero kan dbt-testresultaten inlezen via `ingest_run_results()` en ze opnemen in de centrale meta-tabel `meta.data_quality_checks`. Waar dbt de transformatielaag bewaakt, bewaakt Latero de volledige pipeline-uitvoering inclusief file-checks, schema-drift, referentiële integriteit en lineage.

### t.o.v. Great Expectations en Soda Core

Great Expectations en Soda Core zijn check-frameworks: ze bieden een rijke DSL voor het definiëren van data-verwachtingen en rapporteren resultaten in hun eigen formaten. Ze hebben geen ingebouwde policy-engine die onderscheid maakt tussen blokkerend en niet-blokkerend gedrag per check. Latero heeft dat onderscheid als kern: `enforce` vs. `observe` is configuratie, niet code. Bovendien schrijft Latero check-resultaten naar een eigen meta-tabel met uniform schema — geen externe opslagprovider of cloud-afhankelijkheid vereist.

### t.o.v. Monte Carlo

Monte Carlo is een observability-platform: het monitort datakwaliteit na productie op basis van statistische modellen. Het is sterk in anomaly detection maar zwak in pipeline-niveau afdwinging. Latero opereert tijdens de pipeline-uitvoering: een mislukte enforce-check stopt de pipeline vóór slechte data downstream terechtkomt. De twee tools zijn complementair: Latero bewaakt de productie, Monte Carlo bewaakt het resultaat.

### Kernproposities

| Propositie | Wat het betekent |
|------------|----------------|
| **Policy-first DQ** | Kwaliteitsbeleid staat in configuratie, niet in code. Enforce vs. observe is een bestuurlijke keuze, geen technische implementatiedetail. |
| **Event-sourced audit trail** | Elke pipeline-uitvoering levert gestructureerde records in drie meta-tabellen. Het bewijs bestaat als bijproduct, niet als inspanning. |
| **OpenLineage-compatibel** | Lineage-records zijn exporteerbaar als OpenLineage RunEvents (spec v1.0.5). Compatibel met Marquez, Atlan, DataHub zonder maatwerk. |
| **Platformonafhankelijke kern** | De policy engine en het runtime contract werken identiek op Databricks en Snowflake. Adapters zijn wisselbaar zonder aanpassing van pipelines. |
| **Volledige DQ-status taxonomie** | Vijf check statussen (PASS, FAIL, WARN, ERROR, SKIPPED) en negen check-categorieën geven volledige context aan elk check-resultaat. |
| **SaaS-ready control-plane koppeling** | Databricks/Snowflake pipelines kunnen metadata-events rechtstreeks naar Latero Insights SaaS sturen via configureerbare adapters (endpoint + token), terwijl lokale metatabellen optioneel compatibel blijven. |

### Propositie-update April 2026

Latero positioneert niet langer alleen als runtime-control in de pipeline, maar ook als
de standaard eventbron voor één integraal SaaS-product met Latero Insights.

Concreet betekent dit:

- Latero runtime blijft product-onafhankelijk en policy-first.
- Integratie met Insights verloopt via adapterconfiguratie in plaats van maatwerkcode.
- Teams kunnen gefaseerd werken: dual-write (lokaal + SaaS) of SaaS-first.
- Auditability blijft leidend: dezelfde run- en DQ-semantiek, ongeacht opslagdoel.

---

## Versie 1.0: wat dit betekent voor productierijpheid

Latero v1.0.0 markeert de eerste release met een expliciete API-stabiliteitsgaantie. Alle symbolen in `latero.__all__` zijn stabiel voor de gehele v1.x-levenscyclus: patch releases voegen toe, ze verwijderen niet.

Drie technische gaten die productierijpheid in 0.x verhinderden zijn gedicht:

1. **Volledige DQ-statusdekking** — `WARN`, `ERROR` en `SKIPPED` zijn eerste-klas waarden in de policy engine, niet workarounds.
2. **Check-categorisatie** — `check_category` maakt Latero DQ-output vergelijkbaar met industriestandaard rapportage-taxonomieën.
3. **OpenLineage-compatibiliteit** — lineage is exporteerbaar zonder externe afhankelijkheden.

v1.0 is geschikt voor productieonboarding van nieuwe consumers. Bestaande 0.x consumers kunnen upgraden; de API-grens is backwards-compatible voor alle bestaande callers.

---

## Roadmap richting

**v1.x (patch en minor releases)**
- Automatische HTTP-emissie van OpenLineage events (optionele transport-laag, geen verplichte afhankelijkheid)
- Category-gebaseerd beleid: alle `schema`-checks enforce, alle `statistical`-checks observe — zonder individuele check-configuratie
- PyPI-publicatie voor installeerbaar pakket
- Uitgebreide check library: tijdreeks-checks, cross-dataset referentie, SLA-matrix

**v2.0 (toekomstige major release)**
- Multi-platform orchestratie: één policy geldig op Databricks en Snowflake gelijktijdig
- Beheerinterface: UI voor inzicht in check-coverage, beleidsstatus en audit trail zonder SQL
- Alerting-integratie: native notificaties op FAIL en WARN events via Slack, Teams, PagerDuty
- Uitgebreid adapter-model: BigQuery, Azure Synapse, DuckDB

---

## Navigatie

| Document | Inhoud |
|----------|--------|
| [Architectuur](architectuur.md) | De drie lagen, meta-tabellen, OpenLineage |
| [Configuratiemodel](configuratie-model.md) | Runtime contract, check_policy, adapter profiles |
| [Vereisten](vereisten.md) | Normatieve requirements |
| [Aan de slag](../implementatie/aan-de-slag.md) | Integratie-instructies voor een nieuw project |
| [Checks gebruiken](../implementatie/checks-gebruiken.md) | DQ check lifecycle en statussen |
| [OpenLineage how-to](../implementatie/lineage-openlineage.md) | Lineage exporteren |
| [Demo-overzicht](../demo/overzicht.md) | De ESG demo uitgelegd |

