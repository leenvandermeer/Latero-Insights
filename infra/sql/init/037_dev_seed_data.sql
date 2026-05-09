-- Latero test seed data v2 — correct schema

-- Data products (sla is JSONB)
INSERT INTO meta.data_products (data_product_id, installation_id, display_name, description, owner, domain, sla, contract_ver, valid_from)
VALUES
  ('dp-energy',    'latero', 'Energy Portfolio',  'CBS Energie + EP Online',    'leen@latero.nl',  'Energy',     '{"tier":"gold"}'::jsonb,   '1.0', now() - interval '90 days'),
  ('dp-risk',      'latero', 'Risk Aggregation',  'BCBS-239 risk data product', 'leen@latero.nl',  'Risk',       '{"tier":"silver"}'::jsonb, '1.2', now() - interval '60 days'),
  ('dp-customers', 'latero', 'Customer 360',      'CRM + CDP integration',      'alice@acme.test', 'Commercial', '{"tier":"bronze"}'::jsonb, NULL,  now() - interval '30 days'),
  ('dp-esg',       'latero', 'ESG Reporting',     'CSRD sustainability data',   NULL,              'ESG',        NULL,                       NULL,  now() - interval '14 days')
ON CONFLICT DO NOTHING;

-- Entities
INSERT INTO meta.entities (entity_id, installation_id, data_product_id, display_name, source_system, entity_name, valid_from)
VALUES
  ('en-energy-raw',  'latero', 'dp-energy',    'Energy Raw',     'cbs',    'energy_raw',  now() - interval '90 days'),
  ('en-energy-gold', 'latero', 'dp-energy',    'Energy Gold',    'cbs',    'energy_gold', now() - interval '90 days'),
  ('en-risk-agg',    'latero', 'dp-risk',      'Risk Aggregate', 'core',   'risk_agg',    now() - interval '60 days'),
  ('en-customers',   'latero', 'dp-customers', 'Customer Base',  'crm',    'customers',   now() - interval '30 days'),
  ('en-esg',         'latero', 'dp-esg',       'ESG Metrics',    'manual', 'esg_metrics', now() - interval '14 days')
ON CONFLICT DO NOTHING;

-- Datasets (platform must be ICEBERG/DELTA/HIVE/JDBC/FILE/TOPIC/UNKNOWN, entity_type TABLE/VIEW/...)
INSERT INTO meta.datasets (dataset_id, installation_id, namespace, object_name, platform, entity_type, layer, entity_id, valid_from)
VALUES
  ('ds-energy-raw',  'latero', 'databricks', 'energy_raw',  'DELTA', 'TABLE', 'raw',    'en-energy-raw',  now() - interval '90 days'),
  ('ds-energy-gold', 'latero', 'databricks', 'energy_gold', 'DELTA', 'TABLE', 'gold',   'en-energy-gold', now() - interval '90 days'),
  ('ds-risk',        'latero', 'databricks', 'risk_agg',    'DELTA', 'TABLE', 'silver', 'en-risk-agg',    now() - interval '60 days'),
  ('ds-customers',   'latero', 'databricks', 'customers',   'DELTA', 'TABLE', 'silver', 'en-customers',   now() - interval '30 days'),
  ('ds-esg',         'latero', 'databricks', 'esg_metrics', 'FILE',  'FILE',  'bronze', 'en-esg',         now() - interval '14 days')
ON CONFLICT DO NOTHING;

-- Lineage edges (first_observed_at is NOT NULL)
INSERT INTO meta.lineage_edges (installation_id, source_dataset_id, target_dataset_id, first_observed_at, last_observed_at)
VALUES
  ('latero', 'ds-energy-raw',  'ds-energy-gold', now() - interval '90 days', now() - interval '1 hour'),
  ('latero', 'ds-energy-gold', 'ds-esg',         now() - interval '14 days', now() - interval '1 hour'),
  ('latero', 'ds-risk',        'ds-esg',         now() - interval '14 days', now() - interval '1 hour')
ON CONFLICT DO NOTHING;

