import { NextResponse } from "next/server";
import { STATIC_FIELD_REFERENCES, mergeFieldReferences, type FieldReference } from "@/lib/widget-field-reference";
import { DatabricksAdapter } from "@/lib/adapters/databricks";
import { isCacheOnly } from "@/lib/cache";

// Cached so every widget builder open doesn't re-query Databricks.
let cachedRefs: FieldReference[] | null = null;
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000;

async function loadMdcfReferences(): Promise<FieldReference[]> {
  // When MDCF provides a `widget_field_values` table this function queries it.
  // Expected schema: field_name VARCHAR, field_value VARCHAR, label VARCHAR.
  // Until then, returns an empty array so static defaults are used unchanged.
  try {
    if (isCacheOnly()) return [];
    const adapter = new DatabricksAdapter();
    return await adapter.getFieldValueReferences();
  } catch {
    return [];
  }
}

export async function GET() {
  const now = Date.now();
  if (!cachedRefs || now - cachedAt > TTL_MS) {
    const mdcf = await loadMdcfReferences();
    cachedRefs = mergeFieldReferences(STATIC_FIELD_REFERENCES, mdcf);
    cachedAt = now;
  }
  return NextResponse.json({ data: cachedRefs });
}
