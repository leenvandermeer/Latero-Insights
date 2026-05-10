import { createHash } from "crypto";
import { Pool } from "pg";
import type { NextRequest } from "next/server";

declare global {
  // eslint-disable-next-line no-var
  var __insightsPgPool: Pool | undefined;
}

function requireDatabaseUrl(): string {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("POSTGRES_URL is not configured");
  }
  return url;
}

export function getPgPool(): Pool {
  if (!global.__insightsPgPool) {
    global.__insightsPgPool = new Pool({
      connectionString: requireDatabaseUrl(),
    });
  }
  return global.__insightsPgPool;
}

export function resetPgPool(): void {
  if (global.__insightsPgPool) {
    void global.__insightsPgPool.end().catch(() => {});
    global.__insightsPgPool = undefined;
  }
}

export async function dbHealthCheck(): Promise<boolean> {
  const pool = getPgPool();
  const result = await pool.query("SELECT 1 AS ok");
  return result.rows.length === 1;
}

export async function getSaaSReadStoreCounts(): Promise<{
  pipeline_runs: number;
  dq_checks: number;
  lineage: number;
}> {
  const pool = getPgPool();
  const result = await pool.query(
    `
      SELECT
        (SELECT COUNT(*)::int FROM meta.runs)            AS pipeline_runs,
        (SELECT COUNT(*)::int FROM meta.quality_results) AS dq_checks,
        (SELECT COUNT(*)::int FROM meta.lineage_edges)   AS lineage
    `,
  );

  const row = result.rows[0] as {
    pipeline_runs: number;
    dq_checks: number;
    lineage: number;
  };

  return {
    pipeline_runs: Number(row.pipeline_runs ?? 0),
    dq_checks: Number(row.dq_checks ?? 0),
    lineage: Number(row.lineage ?? 0),
  };
}

export function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? "";
  const [kind, token] = header.split(" ");
  if (kind?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

export async function verifyInstallationToken(
  installationId: string,
  token: string,
): Promise<boolean> {
  if (process.env.INSIGHTS_AUTH_DISABLED === "true") {
    return true;
  }

  const pool = getPgPool();
  const result = await pool.query(
    `
      SELECT 1
      FROM insights_installations
      WHERE installation_id = $1
        AND active = TRUE
        AND crypt($2, token_hash) = token_hash
      LIMIT 1
    `,
    [installationId, token],
  );
  if (result.rowCount === 1) {
    await pool.query(
      `UPDATE insights_installations
       SET last_token_used_at = NOW(), updated_at = NOW()
       WHERE installation_id = $1`,
      [installationId],
    );
  }
  return result.rowCount === 1;
}

export function parseTimestamp(value: unknown): string {
  const text = String(value ?? "").trim();
  const date = new Date(text);
  if (!text || Number.isNaN(date.getTime())) {
    throw new Error("timestamp_utc must be a valid ISO-8601 timestamp");
  }
  return date.toISOString();
}

export function normalizeStatus(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "success" || raw === "passed") return "SUCCESS";
  if (raw === "warning") return "WARNING";
  if (raw === "failed" || raw === "error") return "FAILED";
  throw new Error("status must be one of: success, warning, failed (or passed/error aliases)");
}

export function requireString(value: unknown, field: string): string {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error(`${field} is required`);
  }
  return text;
}

export function optionalString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

// WP-5.6 — schema_version MAJOR validation. Accept "1.x", reject "2.x+" with 422.
export function validateSchemaVersion(value: unknown): void {
  const version = String(value ?? "").trim();
  if (!version) return; // missing schema_version is allowed (forward compat)
  const major = parseInt(version.split(".")[0] ?? "1", 10);
  if (Number.isNaN(major) || major >= 2) {
    throw new SchemaVersionError(
      `Unsupported schema_version '${version}'. Supported range: >=1.0, <2.0.`,
    );
  }
}

export class SchemaVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaVersionError";
  }
}