-- Jobs (job_id is UUID, namespace column is job_namespace)
INSERT INTO meta.jobs (job_id, installation_id, job_name, job_namespace, first_seen_at)
VALUES
  (gen_random_uuid(), 'latero', 'energy_pipeline', 'databricks', now() - interval '90 days'),
  (gen_random_uuid(), 'latero', 'risk_pipeline',   'databricks', now() - interval '60 days')
ON CONFLICT DO NOTHING;

-- Runs (run_id is UUID, job_id is UUID — use subquery)
INSERT INTO meta.runs (run_id, job_id, installation_id, external_run_id, environment, status, started_at, ended_at, duration_ms)
SELECT gen_random_uuid(), j.job_id, 'latero', 'ext-energy-001', 'production', 'SUCCESS', now() - interval '2 hours',   now() - interval '110 min', 600000
FROM meta.jobs j WHERE j.installation_id='latero' AND j.job_name='energy_pipeline' LIMIT 1
ON CONFLICT DO NOTHING;
INSERT INTO meta.runs (run_id, job_id, installation_id, external_run_id, environment, status, started_at, ended_at, duration_ms)
SELECT gen_random_uuid(), j.job_id, 'latero', 'ext-energy-002', 'production', 'SUCCESS', now() - interval '26 hours', now() - interval '1570 min', 620000
FROM meta.jobs j WHERE j.installation_id='latero' AND j.job_name='energy_pipeline' LIMIT 1
ON CONFLICT DO NOTHING;
INSERT INTO meta.runs (run_id, job_id, installation_id, external_run_id, environment, status, started_at, ended_at, duration_ms)
SELECT gen_random_uuid(), j.job_id, 'latero', 'ext-risk-001',   'production', 'FAILED',   now() - interval '3 hours',  now() - interval '175 min', 300000
FROM meta.jobs j WHERE j.installation_id='latero' AND j.job_name='risk_pipeline' LIMIT 1
ON CONFLICT DO NOTHING;
INSERT INTO meta.runs (run_id, job_id, installation_id, external_run_id, environment, status, started_at, ended_at, duration_ms)
SELECT gen_random_uuid(), j.job_id, 'latero', 'ext-risk-002',   'production', 'SUCCESS', now() - interval '27 hours', now() - interval '1630 min', 590000
FROM meta.jobs j WHERE j.installation_id='latero' AND j.job_name='risk_pipeline' LIMIT 1
ON CONFLICT DO NOTHING;

-- Quality rules (severity uppercase: HIGH/MEDIUM/LOW, category: schema/accuracy/completeness/freshness/uniqueness/custom)
INSERT INTO meta.quality_rules (check_id, installation_id, check_name, check_category, severity, check_mode, dataset_id)
VALUES
  ('qr-001', 'latero', 'energy_nullcheck',     'completeness', 'HIGH',   'automatic', 'ds-energy-gold'),
  ('qr-002', 'latero', 'energy_rowcount',      'custom',       'MEDIUM', 'automatic', 'ds-energy-gold'),
  ('qr-003', 'latero', 'risk_referential',     'accuracy',     'HIGH',   'automatic', 'ds-risk'),
  ('qr-004', 'latero', 'customers_uniqueness', 'uniqueness',   'HIGH',   'automatic', 'ds-customers'),
  ('qr-005', 'latero', 'esg_range_check',      'accuracy',     'MEDIUM', 'automatic', 'ds-esg')
ON CONFLICT DO NOTHING;

