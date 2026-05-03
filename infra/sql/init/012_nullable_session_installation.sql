-- Migration 012: nullable active_installation_id for break-glass platform sessions (LADR-037)
-- Platform operators (is_break_glass) have no tenant installation.
-- Their session uses active_installation_id = NULL.

ALTER TABLE insights_sessions
  ALTER COLUMN active_installation_id DROP NOT NULL;

ALTER TABLE insights_sessions
  DROP CONSTRAINT IF EXISTS insights_sessions_active_installation_id_fkey;

ALTER TABLE insights_sessions
  ADD CONSTRAINT insights_sessions_active_installation_id_fkey
    FOREIGN KEY (active_installation_id)
    REFERENCES insights_installations(installation_id)
    ON DELETE SET NULL;
