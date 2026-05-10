-- Latero Control bootstrap schema (LADR-041: event-tabellen verwijderd)
-- Executed automatically by Postgres image on first container initialization.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS insights_installations (
  installation_id TEXT PRIMARY KEY,
  label           TEXT,
  environment     TEXT NOT NULL,
  tier            TEXT NOT NULL DEFAULT 'pro',
  contact_email   TEXT,
  token_hash      TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingest_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  installation_id TEXT,
  status_code INTEGER NOT NULL,
  request_body JSONB,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
