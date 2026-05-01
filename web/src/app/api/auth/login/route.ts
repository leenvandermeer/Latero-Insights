import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  attachSessionCookie,
  createSession,
  ensureAuthSchema,
  getUserInstallations,
  verifyUserPassword,
  checkIsAdmin,
} from "@/lib/session-auth";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`auth:login:${clientIp}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "").trim();
  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  await ensureAuthSchema();
  const user = await verifyUserPassword(email, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const installations = await getUserInstallations(user.user_id);
  if (installations.length === 0) {
    return NextResponse.json({ error: "No active organizations assigned" }, { status: 403 });
  }

  const preferredInstallation = String(body.installation_id ?? "").trim();
  const activeInstallation = preferredInstallation && installations.some((i) => i.installation_id === preferredInstallation)
    ? preferredInstallation
    : installations[0].installation_id;

  const rawToken = await createSession(user.user_id, activeInstallation, request);
  const isAdmin = await checkIsAdmin(user.user_id);

  const response = NextResponse.json({
    authenticated: true,
    user: {
      email: user.email,
      two_factor_enabled: user.two_factor_enabled,
      two_factor_required: false,
      is_admin: isAdmin,
    },
    active_installation: installations.find((i) => i.installation_id === activeInstallation) ?? null,
    installations,
  });

  attachSessionCookie(response, rawToken, request);
  return response;
}
