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

export async function GET() {
  return NextResponse.json(readWidgets());
}

export async function POST(request: Request) {
  const body = await request.json() as Omit<SharedWidgetDef, "id" | "publishedAt">;
  if (!body.label?.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  const widgets = readWidgets();
  if (widgets.some((w) => w.label.toLowerCase() === body.label.toLowerCase())) {
    return NextResponse.json(
      { error: `A shared widget named "${body.label}" already exists` },
      { status: 409 }
    );
  }
  const newWidget: SharedWidgetDef = {
    ...body,
    id: crypto.randomUUID(),
    publishedAt: new Date().toISOString(),
  };
  writeWidgets([...widgets, newWidget]);
  return NextResponse.json(newWidget, { status: 201 });
}
