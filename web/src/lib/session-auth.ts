import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPgPool } from "@/lib/insights-saas-db";

const SESSION_COOKIE = "insights_session";
const SESSION_TTL_DAYS = Number(process.env.INSIGHTS_SESSION_TTL_DAYS ?? "14") || 14;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface SessionInstallation {
  installation_id: string;
  label: string | null;
  environment: string;
  active: boolean;
}

export interface AuthSession {
  user_id: string;
  email: string;
  two_factor_enabled: boolean;
  active_installation_id: string;
  installations: SessionInstallation[];
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function ensureAuthSchema(): Promise<void> {
  const pool = getPgPool();
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insights_users (
      user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(
    "ALTER TABLE insights_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insights_user_installations (
      user_id UUID NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
      installation_id TEXT NOT NULL REFERENCES insights_installations(installation_id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, installation_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insights_sessions (
      session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token_hash TEXT NOT NULL UNIQUE,
      user_id UUID NOT NULL REFERENCES insights_users(user_id) ON DELETE CASCADE,
      active_installation_id TEXT NOT NULL REFERENCES insights_installations(installation_id),
      user_agent TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    );
  `);

  await pool.query(
    "ALTER TABLE insights_installations ADD COLUMN IF NOT EXISTS last_token_used_at TIMESTAMPTZ",
  );
}

export async function verifyUserPassword(
  email: string,
  password: string,
): Promise<{ user_id: string; email: string; two_factor_enabled: boolean } | null> {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT user_id, email, two_factor_enabled
     FROM insights_users
     WHERE email = LOWER($1)
       AND active = TRUE
       AND crypt($2, password_hash) = password_hash
     LIMIT 1`,
    [email.trim(), password],
  );
  if (result.rowCount === 0) return null;
  return result.rows[0] as { user_id: string; email: string; two_factor_enabled: boolean };
}

export async function getUserInstallations(userId: string): Promise<SessionInstallation[]> {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT i.installation_id, i.label, i.environment, i.active
     FROM insights_user_installations ui
     JOIN insights_installations i ON i.installation_id = ui.installation_id
     WHERE ui.user_id = $1
       AND i.active = TRUE
     ORDER BY COALESCE(i.label, i.installation_id) ASC`,
    [userId],
  );
  return result.rows as SessionInstallation[];
}

export async function createSession(
  userId: string,
  activeInstallationId: string,
  request: NextRequest,
): Promise<string> {
  const pool = getPgPool();
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(rawToken);
  const userAgent = request.headers.get("user-agent") ?? null;
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await pool.query(
    `INSERT INTO insights_sessions (token_hash, user_id, active_installation_id, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tokenHash, userId, activeInstallationId, userAgent, ipAddress, expiresAt],
  );

  return rawToken;
}

async function resolveSession(token: string): Promise<AuthSession | null> {
  const pool = getPgPool();
  const tokenHash = hashSessionToken(token);

  const sessionResult = await pool.query(
    `SELECT s.user_id, s.active_installation_id, u.email, u.two_factor_enabled
     FROM insights_sessions s
     JOIN insights_users u ON u.user_id = s.user_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
       AND u.active = TRUE
     LIMIT 1`,
    [tokenHash],
  );

  if (sessionResult.rowCount === 0) return null;

  const row = sessionResult.rows[0] as {
    user_id: string;
    active_installation_id: string;
    email: string;
    two_factor_enabled: boolean;
  };

  const installations = await getUserInstallations(row.user_id);
  const hasActive = installations.some((i) => i.installation_id === row.active_installation_id);
  if (!hasActive) return null;

  await pool.query(
    `UPDATE insights_sessions
     SET last_used_at = NOW()
     WHERE token_hash = $1`,
    [tokenHash],
  );

  return {
    user_id: row.user_id,
    email: row.email,
    two_factor_enabled: row.two_factor_enabled,
    active_installation_id: row.active_installation_id,
    installations,
  };
}

export async function getSessionFromToken(token: string): Promise<AuthSession | null> {
  if (!token) return null;
  return resolveSession(token);
}

export async function getSessionFromRequest(request: NextRequest): Promise<AuthSession | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveSession(token);
}

export async function requireSession(request: NextRequest): Promise<AuthSession> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

function shouldUseSecureCookie(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto ?? request.nextUrl.protocol.replace(":", "");
  const hostname = request.nextUrl.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  return protocol === "https" && !isLocalhost;
}

export function attachSessionCookie(response: NextResponse, token: string, request: NextRequest): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(response: NextResponse, request: NextRequest): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: 0,
  });
}

export async function revokeSessionFromRequest(request: NextRequest): Promise<void> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return;
  const pool = getPgPool();
  await pool.query(
    `UPDATE insights_sessions SET revoked_at = NOW() WHERE token_hash = $1`,
    [hashSessionToken(token)],
  );
}

