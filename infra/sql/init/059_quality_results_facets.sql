-- Add check_facets JSONB to quality_results for arbitrary runtime context.
-- Also index for GIN queries on facet keys.
ALTER TABLE meta.quality_results
  ADD COLUMN IF NOT EXISTS check_facets JSONB;

CREATE INDEX IF NOT EXISTS idx_quality_results_facets
  ON meta.quality_results USING GIN (check_facets)
  WHERE check_facets IS NOT NULL;
