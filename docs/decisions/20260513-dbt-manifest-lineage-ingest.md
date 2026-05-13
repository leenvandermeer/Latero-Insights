# LADR-080 — DBT manifest ingest: kolom-lineage uit manifest.json

**Datum:** 2026-05-13  
**Status:** ACCEPTED

## Context

Operators die DBT gebruiken moeten nu handmatig een YAML-bestand bijhouden om kolom-niveau lineage in Latero Control te krijgen. Dit YAML-bestand is een dubbele bron van waarheid ten opzichte van de DBT-modellen en is foutgevoelig: kolommen die in DBT veranderen worden niet automatisch gereflecteerd.

DBT genereert bij elke `dbt compile` of `dbt run` een `manifest.json` die (vanaf DBT 1.6 met de column-level lineage feature) kolom-niveau lineage bevat in `nodes[*].depends_on.columns`.

## Beslissing

Een nieuw push-ingest endpoint `POST /api/v1/dbt/manifest` accepteert de volledige DBT `manifest.json` payload. De parser:

1. Itereert over alle `nodes` van type `model`.
2. Voor elk model dat `depends_on.columns` bevat (DBT 1.6+), schrijft hij per kolom-flow een rij via `writeMetaColumnLineage`.
3. Layer-detectie: het veld `config.schema` (of `schema`) van het node wordt genormaliseerd naar de standaard pipeline-laag (landing/raw/bronze/silver/gold).
4. Voor upstream nodes wordt hetzelfde schema-veld gebruikt als source-layer.
5. `transformation_type` wordt altijd `"DIRECT"` (DBT computed columns zijn directe transformaties).

Nodes zonder `depends_on.columns` worden genegeerd — het endpoint is non-destructief en kan meerdere keren worden aangeroepen (upsert).

## Gevolgen

- Geen schema-wijziging nodig: `meta.lineage_columns` bestaat al.
- Operators kunnen het endpoint aanroepen vanuit CI/CD na `dbt compile`.
- Handmatig YAML onderhoud is niet meer nodig voor DBT-modellen.
- Niet-DBT pipelines blijven via `/api/v1/lineage` insturen.
- De twee bronnen vullen elkaar aan in dezelfde tabel.