export async function switchActiveInstallation(
  request: NextRequest,
  installationId: string,
): Promise<AuthSession | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await resolveSession(token);
  if (!session) return null;

  const allowed = session.installations.some((i) => i.installation_id === installationId);
  if (!allowed) return null;

  const pool = getPgPool();
  await pool.query(
    `UPDATE insights_sessions
     SET active_installation_id = $1, last_used_at = NOW()
     WHERE token_hash = $2`,
    [installationId, hashSessionToken(token)],
  );

  return resolveSession(token);
}

export async function createOrUpdateUserWithInstallations(
  email: string,
  password: string,
  installationIds: string[],
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password || installationIds.length === 0) {
    throw new Error("email, password and at least one installation are required");
  }

  const pool = getPgPool();
  await pool.query("BEGIN");
  try {
    const userResult = await pool.query(
      `INSERT INTO insights_users (email, password_hash)
       VALUES ($1, crypt($2, gen_salt('bf')))
       ON CONFLICT (email) DO UPDATE
       SET password_hash = crypt($2, gen_salt('bf')),
           updated_at = NOW()
       RETURNING user_id`,
      [normalizedEmail, password],
    );

    const userId = String(userResult.rows[0]?.user_id ?? "");
    if (!userId) {
      throw new Error("Failed to create or update user");
    }

    await pool.query(`DELETE FROM insights_user_installations WHERE user_id = $1`, [userId]);

    for (const installationId of installationIds) {
      await pool.query(
        `INSERT INTO insights_user_installations (user_id, installation_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, installation_id) DO NOTHING`,
        [userId, installationId],
      );
    }

    await pool.query("COMMIT");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

export function getActiveInstallationFromSession(session: AuthSession): SessionInstallation | null {
  return session.installations.find((i) => i.installation_id === session.active_installation_id) ?? null;
}

export async function noteInstallationTokenUsed(installationId: string): Promise<void> {
  const pool = getPgPool();
  await pool.query(
    `UPDATE insights_installations SET last_token_used_at = NOW() WHERE installation_id = $1`,
    [installationId],
  );
}

// Admin role helpers
export async function checkIsAdmin(userId: string): Promise<boolean> {
  const pool = getPgPool();
  const result = await pool.query(`SELECT is_admin FROM insights_users WHERE user_id = $1`, [userId]);
  return result.rows[0]?.is_admin ?? false;
}

export async function grantAdminRole(userId: string): Promise<void> {
  const pool = getPgPool();
  await pool.query(`UPDATE insights_users SET is_admin = TRUE WHERE user_id = $1`, [userId]);
}

export async function revokeAdminRole(userId: string): Promise<void> {
  const pool = getPgPool();
  await pool.query(`UPDATE insights_users SET is_admin = FALSE WHERE user_id = $1`, [userId]);
}

// Audit logging
export interface AuditLogEntry {
  id: number;
  admin_user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  changes?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export async function logAdminAction(
  adminUserId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  changes?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  const pool = getPgPool();
  const changesJson = changes ? JSON.stringify(changes) : null;

  await pool.query(
    `INSERT INTO insights_audit_logs (admin_user_id, action, resource_type, resource_id, changes, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [adminUserId, action, resourceType, resourceId, changesJson, ipAddress, userAgent],
  );
}

export async function getAuditLog(
  limit: number = 100,
  offset: number = 0,
): Promise<AuditLogEntry[]> {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT id, admin_user_id, action, resource_type, resource_id, changes, ip_address, user_agent, created_at
     FROM insights_audit_logs
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

  return result.rows;
}

// Health metrics
export interface InstallationHealthSnapshot {
  installation_id: string;
  status: "connected" | "degraded" | "offline";
  message_count_24h: number;
  error_rate_pct: number;
  postgres_latency_ms: number;
  api_response_time_p95_ms: number;
  cache_hit_ratio: number;
  last_synced_at?: string;
}

export async function recordInstallationHealth(
  installationId: string,
  health: Partial<InstallationHealthSnapshot>,
): Promise<void> {
  const pool = getPgPool();
  await pool.query(
    `INSERT INTO insights_installation_health
     (installation_id, status, message_count_24h, error_rate_pct, postgres_latency_ms, api_response_time_p95_ms, cache_hit_ratio)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      installationId,
      health.status,
      health.message_count_24h ?? 0,
      health.error_rate_pct ?? 0,
      health.postgres_latency_ms ?? 0,
      health.api_response_time_p95_ms ?? 0,
      health.cache_hit_ratio ?? 0,
    ],
  );
}

export async function getInstallationHealthTimeline(
  installationId: string,
  days: number = 7,
): Promise<InstallationHealthSnapshot[]> {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT installation_id, status, message_count_24h, error_rate_pct, postgres_latency_ms,
            api_response_time_p95_ms, cache_hit_ratio, created_at as last_synced_at
     FROM insights_installation_health
     WHERE installation_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2
     ORDER BY created_at DESC`,
    [installationId, days],
  );

  return result.rows;
}
