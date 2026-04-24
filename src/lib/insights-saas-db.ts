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
