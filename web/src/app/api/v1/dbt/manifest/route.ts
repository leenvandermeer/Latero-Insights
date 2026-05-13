import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  getBearerToken,
  getPgPool,
  requireString,
  tokenFingerprint,
  verifyInstallationToken,
} from "@/lib/insights-saas-db";
import { writeMetaColumnLineage } from "@/lib/meta-ingest";

// ---------------------------------------------------------------------------
// DBT manifest.json types (DBT 1.6+ with column-level lineage)
// ---------------------------------------------------------------------------

interface DbtColumnLineageEntry {
  nodes: string[];   // upstream node unique_ids
  columns: string[]; // upstream column names (parallel to nodes)
}

interface DbtNode {
  resource_type: string;
  name: string;
  schema?: string;
  config?: { schema?: string };
  depends_on?: {
    nodes?: string[];
    columns?: Record<string, DbtColumnLineageEntry>;
  };
}

interface DbtManifest {
  nodes?: Record<string, DbtNode>;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const PIPELINE_LAYERS = new Set(["landing", "raw", "bronze", "silver", "gold"]);

function resolveLayer(schema: string | null | undefined): string | null {
  const s = schema?.toLowerCase().trim() ?? "";
  return PIPELINE_LAYERS.has(s) ? s : null;
}

function nodeSchema(node: DbtNode): string | null {
  return node.config?.schema ?? node.schema ?? null;
}

interface ColumnFlow {
  sourceName: string;
  sourceColumn: string;
  sourceLayer: string | null;
  targetName: string;
  targetColumn: string;
  targetLayer: string | null;
}

function parseManifest(manifest: DbtManifest): ColumnFlow[] {
  const flows: ColumnFlow[] = [];
  const nodes = manifest.nodes ?? {};

  // Build a lookup: unique_id → node
  const lookup = new Map<string, DbtNode>(Object.entries(nodes));

  for (const [, node] of Object.entries(nodes)) {
    if (node.resource_type !== "model") continue;
    const columns = node.depends_on?.columns;
    if (!columns || Object.keys(columns).length === 0) continue;

    const targetLayer = resolveLayer(nodeSchema(node));

    for (const [targetColumn, entry] of Object.entries(columns)) {
      for (let i = 0; i < entry.nodes.length; i++) {
        const upstreamId = entry.nodes[i];
        const sourceColumn = entry.columns[i];
        if (!upstreamId || !sourceColumn) continue;

        const upstreamNode = lookup.get(upstreamId);
        const sourceName = upstreamNode?.name ?? upstreamId.split(".").at(-1) ?? upstreamId;
        const sourceLayer = upstreamNode ? resolveLayer(nodeSchema(upstreamNode)) : null;

        flows.push({
          sourceName,
          sourceColumn,
          sourceLayer,
          targetName: node.name,
          targetColumn,
          targetLayer,
        });
      }
    }
  }

  return flows;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(`v1:dbt:manifest:${clientIp}`);
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

    if (!body.manifest || typeof body.manifest !== "object") {
      return NextResponse.json({ error: "Missing or invalid 'manifest' field" }, { status: 400 });
    }

    const manifest = body.manifest as DbtManifest;
    const flows = parseManifest(manifest);

    if (flows.length === 0) {
      return NextResponse.json(
        {
          accepted: true,
          imported: 0,
          message: "No column-level lineage found. Ensure DBT 1.6+ with column-level lineage enabled.",
        },
        { status: 200 },
      );
    }

    const pool = getPgPool();
    for (const flow of flows) {
      await writeMetaColumnLineage(pool, {
        installationId,
        sourceName: flow.sourceName,
        sourceColumn: flow.sourceColumn,
        sourceLayer: flow.sourceLayer,
        targetName: flow.targetName,
        targetColumn: flow.targetColumn,
        targetLayer: flow.targetLayer,
        transformationType: "DIRECT",
      });
    }

    await pool.query(
      `INSERT INTO ingest_audit (endpoint, installation_id, status_code, request_body, response_body)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [
        "dbt/manifest",
        installationId,
        201,
        JSON.stringify({ installation_id: installationId, manifest_node_count: Object.keys(manifest.nodes ?? {}).length }),
        JSON.stringify({ accepted: true, imported: flows.length, token_fingerprint: tokenFingerprint(token) }),
      ],
    );

    const response = NextResponse.json(
      { accepted: true, imported: flows.length, installation_id: installationId },
      { status: 201 },
    );
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
