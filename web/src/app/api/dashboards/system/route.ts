import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { WidgetSlot } from "@/types/dashboard";
import type { ResponsiveLayouts } from "react-grid-layout";
import { requireSession } from "@/lib/session-auth";

export interface SystemOverride {
  id: string;
  widgets: WidgetSlot[];
  layout: ResponsiveLayouts;
  updatedAt: string;
}

const DATA_PATH = join(process.cwd(), "data", "system-overrides.json");

function read(): Record<string, SystemOverride> {
  try {
    if (!existsSync(DATA_PATH)) return {};
    return JSON.parse(readFileSync(DATA_PATH, "utf-8")) as Record<string, SystemOverride>;
  } catch {
    return {};
  }
}

function write(data: Record<string, SystemOverride>) {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// GET /api/dashboards/system — return all overrides
export async function GET(request: NextRequest) {
  // LINS-016: Verify user session before exposing system dashboard overrides
  try {
    await requireSession(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(read());
}

// PUT /api/dashboards/system — upsert one override
export async function PUT(request: NextRequest) {
  // LINS-016: Verify user session before allowing system dashboard modifications
  try {
    await requireSession(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json() as Partial<SystemOverride>;
  if (!body.id || !body.widgets || !body.layout) {
    return NextResponse.json({ error: "id, widgets and layout are required" }, { status: 400 });
  }
  const overrides = read();
  overrides[body.id] = {
    id: body.id,
    widgets: body.widgets,
    layout: body.layout,
    updatedAt: new Date().toISOString(),
  };
  write(overrides);
  return NextResponse.json(overrides[body.id]);
}

// DELETE /api/dashboards/system?id=system:pipelines — reset one override
export async function DELETE(request: NextRequest) {
  // LINS-016: Verify user session before allowing system dashboard deletion
  try {
    await requireSession(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const overrides = read();
  delete overrides[id];
  write(overrides);
  return NextResponse.json({ ok: true });
}
