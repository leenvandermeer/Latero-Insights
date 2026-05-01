import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { SharedWidgetDef } from "@/types/dashboard";
import { requireSession } from "@/lib/session-auth";

const DATA_PATH = join(process.cwd(), "data", "shared-widgets.json");

function readWidgets(): SharedWidgetDef[] {
  try {
    if (!existsSync(DATA_PATH)) return [];
    return JSON.parse(readFileSync(DATA_PATH, "utf-8")) as SharedWidgetDef[];
  } catch {
    return [];
  }
}

function writeWidgets(widgets: SharedWidgetDef[]) {
  writeFileSync(DATA_PATH, JSON.stringify(widgets, null, 2), "utf-8");
}

export async function GET(request: NextRequest) {
  // LINS-016: Verify user session and scope to active installation
  let installationId: string;
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allWidgets = readWidgets();
  const filtered = allWidgets.filter((w) => w.installation_id === installationId);
  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  // LINS-016: Verify user session and validate installation ownership
  let installationId: string;
  try {
    const session = await requireSession(request);
    installationId = session.active_installation_id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json() as Omit<SharedWidgetDef, "id" | "publishedAt" | "installation_id">;
  if (!body.label?.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  const widgets = readWidgets();
  const sameInstallation = widgets.filter((w) => w.installation_id === installationId);
  if (sameInstallation.some((w) => w.label.toLowerCase() === body.label.toLowerCase())) {
    return NextResponse.json(
      { error: `A shared widget named "${body.label}" already exists in your installation` },
      { status: 409 }
    );
  }
  const newWidget: SharedWidgetDef = {
    ...body,
    id: crypto.randomUUID(),
    installation_id: installationId,
    publishedAt: new Date().toISOString(),
  };
  writeWidgets([...widgets, newWidget]);
  return NextResponse.json(newWidget, { status: 201 });
}