-- Quality results (using latest run_ids)
INSERT INTO meta.quality_results (check_id, installation_id, run_id, status, result_value, threshold_value, executed_at)
SELECT 'qr-001', 'latero', r.run_id, 'SUCCESS', 0.99, 0.95, now() - interval '115 min'
FROM meta.runs r JOIN meta.jobs j ON r.job_id=j.job_id WHERE j.job_name='energy_pipeline' AND r.status='SUCCESS' ORDER BY r.started_at DESC LIMIT 1
ON CONFLICT DO NOTHING;
INSERT INTO meta.quality_results (check_id, installation_id, run_id, status, result_value, threshold_value, executed_at)
SELECT 'qr-002', 'latero', r.run_id, 'SUCCESS', 15423, 1000, now() - interval '115 min'
FROM meta.runs r JOIN meta.jobs j ON r.job_id=j.job_id WHERE j.job_name='energy_pipeline' AND r.status='SUCCESS' ORDER BY r.started_at DESC LIMIT 1
ON CONFLICT DO NOTHING;
INSERT INTO meta.quality_results (check_id, installation_id, run_id, status, result_value, threshold_value, executed_at)
SELECT 'qr-003', 'latero', r.run_id, 'FAILED', 0.88, 0.99, now() - interval '178 min'
FROM meta.runs r JOIN meta.jobs j ON r.job_id=j.job_id WHERE j.job_name='risk_pipeline' AND r.status='FAILED' ORDER BY r.started_at DESC LIMIT 1
ON CONFLICT DO NOTHING;
INSERT INTO meta.quality_results (check_id, installation_id, run_id, status, result_value, threshold_value, executed_at)
SELECT 'qr-004', 'latero', r.run_id, 'WARNING', 0.97, 0.99, now() - interval '115 min'
FROM meta.runs r JOIN meta.jobs j ON r.job_id=j.job_id WHERE j.job_name='energy_pipeline' AND r.status='SUCCESS' ORDER BY r.started_at DESC LIMIT 1
ON CONFLICT DO NOTHING;

-- Trust score snapshots
INSERT INTO meta.trust_score_snapshots (installation_id, product_id, score, factors, calculated_at)
VALUES
  ('latero', 'dp-energy',    88, '{"quality":92,"lineage":100,"ownership":100,"incidents":80}'::jsonb, now() - interval '1 hour'),
  ('latero', 'dp-risk',      61, '{"quality":55,"lineage":80,"ownership":100,"incidents":60}'::jsonb,  now() - interval '1 hour'),
  ('latero', 'dp-customers', 72, '{"quality":90,"lineage":60,"ownership":75,"incidents":100}'::jsonb,  now() - interval '1 hour'),
  ('latero', 'dp-esg',       40, '{"quality":50,"lineage":40,"ownership":0,"incidents":100}'::jsonb,   now() - interval '1 hour')
ON CONFLICT DO NOTHING;

-- Incidents (source_type: alert/policy_violation/manual)
INSERT INTO meta.incidents (installation_id, product_id, title, severity, status, source_type)
VALUES
  ('latero', 'dp-risk',     'Risk pipeline integrity failure',    'high',   'open',        'alert'),
  ('latero', 'dp-customers','Customer uniqueness check degraded', 'medium', 'in_progress', 'alert'),
  ('latero', 'dp-esg',      'ESG owner not assigned',            'low',    'open',        'policy_violation')
ON CONFLICT DO NOTHING;

-- Alerts
INSERT INTO meta.alerts (installation_id, type, severity, title, message, product_id, status)
VALUES
  ('latero', 'quality_failure',  'high',   'Risk quality check failed',   'Referential integrity dropped to 88%', 'dp-risk',      'open'),
  ('latero', 'policy_violation', 'medium', 'ESG product missing owner',   'Policy: owner_missing fired',          'dp-esg',       'open'),
  ('latero', 'quality_warning',  'low',    'Customer uniqueness warning', 'Uniqueness threshold not met (97%)',   'dp-customers', 'acknowledged')
ON CONFLICT DO NOTHING;

-- Glossary terms (columns: id, name, definition, owner_team)
INSERT INTO meta.glossary_terms (id, installation_id, name, definition, owner_team, valid_from)
VALUES
  ('gterm-001', 'latero', 'Energy Portfolio', 'All datasets related to CBS Energie and EP Online', 'Energy Team', now() - interval '60 days'),
  ('gterm-002', 'latero', 'Risk Aggregation', 'BCBS-239 compliant risk data aggregation product',  'Risk Team',   now() - interval '40 days'),
  ('gterm-003', 'latero', 'ESG Metrics',      'Sustainability metrics for CSRD reporting',         NULL,          now() - interval '14 days')
ON CONFLICT DO NOTHING;

