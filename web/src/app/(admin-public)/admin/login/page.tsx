import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkIsBreakGlass, getSessionFromToken } from "@/lib/session-auth";
import { AdminLoginForm } from "./form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Login — Latero Control",
};

export default async function AdminLoginPage() {
  // If already authenticated as break-glass, go to admin
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("insights_session")?.value ?? "";
  if (sessionToken) {
    const session = await getSessionFromToken(sessionToken);
    if (session) {
      const isBreakGlass = await checkIsBreakGlass(session.user_id);
      if (isBreakGlass) {
        redirect("/admin");
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--color-bg)" }}>
      <AdminLoginForm />
    </div>
  );
}