// WP-5.1 — License validation (LLIC-002). Returns 200/401/403 status code.
export async function validateLicense(
  installationId: string,
  apiKey: string,
  adapterPackage: string,
  adapterVersion: string,
): Promise<{ status: 200 | 401 | 403; subscription_tier?: string; valid_until?: string | null }> {
  const pool = getPgPool();

  const result = await pool.query(
    `
      SELECT subscription_tier, valid_until, active
      FROM insights_installations
      WHERE installation_id = $1
        AND crypt($2, token_hash) = token_hash
      LIMIT 1
    `,
    [installationId, apiKey],
  );

  if (result.rowCount === 0) {
    return { status: 401 };
  }

  const row = result.rows[0] as {
    subscription_tier: string;
    valid_until: string | null;
    active: boolean;
  };

  if (!row.active || (row.valid_until && new Date(row.valid_until) < new Date())) {
    return { status: 403 };
  }

  // LLIC-003 — record adapter_version per validation call
  await pool.query(
    `INSERT INTO adapter_version_log (installation_id, adapter_package, adapter_version)
     VALUES ($1, $2, $3)`,
    [installationId, adapterPackage, adapterVersion],
  );

  return {
    status: 200,
    subscription_tier: row.subscription_tier,
    valid_until: row.valid_until,
  };
}

// Admin helpers for key management UI

export interface InstallationRow {
  installation_id: string;
  label: string | null;
  environment: string;
  subscription_tier: string;
  valid_until: string | null;
  active: boolean;
  created_at: string;
  last_token_used_at: string | null;
}

export async function listInstallations(): Promise<InstallationRow[]> {
  const pool = getPgPool();
  await pool.query("ALTER TABLE insights_installations ADD COLUMN IF NOT EXISTS last_token_used_at TIMESTAMPTZ");
  const result = await pool.query(
    `SELECT installation_id, label, environment, subscription_tier, valid_until, active, created_at, last_token_used_at
     FROM insights_installations
     ORDER BY created_at DESC`,
  );
  return result.rows as InstallationRow[];
}

export async function createInstallation(
  installationId: string,
  environment: string,
  rawToken: string,
  label?: string,
  subscriptionTier = "trial",
): Promise<void> {
  const pool = getPgPool();
  await pool.query(
    `INSERT INTO insights_installations
       (installation_id, environment, token_hash, label, subscription_tier)
     VALUES ($1, $2, crypt($3, gen_salt('bf')), $4, $5)`,
    [installationId, environment, rawToken, label ?? null, subscriptionTier],
  );
  await seedSystemPolicies(pool, installationId);
}