-- Change events (columns: change_type, severity, entity_type, entity_id, diff jsonb, detected_at)
INSERT INTO meta.change_events (installation_id, change_type, severity, entity_type, entity_id, diff, detected_at)
VALUES
  ('latero', 'schema_change', 'significant', 'dataset', 'ds-energy-gold', '{"added_columns":["emission_factor"]}'::jsonb, now() - interval '5 days'),
  ('latero', 'owner_change',  'informational','product', 'dp-risk',        '{"old":"","new":"leen@latero.nl"}'::jsonb,     now() - interval '3 days'),
  ('latero', 'sla_change',    'breaking',    'product', 'dp-customers',   '{"old":"gold","new":"bronze"}'::jsonb,         now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- Cost records
INSERT INTO meta.product_cost_records (installation_id, product_id, period_start, period_end, cost_usd, source)
VALUES
  ('latero', 'dp-energy',    date_trunc('month', now()) - interval '1 month', date_trunc('month', now()), 1240.50, 'databricks'),
  ('latero', 'dp-risk',      date_trunc('month', now()) - interval '1 month', date_trunc('month', now()), 3820.00, 'databricks'),
  ('latero', 'dp-customers', date_trunc('month', now()) - interval '1 month', date_trunc('month', now()), 890.25,  'estimated'),
  ('latero', 'dp-esg',       date_trunc('month', now()) - interval '1 month', date_trunc('month', now()), 120.00,  'manual')
ON CONFLICT DO NOTHING;

-- Evidence records (columns: product_id, event_type, payload jsonb, recorded_at)
INSERT INTO meta.evidence_records (installation_id, product_id, event_type, payload, hash, recorded_at)
VALUES
  ('latero', 'dp-energy',    'audit_completed',  '{"note":"Annual data audit Q1 2026"}'::jsonb,          md5('audit_completed-dp-energy-latero'),          now() - interval '30 days'),
  ('latero', 'dp-energy',    'quality_reviewed', '{"note":"Quality rules reviewed and approved"}'::jsonb, md5('quality_reviewed-dp-energy-latero'),          now() - interval '7 days'),
  ('latero', 'dp-risk',      'cert_approved',    '{"note":"BCBS-239 certification approved"}'::jsonb,     md5('cert_approved-dp-risk-latero'),               now() - interval '45 days'),
  ('latero', 'dp-customers', 'owner_confirmed',  '{"note":"Data owner confirmed in registry"}'::jsonb,    md5('owner_confirmed-dp-customers-latero'),        now() - interval '20 days');

-- Business outputs (columns: id, name, output_type, owner_team, criticality, description)
INSERT INTO meta.business_outputs (id, installation_id, name, output_type, owner_team, criticality, description)
VALUES
  ('bo-001', 'latero', 'Energy Dashboard', 'dashboard',   'Energy Team', 'high',   'PowerBI dashboard for energy portfolio'),
  ('bo-002', 'latero', 'Risk Report BCBS', 'report',      'Risk Team',   'critical','Monthly BCBS-239 risk report'),
  ('bo-003', 'latero', 'CRM Sync',         'process',     'Sales Team',  'medium', 'Salesforce integration for customer data')
ON CONFLICT DO NOTHING;

-- Product consumers (columns: installation_id, product_id, consumer_id, consumer_type, registered_at)
INSERT INTO meta.product_consumers (installation_id, product_id, consumer_id, consumer_type, registered_at)
VALUES
  ('latero', 'dp-energy',    'energy-analysts', 'team',   now() - interval '60 days'),
  ('latero', 'dp-energy',    'cfo-dashboard',   'system', now() - interval '30 days'),
  ('latero', 'dp-risk',      'risk-mgmt-dept',  'team',   now() - interval '50 days'),
  ('latero', 'dp-customers', 'mkt-analytics',   'team',   now() - interval '25 days')
ON CONFLICT DO NOTHING;

SELECT
  'seed_v2' as status,
  (SELECT COUNT(*)::int FROM meta.data_products     WHERE installation_id='latero') as products,
  (SELECT COUNT(*)::int FROM meta.entities          WHERE installation_id='latero') as entities,
  (SELECT COUNT(*)::int FROM meta.datasets          WHERE installation_id='latero') as datasets,
  (SELECT COUNT(*)::int FROM meta.runs              WHERE installation_id='latero') as runs,
  (SELECT COUNT(*)::int FROM meta.quality_results   WHERE installation_id='latero') as qresults,
  (SELECT COUNT(*)::int FROM meta.trust_score_snapshots WHERE installation_id='latero') as trust,
  (SELECT COUNT(*)::int FROM meta.incidents         WHERE installation_id='latero') as incidents,
  (SELECT COUNT(*)::int FROM meta.alerts            WHERE installation_id='latero') as alerts,
  (SELECT COUNT(*)::int FROM meta.glossary_terms    WHERE installation_id='latero') as glossary,
  (SELECT COUNT(*)::int FROM meta.change_events     WHERE installation_id='latero') as changes,
  (SELECT COUNT(*)::int FROM meta.product_cost_records WHERE installation_id='latero') as costs,
  (SELECT COUNT(*)::int FROM meta.evidence_records  WHERE installation_id='latero') as evidence;

-- Policy verdicts (for compliance matrix — dev seed only)
INSERT INTO meta.policy_verdicts (policy_id, installation_id, product_id, verdict, detail)
VALUES
  ('system-esg-owner',    'latero', 'dp-energy',   'pass', '{"reason":"Owner assigned"}'::jsonb),
  ('system-esg-owner',    'latero', 'dp-risk',     'pass', '{"reason":"Owner assigned"}'::jsonb),
  ('system-esg-owner',    'latero', 'dp-esg',      'fail', '{"reason":"No owner assigned"}'::jsonb),
  ('system-esg-owner',    'latero', 'dp-customers','pass', '{"reason":"Owner assigned"}'::jsonb),
  ('system-esg-quality',  'latero', 'dp-energy',   'pass', '{"reason":"Quality pass rate 99%"}'::jsonb),
  ('system-esg-quality',  'latero', 'dp-risk',     'fail', '{"reason":"Referential integrity 88%"}'::jsonb),
  ('system-esg-quality',  'latero', 'dp-esg',      'pass', '{"reason":"Quality pass rate 100%"}'::jsonb),
  ('system-esg-quality',  'latero', 'dp-customers','pass', '{"reason":"Quality pass rate 97%"}'::jsonb),
  ('system-esg-lineage',  'latero', 'dp-energy',   'pass', '{"reason":"Full lineage present"}'::jsonb),
  ('system-esg-lineage',  'latero', 'dp-risk',     'fail', '{"reason":"Partial lineage only"}'::jsonb),
  ('system-esg-lineage',  'latero', 'dp-esg',      'pass', '{"reason":"Lineage tracked"}'::jsonb),
  ('system-esg-lineage',  'latero', 'dp-customers','pass', '{"reason":"Full lineage present"}'::jsonb),
  ('system-bcbs-owner',   'latero', 'dp-energy',   'pass', '{"reason":"Owner assigned"}'::jsonb),
  ('system-bcbs-owner',   'latero', 'dp-risk',     'pass', '{"reason":"Owner assigned"}'::jsonb),
  ('system-bcbs-sla',     'latero', 'dp-energy',   'pass', '{"reason":"SLA gold defined"}'::jsonb),
  ('system-bcbs-sla',     'latero', 'dp-risk',     'pass', '{"reason":"SLA silver defined"}'::jsonb),
  ('system-bcbs-sla',     'latero', 'dp-esg',      'fail', '{"reason":"No SLA defined"}'::jsonb),
  ('system-bcbs-contract','latero', 'dp-energy',   'pass', '{"reason":"Contract v1.0 active"}'::jsonb),
  ('system-bcbs-contract','latero', 'dp-risk',     'pass', '{"reason":"Contract v1.2 active"}'::jsonb),
  ('system-bcbs-contract','latero', 'dp-esg',      'fail', '{"reason":"No data contract"}'::jsonb),
  ('system-bcbs-contract','latero', 'dp-customers','fail', '{"reason":"No data contract"}'::jsonb)
ON CONFLICT DO NOTHING;
