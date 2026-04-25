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
        (SELECT COUNT(*)::int FROM pipeline_runs) AS pipeline_runs,
        (SELECT COUNT(*)::int FROM data_quality_checks) AS dq_checks,
        (SELECT COUNT(*)::int FROM data_lineage) AS lineage
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
}

export async function listInstallations(): Promise<InstallationRow[]> {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT installation_id, label, environment, subscription_tier, valid_until, active, created_at
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
