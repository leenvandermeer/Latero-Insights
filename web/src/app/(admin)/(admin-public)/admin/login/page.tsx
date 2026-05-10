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
    <div
      className="admin-theme min-h-screen px-4 py-10"
      style={{
        background:
          "radial-gradient(ellipse at 0% 0%, rgba(200,137,42,0.28) 0%, transparent 45%), radial-gradient(ellipse at 100% 100%, rgba(27,59,107,0.28) 0%, transparent 45%), var(--color-bg)",
      }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-sm flex-col items-center justify-center gap-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-subtle)" }}>
            Latero Control
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
            Platform admin
          </h1>
        </div>
        <div className="w-full">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
