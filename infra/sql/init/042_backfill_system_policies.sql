-- 042: Backfill system policy packs voor installaties die aangemaakt werden
-- voordat 036_policy_pack_fixtures.sql voor het eerst draaide.
-- Identiek aan 036 maar expliciet bedoeld als herstelmigratie.
-- Idempotent: ON CONFLICT DO NOTHING op alle inserts.

-- ESG / CSRD
INSERT INTO meta.policy_packs (id, installation_id, name, description, framework)
SELECT 'system-esg-csrd', i.installation_id,
       'ESG / CSRD Compliance',
       'Policies for ESG and Corporate Sustainability Reporting Directive compliance',
       'CSRD'
FROM insights_installations i
ON CONFLICT DO NOTHING;

INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
SELECT 'system-esg-owner', i.installation_id, 'system-esg-csrd',
       'Data Product Owner Required',
       'Every data product used for ESG reporting must have an owner',
       '{"condition":"owner_missing"}', '{"all":true}', 'warn', true
FROM insights_installations i ON CONFLICT DO NOTHING;

INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
SELECT 'system-esg-quality', i.installation_id, 'system-esg-csrd',
       'Quality Pass Rate ≥ 95%',
       'ESG data products must maintain a quality pass rate of at least 95%',
       '{"condition":"quality_below_threshold","threshold":0.95}', '{"all":true}', 'warn', true
FROM insights_installations i ON CONFLICT DO NOTHING;

INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
SELECT 'system-esg-lineage', i.installation_id, 'system-esg-csrd',
       'Full Lineage Required',
       'ESG data products must have documented lineage',
       '{"condition":"no_lineage"}', '{"all":true}', 'warn', true
FROM insights_installations i ON CONFLICT DO NOTHING;

-- BCBS-239
INSERT INTO meta.policy_packs (id, installation_id, name, description, framework)
SELECT 'system-bcbs239', i.installation_id,
       'BCBS-239',
       'Basel Committee on Banking Supervision Principle 239 — Risk Data Aggregation',
       'BCBS-239'
FROM insights_installations i ON CONFLICT DO NOTHING;

INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
SELECT 'system-bcbs-owner', i.installation_id, 'system-bcbs239',
       'Data Owner Required',
       'All risk data products must have a named owner per BCBS-239 principle 3',
       '{"condition":"owner_missing"}', '{"all":true}', 'block', true
FROM insights_installations i ON CONFLICT DO NOTHING;

INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
SELECT 'system-bcbs-sla', i.installation_id, 'system-bcbs239',
       'SLA Definition Required',
       'Risk data products must have a defined SLA per BCBS-239 principle 6',
       '{"condition":"sla_missing"}', '{"all":true}', 'block', true
FROM insights_installations i ON CONFLICT DO NOTHING;

INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
SELECT 'system-bcbs-contract', i.installation_id, 'system-bcbs239',
       'Data Contract Required',
       'Risk data products must be governed by a versioned data contract',
       '{"condition":"contract_missing"}', '{"all":true}', 'warn', true
FROM insights_installations i ON CONFLICT DO NOTHING;

INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
SELECT 'system-bcbs-incidents', i.installation_id, 'system-bcbs239',
       'No Open Critical Incidents',
       'Risk data products must not have open critical incidents',
       '{"condition":"open_incidents","severity":"critical"}', '{"all":true}', 'block', true
FROM insights_installations i ON CONFLICT DO NOTHING;

-- Data Mesh
INSERT INTO meta.policy_packs (id, installation_id, name, description, framework)
SELECT 'system-data-mesh', i.installation_id,
       'Data Mesh Governance',
       'Data Mesh federated computational governance policies',
       'Data Mesh'
FROM insights_installations i ON CONFLICT DO NOTHING;

INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
SELECT 'system-mesh-owner', i.installation_id, 'system-data-mesh',
       'Domain Owner Required',
       'Each data product must have a domain team owner',
       '{"condition":"owner_missing"}', '{"all":true}', 'warn', true
FROM insights_installations i ON CONFLICT DO NOTHING;

INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
SELECT 'system-mesh-quality', i.installation_id, 'system-data-mesh',
       'Quality Pass Rate ≥ 90%',
       'Data products must meet minimum quality standards',
       '{"condition":"quality_below_threshold","threshold":0.90}', '{"all":true}', 'warn', true
FROM insights_installations i ON CONFLICT DO NOTHING;

INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
SELECT 'system-mesh-contract', i.installation_id, 'system-data-mesh',
       'Data Contract Required',
       'Data products must expose a versioned data contract for consumers',
       '{"condition":"contract_missing"}', '{"all":true}', 'notify', true
FROM insights_installations i ON CONFLICT DO NOTHING;

INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
SELECT 'system-mesh-lineage', i.installation_id, 'system-data-mesh',
       'Lineage Required',
       'Data products must expose lineage to their sources',
       '{"condition":"no_lineage"}', '{"all":true}', 'warn', true
FROM insights_installations i ON CONFLICT DO NOTHING;
