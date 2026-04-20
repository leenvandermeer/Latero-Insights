import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { SharedWidgetDef } from "@/types/dashboard";

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const widgets = readWidgets();
  const filtered = widgets.filter((w) => w.id !== id);
  if (filtered.length === widgets.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  writeWidgets(filtered);
  return new NextResponse(null, { status: 204 });
}
