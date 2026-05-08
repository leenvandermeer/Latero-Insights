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
      className="min-h-screen px-4 py-10"
      style={{
        background:
          "radial-gradient(circle at 12% 12%, rgba(200,137,42,0.16), transparent 20%), radial-gradient(circle at 88% 84%, rgba(27,59,107,0.16), transparent 26%), var(--color-bg)",
      }}
    >
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden lg:block">
          <div
            className="rounded-[32px] border p-10"
            style={{ background: "var(--color-card)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-subtle)" }}>
              Latero Control
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
              Platform admin
            </h1>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
