import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { checkIsBreakGlass, getSessionFromToken } from "@/lib/session-auth";

interface AdminLayoutProps {
  children: ReactNode;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("insights_session")?.value ?? "";
  const session = await getSessionFromToken(sessionToken);

  if (!session) {
    redirect("/admin/login");
  }

  const isBreakGlass = await checkIsBreakGlass(session.user_id);
  if (!isBreakGlass) {
    redirect("/admin/login");
  }

  return (
    <AdminShell sessionEmail={session.email}>{children}</AdminShell>
  );
}
