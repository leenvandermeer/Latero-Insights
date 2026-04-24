import { NextRequest, NextResponse } from "next/server";
import { dbHealthCheck } from "@/lib/insights-saas-db";

export async function GET(_request: NextRequest) {
  try {
    const database = await dbHealthCheck();
    return NextResponse.json(
      {
        status: database ? "ok" : "error",
        database,
        timestamp: new Date().toISOString(),
      },
      { status: database ? 200 : 503 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        status: "error",
        database: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
