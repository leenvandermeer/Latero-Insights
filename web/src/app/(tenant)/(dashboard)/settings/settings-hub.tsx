"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Settings2, Bell, Mail } from "lucide-react";
import { SettingsDashboard } from "./dashboard";
import { AlertRoutingSettings } from "./alert-routing/alert-routing";
import { NotificationsSettings } from "./notifications/notifications";

type Tab = "general" | "alert-routing" | "notifications";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "general", label: "General", Icon: Settings2 },
  { id: "alert-routing", label: "Alert Routing", Icon: Bell },
  { id: "notifications", label: "Notifications", Icon: Mail },
];

export function SettingsHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = useMemo<Tab>(() => {
    const value = searchParams.get("tab");
    return value === "alert-routing" || value === "notifications" ? value : "general";
  }, [searchParams]);

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex h-full flex-col page-content">
      {/* Tabs */}
      <div className="mb-6 overflow-x-auto border-b pt-3" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex min-w-max gap-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => updateParams({ tab: id })}
              className="flex min-h-[var(--touch-target-min)] items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
              style={{
                color: tab === id ? "var(--color-brand)" : "var(--color-text-muted)",
                borderBottom: tab === id ? "2px solid var(--color-brand)" : "2px solid transparent",
                background: "transparent",
                marginBottom: "-1px",
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "general" && <SettingsDashboard />}
        {tab === "alert-routing" && <AlertRoutingSettings />}
        {tab === "notifications" && <NotificationsSettings />}
      </div>
    </div>
  );
}
