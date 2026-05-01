import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, revokeSessionFromRequest } from "@/lib/session-auth";

export async function POST(request: NextRequest) {
  await revokeSessionFromRequest(request);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response, request);
  return response;
}
