import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromToken, checkIsAdmin } from "@/lib/session-auth";
import { SettingsDashboard } from "./dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings — Latero Control",
};

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("insights_session")?.value ?? "";
  const session = await getSessionFromToken(sessionToken);

  if (!session) {
    redirect("/settings?error=auth-required&next=%2Fsettings");
  }

  const isAdmin = await checkIsAdmin(session.user_id);
  if (!isAdmin) {
    redirect("/pipelines");
  }

  return <SettingsDashboard />;
}
