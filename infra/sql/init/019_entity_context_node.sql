-- Migration 019: add is_context_node flag to meta.entities
-- Context nodes are framework/runtime datasets (e.g. "latero") that appear as
-- sources in lineage but are not data entities owned by the team.
-- Heuristic: fqn = source_system on the originating dataset.

ALTER TABLE meta.entities
  ADD COLUMN IF NOT EXISTS is_context_node boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_meta_entities_context_node
  ON meta.entities (installation_id, is_context_node);

-- Backfill: mark entities where any dataset has fqn = source_system
UPDATE meta.entities e
SET is_context_node = true
WHERE EXISTS (
  SELECT 1 FROM meta.datasets d
  WHERE d.installation_id = e.installation_id
    AND d.entity_id = e.entity_id
    AND d.source_system IS NOT NULL
    AND d.fqn = d.source_system
);
