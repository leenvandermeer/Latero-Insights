"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboards } from "@/contexts/dashboard-context";
import { DashboardCanvas } from "../dashboard";

export function DashboardPage({ dashboardId }: { dashboardId: string }) {
  const { getDashboardById, setActiveId, mounted } = useDashboards();
  const router = useRouter();
  const dashboard = getDashboardById(dashboardId);

  useEffect(() => {
    if (!mounted) return; // wait for localStorage to hydrate before redirecting
    if (dashboard) setActiveId(dashboardId);
    else router.replace("/dashboard");
  }, [mounted, dashboard, dashboardId, setActiveId, router]);

  // Show nothing while store is hydrating or dashboard is being found
  if (!mounted || !dashboard) return null;
  return <DashboardCanvas dashboardId={dashboardId} />;
}
