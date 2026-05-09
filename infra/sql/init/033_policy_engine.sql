-- LADR-075 / WP-301: Policy Engine — data model
-- Policy packs, policies, verdicts en uitzonderingen.

CREATE TABLE IF NOT EXISTS meta.policy_packs (
  id              TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  name            TEXT        NOT NULL,
  description     TEXT,
  framework       TEXT,
  PRIMARY KEY (installation_id, id)
);

CREATE INDEX IF NOT EXISTS idx_policy_packs_installation
  ON meta.policy_packs (installation_id);

-- ---------------------------------------------------------------------------
-- Policies per pack
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.policies (
  id              TEXT        NOT NULL,
  installation_id TEXT        NOT NULL REFERENCES insights_installations (installation_id),
  pack_id         TEXT,
  name            TEXT        NOT NULL,
  description     TEXT,
  rule            JSONB       NOT NULL,
  -- { subject: string, condition: string, threshold?: number }
  scope           JSONB       NOT NULL DEFAULT '{"all":true}',
  -- { all?: bool, domains?: string[], products?: string[] }
  action          TEXT        NOT NULL CHECK (action IN ('warn','block','notify')),
  active          BOOLEAN     NOT NULL DEFAULT true,
  PRIMARY KEY (installation_id, id),
  CONSTRAINT meta_policies_pack_fk
    FOREIGN KEY (installation_id, pack_id)
    REFERENCES meta.policy_packs (installation_id, id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_policies_installation
  ON meta.policies (installation_id, active);

CREATE INDEX IF NOT EXISTS idx_policies_pack
  ON meta.policies (installation_id, pack_id);

-- ---------------------------------------------------------------------------
-- Verdicts: resultaat van een policy-evaluatie per product
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.policy_verdicts (
  id              BIGSERIAL   PRIMARY KEY,
  policy_id       TEXT        NOT NULL,
  installation_id TEXT        NOT NULL,
  product_id      TEXT        NOT NULL,
  verdict         TEXT        NOT NULL CHECK (verdict IN ('pass','fail','exception')),
  detail          JSONB,
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meta_policy_verdicts_policy_fk
    FOREIGN KEY (installation_id, policy_id)
    REFERENCES meta.policies (installation_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_policy_verdicts_policy
  ON meta.policy_verdicts (installation_id, policy_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_verdicts_product
  ON meta.policy_verdicts (installation_id, product_id, evaluated_at DESC);

-- ---------------------------------------------------------------------------
-- Uitzonderingen
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta.policy_exceptions (
  id              BIGSERIAL   PRIMARY KEY,
  policy_id       TEXT        NOT NULL,
  installation_id TEXT        NOT NULL,
  product_id      TEXT        NOT NULL,
  justification   TEXT        NOT NULL,
  expiry_date     DATE        NOT NULL,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','declined')),
  CONSTRAINT meta_policy_exceptions_policy_fk
    FOREIGN KEY (installation_id, policy_id)
    REFERENCES meta.policies (installation_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_policy_exceptions_policy
  ON meta.policy_exceptions (installation_id, policy_id, status);

CREATE INDEX IF NOT EXISTS idx_policy_exceptions_product
  ON meta.policy_exceptions (installation_id, product_id, status);
