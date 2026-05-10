# LADR-069 — Schema Maintenance: init-scripts niet automatisch toegepast op bestaande databases

**Datum:** 2026-05-10
**Status:** ACCEPTED
**Auteur:** Leen van der Meer

---

## Context

De docker-compose bestanden (`docker-compose.prod.yml`, `docker-compose.local.yml`) monteren
alleen `infra/sql/schema.sql` als PostgreSQL init-script:

```yaml
volumes:
  - ../sql/schema.sql:/docker-entrypoint-initdb.d/000_schema.sql:ro
```

De losse migratie-scripts in `infra/sql/init/` worden **niet automatisch uitgevoerd**. Ze zijn
bedoeld als handmatige delta-migraties voor bestaande databases, maar er was geen
mechanisme dat operators hiervan op de hoogte stelde. Tegelijkertijd is `schema.sql` nooit
bijgewerkt met de kolommen die via de init-scripts werden toegevoegd.

Dit leidde tot een productiestoring waarbij drie kritieke structurele wijzigingen ontbraken:

| Script | Ontbrekend | Impact |
|--------|-----------|--------|
| `020_dataset_entity_split.sql` | `source_kind`, `target_kind` op `meta.lineage_edges` | Alle lineage ingest mislukt (column does not exist) → lineage-pagina leeg |
| `039_data_product_sla_tier.sql` | `sla_tier` op `meta.data_products` | Alle data product API-routes geven 500 |
| `040_drop_lineage_self_loop_constraint.sql` | Verwijdering `lineage_no_self_loop` constraint | Blockt lineage ingest voor Databricks-data met layer='unknown' |

Aanvullend ontbrak in `schema.sql` de `dataset_name` generated column (init/020), de
NOT-NULL/CHECK aanscherping op `meta.entity_sources.source_layer`, en de UUID primary key
structuur van `meta.entity_sources`.

---

## Beslissing

### 1. schema.sql bijgewerkt tot volledig canoniek schema

`infra/sql/schema.sql` bevat nu alle kolommen en constraints, inclusief:

- `meta.datasets.dataset_name` — generated column `split_part(dataset_id, '::', 1)`
- `meta.lineage_edges.source_kind` / `target_kind` — CHECK (`dataset` | `entity`), DEFAULT `dataset`
- `meta.lineage_edges` — **zonder** `lineage_no_self_loop` constraint
- `meta.data_products.sla_tier` — CHECK (`bronze` | `silver` | `gold`)
- `meta.entity_sources` — UUID primary key, `source_layer NOT NULL` + CHECK (`bronze` | `silver`)

### 2. Consolidatie-migratie voor bestaande databases

`infra/sql/init/041_schema_gaps.sql` bevat een idempotente migratie die alle bovenstaande
wijzigingen toepast op bestaande databases. Dit script is veilig om meerdere keren uit te
voeren.

**Uitvoeren op productie:**

```bash
# Via docker exec op de productieserver
docker exec -i insights-postgres \
  psql -U insights -d insights < infra/sql/init/041_schema_gaps.sql

# Of via DATABASE_URL
psql "$DATABASE_URL" -f infra/sql/init/041_schema_gaps.sql
```

### 3. Toekomstig migratiebeheer

Voor elke toekomstige schema-wijziging gelden twee verplichte stappen:

1. **schema.sql bijwerken** — zodat nieuwe installaties direct het volledige schema krijgen
2. **init-script aanmaken** — idempotent, met `IF NOT EXISTS` / `IF EXISTS` guards,
   zodat bestaande databases kunnen meegroeien

Er wordt **geen automatische migratie-runner** geïntroduceerd (geen Flyway, Liquibase e.d.).
De expliciete migratie via `psql` past bij de single-tenant deployment filosofie.

---

## Consequenties

- **Positief:** Productie kan hersteld worden met één script-run.
- **Positief:** `schema.sql` is weer de single source of truth voor nieuwe installaties.
- **Positief:** Lineage ingest werkt na migratie direct; entity_sources wordt backfilled.
- **Negatief:** Operators moeten bij elke deployment controleren of nieuwe init-scripts
  aanwezig zijn en deze handmatig toepassen. Dit blijft een manueel proces.
- **Risico:** Als een toekomstige developer vergeet `schema.sql` bij te werken,
  ontstaat dit probleem opnieuw.

---

## Dataset-count discrepantie (9 vs 18)

Het verschil in dataset-aantallen tussen lokaal en productie is een **data-kwaliteitskwestie**,
geen code-bug. De `/api/datasets` route filtert op `layer IN ('landing', 'raw', 'bronze')`.
De `/api/lineage/entities` route toont datasets die minstens één lineage-edge hebben.
Omdat productie geen lineage-edges kon schrijven (door de ontbrekende kolommen), was de
lineage-entiteiten-view leeg. Na migratie 041 wordt de entity_sources tabel backfilled
vanuit bestaande lineage_edges, mits die aanwezig zijn.

Als na migratie het aantal nog verschilt, betreft dit daadwerkelijke data-inhoudsverschillen
(meer of minder pipeline-runs ingested), niet een structureel schema-probleem.
