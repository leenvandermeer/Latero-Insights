# LADR-071 — Schema Migration Tracking: schema_migrations tabel en eenmalige uitvoering

**Datum:** 2026-05-10  
**Status:** ACCEPTED

---

## Context

De deploy-script (`infra/scripts/deploy.sh`) draaide alle SQL-scripts in `infra/sql/init/`
bij elke deploy opnieuw. Omdat scripts idempotent moesten zijn, gold `ON_ERROR_STOP=0` —
fouten werden stilzwijgend genegeerd. Dit veroorzaakte drie structurele problemen:

1. **Drift onzichtbaar.** Een script dat faalde (bijv. door een verwijderd kolom) gaf
   geen signaal; de deploy leek succesvol.

2. **Bootstrap-scripts met dode afhankelijkheden.** `017_v2_data_model.sql` step 7
   bootstrapt data products vanuit `group_id`, maar dat kolom is verwijderd door
   `022_natural_dataset_id.sql`. Op fresh installaties werd stap 7 stil overgeslagen,
   waardoor entities nooit een data product kregen en `/products` leeg bleef.

3. **Omgevingen liepen uiteen.** Productie draaide progressief door elke migratie;
   localhost startte met een gecombineerde schema.sql en miste de state van
   tussenliggende bootstrap-stappen. Zelfde code, andere data.

### Aanleiding

Tijdens een debugging-sessie (2026-05-10) bleek dat `/products` op localhost 0 producten
toonde terwijl productie er 34 had. Root cause: `017` step 7 werkte nooit op fresh
installaties. Tegelijk bleek dat meerdere eerdere fouten in init-scripts onopgemerkt
waren gebleven door `ON_ERROR_STOP=0`.

---

## Beslissing

### 1. `schema_migrations` tracking-tabel (`000_schema_migrations.sql`)

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT        PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Dit is altijd het eerste script dat draait, idempotent.

### 2. Deploy-script: skip al-toegepaste scripts

```bash
already_applied=$(docker exec "${PG_CONTAINER}" \
  psql -U "${PG_USER}" -d "${PG_DB}" -tAq \
  -c "SELECT 1 FROM schema_migrations WHERE filename = '${filename}' LIMIT 1;")

if [[ "${already_applied}" == "1" ]]; then
  echo "   –  ${filename} (al toegepast, overgeslagen)"
  continue
fi
```

Na succesvolle uitvoering wordt het script geregistreerd:
```bash
INSERT INTO schema_migrations (filename) VALUES ('${filename}') ON CONFLICT DO NOTHING;
```

Faalt een script → deploy stopt met exitcode 1 (`ON_ERROR_STOP=1`).

### 3. `backfill-migrations.sh` voor bestaande databases

Eenmalig uitvoeren op databases die al bestonden vóór de invoering van tracking.
Markeert alle scripts als applied zonder ze opnieuw te draaien.

```bash
bash infra/scripts/backfill-migrations.sh [pg-container-name]
# Standaard: insights-local-postgres
# Productie:  insights-postgres
```

### 4. `043_bootstrap_products_from_entities.sql`

Herstelt het gat dat door het `group_id`-probleem in `017` ontstond: maakt data products
voor alle entities die er nog geen hebben.

---

## Gevolgen

### Positief

- **Elk script draait exact één keer.** Nieuwe scripts hoeven in principe niet meer
  idempotent te zijn, al is het nog steeds een goede gewoonte.
- **Fouten zijn fataal.** `ON_ERROR_STOP=1` + exitcode 1 bij failure → defecte
  migrations bereiken productie niet meer.
- **Volledige audittrail.** `SELECT * FROM schema_migrations ORDER BY applied_at`
  geeft exact aan wat wanneer is uitgevoerd op elke database.
- **Omgevingen blijven in sync.** Nieuwe scripts worden precies één keer per database
  uitgevoerd, ongeacht hoe vaak de deploy draait.

### Werkwijze voor nieuwe SQL-wijzigingen

1. Maak `NNN_beschrijving.sql` aan in `infra/sql/init/` met een oplopend nummer.
2. Het script draait eenmalig → geen `IF NOT EXISTS` of `ON CONFLICT` verplicht
   (wel aanbevolen voor veiligheid).
3. Houd `infra/sql/schema.sql` bij als canon voor fresh installaties.
4. Commit, push, deploy — het script wordt geregistreerd en nooit meer herhaald.

### Bestaande databases

Eenmalig `backfill-migrations.sh` uitvoeren. Na de backfill gedraagt de database
zich identiek aan een fresh install die alle scripts heeft doorlopen.

---

## Alternatieven overwogen

| Alternatief | Reden afgewezen |
|---|---|
| Flyway / Liquibase | Extra runtime-dependency, Java vereist, overkill voor dit project |
| golang-migrate | Aparte binary, complexere CI-integratie |
| node-pg-migrate | npm-dependency, koppelt migrations aan app-startup |
| Alles idempotent houden | Al bewezen onhoudbaar: stille fouten, dode code, omgevingsdrift |

De gekozen aanpak volgt hetzelfde principe als Rails/Django maar zonder externe
dependencies — alleen bash en psql, die al aanwezig zijn in de deploy-omgeving.
