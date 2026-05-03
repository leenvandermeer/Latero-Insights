/**
 * GET /api/v1/admin/installations/[installation_id]/auth-config
 *   Returns the auth policy and SSO config for an installation.
 *   Client secret is NEVER returned to the browser — only `client_secret_ref` (env var name).
 *
 * PUT /api/v1/admin/installations/[installation_id]/auth-config
 *   Upserts auth_policy and/or sso_config for an installation.
 *   Accepts `client_secret_ref` (env var name), never the secret value itself.
 *   CSRF: Origin-header check required (WP6 contract for mutating auth-config endpoints).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getPgPool } from "@/lib/insights-saas-db";
import { validateOrigin } from "@/lib/auth-audit";
import type { AuthMode } from "@/lib/auth-policy";

const VALID_AUTH_MODES: AuthMode[] = [
  "sso_only",
  "sso_with_break_glass",
  "sso_with_local_fallback",
  "local_only",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ installation_id: string }> },
) {
  const adminResult = await requireAdminSession(request);
  if (adminResult.error) {
    return NextResponse.json({ error: adminResult.message }, { status: adminResult.status });
  }

  const { installation_id } = await params;
  const pool = getPgPool();

  const [policyResult, ssoResult] = await Promise.all([
    pool.query(
      `SELECT auth_mode, jit_provisioning, jit_default_role, allowed_domains, break_glass_enabled
       FROM installation_auth_policy
       WHERE installation_id = $1`,
      [installation_id],
    ),
    pool.query(
      `SELECT issuer, client_id, client_secret_ref, redirect_uri, scopes,
              allowed_groups, pkce_required, enabled,
              COALESCE(role_mapping, '{}')::jsonb AS role_mapping
       FROM installation_sso_config
       WHERE installation_id = $1`,
      [installation_id],
    ),
  ]);

  return NextResponse.json({
    auth_policy: policyResult.rows[0] ?? null,
    sso_config: ssoResult.rows[0] ?? null,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ installation_id: string }> },
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminResult = await requireAdminSession(request);
  if (adminResult.error) {
    return NextResponse.json({ error: adminResult.message }, { status: adminResult.status });
  }

  const { installation_id } = await params;

  let body: {
    auth_policy?: {
      auth_mode?: string;
      jit_provisioning?: boolean;
      jit_default_role?: string;
      allowed_domains?: string[] | null;
      break_glass_enabled?: boolean;
    };
    sso_config?: {
      issuer?: string;
      client_id?: string;
      client_secret_ref?: string | null;
      redirect_uri?: string;
      scopes?: string[];
      allowed_groups?: string[] | null;
      pkce_required?: boolean;
      enabled?: boolean;
      role_mapping?: Record<string, string>;
    };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate auth_mode if provided
  if (body.auth_policy?.auth_mode !== undefined) {
    if (!VALID_AUTH_MODES.includes(body.auth_policy.auth_mode as AuthMode)) {
      return NextResponse.json(
        { error: `Invalid auth_mode. Must be one of: ${VALID_AUTH_MODES.join(", ")}` },
        { status: 400 },
      );
    }
  }

  // Validate SSO config if provided
  const sso = body.sso_config;
  if (sso !== undefined) {
    if (sso.issuer !== undefined) {
      try {
        const url = new URL(sso.issuer);
        if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
          return NextResponse.json(
            { error: "Issuer URL must use HTTPS in production." },
            { status: 400 },
          );
        }
      } catch {
        return NextResponse.json({ error: "Issuer URL is not a valid URL." }, { status: 400 });
      }
    }
    if (sso.client_id !== undefined && sso.client_id.trim() === "") {
      return NextResponse.json({ error: "Client ID must not be empty." }, { status: 400 });
    }
    if (sso.scopes !== undefined && !Array.isArray(sso.scopes)) {
      return NextResponse.json({ error: "Scopes must be an array of strings." }, { status: 400 });
    }
    if (sso.role_mapping !== undefined && (typeof sso.role_mapping !== "object" || Array.isArray(sso.role_mapping))) {
      return NextResponse.json({ error: "role_mapping must be an object." }, { status: 400 });
    }
  }

  const pool = getPgPool();

  // Verify installation exists
  const instCheck = await pool.query(
    `SELECT 1 FROM insights_installations WHERE installation_id = $1`,
    [installation_id],
  );
  if (instCheck.rowCount === 0) {
    return NextResponse.json({ error: "Installation not found" }, { status: 404 });
  }

  // Upsert auth_policy if provided
  if (body.auth_policy !== undefined) {
    const ap = body.auth_policy;
    await pool.query(
      `INSERT INTO installation_auth_policy
         (installation_id, auth_mode, jit_provisioning, jit_default_role, allowed_domains, break_glass_enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (installation_id) DO UPDATE SET
         auth_mode           = COALESCE($2, installation_auth_policy.auth_mode),
         jit_provisioning    = COALESCE($3, installation_auth_policy.jit_provisioning),
         jit_default_role    = COALESCE($4, installation_auth_policy.jit_default_role),
         allowed_domains     = $5,
         break_glass_enabled = COALESCE($6, installation_auth_policy.break_glass_enabled)`,
      [
        installation_id,
        ap.auth_mode ?? null,
        ap.jit_provisioning ?? null,
        ap.jit_default_role ?? null,
        ap.allowed_domains !== undefined ? ap.allowed_domains : null,
        ap.break_glass_enabled ?? null,
      ],
    );
  }

  // Upsert sso_config if provided
  if (body.sso_config !== undefined) {
    const s = body.sso_config;
    await pool.query(
      `INSERT INTO installation_sso_config
         (installation_id, issuer, client_id, client_secret_ref, redirect_uri, scopes,
          allowed_groups, pkce_required, enabled, role_mapping)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (installation_id) DO UPDATE SET
         issuer            = COALESCE($2, installation_sso_config.issuer),
         client_id         = COALESCE($3, installation_sso_config.client_id),
         client_secret_ref = $4,
         redirect_uri      = COALESCE($5, installation_sso_config.redirect_uri),
         scopes            = COALESCE($6, installation_sso_config.scopes),
         allowed_groups    = $7,
         pkce_required     = COALESCE($8, installation_sso_config.pkce_required),
         enabled           = COALESCE($9, installation_sso_config.enabled),
         role_mapping      = COALESCE($10, installation_sso_config.role_mapping)`,
      [
        installation_id,
        s.issuer ?? null,
        s.client_id ?? null,
        s.client_secret_ref !== undefined ? s.client_secret_ref : null,
        s.redirect_uri ?? null,
        s.scopes ? JSON.stringify(s.scopes) : null,
        s.allowed_groups !== undefined ? s.allowed_groups : null,
        s.pkce_required ?? null,
        s.enabled ?? null,
        s.role_mapping ? JSON.stringify(s.role_mapping) : null,
      ],
    );
  }

  return NextResponse.json({ ok: true });
}
