import { NextRequest, NextResponse } from "next/server";
import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { rateLimit } from "@/lib/rate-limit";
import { getFromCache, writeToCache, isCacheOnly } from "@/lib/cache";
import type { LineageAttribute, LineageHop } from "@/lib/adapters/types";

const adapter = new DatabricksAdapter();
const CACHE_KEY = "lineage-attributes";
const CACHE_PARAMS = { scope: "current" };

function refWithoutAttribute(ref: string, attribute: string | null): string {
  if (!ref || !attribute) return ref;
  const suffix = `.${attribute}`;
  return ref.endsWith(suffix) ? ref.slice(0, -suffix.length) : ref;
}

function attributesFromHops(hops: LineageHop[]): LineageAttribute[] {
  return hops
    .filter((hop) => hop.source_attribute && hop.target_attribute)
    .map((hop) => ({
      source_entity_fqn: refWithoutAttribute(hop.source_ref, hop.source_attribute) || hop.source_entity,
      source_attribute: hop.source_attribute!,
      target_entity_fqn: refWithoutAttribute(hop.target_ref, hop.target_attribute) || hop.target_entity,
      target_attribute: hop.target_attribute!,
      is_current: true,
      provenance: "data_lineage_hop",
      evidence: hop.lineage_evidence ?? null,
    }));
}

function mergeAttributes(...sets: LineageAttribute[][]): LineageAttribute[] {
  const merged = new Map<string, LineageAttribute>();
  const rank: Record<string, number> = {
    lineage_attributes_current: 2,
    data_lineage_hop: 1,
  };
  for (const attributes of sets) {
    for (const attr of attributes) {
      const key = [
        attr.source_entity_fqn,
        attr.source_attribute,
        attr.target_entity_fqn,
        attr.target_attribute,
      ].join("::");
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, attr);
        continue;
      }
      const existingRank = rank[existing.provenance ?? "data_lineage_hop"] ?? 0;
      const nextRank = rank[attr.provenance ?? "data_lineage_hop"] ?? 0;
      if (nextRank > existingRank) {
        merged.set(key, { ...attr, evidence: attr.evidence ?? existing.evidence ?? null });
      } else if (!existing.evidence && attr.evidence) {
        merged.set(key, { ...existing, evidence: attr.evidence });
      }
    }
  }
  return [...merged.values()].sort((a, b) =>
    `${a.source_entity_fqn}.${a.source_attribute}`.localeCompare(`${b.source_entity_fqn}.${b.source_attribute}`)
  );
}

function recentRange(days = 30) {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, remaining } = rateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  if (isCacheOnly()) {
    const cached = getFromCache<LineageAttribute[]>(CACHE_KEY, CACHE_PARAMS);
    if (cached) {
      const lineage = getFromCache<LineageHop[]>("lineage", { from: "2000-01-01", to: "2099-12-31" });
      const data = lineage ? mergeAttributes(cached.data, attributesFromHops(lineage.data)) : cached.data;
      const response = NextResponse.json({ data, cachedAt: cached.cachedAt, source: "cache" });
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      return response;
    }
    return NextResponse.json(
      { error: "No cached lineage attribute data. Run a manual refresh first.", source: "cache" },
      { status: 503 }
    );
  }

  try {
    const [attributes, schema] = await Promise.all([
      adapter.getLineageAttributes(),
      adapter.getLineageSchemaInventory(),
    ]);
    let hopAttributes: LineageAttribute[] = [];
    try {
      hopAttributes = attributesFromHops(await adapter.getLineageHops(recentRange()));
    } catch (err) {
      console.warn("[API /lineage/attributes] hop-derived attributes unavailable:", err instanceof Error ? err.message : "Unknown error");
    }
    const merged = mergeAttributes(attributes, hopAttributes);
    writeToCache(CACHE_KEY, CACHE_PARAMS, merged);
    const response = NextResponse.json({
      data: merged,
      source: "databricks",
      meta: {
        schema: {
          lineage_attributes_current: schema.lineage_attributes_current,
          data_lineage: schema.data_lineage,
        },
        provenanceCounts: {
          lineage_attributes_current: merged.filter((row) => row.provenance === "lineage_attributes_current").length,
          data_lineage_hop: merged.filter((row) => row.provenance === "data_lineage_hop").length,
        },
      },
    });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-Cache", "MISS");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const cached = getFromCache<LineageAttribute[]>(CACHE_KEY, CACHE_PARAMS);
    if (cached) {
      const lineage = getFromCache<LineageHop[]>("lineage", { from: "2000-01-01", to: "2099-12-31" });
      const data = lineage ? mergeAttributes(cached.data, attributesFromHops(lineage.data)) : cached.data;
      const response = NextResponse.json({ data, cachedAt: cached.cachedAt, source: "cache", warning: message });
      response.headers.set("X-RateLimit-Remaining", String(remaining));
      response.headers.set("X-Cache", "STALE");
      return response;
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
