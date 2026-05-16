import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  getBearerToken,
  getPgPool,
  optionalString,
  parseTimestamp,
  requireString,
  tokenFingerprint,
  verifyInstallationToken,
} from "@/lib/insights-saas-db";
import { writeMetaLineage } from "@/lib/meta-ingest";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(`v1:lineage:${clientIp}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } },
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const installationId = requireString(body.installation_id, "installation_id");
    const authorized = await verifyInstallationToken(installationId, token);
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized installation/token" }, { status: 401 });
    }

    const timestampUtc = parseTimestamp(body.timestamp_utc);
    const runId = requireString(body.run_id, "run_id");
    const sourceEntity = requireString(
      body.source_ref ?? body.source_entity ?? body.input_entity,
      "source_ref",
    );
    const targetEntity = requireString(
      body.target_ref ?? body.target_entity ?? body.output_entity,
      "target_ref",
    );
    const evidence =
      body.evidence && typeof body.evidence === "object" && !Array.isArray(body.evidence)
        ? (body.evidence as Record<string, unknown>)
        : null;

    const pool = getPgPool();
    await writeMetaLineage(pool, {
      installationId,
      externalRunId: runId,
      sourceEntity,
      targetEntity,
      sourceRef: optionalString(body.source_ref),
      targetRef: optionalString(body.target_ref),
      sourceType: optionalString(body.source_type),
      targetType: optionalString(body.target_type),
      sourceAttribute: optionalString(body.source_attribute),
      targetAttribute: optionalString(body.target_attribute),
      sourceSystem: optionalString(body.source_system),
      sourceLayer: optionalString(body.source_layer),
      targetLayer: optionalString(body.target_layer),
      lineageScope: optionalString(body.lineage_scope),
      relationType: optionalString(body.relation_type),
      evidence,
      timestampUtc,
    });

    await pool.query(
      `
        INSERT INTO ingest_audit (endpoint, installation_id, status_code, request_body, response_body)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
      `,
      [
        "lineage",
        installationId,
        201,
        JSON.stringify(body),
        JSON.stringify({ accepted: true, token_fingerprint: tokenFingerprint(token) }),
      ],
    );

    const response = NextResponse.json(
      { accepted: true, event_type: "data_lineage", installation_id: installationId },
      { status: 201 },
    );
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
