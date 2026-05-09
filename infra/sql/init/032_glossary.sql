-- LADR-071 / WP-207: Business Glossary — data model
-- Glossarium-termen met temporele versioning + koppeling aan datasets.

CREATE TABLE IF NOT EXISTS meta.glossary_terms (
  id              TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  name            TEXT        NOT NULL,
  definition      TEXT        NOT NULL,
  owner_team      TEXT,
  -- Temporele versioning conform WP-101
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to        TIMESTAMPTZ,
  PRIMARY KEY (installation_id, id, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_glossary_terms_current
  ON meta.glossary_terms (installation_id, id) WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_glossary_terms_name
  ON meta.glossary_terms (installation_id, lower(name)) WHERE valid_to IS NULL;

-- ---------------------------------------------------------------------------
-- Koppeling: term → dataset (optioneel op kolom-niveau)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.term_dataset_links (
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  term_id         TEXT        NOT NULL,
  dataset_id      TEXT        NOT NULL,
  column_name     TEXT,
  PRIMARY KEY (installation_id, term_id, dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_term_dataset_links_term
  ON meta.term_dataset_links (installation_id, term_id);

CREATE INDEX IF NOT EXISTS idx_term_dataset_links_dataset
  ON meta.term_dataset_links (installation_id, dataset_id);
