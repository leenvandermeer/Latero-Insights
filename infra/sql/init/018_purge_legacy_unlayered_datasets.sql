-- LADR-058 follow-up: purge legacy pre-migration dataset rows
-- Na de 016-migratie (TRUNCATE + layer-scoped re-sync) kunnen toch legacy rijen
-- zonder layer binnenkomen als de Latero runtime een dataset registreert vóór
-- de eerste layer-scoped run. Deze rijen hebben layer IS NULL en een bare dataset_id
-- zonder '::' separator — ze zijn geen geldige medallion-laag entries.
--
-- Effect: rijen zonder layer zijn onzichtbaar in de UI (API filtert op layer IN (...))
-- maar vervuilen de dataset-catalog en kunnen FK-constraintfouten maskeren.

DELETE FROM meta.datasets
WHERE layer IS NULL
  AND dataset_id NOT LIKE '%::%';
