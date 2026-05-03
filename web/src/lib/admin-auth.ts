/**
 * Admin authentication helpers
 * Used by admin API routes and admin page layout
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession, checkIsBreakGlass } from "@/lib/session-auth";

export async function requireAdminSession(request: NextRequest) {
  // First, require valid session
  let session;
  try {
    session = await requireSession(request);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return {
        error: true,
        status: 401,
        message: "Authentication required",
      };
    }
    throw error;
  }

  // Then, check break-glass (platform operator) role
  const isBreakGlass = await checkIsBreakGlass(session.user_id);
  if (!isBreakGlass) {
    return {
      error: true,
      status: 403,
      message: "Platform admin access required",
    };
  }

  return { error: false, session };
}

/**
 * Middleware guard for admin routes
 * Can be used in layout or individual route handlers
 */
export async function validateAdminAccess(
  request: NextRequest,
): Promise<{ valid: boolean; session?: any; error?: string }> {
  const adminResult = await requireAdminSession(request);

  if (adminResult.error) {
    return {
      valid: false,
      error: adminResult.message,
    };
  }

  return {
    valid: true,
    session: adminResult.session,
  };
}

/**
 * Helper to extract request metadata for audit logging
 */
export function getRequestMetadata(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  return { ip, userAgent };
}
