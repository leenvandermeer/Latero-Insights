-- LADR-041: Drop public.* event-tabellen na volledige migratie naar meta.*
-- De applicatie schrijft en leest uitsluitend via meta.* (zie LADR-040 fase 3).
-- CASCADE verwijdert eventuele afhankelijke objecten mee.

DROP TABLE IF EXISTS public.pipeline_runs CASCADE;
DROP TABLE IF EXISTS public.data_quality_checks CASCADE;
DROP TABLE IF EXISTS public.data_lineage CASCADE;
