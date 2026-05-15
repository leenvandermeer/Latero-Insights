-- Migration 057: ingest_audit retention
-- Adds a cleanup function that removes audit records older than a given number of days.
-- Default retention: 90 days.
-- Called from the deploy script after each migration run.
-- If pg_cron is available on the instance, a daily schedule is also created.

CREATE OR REPLACE FUNCTION cleanup_ingest_audit(retain_days INT DEFAULT 90)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM ingest_audit
  WHERE created_at < NOW() - (retain_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Schedule via pg_cron if the extension is available (graceful no-op if not)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-ingest-audit',
      '0 3 * * *',
      $cron$SELECT cleanup_ingest_audit(90)$cron$
    );
  END IF;
END;
$$;
