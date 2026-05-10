-- Migration tracking table.
-- Altijd het eerste script dat draait. Idempotent.
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT        PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