async function seedSystemPolicies(pool: Pool, installationId: string): Promise<void> {
  const packs = [
    { id: "system-esg-csrd",  name: "ESG / CSRD Compliance",          description: "Policies for ESG and Corporate Sustainability Reporting Directive compliance", framework: "CSRD"      },
    { id: "system-bcbs239",   name: "BCBS-239",                       description: "Basel Committee on Banking Supervision Principle 239 — Risk Data Aggregation",  framework: "BCBS-239"  },
    { id: "system-data-mesh", name: "Data Mesh Governance",           description: "Data Mesh federated computational governance policies",                          framework: "Data Mesh" },
  ];
  const policies: { id: string; packId: string; name: string; description: string; rule: object; action: string }[] = [
    { id: "system-esg-owner",    packId: "system-esg-csrd",  name: "Data Product Owner Required",   description: "Every data product used for ESG reporting must have an owner",                      rule: { condition: "owner_missing" },                       action: "warn"   },
    { id: "system-esg-quality",  packId: "system-esg-csrd",  name: "Quality Pass Rate ≥ 95%",       description: "ESG data products must maintain a quality pass rate of at least 95%",               rule: { condition: "quality_below_threshold", threshold: 0.95 }, action: "warn" },
    { id: "system-esg-lineage",  packId: "system-esg-csrd",  name: "Full Lineage Required",         description: "ESG data products must have documented lineage",                                    rule: { condition: "no_lineage" },                          action: "warn"   },
    { id: "system-bcbs-owner",   packId: "system-bcbs239",   name: "Data Owner Required",           description: "All risk data products must have a named owner per BCBS-239 principle 3",          rule: { condition: "owner_missing" },                       action: "block"  },
    { id: "system-bcbs-sla",     packId: "system-bcbs239",   name: "SLA Definition Required",       description: "Risk data products must have a defined SLA per BCBS-239 principle 6",              rule: { condition: "sla_missing" },                         action: "block"  },
    { id: "system-bcbs-contract",packId: "system-bcbs239",   name: "Data Contract Required",        description: "Risk data products must be governed by a versioned data contract",                  rule: { condition: "contract_missing" },                    action: "warn"   },
    { id: "system-bcbs-incidents",packId:"system-bcbs239",   name: "No Open Critical Incidents",    description: "Risk data products must not have open critical incidents",                          rule: { condition: "open_incidents", severity: "critical" }, action: "block" },
    { id: "system-mesh-owner",   packId: "system-data-mesh", name: "Domain Owner Required",         description: "Each data product must have a domain team owner",                                  rule: { condition: "owner_missing" },                       action: "warn"   },
    { id: "system-mesh-quality", packId: "system-data-mesh", name: "Quality Pass Rate ≥ 90%",       description: "Data products must meet minimum quality standards",                                 rule: { condition: "quality_below_threshold", threshold: 0.90 }, action: "warn" },
    { id: "system-mesh-contract",packId: "system-data-mesh", name: "Data Contract Required",        description: "Data products must expose a versioned data contract for consumers",                 rule: { condition: "contract_missing" },                    action: "notify" },
    { id: "system-mesh-lineage", packId: "system-data-mesh", name: "Lineage Required",              description: "Data products must expose lineage to their sources",                               rule: { condition: "no_lineage" },                          action: "warn"   },
  ];

  for (const pack of packs) {
    await pool.query(
      `INSERT INTO meta.policy_packs (id, installation_id, name, description, framework)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [pack.id, installationId, pack.name, pack.description, pack.framework],
    );
  }
  for (const p of policies) {
    await pool.query(
      `INSERT INTO meta.policies (id, installation_id, pack_id, name, description, rule, scope, action, active)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, '{"all":true}'::jsonb, $7, true) ON CONFLICT DO NOTHING`,
      [p.id, installationId, p.packId, p.name, p.description, JSON.stringify(p.rule), p.action],
    );
  }
}

export async function updateInstallation(
  installationId: string,
  fields: { label?: string; active?: boolean; valid_until?: string | null; subscription_tier?: string },
): Promise<boolean> {
  const pool = getPgPool();
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (fields.label !== undefined) { sets.push(`label = $${idx++}`); values.push(fields.label); }
  if (fields.active !== undefined) { sets.push(`active = $${idx++}`); values.push(fields.active); }
  if (fields.valid_until !== undefined) { sets.push(`valid_until = $${idx++}`); values.push(fields.valid_until); }
  if (fields.subscription_tier !== undefined) { sets.push(`subscription_tier = $${idx++}`); values.push(fields.subscription_tier); }

  if (sets.length === 0) return false;

  sets.push(`updated_at = NOW()`);
  values.push(installationId);
  const result = await pool.query(
    `UPDATE insights_installations SET ${sets.join(", ")} WHERE installation_id = $${idx}`,
    values,
  );
  return (result.rowCount ?? 0) > 0;
}

export async function revokeInstallation(installationId: string): Promise<boolean> {
  return updateInstallation(installationId, { active: false });
}

export async function rotateInstallationKey(
  installationId: string,
  rawToken: string,
): Promise<boolean> {
  const pool = getPgPool();
  const result = await pool.query(
    `UPDATE insights_installations
     SET token_hash = crypt($2, gen_salt('bf')),
         active = TRUE,
         updated_at = NOW()
     WHERE installation_id = $1`,
    [installationId, rawToken],
  );
  return (result.rowCount ?? 0) > 0;
}
